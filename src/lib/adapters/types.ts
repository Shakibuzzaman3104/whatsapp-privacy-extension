/**
 * @author Shakib
 * @since 25/10/26
 */
import type { Category, SiteId } from '../settings';

export interface TextSource {
  /** Elements whose text is checked for sensitive details. */
  text: string;
  /** Ancestor that gets blurred when the text is sensitive. */
  tag: string;
  /** `list` = chat-list preview, `message` = inside the open conversation. */
  scope: 'list' | 'message';
}

/**
 * Everything Veil needs to know about one messenger's page. Selectors only:
 * when a site changes its markup, this file is the one to fix.
 */
export interface SiteAdapter {
  id: SiteId;
  label: string;
  hosts: string[];
  /** Whether the current page is a chat page (facebook.com is only one under /messages). */
  isActive(location: Location): boolean;
  /** Elements blurred per category. */
  blur: Record<Category, string[]>;
  /** Hovering one of these reveals every blurred element inside it. */
  revealScopes: string[];
  textSources: TextSource[];
  /** One chat in the chat list. */
  listRow: string;
  rowTitle(row: Element): string | null;
  /** Title of the open conversation, or null when none is open. */
  chatTitle(): string | null;
}

export const text = (el: Element | null | undefined): string | null => {
  const value = el?.getAttribute('title') || el?.textContent;
  return value?.trim() || null;
};
