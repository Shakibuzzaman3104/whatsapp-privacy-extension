/**
 * @author Shakib
 * @since 25/10/26
 */
import { messenger } from './messenger';
import { telegram } from './telegram';
import type { SiteAdapter } from './types';
import { whatsapp } from './whatsapp';

export const ADAPTERS: SiteAdapter[] = [whatsapp, telegram, messenger];

export const adapterForHost = (hostname: string): SiteAdapter | undefined =>
  ADAPTERS.find((adapter) => adapter.hosts.includes(hostname));

export type { SiteAdapter };
