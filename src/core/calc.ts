import type { Calc, Cfg, CfgN, Device, Line, LineResult, Phase, Row } from './types';
import { ALL_STEPS, INS_MIN_MOHM, IZ, KZ_TIME, LEAK_FRACTION, LEAK_LOAD_ABOVE_A, LEAK_PER_A_MA, LEAK_PER_M_MA, PE_MAX_S, RHO, RHO_HOT_K, ROWLEN, SECTIONS, SINGLE_INPUT_KW, SIZES, STD, STD_IN, TRIP_MULT, TYPES } from './norms';
import { fmt, fs, pn } from './format';

export function cfgN(c: Cfg): CfgN {
  return {
    supply: Number(c.supply) === 3 ? 3 : 1,
    method: c.method === 'open' ? 'open' : 'wall',
    drop: Math.max(0, pn(c.drop, 0)),
    ko: Math.min(1, Math.max(0.3, pn(c.ko, 0.75))),
    k: Math.min(1, Math.max(0.5, pn(c.k, 0.9))),
    alloc: Math.max(0.5, pn(c.alloc, 15)),
    safe: c.minS !== 'norm',
    zs: Math.min(2, Math.max(0.05, pn(c.zs, 0.3))),
    feeder: Math.min(3, Math.max(0, pn(c.feeder, 0)))
  };
}

export function loopOhm(S: number, len: number): number {
  const pe = Math.min(S, PE_MAX_S);
  return RHO * RHO_HOT_K * len * (1 / S + 1 / pe);
}

export function shortCircuit(S: number, len: number, zs: number): number {
  return 230 / (zs + loopOhm(S, len));
}

export function calcLine(l: Line, c: CfgN): LineResult {
  const t = TYPES[l.type];
  const pInst = l.apps.reduce((s, a) => s + Math.max(0, pn(a.w, 0)) * Math.max(0, pn(a.n, 0)), 0);
  const kc = Math.min(1, Math.max(0.05, pn(l.kc, t.kc)));
  const cos = Math.min(1, Math.max(0.3, pn(l.cos, t.cos)));
  const len = Math.max(0, pn(l.len, 0));
  const three = c.supply === 3 && l.type === 'power' && l.phase === '3';
  const pd = pInst * kc;
  const I = three ? pd / (Math.sqrt(3) * 400 * cos) : pd / (230 * cos);
  const lim0 = (l.type === 'light' ? 3 : 5) + Math.min(0.5, Math.max(0, len - 100) * 0.005);
  const lim = Math.max(0.5, (c.drop > 0 ? Math.min(lim0, c.drop) : lim0) - c.feeder);
  const r: LineResult = {
    limit: lim, pInst, pd, I, three, len, cos, kc, notes: [], status: 'ok', rcd: t.rcd,
    ma: t.rcd ? (l.wet ? 10 : (I > 32 ? 100 : 30)) : 0, curve: t.curve, In: null, S: null, drop: 0, empty: false,
    mod: three ? (t.rcd ? 4 : 3) : (t.rcd ? 2 : 1), ik: 0, ikNeed: 0, ikSrc: 'calc',
    zsMeas: null, insMeas: null, leakMeas: null, leakLim: 0, leakEst: 0
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
    (three ? Math.sqrt(3) * RHO * len * I * cos / (SECTIONS[k] * 400) : 2 * RHO * len * I * cos / (SECTIONS[k] * 230)) * 100;
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
    r.leakEst = len * LEAK_PER_M_MA + (I > LEAK_LOAD_ABOVE_A ? I * LEAK_PER_A_MA : 0);
    const lm = pn(l.meas?.leak, 0);
    if (lm > 0) r.leakMeas = lm;
    if (r.leakMeas !== null && r.leakMeas > r.leakLim) {
      r.status = 'bad';
      r.notes.push('Ток утечки ' + fmt(r.leakMeas, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА): возможны ложные отключения (СН 4.04.01-2019, п. 16.3.7).');
    } else if (r.leakMeas === null && r.leakEst > r.leakLim) {
      r.status = r.status === 'bad' ? 'bad' : 'warn';
      r.notes.push('Утечка самой линии около ' + fmt(r.leakEst, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА, СН 4.04.01-2019, п. 16.3.7).');
    }
  }
  const im = pn(l.meas?.ins, 0);
  if (im > 0) {
    r.insMeas = im;
    if (im < INS_MIN_MOHM) {
      r.status = 'bad';
      r.notes.push('Сопротивление изоляции ' + fmt(im, 2) + ' МОм меньше ' + fs(INS_MIN_MOHM) + ' МОм (ТКП 339-2022, п. 4.4.29.2).');
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
  return r;
}

export function pack(devs: Device[], rl: number): number {
  let col = 0;
  let row = 0;
  devs.forEach(d => {
    if (col + d.mod > rl) {
      row++;
      col = 0;
    }
    col += d.mod;
  });
  return row * rl + col;
}

export function calcAll(lines: Line[], cfg: Cfg): Calc {
  const c = cfgN(cfg);
  const rows: Row[] = lines.map(l => ({ l, r: calcLine(l, c) }));
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
  const devs: Device[] = [];
  if (inIn) devs.push({ kind: 'in', mod: c.supply === 3 ? 4 : 2, label: 'C' + inIn, sub: 'Ввод', title: 'Вводной автомат C' + inIn });
  rows.forEach((x, idx) => {
    if (x.r.empty || !x.r.In) return;
    devs.push({
      kind: x.r.rcd ? 'rcd' : 'mcb',
      mod: x.r.mod,
      label: x.r.curve + x.r.In,
      sub: 'Г' + (idx + 1) + (x.r.rcd ? ' ' + x.r.ma + 'мА' : ''),
      ma: x.r.ma,
      title: 'Г' + (idx + 1) + ' ' + x.l.name,
      lid: x.l.id,
      ph: c.supply === 3 ? (x.r.three ? '3' : x.l.phase) : undefined,
      st: x.r.status
    });
  });
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
  return { c, rows, sumInst, P, Itot, phases, imb, inIn, inS, devs, modSum, size, placed, fits, issues, inStep, hint3 };
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
