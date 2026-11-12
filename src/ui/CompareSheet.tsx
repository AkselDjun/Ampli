import { useMemo, useState } from 'react';
import type { Calc, Project } from '../core/types';
import { ADDONS, compareRows, variantCalc } from '../core/compare';
import { fmt } from '../core/format';
import { Sheet } from './common';
import { Button, DataTable } from './kit';

export function CompareSheet({ open, onClose, p, a }: { open: boolean; onClose: () => void; p: Project; a: Calc }) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [addons, setAddons] = useState<string[]>([]);
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  const alt = useMemo(() => variantCalc(p, excluded, addons), [p, excluded, addons]);
  const rows = compareRows(a, alt);
  const changed = excluded.length + addons.length > 0;
  const diff = changed ? rows.filter(r => r.now !== r.alt).length : 0;
  return (
    <Sheet open={open} onClose={onClose} title="Сравнение вариантов" footer={(
      <>
        <span className="foot-st" role="status">{changed ? 'Отличий от проекта: ' + (excluded.length + addons.length) + ', меняется показателей: ' + diff : 'Отметьте, что убрать или добавить'}</span>
        <Button variant="ghost" disabled={!changed} onClick={() => { setExcluded([]); setAddons([]); }}>Сбросить</Button>
        <Button variant="primary" onClick={onClose}>Готово</Button>
      </>
    )} tip="Отметьте, что убрать или добавить, и сравните ввод и щиток. Сам проект не меняется.">
      <div className="cmp-grid">
      <section className="cmp-res" aria-label="Итог сравнения">
      <p className="cmp-lead muted">{changed ? (diff > 0 ? 'Меняется показателей: ' + diff + ' из ' + rows.length : 'Показатели щитка не меняются') : 'Отметьте ниже, что убрать или добавить, и здесь появятся отличия.'}</p>
      <DataTable label="Сравнение вариантов" className="cmp-t" head={<><th>Показатель</th><th className="num">Сейчас</th><th className="num">Вариант</th></>}>
        {rows.map(r => {
          const same = !changed || r.now === r.alt;
          const tone = same ? '' : (r.worse === true ? 'worse' : (r.worse === false ? 'better' : ''));
          return (
            <tr key={r.label} className={same ? 'same' : 'diff'}>
              <td className="c-t">{r.label}</td>
              <td className="num c-m" data-k="Сейчас">{r.now}</td>
              <td className="num c-v">
                <span className={'cmp ' + tone}>{r.alt}</span>
                {tone && <small className={'cmp-w ' + tone}>{tone === 'worse' ? 'хуже' : 'лучше'}</small>}
              </td>
            </tr>
          );
        })}
      </DataTable>
      {changed && alt.hint3 && <p className="muted">В варианте расчётная нагрузка {fmt(alt.P / 1000, 1)} кВт больше 12 кВт: по СН 4.04.01-2019, п. 9.12 нужен трёхфазный ввод.</p>}
      </section>
      <div className="cmp-pick">
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
      </div>
      </div>
    </Sheet>
  );
}
