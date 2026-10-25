# Chrome Web Store listing

Paste-ready copy for the developer dashboard. Assets are in `design/store/final/`.

## Name
Veil — Smart Chat Privacy

## Summary (132 characters max)
Blur WhatsApp Web, Telegram and Messenger until you hover. Hides codes, card numbers and other private details. 100% on-device.

## Category
Privacy & Security

## Description
Your chats, for your eyes only.

Veil blurs WhatsApp Web, Telegram Web and Messenger until you hover over them, and it understands what should stay hidden.

BLUR WHAT YOU CHOOSE
• Chat-list previews, names, profile photos, messages, photos and videos, and the typing box
• Hover a chat or a message to read it. Or hold Alt while hovering so nothing reveals by accident
• "All but names & photos" mode: blur everything, including timestamps, unread counts and "last seen", and keep only names and photos sharp

SMART PROTECTION
• Sensitive content: one-time codes, card numbers, bank accounts, passwords, money and bKash/Nagad alerts stay blurred even when message blur is off. Works in English and Bangla
• Deep scan (optional): Chrome's built-in Gemini Nano catches personal or intimate messages the rules miss, on your device
• Shoulder-surfer guard (optional): blurs everything, with a small notice, when a second face appears in front of the camera
• Away mode: covers chats when you're idle or switch to another app, with an optional PIN
• Panic key: Alt+Shift+V covers every chat tab at once
• Per-chat rules: always blur, never blur, or hide a chat from the list

PRIVATE BY DESIGN
No servers, no accounts, no analytics. Veil makes no network requests. Message checks and face detection run inside your browser, and camera frames are never stored or sent.

Open source: https://github.com/Shakibuzzaman3104/whatsapp-privacy-extension

Veil is an independent project and is not affiliated with WhatsApp, Telegram or Meta.

## Single purpose
Hide the content of web chat apps (WhatsApp Web, Telegram Web, Messenger) from people who can see your screen.

## Permission justifications
- **Host access to web.whatsapp.com, web.telegram.org, messenger.com, facebook.com:** Veil applies blur styles to these chat sites and reads message text on the device to find sensitive details. On facebook.com it only acts under /messages.
- **storage:** saves the user's settings and chat rules locally.
- **offscreen:** runs the optional shoulder-surfer guard. A hidden extension page uses the camera to count faces on the device.
- **contextMenus:** adds "Always blur / Never blur / Hide this chat" to the right-click menu on chat sites.
- **alarms:** restarts the camera guard when the user's 10-minute snooze ends.
- **Remote code:** none. The face-detection WebAssembly and model are bundled in the package.

## Data usage disclosures
Veil does not collect or transmit any user data. Tick no data categories. Certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness.

## Privacy policy URL
https://github.com/Shakibuzzaman3104/whatsapp-privacy-extension/blob/main/PRIVACY.md

## Assets
| Asset | File |
|---|---|
| Store icon 128×128 | `public/icon/128.png` |
| Screenshots 1280×800 | `design/store/final/1-…5-*.png` |
| Small promo tile 440×280 | `design/store/final/small-440x280.png` |
| Marquee 1400×560 | `design/store/final/marquee-1400x560.png` |
