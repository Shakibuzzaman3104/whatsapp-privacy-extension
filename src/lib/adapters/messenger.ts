/**
 * @author Shakib
 * @since 25/10/26
 *
 * messenger.com and facebook.com/messages. Meta obfuscates class names, so this
 * adapter leans on ARIA roles and chat links only. Not yet checked on a live,
 * logged-in session.
 */
import { type SiteAdapter, text } from './types';

const LIST = '[role="navigation"]';
const ROW = `${LIST} [role="row"]:has(a[href*="/t/"])`;
const CONVERSATION = '[role="main"]';
const BUBBLE = `${CONVERSATION} [role="row"] [role="gridcell"]`;
const HAS_MEDIA = ':has(img[src*="scontent"], video)';

export const messenger: SiteAdapter = {
  id: 'messenger',
  label: 'Messenger',
  hosts: ['www.messenger.com', 'www.facebook.com'],
  isActive: (loc) =>
    loc.hostname === 'www.messenger.com' ||
    (loc.hostname === 'www.facebook.com' && loc.pathname.startsWith('/messages')),
  blur: {
    chatList: [`${ROW} a[href*="/t/"] [dir="auto"]:not(:first-child)`, `${ROW} a[href*="/t/"] > div > div > div:last-child`],
    names: [`${ROW} a[href*="/t/"] span[dir="auto"]:first-of-type`, `${CONVERSATION} h2`],
    photos: [`${ROW} a[href*="/t/"] img`, `${ROW} a[href*="/t/"] svg[role="img"]`, `${CONVERSATION} [role="banner"] img`],
    messages: [`${BUBBLE}:not(${HAS_MEDIA})`],
    media: [`${BUBBLE}${HAS_MEDIA}`],
    typing: [`${CONVERSATION} [role="textbox"][contenteditable="true"]`],
    details: [`${ROW} abbr`, `${CONVERSATION} h2 ~ *`],
  },
  revealScopes: [ROW, BUBBLE, `${CONVERSATION} [role="banner"]`],
  textSources: [
    { text: `${BUBBLE} [dir="auto"]`, tag: '[role="gridcell"]', scope: 'message' },
  ],
  listRow: ROW,
  rowTitle: (row) => text(row.querySelector('a[href*="/t/"] span[dir="auto"]')),
  chatTitle: () => text(document.querySelector(`${CONVERSATION} h2`)),
};
