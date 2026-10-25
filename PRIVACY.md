# Veil privacy policy

_Last updated: 25 October 2026_

Veil — Smart Chat Privacy ("Veil") is a browser extension that blurs chats on WhatsApp Web, Telegram Web and
Messenger. It is built so that nothing about you or your chats ever leaves your computer.

## What Veil collects

**Nothing.** Veil has no servers, no accounts, no analytics and no tracking, and it makes no network requests of
its own.

## What Veil processes on your device

- **Page content on supported chat sites.** Veil reads the text of chat previews and messages on
  web.whatsapp.com, web.telegram.org, messenger.com and facebook.com/messages to decide what to blur. The check
  runs inside your browser using built-in rules. If you turn on _Deep scan_, message text is also passed to
  Chrome's on-device Gemini Nano model, which runs locally and does not send it anywhere.
- **Camera (optional, off by default).** If you turn on the _Shoulder-surfer guard_, Veil uses your camera to
  count the faces in front of the screen with a face-detection model bundled in the extension. Frames are
  analysed in memory and discarded immediately. They are never recorded, stored or transmitted. The camera
  only runs while a supported chat tab is on screen and focused.
- **Settings.** Your preferences, chat rules (stored by chat name) and an optional PIN are saved with
  `chrome.storage.local` on your computer. The PIN is stored only as a salted PBKDF2 hash.

## Sharing

Veil shares no data with anyone, because it collects none.

## Permissions

| Permission | Why |
|---|---|
| Access to web.whatsapp.com, web.telegram.org, messenger.com, facebook.com | Apply blur to those chat pages. On facebook.com Veil only acts under /messages. |
| `storage` | Save your settings on your computer. |
| `offscreen` | Run the optional camera guard in a hidden extension page. |
| `contextMenus` | The right-click "Always blur / Never blur / Hide this chat" menu. |
| `alarms` | Resume the camera guard after you snooze it. |

## Contact

Questions or concerns: open an issue at
https://github.com/Shakibuzzaman3104/whatsapp-privacy-extension/issues
