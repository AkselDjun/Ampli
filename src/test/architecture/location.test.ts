import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLocation, parseLocation, readLocation, subscribeLocation, writeSheetLocation } from '../../app/location';
import { APP_SHEET } from '../../app/types';

const setHash = (h: string) => window.history.replaceState(null, '', window.location.pathname + h);

describe('one place for the page address', () => {
  afterEach(() => setHash(''));

  it('reads project links and section links into one structure', () => {
    expect(parseLocation('#p=abc')).toEqual({ link: { kind: 'project', data: 'abc' } });
    expect(parseLocation('#o=abc')).toEqual({ link: { kind: 'owner', data: 'abc' } });
    expect(parseLocation('#e=abc')).toEqual({ link: { kind: 'estimate', data: 'abc' } });
    expect(parseLocation('#report/estimate')).toEqual({ sheet: APP_SHEET.REPORT, tab: 'estimate' });
    expect(parseLocation('#shop')).toEqual({ sheet: APP_SHEET.SHOP });
    for (const h of ['', '#', '#p=', '#net', '#report/x/y']) expect(parseLocation(h)).toEqual({});
  });

  it('writes a section without touching a project link', () => {
    setHash('#p=abc');
    writeSheetLocation(APP_SHEET.REPORT, 'scheme');
    expect(readLocation()).toEqual({ sheet: APP_SHEET.REPORT, tab: 'scheme' });
    writeSheetLocation(null);
    expect(window.location.hash).toBe('');
    setHash('#p=abc');
    writeSheetLocation(null);
    expect(window.location.hash).toBe('#p=abc');
    writeSheetLocation(APP_SHEET.NETWORK);
    expect(window.location.hash).toBe('#p=abc');
    clearLocation();
    expect(window.location.hash).toBe('');
  });

  it('keeps one hashchange listener for all subscribers', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeLocation(a);
    const offB = subscribeLocation(b);
    expect(add.mock.calls.filter(c => c[0] === 'hashchange')).toHaveLength(1);
    setHash('#work/meas');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(a).toHaveBeenCalledWith({ sheet: APP_SHEET.WORK, tab: 'meas' });
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    expect(remove.mock.calls.filter(c => c[0] === 'hashchange')).toHaveLength(0);
    offB();
    expect(remove.mock.calls.filter(c => c[0] === 'hashchange')).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it('changes the address only from the location module', () => {
    const all = import.meta.glob<string>('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
    const offenders = Object.entries(all)
      .filter(([f]) => f.startsWith('../../') && !f.startsWith('../../test/') && !f.endsWith('/app/location.ts'))
      .filter(([, src]) => /replaceState|'hashchange'|location\.hash\s*=/.test(src))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });
});
