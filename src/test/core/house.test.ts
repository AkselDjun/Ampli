import { describe, expect, it } from 'vitest';
import { calcAll, cfgN } from '../../core/calc';
import { defaultCfg, mkLine, contentFor, tplLines } from '../../core/templates';
import { houseChecks, houseSpec, pickSip, SIP_DROP_MAX } from '../../core/house';
import { buildSpec } from '../../core/spec';
import { assumptions } from '../../core/assumptions';
import { checksOf } from '../../ui/Checks';
import { cur, init, reducer } from '../../store/reducer';
import { newProject } from '../../core/project';
import type { Cfg, Line } from '../../core/types';

const house = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), prot: 'rcbo', obj: 'house', spd: 'on', sip: 20, rz: 12, zs: 0.8, ...o });
const lamp = (o: Partial<Line> = {}): Line => ({ ...mkLine('Свет', 'light', 10, [['Лампа', 200, 1]]), ...o });
const kinds = (cfg: Cfg, lines: Line[]) => houseChecks(calcAll(lines, cfg));

describe('private house mode', () => {
  it('reads the house settings and keeps a flat by default', () => {
    expect(cfgN(house({ sip: 'x', rz: '' }))).toMatchObject({ house: true, sip: 0, rz: null });
    expect(cfgN(house({ sip: 900, rz: '4,5' }))).toMatchObject({ sip: 500, rz: 4.5 });
    expect(calcAll([lamp()], { ...defaultCfg() }).house).toBeUndefined();
    expect(houseChecks(calcAll([lamp()], defaultCfg()))).toEqual([]);
    expect(houseSpec(calcAll([lamp()], defaultCfg()))).toEqual([]);
  });

  it('picks the smallest SIP that carries the input breaker and keeps the drop within limit', () => {
    const one = cfgN(house());
    expect(pickSip(one, 20, 25, 20)).toMatchObject({ S: 16, cores: 2, name: 'СИП-4 2×16' });
    const far = pickSip(one, 40, 50, 30);
    expect(far.S).toBeGreaterThan(16);
    expect(far.drop).toBeLessThanOrEqual(SIP_DROP_MAX);
    expect(pickSip(cfgN(house({ supply: 3 })), 30, 40, 20)).toMatchObject({ S: 16, cores: 4 });
    expect(pickSip(one, 150, 160, 400).S).toBe(35);
    expect(pickSip(one, 200, 250, 10)).toMatchObject({ S: null, name: 'СИП-4 2×?', drop: 0 });
  });

  it('checks SIP, PEN, grounding, SPD and the network loop', () => {
    const ok = kinds(house(), [lamp()]);
    expect(ok.every(x => x.k === 'ok')).toBe(true);
    expect(ok.map(x => x.t).join(' ')).toContain('PEN разделяется');
    expect(ok[0].t).toMatch(/^Ввод от опоры СИП-4 2×16 мм², 20 м: потеря напряжения \d,\d %/);
    const bad = kinds(house({ spd: '', rz: 45, zs: 0.3, sip: 0 }), [lamp()]);
    expect(bad.find(x => x.t.startsWith('Длина ввода СИП'))?.k).toBe('warn');
    expect(bad.find(x => x.t.startsWith('Повторное заземление 45'))?.k).toBe('bad');
    expect(bad.find(x => x.t.startsWith('Воздушный ввод без УЗИП'))?.fix).toBe('net');
    expect(bad.find(x => x.t.startsWith('Петля сети 0,30'))?.k).toBe('warn');
    expect(kinds(house({ rz: '' }), [lamp()]).find(x => x.t.includes('не измерено'))?.k).toBe('warn');
    const a = calcAll([lamp()], house());
    const huge = houseChecks({ ...a, Itot: 250, inIn: 250, house: { ...a.house!, sip: { ...a.house!.sip, S: null } } });
    expect(huge[0].k).toBe('bad');
    expect(huge[0].t).toContain('250 А');
    const far = kinds(house({ sip: 500 }), [mkLine('Печь', 'power', 5, [['Печь', 7000, 1]])]);
    expect(far[0].k).toBe('warn');
    expect(far[0].fix).toBe('net');
  });

  it('marks outdoor groups and a boiler sharing a group', () => {
    const lines = [
      lamp({ out: true, name: 'Двор' }),
      mkLine('Котёл', 'power', 8, [['Газовый котёл', 200, 1], ['Чайник', 2000, 1]])
    ];
    const a = calcAll(lines, house());
    expect(a.house?.outdoor).toEqual(['Г1']);
    expect(a.house?.boilers).toEqual(['Г2']);
    expect(a.rows[0].r.tips.join(' ')).toContain('трубе ПНД');
    expect(a.rows[1].r.tips.join(' ')).toContain('Котёл: отдельная группа');
    const list = houseChecks(a);
    expect(list.find(x => x.t.startsWith('Уличные группы Г1'))?.k).toBe('ok');
    const shared = list.find(x => x.t.startsWith('Котёл на общей группе'));
    expect(shared?.groups).toEqual([lines[1].id]);
    expect(calcAll(lines, { ...defaultCfg(), prot: 'rcbo' }).rows[0].r.tips.join(' ')).not.toContain('ПНД');
  });

  it('flags outdoor groups left without an RCD', () => {
    const a = calcAll([lamp({ out: true })], house({ prot: 'rcbo' }));
    const fake = { ...a, rows: a.rows.map(x => ({ ...x, r: { ...x.r, rcd: false } })) };
    const bad = houseChecks(fake).find(x => x.t.startsWith('Уличные группы без УЗО'));
    expect(bad?.k).toBe('bad');
    expect(bad?.groups).toEqual([a.rows[0].l.id]);
  });

  it('adds the input, PEN split and grounding to the specification', () => {
    const a = calcAll([lamp()], house());
    const names = buildSpec(a).map(x => x.name);
    expect(names).toContain('СИП-4 2×16 мм²');
    expect(names).toContain('УЗИП тип 1+2 1P+N');
    expect(names).toContain('Перемычка разделения PEN на шинах PE и N');
    expect(names).toContain('Электрод заземления, уголок 50×50×5, 3 м');
    expect(houseSpec(a).find(x => x.name.startsWith('СИП'))?.n).toBe(21);
    expect(houseSpec(calcAll([lamp()], house({ sip: 0 })))[0].qty).toBe('по месту');
    expect(a.devs.find(d => d.kind === 'spd')?.sub).toBe('тип 1+2');
    expect(assumptions(a.c).map(x => x.name)).toEqual(expect.arrayContaining(['Ввод в дом', 'Разделение PEN', 'Повторное заземление']));
    expect(assumptions(cfgN(defaultCfg())).map(x => x.name)).not.toContain('Ввод в дом');
    expect(checksOf(a).some(x => x.t.includes('PEN'))).toBe(true);
  });

  it('builds the house template as a three phase project with outdoor groups', () => {
    const c = contentFor('house', false);
    expect(c.cfg).toMatchObject({ obj: 'house', supply: 3, spd: 'on' });
    expect(c.lines.filter(l => l.out).length).toBe(3);
    expect(new Set(c.lines.map(l => l.phase)).size).toBe(3);
    expect(tplLines('house', true).length).toBe(tplLines('house', false).length + 1);
  });

  it('switches a project to a house with SPD and outdoor conditions', () => {
    const p = newProject({ cfg: defaultCfg(), lines: [lamp()], sample: false }, 'Дом');
    let s = init({ cur: p.id, list: [p] });
    s = reducer(s, { t: 'cfg', field: 'obj', value: 'house' });
    expect(cur(s).cfg).toMatchObject({ obj: 'house', spd: 'on', sip: 20 });
    s = reducer(s, { t: 'cfg', field: 'sip', value: '35' });
    s = reducer(s, { t: 'cfg', field: 'obj', value: 'house' });
    expect(cur(s).cfg.sip).toBe('35');
    s = reducer(s, { t: 'cfgStep', field: 'rz', d: 1 });
    expect(cur(s).cfg.rz).toBe(1);
    s = reducer(s, { t: 'lineWet', wet: false, out: true });
    expect(cur(s).lines[0]).toMatchObject({ out: true, wet: false });
    s = reducer(s, { t: 'lineWet', wet: true });
    expect(cur(s).lines[0].out).toBeUndefined();
  });
});
