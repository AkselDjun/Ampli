import type { JSX } from 'react';
import type { Calc, Project } from '../core/types';
import { dfmt, fmt, fs, plural, pn, ymd } from '../core/format';
import { ROWLEN, STATUS } from '../core/norms';
import { buildSpec, estimate } from '../core/spec';
import { grandTotal, laborEstimate, unitQty } from '../core/labor';
import { useLib } from '../store/LibContext';
import { cableName, inCableName, protName } from '../core/protection';
import { dropText } from '../core/report';
import { Schematic } from './Schematic';
import { Assumptions } from './common';
import { cfgN, layout } from '../core/calc';
import { VERDICT, hasMeasurements, protocolRows } from '../core/protocol';
import type { PrintMode } from './WorkSheet';
import { CHECK_ITEMS } from '../core/checklist';
import { photoCaption } from '../core/photos';
import { usePhotoUrls } from './PhotoStrip';
import { PassportDoc } from './Passport';
import { DrawingA3, drawCode } from './DrawingA3';
import { OLD_EMPTY, OLD_SIGNS, oldVerdict } from '../core/oldwire';
import { UTP_MAX, WEAK_KINDS } from '../core/weak';
import { BATH_REF, FLOOR_SYS, FLOOR_USES, UZO_REF, floorCalc } from '../core/floor';
import { actDate, actsOf, hiddenMaterials, hiddenWorks, ruDate, warrantyText } from '../core/acts';
import { useNow } from './now';
import { stamp } from '../core/version';

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
            <td className="nw">{r.prot}</td>
            <td className="r">{r.zs === null ? '—' : fmt(r.zs, 2)}</td>
            <td className="r">{r.ik === null ? '—' : fmt(r.ik, 0) + ' / ' + fmt(r.need, 0)}</td>
            <td className="r">{r.ins === null ? '—' : fmt(r.ins, 2)}</td>
            <td className="r">{r.leak === null ? '—' : fmt(r.leak, 1) + ' / ' + fmt(r.leakLim, 1)}</td>
            <td className="r">{r.rcdT === null ? '—' : fmt(r.rcdT, 0) + ' / ' + fmt(r.rcdLim, 0)}</td>
            <td className="nw">{VERDICT[r.verdict]}</td>
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
  const now = useNow();
  return (
    <div className="pd-meta">
      {p.address && <div><span>Объект: </span>{p.address}</div>}
      {p.client && <div><span>Заказчик: </span>{p.client}</div>}
      {p.author && <div><span>Исполнитель: </span>{p.author}</div>}
      <div><span>Дата: </span>{dfmt(now)}</div>
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
  const now = useNow();
  const pr = p.proto ?? { date: '', device: '', by: '' };
  return (
    <>
      <BrandHead />
      <h1>Протокол замеров</h1>
      <p className="pd-sub">{p.name || 'Без названия'}</p>
      <Meta p={p} />
      <div className="pd-meta">
        <div><span>Дата замеров: </span>{pr.date ? ymd(pr.date) : '—'}</div>
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
        Допустимые значения: ток однофазного замыкания не меньше тока мгновенного срабатывания защиты (5×In для кривой B, 10×In для C) при времени отключения 0,4 с для 230 В (ТКП 339-2022, п. 4.3.5.4, п. 4.4.28.5); сопротивление изоляции не менее 0,5 МОм (п. 4.4.26.1, табл. 4.4.46); ток утечки не более трети уставки УЗО (СН 4.04.01-2019, п. 16.3.7); время отключения УЗО при номинальном дифференциальном токе не более значений табл. 4.4.47 и 4.4.48 ТКП 339-2022 в редакции изм. № 1 (для 30 мА 0,5 с).
      </p>
      <SignBlock />
      <div className="pd-foot">{stamp(dfmt(now))}</div>
    </>
  );
}

const STK_KIND: Record<string, string> = { light: 'Свет', socket: 'Розетки', power: 'Силовая', in: 'Ввод', uzo: 'УЗО', vr: 'Реле U', spd: 'УЗИП' };

function StkIcon({ k }: { k: string }) {
  const d: Record<string, JSX.Element> = {
    light: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>,
    socket: <><circle cx="12" cy="12" r="8" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /></>,
    power: <path d="M13 2 5 13h6l-1 9 8-11h-6z" />,
    in: <><path d="M4 12h12" /><path d="m12 7 5 5-5 5" /><path d="M20 4v16" /></>,
    uzo: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="M12 8v5M12 16v.01" /></>,
    spd: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m13 7-3 5h4l-3 5" /></>,
    vr: <><circle cx="12" cy="12" r="8" /><path d="m8.5 9 3.5 7 3.5-7" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d[k]}</svg>;
}

function StickersDoc({ p, a }: { p: Project; a: Calc }) {
  const rl = ROWLEN[a.size];
  const rows: { d: Calc['devs'][number]; k: string; no: string; nm: string }[][] = [[]];
  const slots = layout(a.devs, rl);
  a.devs.forEach((d, i) => {
    while (rows.length <= slots[i].row) rows.push([]);
    const fixed = d.kind === 'in' || d.kind === 'uzo' || d.kind === 'spd' || d.kind === 'vr';
    const g = fixed ? '' : d.sub.split(' ')[0];
    const line = g ? a.rows[Number(g.slice(1)) - 1] : undefined;
    const k = fixed ? d.kind : (line?.l.type ?? 'socket');
    const nm = d.kind === 'in' ? 'Вся квартира' : (d.kind === 'uzo' ? (d.zone ?? '') : (d.kind === 'spd' ? 'Защита от перенапряжений' : (d.kind === 'vr' ? 'Контроль напряжения' : (line?.l.name || ''))));
    rows[rows.length - 1].push({ d, k, no: d.kind === 'in' ? 'Ввод' : (d.kind === 'uzo' ? 'УЗО' : (d.kind === 'spd' ? 'УЗИП' : (d.kind === 'vr' ? 'Реле U' : g))), nm });
  });
  return (
    <>
      <h1>Наклейки для щитка</h1>
      <p className="pd-sub">{p.name || 'Без названия'}. Наклейки разложены по рядам щитка на {a.size} {plural(a.size, ['модуль', 'модуля', 'модулей'])}: каждую полосу можно вырезать целиком, длинные ряды разбиты на части по ширине листа. Ширина ячейки равна ширине аппарата (1 модуль = 17,5 мм).</p>
      <div className="stk-legend">
        {['in', 'vr', 'spd', 'uzo', 'light', 'socket', 'power'].filter(k => rows.some(r => r.some(x => x.k === k))).map(k => (
          <span key={k} className={'stk-k k-' + k}><StkIcon k={k} />{STK_KIND[k]}</span>
        ))}
      </div>
      {rows.map((r, n) => {
        const used = r.reduce((s, x) => s + x.d.mod, 0);
        const cells: { x: (typeof r)[number] | null; mod: number }[] = r.map(x => ({ x, mod: x.d.mod }));
        for (let free = rl - used; free > 0; free -= STK_MAX) cells.push({ x: null, mod: Math.min(STK_MAX, free) });
        const strips: (typeof cells)[] = [[]];
        cells.forEach(c => {
          const cur = strips[strips.length - 1];
          if (cur.length && cur.reduce((s2, y) => s2 + y.mod, 0) + c.mod > STK_MAX) strips.push([c]);
          else cur.push(c);
        });
        return strips.map((st, k) => (
          <div className="stk-row" key={n + '-' + k} style={{ width: st.reduce((s2, y) => s2 + y.mod, 0) * 17.5 + 'mm' }}>
            <span className="stk-rn">Ряд {n + 1}{strips.length > 1 ? ', часть ' + (k + 1) + ' из ' + strips.length : ''}</span>
            {st.map((c, i) => c.x ? (
              <div className={'stk-i k-' + c.x.k} key={i} style={{ width: c.mod * 17.5 + 'mm' }}>
                <span className="stk-top"><StkIcon k={c.x.k} /><b>{c.x.no}</b></span>
                <span className="stk-nm">{c.x.nm}</span>
                <small>{c.x.d.label}{c.x.d.ma && c.x.d.kind !== 'mcb' ? ' ' + c.x.d.ma + 'мА' : ''}</small>
              </div>
            ) : (
              <div className="stk-i stk-free" key={i} style={{ width: c.mod * 17.5 + 'mm' }}><small>резерв</small></div>
            ))}
          </div>
        ));
      })}
    </>
  );
}

const STK_MAX = 10;

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
            {x.l.where && <span>{x.l.where}</span>}
            <small>{k === 0 ? 'Конец у щитка' : 'Конец у потребителя'}{x.r.len ? ' · до дальней точки ' + fmt(x.r.len, 0) + ' м' : ''}</small>
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
  if (mode === 'a3') return <A3Doc p={p} a={a} />;
  if (mode === 'hidden') return <div className="printdoc act" aria-hidden="true"><HiddenDoc p={p} a={a} /></div>;
  if (mode === 'old') return <div className="printdoc act" aria-hidden="true"><OldDoc p={p} a={a} /></div>;
  if (mode === 'accept') return <div className="printdoc act" aria-hidden="true"><AcceptDoc p={p} a={a} /></div>;
  return <ReportDoc p={p} a={a} />;
}

function ActLine({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div className="act-ln">
      <span className="act-k">{label}</span>
      <span className="act-v">{value || '\u00a0'}{sub && <small>{sub}</small>}</span>
    </div>
  );
}

function Signs({ who }: { who: [string, string][] }) {
  return (
    <div className="act-sig">
      {who.map(([role, name], i) => (
        <div key={i}>
          <span>{role}</span>
          <span className="act-sl">{name ? '______________ ' + name : '______________ / ______________'}</span>
        </div>
      ))}
    </div>
  );
}

function HiddenDoc({ p, a }: { p: Project; a: Calc }) {
  const now = useNow();
  const { lib } = useLib();
  const b = lib.brand;
  const x = actsOf(p.acts);
  const works = hiddenWorks(a);
  const mats = hiddenMaterials(a);
  const doer = [b.company, b.signer || p.author].filter(Boolean).join(', ');
  const next = a.c.method === 'wall' ? 'заделке штроб и отделочным работам' : 'монтажу кабель-каналов, установке электроустановочных изделий';
  return (
    <>
      <h1 className="act-h">Акт освидетельствования скрытых работ</h1>
      <p className="act-c">монтаж групповых электрических сетей квартиры</p>
      <div className="act-top"><span>{p.address || p.name || '—'}</span><span>{actDate(p.acts)}</span></div>
      <p>Комиссия в составе:</p>
      <ActLine label="представителя исполнителя (производителя работ)" value={doer} />
      <ActLine label="представителя заказчика" value={p.client} />
      <ActLine label="представителя технического надзора" sub="при наличии" />
      <p>произвела осмотр работ, выполненных {b.company || p.author || '________________'}, и составила настоящий акт о нижеследующем.</p>
      <ol className="act-ol">
        <li>
          К освидетельствованию предъявлены следующие работы:
          <ul>{works.length ? works.map((w, i) => <li key={i}>{w}</li>) : <li>групповые линии не заданы</li>}</ul>
        </li>
        <li>Работы выполнены по проектной документации: однолинейная схема щитка {drawCode(now)}, расчёт групп Ampli по ТКП 339-2022 и СН 4.04.01-2019.</li>
        <li>
          При выполнении работ применены:
          <ul>{mats.map((m, i) => <li key={i}>{m}</li>)}</ul>
          документы о качестве: сертификаты или декларации о соответствии изготовителя.
        </li>
        <li>При выполнении работ отклонения от проектной документации: не допущены.</li>
        <li>Даты: начала работ {ruDate(x.start) || '«___» ________ 20__ г.'}, окончания работ {ruDate(x.end) || '«___» ________ 20__ г.'}</li>
      </ol>
      <p><b>Решение комиссии.</b> Работы выполнены в соответствии с проектной документацией, требованиями ТКП 339-2022 и СН 4.04.01-2019 и отвечают требованиям их приёмки. Разрешается производство последующих работ по {next}.</p>
      <Signs who={[['Исполнитель', b.signer || p.author], ['Заказчик', p.client], ['Технический надзор', '']]} />
      <p className="pd-note">Акт составлен по форме акта освидетельствования скрытых работ СН 1.03.04-2020 «Организация строительного производства». Перед заделкой штроб рекомендуется приложить фото трасс с привязкой к стенам.</p>
    </>
  );
}

function AcceptDoc({ p, a }: { p: Project; a: Calc }) {
  const { lib } = useLib();
  const b = lib.brand;
  const x = actsOf(p.acts);
  const le = laborEstimate(a, p.work, lib.labor);
  const works = le.rows.filter(r => r.qty > 0);
  const est = estimate(buildSpec(a), lib.prices);
  const priced = le.priced;
  const mats = Object.keys(lib.prices).length > 0 ? est.total : 0;
  const total = grandTotal(mats, le.total);
  return (
    <>
      <BrandHead />
      <h1 className="act-h">Акт сдачи-приёмки выполненных работ</h1>
      <div className="act-top"><span>{p.address || p.name || '—'}</span><span>{actDate(p.acts)}</span></div>
      <p>
        Исполнитель {b.company || p.author || '________________'}{b.signer ? ' в лице ' + b.signer : ''}, с одной стороны, и заказчик {p.client || '________________'}, с другой стороны, составили настоящий акт о том, что исполнитель выполнил, а заказчик принял работы по монтажу электропроводки и квартирного щитка{p.address ? ' по адресу: ' + p.address : ''}.
      </p>
      {(x.start || x.end) && <p>Сроки выполнения: {ruDate(x.start) || '…'} – {ruDate(x.end) || '…'}.</p>}
      <table>
        <thead>
          <tr><th>№</th><th>Работа</th><th>Ед. изм.</th><th className="r">Количество</th>{priced && <th className="r">Цена, BYN</th>}{priced && <th className="r">Сумма, BYN</th>}</tr>
        </thead>
        <tbody>
          {works.map((r, i) => (
            <tr key={r.def.key}>
              <td>{i + 1}</td>
              <td>{r.def.name}</td>
              <td>{r.def.unit}</td>
              <td className="r">{fmt(r.qty, r.qty % 1 ? 1 : 0)}</td>
              {priced && <td className="r">{r.price === null ? '—' : fmt(r.price, 2)}</td>}
              {priced && <td className="r">{r.sum === null ? '—' : fmt(r.sum, 2)}</td>}
            </tr>
          ))}
        </tbody>
        {priced && (
          <tfoot>
            <tr><td colSpan={5}>Работы</td><td className="r">{fmt(le.total, 2)}</td></tr>
            {mats > 0 && <tr><td colSpan={5}>Материалы по спецификации</td><td className="r">{fmt(mats, 2)}</td></tr>}
            {mats > 0 && <tr><td colSpan={5}>Итого</td><td className="r">{fmt(total, 2)}</td></tr>}
          </tfoot>
        )}
      </table>
      <p>Работы выполнены в полном объёме{priced ? ' на сумму ' + fmt(mats > 0 ? total : le.total, 2) + ' BYN' : ''}. Заказчик претензий по объёму, качеству и срокам выполнения работ не имеет.</p>
      {x.warranty > 0 && <p>Гарантийный срок на выполненные работы: {warrantyText(x.warranty)} с даты подписания акта. Гарантия не распространяется на повреждения, вызванные вмешательством третьих лиц и нарушением правил эксплуатации.</p>}
      <p>Заказчику переданы: однолинейная схема щитка, протокол замеров, паспорт щитка с назначением автоматов.</p>
      <Signs who={[['Работы сдал, исполнитель', b.signer || p.author], ['Работы принял, заказчик', p.client]]} />
    </>
  );
}

const OLD_ANS: Record<string, Record<string, string>> = {
  metal: { cu: 'медь', al: 'алюминий' },
  pe: { yes: 'есть', no: 'нет, двухпроводная сеть', jumper: 'перемычка N и PE в розетках' },
  net: { tncs: 'есть отдельный PE (TN-C-S)', tnc: 'только PEN (TN-C)' },
  panel: { fuse: 'пробки', old: 'старые автоматы', mod: 'модульный' }
};

function OldDoc({ p, a }: { p: Project; a: Calc }) {
  const o = p.old ?? OLD_EMPTY;
  const v = oldVerdict(p.old, a);
  const ans: [string, string][] = [
    ['Материал жил', OLD_ANS.metal[o.metal]],
    ['Сечение жил групп', o.sec ? fs(o.sec) + ' мм²' : ''],
    ['Защитный проводник PE', OLD_ANS.pe[o.pe]],
    ['Этажный щит', OLD_ANS.net[o.net]],
    ['Щиток квартиры', OLD_ANS.panel[o.panel]],
    ['Сопротивление изоляции', o.ins ? o.ins.replace('.', ',') + ' МОм' : ''],
    ['Возраст проводки', o.age ? o.age + ' ' + plural(pn(o.age, 0), ['год', 'года', 'лет']) : ''],
    ['При осмотре', OLD_SIGNS.filter(s => o.signs.includes(s[0])).map(s => s[1].toLowerCase()).join('; ')]
  ];
  return (
    <>
      <BrandHead />
      <h1>Заключение по состоянию электропроводки</h1>
      <p className="pd-sub">{p.name || 'Без названия'}</p>
      <Meta p={p} />
      <h2>Результаты осмотра</h2>
      <table>
        <tbody>
          {ans.map(([k, val]) => <tr key={k}><td>{k}</td><td>{val || 'не установлено'}</td></tr>)}
        </tbody>
      </table>
      <h2>Вывод: {v.label.toLowerCase()}</h2>
      <ol className="act-ol">
        {v.findings.map(f => (
          <li key={f.id}><b>{f.title}.</b> {f.text} <i>({f.ref || 'по практике монтажа'})</i></li>
        ))}
      </ol>
      {v.groups.length > 0 && (
        <>
          <h2>Группы проекта</h2>
          <table>
            <thead><tr><th>№</th><th>Группа</th><th>Защита по расчёту</th><th>Старая линия</th></tr></thead>
            <tbody>
              {v.groups.map(g => <tr key={g.no}><td>{g.no}</td><td>{g.name}</td><td>{g.In} А, {fs(g.need)} мм² Cu</td><td>{g.fit ? 'можно оставить' : 'проложить новую'}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
      <p className="pd-note">Заключение составлено по результатам визуального осмотра и замеров, указанных выше. Скрытые участки проводки не вскрывались. Пункты с пометкой «по практике монтажа» не следуют из прямой нормы.</p>
      <SignBlock />
    </>
  );
}

function A3Doc({ p, a }: { p: Project; a: Calc }) {
  const { lib } = useLib();
  return <div className="printdoc a3doc" aria-hidden="true"><DrawingA3 p={p} a={a} company={lib.brand.company} /></div>;
}

function ReportDoc({ p, a }: { p: Project; a: Calc }) {
  const c = a.c;
  const three = c.supply === 3;
  const { lib } = useLib();
  const est = estimate(buildSpec(a), lib.prices);
  const priced = Object.keys(lib.prices).length > 0;
  const le = laborEstimate(a, p.work, lib.labor);
  const works = le.rows.filter(r => r.qty > 0 && r.price !== null);
  const now = dfmt(useNow());
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
        <span className="pd-k">Питание: </span>{three ? '3 фазы, 400 В' : '1 фаза, 230 В'}; <span className="pd-k">прокладка: </span>{c.method === 'wall' ? 'скрытая' : 'открытая'}; <span className="pd-k">потеря напряжения </span>{dropText(c.drop, c.feeder)}; <span className="pd-k">Ко </span>{fs(c.ko)}; <span className="pd-k">поправка </span>{fs(c.k)}
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
        Вводной автомат: {a.inIn ? (three ? '4P' : '2P') + ' C' + a.inIn : '—'}{a.inS ? ', кабель ввода ' + inCableName(c, a.inS) : ''}. Защита групп: {c.rcdMode ? 'УЗО на помещение и автоматы, у каждого УЗО своя шина N' : 'дифавтомат на каждую группу'}{a.rows.some(x => x.r.rcd && x.r.rcdA && !x.r.empty) ? ', тип A для групп с электроникой' : ''}{a.rows.some(x => x.r.arc && !x.r.empty) ? '; УЗДП на ' + (c.afdd === 'sock' ? 'розеточные группы' : 'однофазные группы') : ''}.{a.devs.some(d => d.kind === 'vr') ? ' Реле контроля напряжения после вводного автомата.' : ''}{a.devs.some(d => d.kind === 'spd') ? ' УЗИП тип 2 после вводного автомата.' : ''} Щиток на {a.size} {plural(a.size, ['модуль', 'модуля', 'модулей'])}, занято {a.modSum}.
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
      <FloorPart a={a} />
      <WeakPart p={p} a={a} />
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
      {priced && est.missing > 0 && <p className="pd-note">Для {est.missing} поз. не задана цена или количество, они не входят в итог.</p>}
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
                  <td className="r">{unitQty(r.qty, r.def.unit)}</td>
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
        Допустимые токи по таблице 1.3.4 ПУЭ, на которую ссылается ТКП 339-2022, с поправкой; УЗО 30 мА на розетки и свет по ТКП 339-2022 с изм. № 1, п. 4.3.18.5; коэффициенты спроса и одновременности приняты по практике. Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Допустимые токи взяты из ПУЭ и не сверены с таблицами МЭК 364-5-523 (ГОСТ 30331.15-2001 их не содержит); минимальное сечение жилы 1,5 мм² по табл. 52J. Ввод по СН 4.04.01-2019, п. 9.12, селективность по п. 10.5; отключение короткого замыкания за 0,4 с проверено по заданной петле фаза-нуль питающей сети (ТКП 339-2022, п. 4.3.5.4). Длины кабеля даны с запасом 10 %, ввод и мелочь уточняются по месту. Нормы: ТКП 339-2022 с изм. № 1, СН 4.04.01-2019 «Системы электрооборудования жилых и общественных зданий» с изм. № 1 и № 2 (изм. № 2 действует с 07.12.2026, учтён п. 14.4 о водонагревателях и отоплении; остальные пункты к квартирам не относятся), ПУЭ, ГОСТ 30331.15-2001. Результат предварительный: проект щитка и монтаж согласуйте с аттестованным электриком.
      </p>
      <h2>Допущения и источники</h2>
      <Assumptions cfg={cfgN(p.cfg)} />
      <SignBlock />
      <div className="pd-foot">{stamp(now)}</div>
    </div>
  );
}

function WeakPart({ p, a }: { p: Project; a: Calc }) {
  const w = a.weak;
  const pts = p.weak?.pts ?? [];
  if (!w || !w.points) return null;
  return (
    <>
      <h2>Слаботочные сети</h2>
      <table>
        <thead>
          <tr><th>Помещение</th><th>Назначение</th><th className="r">Кол-во</th><th className="r">Длина от щитка, м</th><th>Кабель</th></tr>
        </thead>
        <tbody>
          {pts.map(x => (
            <tr key={x.id}>
              <td>{x.room || '—'}</td>
              <td>{WEAK_KINDS[x.kind].label}</td>
              <td className="r">{x.n}</td>
              <td className="r">{String(x.len) || '—'}</td>
              <td>{WEAK_KINDS[x.kind].cable}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pd-note">Каждая точка отдельной линией от слаботочного щитка{w.ont ? ', в щитке оптический терминал провайдера и роутер' : ', в щитке роутер'}{w.sw ? ', коммутатор на ' + w.sw + ' портов' + (w.poe ? ' с PoE' : '') : ''}{w.split ? ', делитель TV на ' + w.split + ' ' + plural(w.split, ['выход', 'выхода', 'выходов']) : ''}. Длина линии UTP не более {UTP_MAX} м (ISO/IEC 11801). Слаботочные кабели прокладываются отдельно от силовых (практика).</p>
    </>
  );
}

function FloorPart({ a }: { a: Calc }) {
  const rooms = (a.floor ?? []).map(r => ({ r, x: floorCalc(r) }));
  if (!rooms.length) return null;
  return (
    <>
      <h2>Тёплый пол</h2>
      <table>
        <thead>
          <tr><th>Помещение</th><th>Система</th><th className="r">Площадь, м²</th><th>Изделие</th><th className="r">Мощность, Вт</th></tr>
        </thead>
        <tbody>
          {rooms.map(({ r, x }) => (
            <tr key={r.id}>
              <td>{r.name || FLOOR_USES[r.use].name}</td>
              <td>{FLOOR_SYS[r.sys].label}</td>
              <td className="r">{fmt(x.area, 1)}</td>
              <td>{x.product}{x.size ? ', ' + x.size : ''}</td>
              <td className="r">{fmt(x.watts, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pd-note">Каждое помещение с отдельным терморегулятором и датчиком температуры пола, питание отдельной группой с УЗО ({UZO_REF}){rooms.some(o => o.r.use === 'bath') ? '; в полу ванной нагревательный элемент с металлическим экраном, присоединённым к PE (' + BATH_REF + ')' : ''}.</p>
    </>
  );
}
