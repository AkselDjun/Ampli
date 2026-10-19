import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { resetPhotoCache } from '../store/photos';

let seq = 0;

beforeEach(() => {
  localStorage.clear();
  resetPhotoCache();
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});
