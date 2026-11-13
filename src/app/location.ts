import { readEstimateHash, readOwnerHash, readShareHash } from '../core/links';
import { readSheetHash, sheetHash } from './deepLink';
import type { AppSheet, SheetId } from './types';

export type LinkKind = 'project' | 'owner' | 'estimate';

export interface AppLink {
  kind: LinkKind;
  data: string;
}

export interface AppLocation {
  link?: AppLink;
  sheet?: AppSheet;
  tab?: string;
}

const READERS: [LinkKind, (hash: string) => string | null][] = [
  ['project', readShareHash],
  ['owner', readOwnerHash],
  ['estimate', readEstimateHash]
];

export function parseLocation(hash: string): AppLocation {
  for (const [kind, read] of READERS) {
    const data = read(hash);
    if (data) return { link: { kind, data } };
  }
  const s = readSheetHash(hash);
  if (!s) return {};
  return s.tab ? { sheet: s.sheet, tab: s.tab } : { sheet: s.sheet };
}

export const currentHash = (): string => (typeof window === 'undefined' ? '' : window.location.hash);

export const readLocation = (): AppLocation => parseLocation(currentHash());

const replaceHash = (hash: string): void => {
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + hash);
  } catch (e) {
    void e;
  }
};

export function clearLocation(): void {
  if (currentHash()) replaceHash('');
}

export function writeSheetLocation(sheet: SheetId, tab?: string): void {
  const cur = currentHash();
  const next = sheetHash(sheet, tab);
  if (next === cur) return;
  if (!next && !readSheetHash(cur)) return;
  replaceHash(next);
}

const listeners = new Set<(loc: AppLocation) => void>();

const onHash = (): void => {
  const loc = readLocation();
  listeners.forEach(fn => fn(loc));
};

export function subscribeLocation(fn: (loc: AppLocation) => void): () => void {
  if (!listeners.size) window.addEventListener('hashchange', onHash);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) window.removeEventListener('hashchange', onHash);
  };
}
