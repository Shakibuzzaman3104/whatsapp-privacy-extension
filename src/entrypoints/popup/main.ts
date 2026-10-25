/**
 * @author Shakib
 * @since 25/10/26
 */
import type { GuardStatus, PageInfo, Status, ToContent } from '@/lib/messages';
import { sendToBackground } from '@/lib/messages';
import {
  CATEGORIES, type Category, type ChatRule, type Settings, type SiteId,
  effectiveCategories, loadSettings, onSettingsChanged, updateSettings,
} from '@/lib/settings';
import { type IconName, LOGO, icon } from '@/lib/ui/icons';

const CATEGORY_UI: Record<Exclude<Category, 'details'>, { label: string; icon: IconName }> = {
  chatList: { label: 'Chat list', icon: 'chat' },
  names: { label: 'Names', icon: 'user' },
  photos: { label: 'Photos', icon: 'image' },
  messages: { label: 'Messages', icon: 'message' },
  media: { label: 'Media', icon: 'play' },
  typing: { label: 'Typing', icon: 'dots' },
};

const SITE_LINKS: { label: string; url: string }[] = [
  { label: 'WhatsApp Web', url: 'https://web.whatsapp.com/' },
  { label: 'Telegram', url: 'https://web.telegram.org/' },
  { label: 'Messenger', url: 'https://www.messenger.com/' },
];

const app = document.getElementById('app')!;
let settings: Settings;
let page: PageInfo | null = null;
let status: Status = { panic: false, guard: 'off', nano: 'unavailable' };
let panicKey = 'Alt+Shift+V';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const toggle = (id: string, checked: boolean, label: string, disabled = false) =>
  `<label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}"><span></span></label>`;

function guardLine(state: GuardStatus): string {
  switch (state) {
    case 'needs-camera': return `<small class="warn">Needs camera access · <a href="#" data-open="guard">Allow</a></small>`;
    case 'watching': return '<small>Watching · video never leaves this device</small>';
    case 'triggered': return '<small class="warn">Covering · someone else is in view</small>';
    case 'paused': return '<small>Paused for a few minutes</small>';
    case 'error': return '<small class="warn">Camera unavailable</small>';
    default: return '<small>Off · covers chats when a 2nd face appears</small>';
  }
}

function awayLine(s: Settings): string {
  const parts = [`After ${s.away.idleSeconds}s idle`];
  if (s.away.onWindowBlur) parts.push('when you switch apps');
  const lock = s.lock.onAway && s.lock.hash ? ' · PIN lock' : '';
  return `<small>${parts.join(' or ')}${lock}</small>`;
}

function sensitiveLine(s: Settings): string {
  if (!s.sensitive.enabled) return '<small>Off</small>';
  if (page) {
    const n = page.sensitiveCount;
    return `<small><b>${n}</b> ${n === 1 ? 'item' : 'items'} hidden on this page</small>`;
  }
  return `<small>Codes, cards, money and more${s.sensitive.deepScan ? ' · AI deep scan' : ''}</small>`;
}

function render() {
  const s = settings;
  const site: SiteId = page?.site ?? 'whatsapp';
  const allBut = s.mode === 'allButIdentity';
  const shown = effectiveCategories(s, site, 'default');
  const siteOn = page ? s.sites[site].enabled : true;

  const siteChip = page
    ? `<div class="site ${s.enabled && siteOn ? '' : 'idle'}"><i></i>${escapeHtml(page.label)} · ${s.enabled && siteOn ? 'protected' : 'paused'}</div>`
    : `<div class="site idle"><i></i>Open a chat site to protect it</div>
       <div class="open-sites">${SITE_LINKS.map((l) => `<a href="${l.url}" target="_blank">${l.label}</a>`).join('')}</div>`;

  const chips = CATEGORIES.map((c) => {
    const ui = CATEGORY_UI[c as Exclude<Category, 'details'>];
    return `<button class="chip" data-category="${c}" aria-pressed="${shown.has(c)}" ${allBut ? 'disabled' : ''} title="Blur ${ui.label.toLowerCase()}">${icon(ui.icon)}<span class="label">${ui.label}</span></button>`;
  }).join('');

  const chat = page?.chatTitle
    ? `<section class="chat">
        <div class="section-head"><h3 class="serif">This chat — ${escapeHtml(page.chatTitle)}</h3></div>
        <div class="segmented" role="group" aria-label="Rule for this chat">
          ${(['default', 'always', 'never'] as ChatRule[]).map((r) => `<button data-rule="${r}" aria-pressed="${page!.rule === r}">${{ default: 'Default', always: 'Always blur', never: 'Never blur' }[r as 'default']}</button>`).join('')}
        </div>
      </section>`
    : '';

  app.innerHTML = `
    <header class="brand">${LOGO}<div><h1 class="serif">Veil</h1><p class="muted">Smart Chat Privacy</p></div></header>

    <div class="protection">
      <div><h2 class="serif">Protection ${s.enabled ? 'on' : 'off'}</h2>${status.panic ? '<p class="muted">Panic cover is up</p>' : ''}</div>
      ${toggle('enabled', s.enabled, 'Protection')}
    </div>
    ${siteChip}

    <div class="${s.enabled ? '' : 'dim'}">
      <section>
        <div class="section-head"><h3 class="serif">Blur</h3>${page ? toggle('site-enabled', siteOn, `Protect ${page.label}`) : ''}</div>
        <div class="segmented mode" role="group" aria-label="Blur mode">
          <button data-mode="custom" aria-pressed="${!allBut}">Custom</button>
          <button data-mode="allButIdentity" aria-pressed="${allBut}">All but names &amp; photos</button>
        </div>
        <div class="chips ${allBut ? 'locked' : ''}">${chips}</div>
      </section>

      <section>
        <div class="section-head"><h3 class="serif">Smart guards</h3></div>
        <div class="guard">${icon('shield')}<div class="text"><strong>Sensitive content</strong>${sensitiveLine(s)}</div>${toggle('sensitive', s.sensitive.enabled, 'Sensitive content')}</div>
        <div class="guard">${icon('users')}<div class="text"><strong>Shoulder-surfer guard</strong>${guardLine(s.guard.enabled ? status.guard : 'off')}</div>${toggle('guard', s.guard.enabled, 'Shoulder-surfer guard')}</div>
        <div class="guard">${icon('clock')}<div class="text"><strong>Auto-blur when away</strong>${s.away.enabled ? awayLine(s) : '<small>Off</small>'}</div>${toggle('away', s.away.enabled, 'Auto-blur when away')}</div>
      </section>
      ${chat}
    </div>

    <footer>
      <span class="hint">${icon('keyboard')}Panic: <kbd>${escapeHtml(panicKey)}</kbd></span>
      <button id="settings">${icon('gear')}Settings</button>
    </footer>`;
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function refreshPage() {
  const tabId = await activeTabId();
  if (!tabId) return;
  page = await chrome.tabs
    .sendMessage(tabId, { type: 'getPageInfo' } satisfies ToContent)
    .catch(() => null);
}

app.addEventListener('change', async (event) => {
  const input = event.target as HTMLInputElement;
  const on = input.checked;
  await updateSettings((s) => {
    if (input.id === 'enabled') s.enabled = on;
    else if (input.id === 'site-enabled' && page) s.sites[page.site].enabled = on;
    else if (input.id === 'sensitive') s.sensitive.enabled = on;
    else if (input.id === 'guard') s.guard.enabled = on;
    else if (input.id === 'away') s.away.enabled = on;
  });
  if (input.id === 'guard' && on) {
    const { cameraGranted } = await chrome.storage.local.get('cameraGranted');
    if (!cameraGranted) openOptions('guard');
  }
});

app.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a[data-open]');
  if (!target) return;
  if (target.id === 'settings') return openOptions();
  if (target.dataset.open) {
    event.preventDefault();
    return openOptions(target.dataset.open);
  }
  if (target.dataset.category) {
    const category = target.dataset.category as Category;
    const on = target.getAttribute('aria-pressed') !== 'true';
    // Category toggles apply to every site, so the popup reads the same everywhere.
    await updateSettings((s) => { for (const site of Object.values(s.sites)) site.categories[category] = on; });
  }
  if (target.dataset.mode) {
    await updateSettings((s) => { s.mode = target.dataset.mode as Settings['mode']; });
  }
  if (target.dataset.rule) {
    const tabId = await activeTabId();
    if (tabId) await chrome.tabs.sendMessage(tabId, { type: 'setChatRule', rule: target.dataset.rule as ChatRule } satisfies ToContent);
    if (page) page.rule = target.dataset.rule as ChatRule;
    render();
  }
});

function openOptions(section?: string) {
  void chrome.tabs.create({ url: chrome.runtime.getURL(`/options.html${section ? `#${section}` : ''}`) });
  window.close();
}

async function init() {
  const [s, , st, commands] = await Promise.all([
    loadSettings(),
    refreshPage(),
    sendToBackground<Status>({ type: 'getStatus' }).catch(() => status),
    chrome.commands.getAll(),
  ]);
  settings = s;
  status = st ?? status;
  panicKey = commands.find((c) => c.name === 'panic')?.shortcut || 'not set';
  render();
  onSettingsChanged(async (next) => {
    settings = next;
    await refreshPage();
    render();
  });
}

void init();
