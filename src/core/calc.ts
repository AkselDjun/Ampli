import type { Appliance, BoxType, Calc, Cfg, CfgN, Device, InCable, Line, LineResult, Phase, Row, Uzo } from './types';
import { ALL_STEPS, HEAT_RX, TYPE_A_RX, VR_STD, HEAT_PLUG_KW, SN_CH2_DATE, INS_MIN_MOHM, rcdTripMs, IZ, KZ_TIME, LEAK_FRACTION, LEAK_PER_A_MA, LOAD_WARN, LONG_MIN_IN, LONG_RX, MARGIN_MAX, MOTOR_COS, MOTOR_RX, RCD10_MAX_IN, IN_CABLE, LEAK_PER_M_MA, PE_MAX_S, RHO, RHO_HOT_K, RCD_STD, ROWLEN, SECTIONS, SINGLE_INPUT_KW, SIZES, STD, STD_IN, TRIP_MULT, TYPES } from './norms';
import { fmt, fs, pn } from './format';
import type { Weak } from './weak';
import { weakCalc, weakStarted } from './weak';
import type { FloorRoom } from './floor';
import { floorCalc } from './floor';
import { houseCalc, houseTips } from './house';
import { evNotes } from './ev';
import { spdName, spdType } from './protection';

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
    inCable: c.inCable === 'frls' || c.inCable === 'nym' ? (c.inCable as InCable) : 'vvg',
    spd: c.spd === 'on',
    vr: c.vr === 'on',
    afdd: c.afdd === 'sock' || c.afdd === 'all' ? c.afdd : 'off',
    margin: Math.min(MARGIN_MAX, Math.max(1, pn(c.margin, 1))),
    grpCable: c.grpCable === 'frls' || c.grpCable === 'nym' ? (c.grpCable as InCable) : 'vvg',
    house: c.obj === 'house',
    sip: Math.min(500, Math.max(0, pn(c.sip, 0))),
    rz: measOf(c.rz)
  };
}

const isBox = (b: unknown): b is BoxType => b === 'brick' || b === 'gkl' || b === 'surface';
const boxOf = (c: Cfg): BoxType => (isBox(c.box) ? c.box : (c.method === 'open' ? 'surface' : 'brick'));

const measOf = (v: unknown): number | null => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const x = pn(v, NaN);
  return Number.isFinite(x) ? x : null;
};

export const appW = (a: Appliance): number => Math.max(0, pn(a.w, 0)) * (a.m !== undefined ? Math.max(0, pn(a.m, 0)) : 1) * Math.max(0, pn(a.n, 0));
export const appCos = (a: Appliance): number => {
  const v = pn(a.cos, 0);
  if (v >= 0.3 && v <= 1) return v;
  return MOTOR_RX.test(a.name) ? MOTOR_COS : 1;
};
export const appVA = (a: Appliance): number => appW(a) / appCos(a);

export function demand(apps: Appliance[]): { w: number; va: number } {
  const live = apps.filter(a => appW(a) > 0);
  const base = live.filter(a => !a.alt);
  const alt = live.filter(a => a.alt);
  const top = alt.reduce<Appliance | null>((m, a) => (!m || appVA(a) > appVA(m) ? a : m), null);
  const w = base.reduce((s, a) => s + appW(a), 0) + (top ? appW(top) : 0);
  const va = base.reduce((s, a) => s + appVA(a), 0) + (top ? appVA(top) : 0);
  return { w, va };
}

export const appBr = (a: Appliance): number => Math.max(0, pn(a.br, 0));
export const zoneOf = (l: Line): string => (l.zone ?? '').trim() || 'Без помещения';

export function loopOhm(S: number, len: number): number {
  const pe = Math.min(S, PE_MAX_S);
  return RHO * RHO_HOT_K * len * (1 / S + 1 / pe);
}

export function shortCircuit(S: number, len: number, zs: number): number {
  return 230 / (zs + loopOhm(S, len));
}

export const vrRating = (inIn: number): number | null => VR_STD.find(x => x >= inIn) ?? null;

export function calcLine(l: Line, c: CfgN, zoneMa?: number): LineResult {
  const t = TYPES[l.type];
  const nSock = l.type === 'socket' ? Math.max(0, Math.round(pn(l.sockets, 0))) : 0;
  const sockW = nSock * Math.max(0, pn(l.perSocket, 0));
  const pInst = l.apps.reduce((s, a) => s + appW(a), 0) + sockW;
  const dm = demand(l.apps);
  const main = Math.max(0, pn(l.len, 0));
  const live = l.apps.filter(a => appW(a) > 0);
  const len = main + live.reduce((m, a) => Math.max(m, appBr(a)), 0);
  const cable = main + live.reduce((s, a) => s + appBr(a) * Math.max(1, Math.round(pn(a.n, 1))), 0);
  const three = c.supply === 3 && l.type === 'power' && l.phase === '3';
  const pd = dm.w + sockW;
  const va = dm.va + sockW;
  const cos = va > 0 ? pd / va : 1;
  const I = three ? va / (Math.sqrt(3) * 400) : va / 230;
  const lim0 = (l.type === 'light' ? 3 : 5) + Math.min(0.5, Math.max(0, len - 100) * 0.005);
  const lim = Math.max(0.5, lim0 - c.feeder);
  const rcbo = t.rcd && !c.rcdMode;
  const ma = !t.rcd ? 0 : (zoneMa ?? (l.wet ? 10 : 30));
  const aApps = live.filter(a => TYPE_A_RX.test(a.name));
  const rcdA = t.rcd && aApps.length > 0;
  const arc = !three && (c.afdd === 'all' || (c.afdd === 'sock' && l.type === 'socket'));
  const arcSkip = three && c.afdd === 'all';
  const r: LineResult = {
    limit: lim, pInst, pd, I, three, len, cos, load: 0, cab: IN_CABLE[c.grpCable], notes: [], tips: [], status: 'ok', rcd: t.rcd, rcbo, rcdA, arc, zone: c.rcdMode ? zoneOf(l) : '', uzo: null, cable, sockets: nSock,
    ma, curve: t.curve, In: null, S: null, drop: 0, empty: false,
    mod: three ? (rcbo ? 4 : 3) : (rcbo || arc ? 2 : 1), ik: 0, ikNeed: 0, ikSrc: 'calc',
    zsMeas: null, insMeas: null, leakMeas: null, leakLim: 0, leakEst: 0, rcdMeas: null, rcdLim: 0
  };
  if (pInst <= 0) {
    r.empty = true;
    r.I = 0;
    r.pd = 0;
    return r;
  }
  const longMin = l.type === 'power' && live.some(a => LONG_RX.test(a.name)) ? LONG_MIN_IN : 0;
  const need = Math.max(I * c.margin, t.minIn, longMin);
  r.In = STD.find(x => x >= need) ?? null;
  if (!r.In && I <= STD[STD.length - 1]) r.In = STD.find(x => x >= Math.max(I, t.minIn, longMin)) ?? null;
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
    r.notes.push('Сечение увеличено до ' + fs(r.S) + ' мм², чтобы автомат отключил короткое замыкание за ' + fs(KZ_TIME) + ' с.' + (l.type !== 'power' && r.S > 4 ? ' Такой кабель не заходит в клеммы розеток и выключателей: сократите линию' + (t.curve === 'C' ? ' или возьмите автомат с кривой B' : '') + '.' : ''));
  }
  if ((len > 0 || r.zsMeas !== null) && r.ik < r.ikNeed) {
    r.status = 'bad';
    r.notes.push(r.ikSrc === 'meas'
      ? 'По замеру петли ' + fmt(r.zsMeas as number, 2) + ' Ом ток короткого замыкания ' + fmt(r.ik, 0) + ' А меньше ' + fmt(r.ikNeed, 0) + ' А: автомат не обеспечит отключение за ' + fs(KZ_TIME) + ' с (ТКП 339-2022, п. 4.4.28.5).'
      : 'Ток короткого замыкания в конце линии ' + fmt(r.ik, 0) + ' А меньше ' + fmt(r.ikNeed, 0) + ' А: автомат может не отключить линию за ' + fs(KZ_TIME) + ' с. Сократите линию.');
  }
  if (r.rcd) {
    r.leakLim = r.ma * LEAK_FRACTION;
    r.leakEst = cable * LEAK_PER_M_MA + I * LEAK_PER_A_MA;
    const lm = measOf(l.meas?.leak);
    if (lm !== null && lm >= 0) r.leakMeas = lm;
    if (r.leakMeas !== null && r.leakMeas > r.leakLim) {
      r.status = 'bad';
      r.notes.push('Ток утечки ' + fmt(r.leakMeas, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА): возможны ложные отключения (СН 4.04.01-2019, п. 16.3.7).');
    } else if (!c.rcdMode && r.leakMeas === null && r.leakEst > r.leakLim) {
      r.tips.push('Оценка утечки линии с приборами около ' + fmt(r.leakEst, 1) + ' мА больше трети уставки УЗО (' + fmt(r.leakLim, 1) + ' мА, СН 4.04.01-2019, п. 16.3.7). Оценка по 0,4 мА на 1 А нагрузки без данных изготовителя: замерьте утечку при приёмке.');
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
  const im = measOf(l.meas?.ins);
  if (im !== null && im >= 0) {
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
  r.load = r.In ? I / r.In : 0;
  if (r.load > LOAD_WARN) r.tips.push('Автомат загружен на ' + fmt(r.load * 100, 0) + ' %. В плотно собранном щитке автоматы нагреваются и могут отключаться раньше номинала: задайте запас по автомату в параметрах сети.');
  const plain = STD.find(x => x >= Math.max(I * c.margin, t.minIn));
  if (longMin && plain !== undefined && plain < LONG_MIN_IN) r.tips.push('Автомат не меньше ' + LONG_MIN_IN + ' А для стиральной, сушильной и посудомоечной машины, водонагревателя: длительная нагрузка с нагревателем.');
  if (r.rcd && r.ma === 10 && r.In > RCD10_MAX_IN) {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push((r.rcbo ? 'Дифавтоматы' : 'УЗО') + ' на 10 мА выпускаются на ток до ' + RCD10_MAX_IN + ' А, а группе нужен автомат ' + r.In + ' А. Разделите нагрузку на несколько групп' + (c.supply === 3 && l.type === 'power' && !three ? ' или переведите прибор на трёхфазную группу' : '') + '.');
  }
  if (l.type === 'socket' && r.In > 16) {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push('Для розеточной группы это много. Вынесите мощные приборы в отдельные линии.');
  }
  if (len === 0) {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push('Укажите длину линии, иначе падение напряжения не проверяется.');
  }
  if (rcdA) {
    const names = aApps.map(a => a.name.trim().toLowerCase()).filter((v, i, arr) => arr.indexOf(v) === i);
    r.tips.push('УЗО типа A: ' + names.join(', ') + (names.length > 1 ? ' дают' : ' даёт') + ' пульсирующий ток утечки, на который УЗО типа AC может не сработать.');
  }
  if (arcSkip) r.tips.push('УЗДП не ставится: трёхфазная линия, защита от дугового пробоя в расчёте только для однофазных групп.');
  evNotes(l, live, three, r);
  const heat = live.filter(a => HEAT_RX.test(a.name));
  if (heat.length) {
    if (live.length > heat.length) {
      r.status = r.status === 'bad' ? 'bad' : 'warn';
      r.notes.push('Водонагреватель и приборы отопления подключают отдельной линией от квартирного щитка, без других приборов (СН 4.04.01-2019, п. 14.4).');
    }
    const big = heat.some(a => Math.max(0, pn(a.w, 0)) * (a.m !== undefined ? Math.max(0, pn(a.m, 0)) : 1) > HEAT_PLUG_KW * 1000);
    (big ? r.notes : r.tips).push((big ? 'Прибор мощнее ' + HEAT_PLUG_KW + ' кВт: подключение неразъёмное, без вилки и розетки (СН 4.04.01-2019, п. 14.4). ' : '') + 'С ' + SN_CH2_DATE + ' по изменению № 2 к СН 4.04.01-2019 (п. 14.4) водонагреватели и приборы отопления любой мощности подключают неразъёмно, без вилки и розетки.');
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

export const WET_SFX = ' (10 мА)';

const zoneMa = (rs: LineResult[], ls: Line[]): number => (ls.some((l, i) => l.wet && rs[i].rcd) ? 10 : 30);

function planUzos(lines: Line[], c: CfgN): { rows: Row[]; uzos: Uzo[] } {
  const first = lines.map(l => calcLine(l, c));
  if (!c.rcdMode) return { rows: lines.map((l, i) => ({ l, r: first[i] })), uzos: [] };
  const order: string[] = [];
  const by = new Map<string, number[]>();
  const live = (i: number): boolean => !first[i].empty && !!first[i].In && first[i].rcd;
  const mixed = new Set(lines.filter((l, i) => live(i) && l.wet).map(zoneOf).filter(z => lines.some((l, i) => live(i) && !l.wet && zoneOf(l) === z)));
  const keyOf = (l: Line): string => zoneOf(l) + (l.wet && mixed.has(zoneOf(l)) ? WET_SFX : '');
  lines.forEach((l, i) => {
    const r = first[i];
    if (r.empty || !r.In || !r.rcd) return;
    const z = keyOf(l);
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
  const keyAt = new Map<number, string>();
  const order2: string[] = [];
  const by2 = new Map<string, number[]>();
  const put = (z: string, i: number): void => {
    if (!by2.has(z)) {
      by2.set(z, []);
      order2.push(z);
    }
    (by2.get(z) as number[]).push(i);
    keyAt.set(i, z);
  };
  order.forEach(z => {
    const idx = by.get(z) as number[];
    const ma = maOf.get(z) as number;
    const sum = idx.reduce((s, i) => s + (first[i].In as number), 0);
    if (ma !== 10 || sum <= RCD10_MAX_IN) {
      idx.forEach(i => put(z, i));
      return;
    }
    const parts: number[][] = [];
    idx.forEach(i => {
      const In = first[i].In as number;
      const last = parts[parts.length - 1];
      const have = last ? last.reduce((s, j) => s + (first[j].In as number), 0) : 0;
      if (last && have + In <= RCD10_MAX_IN) last.push(i);
      else parts.push([i]);
    });
    parts.forEach((g, k) => {
      const zk = parts.length > 1 ? z + ' · ' + (k + 1) : z;
      maOf.set(zk, ma);
      g.forEach(i => put(zk, i));
    });
  });
  const rows: Row[] = lines.map((l, i) => {
    const z = keyAt.get(i);
    if (z === undefined || !first[i].rcd) return { l, r: first[i] };
    const r = calcLine(l, c, maOf.get(z));
    r.zone = z;
    return { l, r };
  });
  const uzos: Uzo[] = order2.map((z, k) => {
    const idx = by2.get(z) as number[];
    const rs = idx.map(i => rows[i].r);
    const sumIn = rs.reduce((s, r) => s + (r.In as number), 0);
    const maxIn = rs.reduce((m, r) => Math.max(m, r.In as number), 0);
    const phases = new Set(idx.map(i => lines[i].phase));
    const four = c.supply === 3 && (rs.some(r => r.three) || phases.size > 1);
    const typeA = rs.some(r => r.rcdA);
    const need = Math.max(maxIn, sumIn);
    const In = RCD_STD.find(x => x >= need) ?? RCD_STD[RCD_STD.length - 1];
    const ma = maOf.get(z) as number;
    const est = rs.filter(r => r.leakMeas === null);
    const leak = rs.reduce((s, r) => s + (r.leakMeas ?? 0), 0) + est.reduce((s, r) => s + r.cable * LEAK_PER_M_MA + r.I * LEAK_PER_A_MA * c.ko, 0);
    idx.forEach(i => {
      const r = rows[i].r;
      r.uzo = k;
    });
    if (leak > ma * LEAK_FRACTION) {
      idx.forEach(i => {
        const r = rows[i].r;
        if (est.length) {
          r.tips.push('Оценка суммарной утечки групп на УЗО «' + z + '» около ' + fmt(leak, 1) + ' мА больше трети уставки ' + ma + ' мА (СН 4.04.01-2019, п. 16.3.7). Оценка по 0,4 мА на 1 А нагрузки с коэффициентом одновременности: замерьте утечку или разделите помещение на два УЗО.');
        } else {
          r.status = r.status === 'bad' ? 'bad' : 'warn';
          r.notes.push('Суммарная утечка групп на УЗО «' + z + '» по замерам ' + fmt(leak, 1) + ' мА больше трети уставки ' + ma + ' мА (СН 4.04.01-2019, п. 16.3.7). Разделите помещение на два УЗО.');
        }
      });
    }
    return { zone: z, In, ma, four, typeA, groups: idx, leak, sumIn };
  });
  return { rows, uzos };
}

export function calcAll(lines: Line[], cfg: Cfg, ex: { weak?: Weak; floor?: FloorRoom[] } = {}): Calc {
  const weak = ex.weak;
  const floor = (ex.floor ?? []).filter(r => floorCalc(r).ok);
  const c = cfgN(cfg);
  const { rows, uzos } = planUzos(lines, c);
  if (c.house) rows.forEach(x => { if (!x.r.empty) houseTips(x.l, x.r.tips); });
  const sumInst = rows.reduce((s, x) => s + x.r.pInst, 0);
  const sumD = rows.reduce((s, x) => s + x.r.pd, 0);
  const prio = prioPlan(rows);
  const P = (sumD - prio.pd) * c.ko;
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
    ph.L1 = (ph.L1 - prio.ph.L1) * c.ko;
    ph.L2 = (ph.L2 - prio.ph.L2) * c.ko;
    ph.L3 = (ph.L3 - prio.ph.L3) * c.ko;
    phases = ph;
    Itot = Math.max(ph.L1, ph.L2, ph.L3);
  } else {
    Itot = c.ko * (rows.reduce((s, x) => s + x.r.I, 0) - prio.I);
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
  if (inIn && c.vr) {
    const vr = vrRating(inIn);
    const n = c.supply === 3 ? 3 : 1;
    devs.push({ kind: 'vr', mod: 2 * n, label: vr ? vr + 'А' : 'РН', sub: n > 1 ? '3 × реле' : 'реле U', title: 'Реле контроля напряжения' + (n > 1 ? ', по одному на фазу' : '') + (vr ? ' ' + vr + ' А' : ', через контактор') });
  }
  if (prio.on) {
    const pName = prio.p.map(i => 'Г' + (i + 1)).join(', ');
    const sName = prio.s.map(i => 'Г' + (i + 1)).join(', ');
    devs.push({ kind: 'prio', mod: PRIO_MOD, label: 'РПН', sub: 'приоритет', title: 'Реле приоритета нагрузки: при работе ' + pName + ' отключает ' + sName });
    prio.s.forEach(i => {
      const r = rows[i].r;
      devs.push({ kind: 'prio', mod: r.three ? 4 : 2, label: 'КМ' + contactorIn(r.In ?? 0), sub: 'Г' + (i + 1), title: 'Контактор ' + (r.three ? '4P' : '2P') + ' ' + contactorIn(r.In ?? 0) + ' А: отключение Г' + (i + 1) + ' реле приоритета' });
    });
  }
  if (inIn && c.spd) devs.push({ kind: 'spd', mod: c.supply === 3 ? 4 : 2, label: 'УЗИП', sub: 'тип ' + spdType(c), title: spdName(c) });
  const groupDev = (x: Row, idx: number): Device => ({
    kind: x.r.rcbo ? 'rcd' : 'mcb',
    mod: x.r.mod,
    label: x.r.curve + x.r.In,
    sub: 'Г' + (idx + 1) + (x.r.rcbo ? ' ' + x.r.ma + 'мА' : ''),
    ...(x.r.arc ? { arc: true } : {}),
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
  return { c, rows, sumInst, P, Itot, ...(prio.on ? { prio: { p: prio.p, s: prio.s } } : {}), phases, imb, inIn, inS, devs, modSum, size, placed, fits, issues, inStep, hint3, uzos, boxes, ...(weakStarted(weak) ? { weak: weakCalc(weak) } : {}), ...(floor.length ? { floor } : {}), ...(c.house ? { house: houseCalc(c, rows, Itot, inIn) } : {}) };
}

export const PRIO_MOD = 2;
const CONTACTOR_IN = [16, 20, 25, 32, 40, 63, 80, 100];

export function contactorIn(In: number): number {
  return CONTACTOR_IN.find(x => x >= In) ?? CONTACTOR_IN[CONTACTOR_IN.length - 1];
}

export function prioPlan(rows: Row[]): { on: boolean; p: number[]; s: number[]; pd: number; I: number; ph: { L1: number; L2: number; L3: number } } {
  const p: number[] = [];
  const s: number[] = [];
  rows.forEach((x, i) => {
    if (x.r.empty || !x.r.In) return;
    if (x.l.prio === 'p') p.push(i);
    else if (x.l.prio === 's') s.push(i);
  });
  const ph = { L1: 0, L2: 0, L3: 0 };
  if (!p.length || !s.length) return { on: false, p, s, pd: 0, I: 0, ph };
  const sum = (ids: number[], f: (r: LineResult) => number) => ids.reduce((acc, i) => acc + f(rows[i].r), 0);
  const onPh = (ids: number[], k: 'L1' | 'L2' | 'L3') => ids.reduce((acc, i) => {
    const x = rows[i];
    const key = x.l.phase === 'L2' || x.l.phase === 'L3' ? x.l.phase : 'L1';
    return acc + (x.r.three || key === k ? x.r.I : 0);
  }, 0);
  (['L1', 'L2', 'L3'] as const).forEach(k => { ph[k] = Math.min(onPh(p, k), onPh(s, k)); });
  return { on: true, p, s, pd: Math.min(sum(p, r => r.pd), sum(s, r => r.pd)), I: Math.min(sum(p, r => r.I), sum(s, r => r.I)), ph };
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
