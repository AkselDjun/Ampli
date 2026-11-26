export type Hotkey = 'next' | 'prev' | 'add' | 'pick' | 'edit' | 'help';

export interface KeyLike {
  code: string;
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const CODES: Record<string, Hotkey> = {
  KeyJ: 'next',
  KeyK: 'prev',
  KeyN: 'add',
  KeyS: 'pick',
  KeyE: 'edit'
};

export function hotkeyOf(e: KeyLike): Hotkey | null {
  if (e.ctrl || e.meta || e.alt) return null;
  if (e.key === '?' || (e.shift && (e.code === 'Slash' || e.code === 'Comma'))) return 'help';
  if (e.shift) return null;
  return CODES[e.code] ?? null;
}

export function stepIn(ids: readonly string[], cur: string | null, d: 1 | -1): string | null {
  if (!ids.length) return null;
  const i = cur === null ? -1 : ids.indexOf(cur);
  if (i < 0) return d > 0 ? ids[0] : ids[ids.length - 1];
  return ids[Math.max(0, Math.min(ids.length - 1, i + d))];
}
