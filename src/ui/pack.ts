import { useState } from 'react';
import type { PrintMode } from './WorkSheet';

export const PACK_KEY = 'ampli-pack';
export const PACK_DEFAULT: PrintMode[] = ['report', 'a3', 'proto', 'accept', 'passport'];
const ALL: PrintMode[] = ['report', 'a3', 'proto', 'hidden', 'wiring', 'accept', 'passport', 'stickers', 'tags', 'old'];

export function loadPack(): PrintMode[] {
  try {
    const v = JSON.parse(localStorage.getItem(PACK_KEY) ?? 'null');
    return Array.isArray(v) ? ALL.filter(m => v.includes(m)) : PACK_DEFAULT;
  } catch (e) {
    void e;
    return PACK_DEFAULT;
  }
}

export function usePack(): [PrintMode[], (v: PrintMode[]) => void] {
  const [pack, set] = useState<PrintMode[]>(loadPack);
  const save = (v: PrintMode[]) => {
    set(v);
    try {
      localStorage.setItem(PACK_KEY, JSON.stringify(v));
    } catch (e) {
      void e;
    }
  };
  return [pack, save];
}
