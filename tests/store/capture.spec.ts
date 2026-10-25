/**
 * @author Shakib
 * @since 25/10/26
 *
 * Captures the real extension acting on a demo chat page (made-up people) for
 * the store listing and README. Run with `npm run store:shots`.
 */
import { type BrowserContext, type Page, type Worker, chromium, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION = path.resolve('.output/chrome-mv3');
const DEMO = readFileSync(path.resolve('tests/e2e/fixtures/demo.html'), 'utf8');
const OUT = path.resolve('design/store/raw');

let context: BrowserContext;
let worker: Worker;
let extensionId: string;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://web.whatsapp.com/**', (route) => route.fulfill({ contentType: 'text/html', body: DEMO }));
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context.close());

const setSettings = (patch: object) =>
  worker.evaluate(async (p) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings: p });
  }, patch);

async function openDemo(): Promise<Page> {
  const page = await context.newPage();
  await page.goto('https://web.whatsapp.com/');
  await page.waitForFunction(() => document.documentElement.classList.contains('veil-on'));
  await page.waitForTimeout(300);
  return page;
}

test('chat page shots', async () => {
  await setSettings({ mode: 'allButIdentity', away: { enabled: false } });
  let page = await openDemo();
  await page.locator('#main [data-testid="msg-container"]').nth(1).hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/all-but-identity.png` });
  await page.close();

  await setSettings({ sites: { whatsapp: { categories: { messages: false, chatList: false, names: false, photos: false, media: false } } }, away: { enabled: false } });
  page = await openDemo();
  await page.mouse.move(1270, 790);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/sensitive.png` });
  await page.close();

  await setSettings({ away: { enabled: false } });
  page = await openDemo();
  await page.locator('#pane-side [role="row"]').first().hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/default-hover.png` });

  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/popup.html`);
  await control.evaluate(() => chrome.runtime.sendMessage({ type: 'setPanic', on: true }));
  await page.bringToFront();
  await page.locator('veil-shield').waitFor({ state: 'attached' });
  await page.mouse.move(1270, 790);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/cover.png` });
  await control.evaluate(() => chrome.runtime.sendMessage({ type: 'setPanic', on: false }));
  await control.close();
  await page.close();
});

test('popup and settings shots', async () => {
  await setSettings({ away: { enabled: true, idleSeconds: 60 } });
  const page = await openDemo();
  const tabId = await worker.evaluate(() => chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }).then(([t]) => t.id!));

  const popup = await context.newPage();
  // A popup reads the active tab; point it at the demo chat tab.
  await popup.addInitScript((id) => {
    chrome.tabs.query = (async () => [{ id }]) as unknown as typeof chrome.tabs.query;
  }, tabId);
  await popup.setViewportSize({ width: 380, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByText('This chat').waitFor();
  // Resizing the viewport right before a capture makes headless Chrome tile the image; fullPage is safe.
  await popup.screenshot({ path: `${OUT}/popup.png`, fullPage: true });

  const options = await context.newPage();
  for (const section of ['general', 'sensitive', 'away']) {
    await options.goto(`chrome-extension://${extensionId}/options.html#${section}`);
    await options.waitForTimeout(200);
    await options.screenshot({ path: `${OUT}/options-${section}.png` });
  }
  await page.close();
});
