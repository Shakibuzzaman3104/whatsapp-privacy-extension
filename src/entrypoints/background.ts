/**
 * @author Shakib
 * @since 25/10/26
 */
import { GuardState } from '@/lib/guard';
import type { GuardStatus, NanoStatus, Status, ToBackground, ToContent } from '@/lib/messages';
import { type ChatRule, type Settings, loadSettings, onSettingsChanged, updateSettings } from '@/lib/settings';

const CHAT_URLS = [
  'https://web.whatsapp.com/*',
  'https://web.telegram.org/*',
  'https://www.messenger.com/*',
  'https://www.facebook.com/messages*',
];
const OFFSCREEN_URL = '/offscreen.html';

declare const LanguageModel: {
  availability(): Promise<NanoStatus>;
  create(options: object): Promise<NanoSession>;
} | undefined;
interface NanoSession {
  clone(): Promise<NanoSession>;
  prompt(input: string, options?: object): Promise<string>;
  destroy(): void;
}

export default defineBackground(() => {
  let settings: Settings | null = null;
  let panic = false;
  let guardStatus: GuardStatus = 'off';
  let snoozedUntil = 0;
  const activeTabs = new Set<number>();
  const guard = new GuardState(false);

  const ready = loadSettings().then((s) => {
    settings = s;
    guard.setEmptySeat(s.guard.emptySeat);
    void updateIcon();
    return s;
  });
  void chrome.storage.session.get(['panic', 'activeTabs']).then((saved) => {
    panic = !!saved.panic;
    for (const id of (saved.activeTabs as number[] | undefined) ?? []) activeTabs.add(id);
    void syncCamera();
  });

  onSettingsChanged((s) => {
    settings = s;
    guard.setEmptySeat(s.guard.emptySeat);
    void updateIcon();
    void syncCamera();
  });

  // ---- broadcasting -------------------------------------------------------

  async function broadcast(message: ToContent) {
    const tabs = await chrome.tabs.query({ url: CHAT_URLS });
    for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }

  async function setPanic(on: boolean) {
    panic = on;
    await chrome.storage.session.set({ panic });
    await broadcast({ type: 'shield', reason: 'panic', on });
  }

  async function updateIcon() {
    const on = settings?.enabled ?? true;
    const name = (size: number) => `/icon/${on ? '' : 'off-'}${size}.png`;
    await chrome.action.setIcon({ path: { 16: name(16), 32: name(32), 48: name(48), 128: name(128) } });
    await chrome.action.setTitle({ title: on ? 'Veil — protecting your chats' : 'Veil — paused' });
  }

  // ---- shortcuts and menus -----------------------------------------------

  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'panic') await setPanic(!panic);
    if (command === 'toggle') await updateSettings((s) => { s.enabled = !s.enabled; });
  });

  const MENU: [ChatRule, string][] = [
    ['always', 'Always blur this chat'],
    ['never', 'Never blur this chat'],
    ['hide', 'Hide this chat from the list'],
    ['default', 'Reset this chat to default'],
  ];

  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: 'veil', title: 'Veil', contexts: ['page', 'selection', 'link', 'image'], documentUrlPatterns: CHAT_URLS });
    for (const [rule, title] of MENU) {
      chrome.contextMenus.create({ id: `rule:${rule}`, parentId: 'veil', title, contexts: ['page', 'selection', 'link', 'image'], documentUrlPatterns: CHAT_URLS });
    }
    if (reason === 'install') await chrome.runtime.openOptionsPage();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    if (!tab?.id || !id.startsWith('rule:')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'setChatRule', rule: id.slice(5) as ChatRule } satisfies ToContent).catch(() => {});
  });

  // ---- shoulder-surfer guard ---------------------------------------------

  async function hasOffscreen() {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    });
    return contexts.length > 0;
  }

  let syncing = Promise.resolve();
  function syncCamera() {
    syncing = syncing.then(syncCameraNow, syncCameraNow);
    return syncing;
  }

  // The camera runs only while the guard is on, the camera is allowed, a chat tab
  // is on screen and focused, and the guard isn't snoozed.
  async function syncCameraNow() {
    const s = settings ?? (await ready);
    const { cameraGranted } = await chrome.storage.local.get('cameraGranted');
    const want = s.enabled && s.guard.enabled && !!cameraGranted && activeTabs.size > 0 && Date.now() >= snoozedUntil;
    const running = await hasOffscreen();

    if (!s.guard.enabled) guardStatus = 'off';
    else if (!cameraGranted) guardStatus = 'needs-camera';
    else if (Date.now() < snoozedUntil) guardStatus = 'paused';
    else if (guardStatus !== 'triggered' && guardStatus !== 'error') guardStatus = 'watching';

    if (want && !running) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Counts faces in front of the camera on this device to cover chats when someone else is looking.',
      });
    } else if (!want && running) {
      await chrome.offscreen.closeDocument();
      if (guard.covered) await setGuardCover(false);
      guard.reset();
    }
  }

  async function setGuardCover(on: boolean) {
    if (on) guardStatus = 'triggered';
    else if (guardStatus === 'triggered') guardStatus = 'watching';
    await broadcast({ type: 'shield', reason: 'guard', on });
  }

  async function onFaces(count: number) {
    if (Date.now() < snoozedUntil) return;
    if (guardStatus === 'error') guardStatus = 'watching';
    const decision = guard.push(count);
    if (decision.changed) await setGuardCover(decision.covered);
  }

  chrome.alarms.onAlarm.addListener(() => void syncCamera());

  // ---- on-device AI deep scan --------------------------------------------

  let nano: Promise<NanoSession | null> | null = null;
  let queue = Promise.resolve();
  const SYSTEM_PROMPT =
    'You decide whether a chat message would embarrass or harm its owner if someone looking over their shoulder read it. ' +
    'Private means: intimate or sexual content, health or medical details, relationship or family conflict, money troubles, ' +
    'legal trouble, credentials, or confidential work matters. Ordinary small talk, plans, jokes and greetings are not private.';

  async function nanoStatus(): Promise<NanoStatus> {
    try {
      return typeof LanguageModel === 'undefined' ? 'unavailable' : await LanguageModel.availability();
    } catch {
      return 'unavailable';
    }
  }

  function nanoSession() {
    nano ??= (async () => {
      if ((await nanoStatus()) !== 'available') return null;
      return LanguageModel!.create({ initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }] });
    })().catch(() => null);
    return nano;
  }

  function deepScan(text: string): Promise<boolean> {
    const run = queue.then(async () => {
      const base = await nanoSession();
      if (!base) {
        nano = null;
        return false;
      }
      // A fresh clone per message keeps earlier messages out of the context.
      const session = await base.clone();
      try {
        const answer = await session.prompt(`Message:\n"""${text.slice(0, 1000)}"""`, {
          responseConstraint: { type: 'object', properties: { private: { type: 'boolean' } }, required: ['private'] },
        });
        return JSON.parse(answer).private === true;
      } catch {
        return false;
      } finally {
        session.destroy();
      }
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  // ---- messages -----------------------------------------------------------

  chrome.runtime.onMessage.addListener((message: ToBackground, sender, reply) => {
    const tabId = sender.tab?.id;
    switch (message.type) {
      case 'presence':
        if (tabId === undefined) return;
        if (message.active) activeTabs.add(tabId);
        else activeTabs.delete(tabId);
        void chrome.storage.session.set({ activeTabs: [...activeTabs] });
        void syncCamera();
        return;
      case 'faces':
        void onFaces(message.count);
        return;
      case 'cameraError':
        guardStatus = message.name === 'NotAllowedError' ? 'needs-camera' : 'error';
        if (message.name === 'NotAllowedError') void chrome.storage.local.remove('cameraGranted').then(syncCamera);
        return;
      case 'cameraGranted':
        void chrome.storage.local.set({ cameraGranted: true }).then(syncCamera);
        return;
      case 'snoozeGuard':
        snoozedUntil = Date.now() + message.minutes * 60_000;
        void setGuardCover(false).then(() => {
          guard.reset();
          return syncCamera();
        });
        chrome.alarms.create('guard-snooze', { when: snoozedUntil + 500 });
        return;
      case 'setPanic':
        void setPanic(message.on);
        return;
      case 'deepScan':
        void ready
          .then((s) => (s.sensitive.deepScan ? deepScan(message.text) : false))
          .then((sensitive) => reply({ sensitive }));
        return true;
      case 'getStatus':
        void Promise.all([ready, nanoStatus()]).then(([, nanoState]) =>
          reply({ panic, guard: guardStatus, nano: nanoState } satisfies Status),
        );
        return true;
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (activeTabs.delete(tabId)) void syncCamera();
  });
});
