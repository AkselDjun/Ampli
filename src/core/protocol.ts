import type { Calc } from './types';

export interface ProtoRow {
  no: string;
  name: string;
  prot: string;
  zs: number | null;
  ik: number | null;
  need: number;
  leak: number | null;
  leakLim: number;
  ins: number | null;
  verdict: 'ok' | 'bad' | 'none';
}

export function protocolRows(a: Calc): ProtoRow[] {
  const out: ProtoRow[] = [];
  a.rows.forEach((x, i) => {
    const r = x.r;
    if (r.empty || !r.In) return;
    const measured = r.zsMeas !== null || r.insMeas !== null || r.leakMeas !== null;
    const bad =
      (r.zsMeas !== null && r.ik < r.ikNeed) ||
      (r.leakMeas !== null && r.leakMeas > r.leakLim) ||
      (r.insMeas !== null && r.insMeas < 0.5);
    out.push({
      no: 'Г' + (i + 1),
      name: x.l.name || 'Без названия',
      prot: r.curve + r.In + (r.rcd ? ' · ' + r.ma + ' мА' : ''),
      zs: r.zsMeas,
      ik: r.zsMeas !== null ? r.ik : null,
      need: r.ikNeed,
      leak: r.leakMeas,
      leakLim: r.leakLim,
      ins: r.insMeas,
      verdict: !measured ? 'none' : (bad ? 'bad' : 'ok')
    });
  });
  return out;
}

export const hasMeasurements = (a: Calc): boolean => protocolRows(a).some(r => r.verdict !== 'none');

export const VERDICT = { ok: 'Соответствует', bad: 'Не соответствует', none: 'Не измерено' } as const;
