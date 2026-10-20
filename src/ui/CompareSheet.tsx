import { useMemo, useState } from 'react';
import type { Calc, Project } from '../core/types';
import { ADDONS, compareRows, variantCalc } from '../core/compare';
import { fmt } from '../core/format';
import { Sheet } from './common';

export function CompareSheet({ open, onClose, p, a }: { open: boolean; onClose: () => void; p: Project; a: Calc }) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [addons, setAddons] = useState<string[]>([]);
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  const alt = useMemo(() => variantCalc(p, excluded, addons), [p, excluded, addons]);
  const rows = compareRows(a, alt);
  const changed = excluded.length + addons.length > 0;
  return (
    <Sheet open={open} onClose={onClose} title="Сравнение вариантов" tip="Отметьте, что убрать или добавить, и сравните ввод и щиток. Сам проект не меняется.">
      <h3 className="sec-t">Убрать из расчёта</h3>
      <ul className="ck">
        {p.lines.map((l, i) => (
          <li key={l.id}>
            <label>
              <input type="checkbox" checked={excluded.includes(l.id)} onChange={() => toggle(excluded, setExcluded, l.id)} />
              <span className="ck-t"><b>Г{i + 1} {l.name || 'Без названия'}</b></span>
            </label>
          </li>
        ))}
      </ul>
      <h3 className="sec-t">Добавить</h3>
      <ul className="ck">
        {ADDONS.map(ad => (
          <li key={ad.id}>
            <label>
              <input type="checkbox" checked={addons.includes(ad.id)} onChange={() => toggle(addons, setAddons, ad.id)} />
              <span className="ck-t"><b>{ad.title}</b></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="tablewrap">
        <table className="t2">
          <thead>
            <tr><th>Показатель</th><th className="num">Сейчас</th><th className="num">Вариант</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td className="t-name">{r.label}</td>
                <td className="num" data-label="Сейчас">{r.now}</td>
                <td className="num" data-label="Вариант">
                  <span className={'cmp ' + (changed && r.worse === true ? 'worse' : (changed && r.worse === false ? 'better' : ''))}>{r.alt}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {changed && alt.hint3 && <p className="muted">В варианте расчётная нагрузка {fmt(alt.P / 1000, 1)} кВт больше 12 кВт: по СН 4.04.01-2019, п. 9.12 нужен трёхфазный ввод.</p>}
      <div className="data-row">
        <button className="btn ghost" type="button" disabled={!changed} onClick={() => { setExcluded([]); setAddons([]); }}>Сбросить</button>
      </div>
    </Sheet>
  );
}
