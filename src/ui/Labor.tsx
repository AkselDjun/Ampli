import type { Calc, Project } from '../core/types';
import { fmt } from '../core/format';
import { buildSpec, estimate } from '../core/spec';
import { grandTotal, laborEstimate } from '../core/labor';
import type { LaborEstimate } from '../core/labor';
import type { Action } from '../store/reducer';
import { useLib } from '../store/LibContext';
import { Err, Tip, errAttrs } from './common';
import { fieldErr } from '../core/limits';
import { DataTable, MoneyInput } from './kit';

export function LaborTable({ p, a, dispatch }: { p: Project; a: Calc; dispatch: (x: Action) => void }) {
  const { lib, dispatch: libDispatch } = useLib();
  const le = laborEstimate(a, p.work, lib.labor);
  return (
    <>
      <div className="sec-row">
        <h3 className="sec-t">Работы<Tip>Количество подставляется из проекта, его можно изменить. Ваши расценки сохраняются на этом устройстве и подставляются во все проекты.</Tip></h3>
      </div>
      <DataTable label="Работы" className="labor" head={<><th>Работа</th><th className="num">Количество</th><th className="num">Цена</th><th className="num">Сумма, BYN</th></>}>
        {le.rows.filter(r => r.manual || (r.def.key === 'floor' ? !!a.floor : r.def.key === 'weak' || r.def.key === 'weakCable' ? !!a.weak : true)).map(r => (
          <tr key={r.def.key} className={r.qty > 0 ? '' : 'idle'}>
            <td className="c-t">{r.def.name}<small className="dt-note">{r.def.hint}</small></td>
            <td className="num c-m">
              <span className="lb-q">
                <input className="price-in" type="text" inputMode="decimal" min={0} step="any" aria-label={'Количество: ' + r.def.name} placeholder={String(r.auto)} value={r.manual ? String(r.qty) : ''} onChange={e => dispatch({ t: 'workQty', key: r.def.key, value: e.target.value })} />
                <span className="lb-u">{r.def.unit}</span>
              </span>
            </td>
            <td className="num c-v">
              <MoneyInput aria-label={'Цена: ' + r.def.name} {...errAttrs(fieldErr('rate', lib.labor[r.def.key]), 'e-lb-' + r.def.key)} value={lib.labor[r.def.key] ?? ''} onChange={e => libDispatch({ t: 'labor', key: r.def.key, value: e.target.value })} />
              <Err e={fieldErr('rate', lib.labor[r.def.key])} id={'e-lb-' + r.def.key} />
            </td>
            <td className={'num c-m lb-sum' + (r.sum === null ? ' dt-nil' : '')} data-k="Сумма">{r.sum === null ? '—' : fmt(r.sum, 2)}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

export function totals(a: Calc, p: Project, prices: Record<string, number>, labor: Parameters<typeof laborEstimate>[2]): { materials: number; works: number; total: number; le: LaborEstimate } {
  const materials = estimate(buildSpec(a), prices).total;
  const le = laborEstimate(a, p.work, labor);
  return { materials, works: le.total, total: grandTotal(materials, le.total), le };
}

const money = (v: number): string => (v > 0 ? fmt(v, 2) + ' BYN' : '—');

export function Totals({ materials, works, total }: { materials: number; works: number; total: number }) {
  return (
    <dl className="tot">
      <div><dt>Материалы</dt><dd className="mono">{money(materials)}</dd></div>
      <div><dt>Работы</dt><dd className="mono">{money(works)}</dd></div>
      <div className="tot-all"><dt>Итого</dt><dd className={total > 0 ? 'mono' : 'tot-none'}>{total > 0 ? money(total) : 'цены не заданы'}</dd></div>
    </dl>
  );
}
