import { describe, it, expect } from 'vitest';
import { UTP_MAX, normWeak, weakCalc, weakSpec, weakStarted, weakSummary } from '../../core/weak';
import type { Weak, WeakPt } from '../../core/weak';
import { calcAll } from '../../core/calc';
import { buildSpec } from '../../core/spec';
import { autoQty, laborEstimate } from '../../core/labor';
import { defaultCfg, mkLine } from '../../core/templates';

const pt = (o: Partial<WeakPt>): WeakPt => ({ id: 'w' + Math.random(), room: 'Гостиная', kind: 'lan', n: 1, len: 10, ...o });
const weak = (pts: WeakPt[], ont = true): Weak => ({ pts, ont });

describe('weakCalc', () => {
  it('counts points, cables with reserve, switch and splitter', () => {
    const c = weakCalc(weak([pt({ n: 3, len: 10 }), pt({ kind: 'tv', n: 3, len: 8 }), pt({ kind: 'door', len: 6 })]));
    expect(c.count).toEqual({ lan: 3, tv: 3, cam: 0, door: 1 });
    expect(c.points).toBe(7);
    expect(c.cables.map(x => [x.name, x.m])).toEqual([['Кабель UTP cat.5e 4×2×0,52', 30], ['Кабель коаксиальный RG-6, 75 Ом', 24], ['Кабель КСПВ 4×0,5', 6]]);
    expect(c.meters).toBe(33 + 27 + 7);
    expect(c.sw).toBe(0);
    expect(c.split).toBe(3);
    expect(c.notes[0].text).toContain('Хватит портов');
  });

  it('adds a PoE switch for cameras and many lines', () => {
    const c = weakCalc(weak([pt({ n: 6 }), pt({ kind: 'cam', n: 2 })]));
    expect(c.ports).toBe(8);
    expect(c.sw).toBe(16);
    expect(c.poe).toBe(true);
    expect(c.notes.find(n => n.text.startsWith('Коммутатор'))?.text).toContain('с PoE');
    expect(weakCalc(weak([pt({ n: 60 })])).sw).toBe(48);
    expect(weakCalc(weak([pt({ kind: 'tv', n: 12 })])).split).toBe(8);
  });

  it('flags long UTP lines and missing lengths, skips empty rows', () => {
    const c = weakCalc(weak([pt({ room: 'Балкон', kind: 'cam', len: UTP_MAX + 5 }), pt({ room: '', len: 95 }), pt({ kind: 'tv', len: 120 }), pt({ len: '' }), pt({ n: 0 })]));
    expect(c.long).toEqual(['Балкон', 'Интернет']);
    expect(c.notes[0]).toMatchObject({ k: 'bad', ref: 'ISO/IEC 11801, постоянная линия до 90 м' });
    expect(c.notes[1]).toMatchObject({ k: 'warn', text: 'Не задана длина у 1 строки, кабель для них не посчитан.' });
    expect(c.points).toBe(4);
  });

  it('mentions the optical terminal only when it is there', () => {
    expect(weakCalc(weak([pt({})])).notes.slice(-1)[0].text).toContain('оптического терминала');
    expect(weakCalc(weak([pt({})], false)).notes.slice(-1)[0].text).not.toContain('оптического терминала');
  });
});

describe('weakSpec', () => {
  it('lists the cabinet, outlets, connectors and cables', () => {
    const items = weakSpec(weakCalc(weak([pt({ n: 2 }), pt({ kind: 'tv', n: 2 }), pt({ kind: 'cam', len: '' })], false)));
    const names = items.map(i => i.name);
    expect(names).toEqual([
      'Щиток слаботочный встраиваемый',
      'Розетка 230 В двойная в слаботочный щиток',
      'Коммутатор 5 портов PoE',
      'Делитель TV на 2 выхода',
      'Розетка компьютерная RJ45 cat.5e',
      'Розетка TV оконечная',
      'Коннектор RJ45 cat.5e',
      'Кабель UTP cat.5e 4×2×0,52',
      'Кабель коаксиальный RG-6, 75 Ом'
    ]);
    expect(items[0].note).toBe('5 линий, роутер, коммутатор');
    expect(items[6].n).toBe(6);
    expect(items[7]).toMatchObject({ n: 22, qty: '22 м' });
    expect(weakSpec(weakCalc(weak([pt({ kind: 'cam', len: '' })]))).find(i => i.name === 'Коннектор RJ45 cat.5e')?.n).toBe(2);
    expect(weakSpec(weakCalc(weak([pt({ kind: 'door', len: '' })]))).slice(-1)[0]).toMatchObject({ qty: 'длина не задана', n: null, note: 'Домофон' });
    expect(weakSpec(weakCalc(weak([pt({ n: 0 })])))).toEqual([]);
  });
});

describe('normWeak and summary', () => {
  it('cleans stored data', () => {
    expect(normWeak(null)).toBeUndefined();
    expect(normWeak({})).toEqual({ pts: [], ont: true });
    const w = normWeak({ ont: false, pts: [{ kind: 'tv', room: 'Зал', n: 2, len: 7 }, { kind: 'x' }, null, { kind: 'lan', n: {}, len: [] }] }) as Weak;
    expect(w.ont).toBe(false);
    expect(w.pts.map(p => [p.kind, p.room, p.n, p.len])).toEqual([['tv', 'Зал', '2', '7'], ['lan', '', 1, '']]);
    expect(weakStarted(w)).toBe(true);
    expect(weakStarted({ pts: [], ont: true })).toBe(false);
  });

  it('summarises points and cable', () => {
    expect(weakSummary(undefined)).toBe('');
    expect(weakSummary(weak([pt({ n: 2 }), pt({ kind: 'tv' })]))).toBe('Интернет 2, ТВ 1, 33 м кабеля');
    expect(weakSummary(weak([pt({ len: '' })]))).toBe('Интернет 1');
    expect(weakSummary(weak([pt({ n: 0 })]))).toBe('точки не заданы');
  });
});

describe('weak current in the calculation', () => {
  const lines = [mkLine('Свет', 'light', 10, 1, 1, [['Лампа', 100, 1]])];
  it('adds items to the specification and works to the estimate', () => {
    const w = weak([pt({ n: 2, len: 10 }), pt({ kind: 'tv', len: 10 })]);
    const a = calcAll(lines, defaultCfg(), { weak: w });
    expect(a.weak?.points).toBe(3);
    expect(buildSpec(a).some(i => i.name === 'Розетка компьютерная RJ45 cat.5e')).toBe(true);
    const q = autoQty(a);
    expect(q.weak).toBe(3);
    expect(q.weakCable).toBe(30);
    expect(q.chase).toBe(q.cable + 30);
    expect(laborEstimate(a, undefined, { weak: 10 }).total).toBe(30);
    const b = calcAll(lines, defaultCfg());
    expect(b.weak).toBeUndefined();
    expect(autoQty(b).weak).toBe(0);
    expect(autoQty(calcAll(lines, defaultCfg(), { weak: { pts: [], ont: true } })).weakCable).toBe(0);
    expect(autoQty(calcAll(lines, { ...defaultCfg(), method: 'open' }, { weak: w })).chase).toBe(0);
  });
});
