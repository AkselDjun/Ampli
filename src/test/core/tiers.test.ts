import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sampleProject } from '../../core/project';
import { PERKS, cfgChanges, markPrices, tierCfg, tierEstimates, tierPriceNames } from '../../core/tiers';
import { calcAll } from '../../core/calc';
import { buildSpec } from '../../core/spec';
import { normMarkup, packEstimate, unpackEstimate } from '../../core/share';
import type { EstimateShare } from '../../core/share';
import { emptyLib, libReducer, normLib } from '../../store/lib';

const errs = (p: ReturnType<typeof sampleProject>, cfg = p.cfg) => calcAll(p.lines, cfg, p).rows.filter(x => x.r.status === 'bad').length;

describe('Estimate tiers', () => {
  it('only adds protection on top of the project', () => {
    const p = sampleProject();
    expect(tierCfg(p.cfg, 'base')).toBe(p.cfg);
    expect(tierCfg(p.cfg, 'safe')).toMatchObject({ vr: 'on', spd: 'on' });
    expect(tierCfg(p.cfg, 'max')).toMatchObject({ vr: 'on', spd: 'on', afdd: 'sock' });
    expect(tierCfg({ ...p.cfg, afdd: 'all' }, 'max').afdd).toBe('all');
  });

  it('lists three tiers with perks and growing totals for the sample flat', () => {
    const p = sampleProject();
    const prices: Record<string, number> = {};
    tierPriceNames(p).forEach(n => { prices[n] = n.includes('УЗДП') ? 100 : 10; });
    const list = tierEstimates(p, prices, {}, [0, 0, 0]);
    expect(list.map(t => t.def.id)).toEqual(['base', 'safe', 'max']);
    expect(list[0].perks).toEqual([]);
    expect(list[1].perks).toEqual([PERKS.vr, PERKS.spd]);
    expect(list[2].perks).toEqual([PERKS.afdd]);
    expect(list[1].total).toBeGreaterThan(list[0].total);
    expect(list[2].total).toBeGreaterThan(list[1].total);
    expect(list.every(t => t.missing === list[0].missing)).toBe(true);
  });

  it('drops a tier that adds nothing and keeps it when a markup differs', () => {
    const p = sampleProject();
    p.cfg = { ...p.cfg, vr: 'on', spd: 'on' };
    expect(tierEstimates(p, {}, {}, [0, 0, 0]).map(t => t.def.id)).toEqual(['base', 'max']);
    const marked = tierEstimates(p, {}, {}, [0, 20, 20]);
    expect(marked.map(t => t.def.id)).toEqual(['base', 'safe', 'max']);
    expect(marked[1].perks).toEqual([PERKS.brand]);
    expect(marked[2].perks).toEqual([PERKS.afdd]);
  });

  it('applies the markup to every material price', () => {
    expect(markPrices({ a: 10, b: 3.33 }, 0)).toEqual({ a: 10, b: 3.33 });
    expect(markPrices({ a: 10, b: 3.33 }, 25)).toEqual({ a: 12.5, b: 4.16 });
  });

  it('collects prices for devices that appear only in higher tiers', () => {
    const p = sampleProject();
    const base = new Set(buildSpec(calcAll(p.lines, p.cfg, p)).map(i => i.name));
    const all = tierPriceNames(p);
    const extra = [...all].filter(n => !base.has(n));
    expect(extra.some(n => n.startsWith('Реле контроля напряжения'))).toBe(true);
    expect(extra.some(n => n.startsWith('УЗИП'))).toBe(true);
  });

  it('reports the config changes needed to reach a tier', () => {
    const p = sampleProject();
    expect(cfgChanges(p.cfg, tierCfg(p.cfg, 'max'))).toEqual([
      { field: 'vr', value: 'on' },
      { field: 'spd', value: 'on' },
      { field: 'afdd', value: 'sock' }
    ]);
    expect(cfgChanges(p.cfg, p.cfg)).toEqual([]);
  });

  it('never adds norm errors in a higher tier', () => {
    fc.assert(
      fc.property(fc.constantFrom('', 'on'), fc.constantFrom('', 'on'), fc.constantFrom('off', 'sock', 'all'), fc.constantFrom(1, 3), (vr, spd, afdd, supply) => {
        const p = sampleProject();
        p.cfg = { ...p.cfg, vr, spd, afdd, supply };
        const base = errs(p);
        expect(errs(p, tierCfg(p.cfg, 'safe'))).toBeLessThanOrEqual(base);
        expect(errs(p, tierCfg(p.cfg, 'max'))).toBeLessThanOrEqual(base);
      }),
      { numRuns: 30 }
    );
  });
});

describe('Tier markups in links and the library', () => {
  it('normalises markups', () => {
    expect(normMarkup([0, 10.4, 500])).toEqual([0, 10, 300]);
    expect(normMarkup([-5, 0, 0])).toEqual([0, 0, 0]);
    expect(normMarkup([0, 'x', 0])).toBeNull();
    expect(normMarkup([0, 0])).toBeNull();
    expect(normMarkup(null)).toBeNull();
  });

  it('keeps tiers in the client link and old links without them', () => {
    const e: EstimateShare = { p: sampleProject(), prices: { x: 1 }, labor: {}, company: '', contacts: '', at: 1 };
    expect(unpackEstimate(packEstimate(e))?.tiers).toBeUndefined();
    expect(unpackEstimate(packEstimate({ ...e, tiers: [0, 15, 40] }))?.tiers).toEqual([0, 15, 40]);
  });

  it('stores the switch and markups in the library', () => {
    let l = libReducer(emptyLib(), { t: 'tiersOn', on: true });
    l = libReducer(l, { t: 'tierMarkup', i: 2, value: '35' });
    l = libReducer(l, { t: 'tierMarkup', i: 1, value: 'abc' });
    expect(l.tiers).toEqual({ on: true, markup: [0, 0, 35] });
    l = libReducer(l, { t: 'tierMarkup', i: 2, value: '1000' });
    expect(l.tiers.markup[2]).toBe(300);
    expect(normLib(JSON.parse(JSON.stringify(l))).tiers).toEqual({ on: true, markup: [0, 0, 300] });
    expect(normLib({ tiers: { on: 'yes', markup: 'no' } }).tiers).toEqual({ on: false, markup: [0, 0, 0] });
  });
});
