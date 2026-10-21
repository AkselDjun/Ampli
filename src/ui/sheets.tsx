import { useEffect, useRef, useState } from 'react';
import type { Calc, Content, Project } from '../core/types';
import type { TplKey } from '../core/templates';
import { TPL_LIST, TPL_NAME, blank, contentFor, sample } from '../core/templates';
import { cfgN } from '../core/calc';
import { TEMP_MAX, tempFactor } from '../core/correction';
import { dfmt, fmt, plural } from '../core/format';
import { STATUS } from '../core/norms';
import { buildSpec } from '../core/spec';
import { cableName, protName } from '../core/protection';
import { reportText } from '../core/report';
import { buildXlsx, exportName, exportTables, toCsv } from '../core/export';
import { download } from './download';
import { delPhoto, forgetPhotoUrl } from '../store/photos';
import { IconDownload } from './Icons';
import { normProject, slug } from '../core/project';
import type { Action } from '../store/reducer';
import { ArmButton, Assumptions, Seg, Sheet, Stepper, TabPanel, Tabs, Tip } from './common';
import { Schematic } from './Schematic';
import { toast, toastBad, toastOk } from './toast';
import { IOS_STEPS, install, usePwa } from './pwa';
import { PWA_ENABLED } from '../core/flags';
import { ShareBlock } from './ShareBlock';
import { LaborTable, Totals, totals } from './Labor';
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
  const [temp, setTemp] = useState('25');
  const tf = tempFactor(Number(temp));
  const replace = (content: Content) => {
    dispatch({ t: 'replace', content });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Параметры сети">
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
        <Seg<string> name="mins" labelledBy="l-mins" value={c.safe ? 'safe' : 'norm'} items={[['safe', 'С запасом'], ['norm', 'По норме']]} onChange={v => dispatch({ t: 'cfg', field: 'minS', value: v })} />
        <small>ГОСТ 30331.15-2001 (табл. 52J) допускает 1,5 мм². «С запасом»: не менее 2,5 мм² для розеток и мощных приборов.</small>
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
          <div className="tcalc">
            <label>
              <span className="lbl">Температура воздуха, °C</span>
              <input type="number" inputMode="decimal" min={25} max={TEMP_MAX} step={5} aria-label="Температура воздуха, °C" value={temp} onChange={e => setTemp(e.target.value)} />
            </label>
            <span>Коэффициент по ПУЭ, табл. 1.3.3: <b>{fmt(tf, 2)}</b></span>
            <button className="btn ghost" type="button" onClick={() => dispatch({ t: 'cfg', field: 'k', value: String(tf) })}>Подставить</button>
            <Tip>Для проводов с жилой до 65 °C, как в таблице допустимых токов. Группировку кабелей учтите отдельно: в трубе её уже учитывает число проводов, в пучке и лотке это дополнительный коэффициент.</Tip>
          </div>
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
  const [tab, setTab] = useState('main');
  const [elec, setElec] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTplOpen(false);
  }, [open]);
  const note = (t: string, bad = false) => (bad ? toastBad(t) : toastOk(t));
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
    <Sheet open={open} onClose={onClose} title="Проекты" bar={<Tabs scope="pj" label="Разделы окна проектов" cur={tab} onChange={setTab} items={[{ id: 'main', label: 'Проекты' }, { id: 'share', label: 'Обмен и данные' }]} />} tip="Проекты хранятся только в этом браузере. Чтобы перенести проект на другое устройство, сохраните его в файл или отправьте ссылкой.">
      <TabPanel scope="pj" id="main" cur={tab}>
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
              <button className="btn" type="button" onClick={() => { dispatch({ t: 'dupProject', id: x.id }); note('Копия создана'); }}>Копировать</button>
              <ArmButton className="btn danger" label="Удалить" armedLabel="Точно удалить?" onRun={() => { (x.photos ?? []).forEach(ph => { forgetPhotoUrl(ph.id); delPhoto(ph.id).catch(() => undefined); }); dispatch({ t: 'delProject', id: x.id }); toastOk('Проект удалён: ' + (x.name || 'Без названия')); }} />
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
      </TabPanel>
      <TabPanel scope="pj" id="share" cur={tab}>
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={() => { libDispatch({ t: 'addTpl', name: p.name || 'Мой шаблон', cfg: p.cfg, lines: p.lines }); note('Шаблон сохранён: ' + (p.name || 'Мой шаблон')); }}>Сохранить как шаблон</button>
        <button className="btn ghost" type="button" onClick={onLib}>Мои данные</button>
      </div>
      <ShareBlock p={p} />
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
      <InstallBlock />
      </TabPanel>
    </Sheet>
  );
}

export function ReportSheet({
  open, onClose, p, a, onPrint, onCompare, onShop, dispatch
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  dispatch: (x: Action) => void;
  onPrint: () => void;
  onCompare: () => void;
  onShop: () => void;
}) {
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
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
      toastOk('Отчёт скопирован');
    } catch (e) {
      void e;
      setFallback(txt);
      toast('Текст выделен, скопируйте его вручную');
    }
  };
  const saveFile = (kind: 'xlsx' | 'csv') => {
    const tables = exportTables(a, lib.prices, lib.labor, p.work);
    if (kind === 'xlsx') download(exportName(p.name, 'xlsx'), buildXlsx(tables), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else download(exportName(p.name, 'csv'), toCsv(tables[0]), 'text/csv;charset=utf-8');
    toastOk(kind === 'xlsx' ? 'Файл Excel сохранён' : 'Файл CSV сохранён');
  };
  const three = a.c.supply === 3;
  const { lib, dispatch: libDispatch } = useLib();
  const est = estimate(buildSpec(a), lib.prices);
  const [tab, setTab] = useState('groups');
  return (
    <Sheet open={open} onClose={onClose} title="Отчёт и спецификация" bar={<Tabs scope="rep" label="Разделы отчёта" cur={tab} onChange={setTab} items={[{ id: 'groups', label: 'Группы' }, { id: 'scheme', label: 'Схема' }, { id: 'estimate', label: 'Смета' }, { id: 'notes', label: 'Допущения' }]} />}>
      <TabPanel scope="rep" id="groups" cur={tab}>
      <div className="copy-row">
        <button className="btn primary" type="button" onClick={onPrint}>Печать / PDF</button>
        <button className="btn" type="button" onClick={copy}>Скопировать отчёт</button>
        <button className="btn" type="button" onClick={onCompare}>Сравнить варианты</button>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label="Текст отчёта" />}
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
      </TabPanel>
      <TabPanel scope="rep" id="scheme" cur={tab}>
      <h3 className="sec-t">Схема щитка</h3>
      <div className="schem-wrap"><Schematic a={a} /></div>
      </TabPanel>
      <TabPanel scope="rep" id="estimate" cur={tab}>
      <div className="copy-row">
        <button className="btn" type="button" onClick={() => saveFile('xlsx')} data-tip="Смета и группы в Excel"><IconDownload /> Excel</button>
        <button className="btn" type="button" onClick={() => saveFile('csv')} data-tip="Смета в CSV"><IconDownload /> CSV</button>
        <button className="btn" type="button" onClick={onShop}>Где купить</button>
      </div>
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
        <span>Материалы</span>
        <span className="mono">{fmt(est.total, 2)} BYN</span>
      </div>
      {est.missing > 0 && Object.keys(lib.prices).length > 0 && <p className="muted">Для {est.missing} поз. цена или количество не заданы, они не входят в итог.</p>}
      <LaborTable p={p} a={a} dispatch={dispatch} />
      <Totals {...totals(a, p, lib.prices, lib.labor)} />
      <ShareBlock p={p} kind="estimate" />
      </TabPanel>
      <TabPanel scope="rep" id="notes" cur={tab}>
      <h3 className="sec-t">Допущения и источники</h3>
      <Assumptions cfg={cfgN(p.cfg)} />
      <div className="foot">
        <p>Допустимые токи медных жил взяты из таблицы 1.3.4 главы 1.3 ПУЭ, на которую ссылается ТКП 339-2022, и умножены на поправку; прокладка по ГОСТ 30331.15. Групповые сети выполняются медными жилами, наименьшее сечение жилы 1,5 мм² (ГОСТ 30331.15-2001, табл. 52J).</p>
        <p>УЗО до 30 мА предусмотрены для розеток и светильников (ТКП 339-2022 с изм. № 1, п. 4.3.18.5) и по практике для мощных приборов, при расчётном токе больше 32 А до 100 мА (СН 4.04.01-2019, п. 16.3.13). Время отключения УЗО в протоколе сравнивается с табл. 4.4.47 и 4.4.48 ТКП 339-2022 в редакции изм. № 1. Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Коэффициенты спроса и одновременности приняты по практике, их сверка с таблицами СН 4.04.01-2019 не выполнена.</p>
        <p>Ввод: до 12 кВт расчётной нагрузки однофазный, больше 12 кВт трёхфазный (СН 4.04.01-2019, п. 9.12). Вводной автомат выбирается на две ступени выше наибольшего группового (п. 10.5). Отключение короткого замыкания проверяется при времени 0,4 с для 230 В (ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1) по сопротивлению петли фаза-нуль питающей сети, которое задаёт пользователь; сопротивление жил считается без учёта индуктивности, расчёт по ГОСТ 28249 не выполнялся.</p>
        <p>Потеря напряжения не более 4 % от номинального напряжения установки по ГОСТ 30331.15-2001, п. 525: этот предел можно включить в параметрах. Сечение нулевого проводника принято равным фазному до 16 мм² (п. 524.2). Допустимые токи самого ГОСТ 30331.15 не содержит (п. 523 отсылает к другому стандарту), поэтому значения взяты из ПУЭ и не сверены с таблицами МЭК 364-5-523.</p>
        <p>Длины кабеля в спецификации взяты из длин групп с запасом 10 %. Сам ввод, трассу в щиток и расход мелочи уточняйте по месту.</p>
        <p>Нормативная база: ТКП 339-2022 с изменением № 1 (действует с 01.08.2025); СН 4.04.01-2019 «Системы электрооборудования жилых и общественных зданий»; ПУЭ, табл. 1.3.3 и 1.3.4; ГОСТ 30331.15-2001. Изменение № 2 к СН 4.04.01-2019 вступает в силу 07.12.2026 и в расчёте пока не учтено. Раздел 8 ТКП 339-2022 исключён изменением № 1, требования к жилым зданиям перенесены в СП 4.04.04-2023, сверка с ним не выполнена.</p>
        <p>Результат предварительный. Проект щитка и монтаж согласуйте с аттестованным электриком.</p>
      </div>
      </TabPanel>
    </Sheet>
  );
}

export function InstallBlock() {
  const s = usePwa();
  let body: JSX.Element | null = null;
  if (!PWA_ENABLED) return null;
  if (s.standalone) body = <p className="muted">Ampli установлен на это устройство и работает без интернета.</p>;
  else if (s.can) {
    body = (
      <div className="data-row">
        <button className="btn" type="button" onClick={() => { void install(); }}><IconDownload /> Установить приложение</button>
        <Tip>Ampli откроется с экрана устройства как обычное приложение и будет работать без интернета. Проекты останутся на этом устройстве.</Tip>
      </div>
    );
  } else if (s.ios) body = <p className="muted">На iPhone и iPad Ampli можно добавить на экран «Домой», тогда он работает без интернета. {IOS_STEPS}</p>;
  if (!body) return null;
  return (
    <>
      <h3 className="sec-t">Приложение</h3>
      {body}
    </>
  );
}
