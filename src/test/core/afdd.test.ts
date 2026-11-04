import { describe, expect, it } from 'vitest';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { protFull, protName, poles } from '../../core/protection';
import { buildSpec } from '../../core/spec';
import { assumptions } from '../../core/assumptions';
import { matches, parseAttrs, shopQuery } from '../../core/shop';
import type { Cfg } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), prot: 'rcbo', ...o });
const light = mkLine('Свет', 'light', 10, 1, 1, [['Лампа', 100, 1]]);
const sock = mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 2000, 1]]);
const three = { ...mkLine('Плита', 'power', 10, 1, 1, [['Плита', 9000, 1]]), phase: '3' as const };

describe('arc fault detection devices', () => {
  it('normalises the option', () => {
    expect(cfgN(cfg()).afdd).toBe('off');
    expect(cfgN(cfg({ afdd: 'sock' })).afdd).toBe('sock');
    expect(cfgN(cfg({ afdd: 'all' })).afdd).toBe('all');
    expect(cfgN(cfg({ afdd: 'x' })).afdd).toBe('off');
  });

  it('puts the device on socket groups or on all single-phase groups', () => {
    const s = calcAll([light, sock], cfg({ afdd: 'sock' }));
    expect(s.rows.map(x => x.r.arc)).toEqual([false, true]);
    const all = calcAll([light, sock, three], cfg({ afdd: 'all', supply: 3 }));
    expect(all.rows.map(x => x.r.arc)).toEqual([true, true, false]);
    expect(all.rows[2].r.tips.some(t => t.startsWith('УЗДП не ставится'))).toBe(true);
    expect(calcAll([three], cfg({ afdd: 'sock', supply: 3 })).rows[0].r.tips.some(t => t.startsWith('УЗДП'))).toBe(false);
  });

  it('takes two modules with a breaker and names the devices', () => {
    const rcd = cfgN({ ...cfg({ afdd: 'all' }), prot: 'rcd' });
    const r = calcLine(light, rcd);
    expect(r.mod).toBe(2);
    expect(poles(r)).toBe('1P+N');
    expect(protFull(r)).toBe('УЗДП с автоматом 1P+N B10');
    expect(protName(r)).toBe('УЗДП с автоматом B10');
    const d = calcLine(sock, cfgN(cfg({ afdd: 'all' })));
    expect(d.mod).toBe(2);
    expect(protFull(d)).toBe('УЗДП с дифавтоматом 1P+N C16 30 мА');
    expect(calcLine(light, cfgN({ ...cfg(), prot: 'rcd' })).mod).toBe(1);
  });

  it('marks board devices, fills the specification and the assumptions', () => {
    const a = calcAll([light, sock], { ...cfg({ afdd: 'sock' }), prot: 'rcd' });
    expect(a.devs.filter(d => d.arc).map(d => d.sub)).toEqual(['Г2']);
    expect(buildSpec(a).some(i => i.name === 'УЗДП с автоматом 1P+N C16')).toBe(true);
    expect(assumptions(a.c).find(x => x.name === 'УЗДП')?.value).toContain('на розеточные группы');
    expect(assumptions(cfgN(cfg({ afdd: 'all' }))).find(x => x.name === 'УЗДП')?.value).toContain('на все однофазные группы');
    expect(assumptions(cfgN(cfg())).some(x => x.name === 'УЗДП')).toBe(false);
  });
});

describe('shop matching of arc fault devices', () => {
  it('keeps them apart from plain breakers', () => {
    const want = parseAttrs('УЗДП с автоматом 1P+N C16');
    expect(want).toMatchObject({ kind: 'breaker', amp: 16, curve: 'C', arc: true });
    expect(matches(want, parseAttrs('Устройство защиты от дугового пробоя с автоматом C16 1P+N'))).toBe(true);
    expect(matches(want, parseAttrs('Автоматический выключатель 1P C16'))).toBe(false);
    expect(matches(parseAttrs('Автомат 1P C16'), parseAttrs('УЗДП с автоматом C16'))).toBe(false);
    expect(shopQuery({ name: 'УЗДП с автоматом 1P+N C16', qty: '1 шт', note: '', n: 1, unit: 'шт' })).toBe('УЗДП с автоматом C16');
    expect(shopQuery({ name: 'УЗДП с дифавтоматом 1P+N C16 30 мА', qty: '1 шт', note: '', n: 1, unit: 'шт' })).toBe('УЗДП с дифавтоматом C16 30 мА');
  });
});
