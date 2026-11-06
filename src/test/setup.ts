import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { resetPhotoCache } from '../store/photos';
import { resetProjectDb } from '../store/storage';
import { dismissToast } from '../ui/toast';
import { preloadParts } from '../ui/parts';

let seq = 0;

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
}

beforeAll(async () => {
  await preloadParts();
});

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: new MemStorage(), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: window.localStorage, configurable: true, writable: true });
  localStorage.setItem('ampli-listby', 'no');
  resetPhotoCache();
  resetProjectDb();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  URL.createObjectURL = (() => 'blob:test/' + ++seq) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.print = vi.fn();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
});

afterEach(() => {
  cleanup();
  dismissToast();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
