import type { Calc, Row, Uzo } from '../core/types';
import { fmt } from '../core/format';
import { cableName, inCableName } from '../core/protection';

const cut = (t: string, n: number): string => (t.length > n ? t.slice(0, n - 1) + '…' : t);

type Entry = { k: 'g'; x: Row; i: number; sub: boolean } | { k: 'u'; u: Uzo; n: number };

export function Schematic({ a }: { a: Calc }) {
  const c = a.c;
  const ok = (x: Row) => !x.r.empty && !!x.r.In;
  const entries: Entry[] = [];
  if (a.uzos.length) {
    a.uzos.forEach(u => {
      entries.push({ k: 'u', u, n: u.groups.length });
      u.groups.forEach(i => entries.push({ k: 'g', x: a.rows[i], i, sub: true }));
    });
    a.rows.forEach((x, i) => {
      if (ok(x) && x.r.uzo === null) entries.push({ k: 'g', x, i, sub: false });
    });
  } else {
    a.rows.forEach((x, i) => {
      if (ok(x)) entries.push({ k: 'g', x, i, sub: false });
    });
  }
  const top = 78;
  const step = 50;
  const h = top + Math.max(1, entries.length) * step + 8;
  const bus = 60;
  const inLabel = a.inIn ? (c.supply === 3 ? '4P' : '2P') + ' C' + a.inIn : (a.P > 0 ? 'не подобран, см. замечания' : '—');
  const inCable = a.inS ? inCableName(c, a.inS) : '';
  const t = { fill: 'currentColor', stroke: 'none' } as const;
  const lastTop = (() => {
    let last = -1;
    entries.forEach((e, k) => {
      if (e.k === 'u' || !e.sub) last = k;
    });
    return last;
  })();
  return (
    <svg className="schem" viewBox={'0 0 640 ' + h} role="img" aria-label="Однолинейная схема щитка" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <text x="10" y="16" {...t} fontSize="12">{c.supply === 3 ? 'Сеть 400/230 В' : 'Сеть 230 В'}</text>
      <path d={'M' + bus + ' 22V38'} />
      <rect x={bus - 18} y="38" width="36" height="28" rx="4" />
      <text x={bus} y="57" textAnchor="middle" {...t} fontSize="12" fontWeight="700">{a.inIn ? 'C' + a.inIn : ''}</text>
      <text x={bus + 30} y="50" {...t} fontSize="12" fontWeight="700">Вводной автомат {inLabel}</text>
      <text x={bus + 30} y="64" {...t} fontSize="11">{inCable}</text>
      <path d={'M' + bus + ' 66V' + (top + Math.max(0, lastTop) * step + 12)} strokeWidth="3" />
      {entries.map((e, k) => {
        const y = top + k * step + 12;
        if (e.k === 'u') {
          const u = e.u;
          return (
            <g key={'u' + u.zone}>
              <path d={'M' + bus + ' ' + y + 'H130'} />
              <rect x="130" y={y - 14} width="64" height="28" rx="4" strokeDasharray="4 3" />
              <text x="162" y={y - 2} textAnchor="middle" {...t} fontSize="10" fontWeight="700">{u.In + ' А'}</text>
              <text x="162" y={y + 9} textAnchor="middle" {...t} fontSize="9">{u.ma + ' мА' + (u.typeA ? ', A' : '')}</text>
              <path d={'M194 ' + y + 'H206V' + (y + e.n * step)} strokeWidth="2.5" />
              <text x="214" y={y - 3} {...t} fontSize="12" fontWeight="700">УЗО: {cut(u.zone, 34)}</text>
              <text x="214" y={y + 12} {...t} fontSize="11">своя шина N, групп: {e.n}</text>
            </g>
          );
        }
        const r = e.x.r;
        const x0 = e.sub ? 206 : bus;
        const b = e.sub ? 226 : 130;
        const ph = c.supply === 3 ? (r.three ? '3Ф' : e.x.l.phase) : '';
        return (
          <g key={e.x.l.id}>
            <path d={'M' + x0 + ' ' + y + 'H' + b} />
            {ph && <text x={x0 + 6} y={y - 5} {...t} fontSize="10">{ph}</text>}
            <rect x={b} y={y - 14} width="56" height="28" rx="4" />
            <text x={b + 28} y={y + 4} textAnchor="middle" {...t} fontSize="12" fontWeight="700">{r.curve}{r.In}</text>
            {r.rcbo && (
              <>
                <rect x={b + 56} y={y - 14} width="52" height="28" rx="4" strokeDasharray="4 3" />
                <text x={b + 82} y={y + 4} textAnchor="middle" {...t} fontSize="11">{r.ma} мА</text>
              </>
            )}
            <path d={'M' + (b + (r.rcbo ? 108 : 56)) + ' ' + y + 'H' + (b + 132)} />
            <text x={b + 140} y={y - 3} {...t} fontSize="12" fontWeight="700">Г{e.i + 1} {cut(e.x.l.name || 'Без названия', e.sub ? 26 : 34)}</text>
            <text x={b + 140} y={y + 12} {...t} fontSize="11">{r.arc ? 'УЗДП · ' : ''}{cableName(r)} · {fmt(r.pInst, 0)} Вт · {fmt(r.I, 1)} А</text>
          </g>
        );
      })}
    </svg>
  );
}
