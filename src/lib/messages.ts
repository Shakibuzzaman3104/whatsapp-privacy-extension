/**
 * @author Shakib
 * @since 25/10/26
 */
import type { ChatRule, SiteId } from './settings';

export type ShieldReason = 'panic' | 'away' | 'lock';

export type NanoStatus = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export interface PageInfo {
  site: SiteId;
  label: string;
  chatTitle: string | null;
  rule: ChatRule;
  sensitiveCount: number;
}

export interface Status {
  panic: boolean;
  nano: NanoStatus;
}

/** Content script -> background */
export type ToBackground =
  | { type: 'deepScan'; text: string }
  | { type: 'setPanic'; on: boolean }
  | { type: 'getStatus' };

/** Background or popup -> content script */
export type ToContent =
  | { type: 'shield'; reason: 'panic'; on: boolean }
  | { type: 'setChatRule'; rule: ChatRule }
  | { type: 'getPageInfo' };

export const sendToBackground = <T = unknown>(message: ToBackground) =>
  chrome.runtime.sendMessage(message) as Promise<T>;
