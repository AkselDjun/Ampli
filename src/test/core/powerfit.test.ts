import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calcAll, contactorIn, prioPlan } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { buildSpec } from '../../core/spec';
import { isOver, powerFit, prioNames } from '../../core/powerfit';
import { newProject, normProject } from '../../core/project';
import { packProject, unpackProject } from '../../core/share';
import { assumptions } from '../../core/assumptions';
import { cfgN } from '../../core/calc';
import { checksOf } from '../../ui/Checks';
import type { Cfg, Line, Project } from '../../core/types';

const stove = (o: Partial<Line> = {}): Line => ({ ...mkLine('Плита', 'power', 8, [['Электроплита', 7000, 1]]), ...o });
const boiler = (o: Partial<Line> = {}): Line => ({ ...mkLine('Бойлер', 'power', 6, [['Водонагреватель', 2000, 1]]), ...o });
const floor = (o: Partial<Line> = {}): Line => ({ ...mkLine('Тёплый пол', 'power', 6, [['Тёплый пол', 1500, 1]]), ...o });
const light = (): Line => mkLine('Свет', 'light', 10, [['Лампа', 300, 1]]);
const proj = (lines: Line[], cfg: Partial<Cfg> = {}): Project => newProject({ sample: false, cfg: { ...defaultCfg(), alloc: 8, ...cfg }, lines }, 'Дом');

describe('Priority relay in the calculation', () => {
  it('counts the larger of the priority and shed loads', () => {
    const lines = [stove(), boiler(), floor(), light()];
    const plain = calcAll(lines, defaultCfg());
    const withPrio = calcAll([stove({ prio: 'p' }), boiler({ prio: 's' }), floor({ prio: 's' }), light()], defaultCfg());
    const shed = plain.rows[1].r.pd + plain.rows[2].r.pd;
    expect(plain.P - withPrio.P).toBeCloseTo(Math.min(plain.rows[0].r.pd, shed) * withPrio.c.ko, 3);
    expect(withPrio.Itot).toBeLessThan(plain.Itot);
    expect(withPrio.prio).toEqual({ p: [0], s: [1, 2] });
  });

  it('does nothing until both sides are marked', () => {
    const only = calcAll([stove({ prio: 'p' }), boiler(), light()], defaultCfg());
    const plain = calcAll([stove(), boiler(), light()], defaultCfg());
    expect(only.P).toBe(plain.P);
    expect(only.prio).toBeUndefined();
    expect(only.devs.some(d => d.kind === 'prio')).toBe(false);
  });

  it('credits each phase only where both loads sit', () => {
    const cfg = { ...defaultCfg(), supply: 3 };
    const a = calcAll([stove({ prio: 'p', phase: 'L1' }), boiler({ prio: 's', phase: 'L2' })], cfg);
    const b = calcAll([stove({ phase: 'L1' }), boiler({ phase: 'L2' })], cfg);
    expect(a.phases).toEqual(b.phases);
    const rows = calcAll([stove({ prio: 'p', phase: 'L1' }), boiler({ prio: 's', phase: 'L1' })], cfg).rows;
    expect(prioPlan(rows).ph.L1).toBeCloseTo(rows[1].r.I, 5);
  });

  it('adds a relay and a contactor per shed group to the panel and the specification', () => {
    const a = calcAll([stove({ prio: 'p' }), boiler({ prio: 's' }), floor({ prio: 's' })], defaultCfg());
    const prio = a.devs.filter(d => d.kind === 'prio');
    expect(prio.map(d => d.label)).toEqual(['РПН', 'КМ' + contactorIn(a.rows[1].r.In ?? 0), 'КМ' + contactorIn(a.rows[2].r.In ?? 0)]);
    const spec = buildSpec(a).map(i => i.name);
    expect(spec).toContain('Реле приоритета нагрузки');
    expect(spec.some(n => n.startsWith('Контактор модульный 2P'))).toBe(true);
    expect(contactorIn(10)).toBe(16);
    expect(contactorIn(33)).toBe(40);
    expect(contactorIn(500)).toBe(100);
  });

  it('never raises the power or the input current', () => {
    fc.assert(
      fc.property(fc.integer({ min: 500, max: 9000 }), fc.integer({ min: 500, max: 4000 }), fc.constantFrom(1, 3), (pw, sw, supply) => {
        const cfg = { ...defaultCfg(), supply };
        const lines = [mkLine('А', 'power', 5, [['Плита', pw, 1]]), mkLine('Б', 'power', 5, [['Водонагреватель', sw, 1]])];
        const plain = calcAll(lines, cfg);
        const pr = calcAll([{ ...lines[0], prio: 'p' }, { ...lines[1], prio: 's' }], cfg);
        expect(pr.P).toBeLessThanOrEqual(plain.P + 1e-9);
        expect(pr.Itot).toBeLessThanOrEqual(plain.Itot + 1e-9);
        expect(pr.P).toBeGreaterThanOrEqual(Math.max(plain.rows[0].r.pd, plain.rows[1].r.pd) * pr.c.ko - 1e-9);
      }),
      { numRuns: 40 }
    );
  });

  it('keeps the marks through normalisation and links', () => {
    const p = proj([stove({ prio: 'p' }), boiler({ prio: 's' }), light()]);
    const back = unpackProject(packProject(p)) as Project;
    expect(back.lines.map(l => l.prio)).toEqual(['p', 's', undefined]);
    const odd = normProject({ cfg: defaultCfg(), lines: [{ ...stove(), prio: 'x' }] }) as Project;
    expect(odd.lines[0].prio).toBeUndefined();
  });

  it('marks the relay as practice in the assumptions and checks', () => {
    expect(assumptions(cfgN(defaultCfg())).some(x => x.name === 'Реле приоритета нагрузки' && x.basis === 'practice')).toBe(true);
    const on = checksOf(calcAll([stove({ prio: 'p' }), boiler({ prio: 's' })], defaultCfg()));
    expect(on.some(c => c.k === 'ok' && c.t.startsWith('Реле приоритета нагрузки'))).toBe(true);
    const half = checksOf(calcAll([stove({ prio: 'p' }), boiler()], defaultCfg()));
    expect(half.some(c => c.k === 'warn' && c.t.startsWith('Реле приоритета не работает'))).toBe(true);
  });
});

describe('Power fit advisor', () => {
  it('stays quiet when the load fits', () => {
    const f = powerFit(proj([light(), boiler()], { alloc: 15 }));
    expect(f.over).toBe(false);
    expect(f.options).toEqual([]);
  });

  it('offers a priority relay that sheds water heater and floor, then more power', () => {
    const p = proj([stove(), boiler(), floor(), light()], { alloc: 6 });
    const f = powerFit(p);
    expect(f.over).toBe(true);
    const prio = f.options.find(o => o.kind === 'prio');
    expect(prio).toBeDefined();
    expect(prio?.set).toEqual({ [p.lines[0].id]: 'p', [p.lines[1].id]: 's', [p.lines[2].id]: 's' });
    expect(prio?.text).toContain('«Плита»');
    expect(prio?.P).toBeLessThan(f.P);
    expect(f.options[f.options.length - 1].kind).toBe('alloc');
  });

  it('stops shedding once the load fits', () => {
    const p = proj([stove(), boiler(), floor(), light()], { alloc: 8 });
    const prio = powerFit(p).options.find(o => o.kind === 'prio');
    expect(prio?.fits).toBe(true);
    expect(Object.values(prio?.set ?? {}).filter(v => v === 's')).toHaveLength(1);
  });

  it('suggests three phases when a single phase carries more than 12 kW', () => {
    const big = mkLine('Котёл', 'power', 6, [['Электрокотёл', 9000, 1]]);
    const p = proj([big, stove(), light()], { alloc: 20 });
    const f = powerFit(p);
    expect(f.over).toBe(true);
    expect(isOver(calcAll(p.lines, p.cfg, p))).toBe(false);
    const three = f.options.find(o => o.kind === 'three');
    expect(three?.supply).toBe(3);
    expect(three?.text).toContain('п. 9.12');
    expect(f.options.some(o => o.kind === 'prio' || o.kind === 'alloc')).toBe(false);
  });

  it('asks for enough power rounded up to half a kilowatt', () => {
    const p = proj([stove(), light()], { alloc: 5 });
    const f = powerFit(p);
    const alloc = f.options.find(o => o.kind === 'alloc');
    expect(alloc?.alloc).toBe(Math.ceil(f.P / 500) / 2);
    expect(alloc?.alloc).toBeGreaterThanOrEqual(f.P / 1000);
  });

  it('names the marked groups', () => {
    expect(prioNames(proj([stove({ prio: 'p' }), boiler({ prio: 's' }), light()]))).toEqual({ p: ['Плита'], s: ['Бойлер'] });
  });
});
