import { layout } from './calc';
import { fs } from './format';
import { ROWLEN } from './norms';
import { cableName } from './protection';
import { jumperS } from './supplies';
import type { Calc, Device, Row } from './types';

export type Core = 'L' | 'L1' | 'L2' | 'L3' | 'N' | 'PE';

export interface AsmDev {
  pos: number;
  mod: number;
  kind: Device['kind'];
  label: string;
  sub: string;
  title: string;
}

export interface AsmComb {
  poles: '1P' | '2P' | '3P' | '4P';
  from: string;
  devs: string[];
  mods: number;
}

export interface AsmRail {
  n: number;
  len: number;
  used: number;
  devs: AsmDev[];
  combs: AsmComb[];
}

export interface AsmBus {
  kind: 'n' | 'pe';
  name: string;
  feed: string;
  terms: string[];
  holes: number;
  count: number;
  uzo?: number;
}

export interface AsmWire {
  from: string;
  to: string;
  s: number;
  cores: { c: Core; color: string }[];
}

export interface AsmLine {
  idx: number;
  g: string;
  name: string;
  dev: string;
  from: string;
  phase?: string;
  cable: string;
  cores: string;
  n: string;
  pe: string;
  ferrule: string;
}

export interface Assembly {
  rails: AsmRail[];
  buses: AsmBus[];
  wires: AsmWire[];
  lines: AsmLine[];
  notes: string[];
}

export const BUS_HOLES = [4, 6, 8, 10, 12, 14, 16, 20, 24];

const COLORS: Record<Core, string> = {
  L: 'коричневый',
  L1: 'коричневый',
  L2: 'чёрный',
  L3: 'серый',
  N: 'синий',
  PE: 'жёлто-зелёный'
};

export const wireColor = (c: Core): string => COLORS[c];

export function busHoles(terms: number): { holes: number; count: number } {
  const need = terms + Math.max(1, Math.ceil(terms * 0.2));
  const max = BUS_HOLES[BUS_HOLES.length - 1];
  const fit = BUS_HOLES.find(h => h >= need);
  if (fit) return { holes: fit, count: 1 };
  return { holes: max, count: Math.ceil(need / max) };
}

const PHASES: Core[] = ['L1', 'L2', 'L3'];

const coreList = (cs: Core[]): { c: Core; color: string }[] => cs.map(c => ({ c, color: COLORS[c] }));

const uzoRef = (zone: string): string => 'УЗО «' + zone + '»';

const busOf = (zone: string): string => 'Шина N · ' + zone;

const g = (i: number): string => 'Г' + (i + 1);

export function assembly(a: Calc): Assembly {
  const c = a.c;
  const three = c.supply === 3;
  const live = a.rows.map((x, i) => ({ x, i })).filter(({ x }) => !x.r.empty && !!x.r.In && !!x.r.S);
  if (!a.devs.length || !live.length) return { rails: [], buses: [], wires: [], lines: [], notes: [] };
  const rowOf = new Map<string, number>();
  a.rows.forEach((x, i) => rowOf.set(x.l.id, i));
  const len = ROWLEN[a.size] ?? 12;
  const slots = layout(a.devs, len);
  const phaseOf = (x: Row): Core[] => (!three ? ['L'] : x.r.three ? PHASES : [x.l.phase === '3' ? 'L1' : (x.l.phase as Core)]);
  const vrDevs = a.devs.filter(d => d.kind === 'vr');
  const src = vrDevs.length > 1 ? 'Контактор ввода' : vrDevs.length ? 'Реле напряжения' : 'Вводной автомат';
  const feedS = jumperS(a.inIn);
  const supplyCores: Core[] = three ? PHASES : ['L'];
  const wires: AsmWire[] = [];
  const notes: string[] = [];
  if (a.inIn && vrDevs.length) {
    wires.push({ from: 'Вводной автомат', to: 'Реле напряжения', s: feedS, cores: coreList([...supplyCores, 'N']) });
    if (vrDevs.length > 1) {
      wires.push({ from: 'Реле напряжения', to: 'Контактор ввода', s: 1.5, cores: coreList(['L', 'N']) });
      notes.push('Реле напряжения управляет катушкой контактора: силовые провода ввода идут через контакты контактора, к реле подходят только цепь контроля и катушка.');
    }
  }
  const feederOf = (d: Device): string => {
    if (d.kind !== 'mcb' && d.kind !== 'rcd') return '';
    const i = d.lid !== undefined ? rowOf.get(d.lid) : undefined;
    if (i === undefined) return src;
    const u = a.rows[i].r.uzo;
    return c.rcdMode && u !== null && a.uzos[u] ? uzoRef(a.uzos[u].zone) : src;
  };
  const rails: AsmRail[] = [];
  a.devs.forEach((d, k) => {
    const s = slots[k];
    while (rails.length <= s.row) rails.push({ n: rails.length + 1, len, used: 0, devs: [], combs: [] });
    const rail = rails[s.row];
    rail.devs.push({ pos: s.col + 1, mod: d.mod, kind: d.kind, label: d.label, sub: d.sub, title: d.title });
    rail.used = Math.max(rail.used, s.col + d.mod);
  });
  const runs: { rail: number; from: string; devs: Device[] }[] = [];
  a.devs.forEach((d, k) => {
    const from = feederOf(d);
    if (!from) return;
    const last = runs[runs.length - 1];
    const prev = a.devs[k - 1];
    if (last && last.from === from && last.rail === slots[k].row && prev && feederOf(prev) === from) last.devs.push(d);
    else runs.push({ rail: slots[k].row, from, devs: [d] });
  });
  const split = new Set<string>();
  const seen = new Set<string>();
  runs.forEach(r => {
    if (seen.has(r.from)) split.add(r.from);
    seen.add(r.from);
  });
  runs.forEach(run => {
    const rows = run.devs.map(d => a.rows[rowOf.get(d.lid as string) as number]);
    const uzo = a.uzos.find(u => uzoRef(u.zone) === run.from);
    const rcbo = rows.some(x => x.r.rcbo);
    const wide = three && (uzo ? uzo.four : true);
    const firstRow = rows[0];
    if (run.devs.length > 1) {
      const poles: AsmComb['poles'] = wide ? (rcbo ? '4P' : '3P') : (rcbo ? '2P' : '1P');
      rails[run.rail].combs.push({ poles, from: run.from, devs: rows.map(x => g(a.rows.indexOf(x))), mods: run.devs.reduce((s, d) => s + d.mod, 0) });
    }
    const cores: Core[] = wide ? [...PHASES] : three ? phaseOf(firstRow) : ['L'];
    if (rcbo) cores.push('N');
    const s = uzo ? jumperS(uzo.In) : feedS;
    wires.push({ from: run.from, to: run.devs.length > 1 ? 'гребёнка ' + g(a.rows.indexOf(firstRow)) + '–' + g(a.rows.indexOf(rows[rows.length - 1])) : g(a.rows.indexOf(firstRow)), s, cores: coreList(cores) });
  });
  const fedUzo: AsmWire[] = a.uzos.map(u => {
    const ph = u.groups.map(i => a.rows[i]).filter(x => !x.r.empty && x.r.In);
    const cs: Core[] = !three ? ['L'] : u.four ? [...PHASES] : ph.length ? phaseOf(ph[0]) : ['L1'];
    return { from: src, to: uzoRef(u.zone), s: feedS, cores: coreList([...cs, 'N']) };
  });
  wires.splice(vrDevs.length ? (vrDevs.length > 1 ? 2 : 1) : 0, 0, ...fedUzo);
  const mainTerms = ['N ввода'];
  if (vrDevs.length) mainTerms.push('Реле напряжения');
  if (a.devs.some(d => d.kind === 'spd')) mainTerms.push('УЗИП');
  a.uzos.forEach(u => mainTerms.push(uzoRef(u.zone)));
  wires.forEach(w => {
    if (w.from === src && !w.to.startsWith('УЗО') && w.cores.some(x => x.c === 'N')) mainTerms.push(w.to);
  });
  const lines: AsmLine[] = live.map(({ x, i }) => {
    const u = x.r.uzo !== null && c.rcdMode ? a.uzos[x.r.uzo] : undefined;
    const cs: Core[] = three ? (x.r.three ? [...PHASES, 'N', 'PE'] : ['L', 'N', 'PE']) : ['L', 'N', 'PE'];
    let n: string;
    if (x.r.rcbo) n = 'на дифавтомат ' + g(i);
    else if (u) n = busOf(u.zone);
    else {
      n = 'Шина N ввода';
      mainTerms.push(g(i));
    }
    const out: AsmLine = {
      idx: i,
      g: g(i),
      name: x.l.name,
      dev: x.r.curve + x.r.In + (x.r.rcbo ? ' ' + x.r.ma + ' мА' : ''),
      from: u ? uzoRef(u.zone) : src,
      cable: cableName(x.r),
      cores: cs.map(k => k + ' ' + COLORS[k]).join(', '),
      n,
      pe: 'Шина PE',
      ferrule: 'НШВИ ' + fs(x.r.S as number) + ' мм²'
    };
    if (three) out.phase = x.r.three ? 'L1, L2, L3' : x.l.phase === '3' ? 'L1' : x.l.phase;
    return out;
  });
  const buses: AsmBus[] = [];
  const main = busHoles(mainTerms.length);
  buses.push({ kind: 'n', name: 'Шина N ввода', feed: 'N кабеля ввода', terms: mainTerms, ...main });
  a.uzos.forEach((u, k) => {
    const terms = [uzoRef(u.zone) + ', выход N', ...u.groups.filter(i => live.some(l => l.i === i)).map(g)];
    buses.push({ kind: 'n', name: busOf(u.zone), feed: 'выход N ' + uzoRef(u.zone), terms, ...busHoles(terms.length), uzo: k });
  });
  const peTerms = ['PE ввода', ...live.map(({ i }) => g(i))];
  if (a.devs.some(d => d.kind === 'spd')) peTerms.push('УЗИП');
  buses.push({ kind: 'pe', name: 'Шина PE', feed: c.house ? 'PE после разделения PEN и ГЗШ' : 'PE кабеля ввода', terms: peTerms, ...busHoles(peTerms.length) });
  if (a.uzos.length > 1 || (a.uzos.length && mainTerms.some(t => /^Г\d/.test(t)))) notes.push('Шины N разных УЗО между собой не соединяйте и N группы подключайте только к шине своего УЗО: общий ноль после УЗО вызывает ложные отключения.');
  if (three && lines.some(l => l.phase && l.phase !== 'L1, L2, L3') && rails.some(r => r.combs.some(cb => cb.poles === '3P' || cb.poles === '4P'))) notes.push('На трёхфазной гребёнке фаза однополюсного автомата задаётся его местом: ставьте автомат так, чтобы фаза совпала со столбцом «Фаза» в таблице групп.');
  split.forEach(f => notes.push('Автоматы после ' + f + ' стоят в двух рядах: второй ряд питайте отдельной перемычкой от ' + f + ', гребёнку между рядами не тяните.'));
  if (c.house) notes.push('Частный дом: PEN кабеля ввода разделяют на PE и N один раз, на вводе, перемычкой между шинами PE и N. После разделения шины N и PE не соединяют.');
  if (a.prio) notes.push('Реле приоритета: силовые контакты контактора ставят после автомата отключаемой группы, катушку питают через контакт реле приоритета.');
  if (a.devs.some(d => d.kind === 'spd')) notes.push('Провода УЗИП до шин N и PE делайте как можно короче и без петель, сечение берите по паспорту УЗИП.');
  notes.push('Провода в зажимах аппаратов и шин обжимают наконечниками НШВИ, винты затягивают моментом из паспорта аппарата.');
  return { rails, buses, wires, lines, notes };
}
