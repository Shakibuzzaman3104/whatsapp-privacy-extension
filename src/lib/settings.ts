/**
 * @author Shakib
 * @since 25/10/26
 */
import type { KindToggles, SensitiveKind } from './classify';

export type SiteId = 'whatsapp' | 'telegram' | 'messenger';
export type Category = 'chatList' | 'names' | 'photos' | 'messages' | 'media' | 'typing' | 'details';
export type BlurMode = 'custom' | 'allButIdentity';
export type ChatRule = 'default' | 'always' | 'never' | 'hide';
export type RevealMode = 'hover' | 'alt';

/** Categories the user toggles. `details` (timestamps, badges, status) is only used by the all-but-identity mode. */
export const CATEGORIES: Category[] = ['chatList', 'names', 'photos', 'messages', 'media', 'typing'];
export const ALL_CATEGORIES: Category[] = [...CATEGORIES, 'details'];
/** Categories that live inside an open conversation, so a per-chat rule applies to them. */
export const CONVERSATION_CATEGORIES: Category[] = ['messages', 'media', 'typing'];
export const SITES: SiteId[] = ['whatsapp', 'telegram', 'messenger'];

export interface SiteSettings {
  enabled: boolean;
  categories: Record<Category, boolean>;
}

export interface Settings {
  enabled: boolean;
  /** `allButIdentity` blurs everything except names and profile photos. */
  mode: BlurMode;
  sites: Record<SiteId, SiteSettings>;
  reveal: RevealMode;
  /** Blur radius in px. */
  blurStrength: number;
  sensitive: {
    enabled: boolean;
    kinds: KindToggles;
    /** On-device Gemini Nano deep scan. */
    deepScan: boolean;
  };
  guard: {
    enabled: boolean;
    /** Also cover chats when nobody is in front of the camera. */
    emptySeat: boolean;
  };
  away: {
    enabled: boolean;
    idleSeconds: number;
    onWindowBlur: boolean;
  };
  lock: {
    /** PBKDF2 hash of the PIN, base64. Null when no PIN is set. */
    hash: string | null;
    salt: string | null;
    /** Ask for the PIN when Veil covers chats for being away. */
    onAway: boolean;
  };
  /** Keyed by `${site}:${chat title}`. */
  chatRules: Record<string, Exclude<ChatRule, 'default'>>;
}

const allCategories = (on: boolean) =>
  Object.fromEntries(ALL_CATEGORIES.map((c) => [c, on])) as Record<Category, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: 'custom',
  sites: {
    whatsapp: { enabled: true, categories: { ...allCategories(true), typing: false, details: false } },
    telegram: { enabled: true, categories: { ...allCategories(true), typing: false, details: false } },
    messenger: { enabled: true, categories: { ...allCategories(true), typing: false, details: false } },
  },
  reveal: 'hover',
  blurStrength: 6,
  sensitive: {
    enabled: true,
    kinds: { otp: true, card: true, bank: true, password: true, phone: false, email: false, money: true, address: false },
    deepScan: false,
  },
  guard: { enabled: false, emptySeat: false },
  away: { enabled: true, idleSeconds: 60, onWindowBlur: false },
  lock: { hash: null, salt: null, onAway: false },
  chatRules: {},
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Fills anything missing from `stored` with defaults, so older saves keep working. */
export function mergeSettings<T>(defaults: T, stored: DeepPartial<T> | undefined): T {
  if (!isPlainObject(stored)) return structuredClone(defaults);
  const out: Record<string, unknown> = structuredClone(defaults) as Record<string, unknown>;
  for (const [key, value] of Object.entries(stored)) {
    const base = out[key];
    out[key] = isPlainObject(base) && isPlainObject(value) && key !== 'chatRules'
      ? mergeSettings(base, value)
      : value;
  }
  return out as T;
}

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return mergeSettings(DEFAULT_SETTINGS, stored[KEY] as DeepPartial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export async function updateSettings(change: (s: Settings) => void): Promise<Settings> {
  const settings = await loadSettings();
  change(settings);
  await saveSettings(settings);
  return settings;
}

export function onSettingsChanged(listener: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) listener(mergeSettings(DEFAULT_SETTINGS, changes[KEY].newValue as DeepPartial<Settings> | undefined));
  });
}

export const chatKey = (site: SiteId, title: string) => `${site}:${title.trim()}`;

/** The categories that are blurred on a site, after the blur mode and the open chat's rule. */
export function effectiveCategories(settings: Settings, site: SiteId, rule: ChatRule): Set<Category> {
  const on = new Set<Category>();
  if (settings.mode === 'allButIdentity') {
    for (const c of ALL_CATEGORIES) if (c !== 'names' && c !== 'photos') on.add(c);
  } else {
    for (const c of ALL_CATEGORIES) if (settings.sites[site].categories[c]) on.add(c);
  }
  if (rule === 'always') for (const c of CONVERSATION_CATEGORIES) on.add(c);
  if (rule === 'never') for (const c of CONVERSATION_CATEGORIES) on.delete(c);
  return on;
}

export function resolveChatRule(settings: Settings, site: SiteId, title: string | null): ChatRule {
  if (!title) return 'default';
  return settings.chatRules[chatKey(site, title)] ?? 'default';
}

export type { SensitiveKind };
