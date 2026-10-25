/**
 * @author Shakib
 * @since 25/10/26
 *
 * Blurring is pure CSS keyed on classes on <html>, so it applies before the
 * page paints and hover-reveal costs nothing. The engine only flips classes
 * and data attributes.
 */
import type { SiteAdapter } from './adapters/types';
import { ALL_CATEGORIES } from './settings';

const BLUR = 'filter: blur(var(--veil-blur, 6px)) !important; transition: filter .18s ease !important;';
const CLEAR = 'filter: none !important;';

const is = (selectors: string[]) => `:is(${selectors.join(', ')})`;

export function buildCss(adapter: SiteAdapter): string {
  const rules: string[] = [];
  const blurred: string[] = [];

  for (const category of ALL_CATEGORIES) {
    const selectors = adapter.blur[category];
    if (!selectors.length) continue;
    blurred.push(...selectors);
    rules.push(`html.veil-on.veil-c-${category} ${is(selectors)} { ${BLUR} }`);
  }

  // Sensitive items stay blurred even when their category is off; "never blur" chats are exempt.
  rules.push(`html.veil-on.veil-sens :is([data-veil-s="list"]) { ${BLUR} }`);
  rules.push(`html.veil-on.veil-sens:not([data-veil-chat="never"]) [data-veil-s="message"] { ${BLUR} }`);
  rules.push(`html.veil-on [data-veil-row="always"] { ${BLUR} }`);
  rules.push(`html.veil-on [data-veil-row="hide"] { display: none !important; }`);

  // Reveal: hovering a whole row or bubble shows everything inside it; keyboard focus does too.
  const targets = is([...blurred, '[data-veil-s]', '[data-veil-row="always"]']);
  const scopes = is(adapter.revealScopes);
  const reveal = [
    `${scopes}:hover ${targets}`,
    `${targets}:hover`,
    // Keyboard focus only: a clicked chat row keeps focus and must not stay revealed.
    `${scopes}:has(:focus-visible) ${targets}`,
    `${targets}:has(:focus-visible)`,
    `${targets}:focus-visible`,
    // You can always see what you are typing.
    ...adapter.blur.typing.map((s) => `${s}:focus-within`),
  ];
  // The repeated class only raises specificity so reveal always beats every blur rule above.
  const boost = '.veil-on.veil-on.veil-on.veil-on';
  rules.push(`html${boost}:not(.veil-alt) ${is(reveal)} { ${CLEAR} }`);
  rules.push(`html${boost}.veil-alt.veil-alt-down ${is(reveal)} { ${CLEAR} }`);

  return rules.join('\n');
}
