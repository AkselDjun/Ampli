import { useEffect, useRef, useState } from 'react';
import type { Calc, Content, Project } from '../core/types';
import type { TplKey } from '../core/templates';
import { TPL_LIST, TPL_NAME, blank, contentFor, sample } from '../core/templates';
import { cfgN } from '../core/calc';
import { dfmt, fmt, plural } from '../core/format';
import { STATUS } from '../core/norms';
import { buildSpec } from '../core/spec';
import { cableName, protName } from '../core/protection';
import { reportText } from '../core/report';
import { normProject, slug } from '../core/project';
import type { Action } from '../store/reducer';
import { ArmButton, Seg, Sheet, Stepper } from './common';
import { Schematic } from './Schematic';
import { useLib } from '../store/LibContext';
import { estimate } from '../core/spec';

export function NetSheet({
  open, onClose, p, dispatch
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  dispatch: (a: Action) => void;
}) {
  const c = cfgN(p.cfg);
  const replace = (content: Content) => {
    dispatch({ t: 'replace', content });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Параметры сети" small>
      <div className="f">
        <span className="lbl" id="l-sup">Питание</span>
        <Seg<number> name="sup" labelledBy="l-sup" value={c.supply} items={[[1, '1 фаза · 230 В'], [3, '3 фазы · 400 В']]} onChange={v => dispatch({ t: 'cfg', field: 'supply', value: v })} />
      </div>
      <div className="f">
        <span className="lbl" id="l-met">Прокладка кабеля</span>
        <Seg<string> name="met" labelledBy="l-met" value={c.method} items={[['wall', 'Скрытая'], ['open', 'Открытая']]} onChange={v => dispatch({ t: 'cfg', field: 'method', value: v })} />
        <small>Скрытая: кабель в трубе в стене или кладке (способы 2 и 5A, табл. 52Н ГОСТ 30331.15). Открытая: в коробе или по поверхности (способы 4A и 11).</small>
      </div>
      <div className="f">
        <span className="lbl" id="l-drop">Допустимая потеря напряжения</span>
        <Seg<number> name="drop" labelledBy="l-drop" value={c.drop} items={[[0, 'По СН'], [4, 'До 4 %'], [3, 'До 3 %'], [2, 'До 2 %']]} onChange={v => dispatch({ t: 'cfg', field: 'drop', value: v })} />
      </div>
      <div className="f">
        <span className="lbl">Потеря напряжения до щитка, %</span>
        <Stepper value={p.cfg.feeder} d={0.1} min={0} max={3} step={0.1} label="Потеря напряжения от ВРУ до щитка квартиры, %" onChange={v => dispatch({ t: 'cfg', field: 'feeder', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'feeder', d })} />
        <small>Нормы СН 4.04.01-2019 (п. 9.14) и ГОСТ 30331.15-2001 (п. 525, не более 4 %) отсчитываются от ВРУ здания. Потеря на стояке до квартиры вычитается из допуска групп. Если неизвестна, оставьте 0.</small>
      </div>
      <div className="f">
        <span className="lbl" id="l-mins">Наименьшее сечение жилы</span>
        <Seg<string> name="mins" labelledBy="l-mins" value={c.safe ? 'safe' : 'norm'} items={[['safe', 'С запасом'], ['norm', 'По ТКП 339']]} onChange={v => dispatch({ t: 'cfg', field: 'minS', value: v })} />
        <small>ТКП 339-2022 (табл. 8.1) и ГОСТ 30331.15-2001 (табл. 52J) допускают 1,5 мм². «С запасом»: не менее 2,5 мм² для розеток и мощных приборов.</small>
      </div>
      <div className="set-grid">
        <div className="f wide">
          <span className="lbl">Петля фаза-нуль питающей сети, Ом</span>
          <Stepper value={p.cfg.zs} d={0.05} min={0.05} max={2} step={0.05} label="Сопротивление петли фаза-нуль питающей сети, Ом" onChange={v => dispatch({ t: 'cfg', field: 'zs', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'zs', d })} />
          <small>До щитка квартиры. Значение по умолчанию ориентировочное: уточните у энергоснабжающей организации или замерьте. Нужно для проверки отключения при коротком замыкании.</small>
        </div>
        <div className="f">
          <span className="lbl">Выделенная мощность</span>
          <Stepper value={p.cfg.alloc} d={1} min={1} step={0.5} label="Выделенная мощность, кВт" onChange={v => dispatch({ t: 'cfg', field: 'alloc', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'alloc', d })} />
          <small>кВт, из технических условий.</small>
        </div>
        <div className="f">
          <span className="lbl">Одновременность, Ко</span>
          <Stepper value={p.cfg.ko} d={0.05} min={0.3} max={1} step={0.05} label="Коэффициент одновременности" onChange={v => dispatch({ t: 'cfg', field: 'ko', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'ko', d })} />
          <small>Доля приборов, работающих вместе.</small>
        </div>
        <div className="f wide">
          <span className="lbl">Поправка на нагрев и группировку</span>
          <Stepper value={p.cfg.k} d={0.05} min={0.5} max={1} step={0.05} label="Поправка на нагрев и группировку" onChange={v => dispatch({ t: 'cfg', field: 'k', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'k', d })} />
          <small>Уменьшает табличный допустимый ток кабеля.</small>
        </div>
      </div>
      <div className="data-row">
        <ArmButton className="btn ghost" label="Загрузить пример" onRun={() => replace(sample())} />
        <ArmButton className="btn ghost" label="Начать с нуля" onRun={() => replace(blank())} />
      </div>
    </Sheet>
  );
}

export function ProjectsSheet({
  open, onClose, state, p, dispatch, onLib
}: {
  open: boolean;
  onClose: () => void;
  state: { list: Project[]; cur: string };
  p: Project;
  dispatch: (a: Action) => void;
  onLib: () => void;
}) {
  const { lib, dispatch: libDispatch } = useLib();
  const [tplOpen, setTplOpen] = useState(false);
  const [elec, setElec] = useState(true);
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (open) setTplOpen(false);
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const note = (t: string, bad = false) => {
    setMsg({ t, bad });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 5000);
  };
  const create = (k: TplKey) => {
    const nm = k === 'blank' ? 'Проект ' + (state.list.length + 1) : TPL_NAME[k];
    dispatch({ t: 'addProject', content: contentFor(k, elec), name: nm });
    setTplOpen(false);
    note('Создан проект: ' + nm);
    window.setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 0);
  };
  const exportFile = () => {
    try {
      const text = JSON.stringify({ app: 'ampli', version: 1, ...p }, null, 2);
      const u = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u;
      a.download = 'ampli-' + slug(p.name) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(u), 2000);
      note('Файл сохранён');
    } catch (e) {
      void e;
      note('Не удалось сохранить файл на этом устройстве', true);
    }
  };
  const importText = (text: string) => {
    let o: unknown;
    try {
      o = JSON.parse(text);
    } catch (e) {
      void e;
      note('Файл не похож на проект Ampli', true);
      return;
    }
    const list = (o as { list?: unknown }).list;
    const arr: unknown[] = Array.isArray(o) ? o : (Array.isArray(list) ? list : [o]);
    const added = arr.map(x => normProject(x)).filter((x): x is Project => !!x);
    if (!added.length) {
      note('В файле нет проекта Ampli', true);
      return;
    }
    dispatch({ t: 'importProjects', projects: added });
    note('Добавлено проектов: ' + added.length);
  };
  const n = state.list.length;
  return (
    <Sheet open={open} onClose={onClose} title="Проекты" small>
      <h3 className="sec-t">Текущий проект</h3>
      <div className="meta-grid">
        <div className="f wide"><label className="lbl" htmlFor="mName">Название</label><input id="mName" ref={nameRef} type="text" autoComplete="off" maxLength={80} value={p.name} onChange={e => dispatch({ t: 'meta', field: 'name', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="mAddr">Объект, адрес</label><input id="mAddr" type="text" autoComplete="off" maxLength={120} value={p.address} onChange={e => dispatch({ t: 'meta', field: 'address', value: e.target.value })} /></div>
        <div className="f"><label className="lbl" htmlFor="mClient">Заказчик</label><input id="mClient" type="text" autoComplete="off" maxLength={80} value={p.client} onChange={e => dispatch({ t: 'meta', field: 'client', value: e.target.value })} /></div>
        <div className="f"><label className="lbl" htmlFor="mAuthor">Исполнитель</label><input id="mAuthor" type="text" autoComplete="off" maxLength={80} value={p.author} onChange={e => dispatch({ t: 'meta', field: 'author', value: e.target.value })} /></div>
      </div>
      <div className="sec-row">
        <h3 className="sec-t">Все проекты</h3>
        <span className="muted">{n} {plural(n, ['проект', 'проекта', 'проектов'])}</span>
      </div>
      <div className="pj-list">
        {state.list.map(x => {
          const cur = x.id === state.cur;
          return (
            <div className={'pj' + (cur ? ' cur' : '')} key={x.id}>
              <button className="pj-open" type="button" aria-current={cur ? 'true' : undefined} onClick={() => { dispatch({ t: 'openProject', id: x.id }); onClose(); }}>
                <span className="pj-name">{x.name || 'Без названия'}</span>
                <span className="pj-sub">{cur ? 'Открыт · ' : ''}{x.lines.length} {plural(x.lines.length, ['группа', 'группы', 'групп'])} · {dfmt(x.updated)}</span>
              </button>
              <button className="btn" type="button" onClick={() => { dispatch({ t: 'dupProject', id: x.id }); note('Копия создана'); }}>Копия</button>
              <ArmButton className="btn danger" label="Удалить" armedLabel="Точно удалить?" onRun={() => dispatch({ t: 'delProject', id: x.id })} />
            </div>
          );
        })}
      </div>
      <div className="data-row">
        <button className="btn primary" type="button" aria-expanded={tplOpen} aria-controls="tpl" onClick={() => setTplOpen(!tplOpen)}>+ Новый проект</button>
      </div>
      <div className="tpl" id="tpl" hidden={!tplOpen}>
        <span className="lbl" id="l-stove">Плита</span>
        <Seg<string> name="stove" labelledBy="l-stove" value={elec ? 'elec' : 'gas'} items={[['elec', 'Электрическая'], ['gas', 'Газовая']]} onChange={v => setElec(v === 'elec')} />
        <span className="lbl">С чего начать</span>
        <div className="tpl-grid">
          {TPL_LIST.map(t => (
            <button key={t.key} className="tpl-b" type="button" onClick={() => create(t.key)}>
              <b>{t.title}</b>
              <span>{t.sub}</span>
            </button>
          ))}
        </div>
        {lib.templates.length > 0 && (
          <>
            <span className="lbl">Мои шаблоны</span>
            <div className="tpl-grid">
              {lib.templates.map(t => (
                <button key={t.id} className="tpl-b" type="button" onClick={() => {
                  dispatch({ t: 'addProject', content: { sample: false, cfg: t.cfg, lines: t.lines }, name: t.name });
                  setTplOpen(false);
                  note('Создан проект: ' + t.name);
                }}>
                  <b>{t.name}</b>
                  <span>{t.lines.length} {plural(t.lines.length, ['группа', 'группы', 'групп'])}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={() => { libDispatch({ t: 'addTpl', name: p.name || 'Мой шаблон', cfg: p.cfg, lines: p.lines }); note('Шаблон сохранён: ' + (p.name || 'Мой шаблон')); }}>Сохранить как шаблон</button>
        <button className="btn ghost" type="button" onClick={onLib}>Мои данные</button>
      </div>
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={exportFile}>Сохранить в файл</button>
        <button className="btn ghost" type="button" onClick={() => file.current?.click()}>Открыть из файла</button>
        <input
          className="pj-file"
          ref={file}
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            const input = e.target;
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
              importText(String(rd.result));
              input.value = '';
            };
            rd.onerror = () => note('Не удалось прочитать файл', true);
            rd.readAsText(f);
          }}
        />
      </div>
      <span className="muted" role="status" style={{ color: msg ? (msg.bad ? 'var(--bad)' : 'var(--ok)') : undefined }}>{msg ? msg.t : ''}</span>
      <p className="muted">Проекты хранятся в этом браузере на этом устройстве. Чтобы перенести проект на другое устройство, сохраните его в файл и откройте там.</p>
    </Sheet>
  );
}

export function ReportSheet({
  open, onClose, p, a, onPrint
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  onPrint: () => void;
}) {
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const copy = async () => {
    const txt = reportText(p, a, lib.prices);
    try {
      await navigator.clipboard.writeText(txt);
      setFallback(null);
      setMsg({ t: 'Отчёт скопирован', ok: true });
    } catch (e) {
      void e;
      setFallback(txt);
      setMsg({ t: 'Текст выделен, скопируйте его вручную', ok: false });
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 4000);
  };
  const three = a.c.supply === 3;
  const { lib, dispatch: libDispatch } = useLib();
  const est = estimate(buildSpec(a), lib.prices);
  return (
    <Sheet open={open} onClose={onClose} title="Отчёт и спецификация">
      <div className="copy-row">
        <button className="btn primary" type="button" onClick={onPrint}>Печать / PDF</button>
        <button className="btn" type="button" onClick={copy}>Скопировать отчёт</button>
        <span role="status" style={{ color: msg ? (msg.ok ? 'var(--ok)' : 'var(--ink-2)') : undefined }}>{msg ? msg.t : ''}</span>
      </div>
      <h3 className="sec-t">Группы линий</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Гр.</th><th>Название</th>{three && <th>Фаза</th>}<th className="num">Установл., Вт</th><th className="num">Ток, А</th><th>Защита</th><th>Кабель</th><th className="num">ΔU, %</th><th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {a.rows.map((x, i) => {
              const r = x.r;
              const head = (
                <>
                  <td className="mono t-no" data-label="Гр.">Г{i + 1}</td>
                  <td className="t-name" data-label="Название">{x.l.name}</td>
                  {three && <td className="mono" data-label="Фаза">{r.three ? '3Ф' : (x.l.phase === '3' ? '3Ф' : x.l.phase)}</td>}
                </>
              );
              if (r.empty) {
                return (
                  <tr key={x.l.id}>
                    {head}
                    <td className="num" data-label="Установл., Вт">0</td>
                    <td className="num" data-label="Ток, А">—</td>
                    <td colSpan={4} className="muted">нет приборов</td>
                  </tr>
                );
              }
              return (
                <tr key={x.l.id}>
                  {head}
                  <td className="num" data-label="Установл., Вт">{fmt(r.pInst, 0)}</td>
                  <td className="num" data-label="Ток, А">{fmt(r.I, 1)}</td>
                  <td className="mono" data-label="Защита">{r.In ? protName(r) : '—'}</td>
                  <td className="mono" data-label="Кабель">{r.In ? cableName(r) : '—'}</td>
                  <td className="num" data-label="ΔU, %">{r.In ? fmt(r.drop, 1) : '—'}</td>
                  <td data-label="Статус"><span className={'pill ' + r.status}>{STATUS[r.status]}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={three ? 3 : 2}>Всего</td>
              <td className="num" data-label="Установлено, Вт">{fmt(a.sumInst, 0)}</td>
              <td className="num" data-label="Ток, А">{fmt(a.Itot, 1)}</td>
              <td colSpan={4} className="mono">Расчётная мощность {fmt(a.P / 1000, 1)} кВт</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <h3 className="sec-t">Схема щитка</h3>
      <div className="schem-wrap"><Schematic a={a} /></div>
      <h3 className="sec-t">Спецификация</h3>
      <div className="tablewrap">
        <table className="t2">
          <thead>
            <tr><th>Позиция</th><th className="num">Количество</th><th>Примечание</th><th className="num">Цена, BYN</th><th className="num">Сумма, BYN</th></tr>
          </thead>
          <tbody>
            {est.rows.map(({ item, sum }, i) => (
              <tr key={i}>
                <td className="t-name">{item.name}</td>
                <td className="num" data-label="Количество">{item.qty}</td>
                <td data-label="Примечание">{item.note || '—'}</td>
                <td className="num" data-label="Цена, BYN">
                  <input className="price-in" type="number" inputMode="decimal" min={0} step={0.01} aria-label={'Цена: ' + item.name} value={lib.prices[item.name] ?? ''} onChange={e => libDispatch({ t: 'price', name: item.name, value: e.target.value })} />
                </td>
                <td className="num" data-label="Сумма, BYN">{sum === null ? '—' : fmt(sum, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="est">
        <span>Итого по смете</span>
        <span className="mono">{fmt(est.total, 2)} BYN</span>
      </div>
      {est.missing > 0 && Object.keys(lib.prices).length > 0 && <p className="muted">Для {est.missing} поз. цена или количество не заданы, они не входят в итог.</p>}
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label="Текст отчёта" />}
      <div className="foot">
        <p>Допустимые токи медных жил взяты из таблицы 1.3.4 главы 1.3 ПУЭ, на которую ссылается ТКП 339-2022, и умножены на поправку; прокладка по ГОСТ 30331.15. Групповые сети до 16 мм² выполняются медными жилами (ТКП 339-2022, п. 8.4.4), наименьшее сечение жилы 1,5 мм² (табл. 8.1).</p>
        <p>УЗО до 30 мА предусмотрены для групп освещения, розеток и мощных приборов (СН 4.04.01-2019, изм. 2, п. 16.3.3), при расчётном токе больше 32 А до 100 мА (п. 16.3.13). Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Коэффициенты спроса и одновременности приняты по практике, их сверка с таблицами СН 4.04.01-2019 не выполнена.</p>
        <p>Ввод: до 12 кВт расчётной нагрузки однофазный, больше 12 кВт трёхфазный (СН 4.04.01-2019, п. 9.12). Вводной автомат выбирается на две ступени выше наибольшего группового (п. 10.5). Отключение короткого замыкания проверяется при времени 0,4 с для 230 В (ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1) по сопротивлению петли фаза-нуль питающей сети, которое задаёт пользователь; сопротивление жил считается без учёта индуктивности, расчёт по ГОСТ 28249 не выполнялся.</p>
        <p>Потеря напряжения не более 4 % от номинального напряжения установки по ГОСТ 30331.15-2001, п. 525: этот предел можно включить в параметрах. Сечение нулевого проводника принято равным фазному до 16 мм² (п. 524.2). Допустимые токи самого ГОСТ 30331.15 не содержит (п. 523 отсылает к другому стандарту), поэтому значения взяты из ПУЭ и не сверены с таблицами МЭК 364-5-523.</p>
        <p>Длины кабеля в спецификации взяты из длин групп с запасом 10 %. Сам ввод, трассу в щиток и расход мелочи уточняйте по месту.</p>
        <p>Результат предварительный. Проект щитка и монтаж согласуйте с аттестованным электриком.</p>
      </div>
    </Sheet>
  );
}
