/**
 * @author Shakib
 * @since 25/10/26
 */
import type { ChatRule, SiteId } from './settings';

export type ShieldReason = 'panic' | 'away' | 'lock';

export type GuardStatus = 'off' | 'needs-camera' | 'paused' | 'watching' | 'triggered' | 'error';
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
  guard: GuardStatus;
  nano: NanoStatus;
}

/** Content script -> background */
export type ToBackground =
  | { type: 'presence'; active: boolean }
  | { type: 'deepScan'; text: string }
  | { type: 'setPanic'; on: boolean }
  | { type: 'snoozeGuard'; minutes: number }
  | { type: 'getStatus' }
  | { type: 'cameraGranted' }
  | { type: 'faces'; count: number }
  | { type: 'cameraError'; name: string };

/** Background or popup -> content script */
export type ToContent =
  | { type: 'shield'; reason: 'panic' | 'guard'; on: boolean }
  | { type: 'setChatRule'; rule: ChatRule }
  | { type: 'getPageInfo' };

export const sendToBackground = <T = unknown>(message: ToBackground) =>
  chrome.runtime.sendMessage(message) as Promise<T>;
