/**
 * @author Shakib
 * @since 25/10/26
 *
 * Selectors checked against the live web.whatsapp.com DOM on 25/10/26.
 */
import { type SiteAdapter, text } from './types';

const ROW = '#pane-side [role="row"]';
const BUBBLE = '#main [data-testid="msg-container"]';
// WhatsApp serves photos, videos and stickers as blob: URLs; link previews are not media.
const HAS_MEDIA = ':has(img[src^="blob:"], video, canvas)';

export const whatsapp: SiteAdapter = {
  id: 'whatsapp',
  label: 'WhatsApp Web',
  hosts: ['web.whatsapp.com'],
  isActive: (loc) => loc.hostname === 'web.whatsapp.com',
  blur: {
    chatList: [`${ROW} [data-testid="cell-frame-secondary"]`],
    names: [
      `${ROW} [data-testid="cell-frame-title"]`,
      '#main [data-testid="conversation-info-header-chat-title"]',
    ],
    photos: [
      `${ROW} [data-testid="cell-frame-container"] > div:first-child`,
      '#main [data-testid="conversation-header"] img',
    ],
    messages: [`${BUBBLE}:not(${HAS_MEDIA})`],
    media: [`${BUBBLE}${HAS_MEDIA}`],
    typing: ['#main [data-testid="compose-box"]'],
    details: [
      `${ROW} [data-testid="cell-frame-primary-detail"]`,
      '#main [data-testid="conversation-info-header"] > div > div:nth-child(n+2)',
      '#main [data-testid="system_message"]',
    ],
  },
  revealScopes: [ROW, BUBBLE, '#main [data-testid="conversation-header"]'],
  textSources: [
    { text: `${ROW} [data-testid="last-msg-status"]`, tag: '[data-testid="cell-frame-secondary"]', scope: 'list' },
    { text: `${BUBBLE} [data-testid="selectable-text"]`, tag: '[data-testid="msg-container"]', scope: 'message' },
  ],
  listRow: ROW,
  rowTitle: (row) => text(row.querySelector('[data-testid="cell-frame-title"] span[title]')),
  chatTitle: () => text(document.querySelector('#main [data-testid="conversation-info-header-chat-title"]')),
};
