import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BP, useMedia } from '../../ui/media';
import css from '../../styles/media.css?raw';

const NAMES: Record<keyof typeof BP, string> = { tablet: '--tablet', aboveTablet: '--above-tablet', desktop: '--desktop' };

describe('breakpoints', () => {
  it('match the custom media in CSS', () => {
    const custom = new Map([...css.matchAll(/@custom-media\s+(--[\w-]+)\s+([^;]+);/g)].map(m => [m[1], m[2].replace(/\s+/g, '')]));
    for (const key of Object.keys(BP) as (keyof typeof BP)[]) expect(BP[key].replace(/\s+/g, ''), key).toBe(custom.get(NAMES[key]));
  });

  it('are not written as numbers outside the breakpoint module', () => {
    const all = import.meta.glob<string>('../../{ui,app,features}/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(all).filter(([f, src]) => !f.endsWith('/ui/media.ts') && /matchMedia\(['"`]\((min|max)-width/.test(src)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('follow the screen when it changes', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const orig = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches,
      media: q,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb)
    })) as unknown as typeof window.matchMedia;
    const { result, unmount } = renderHook(() => useMedia(BP.desktop));
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach(cb => cb());
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
    window.matchMedia = orig;
  });
});
