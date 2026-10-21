import type { Calc, Project } from '../core/types';
import { dfmt, fmt, fs } from '../core/format';
import { STATUS } from '../core/norms';
import { buildSpec, estimate } from '../core/spec';
import { grandTotal, laborEstimate } from '../core/labor';
import { useLib } from '../store/LibContext';
import { cableName, protName } from '../core/protection';
import { dropText } from '../core/report';
import { Schematic } from './Schematic';
import { Assumptions } from './common';
import { cfgN } from '../core/calc';
import { VERDICT, hasMeasurements, protocolRows } from '../core/protocol';
import type { PrintMode } from './WorkSheet';
import { CHECK_ITEMS } from '../core/checklist';
import { photoCaption } from '../core/photos';
import { usePhotoUrls } from './PhotoStrip';
import { PassportDoc } from './Passport';

function ProtoTable({ a }: { a: Calc }) {
  const rows = protocolRows(a);
  return (
    <table>
      <thead>
        <tr><th>№</th><th>Группа</th><th>Защита</th><th className="r">Петля, Ом</th><th className="r">Iк / нужно, А</th><th className="r">Изоляция, МОм</th><th className="r">Утечка / допуск, мА</th><th className="r">УЗО / допуск, мс</th><th>Итог</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.no}>
            <td>{r.no}</td>
            <td>{r.name}</td>
            <td>{r.prot}</td>
            <td className="r">{r.zs === null ? '—' : fmt(r.zs, 2)}</td>
            <td className="r">{r.ik === null ? '—' : fmt(r.ik, 0) + ' / ' + fmt(r.need, 0)}</td>
            <td className="r">{r.ins === null ? '—' : fmt(r.ins, 2)}</td>
            <td className="r">{r.leak === null ? '—' : fmt(r.leak, 1) + ' / ' + fmt(r.leakLim, 1)}</td>
            <td className="r">{r.rcdT === null ? '—' : fmt(r.rcdT, 0) + ' / ' + fmt(r.rcdLim, 0)}</td>
            <td>{VERDICT[r.verdict]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BrandHead() {
  const { lib } = useLib();
  const b = lib.brand;
  if (!b.company && !b.contacts && !b.logo) return null;
  return (
    <div className="pd-brand">
      {b.logo && <img src={b.logo} alt="" />}
      <div>
        {b.company && <b>{b.company}</b>}
        {b.contacts && <span>{b.contacts}</span>}
      </div>
    </div>
  );
}

function SignBlock() {
  const { lib } = useLib();
  const b = lib.brand;
  return (
    <div className="pd-sign">
      <span>{b.signer ? b.signer : 'Исполнитель'} ______________________</span>
      <span>Подпись ______________</span>
    </div>
  );
}

function Meta({ p }: { p: Project }) {
  return (
    <div className="pd-meta">
      {p.address && <div><span>Объект: </span>{p.address}</div>}
      {p.client && <div><span>Заказчик: </span>{p.client}</div>}
      {p.author && <div><span>Исполнитель: </span>{p.author}</div>}
      <div><span>Дата: </span>{dfmt(Date.now())}</div>
    </div>
  );
}

function PhotoSheet({ p }: { p: Project }) {
  const photos = p.photos ?? [];
  const urls = usePhotoUrls(photos.map(x => x.id));
  if (!photos.length) return null;
  return (
    <>
      <h2>Фотофиксация</h2>
      <div className="pd-photos">
        {photos.map(ph => (
          <figure key={ph.id} className="pd-photo">
            {urls[ph.id] && <img src={urls[ph.id]} alt={photoCaption(ph, p.lines)} />}
            <figcaption>{photoCaption(ph, p.lines)}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function ProtoDoc({ p, a }: { p: Project; a: Calc }) {
  const pr = p.proto ?? { date: '', device: '', by: '' };
  return (
    <>
      <BrandHead />
      <h1>Протокол замеров</h1>
      <p className="pd-sub">{p.name || 'Без названия'}</p>
      <Meta p={p} />
      <div className="pd-meta">
        <div><span>Дата замеров: </span>{pr.date ? dfmt(new Date(pr.date).getTime()) : '—'}</div>
        <div><span>Измерения выполнил: </span>{pr.by || '—'}</div>
        <div><span>Прибор: </span>{pr.device || '—'}</div>
      </div>
      <ProtoTable a={a} />
      <PhotoSheet p={p} />
      <h2>Приёмка</h2>
      <ul className="pd-ck">
        {CHECK_ITEMS.map(it => (
          <li key={it.id}>{(p.checks ?? {})[it.id] ? '☑' : '☐'} {it.title}</li>
        ))}
      </ul>
      <p className="pd-note">
        Допустимые значения: ток однофазного замыкания не меньше тока мгновенного срабатывания защиты (5×In для кривой B, 10×In для C) при времени отключения 0,4 с для 230 В (ТКП 339-2022, п. 4.3.5.4, п. 4.4.28.5); сопротивление изоляции не менее 0,5 МОм (п. 4.4.29.2); ток утечки не более трети уставки УЗО (СН 4.04.01-2019, п. 16.3.7); время отключения УЗО при номинальном дифференциальном токе не более значений табл. 4.4.47 и 4.4.48 ТКП 339-2022 в редакции изм. № 1 (для 30 мА 0,5 с).
      </p>
      <SignBlock />
      <div className="pd-foot">Ampli · {dfmt(Date.now())}</div>
    </>
  );
}

function StickersDoc({ p, a }: { p: Project; a: Calc }) {
  return (
    <>
      <h1>Наклейки для щитка</h1>
      <p className="pd-sub">{p.name || 'Без названия'}. Ширина наклейки равна ширине аппарата (1 модуль = 17,5 мм).</p>
      <div className="stk">
        {a.devs.map((d, i) => {
          const g = d.kind === 'in' ? '' : d.sub.split(' ')[0];
          const nm = d.kind === 'in' ? 'Ввод' : (a.rows[Number(g.slice(1)) - 1]?.l.name || '');
          return (
            <div className="stk-i" key={i} style={{ width: d.mod * 17.5 + 'mm' }}>
              <b>{d.kind === 'in' ? 'Ввод' : g}</b>
              <span>{nm}</span>
              <small>{d.label}{d.ma ? ' ' + d.ma + 'мА' : ''}</small>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TagsDoc({ p, a }: { p: Project; a: Calc }) {
  const rows = a.rows.map((x, i) => ({ x, i })).filter(o => !o.x.r.empty && o.x.r.In);
  return (
    <>
      <h1>Бирки кабелей</h1>
      <p className="pd-sub">{p.name || 'Без названия'}. На каждую группу по две бирки: для щитка и для конца линии.</p>
      <div className="tag-grid">
        {rows.flatMap(({ x, i }) => [0, 1].map(k => (
          <div className="tag" key={x.l.id + k}>
            <b>Г{i + 1} {x.l.name || 'Без названия'}</b>
            <span>{cableName(x.r)}</span>
            <span>{protName(x.r)}</span>
            <small>{k === 0 ? 'Конец у щитка' : 'Конец у потребителя'}{x.r.len ? ' · длина ' + fmt(x.r.len, 0) + ' м' : ''}</small>
          </div>
        )))}
      </div>
    </>
  );
}

export function PrintDoc({ p, a, mode = 'report' }: { p: Project; a: Calc; mode?: PrintMode }) {
  if (mode === 'proto') return <div className="printdoc" aria-hidden="true"><ProtoDoc p={p} a={a} /></div>;
  if (mode === 'stickers') return <div className="printdoc" aria-hidden="true"><StickersDoc p={p} a={a} /></div>;
  if (mode === 'passport') return <div className="printdoc" aria-hidden="true"><BrandHead /><PassportDoc p={p} a={a} /></div>;
  if (mode === 'tags') return <div className="printdoc" aria-hidden="true"><TagsDoc p={p} a={a} /></div>;
  return <ReportDoc p={p} a={a} />;
}

function ReportDoc({ p, a }: { p: Project; a: Calc }) {
  const c = a.c;
  const three = c.supply === 3;
  const { lib } = useLib();
  const est = estimate(buildSpec(a), lib.prices);
  const priced = Object.keys(lib.prices).length > 0;
  const le = laborEstimate(a, p.work, lib.labor);
  const works = le.rows.filter(r => r.qty > 0 && r.price !== null);
  const now = dfmt(Date.now());
  return (
    <div className="printdoc" aria-hidden="true">
      <BrandHead />
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
      <h2>Схема щитка</h2>
      <Schematic a={a} />
      {hasMeasurements(a) && (
        <>
          <h2>Протокол замеров</h2>
          <ProtoTable a={a} />
        </>
      )}
      <h2>Спецификация</h2>
      <table>
        <thead>
          <tr><th>Позиция</th><th className="r">Количество</th><th>Примечание</th>{priced && <th className="r">Цена, BYN</th>}{priced && <th className="r">Сумма, BYN</th>}</tr>
        </thead>
        <tbody>
          {est.rows.map(({ item, price, sum }, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td className="r">{item.qty}</td>
              <td>{item.note}</td>
              {priced && <td className="r">{price === null ? '—' : fmt(price, 2)}</td>}
              {priced && <td className="r">{sum === null ? '—' : fmt(sum, 2)}</td>}
            </tr>
          ))}
        </tbody>
        {priced && (
          <tfoot>
            <tr><td colSpan={4}>{le.priced ? 'Материалы' : 'Итого по смете'}</td><td className="r">{fmt(est.total, 2)}</td></tr>
          </tfoot>
        )}
      </table>
      {le.priced && (
        <>
          <h2>Работы</h2>
          <table>
            <thead>
              <tr><th>Работа</th><th className="r">Количество</th><th className="r">Цена, BYN</th><th className="r">Сумма, BYN</th></tr>
            </thead>
            <tbody>
              {works.map(r => (
                <tr key={r.def.key}>
                  <td>{r.def.name}</td>
                  <td className="r">{fmt(r.qty, r.qty % 1 ? 1 : 0)} {r.def.unit}</td>
                  <td className="r">{fmt(r.price as number, 2)}</td>
                  <td className="r">{fmt(r.sum as number, 2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Работы</td><td className="r">{fmt(le.total, 2)}</td></tr>
              <tr><td colSpan={3}>Итого: работы и материалы</td><td className="r">{fmt(grandTotal(est.total, le.total), 2)}</td></tr>
            </tfoot>
          </table>
        </>
      )}
      <p className="pd-note">
        Допустимые токи по таблице 1.3.4 ПУЭ, на которую ссылается ТКП 339-2022, с поправкой; УЗО 30 мА на розетки и свет по ТКП 339-2022 с изм. № 1, п. 4.3.18.5; коэффициенты спроса и одновременности приняты по практике. Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Допустимые токи взяты из ПУЭ и не сверены с таблицами МЭК 364-5-523 (ГОСТ 30331.15-2001 их не содержит); минимальное сечение жилы 1,5 мм² по табл. 52J. Ввод по СН 4.04.01-2019, п. 9.12, селективность по п. 10.5; отключение короткого замыкания за 0,4 с проверено по заданной петле фаза-нуль питающей сети (ТКП 339-2022, п. 4.3.5.4). Длины кабеля даны с запасом 10 %, ввод и мелочь уточняются по месту. Нормы: ТКП 339-2022 с изм. № 1, СН 4.04.01-2019 «Системы электрооборудования жилых и общественных зданий» (изм. № 2 вступает 07.12.2026 и не учтено), ПУЭ, ГОСТ 30331.15-2001. Результат предварительный: проект щитка и монтаж согласуйте с аттестованным электриком.
      </p>
      <h2>Допущения и источники</h2>
      <Assumptions cfg={cfgN(p.cfg)} />
      <SignBlock />
      <div className="pd-foot">Ampli · {now}</div>
    </div>
  );
}
