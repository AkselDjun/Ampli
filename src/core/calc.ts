import type { App, BoxType, Calc, Cfg, CfgN, Device, InCable, Line, LineResult, Phase, Row, Uzo } from './types';
import { ALL_STEPS, HEAT_RX, HEAT_PLUG_KW, SN_CH2_DATE, INS_MIN_MOHM, rcdTripMs, IZ, KZ_TIME, LEAK_FRACTION, LEAK_LOAD_ABOVE_A, LEAK_PER_A_MA, LEAK_PER_M_MA, PE_MAX_S, RHO, RHO_HOT_K, RCD_STD, ROWLEN, SECTIONS, SINGLE_INPUT_KW, SIZES, STD, STD_IN, TRIP_MULT, TYPES } from './norms';
import { fmt, fs, pn } from './format';

export function cfgN(c: Cfg): CfgN {
  return {
    supply: Number(c.supply) === 3 ? 3 : 1,
    method: c.method === 'open' ? 'open' : 'wall',
    drop: 0,
    ko: Math.min(1, Math.max(0.3, pn(c.ko, 0.75))),
    k: Math.min(1, Math.max(0.5, pn(c.k, 0.9))),
    alloc: Math.max(0.5, pn(c.alloc, 15)),
    safe: c.minS !== 'norm',
    zs: Math.min(2, Math.max(0.05, pn(c.zs, 0.3))),
    feeder: Math.min(3, Math.max(0, pn(c.feeder, 0))),
    rcdMode: c.prot === 'rcd',
    box: boxOf(c),
    boxAuto: !isBox(c.box),
    inCable: c.inCable === 'frls' || c.inCable === 'nym' ? (c.inCable as InCable) : 'vvg'
  };
}

const isBox = (b: unknown): b is BoxType => b === 'brick' || b === 'gkl' || b === 'surface';
const boxOf = (c: Cfg): BoxType => (isBox(c.box) ? c.box : (c.method === 'open' ? 'surface' : 'brick'));

export const appW = (a: App): number => Math.max(0, pn(a.w, 0)) * (a.m !== undefined ? Math.max(0, pn(a.m, 0)) : 1) * Math.max(0, pn(a.n, 0));
export const appBr = (a: App): number => Math.max(0, pn(a.br, 0));
export const zoneOf = (l: Line): string => (l.zone ?? '').trim() || 'Без помещения';

export function loopOhm(S: number, len: number): number {
  const pe = Math.min(S, PE_MAX_S);
  return RHO * RHO_HOT_K * len * (1 / S + 1 / pe);
}

export function shortCircuit(S: number, len: number, zs: number): number {
  return 230 / (zs + loopOhm(S, len));
}

export function calcLine(l: Line, c: CfgN, zoneMa?: number): LineResult {
  const t = TYPES[l.type];
  const nSock = l.type === 'socket' ? Math.max(0, Math.round(pn(l.sockets, 0))) : 0;
  const pInst = l.apps.reduce((s, a) => s + appW(a), 0) + nSock * Math.max(0, pn(l.perSocket, 0));
  const kc = 1;
  const cos = 1;
  const main = Math.max(0, pn(l.len, 0));
  const live = l.apps.filter(a => appW(a) > 0);
  const len = main + live.reduce((m, a) => Math.max(m, appBr(a)), 0);
  const cable = main + live.reduce((s, a) => s + appBr(a) * Math.max(1, Math.round(pn(a.n, 1))), 0);
  const three = c.supply === 3 && l.type === 'power' && l.phase === '3';
  const pd = pInst;
  const I = three ? pd / (Math.sqrt(3) * 400) : pd / 230;
  const lim0 = (l.type === 'light' ? 3 : 5) + Math.min(0.5, Math.max(0, len - 100) * 0.005);
  const lim = Math.max(0.5, lim0 - c.feeder);
  const rcbo = t.rcd && !c.rcdMode;
  const ma = !t.rcd ? 0 : (zoneMa ?? (l.wet ? 10 : (I > 32 ? 100 : 30)));
  const r: LineResult = {
    limit: lim, pInst, pd, I, three, len, cos, kc, notes: [], status: 'ok', rcd: t.rcd, rcbo, zone: c.rcdMode ? zoneOf(l) : '', uzo: null, cable, sockets: nSock,
    ma, curve: t.curve, In: null, S: null, drop: 0, empty: false,
    mod: three ? (rcbo ? 4 : 3) : (rcbo ? 2 : 1), ik: 0, ikNeed: 0, ikSrc: 'calc',
    zsMeas: null, insMeas: null, leakMeas: null, leakLim: 0, leakEst: 0, rcdMeas: null, rcdLim: 0
  };
  if (pInst <= 0) {
    r.empty = true;
    r.I = 0;
    r.pd = 0;
    return r;
  }
  const need = Math.max(I, t.minIn);
  r.In = STD.find(x => x >= need) ?? null;
  if (!r.In) {
    r.status = 'bad';
    r.notes.push('Ток линии больше 63 А. Разделите нагрузку на несколько групп.');
    return r;
  }
  const tbl = IZ[c.method][three ? 3 : 1];
  const minS = c.safe ? t.minS : 1.5;
  let i = SECTIONS.findIndex((s, k) => s >= minS && tbl[k] * c.k >= (r.In as number));
  if (i < 0) {
    r.status = 'bad';
    r.In = null;
    r.notes.push('Кабель до 35 мм² не выдерживает такую нагрузку. Разделите её на несколько групп.');
    return r;
  }
  const base = i;
  const dropAt = (k: number): number =>
    (three ? Math.sqrt(3) * RHO * len * I / (SECTIONS[k] * 400) : 2 * RHO * len * I / (SECTIONS[k] * 230)) * 100;
  while (dropAt(i) > lim && i < SECTIONS.length - 1) i++;
  const afterDrop = i;
  r.ikNeed = TRIP_MULT[t.curve] * r.In;
  const kzOk = (k: number): boolean => len === 0 || shortCircuit(SECTIONS[k], len, c.zs) >= r.ikNeed;
  while (!kzOk(i) && i < SECTIONS.length - 1) i++;
  r.S = SECTIONS[i];
  r.drop = dropAt(i);
  r.ik = len === 0 ? 0 : shortCircuit(r.S, len, c.zs);
  const zm = pn(l.meas?.zs, 0);
  if (zm > 0) {
    r.zsMeas = zm;
    r.ik = 230 / zm;
    r.ikSrc = 'meas';
  }
  if (afterDrop > base) {
    r.status = 'warn';
    r.notes.push('Сечение увеличено с ' + fs(SECTIONS[base]) + ' до ' + fs(SECTIONS[afterDrop]) + ' мм² из-за падения напряжения на длине ' + fmt(len, 0) + ' м.');
  }
  if (i > afterDrop) {
    r.status = 'warn';
    r.notes.push('Сечение увеличено до ' + fs(r.S) + ' мм², чтобы автомат отключил короткое замыкание за ' + fs(KZ_TIME) + ' с.');
  }
  if ((len > 0 || r.zsMeas !== null) && r.ik < r.ikNeed) {
    r.status = 'bad';
    r.notes.push(r.ikSrc === 'meas'
      ? 'По замеру петли ' + fmt(r.zsMeas as number, 2) + ' Ом ток короткого замыкания ' + fmt(r.ik, 0) + ' А меньше ' + fmt(r.ikNeed, 0) + ' А: автомат не обеспечит отключение за ' + fs(KZ_TIME) + ' с (ТКП 339-2022, п. 4.4.28.5).'
      : 'Ток короткого замыкания в конце линии ' + fmt(r.ik, 0) + ' А меньше ' + fmt(r.ikNeed, 0) + ' А: автомат может не отключить линию за ' + fs(KZ_TIME) + ' с. Сократите линию.');
  }
  if (r.rcd) {
    r.leakLim = r.ma * LEAK_FRACTION;
    r.leakEst = cable * LEAK_PER_M_MA + (I > LEAK_LOAD_ABOVE_A ? I * LEAK_PER_A_MA : 0);
    const lm = pn(l.meas?.leak, 0);
    if (lm > 0) r.leakMeas = lm;
    if (r.leakMeas !== null && r.leakMeas > r.leakLim) {
      r.status = 'bad';
      r.notes.push('Ток утечки ' + fmt(r.leakMeas, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА): возможны ложные отключения (СН 4.04.01-2019, п. 16.3.7).');
    } else if (!c.rcdMode && r.leakMeas === null && r.leakEst > r.leakLim) {
      r.status = r.status === 'bad' ? 'bad' : 'warn';
      r.notes.push('Утечка самой линии около ' + fmt(r.leakEst, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА, СН 4.04.01-2019, п. 16.3.7).');
    }
    r.rcdLim = rcdTripMs(r.ma);
    const tm = pn(l.meas?.rcd, 0);
    if (tm > 0) {
      r.rcdMeas = tm;
      if (tm > r.rcdLim) {
        r.status = 'bad';
        r.notes.push('УЗО отключилось за ' + fmt(tm, 0) + ' мс при номинальном дифференциальном токе, допустимо не более ' + fmt(r.rcdLim, 0) + ' мс (ТКП 339-2022 с изм. № 1, табл. ' + (r.ma > 30 ? '4.4.47' : '4.4.48') + '). Замените аппарат.');
      }
    }
  }
  const im = pn(l.meas?.ins, 0);
  if (im > 0) {
    r.insMeas = im;
    if (im < INS_MIN_MOHM) {
      r.status = 'bad';
      r.notes.push('Сопротивление изоляции ' + fmt(im, 2) + ' МОм меньше ' + fs(INS_MIN_MOHM) + ' МОм (ТКП 339-2022, п. 4.4.26.1, табл. 4.4.46).');
    }
  }
  if (r.drop > lim) {
    r.status = 'bad';
    r.notes.push('Падение напряжения выше допустимого даже на сечении 35 мм². Сократите линию.');
  }
  if (l.type === 'socket' && r.In > 16) {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push('Для розеточной группы это много. Вынесите мощные приборы в отдельные линии.');
  }
  if (len === 0) {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push('Укажите длину линии, иначе падение напряжения не проверяется.');
  }
  const heat = live.filter(a => HEAT_RX.test(a.name));
  if (heat.length) {
    if (live.length > heat.length) {
      r.status = r.status === 'bad' ? 'bad' : 'warn';
      r.notes.push('Водонагреватель и приборы отопления подключают отдельной линией от квартирного щитка, без других приборов (СН 4.04.01-2019, п. 14.4).');
    }
    const big = heat.some(a => Math.max(0, pn(a.w, 0)) * (a.m !== undefined ? Math.max(0, pn(a.m, 0)) : 1) > HEAT_PLUG_KW * 1000);
    r.notes.push((big ? 'Прибор мощнее ' + HEAT_PLUG_KW + ' кВт: подключение неразъёмное, без вилки и розетки (СН 4.04.01-2019, п. 14.4). ' : '') + 'С ' + SN_CH2_DATE + ' по изменению № 2 к СН 4.04.01-2019 (п. 14.4) водонагреватели и приборы отопления любой мощности подключают неразъёмно, без вилки и розетки.');
  }
  return r;
}

export interface Slot {
  row: number;
  col: number;
}

export function layout(devs: Device[], rl: number): Slot[] {
  const out: Slot[] = [];
  let row = 0;
  let col = 0;
  devs.forEach((d, i) => {
    let block = d.mod;
    if (d.kind === 'uzo') {
      for (let j = i + 1; j < devs.length && devs[j].kind === 'mcb' && devs[j].zone === d.zone; j++) block += devs[j].mod;
    }
    if (col > 0 && (col + d.mod > rl || (block <= rl && col + block > rl))) {
      row++;
      col = 0;
    }
    out.push({ row, col });
    col += d.mod;
  });
  return out;
}

export function pack(devs: Device[], rl: number): number {
  if (!devs.length) return 0;
  const s = layout(devs, rl);
  const last = s[s.length - 1];
  return last.row * rl + last.col + devs[devs.length - 1].mod;
}

const zoneMa = (rs: LineResult[], ls: Line[]): number => {
  if (ls.some((l, i) => l.wet && rs[i].rcd)) return 10;
  if (rs.length && rs.every(r => r.I > 32)) return 100;
  return 30;
};

function planUzos(lines: Line[], c: CfgN): { rows: Row[]; uzos: Uzo[] } {
  const first = lines.map(l => calcLine(l, c));
  if (!c.rcdMode) return { rows: lines.map((l, i) => ({ l, r: first[i] })), uzos: [] };
  const order: string[] = [];
  const by = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const r = first[i];
    if (r.empty || !r.In || !r.rcd) return;
    const z = zoneOf(l);
    if (!by.has(z)) {
      by.set(z, []);
      order.push(z);
    }
    (by.get(z) as number[]).push(i);
  });
  const maOf = new Map<string, number>();
  order.forEach(z => {
    const idx = by.get(z) as number[];
    maOf.set(z, zoneMa(idx.map(i => first[i]), idx.map(i => lines[i])));
  });
  const rows: Row[] = lines.map((l, i) => {
    const z = zoneOf(l);
    return { l, r: maOf.has(z) && first[i].rcd ? calcLine(l, c, maOf.get(z)) : first[i] };
  });
  const uzos: Uzo[] = order.map((z, k) => {
    const idx = by.get(z) as number[];
    const rs = idx.map(i => rows[i].r);
    const sumIn = rs.reduce((s, r) => s + (r.In as number), 0);
    const maxIn = rs.reduce((m, r) => Math.max(m, r.In as number), 0);
    const phases = new Set(idx.map(i => lines[i].phase));
    const four = c.supply === 3 && (rs.some(r => r.three) || phases.size > 1);
    const need = Math.max(maxIn, sumIn);
    const In = RCD_STD.find(x => x >= need) ?? RCD_STD[RCD_STD.length - 1];
    const ma = maOf.get(z) as number;
    const leak = rs.reduce((s, r) => s + (r.leakMeas ?? r.leakEst), 0);
    idx.forEach(i => {
      const r = rows[i].r;
      r.uzo = k;
    });
    if (leak > ma * LEAK_FRACTION) {
      idx.forEach(i => {
        const r = rows[i].r;
        r.status = r.status === 'bad' ? 'bad' : 'warn';
        r.notes.push('Суммарная утечка групп на УЗО «' + z + '» около ' + fmt(leak, 1) + ' мА больше трети уставки ' + ma + ' мА (СН 4.04.01-2019, п. 16.3.7). Разделите помещение на два УЗО.');
      });
    }
    return { zone: z, In, ma, four, groups: idx, leak, sumIn };
  });
  return { rows, uzos };
}

export function calcAll(lines: Line[], cfg: Cfg): Calc {
  const c = cfgN(cfg);
  const { rows, uzos } = planUzos(lines, c);
  const sumInst = rows.reduce((s, x) => s + x.r.pInst, 0);
  const sumD = rows.reduce((s, x) => s + x.r.pd, 0);
  const P = sumD * c.ko;
  let phases: Calc['phases'] = null;
  let Itot: number;
  if (c.supply === 3) {
    const ph = { L1: 0, L2: 0, L3: 0 };
    rows.forEach(x => {
      if (x.r.three) {
        ph.L1 += x.r.I;
        ph.L2 += x.r.I;
        ph.L3 += x.r.I;
      } else {
        const key = x.l.phase === 'L2' || x.l.phase === 'L3' ? x.l.phase : 'L1';
        ph[key] += x.r.I;
      }
    });
    ph.L1 *= c.ko;
    ph.L2 *= c.ko;
    ph.L3 *= c.ko;
    phases = ph;
    Itot = Math.max(ph.L1, ph.L2, ph.L3);
  } else {
    Itot = c.ko * rows.reduce((s, x) => s + x.r.I, 0);
  }
  const maxLineIn = rows.reduce((m, x) => Math.max(m, x.r.In || 0), 0);
  const gi = maxLineIn > 0 ? ALL_STEPS.indexOf(maxLineIn) : -1;
  const selIn = gi >= 0 ? ALL_STEPS[gi + 2] : 0;
  const needIn = Math.max(Itot, selIn);
  const inIn = Itot > 0 ? (STD_IN.find(x => x >= needIn) ?? null) : null;
  const inStep = inIn && gi >= 0 ? ALL_STEPS.indexOf(inIn) - gi : 0;
  let inS: number | null = null;
  if (inIn) {
    const tbl = IZ[c.method][c.supply === 3 ? 3 : 1];
    const i = SECTIONS.findIndex((_s, k) => tbl[k] * c.k >= inIn);
    inS = i < 0 ? null : SECTIONS[i];
  }
  uzos.forEach(u => {
    const maxIn = u.groups.reduce((m, i) => Math.max(m, rows[i].r.In as number), 0);
    const need = Math.max(maxIn, inIn ? Math.min(u.sumIn, inIn) : u.sumIn);
    u.In = RCD_STD.find(x => x >= need) ?? RCD_STD[RCD_STD.length - 1];
  });
  const devs: Device[] = [];
  if (inIn) devs.push({ kind: 'in', mod: c.supply === 3 ? 4 : 2, label: 'C' + inIn, sub: 'Ввод', title: 'Вводной автомат C' + inIn });
  const groupDev = (x: Row, idx: number): Device => ({
    kind: x.r.rcbo ? 'rcd' : 'mcb',
    mod: x.r.mod,
    label: x.r.curve + x.r.In,
    sub: 'Г' + (idx + 1) + (x.r.rcbo ? ' ' + x.r.ma + 'мА' : ''),
    ma: x.r.ma,
    title: 'Г' + (idx + 1) + ' ' + x.l.name,
    lid: x.l.id,
    zone: x.r.zone || undefined,
    ph: c.supply === 3 ? (x.r.three ? '3' : x.l.phase) : undefined,
    st: x.r.status
  });
  if (c.rcdMode) {
    uzos.forEach(u => {
      devs.push({ kind: 'uzo', mod: u.four ? 4 : 2, label: u.In + 'А', sub: u.ma + 'мА', ma: u.ma, title: 'УЗО ' + u.In + ' А ' + u.ma + ' мА: ' + u.zone, zone: u.zone });
      u.groups.forEach(i => devs.push(groupDev(rows[i], i)));
    });
    rows.forEach((x, idx) => {
      if (x.r.empty || !x.r.In || x.r.uzo !== null) return;
      devs.push(groupDev(x, idx));
    });
  } else {
    rows.forEach((x, idx) => {
      if (x.r.empty || !x.r.In) return;
      devs.push(groupDev(x, idx));
    });
  }
  const modSum = devs.reduce((s, d) => s + d.mod, 0);
  const reserve = Math.ceil(modSum * 0.2);
  let size = SIZES[SIZES.length - 1];
  let placed: number | null = null;
  let fits = false;
  for (const sz of SIZES) {
    const cells = pack(devs, ROWLEN[sz]);
    if (cells + reserve <= sz) {
      size = sz;
      placed = cells;
      fits = true;
      break;
    }
  }
  if (placed === null) placed = pack(devs, ROWLEN[size]);
  let imb = 0;
  if (phases) {
    const v = [phases.L1, phases.L2, phases.L3];
    const mx = Math.max(...v);
    const mn = Math.min(...v);
    imb = mx > 0 ? (mx - mn) / mx * 100 : 0;
  }
  const issues = rows.filter(x => !x.r.empty && x.r.status !== 'ok').length;
  const hint3 = c.supply === 1 && P > SINGLE_INPUT_KW * 1000;
  const boxes = rows.filter(x => !x.r.empty && x.l.apps.some(a => appW(a) > 0 && appBr(a) > 0)).length;
  return { c, rows, sumInst, P, Itot, phases, imb, inIn, inS, devs, modSum, size, placed, fits, issues, inStep, hint3, uzos, boxes };
}

export function balanceLines(lines: Line[], cfg: Cfg): Line[] {
  const c = cfgN(cfg);
  const items = lines.map(l => ({ l, r: calcLine(l, c) })).filter(x => !x.r.three);
  items.sort((a, b) => b.r.I - a.r.I);
  const load: Record<string, number> = { L1: 0, L2: 0, L3: 0 };
  const next = new Map<string, Phase>();
  items.forEach(x => {
    const p = Object.keys(load).sort((a, b) => load[a] - load[b])[0] as Phase;
    next.set(x.l.id, p);
    load[p] += x.r.I;
  });
  return lines.map(l => (next.has(l.id) ? { ...l, phase: next.get(l.id) as Phase } : l));
}
