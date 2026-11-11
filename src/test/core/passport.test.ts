import { describe, expect, it } from 'vitest';
import { passportInput, passportRows, watts } from '../../core/passport';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { sampleProject, normProject } from '../../core/project';
import { OWNER_PREFIX, ownerUrl, packProject, readOwnerHash, unpackProject } from '../../core/share';
import type { Line } from '../../core/types';

const line = (name: string, apps: [string, number, number][], extra: Partial<Line> = {}): Line => ({
  ...mkLine(name, extra.type ?? 'socket', 10, apps, extra.phase),
  ...extra
});

describe('passportRows', () => {
  it('skips empty groups and numbers the rest by position', () => {
    const a = calcAll([line('Пустая', []), line('Кухня', [['Чайник', 2200, 1]])], defaultCfg());
    const rows = passportRows(a);
    expect(rows).toHaveLength(1);
    expect(rows[0].no).toBe('Г2');
    expect(rows[0].name).toBe('Кухня');
  });
  it('lists the heaviest appliances first, at most three, with counts', () => {
    const a = calcAll([line('Г', [['Лампа', 10, 1], ['Чайник', 2000, 1], ['Тостер', 800, 2], ['Радио', 20, 1]])], defaultCfg());
    const r = passportRows(a)[0];
    expect(r.heavy.map(h => h.name)).toEqual(['Чайник', 'Тостер', 'Радио']);
    expect(r.heavy[1].watts).toBe(1600);
  });
  it('ignores unnamed or zero-power appliances', () => {
    const a = calcAll([line('Г', [['', 500, 1], ['Нуль', 0, 1], ['Фен', 1500, 1]])], defaultCfg());
    expect(passportRows(a)[0].heavy.map(h => h.name)).toEqual(['Фен']);
  });
  it('warns about simultaneous use only when the sum exceeds the limit', () => {
    const light = passportRows(calcAll([line('Г', [['Лампа', 60, 1], ['Радио', 20, 1]])], defaultCfg()))[0];
    expect(light.together).toBeNull();
    const hc = calcAll([line('Г', [['Духовка', 3500, 1], ['Чайник', 2200, 1], ['Тостер', 900, 1]])], defaultCfg());
    hc.rows[0].r.In = 16;
    const heavy = passportRows(hc)[0];
    expect(heavy.totalW).toBeGreaterThan(heavy.capW);
    expect(heavy.together).toBe('Духовка и Чайник');
  });
  it('does not warn for a single appliance', () => {
    const r = passportRows(calcAll([line('Г', [['Духовка', 3500, 1]])], defaultCfg()))[0];
    expect(r.together).toBeNull();
  });
  it('rounds the limit to hundreds and scales it for three-phase groups', () => {
    const one = passportRows(calcAll([line('Г', [['Фен', 1000, 1]])], defaultCfg()))[0];
    expect(one.capW % 100).toBe(0);
    const cfg = { ...defaultCfg(), supply: 3 };
    const three = passportRows(calcAll([line('Г', [['Печь', 9000, 1]], { type: 'power', phase: '3' })], cfg))[0];
    expect(three.capW).toBeGreaterThan(one.capW);
  });
  it('trims and returns the room', () => {
    const r = passportRows(calcAll([line('Г', [['Фен', 1000, 1]], { zone: '  Ванная  ' })], defaultCfg()))[0];
    expect(r.room).toBe('Ванная');
    const none = passportRows(calcAll([line('Г', [['Фен', 1000, 1]])], defaultCfg()))[0];
    expect(none.room).toBe('');
  });
  it('flags residual-current protection', () => {
    const rows = passportRows(calcAll(sampleProject().lines, sampleProject().cfg));
    expect(rows.some(r => r.rcd)).toBe(true);
    expect(rows.every(r => r.prot.length > 0)).toBe(true);
  });
});

describe('passportInput', () => {
  it('describes the input breaker and the load', () => {
    const p = sampleProject();
    const i = passportInput(calcAll(p.lines, p.cfg));
    expect(i.text).toMatch(/^Вводной автомат 2P C\d+$/);
    expect(i.pKw).toBeGreaterThan(0);
    expect(i.allocKw).toBe(p.cfg.alloc);
  });
  it('says so when no breaker is chosen and names 4P for three phases', () => {
    expect(passportInput(calcAll([], defaultCfg())).text).toBe('Вводной автомат не подобран');
    const p = sampleProject();
    const a = calcAll(p.lines, { ...p.cfg, supply: 3 });
    expect(passportInput(a).text).toMatch(/^Вводной автомат 4P/);
  });
  it('formats watts', () => {
    expect(watts(1500)).toMatch(/1.?500 Вт/);
  });
});

describe('owner link', () => {
  const p = sampleProject();
  it('builds and reads the hash', () => {
    const u = ownerUrl(p, 'https://x.test/a#p=old');
    expect(u.startsWith('https://x.test/a' + OWNER_PREFIX)).toBe(true);
    expect(readOwnerHash(u.slice(u.indexOf('#')))).not.toBeNull();
    expect(readOwnerHash('#o=')).toBeNull();
    expect(readOwnerHash('#p=abc')).toBeNull();
  });
  it('keeps the group room through the link', () => {
    const q = { ...p, lines: p.lines.map((l, i) => ({ ...l, zone: i === 0 ? 'Кухня' : undefined })) };
    const back = unpackProject(packProject(q));
    expect(back!.lines[0].zone).toBe('Кухня');
    expect(back!.lines[1].zone).toBeUndefined();
  });
  const old = (prot: string, lines: Record<string, unknown>[]) => normProject({ ...p, schema: undefined, cfg: { ...p.cfg, prot }, lines: p.lines.slice(0, lines.length).map((l, i) => ({ ...l, zone: undefined, ...lines[i] })) });
  it('moves an old location into an empty room when rooms do not drive the RCDs', () => {
    const q = old('rcbo', [{ where: '  Прихожая ' }, { where: 'я'.repeat(200) }, { where: 'Коридор', zone: 'Кухня' }, { where: '   ' }]);
    expect(q!.lines.map(l => l.zone)).toEqual(['Прихожая', 'я'.repeat(60), 'Кухня', undefined]);
    expect(q!.lines.every(l => !('where' in l))).toBe(true);
  });
  it('spells a moved location like a room already in the project', () => {
    const q = old('rcbo', [{ zone: 'Кухня' }, { where: ' кухня ' }]);
    expect(q!.lines.map(l => l.zone)).toEqual(['Кухня', 'Кухня']);
  });
  it('drops an old location without touching rooms when they drive the RCDs', () => {
    const q = old('rcd', [{ where: 'Прихожая' }, { where: 'Коридор', zone: 'Кухня' }]);
    expect(q!.lines.map(l => l.zone)).toEqual([undefined, 'Кухня']);
    expect(q!.lines.every(l => !('where' in l))).toBe(true);
  });
});
