/**
 * @author Shakib
 * @since 25/10/26
 *
 * Covers both official web clients: Web K (/k/, morethanwords/tweb) and Web A
 * (/a/, Ajaxy/telegram-tt). Class names checked against their sources on 25/10/26.
 */
import { type SiteAdapter, text } from './types';

const K_ROW = '.chatlist-chat';
const A_ROW = '.chat-list .ListItem.Chat';
const K_BUBBLE = '.bubbles .bubble';
const A_BUBBLE = '.MessageList .Message';
const K_MEDIA = ':has(.media-photo, .media-video, .media-sticker-wrapper)';
const A_MEDIA = ':has(.media-inner, .Album, .sticker-media)';

export const telegram: SiteAdapter = {
  id: 'telegram',
  label: 'Telegram Web',
  hosts: ['web.telegram.org'],
  isActive: (loc) => loc.hostname === 'web.telegram.org',
  blur: {
    chatList: [`${K_ROW} .dialog-subtitle`, `${K_ROW} .row-subtitle`, `${A_ROW} .last-message`, `${A_ROW} .subtitle`],
    names: [
      `${K_ROW} .dialog-title .peer-title`, `${K_ROW} .row-title`, '.chat .topbar .peer-title',
      `${A_ROW} .info .title`, '.MiddleHeader .ChatInfo .fullName',
    ],
    photos: [
      `${K_ROW} .dialog-avatar`, '.chat .topbar .avatar',
      `${A_ROW} .Avatar`, '.MiddleHeader .ChatInfo .Avatar',
    ],
    messages: [`${K_BUBBLE}:not(${K_MEDIA}) .bubble-content`, `${A_BUBBLE}:not(${A_MEDIA}) .message-content`],
    media: [`${K_BUBBLE}${K_MEDIA} .bubble-content`, `${A_BUBBLE}${A_MEDIA} .message-content`],
    typing: ['.chat-input .input-message-input', '#editable-message-text'],
    details: [
      `${K_ROW} .dialog-title-details`, `${K_ROW} .dialog-subtitle-badge`, '.chat .topbar .info',
      `${A_ROW} .info .LastMessageMeta`, `${A_ROW} .ChatBadge`, '.MiddleHeader .ChatInfo .status',
      '.bubbles .service-msg', '.MessageList .ActionMessage',
    ],
  },
  revealScopes: [K_ROW, A_ROW, K_BUBBLE, A_BUBBLE, '.chat .topbar', '.MiddleHeader'],
  textSources: [
    { text: `${K_ROW} .dialog-subtitle`, tag: '.dialog-subtitle', scope: 'list' },
    { text: `${A_ROW} .last-message`, tag: '.last-message', scope: 'list' },
    { text: `${K_BUBBLE} .message`, tag: '.bubble-content', scope: 'message' },
    { text: `${A_BUBBLE} .text-content`, tag: '.message-content', scope: 'message' },
  ],
  listRow: `${K_ROW}, ${A_ROW}`,
  rowTitle: (row) => text(row.querySelector('.peer-title, .row-title, .info .title')),
  chatTitle: () => text(document.querySelector('.chat.active .topbar .peer-title, .chat .topbar .peer-title, .MiddleHeader .ChatInfo .fullName')),
};
