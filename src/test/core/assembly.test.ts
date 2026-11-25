import { describe, expect, it } from 'vitest';
import { calcAll } from '../../core/calc';
import { BUS_HOLES, assembly, busHoles, wireColor } from '../../core/assembly';
import { buildSpec } from '../../core/spec';
import { defaultCfg, mkLine, sample } from '../../core/templates';
import type { Cfg, Line } from '../../core/types';

const z = (l: Line, zone: string, o: Partial<Line> = {}): Line => ({ ...l, zone, ...o });
const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), ...o });

const flat = (): Line[] => [
  z(mkLine('Свет кухни', 'light', 8, [['Светильник', 60, 2]]), 'Кухня'),
  z(mkLine('Розетки кухни', 'socket', 10, [['Чайник', 2000, 1]]), 'Кухня'),
  z(mkLine('Духовой шкаф', 'power', 9, [['Духовой шкаф', 3500, 1]]), 'Кухня'),
  z(mkLine('Розетки ванной', 'socket', 7, [['Фен', 1800, 1]]), 'Ванная', { wet: true }),
  z(mkLine('Свет комнат', 'light', 12, [['Люстра', 100, 3]]), 'Комнаты')
];

describe('wire colours by ГОСТ 33542-2015 (IEC 60445)', () => {
  it('gives phase, neutral and protective conductors their colours', () => {
    expect(wireColor('L')).toBe('коричневый');
    expect(wireColor('L1')).toBe('коричневый');
    expect(wireColor('L2')).toBe('чёрный');
    expect(wireColor('L3')).toBe('серый');
    expect(wireColor('N')).toBe('синий');
    expect(wireColor('PE')).toBe('жёлто-зелёный');
  });
});

describe('bus size', () => {
  it('takes the nearest standard bus with at least 20 % and one spare hole', () => {
    expect(busHoles(2)).toEqual({ holes: 4, count: 1 });
    expect(busHoles(4)).toEqual({ holes: 6, count: 1 });
    expect(busHoles(7)).toEqual({ holes: 10, count: 1 });
    expect(busHoles(10)).toEqual({ holes: 12, count: 1 });
    expect(BUS_HOLES[BUS_HOLES.length - 1]).toBe(24);
  });
  it('splits a bus that does not fit the biggest size', () => {
    expect(busHoles(30)).toEqual({ holes: 24, count: 2 });
  });
});

describe('assembly with an RCD per room', () => {
  const a = calcAll(flat(), cfg({ prot: 'rcd' }));
  const asm = assembly(a);

  it('gives every RCD its own N bus with a hole per group and one for the RCD', () => {
    const uzoBuses = asm.buses.filter(b => b.kind === 'n' && b.uzo !== undefined);
    expect(uzoBuses).toHaveLength(a.uzos.length);
    a.uzos.forEach((u, k) => {
      const bus = uzoBuses.find(b => b.uzo === k)!;
      expect(bus.name).toContain(u.zone);
      expect(bus.terms).toHaveLength(u.groups.length + 1);
      expect(bus.terms[0]).toContain('УЗО');
    });
  });
  it('feeds the N input of every RCD from the main N bus', () => {
    const main = asm.buses.find(b => b.kind === 'n' && b.uzo === undefined)!;
    expect(main.terms[0]).toBe('N ввода');
    a.uzos.forEach(u => expect(main.terms.some(t => t.includes(u.zone))).toBe(true));
  });
  it('lands every group N on the bus of its RCD and every PE on the PE bus', () => {
    asm.lines.forEach(l => {
      const row = a.rows[l.idx];
      const u = a.uzos[row.r.uzo as number];
      expect(l.n).toBe('Шина N · ' + u.zone);
      expect(l.pe).toBe('Шина PE');
    });
    const pe = asm.buses.find(b => b.kind === 'pe')!;
    expect(pe.terms).toHaveLength(asm.lines.length + 1);
  });
  it('puts one comb under an RCD with two or more breakers on the same rail', () => {
    const kitchen = a.uzos.findIndex(u => u.zone === 'Кухня');
    const comb = asm.rails.flatMap(r => r.combs).find(c => c.from === 'УЗО «Кухня»')!;
    expect(comb.poles).toBe('1P');
    expect(comb.devs).toEqual(a.uzos[kitchen].groups.map(g => 'Г' + (g + 1)));
    expect(comb.mods).toBe(a.uzos[kitchen].groups.reduce((s, g) => s + a.rows[g].r.mod, 0));
  });
  it('feeds a single breaker with a jumper instead of a comb', () => {
    expect(asm.rails.flatMap(r => r.combs).some(c => c.from === 'УЗО «Комнаты»')).toBe(false);
    const w = asm.wires.find(x => x.from === 'УЗО «Комнаты»')!;
    expect(w.to).toBe('Г5');
    expect(w.cores.map(c => c.c)).toEqual(['L']);
  });
  it('feeds every RCD with phase and neutral jumpers of the input section', () => {
    a.uzos.forEach(u => {
      const w = asm.wires.find(x => x.to === 'УЗО «' + u.zone + '»')!;
      expect(w.cores.map(c => c.c)).toEqual(['L', 'N']);
      expect(w.cores.map(c => c.color)).toEqual(['коричневый', 'синий']);
      expect(w.s).toBeGreaterThanOrEqual(4);
    });
  });
  it('lists cable cores and ferrules for every group', () => {
    const oven = asm.lines.find(l => l.name === 'Духовой шкаф')!;
    expect(oven.cores).toBe('L коричневый, N синий, PE жёлто-зелёный');
    expect(oven.ferrule).toBe('НШВИ ' + String(a.rows[oven.idx].r.S).replace('.', ',') + ' мм²');
    expect(oven.cable).toContain('3×');
  });
  it('places every device on a rail in the board order', () => {
    const all = asm.rails.flatMap(r => r.devs.map(d => d.label));
    expect(all).toEqual(a.devs.map(d => d.label));
    asm.rails.forEach(r => expect(r.used).toBeLessThanOrEqual(r.len));
  });
  it('warns not to mix neutrals of different RCDs', () => {
    expect(asm.notes.some(n => /не соединяйте/i.test(n))).toBe(true);
  });
});

describe('assembly with RCBOs', () => {
  const a = calcAll(flat(), cfg({ prot: 'rcbo' }));
  const asm = assembly(a);
  it('lands the group N on the RCBO itself', () => {
    asm.lines.forEach(l => expect(l.n).toBe('на дифавтомат ' + l.g));
  });
  it('uses a two-pole comb for phase and neutral of the RCBOs', () => {
    const combs = asm.rails.flatMap(r => r.combs);
    expect(combs.length).toBeGreaterThan(0);
    combs.forEach(c => expect(c.poles).toBe('2P'));
  });
  it('keeps a single N bus for the input that also feeds the comb', () => {
    const n = asm.buses.filter(b => b.kind === 'n');
    expect(n).toHaveLength(1);
    expect(n[0].terms.some(t => t.startsWith('гребёнка'))).toBe(true);
  });
});

describe('three-phase assembly', () => {
  const lines = [
    z(mkLine('Розетки L1', 'socket', 10, [['Чайник', 2000, 1]], 'L1'), 'Кухня'),
    z(mkLine('Розетки L2', 'socket', 10, [['Чайник', 2000, 1]], 'L2'), 'Кухня'),
    z(mkLine('Плита', 'power', 8, [['Электроплита', 9000, 1]], '3'), 'Кухня')
  ];
  const a = calcAll(lines, cfg({ supply: 3, prot: 'rcd' }));
  const asm = assembly(a);
  it('wires a three-phase group with five coloured cores', () => {
    const stove = asm.lines.find(l => l.name === 'Плита')!;
    expect(stove.cores).toBe('L1 коричневый, L2 чёрный, L3 серый, N синий, PE жёлто-зелёный');
    expect(stove.phase).toBe('L1, L2, L3');
  });
  it('feeds a four-pole RCD with three phases and a neutral', () => {
    const w = asm.wires.find(x => x.to === 'УЗО «Кухня»')!;
    expect(w.cores.map(c => c.c)).toEqual(['L1', 'L2', 'L3', 'N']);
  });
  it('uses a three-phase comb and explains that the place sets the phase', () => {
    const comb = asm.rails.flatMap(r => r.combs).find(c => c.from === 'УЗО «Кухня»')!;
    expect(comb.poles).toBe('3P');
    expect(asm.notes.some(n => /фаз[ау] .*мест/i.test(n))).toBe(true);
  });
});

describe('protective devices around the input', () => {
  const a = calcAll(flat(), cfg({ prot: 'rcd', spd: 'on', vr: 'on' }));
  const asm = assembly(a);
  it('takes the feed for the groups after the voltage relay', () => {
    expect(asm.wires.some(w => w.from === 'Вводной автомат' && /реле напряжения/i.test(w.to))).toBe(true);
    expect(asm.wires.filter(w => /^УЗО/.test(w.to)).every(w => /реле напряжения/i.test(w.from))).toBe(true);
  });
  it('connects the surge protector to the N and PE buses', () => {
    const main = asm.buses.find(b => b.kind === 'n' && b.uzo === undefined)!;
    const pe = asm.buses.find(b => b.kind === 'pe')!;
    expect(main.terms).toContain('УЗИП');
    expect(pe.terms).toContain('УЗИП');
  });
});

describe('private house', () => {
  it('reminds to split PEN only once, at the input', () => {
    const a = calcAll(flat(), cfg({ prot: 'rcd', obj: 'house' }));
    expect(assembly(a).notes.some(n => /PEN/.test(n))).toBe(true);
  });
});

describe('specification agrees with the assembly', () => {
  it('counts the same number of N buses', () => {
    for (const prot of ['rcd', 'rcbo']) {
      const a = calcAll(sample().lines, { ...sample().cfg, prot });
      const spec = buildSpec(a).find(i => i.name === 'Шина N (нулевая)')!;
      expect(spec.n).toBe(assembly(a).buses.filter(b => b.kind === 'n').reduce((s, b) => s + b.count, 0));
    }
  });
});

describe('empty project', () => {
  it('has nothing to assemble', () => {
    const asm = assembly(calcAll([], cfg()));
    expect(asm.rails).toEqual([]);
    expect(asm.lines).toEqual([]);
    expect(asm.wires).toEqual([]);
  });
});
