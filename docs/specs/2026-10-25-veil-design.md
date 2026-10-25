# Veil — Smart Chat Privacy (design spec)

Date: 2026-10-25 · Status: approved by owner ("you are the boss")

## Goal
A Chrome (MV3) extension that blurs private content on WhatsApp Web, Telegram Web and
Messenger until you hover, like "Privacy Extension for WhatsApp Web", but context-aware.
Published on the Chrome Web Store. 100% on-device: no server, no analytics, no message
text or camera frame ever leaves the browser.

## Features (v1)
1. **Manual blur categories** per site: chat list previews, names, photos/avatars,
   messages, media, typing box. Reveal on hover (configurable: hover / hold Alt / click).
2. **Sensitive-content detection**: messages that match a sensitive rule stay blurred even
   when the "messages" category is off (and get a small shield badge). Rules: OTP /
   verification codes, card numbers (Luhn), IBAN / bank accounts, passwords / PINs,
   phone numbers, emails, street addresses, money amounts, bKash/Nagad/Rocket transaction
   texts; English + Bangla keywords. Optional on-device Gemini Nano (Chrome Prompt API)
   classifies "personal/intimate" text when available; silently unavailable otherwise.
3. **Shoulder-surfer guard** (off by default): webcam → MediaPipe BlazeFace (bundled) in an
   offscreen document at ~3 fps, only while a protected tab is visible and focused.
   ≥2 faces for 2 consecutive samples → blur everything; 0 faces for N seconds →
   blur everything (optional). Camera permission is granted once from the options page.
4. **Auto-blur on context**: idle timeout, tab hidden / window blur, panic hotkey
   (Alt+Shift+V → blur all instantly; again to restore). Optional PIN lock overlay
   (PBKDF2 hash in storage; documented as a deterrent, not security).
5. **Per-chat rules**: Default / Always blur / Never blur / Hide from list, keyed by
   site + chat id (title fallback). Set from popup or the in-page context menu.

## Architecture
- WXT + TypeScript, Manifest V3. Permissions: `storage`, `offscreen`, `contextMenus`,
  `idle`; host permissions only for the three sites.
- `content/` — one engine + per-site **adapters** (`whatsapp.ts`, `telegram.ts`,
  `messenger.ts`). An adapter exposes selectors per category, how to read the active
  chat id/title, message text nodes and chat-list rows.
- **Blurring is CSS**: a stylesheet injected at `document_start` keyed on `html` classes
  (`veil-on`, `veil-cat-messages`, `veil-all`) and data attributes the engine sets
  (`data-veil-sensitive`, `data-veil-chat-rule`). No flash of unblurred content.
- `detect/` — pure functions `classify(text) → {sensitive, kinds[]}` (unit-tested).
- `background.ts` — settings store, hotkey commands, context menus, idle state, offscreen
  lifecycle, broadcasts `guardState` to tabs.
- `offscreen/` — camera + face detector; posts face counts to background.
- `popup/` and `options/` — UI (vanilla TS + CSS tokens from the approved GPT design).

## Settings model (chrome.storage.local)
`{ enabled, sites: {whatsapp|telegram|messenger: {enabled, categories{}}}, reveal,
blurStrength, sensitive: {enabled, kinds{}, nano}, guard: {enabled, emptySeatBlur},
away: {idleSeconds, onTabHidden}, pin: {hash, salt} | null, chatRules: {"site:id": rule},
stats: {hiddenToday} }`

## Testing
- Vitest unit tests for `classify`, settings migration, chat-rule resolution.
- Playwright loads the unpacked build against local fixture pages that mimic each
  site's DOM, asserting blur classes are applied before first paint and hover reveals.
- Manual smoke test on the real sites (needs logged-in accounts).

## Store deliverables
Icons 16/32/48/128, toolbar on/off states, 1280x800 screenshots, 440x280 small promo,
1400x560 marquee, privacy policy page, listing copy, permission justifications.
