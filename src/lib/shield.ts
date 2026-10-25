/**
 * @author Shakib
 * @since 25/10/26
 *
 * Full-page frosted cover used by panic, away and PIN lock. Lives in a closed
 * shadow root so the site's CSS can't touch it.
 */
import type { ShieldReason } from './messages';

const PRIORITY: ShieldReason[] = ['lock', 'panic', 'away'];

const COPY: Record<ShieldReason, { title: string; body: string; action?: string }> = {
  lock: { title: 'Chats locked', body: 'Enter your Veil PIN to show this page.' },
  panic: { title: 'Covered', body: 'Press Alt+Shift+V again to show your chats.', action: 'Show chats' },
  away: { title: 'Covered while you were away', body: 'Move the mouse or press any key to continue.' },
};

const CSS = `
:host { all: initial; }
.cover {
  position: fixed; inset: 0; z-index: 2147483647;
  display: grid; place-items: center;
  background: rgba(245, 240, 233, .62);
  backdrop-filter: blur(28px) saturate(.8);
  -webkit-backdrop-filter: blur(28px) saturate(.8);
  font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  color: #1F2A22;
  animation: fade .16s ease-out;
}
@media (prefers-color-scheme: dark) {
  .cover { background: rgba(20, 24, 21, .66); color: #EDEBE4; }
  .card { background: #1E241F; border-color: #2E362F; }
  .muted { color: #A3A8A0; }
  input { background: #141815; color: #EDEBE4; border-color: #3A433B; }
  .ghost { color: #EDEBE4; border-color: #3A433B; }
}
.card {
  width: min(360px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 28px 28px 24px; border-radius: 16px;
  background: #FDF9F3; border: 1px solid #E4DED6;
  box-shadow: 0 24px 64px rgba(31, 42, 34, .18);
  text-align: center;
}
svg { width: 44px; height: 44px; }
h1 { margin: 14px 0 6px; font-size: 21px; line-height: 1.25; font-weight: 700; letter-spacing: -.02em; }
.muted { margin: 0; color: #5F665F; }
form { margin-top: 18px; display: flex; gap: 8px; }
input {
  flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid #CFC8BE;
  font: inherit; letter-spacing: .3em; text-align: center; background: #fff; color: #1F2A22;
}
input:focus { outline: 2px solid #356B3B; outline-offset: 1px; }
button {
  font: 600 14px/1 inherit; font-family: inherit; cursor: pointer; border-radius: 10px;
  padding: 11px 16px; border: 0; background: #356B3B; color: #fff;
}
button:focus-visible { outline: 2px solid #356B3B; outline-offset: 2px; }
.ghost { margin-top: 18px; background: transparent; color: #1F2A22; border: 1px solid #CFC8BE; }
.error { color: #B3261E; margin-top: 10px; min-height: 1.2em; font-size: 13px; }
@keyframes fade { from { opacity: 0; } }
@keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.shake { animation: shake .24s; }
`;

const ICON = `<svg viewBox="0 0 128 128" aria-hidden="true"><path fill="#356B3B" d="M64 8C78 17 95 21 110 21Q116 21 116 27V60C116 89 94 107 64 118C54 114 45 109 37 102L19 117Q15 120 15.5 115L18 92C14 82 12 71 12 60V27Q12 21 18 21C33 21 50 17 64 8Z"/><g fill="#F7F4EC"><rect x="34" y="42" width="60" height="11" rx="5.5"/><rect x="34" y="60" width="54" height="11" rx="5.5"/><rect x="34" y="78" width="40" height="11" rx="5.5"/></g></svg>`;

export interface ShieldCallbacks {
  /** Returns true when the PIN is right. */
  verifyPin(pin: string): Promise<boolean>;
  onAction(reason: ShieldReason): void;
  onUnlocked(): void;
}

export class Shield {
  private reasons = new Set<ShieldReason>();
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private shown: ShieldReason | null = null;

  constructor(private readonly callbacks: ShieldCallbacks) {}

  has(reason: ShieldReason) {
    return this.reasons.has(reason);
  }

  get active() {
    return this.reasons.size > 0;
  }

  set(reason: ShieldReason, on: boolean) {
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    this.render();
  }

  /** Puts the cover back if the page removed it. */
  ensureAttached() {
    if (this.host && !this.host.isConnected) document.documentElement.append(this.host);
  }

  private render() {
    const top = PRIORITY.find((r) => this.reasons.has(r)) ?? null;
    if (top === this.shown) return;
    this.shown = top;
    if (!top) {
      this.host?.remove();
      this.host = null;
      this.root = null;
      return;
    }
    if (!this.host) {
      this.host = document.createElement('veil-shield');
      this.root = this.host.attachShadow({ mode: 'closed' });
      document.documentElement.append(this.host);
    }
    this.root!.innerHTML = `<style>${CSS}</style>${this.markup(top)}`;
    this.bind(top);
  }

  private markup(reason: ShieldReason) {
    const copy = COPY[reason];
    const pin = reason === 'lock'
      ? `<form><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" placeholder="PIN"><button>Unlock</button></form><div class="error" role="alert"></div>`
      : '';
    const action = copy.action ? `<button class="ghost" data-action>${copy.action}</button>` : '';
    return `<div class="cover" role="dialog" aria-modal="true" aria-labelledby="t"><div class="card">${ICON}<h1 id="t">${copy.title}</h1><p class="muted">${copy.body}</p>${pin}${action}</div></div>`;
  }

  private bind(reason: ShieldReason) {
    const root = this.root!;
    root.querySelector('[data-action]')?.addEventListener('click', () => this.callbacks.onAction(reason));
    const form = root.querySelector('form');
    if (!form) return;
    const input = form.querySelector('input')!;
    const error = root.querySelector('.error')!;
    queueMicrotask(() => input.focus());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (await this.callbacks.verifyPin(input.value)) {
        this.callbacks.onUnlocked();
        return;
      }
      input.value = '';
      error.textContent = 'Wrong PIN';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    });
  }
}
