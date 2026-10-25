/**
 * @author Shakib
 * @since 25/10/26
 *
 * Reloading or updating the extension orphans the content script in tabs that
 * are already open. It must stay quiet instead of throwing
 * "Extension context invalidated" on every focus change.
 */
import { chromium, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION = path.resolve('.output/chrome-mv3');
const WHATSAPP = readFileSync(path.resolve('tests/e2e/fixtures/whatsapp.html'), 'utf8');

test('an open chat tab stays quiet after the extension reloads', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://web.whatsapp.com/**', (route) => route.fulfill({ contentType: 'text/html', body: WHATSAPP }));
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const page = await context.newPage();

  // Playwright does not report errors from the extension's isolated world; DevTools does.
  const errors: string[] = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Runtime.exceptionThrown', (e) => errors.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text));
  await cdp.send('Runtime.enable');

  await page.goto('https://web.whatsapp.com/');
  await page.waitForFunction(() => document.documentElement.classList.contains('veil-on'));
  await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  // Fail closed: the old styles keep the chats blurred until the tab is refreshed.
  expect(await page.locator('#main [data-testid="msg-container"]').first().evaluate((el) => getComputedStyle(el).filter)).toContain('blur');
  await context.close();
});
