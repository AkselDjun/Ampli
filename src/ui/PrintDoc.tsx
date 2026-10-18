import type { Calc, Project } from '../core/types';
import { dfmt, fmt, fs } from '../core/format';
import { STATUS } from '../core/norms';
import { buildSpec } from '../core/spec';
import { cableName, protName } from '../core/protection';
import { dropText } from '../core/report';

export function PrintDoc({ p, a }: { p: Project; a: Calc }) {
  const c = a.c;
  const three = c.supply === 3;
  const spec = buildSpec(a);
  const now = dfmt(Date.now());
  return (
    <div className="printdoc" aria-hidden="true">
      <h1>Расчёт электрощита</h1>
      <p className="pd-sub">{p.name || 'Без названия'}</p>
      <div className="pd-meta">
        {p.address && <div><span>Объект: </span>{p.address}</div>}
        {p.client && <div><span>Заказчик: </span>{p.client}</div>}
        {p.author && <div><span>Исполнитель: </span>{p.author}</div>}
        <div><span>Дата: </span>{now}</div>
      </div>
      <p>
        <span style={{ color: '#555' }}>Питание: </span>{three ? '3 фазы, 400 В' : '1 фаза, 230 В'}; <span style={{ color: '#555' }}>прокладка: </span>{c.method === 'wall' ? 'скрытая' : 'открытая'}; <span style={{ color: '#555' }}>потеря напряжения </span>{dropText(c.drop)}; <span style={{ color: '#555' }}>Ко </span>{fs(c.ko)}; <span style={{ color: '#555' }}>поправка </span>{fs(c.k)}
      </p>
      <h2>Группы линий</h2>
      <table>
        <thead>
          <tr>
            <th>№</th><th>Группа</th>{three && <th>Фаза</th>}<th className="r">Уст., Вт</th><th className="r">Ток, А</th><th>Защита</th><th>Кабель</th><th className="r">ΔU, %</th><th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {a.rows.map((x, i) => {
            const r = x.r;
            return (
              <tr key={x.l.id}>
                <td>Г{i + 1}</td>
                <td>{x.l.name || 'Без названия'}</td>
                {three && <td>{r.three ? '3Ф' : x.l.phase}</td>}
                {r.empty ? (
                  <>
                    <td className="r">0</td>
                    <td className="r">—</td>
                    <td colSpan={4}>нет приборов</td>
                  </>
                ) : (
                  <>
                    <td className="r">{fmt(r.pInst, 0)}</td>
                    <td className="r">{fmt(r.I, 1)}</td>
                    <td>{r.In ? protName(r) : '—'}</td>
                    <td>{r.In ? cableName(r) : '—'}</td>
                    <td className="r">{r.In ? fmt(r.drop, 1) : '—'}</td>
                    <td>{STATUS[r.status]}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={three ? 3 : 2}>Всего</td>
            <td className="r">{fmt(a.sumInst, 0)}</td>
            <td className="r">{fmt(a.Itot, 1)}</td>
            <td colSpan={4}>Расчётная мощность {fmt(a.P / 1000, 1)} кВт</td>
          </tr>
        </tfoot>
      </table>
      <h2>Ввод и щиток</h2>
      <p>
        Вводной автомат: {a.inIn ? (three ? '4P' : '2P') + ' C' + a.inIn : '—'}{a.inS ? ', кабель ввода ' + fs(a.inS) + ' мм²' : ''}. Щиток на {a.size} модулей, занято {a.modSum}.
      </p>
      {a.phases && (
        <p>Токи по фазам: L1 {fmt(a.phases.L1, 1)} А, L2 {fmt(a.phases.L2, 1)} А, L3 {fmt(a.phases.L3, 1)} А; перекос {fmt(a.imb, 0)} %.</p>
      )}
      <p>Выделенная мощность {fmt(c.alloc, 1)} кВт: {a.P / 1000 <= c.alloc * 0.9 ? 'укладывается' : (a.P / 1000 <= c.alloc ? 'на пределе' : 'превышение')}.</p>
      <h2>Спецификация</h2>
      <table>
        <thead>
          <tr><th>Позиция</th><th className="r">Количество</th><th>Примечание</th></tr>
        </thead>
        <tbody>
          {spec.map((x, i) => (
            <tr key={i}>
              <td>{x.name}</td>
              <td className="r">{x.qty}</td>
              <td>{x.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pd-note">
        Допустимые токи по таблице 1.3.4 ПУЭ, на которую ссылается ТКП 339-2022, с поправкой; УЗО по СН 4.04.01-2019 (изм. 2, п. 16.3.3); коэффициенты спроса и одновременности приняты по практике. Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Длины кабеля даны с запасом 10 %, ввод и мелочь уточняются по месту. Результат предварительный: проект щитка и монтаж согласуйте с аттестованным электриком.
      </p>
      <div className="pd-foot">Ampli · {now}</div>
    </div>
  );
}
