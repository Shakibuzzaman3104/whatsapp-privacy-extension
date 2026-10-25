/**
 * @author Shakib
 * @since 25/10/26
 */
import type { NanoStatus, Status, ToBackground, ToContent } from '@/lib/messages';
import { type ChatRule, type Settings, loadSettings, onSettingsChanged, updateSettings } from '@/lib/settings';

const CHAT_URLS = [
  'https://web.whatsapp.com/*',
  'https://web.telegram.org/*',
  'https://www.messenger.com/*',
  'https://www.facebook.com/messages*',
];

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

  const ready = loadSettings().then((s) => {
    settings = s;
    void updateIcon();
    return s;
  });
  void chrome.storage.session.get('panic').then((saved) => {
    panic = !!saved.panic;
  });

  onSettingsChanged((s) => {
    settings = s;
    void updateIcon();
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

  chrome.runtime.onMessage.addListener((message: ToBackground, _sender, reply) => {
    switch (message.type) {
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
          reply({ panic, nano: nanoState } satisfies Status),
        );
        return true;
    }
  });
});
