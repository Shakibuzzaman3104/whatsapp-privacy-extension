/**
 * @author Shakib
 * @since 25/10/26
 *
 * Feeds Chrome a fake 720p webcam (GPT-made photos of made-up people) and checks
 * the face count end to end: settings test, offscreen camera, guard, snackbar.
 */
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION = path.resolve('.output/chrome-mv3');
const WHATSAPP = readFileSync(path.resolve('tests/e2e/fixtures/whatsapp.html'), 'utf8');

async function launchWithCamera(feed: 'one' | 'two') {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`,
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${path.resolve(`tests/e2e/fixtures/camera/${feed}-person.y4m`)}`,
    ],
  });
  await context.route('https://web.whatsapp.com/**', (route) => route.fulfill({ contentType: 'text/html', body: WHATSAPP }));
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return { context, worker, id: new URL(worker.url()).host };
}

async function cameraTestCount(context: BrowserContext, id: string) {
  // Install opens options in the start tab, and would take over a tab we opened ourselves mid-load.
  const isOptions = (p: Page) => p.url().startsWith(`chrome-extension://${id}/options.html`);
  await expect.poll(() => context.pages().some(isOptions)).toBe(true);
  const page = context.pages().find(isOptions)!;
  await page.waitForLoadState();
  await page.goto(`chrome-extension://${id}/options.html#guard`);
  await page.click('#camera-test');
  await expect(page.locator('#camera-box')).toBeVisible();
  const faces = page.locator('#faces');
  await expect(faces).not.toHaveText('–', { timeout: 10_000 });
  // Let a few samples run so a flicker would show up.
  await page.waitForTimeout(1500);
  const text = await faces.textContent();
  await page.close();
  return Number(text);
}

test('two people: settings test counts 2 and the guard blurs with a snackbar', async () => {
  const { context, worker, id } = await launchWithCamera('two');
  expect(await cameraTestCount(context, id)).toBe(2);

  await worker.evaluate(() => chrome.storage.local.set({ settings: { guard: { enabled: true }, away: { enabled: false } } }));
  const page = await context.newPage();
  await page.goto('https://web.whatsapp.com/');
  await page.bringToFront();
  await expect(page.locator('veil-snackbar')).toHaveCount(1, { timeout: 15_000 });
  await context.close();
});

test('one person: counts 1 and the guard stays quiet', async () => {
  const { context, worker, id } = await launchWithCamera('one');
  expect(await cameraTestCount(context, id)).toBe(1);

  await worker.evaluate(() => chrome.storage.local.set({ settings: { guard: { enabled: true }, away: { enabled: false } } }));
  const page = await context.newPage();
  await page.goto('https://web.whatsapp.com/');
  await page.bringToFront();
  // Give the guard time to sample (it covers after ~0.7 s of two faces).
  await page.waitForTimeout(4000);
  await expect(page.locator('veil-snackbar')).toHaveCount(0);
  await context.close();
});
