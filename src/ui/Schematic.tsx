import type { Calc } from '../core/types';
import { fmt, fs } from '../core/format';
import { cableName } from '../core/protection';

const cut = (t: string, n: number): string => (t.length > n ? t.slice(0, n - 1) + '…' : t);

export function Schematic({ a }: { a: Calc }) {
  const c = a.c;
  const items = a.rows.map((x, i) => ({ x, i })).filter(o => !o.x.r.empty && o.x.r.In);
  const top = 78;
  const step = 50;
  const h = top + Math.max(1, items.length) * step + 8;
  const bus = 60;
  const inLabel = a.inIn ? (c.supply === 3 ? '4P' : '2P') + ' C' + a.inIn : '—';
  const inCable = a.inS ? 'ВВГнг(А)-LS ' + (c.supply === 3 ? 5 : 3) + '×' + fs(a.inS) : '';
  return (
    <svg className="schem" viewBox={'0 0 640 ' + h} role="img" aria-label="Однолинейная схема щитка" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fontFamily="inherit">
      <text x="10" y="16" fill="currentColor" stroke="none" fontSize="12">{c.supply === 3 ? 'Сеть 400/230 В' : 'Сеть 230 В'}</text>
      <path d={'M' + bus + ' 22V38'} />
      <rect x={bus - 18} y="38" width="36" height="28" rx="4" />
      <text x={bus} y="57" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="700">{a.inIn ? 'C' + a.inIn : ''}</text>
      <text x={bus + 30} y="50" fill="currentColor" stroke="none" fontSize="12" fontWeight="700">Вводной автомат {inLabel}</text>
      <text x={bus + 30} y="64" fill="currentColor" stroke="none" fontSize="11">{inCable}</text>
      <path d={'M' + bus + ' 66V' + (top + Math.max(1, items.length) * step - 20)} strokeWidth="3" />
      {items.map(({ x, i }, k) => {
        const y = top + k * step + 12;
        const r = x.r;
        const ph = c.supply === 3 ? (r.three ? '3Ф' : x.l.phase) : '';
        return (
          <g key={x.l.id}>
            <path d={'M' + bus + ' ' + y + 'H130'} />
            {ph && <text x={bus + 8} y={y - 5} fill="currentColor" stroke="none" fontSize="10">{ph}</text>}
            <rect x="130" y={y - 14} width="56" height="28" rx="4" />
            <text x="158" y={y + 4} textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="700">{r.curve}{r.In}</text>
            {r.rcd && (
              <>
                <rect x="186" y={y - 14} width="52" height="28" rx="4" strokeDasharray="4 3" />
                <text x="212" y={y + 4} textAnchor="middle" fill="currentColor" stroke="none" fontSize="11">{r.ma} мА</text>
              </>
            )}
            <path d={'M' + (r.rcd ? 238 : 186) + ' ' + y + 'H262'} />
            <text x="270" y={y - 3} fill="currentColor" stroke="none" fontSize="12" fontWeight="700">Г{i + 1} {cut(x.l.name || 'Без названия', 34)}</text>
            <text x="270" y={y + 12} fill="currentColor" stroke="none" fontSize="11">{cableName(r)} · {fmt(r.pInst, 0)} Вт · {fmt(r.I, 1)} А</text>
          </g>
        );
      })}
    </svg>
  );
}
