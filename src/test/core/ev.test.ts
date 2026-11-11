import { describe, expect, it } from 'vitest';
import { calcAll, cfgN } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { newProject } from '../../core/project';
import { isOver, powerFit } from '../../core/powerfit';
import { EV_MIN_A, isEvLine } from '../../core/ev';
import { assumptions } from '../../core/assumptions';
import { PRESETS } from '../../core/norms';
import { cur, init, reducer } from '../../store/reducer';
import type { Cfg, Line, Project } from '../../core/types';

const ev = (w = 7400, o: Partial<Line> = {}): Line => ({ ...mkLine('Зарядка', 'power', 20, [['Зарядка электромобиля', w, 1]]), ...o });
const stove = (): Line => mkLine('Плита', 'power', 8, [['Электроплита', 7000, 1]]);
const proj = (lines: Line[], cfg: Partial<Cfg> = {}): Project => newProject({ sample: false, cfg: { ...defaultCfg(), ...cfg }, lines }, 'Дом');
const row = (l: Line, cfg: Partial<Cfg> = {}) => calcAll([l], { ...defaultCfg(), ...cfg }).rows[0].r;

describe('Home EV charging group', () => {
  it('is in the catalog and recognised by name', () => {
    expect(PRESETS.some(p => p[0] === 'Зарядка электромобиля' && p[1] === 7400)).toBe(true);
    expect(isEvLine(ev())).toBe(true);
    expect(isEvLine(mkLine('Гараж', 'power', 5, [['Wallbox', 11000, 1]]))).toBe(true);
    expect(isEvLine(stove())).toBe(false);
  });

  it('asks for type A protection with DC leakage control on a clean group', () => {
    const r = row(ev());
    expect(r.rcdA).toBe(true);
    expect(r.status).toBe('ok');
    expect(r.tips.join(' ')).toContain('постоянного тока утечки 6 мА');
    expect(r.tips.join(' ')).toContain('Вне помещения');
    expect(row(ev(7400, { out: true })).tips.join(' ')).not.toContain('Вне помещения');
  });

  it('wants its own group', () => {
    const shared = ev(7400, { apps: [...ev().apps, ...mkLine('x', 'power', 1, [['Компрессор', 800, 1]]).apps] });
    const r = row(shared);
    expect(r.status).not.toBe('ok');
    expect(r.notes.join(' ')).toContain('отдельной группой');
    const two = row(ev(3700, { apps: [...ev(3700).apps, ...ev(3700).apps] }));
    expect(two.notes.join(' ')).toContain('отдельной группой');
  });

  it('needs three phases above 7.4 kW', () => {
    expect(row(ev(11000)).notes.join(' ')).toContain('трёхфазная');
    const three = row(ev(11000, { phase: '3' }), { supply: 3 });
    expect(three.three).toBe(true);
    expect(three.notes.join(' ')).not.toContain('трёхфазная');
  });

  it('warns that «not at the same time» understates a charger', () => {
    const l = ev();
    l.apps[0].alt = true;
    expect(row(l).tips.join(' ')).toContain('«Не одновременно»');
  });

  it('lists the charging rules among the assumptions only when there is a charger', () => {
    const c = cfgN(defaultCfg());
    expect(assumptions(c).some(a => a.name === 'Зарядка электромобиля')).toBe(false);
    const a = assumptions(c, { ev: true }).find(x => x.name === 'Зарядка электромобиля');
    expect(a?.basis).toBe('practice');
    expect(a?.value).toContain(EV_MIN_A + ' А');
  });
});

describe('Limiting the charging current to fit the allocation', () => {
  it('finds the largest current that fits and offers it first', () => {
    const p = proj([stove(), ev()], { alloc: 9 });
    const a = calcAll(p.lines, p.cfg, p);
    expect(isOver(a)).toBe(true);
    const fit = powerFit(p, a);
    const o = fit.options[0];
    expect(o.kind).toBe('ev');
    expect(o.fits).toBe(true);
    expect(o.ev?.line).toBe(p.lines[1].id);
    const amps = Math.round((o.ev?.w ?? 0) / 230);
    expect(amps).toBeGreaterThanOrEqual(EV_MIN_A);
    expect(amps).toBeLessThan(32);
    expect(o.text).toContain(amps + ' А');
    const bigger = p.lines.map(l => (l.id === o.ev?.line ? { ...l, apps: l.apps.map(x => ({ ...x, w: (amps + 1) * 230 })) } : l));
    expect(isOver(calcAll(bigger, p.cfg, p))).toBe(true);
  });

  it('works for a three-phase charger', () => {
    const p = proj([mkLine('Плита', 'power', 8, [['Электроплита', 9000, 1]]), ev(11000, { phase: '3' })], { alloc: 12, supply: 3 });
    const o = powerFit(p).options.find(x => x.kind === 'ev');
    expect(o).toBeTruthy();
    expect((o?.ev?.w ?? 0) / (Math.sqrt(3) * 400)).toBeGreaterThanOrEqual(EV_MIN_A - 0.1);
  });

  it('gives up when even the minimum current does not fit', () => {
    const p = proj([mkLine('Плита', 'power', 8, [['Электроплита', 12000, 1]]), ev()], { alloc: 6 });
    expect(powerFit(p).options.some(o => o.kind === 'ev')).toBe(false);
  });

  it('skips empty groups and stays silent without a charger', () => {
    const p = proj([stove(), mkLine('Пусто', 'power', 5, []), mkLine('Насос', 'power', 5, [['Насос', 3000, 1]])], { alloc: 5 });
    expect(powerFit(p).options.some(o => o.kind === 'ev')).toBe(false);
  });

  it('applies the new charger power through the reducer', () => {
    const p = proj([stove(), ev()], { alloc: 9 });
    const s0 = init({ list: [p], cur: p.id });
    const app = p.lines[1].apps[0].id;
    const s1 = reducer(s0, { t: 'appPower', line: p.lines[1].id, app, w: 4600 });
    expect(cur(s1).lines[1].apps[0].w).toBe(4600);
    expect(cur(s1).lines[0]).toEqual(p.lines[0]);
  });
});
