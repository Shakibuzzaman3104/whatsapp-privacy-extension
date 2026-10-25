/**
 * @author Shakib
 * @since 25/10/26
 *
 * Small notice at the top of the page. Lives in a closed shadow root so the
 * site's CSS can't touch it, and never blocks the page underneath.
 */

const CSS = `
:host { all: initial; }
.bar {
  position: fixed; top: 16px; left: 50%; z-index: 2147483647;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  max-width: calc(100vw - 32px); box-sizing: border-box;
  padding: 10px 10px 10px 14px; border-radius: 12px;
  background: #1F2A22; color: #F7F4EC;
  box-shadow: 0 12px 32px rgba(31, 42, 34, .28);
  font: 500 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  animation: slide .22s cubic-bezier(.2, .8, .2, 1);
}
svg { width: 20px; height: 20px; flex: none; }
.text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button {
  flex: none; border: 0; border-radius: 8px; padding: 7px 10px; cursor: pointer;
  background: rgba(247, 244, 236, .12); color: #CFE6CC; font: 600 13px/1 inherit; font-family: inherit;
}
button:hover { background: rgba(247, 244, 236, .2); }
button:focus-visible { outline: 2px solid #8FC78F; outline-offset: 2px; }
@keyframes slide { from { opacity: 0; transform: translate(-50%, -12px); } }
@media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
`;

const ICON = `<svg viewBox="0 0 128 128" aria-hidden="true"><path fill="#6FAF73" d="M64 8C78 17 95 21 110 21Q116 21 116 27V60C116 89 94 107 64 118C54 114 45 109 37 102L19 117Q15 120 15.5 115L18 92C14 82 12 71 12 60V27Q12 21 18 21C33 21 50 17 64 8Z"/><g fill="#1F2A22"><rect x="34" y="42" width="60" height="11" rx="5.5"/><rect x="34" y="60" width="54" height="11" rx="5.5"/><rect x="34" y="78" width="40" height="11" rx="5.5"/></g></svg>`;

export class Snackbar {
  private host: HTMLElement | null = null;

  show(text: string, action?: { label: string; onClick(): void }) {
    this.hide();
    this.host = document.createElement('veil-snackbar');
    const root = this.host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style><div class="bar" role="status" aria-live="polite">${ICON}<span class="text"></span>${action ? '<button></button>' : ''}</div>`;
    root.querySelector('.text')!.textContent = text;
    if (action) {
      const button = root.querySelector('button')!;
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
    }
    document.documentElement.append(this.host);
  }

  hide() {
    this.host?.remove();
    this.host = null;
  }

  get visible() {
    return this.host !== null;
  }

  /** Puts the bar back if the page removed it. */
  ensureAttached() {
    if (this.host && !this.host.isConnected) document.documentElement.append(this.host);
  }
}
