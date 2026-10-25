/**
 * @author Shakib
 * @since 25/10/26
 */
import { adapterForHost } from '@/lib/adapters';
import type { SiteAdapter } from '@/lib/adapters/types';
import { classify } from '@/lib/classify';
import { type PageInfo, type Status, type ToBackground, type ToContent, sendToBackground } from '@/lib/messages';
import { verifyPin } from '@/lib/pin';
import {
  ALL_CATEGORIES, type ChatRule, DEFAULT_SETTINGS, type Settings,
  chatKey, effectiveCategories, loadSettings, onSettingsChanged, resolveChatRule, updateSettings,
} from '@/lib/settings';
import { Shield } from '@/lib/shield';
import { Snackbar } from '@/lib/snackbar';
import { buildCss } from '@/lib/styles';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

export default defineContentScript({
  matches: [
    'https://web.whatsapp.com/*',
    'https://web.telegram.org/*',
    'https://www.messenger.com/*',
    'https://www.facebook.com/*',
  ],
  runAt: 'document_start',
  main(ctx) {
    const adapter = adapterForHost(location.hostname);
    if (adapter) new Engine(adapter, ctx).start();
  },
});

const DEEP_SCAN_MIN_LENGTH = 15;

class Engine {
  private settings: Settings = DEFAULT_SETTINGS;
  private readonly html = document.documentElement;
  private readonly classified = new WeakMap<Element, string>();
  private readonly deepScanned = new Map<string, boolean>();
  private frame = 0;
  private dirty: Node[] = [];
  private fullScan = true;
  private idleTimer = 0;
  private chatTitle: string | null = null;
  private wasProtecting = false;
  /** The camera guard saw someone else: blur everything, but hover still reveals. */
  private guardActive = false;
  private readonly snackbar = new Snackbar();
  private readonly shield = new Shield({
    verifyPin: (pin) => {
      const { hash, salt } = this.settings.lock;
      return hash && salt ? verifyPin(pin, hash, salt) : Promise.resolve(true);
    },
    onAction: (reason) => {
      if (reason === 'panic') this.endPanic();
    },
    onUnlocked: () => {
      this.shield.set('lock', false);
      if (this.shield.has('panic')) void this.send({ type: 'setPanic', on: false });
      this.shield.set('away', false);
      this.resetIdle();
    },
  });

  constructor(private readonly adapter: SiteAdapter, private readonly ctx: ContentScriptContext) {}

  /**
   * Reloading or updating the extension orphans this script in open tabs, and every
   * message then throws. The orphan keeps its blur and stops talking until the tab reloads.
   */
  private send<T>(message: ToBackground): Promise<T | undefined> {
    if (this.ctx.isInvalid) return Promise.resolve(undefined);
    return sendToBackground<T>(message).catch(() => undefined);
  }

  start() {
    const style = document.createElement('style');
    style.id = 'veil-style';
    style.textContent = buildCss(this.adapter);
    // Fail closed: blur with the defaults until the saved settings arrive.
    this.html.append(style);
    this.applyClasses();

    const useSettings = (s: Settings) => {
      this.settings = s;
      this.fullScan = true;
      this.applyClasses();
      this.resetIdle();
      this.schedule();
    };
    void loadSettings().then(useSettings);
    onSettingsChanged(useSettings);

    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') this.dirty.push(record.target);
        else record.addedNodes.forEach((n) => this.dirty.push(n));
      }
      this.schedule();
    }).observe(this.html, { childList: true, subtree: true, characterData: true });

    chrome.runtime.onMessage.addListener((message: ToContent, _sender, reply) => {
      this.onMessage(message, reply);
      return message.type === 'getPageInfo';
    });

    this.watchPresence();
    this.watchAltKey();
    this.watchIdle();
    void this.send<Status>({ type: 'getStatus' }).then((status) => {
      if (status?.panic) this.shield.set('panic', true);
      if (status?.guard === 'triggered') this.setGuard(true);
    });
  }

  private get protecting() {
    return this.settings.enabled && this.settings.sites[this.adapter.id].enabled && this.adapter.isActive(location);
  }

  // Runs in the next animation frame, which is still before the browser paints the mutation.
  private schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.process());
  }

  private process() {
    this.frame = 0;
    // Single-page apps change chats (and, on facebook.com, whole sections) without reloading.
    const title = this.adapter.chatTitle();
    if (title !== this.chatTitle || this.protecting !== this.wasProtecting) {
      this.chatTitle = title;
      this.applyClasses();
    }
    this.tagRows();
    if (this.settings.sensitive.enabled) {
      const roots = this.fullScan ? [document] : this.dirty;
      this.fullScan = false;
      this.dirty = [];
      this.tagSensitive(roots);
    } else {
      this.dirty = [];
    }
    this.shield.ensureAttached();
    this.snackbar.ensureAttached();
  }

  private applyClasses() {
    const s = this.settings;
    const rule = resolveChatRule(s, this.adapter.id, this.chatTitle);
    const on = this.guardActive ? new Set(ALL_CATEGORIES) : effectiveCategories(s, this.adapter.id, rule);
    const cls = this.html.classList;
    this.wasProtecting = this.protecting;
    cls.toggle('veil-on', this.wasProtecting);
    for (const c of ALL_CATEGORIES) cls.toggle(`veil-c-${c}`, on.has(c));
    cls.toggle('veil-sens', s.sensitive.enabled);
    cls.toggle('veil-alt', s.reveal === 'alt');
    this.html.dataset.veilChat = rule;
    this.html.style.setProperty('--veil-blur', `${s.blurStrength}px`);
  }

  private tagRows() {
    const rules = this.settings.chatRules;
    for (const row of document.querySelectorAll(this.adapter.listRow)) {
      const title = this.adapter.rowTitle(row);
      const rule = title ? rules[chatKey(this.adapter.id, title)] : undefined;
      const value = rule === 'always' || rule === 'hide' ? rule : null;
      if ((row as HTMLElement).dataset.veilRow !== (value ?? undefined)) {
        if (value) (row as HTMLElement).dataset.veilRow = value;
        else delete (row as HTMLElement).dataset.veilRow;
      }
    }
  }

  private tagSensitive(roots: (Node | Document)[]) {
    const { kinds, deepScan } = this.settings.sensitive;
    for (const source of this.adapter.textSources) {
      const found = new Set<Element>();
      for (const root of roots) {
        const el = root instanceof Element ? root : root.parentElement;
        if (root instanceof Document) {
          root.querySelectorAll(source.text).forEach((e) => found.add(e));
          continue;
        }
        if (!el || !el.isConnected) continue;
        const inside = el.closest(source.text);
        if (inside) found.add(inside);
        el.querySelectorAll(source.text).forEach((e) => found.add(e));
      }
      for (const textEl of found) {
        const tagEl = textEl.closest(source.tag) as HTMLElement | null;
        if (!tagEl) continue;
        const value = textEl.textContent ?? '';
        if (this.classified.get(textEl) === value) continue;
        this.classified.set(textEl, value);
        const result = classify(value, kinds);
        if (result.sensitive) {
          tagEl.dataset.veilS = source.scope;
          tagEl.dataset.veilKinds = result.kinds.join(' ');
        } else if (tagEl.dataset.veilKinds !== 'ai') {
          delete tagEl.dataset.veilS;
          delete tagEl.dataset.veilKinds;
          if (deepScan && value.length >= DEEP_SCAN_MIN_LENGTH) this.deepScan(value, tagEl, source.scope);
        }
      }
    }
  }

  private deepScan(text: string, tagEl: HTMLElement, scope: string) {
    const mark = () => {
      tagEl.dataset.veilS = scope;
      tagEl.dataset.veilKinds = 'ai';
    };
    const cached = this.deepScanned.get(text);
    if (cached !== undefined) {
      if (cached) mark();
      return;
    }
    void this.send<{ sensitive: boolean }>({ type: 'deepScan', text }).then((result) => {
      if (!result) return;
      this.deepScanned.set(text, result.sensitive);
      if (result.sensitive) mark();
    });
  }

  private onMessage(message: ToContent, reply: (value: PageInfo) => void) {
    switch (message.type) {
      case 'shield':
        if (message.reason === 'guard') {
          this.setGuard(message.on);
          return;
        }
        if (!message.on && message.reason === 'panic' && this.lockEnabled && this.shield.has('panic')) {
          this.shield.set('lock', true);
          return;
        }
        this.shield.set(message.reason, message.on);
        return;
      case 'setChatRule':
        void this.setChatRule(message.rule);
        return;
      case 'getPageInfo':
        reply({
          site: this.adapter.id,
          label: this.adapter.label,
          chatTitle: this.adapter.chatTitle(),
          rule: resolveChatRule(this.settings, this.adapter.id, this.adapter.chatTitle()),
          sensitiveCount: document.querySelectorAll('[data-veil-s]').length,
        });
    }
  }

  private async setChatRule(rule: ChatRule) {
    const title = this.adapter.chatTitle();
    if (!title) return;
    await updateSettings((s) => {
      const key = chatKey(this.adapter.id, title);
      if (rule === 'default') delete s.chatRules[key];
      else s.chatRules[key] = rule;
    });
  }

  private setGuard(on: boolean) {
    this.guardActive = on;
    this.applyClasses();
    if (!on) {
      this.snackbar.hide();
      return;
    }
    this.snackbar.show('Someone may be looking · chats blurred', {
      label: 'Pause 10 min',
      onClick: () => void this.send({ type: 'snoozeGuard', minutes: 10 }),
    });
  }

  private get lockEnabled() {
    return this.settings.lock.onAway && !!this.settings.lock.hash;
  }

  private endPanic() {
    if (this.lockEnabled) this.shield.set('lock', true);
    else void this.send({ type: 'setPanic', on: false });
  }

  // Tells the background whether this tab is on screen, so the camera only runs while it is.
  private watchPresence() {
    const report = () =>
      void this.send({
        type: 'presence',
        active: this.protecting && document.visibilityState === 'visible' && document.hasFocus(),
      });
    document.addEventListener('visibilitychange', report);
    window.addEventListener('focus', report);
    window.addEventListener('blur', () => {
      report();
      if (this.protecting && this.settings.away.enabled && this.settings.away.onWindowBlur) this.coverForAway();
    });
    window.addEventListener('pagehide', () => void this.send({ type: 'presence', active: false }));
    report();
  }

  private watchAltKey() {
    const set = (down: boolean) => this.html.classList.toggle('veil-alt-down', down);
    window.addEventListener('keydown', (e) => e.key === 'Alt' && set(true), true);
    window.addEventListener('keyup', (e) => e.key === 'Alt' && set(false), true);
    window.addEventListener('blur', () => set(false));
  }

  private watchIdle() {
    const activity = () => {
      if (this.shield.has('away') && !this.shield.has('lock')) this.shield.set('away', false);
      this.resetIdle();
    };
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(type, activity, { capture: true, passive: true });
    }
    this.resetIdle();
  }

  private resetIdle() {
    clearTimeout(this.idleTimer);
    const { enabled, idleSeconds } = this.settings.away;
    if (!enabled) return;
    this.idleTimer = window.setTimeout(() => {
      if (this.protecting && document.visibilityState === 'visible') this.coverForAway();
    }, idleSeconds * 1000);
  }

  private coverForAway() {
    this.shield.set('away', true);
    if (this.lockEnabled) this.shield.set('lock', true);
  }
}
