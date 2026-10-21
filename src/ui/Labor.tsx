import type { Calc, Project } from '../core/types';
import { fmt } from '../core/format';
import { buildSpec, estimate } from '../core/spec';
import { grandTotal, laborEstimate } from '../core/labor';
import type { LaborEstimate } from '../core/labor';
import type { Action } from '../store/reducer';
import { useLib } from '../store/LibContext';
import { Tip } from './common';

export function LaborTable({ p, a, dispatch }: { p: Project; a: Calc; dispatch: (x: Action) => void }) {
  const { lib, dispatch: libDispatch } = useLib();
  const le = laborEstimate(a, p.work, lib.labor);
  return (
    <>
      <div className="sec-row">
        <h3 className="sec-t">Работы<Tip>Количество подставляется из проекта, его можно изменить. Ваши расценки сохраняются на этом устройстве и подставляются во все проекты.</Tip></h3>
      </div>
      <div className="tablewrap">
        <table className="t2 labor">
          <thead>
            <tr><th>Работа</th><th className="num">Количество</th><th className="num">Цена, BYN</th><th className="num">Сумма, BYN</th></tr>
          </thead>
          <tbody>
            {le.rows.map(r => (
              <tr key={r.def.key} className={r.qty > 0 ? '' : 'idle'}>
                <td className="t-name">{r.def.name}<small className="muted lb-hint">{r.def.hint}</small></td>
                <td className="num" data-label="Количество">
                  <span className="lb-q">
                    <input className="price-in" type="number" inputMode="decimal" min={0} step="any" aria-label={'Количество: ' + r.def.name} placeholder={String(r.auto)} value={r.manual ? String(r.qty) : ''} onChange={e => dispatch({ t: 'workQty', key: r.def.key, value: e.target.value })} />
                    <span className="lb-u">{r.def.unit}</span>
                  </span>
                </td>
                <td className="num" data-label="Цена, BYN">
                  <input className="price-in" type="number" inputMode="decimal" min={0} step={0.01} aria-label={'Цена: ' + r.def.name} value={lib.labor[r.def.key] ?? ''} onChange={e => libDispatch({ t: 'labor', key: r.def.key, value: e.target.value })} />
                </td>
                <td className="num" data-label="Сумма, BYN">{r.sum === null ? '—' : fmt(r.sum, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function totals(a: Calc, p: Project, prices: Record<string, number>, labor: Parameters<typeof laborEstimate>[2]): { materials: number; works: number; total: number; le: LaborEstimate } {
  const materials = estimate(buildSpec(a), prices).total;
  const le = laborEstimate(a, p.work, labor);
  return { materials, works: le.total, total: grandTotal(materials, le.total), le };
}

export function Totals({ materials, works, total }: { materials: number; works: number; total: number }) {
  return (
    <dl className="tot">
      <div><dt>Материалы</dt><dd className="mono">{fmt(materials, 2)} BYN</dd></div>
      <div><dt>Работы</dt><dd className="mono">{fmt(works, 2)} BYN</dd></div>
      <div className="tot-all"><dt>Итого</dt><dd className="mono">{fmt(total, 2)} BYN</dd></div>
    </dl>
  );
}
