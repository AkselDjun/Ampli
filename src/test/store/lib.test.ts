import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIB_KEY, emptyBrand, emptyLib, libReducer, loadLib, normLib, saveLib } from '../../store/lib';
import type { Lib } from '../../store/lib';
import { LibContext, useLib } from '../../store/LibContext';
import { defaultCfg, mkLine } from '../../core/templates';

describe('normLib', () => {
  it('returns empty lib for non objects', () => {
    expect(normLib(null)).toEqual(emptyLib());
    expect(normLib('x')).toEqual(emptyLib());
    expect(normLib(5)).toEqual(emptyLib());
    expect(normLib({})).toEqual(emptyLib());
    expect(emptyBrand()).toEqual({ company: '', contacts: '', signer: '', logo: '' });
  });
  it('filters and normalizes apps', () => {
    const l = normLib({
      apps: [
        null,
        { name: 5, tag: 's', w: 1 },
        { name: 'a', tag: 'x', w: 1 },
        { name: 'a', tag: 's', w: 0 },
        { name: 'a', tag: 's', w: 'abc' },
        { id: 'k', name: 'n'.repeat(100), tag: 'p', w: '1,5' },
        { name: 'noid', tag: 'l', w: 40 }
      ]
    });
    expect(l.apps).toHaveLength(2);
    expect(l.apps[0]).toEqual({ id: 'k', name: 'n'.repeat(60), w: 1.5, tag: 'p' });
    expect(l.apps[1].id).toMatch(/^i\d+$/);
  });
  it('filters and normalizes templates', () => {
    const cfg = defaultCfg();
    const l = normLib({
      templates: [null, { name: 1, lines: [], cfg }, { name: 'a', lines: 'x', cfg }, { name: 'a', lines: [] }, { id: 7, name: 'm'.repeat(90), lines: [], cfg }, { name: 'z', lines: [], cfg }]
    });
    expect(l.templates).toHaveLength(2);
    expect(l.templates[0].id).toBe('7');
    expect(l.templates[0].name).toHaveLength(60);
    expect(l.templates[1].id).toMatch(/^i\d+$/);
  });
  it('normalizes prices', () => {
    const l = normLib({ prices: { a: 5, b: '3,5', c: -1, d: 'x', e: 0, f: null } });
    expect(l.prices).toEqual({ a: 5, b: 3.5, e: 0 });
    expect(normLib({ prices: 5 }).prices).toEqual({});
  });
  it('normalizes brand', () => {
    const l = normLib({ brand: { company: 'c'.repeat(100), contacts: 'k'.repeat(200), signer: 's'.repeat(100), logo: 'data:image/png;base64,AAA' } });
    expect(l.brand.company).toHaveLength(80);
    expect(l.brand.contacts).toHaveLength(160);
    expect(l.brand.signer).toHaveLength(80);
    expect(l.brand.logo).toBe('data:image/png;base64,AAA');
    expect(normLib({ brand: { logo: 'http://x/y.png' } }).brand).toEqual(emptyBrand());
    expect(normLib({ brand: { logo: 5, company: null } }).brand).toEqual(emptyBrand());
    expect(normLib({ brand: 'x' }).brand).toEqual(emptyBrand());
  });
});

describe('loadLib and saveLib', () => {
  it('loads empty when nothing stored', () => {
    expect(loadLib()).toEqual(emptyLib());
  });
  it('round trips', () => {
    const l: Lib = { ...emptyLib(), prices: { a: 2 } };
    saveLib(l);
    expect(loadLib().prices).toEqual({ a: 2 });
    expect(localStorage.getItem(LIB_KEY)).toBeTruthy();
  });
  it('survives corrupt json and storage errors', () => {
    localStorage.setItem(LIB_KEY, '{x');
    expect(loadLib()).toEqual(emptyLib());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveLib(emptyLib())).not.toThrow();
  });
});

describe('libReducer', () => {
  const base = emptyLib();
  it('adds apps, trims, skips invalid and duplicates', () => {
    const l = libReducer(base, {
      t: 'addApps',
      apps: [
        { name: ' Чайник ', w: 2000, tag: 's' },
        { name: 'Чайник', w: 2000, tag: 's' },
        { name: '', w: 100, tag: 's' },
        { name: '  ', w: 100, tag: 's' },
        { name: 'x', w: 0, tag: 's' },
        { name: 'x', w: -5, tag: 's' },
        { name: 'Чайник', w: 2000, tag: 'p' },
        { name: 'L'.repeat(80), w: 5, tag: 'l' }
      ]
    });
    expect(l.apps).toHaveLength(3);
    expect(l.apps[0].name).toBe('Чайник');
    expect(l.apps[2].name).toHaveLength(60);
    expect(new Set(l.apps.map(a => a.id)).size).toBe(3);
    expect(base.apps).toHaveLength(0);
  });
  it('deletes apps', () => {
    const l = libReducer(base, { t: 'addApps', apps: [{ name: 'a', w: 1, tag: 's' }, { name: 'b', w: 1, tag: 's' }] });
    expect(libReducer(l, { t: 'delApp', id: l.apps[0].id }).apps.map(a => a.name)).toEqual(['b']);
  });
  it('adds a deep-copied template with default name', () => {
    const lines = [mkLine('a', 'socket', 5, null, null, [['x', 1, 1]])];
    const cfg = defaultCfg();
    const l = libReducer(base, { t: 'addTpl', name: '  ', cfg, lines });
    expect(l.templates[0].name).toBe('Мой шаблон');
    expect(l.templates[0].lines).toEqual(lines);
    expect(l.templates[0].lines).not.toBe(lines);
    expect(l.templates[0].lines[0]).not.toBe(lines[0]);
    expect(l.templates[0].cfg).not.toBe(cfg);
    const l2 = libReducer(l, { t: 'addTpl', name: 'N'.repeat(90), cfg, lines: [] });
    expect(l2.templates[1].name).toHaveLength(60);
    expect(libReducer(l2, { t: 'delTpl', id: l2.templates[0].id }).templates).toHaveLength(1);
  });
  it('sets, parses and removes prices', () => {
    let l = libReducer(base, { t: 'price', name: 'a', value: '12,5' });
    expect(l.prices).toEqual({ a: 12.5 });
    l = libReducer(l, { t: 'price', name: 'b', value: '0' });
    expect(l.prices).toEqual({ a: 12.5, b: 0 });
    l = libReducer(l, { t: 'price', name: 'a', value: '' });
    expect(l.prices).toEqual({ b: 0 });
    l = libReducer(l, { t: 'price', name: 'b', value: '-3' });
    expect(l.prices).toEqual({});
    l = libReducer(libReducer(l, { t: 'price', name: 'c', value: '1' }), { t: 'clearPrices' });
    expect(l.prices).toEqual({});
  });
  it('updates brand and logo', () => {
    let l = libReducer(base, { t: 'brand', field: 'company', value: 'ООО' });
    l = libReducer(l, { t: 'brand', field: 'contacts', value: 'tel' });
    l = libReducer(l, { t: 'brand', field: 'signer', value: 'Иванов' });
    l = libReducer(l, { t: 'logo', value: 'data:image/png;base64,A' });
    expect(l.brand).toEqual({ company: 'ООО', contacts: 'tel', signer: 'Иванов', logo: 'data:image/png;base64,A' });
  });
  it('ignores unknown actions', () => {
    expect(libReducer(base, { t: 'nope' } as never)).toBe(base);
  });
});

describe('LibContext', () => {
  it('provides defaults', () => {
    const { result } = renderHook(() => useLib());
    expect(result.current.lib).toEqual(emptyLib());
    expect(result.current.dispatch({ t: 'clearPrices' })).toBeUndefined();
  });
  it('provides a custom value', () => {
    const lib = { ...emptyLib(), prices: { a: 1 } };
    const dispatch = vi.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(LibContext.Provider, { value: { lib, dispatch } }, children);
    const { result } = renderHook(() => useLib(), { wrapper });
    expect(result.current.lib).toBe(lib);
    result.current.dispatch({ t: 'clearPrices' });
    expect(dispatch).toHaveBeenCalledWith({ t: 'clearPrices' });
  });
});
