import { describe, expect, it } from 'vitest';
import { appBr, appW, calcAll, cfgN, layout, pack, zoneOf } from '../../core/calc';
import { defaultCfg, mkLine, sample } from '../../core/templates';
import { buildSpec } from '../../core/spec';
import { inCableName, protFull, protName, uzoName } from '../../core/protection';
import { reportText } from '../../core/report';
import { sampleProject } from '../../core/project';
import { autoQty } from '../../core/labor';
import { ROOM_PRESETS, assemble, makeRoom } from '../../core/rooms';
import type { Cfg, Line } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), prot: 'rcbo', ...o });
const z = (l: Line, zone: string): Line => ({ ...l, zone });

describe('config normalisation', () => {
  it('picks the junction box by laying method unless set explicitly', () => {
    expect(cfgN(cfg()).box).toBe('brick');
    expect(cfgN(cfg({ method: 'open' })).box).toBe('surface');
    expect(cfgN(cfg({ method: 'open' })).boxAuto).toBe(true);
    const g = cfgN(cfg({ box: 'gkl' }));
    expect(g.box).toBe('gkl');
    expect(g.boxAuto).toBe(false);
    expect(cfgN(cfg({ box: 'weird' })).boxAuto).toBe(true);
  });
  it('reads the protection mode and the input cable brand', () => {
    expect(cfgN(cfg()).rcdMode).toBe(false);
    expect(cfgN(cfg({ prot: 'rcd' })).rcdMode).toBe(true);
    expect(cfgN(defaultCfg()).rcdMode).toBe(true);
    expect(cfgN(cfg({ inCable: 'nym' })).inCable).toBe('nym');
    expect(cfgN(cfg({ inCable: 'frls' })).inCable).toBe('frls');
    expect(cfgN(cfg({ inCable: 'x' })).inCable).toBe('vvg');
  });
});

describe('appliance helpers', () => {
  it('multiplies power by strip length and count', () => {
    expect(appW({ id: 'a', name: 'LED', w: 14, n: 2, m: 5 })).toBe(140);
    expect(appW({ id: 'a', name: 'Лампа', w: 60, n: 3 })).toBe(180);
    expect(appW({ id: 'a', name: 'x', w: -5, n: 1 })).toBe(0);
    expect(appBr({ id: 'a', name: 'x', w: 1, n: 1, br: '4' })).toBe(4);
    expect(appBr({ id: 'a', name: 'x', w: 1, n: 1 })).toBe(0);
  });
  it('falls back to a default zone', () => {
    expect(zoneOf(mkLine('a', 'light', 1, []))).toBe('Без помещения');
    expect(zoneOf({ ...mkLine('a', 'light', 1, []), zone: '  Кухня ' })).toBe('Кухня');
  });
});

describe('group load without demand factor', () => {
  it('sums all appliances and sockets with no Кс or cos', () => {
    const l = { ...mkLine('Р', 'socket', 10, [['Чайник', 2000, 1]]), sockets: 4, perSocket: 100 };
    const r = calcAll([l], cfg()).rows[0].r;
    expect(r.pInst).toBe(2400);
    expect(r.pd).toBe(2400);
    expect(r.cos).toBe(1);
    expect(r.I).toBeCloseTo(2400 / 230, 5);
    expect(r.sockets).toBe(4);
  });
  it('counts sockets only for socket groups', () => {
    const l = { ...mkLine('С', 'light', 10, [['Лампа', 100, 1]]), sockets: 4, perSocket: 100 };
    const r = calcAll([l], cfg()).rows[0].r;
    expect(r.pInst).toBe(100);
    expect(r.sockets).toBe(0);
  });
  it('treats sockets alone as load', () => {
    const l = { ...mkLine('Р', 'socket', 10, []), sockets: 5, perSocket: 300 };
    const r = calcAll([l], cfg()).rows[0].r;
    expect(r.empty).toBe(false);
    expect(r.pInst).toBe(1500);
  });
});

describe('junction boxes and branches', () => {
  const branched = (): Line => {
    const l = mkLine('Свет', 'light', 12, [['Люстра', 100, 1], ['Бра', 40, 2]]);
    l.apps[0].br = 3;
    l.apps[1].br = 5;
    return l;
  };
  it('checks the farthest point and buys cable for every branch', () => {
    const r = calcAll([branched()], cfg()).rows[0].r;
    expect(r.len).toBe(17);
    expect(r.cable).toBe(12 + 3 + 5 * 2);
  });
  it('ignores branches of empty appliances', () => {
    const l = branched();
    l.apps[1].w = 0;
    const r = calcAll([l], cfg()).rows[0].r;
    expect(r.len).toBe(15);
    expect(r.cable).toBe(15);
  });
  it('lists boxes of the chosen type in the bill of materials', () => {
    const a = calcAll([branched(), mkLine('Б', 'power', 5, [['Бойлер', 2000, 1]])], cfg({ box: 'gkl' }));
    expect(a.boxes).toBe(1);
    const box = buildSpec(a).find(i => i.name.startsWith('Коробка'));
    expect(box?.name).toBe('Коробка распределительная для гипсокартона');
    expect(box?.n).toBe(1);
    const cab = buildSpec(a).find(i => i.name.includes('3×1,5'));
    expect(cab?.n).toBe(Math.ceil(25 * 1.1));
  });
  it('skips boxes when there are no branches', () => {
    const a = calcAll(sample().lines.map(l => ({ ...l, apps: l.apps.map(x => ({ ...x, br: undefined })) })), cfg());
    expect(a.boxes).toBe(0);
    expect(calcAll(sample().lines, cfg()).boxes).toBe(2);
    expect(buildSpec(a).some(i => i.name.startsWith('Коробка'))).toBe(false);
  });
});

describe('residual-current devices per room', () => {
  const lines = (): Line[] => [
    z(mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), 'Комнаты'),
    z(mkLine('Розетки', 'socket', 10, [['ТВ', 1500, 1]]), 'Комнаты'),
    z({ ...mkLine('Стиралка', 'power', 8, [['Стиральная машина', 2200, 1]]), wet: true }, 'Ванная'),
    mkLine('Без зоны', 'power', 8, [['Бойлер', 2000, 1]]),
    mkLine('Пустая', 'socket', 8, [])
  ];
  it('keeps one RCBO per group by default', () => {
    const a = calcAll(lines(), cfg());
    expect(a.uzos).toEqual([]);
    expect(a.rows[0].r.rcbo).toBe(true);
    expect(a.rows[0].r.zone).toBe('');
    expect(a.devs.filter(d => d.kind === 'rcd').length).toBe(4);
    expect(a.rows[0].r.mod).toBe(2);
  });
  it('groups circuits under one RCD per room with plain breakers', () => {
    const a = calcAll(lines(), cfg({ prot: 'rcd' }));
    expect(a.uzos.map(u => u.zone)).toEqual(['Комнаты', 'Ванная', 'Без помещения']);
    const [rooms, bath, none] = a.uzos;
    expect(rooms.groups).toEqual([0, 1]);
    expect(rooms.ma).toBe(30);
    expect(bath.ma).toBe(10);
    expect(none.groups).toEqual([3]);
    expect(rooms.In).toBeGreaterThanOrEqual(Math.min(rooms.sumIn, a.inIn as number));
    expect(a.rows[0].r.rcbo).toBe(false);
    expect(a.rows[0].r.mod).toBe(1);
    expect(a.rows[0].r.uzo).toBe(0);
    expect(a.rows[2].r.uzo).toBe(1);
    expect(a.rows[2].r.ma).toBe(10);
    expect(a.rows[4].r.uzo).toBeNull();
    expect(protName(a.rows[0].r)).not.toContain('мА');
    expect(protFull(a.rows[0].r)).not.toContain('Дифавтомат');
  });
  it('places each RCD before its breakers on the rail', () => {
    const a = calcAll(lines(), cfg({ prot: 'rcd' }));
    const kinds = a.devs.map(d => d.kind + (d.zone ? ':' + d.zone : ''));
    expect(kinds).toEqual(['in', 'uzo:Комнаты', 'mcb:Комнаты', 'mcb:Комнаты', 'uzo:Ванная', 'mcb:Ванная', 'uzo:Без помещения', 'mcb:Без помещения']);
    const u = a.devs[1];
    expect(u.mod).toBe(2);
    expect(u.label).toMatch(/^\d+А$/);
    expect(u.sub).toBe('30мА');
  });
  it('caps the RCD rating by the input breaker but not below the largest group', () => {
    const big = [
      z(mkLine('A', 'power', 5, [['a', 7000, 1]]), 'Кухня'),
      z(mkLine('B', 'power', 5, [['b', 7000, 1]]), 'Кухня'),
      z(mkLine('C', 'power', 5, [['c', 7000, 1]]), 'Кухня')
    ];
    const a = calcAll(big, cfg({ prot: 'rcd' }));
    const u = a.uzos[0];
    expect(u.sumIn).toBe(96);
    expect(u.In).toBe([16, 25, 40, 63, 80, 100].find(x => x >= Math.max(32, Math.min(96, a.inIn as number))));
  });
  it('keeps 30 mA when every group in the room is above 32 A', () => {
    const a = calcAll([z(mkLine('A', 'power', 5, [['a', 9000, 1]]), 'Кухня')], cfg({ prot: 'rcd' }));
    expect(a.uzos[0].ma).toBe(30);
  });
  it('uses four-pole RCDs for three-phase rooms', () => {
    const ls = [z({ ...mkLine('A', 'power', 5, [['a', 9000, 1]]), phase: '3' as const }, 'Кухня'), z({ ...mkLine('B', 'light', 5, [['b', 100, 1]]), phase: 'L2' as const }, 'Зал'), z({ ...mkLine('C', 'socket', 5, [['c', 100, 1]]), phase: 'L2' as const }, 'Зал')];
    const a = calcAll(ls, cfg({ prot: 'rcd', supply: 3 }));
    expect(a.uzos[0].four).toBe(true);
    expect(a.uzos[1].four).toBe(false);
    expect(a.devs.find(d => d.kind === 'uzo')?.mod).toBe(4);
    expect(uzoName(a.uzos[0])).toMatch(/^УЗО 4P \d+ А \d+ мА$/);
  });
  it('warns when the summed leakage of a room is too high', () => {
    const ls = [1, 2, 3, 4].map(i => z(mkLine('Г' + i, 'light', 300, [['a', 100, 1]]), 'Дом'));
    const a = calcAll(ls, cfg({ prot: 'rcd' }));
    const I = a.rows.reduce((s, x) => s + x.r.I, 0);
    expect(a.uzos[0].leak).toBeCloseTo(12 + I * 0.4, 5);
    expect(a.rows[0].r.tips.join(' ')).toContain('Оценка суммарной утечки групп на УЗО «Дом»');
    expect(a.rows[0].r.notes.join(' ')).not.toContain('Суммарная утечка');
    const m = calcAll(ls.map(l => ({ ...l, meas: { leak: 3 } })), cfg({ prot: 'rcd' }));
    expect(m.uzos[0].leak).toBeCloseTo(12, 5);
    expect(m.rows[0].r.notes.join(' ')).toContain('Суммарная утечка групп на УЗО «Дом» по замерам');
    expect(m.rows[0].r.status).not.toBe('ok');
  });
  it('lists RCDs and separate neutral buses in the bill of materials', () => {
    const a = calcAll(lines(), cfg({ prot: 'rcd' }));
    const spec = buildSpec(a);
    const n = spec.find(i => i.name.startsWith('Шина N'));
    expect(n?.n).toBe(3);
    expect(n?.note).toBe('своя на каждое УЗО: Комнаты, Ванная, Без помещения');
    expect(spec.filter(i => i.name.startsWith('УЗО')).length).toBeGreaterThan(0);
    const one = buildSpec(calcAll(lines(), cfg())).find(i => i.name.startsWith('Шина N'));
    expect(one?.n).toBe(1);
    expect(one?.note).toBe('');
  });
});

describe('input cable', () => {
  it('names the input cable brand and cores', () => {
    expect(inCableName(cfgN(cfg()), 10)).toBe('ВВГнг(А)-LS 3×10');
    expect(inCableName(cfgN(cfg({ supply: 3, inCable: 'frls' })), 6)).toBe('ВВГнг(А)-FRLS 5×6');
    const a = calcAll(sample().lines, cfg({ inCable: 'nym' }));
    expect(buildSpec(a).some(i => i.name.startsWith('NYM 3×'))).toBe(true);
  });
  it('appears in the text report together with the protection mode', () => {
    const p = sampleProject();
    p.cfg = { ...p.cfg, prot: 'rcd', inCable: 'frls' };
    const t = reportText(p, calcAll(p.lines, p.cfg));
    expect(t).toContain('ВВГнг(А)-FRLS');
    expect(t).toContain('УЗО');
  });
});

describe('labour quantities', () => {
  it('takes socket points from the socket count when set', () => {
    const l = { ...mkLine('Р', 'socket', 10, [['ТВ', 100, 1]]), sockets: 7 };
    expect(autoQty(calcAll([l], cfg())).socket).toBe(7);
    const m = { ...mkLine('Р', 'socket', 10, [['ТВ', 100, 2]]) };
    expect(autoQty(calcAll([m], cfg())).socket).toBe(2);
  });
});

describe('rooms to zones', () => {
  it('assigns each assembled group to a zone', () => {
    const ls = assemble([ROOM_PRESETS[0], ROOM_PRESETS[4]].map(makeRoom));
    expect(ls.length).toBeGreaterThan(0);
    const zs = new Set(ls.map(l => l.zone));
    expect(zs.has('Кухня')).toBe(true);
    expect(zs.has('Ванная')).toBe(true);
  });
});

describe('board layout', () => {
  const dev = (kind: 'in' | 'uzo' | 'mcb', mod: number, zone?: string) => ({ kind, mod, label: '', sub: '', title: '', zone, lid: kind === 'mcb' ? Math.random().toString() : undefined });
  it('moves an RCD to the next row together with its breakers', () => {
    const devs = [dev('in', 2), dev('uzo', 2, 'A'), dev('mcb', 1, 'A'), dev('mcb', 1, 'A'), dev('uzo', 2, 'B'), dev('mcb', 1, 'B'), dev('mcb', 1, 'B')];
    const s = layout(devs, 9);
    expect(s.map(x => x.row)).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(s[4].col).toBe(0);
    expect(pack(devs, 9)).toBe(13);
  });
  it('splits an RCD block that is wider than a row', () => {
    const devs = [dev('uzo', 2, 'A'), ...Array.from({ length: 12 }, () => dev('mcb', 1, 'A'))];
    const s = layout(devs, 12);
    expect(s[0]).toEqual({ row: 0, col: 0 });
    expect(s[11]).toEqual({ row: 1, col: 0 });
  });
  it('keeps the sample board on one row per room', () => {
    const a = calcAll(sample().lines, cfg({ prot: 'rcd' }));
    const s = layout(a.devs, 18);
    a.devs.forEach((d, i) => {
      if (d.kind === 'mcb') {
        const u = a.devs.findIndex(x => x.kind === 'uzo' && x.zone === d.zone);
        expect(s[i].row).toBe(s[u].row);
      }
    });
  });
});
