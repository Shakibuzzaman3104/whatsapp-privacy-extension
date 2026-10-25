/**
 * @author Shakib
 * @since 25/10/26
 *
 * Loads the built extension and serves fixture pages at the real chat URLs,
 * so the content script injects exactly as it does on the live sites.
 */
import { type BrowserContext, type Page, type Worker, chromium, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION = path.resolve('.output/chrome-mv3');
const WHATSAPP = readFileSync(path.resolve('tests/e2e/fixtures/whatsapp.html'), 'utf8');

let context: BrowserContext;
let worker: Worker;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://web.whatsapp.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: WHATSAPP }),
  );
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context.close());

const setSettings = (patch: object) =>
  worker.evaluate(async (p) => {
    await chrome.storage.local.set({ settings: p });
  }, patch);

const blurOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).filter);

async function openWhatsApp() {
  const page = await context.newPage();
  await page.goto('https://web.whatsapp.com/');
  await page.waitForFunction(() => document.documentElement.classList.contains('veil-on'));
  await page.mouse.move(900, 700);
  return page;
}

test.beforeEach(async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
});

test('blurs previews, names, photos and messages by default; hover reveals a whole row', async () => {
  const page = await openWhatsApp();
  const preview = '#pane-side [data-testid="cell-frame-secondary"]';
  expect(await blurOf(page, preview)).toContain('blur');
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-title"]')).toContain('blur');
  expect(await blurOf(page, '#main [data-testid="msg-container"]')).toContain('blur');
  // Typing is off by default.
  expect(await blurOf(page, '#main [data-testid="compose-box"]')).toBe('none');

  await page.locator('#pane-side [role="row"]').first().hover();
  await expect.poll(() => blurOf(page, preview)).toBe('none');
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-title"]')).toBe('none');
  await page.close();
});

test('sensitive messages stay blurred when message blur is off', async () => {
  await setSettings({ sites: { whatsapp: { categories: { messages: false, chatList: false } } } });
  const page = await openWhatsApp();
  await expect(page.locator('#otp')).toHaveAttribute('data-veil-s', 'message');
  await expect(page.locator('#otp')).toHaveAttribute('data-veil-kinds', 'password');
  // A message that arrives after load is checked too.
  await expect(page.locator('#late')).toHaveAttribute('data-veil-kinds', 'card');
  expect(await blurOf(page, '#otp')).toContain('blur');
  expect(await blurOf(page, '#late')).toContain('blur');
  // Ordinary messages are left alone.
  expect(await blurOf(page, '#main [data-testid="msg-container"]')).toBe('none');
  // The OTP preview in the chat list is caught as well.
  const otpPreview = page.locator('#pane-side [role="row"]').nth(1).locator('[data-testid="cell-frame-secondary"]');
  await expect(otpPreview).toHaveAttribute('data-veil-s', 'list');
  expect(await otpPreview.evaluate((el) => getComputedStyle(el).filter)).toContain('blur');
  await page.close();
});

test('all-but-names-and-photos mode keeps only identity sharp', async () => {
  await setSettings({ mode: 'allButIdentity' });
  const page = await openWhatsApp();
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-title"]')).toBe('none');
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-container"] > div:first-child')).toBe('none');
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-secondary"]')).toContain('blur');
  expect(await blurOf(page, '#pane-side [data-testid="cell-frame-primary-detail"]')).toContain('blur');
  expect(await blurOf(page, '#main [data-testid="compose-box"]')).toContain('blur');
  expect(await blurOf(page, '#photo')).toContain('blur');
  expect(await blurOf(page, '#main [data-testid="conversation-info-header"] > div > div:nth-child(2)')).toContain('blur');
  await page.close();
});

test('per-chat rules: never blur the open chat, hide another from the list', async () => {
  await setSettings({ chatRules: { 'whatsapp:Rahim Ahmed': 'never', 'whatsapp:bKash': 'hide' } });
  const page = await openWhatsApp();
  await expect(page.locator('html')).toHaveAttribute('data-veil-chat', 'never');
  expect(await blurOf(page, '#main [data-testid="msg-container"]')).toBe('none');
  await expect(page.locator('#pane-side [role="row"]').nth(1)).toBeHidden();
  await page.close();
});

test('panic covers every chat tab and Alt-reveal mode needs Alt', async () => {
  await setSettings({ reveal: 'alt' });
  const page = await openWhatsApp();
  const preview = '#pane-side [data-testid="cell-frame-secondary"]';
  await page.locator('#pane-side [role="row"]').first().hover();
  expect(await blurOf(page, preview)).toContain('blur');
  await page.keyboard.down('Alt');
  await expect.poll(() => blurOf(page, preview)).toBe('none');
  await page.keyboard.up('Alt');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'setPanic', on: true }));
  await expect(page.locator('veil-shield')).toHaveCount(1);
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'setPanic', on: false }));
  await expect(page.locator('veil-shield')).toHaveCount(0);
  await popup.close();
  await page.close();
});

test('away cover appears after idle and lifts on activity', async () => {
  await setSettings({ away: { enabled: true, idleSeconds: 1 } });
  const page = await openWhatsApp();
  await expect(page.locator('veil-shield')).toHaveCount(1, { timeout: 4000 });
  await page.mouse.move(100, 100);
  await expect(page.locator('veil-shield')).toHaveCount(0);
  await page.close();
});

test('popup and options render', async () => {
  const page = await openWhatsApp();
  // The popup reads the active tab, so open it as a normal page with WhatsApp in front.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 760 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('Protection on')).toBeVisible();
  await popup.screenshot({ path: 'test-results/ui/popup.png', fullPage: true });

  const options = await context.newPage();
  await options.setViewportSize({ width: 1440, height: 900 });
  for (const section of ['general', 'sensitive', 'away']) {
    await options.goto(`chrome-extension://${extensionId}/options.html#${section}`);
    await expect(options.locator('main h1')).toBeVisible();
    await options.screenshot({ path: `test-results/ui/options-${section}.png` });
  }
  await options.emulateMedia({ colorScheme: 'dark' });
  await options.goto(`chrome-extension://${extensionId}/options.html#sensitive`);
  await options.screenshot({ path: 'test-results/ui/options-sensitive-dark.png' });
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.reload();
  await popup.screenshot({ path: 'test-results/ui/popup-dark.png', fullPage: true });
  await page.close();
});
