/**
 * @author Shakib
 * @since 25/10/26
 */
import { FaceDetector } from '@mediapipe/tasks-vision';
import type { SensitiveKind } from '@/lib/classify';
import { type Status, sendToBackground } from '@/lib/messages';
import { hashPin } from '@/lib/pin';
import {
  CATEGORIES, type Category, SITES, type Settings, type SiteId,
  loadSettings, onSettingsChanged, updateSettings,
} from '@/lib/settings';
import { type IconName, LOGO, icon } from '@/lib/ui/icons';

type SectionId = 'general' | 'sensitive' | 'guard' | 'away' | 'rules' | 'privacy';

const SECTIONS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'gear' },
  { id: 'sensitive', label: 'Sensitive content', icon: 'shield' },
  { id: 'guard', label: 'Shoulder-surfer guard', icon: 'users' },
  { id: 'away', label: 'Away & lock', icon: 'clock' },
  { id: 'rules', label: 'Chat rules', icon: 'chat' },
  { id: 'privacy', label: 'Privacy', icon: 'lock' },
];

const SITE_LABELS: Record<SiteId, string> = { whatsapp: 'WhatsApp Web', telegram: 'Telegram Web', messenger: 'Messenger' };

const CATEGORY_LABELS: Record<Exclude<Category, 'details'>, string> = {
  chatList: 'Chat list previews', names: 'Names', photos: 'Profile photos',
  messages: 'Messages', media: 'Photos & videos in chats', typing: 'Typing box',
};

const KINDS: { kind: SensitiveKind; label: string; example: string; icon: IconName }[] = [
  { kind: 'otp', label: 'One-time codes', example: 'e.g. “Your code is 482913”', icon: 'key' },
  { kind: 'card', label: 'Card numbers', example: 'e.g. “4111 1111 1111 1111” (checksum-verified)', icon: 'card' },
  { kind: 'bank', label: 'Bank accounts & IBAN', example: 'e.g. “A/C 1501 2023 4567”', icon: 'bank' },
  { kind: 'password', label: 'Passwords & PINs', example: 'e.g. “wifi password is sunflower22”', icon: 'lock' },
  { kind: 'phone', label: 'Phone numbers', example: 'e.g. “+880 1712 345678”', icon: 'phone' },
  { kind: 'email', label: 'Email addresses', example: 'e.g. “rahim@example.com”', icon: 'mail' },
  { kind: 'money', label: 'Money & transactions', example: 'e.g. “Tk 2,500 received via bKash”', icon: 'money' },
  { kind: 'address', label: 'Addresses', example: 'e.g. “House 12, Road 5, Dhanmondi”', icon: 'pin' },
];

declare const LanguageModel: {
  availability(): Promise<string>;
  create(options: { monitor?: (m: EventTarget) => void }): Promise<{ destroy(): void }>;
} | undefined;

const nav = document.getElementById('nav')!;
const main = document.getElementById('main')!;
let settings: Settings;
let status: Status = { panic: false, guard: 'off', nano: 'unavailable' };
let stopCamera: (() => void) | null = null;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const toggle = (id: string, checked: boolean, label: string, disabled = false) =>
  `<label class="switch"><input type="checkbox" data-key="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}"><span></span></label>`;
const current = (): SectionId =>
  (SECTIONS.find((s) => `#${s.id}` === location.hash)?.id ?? 'general');

function renderNav() {
  nav.innerHTML = `<div class="brand">${LOGO}<div><strong class="heading">Veil</strong><small class="muted">Smart Chat Privacy</small></div></div>` +
    SECTIONS.map((s) => `<a href="#${s.id}" ${s.id === current() ? 'aria-current="page"' : ''}>${icon(s.icon)}${s.label}</a>`).join('');
}

// ---- sections -------------------------------------------------------------

function general(s: Settings) {
  const allBut = s.mode === 'allButIdentity';
  return `
    <h1 class="heading">General</h1>
    <p class="intro muted">Choose where Veil works and what it blurs. Hover anything blurred to see it.</p>
    <div class="grid">
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2 class="heading">Protection</h2>${toggle('enabled', s.enabled, 'Protection')}</div>
          <p>Turn everything on or off. Shortcut: <b id="toggle-key">Alt+Shift+B</b>.</p>
          ${SITES.map((site) => `<div class="row"><span class="grow">${SITE_LABELS[site]}</span>${toggle(`site:${site}`, s.sites[site].enabled, `Protect ${SITE_LABELS[site]}`)}</div>`).join('')}
        </div>
        <div class="card">
          <h2 class="heading">Keyboard shortcuts</h2>
          <p>Panic covers every chat tab at once. Change keys in Chrome’s shortcut settings.</p>
          <button class="btn" id="shortcuts">${icon('keyboard')}Change shortcuts</button>
        </div>
      </div>
      <div class="card">
        <h2 class="heading">Blur mode</h2>
        <p>Custom lets you pick what to blur. “All but names &amp; photos” blurs every message, preview, timestamp and the typing box, and keeps only names and profile photos sharp.</p>
        <div class="segmented" role="group" aria-label="Blur mode">
          <button data-mode="custom" aria-pressed="${!allBut}">Custom</button>
          <button data-mode="allButIdentity" aria-pressed="${allBut}">All but names &amp; photos</button>
        </div>
        <div style="margin-top:8px">
          ${CATEGORIES.map((c) => `<div class="row"><span class="grow">${CATEGORY_LABELS[c as Exclude<Category, 'details'>]}</span>${toggle(`cat:${c}`, allBut ? c !== 'names' && c !== 'photos' : s.sites.whatsapp.categories[c], CATEGORY_LABELS[c as Exclude<Category, 'details'>], allBut)}</div>`).join('')}
        </div>
      </div>
    </div>`;
}

function nanoPill(state: string) {
  switch (state) {
    case 'available': return '<div class="pill"><i></i>Available on this device</div>';
    case 'downloadable': return '<div class="pill warn"><i></i>Chrome needs to download the model once · <button class="btn" id="nano-download" style="padding:4px 10px">Download</button></div>';
    case 'downloading': return '<div class="pill warn"><i></i><span id="nano-progress">Downloading…</span></div>';
    default: return '<div class="pill off"><i></i>Not available on this device or Chrome version</div>';
  }
}

function sensitive(s: Settings) {
  return `
    <h1 class="heading">Sensitive content</h1>
    <p class="intro muted">Veil keeps messages with private details blurred even when message blur is off. Everything is checked on this device.</p>
    <div class="grid">
      <div class="card">
        <div class="card-head"><h2 class="heading">Detect</h2>${toggle('sensitive', s.sensitive.enabled, 'Sensitive content')}</div>
        <p>Automatically find and blur these kinds of private details in your chats.</p>
        ${KINDS.map((k) => `<div class="row">${icon(k.icon)}<span class="label">${k.label}</span><span class="example">${escapeHtml(k.example)}</span>${toggle(`kind:${k.kind}`, s.sensitive.kinds[k.kind] !== false, k.label, !s.sensitive.enabled)}</div>`).join('')}
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h2 class="heading">Deep scan — on-device AI</h2>${toggle('deepScan', s.sensitive.deepScan, 'Deep scan', status.nano === 'unavailable')}</div>
          <p>Uses Chrome’s built-in Gemini Nano to catch personal or intimate messages the rules miss. Nothing leaves your computer.</p>
          ${nanoPill(status.nano)}
        </div>
        <div class="card">
          <h2 class="heading">Appearance</h2>
          <p>Choose how strong the blur looks and how to reveal it.</p>
          <label for="blur"><b>Blur strength</b></label>
          <input id="blur" type="range" min="3" max="14" step="1" value="${s.blurStrength}">
          <div class="range-labels"><span>Soft</span><span>Strong</span></div>
          <div class="preview" style="--preview-blur:${s.blurStrength}px"><div class="bubble">Here is my card number: <span class="secret">4111 1111 1111 1111</span></div><time>10:24 AM</time></div>
          <div style="margin-top:16px"><b>Reveal mode</b></div>
          <label class="radio"><input type="radio" name="reveal" value="hover" ${s.reveal === 'hover' ? 'checked' : ''}><span>Hover<small>Show content while the pointer is over it, or when it has keyboard focus.</small></span></label>
          <label class="radio"><input type="radio" name="reveal" value="alt" ${s.reveal === 'alt' ? 'checked' : ''}><span>Hover while holding Alt<small>Nothing reveals by accident: hold Alt (Option on Mac) and hover.</small></span></label>
        </div>
      </div>
    </div>`;
}

function guard(s: Settings) {
  return `
    <h1 class="heading">Shoulder-surfer guard</h1>
    <p class="intro muted">Veil counts faces in front of your camera. When a second person appears, it blurs everything on the page and shows a small notice at the top. You can still hover to read. Video never leaves this device; only a face count is used, and the camera runs only while a chat tab is on screen.</p>
    <div class="grid">
      <div class="card">
        <div class="card-head"><h2 class="heading">Guard</h2>${toggle('guard', s.guard.enabled, 'Shoulder-surfer guard')}</div>
        <p>Your camera light will be on while it watches.</p>
        <div class="row"><span class="grow">Also blur everything when nobody is at the screen<small>Useful if you walk away without locking your computer.</small></span>${toggle('emptySeat', s.guard.emptySeat, 'Blur when nobody is at the screen')}</div>
        <div class="row"><span class="grow">Camera access</span><span id="camera-state" class="muted">Checking…</span></div>
      </div>
      <div class="card">
        <h2 class="heading">Test it</h2>
        <p>Allow the camera, then check that Veil sees you. The preview is only shown on this page.</p>
        <button class="btn primary" id="camera-test">${icon('camera')}Allow camera &amp; test</button>
        <div class="camera" hidden id="camera-box"><video id="camera-video" muted playsinline></video><div><div class="faces heading" id="faces">–</div><small class="muted">faces in view</small></div></div>
        <p class="error" id="camera-error"></p>
      </div>
    </div>`;
}

function away(s: Settings) {
  const hasPin = !!s.lock.hash;
  return `
    <h1 class="heading">Away &amp; lock</h1>
    <p class="intro muted">Cover your chats when you step away, and optionally ask for a PIN to show them again.</p>
    <div class="grid">
      <div class="card">
        <div class="card-head"><h2 class="heading">Auto-blur when away</h2>${toggle('away', s.away.enabled, 'Auto-blur when away')}</div>
        <p>Covers the whole page; move the mouse or press a key to come back.</p>
        <div class="row"><span class="grow">Cover after</span>
          <select id="idle">${[15, 30, 60, 120, 300, 600].map((n) => `<option value="${n}" ${s.away.idleSeconds === n ? 'selected' : ''}>${n < 60 ? `${n} seconds` : `${n / 60} minute${n === 60 ? '' : 's'}`} idle</option>`).join('')}</select></div>
        <div class="row"><span class="grow">Also cover when I switch to another app or window</span>${toggle('onWindowBlur', s.away.onWindowBlur, 'Cover when switching apps')}</div>
      </div>
      <div class="card">
        <h2 class="heading">PIN lock</h2>
        <p>${hasPin ? 'A PIN is set.' : 'Set a 4–8 digit PIN.'} When on, uncovering after being away or after Panic needs the PIN.</p>
        <div class="row"><span class="grow">Require PIN to uncover</span>${toggle('lockOnAway', s.lock.onAway, 'Require PIN', !hasPin)}</div>
        <form class="pin-form" id="pin-form">
          <input class="text-input" id="pin" type="password" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" placeholder="${hasPin ? 'New PIN' : 'PIN'}" autocomplete="new-password" aria-label="PIN">
          <button class="btn primary">${hasPin ? 'Change PIN' : 'Set PIN'}</button>
          ${hasPin ? `<button type="button" class="btn danger" id="pin-remove">${icon('trash')}Remove</button>` : ''}
        </form>
        <p class="error" id="pin-error"></p>
        <p class="note">The PIN stops a casual glance, not a determined person: anyone at your computer can turn extensions off.</p>
      </div>
    </div>`;
}

function rules(s: Settings) {
  const entries = Object.entries(s.chatRules);
  const label = { always: 'Always blur', never: 'Never blur', hide: 'Hidden from list' } as const;
  return `
    <h1 class="heading">Chat rules</h1>
    <p class="intro muted">Set a rule for the open chat from the Veil popup, or right-click inside a chat and choose Veil. Rules are matched by chat name.</p>
    <div class="card">
      <h2 class="heading">Your rules</h2>
      ${entries.length ? entries.map(([key, rule]) => {
        const [site, ...rest] = key.split(':');
        return `<div class="row"><span class="grow"><b>${escapeHtml(rest.join(':'))}</b><small>${SITE_LABELS[site as SiteId] ?? site}</small></span><span class="muted">${label[rule]}</span><button class="btn danger" data-remove-rule="${escapeHtml(key)}">${icon('trash')}Remove</button></div>`;
      }).join('') : '<div class="empty">No rules yet.</div>'}
    </div>`;
}

function privacy() {
  return `
    <h1 class="heading">Privacy</h1>
    <p class="intro muted">Veil is built so that nothing about your chats ever leaves your computer.</p>
    <div class="card privacy">
      <ul>
        <li>No servers, no accounts, no analytics. Veil makes no network requests.</li>
        <li>Message text is checked on this device by built-in rules, or by Chrome’s on-device Gemini Nano if you turn on deep scan.</li>
        <li>The camera guard counts faces on this device. Frames are never stored or sent anywhere.</li>
        <li>Settings and chat rules are stored in Chrome on this computer only.</li>
        <li>Your PIN is stored only as a salted PBKDF2 hash.</li>
      </ul>
    </div>`;
}

const RENDERERS: Record<SectionId, (s: Settings) => string> = { general, sensitive, guard, away, rules, privacy };

function render() {
  renderNav();
  if (current() !== 'guard') stopCamera?.();
  main.innerHTML = RENDERERS[current()](settings);
  void afterRender();
}

async function afterRender() {
  if (current() === 'general') {
    const commands = await chrome.commands.getAll();
    const el = document.getElementById('toggle-key');
    if (el) el.textContent = commands.find((c) => c.name === 'toggle')?.shortcut || 'not set';
  }
  if (current() === 'guard') {
    const { cameraGranted } = await chrome.storage.local.get('cameraGranted');
    const el = document.getElementById('camera-state');
    if (el) el.textContent = cameraGranted ? 'Allowed' : 'Not allowed yet';
  }
}

// ---- events ---------------------------------------------------------------

main.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  const key = input.dataset.key || input.id || input.name;
  const on = input.checked;
  await updateSettings((s) => {
    if (key === 'enabled') s.enabled = on;
    else if (key.startsWith('site:')) s.sites[key.slice(5) as SiteId].enabled = on;
    else if (key.startsWith('cat:')) for (const site of SITES) s.sites[site].categories[key.slice(4) as Category] = on;
    else if (key === 'sensitive') s.sensitive.enabled = on;
    else if (key.startsWith('kind:')) s.sensitive.kinds[key.slice(5) as SensitiveKind] = on;
    else if (key === 'deepScan') s.sensitive.deepScan = on;
    else if (key === 'guard') s.guard.enabled = on;
    else if (key === 'emptySeat') s.guard.emptySeat = on;
    else if (key === 'away') s.away.enabled = on;
    else if (key === 'onWindowBlur') s.away.onWindowBlur = on;
    else if (key === 'lockOnAway') s.lock.onAway = on;
    else if (key === 'idle') s.away.idleSeconds = Number((input as unknown as HTMLSelectElement).value);
    else if (key === 'reveal') s.reveal = input.value as Settings['reveal'];
    else if (key === 'blur') s.blurStrength = Number(input.value);
  });
});

main.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'blur') document.querySelector<HTMLElement>('.preview')?.style.setProperty('--preview-blur', `${input.value}px`);
});

main.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button');
  if (!target) return;
  if (target.dataset.mode) await updateSettings((s) => { s.mode = target.dataset.mode as Settings['mode']; });
  if (target.dataset.removeRule) await updateSettings((s) => { delete s.chatRules[target.dataset.removeRule!]; });
  if (target.id === 'shortcuts') await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  if (target.id === 'camera-test') await testCamera();
  if (target.id === 'nano-download') await downloadNano();
  if (target.id === 'pin-remove') {
    await updateSettings((s) => { s.lock = { hash: null, salt: null, onAway: false }; });
  }
});

main.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = (document.getElementById('pin') as HTMLInputElement).value;
  const error = document.getElementById('pin-error')!;
  if (!/^\d{4,8}$/.test(pin)) {
    error.textContent = 'Use 4 to 8 digits.';
    return;
  }
  const { hash, salt } = await hashPin(pin);
  await updateSettings((s) => { s.lock = { hash, salt, onAway: true }; });
});

async function testCamera() {
  const error = document.getElementById('camera-error')!;
  error.textContent = '';
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
  } catch (e) {
    error.textContent = (e as DOMException).name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow it from the camera icon in the address bar, then try again.'
      : 'No camera found.';
    return;
  }
  await sendToBackground({ type: 'cameraGranted' });
  await updateSettings((s) => { s.guard.enabled = true; });

  const box = document.getElementById('camera-box')!;
  const video = document.getElementById('camera-video') as HTMLVideoElement;
  box.hidden = false;
  video.srcObject = stream;
  await video.play();
  const detector = await FaceDetector.createFromOptions(
    {
      wasmLoaderPath: chrome.runtime.getURL('/mediapipe/vision_wasm_internal.js'),
      wasmBinaryPath: chrome.runtime.getURL('/mediapipe/vision_wasm_internal.wasm'),
    },
    {
      baseOptions: { modelAssetPath: chrome.runtime.getURL('/mediapipe/blaze_face_short_range.tflite'), delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.6,
    },
  );
  const timer = setInterval(() => {
    if (video.readyState < 2) return;
    const faces = document.getElementById('faces');
    if (faces) faces.textContent = String(detector.detectForVideo(video, performance.now()).detections.length);
  }, 333);
  stopCamera = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    detector.close();
    stopCamera = null;
  };
}

async function downloadNano() {
  if (typeof LanguageModel === 'undefined') return;
  const session = await LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        const el = document.getElementById('nano-progress');
        if (el) el.textContent = `Downloading… ${Math.round((e as ProgressEvent).loaded * 100)}%`;
      });
    },
  });
  session.destroy();
  status = await sendToBackground<Status>({ type: 'getStatus' });
  render();
}

window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => stopCamera?.());

async function init() {
  settings = await loadSettings();
  // The background runs deep scan, so its answer is the one that counts.
  status = await sendToBackground<Status>({ type: 'getStatus' }).catch(() => status);
  render();
  onSettingsChanged((next) => {
    const focused = document.activeElement?.id;
    settings = next;
    // Re-rendering would tear down the live camera preview.
    if (stopCamera) return;
    render();
    if (focused) document.getElementById(focused)?.focus();
  });
}

void init();
