import { useRef, useState } from 'react';
import type { Calc, Line, LineType, Phase, Photo } from '../core/types';
import { NB, fmt, fs, pn, round2 } from '../core/format';
import { STATUS, TYPES, TYPE_KEYS } from '../core/norms';
import { byUsage, catalog, searchCatalog, topUsed } from '../core/catalog';
import { whyRows } from '../core/why';
import type { Action } from '../store/reducer';
import { IconDown, IconSearch } from './Icons';
import { PhotoStrip } from './PhotoStrip';
import { ArmButton, Seg, Stepper } from './common';
import { useLib } from '../store/LibContext';
import { parseApps } from '../core/quick';

function Tile({ label, val, sub }: { label: string; val: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="lbl">{label}</span>
      <b>{val}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Editor({
  l, idx, a, dispatch, whyOpen, setWhyOpen, onDeleted, photos
}: {
  photos: Photo[];
  l: Line | null;
  idx: number;
  a: Calc;
  dispatch: (x: Action) => void;
  whyOpen: boolean;
  setWhyOpen: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const { lib, dispatch: libDispatch } = useLib();
  const chips = useRef<HTMLDivElement>(null);
  const focusNew = useRef(false);
  const [measOpen, setMeasOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<string | null>(null);
  const [quickMsg, setQuickMsg] = useState('');
  if (!l) {
    return (
      <section className="col col-edit" aria-label="Редактор группы">
        <div className="empty">Выберите группу слева или добавьте новую.</div>
      </section>
    );
  }
  const x = a.rows.find(y => y.l.id === l.id);
  const r = x ? x.r : null;
  const three = a.c.supply === 3;
  const phItems: [Phase, string][] = [['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3']];
  if (l.type === 'power') phItems.push(['3', '3 фазы']);
  const tag = TYPES[l.type].tag;
  const keepChips = (fn: () => void) => {
    const sl = chips.current ? chips.current.scrollLeft : 0;
    fn();
    requestAnimationFrame(() => {
      if (chips.current) chips.current.scrollLeft = sl;
    });
  };
  const cat = catalog(lib.apps);
  const found = searchCatalog(cat, search, lib.usage, tag);
  const often = topUsed(cat, lib.usage, tag);
  const addFrom = (name: string, w: number) => {
    keepChips(() => dispatch({ t: 'addApp', name, w }));
    libDispatch({ t: 'use', name });
    setSearch('');
  };
  const setLen = (v: number) => dispatch({ t: 'lineField', field: 'len', value: Math.max(0, Math.min(500, round2(v))) });
  return (
    <section className="col col-edit" aria-label="Редактор группы">
      <div className="ed">
        <div className="ed-head">
          <span className="no">Г{idx + 1}</span>
          <input className="ed-name" aria-label="Название группы" value={l.name} onChange={e => dispatch({ t: 'lineField', field: 'name', value: e.target.value })} />
          {r && !r.empty && <span className={'pill ' + r.status}>{STATUS[r.status]}</span>}
        </div>
        {r && (
          <>
            <div className={'ed-res' + (r.empty ? '' : ' ' + r.status)}>
              {r.empty ? (
                <p>Добавьте приборы ниже, расчёт появится здесь.</p>
              ) : (
                <>
                  <Tile label="Ток" val={fmt(r.I, 1) + NB + 'А'} />
                  {r.In ? (
                    <>
                      <Tile label="Автомат" val={r.curve + r.In} sub={r.rcd ? 'дифавтомат ' + r.ma + ' мА' : 'автомат'} />
                      <Tile label="Кабель" val={fs(r.S as number) + NB + 'мм²'} sub={(r.three ? 5 : 3) + '-жильный'} />
                      <Tile label="ΔU" val={fmt(r.drop, 1) + NB + '%'} sub={'допустимо ' + fmt(r.limit, 1) + NB + '%'} />
                    </>
                  ) : (
                    <p style={{ gridColumn: 'span 3' }}>Подбор невозможен, см. замечание ниже.</p>
                  )}
                </>
              )}
            </div>
            <p className="ed-load">
              {r.empty ? '' : 'Нагрузка ' + fmt(r.pd, 0) + ' Вт' + (r.kc < 1 ? ' (из ' + fmt(r.pInst, 0) + ' Вт, Кс ' + fs(round2(r.kc)) + ')' : '')}
            </p>
            <ul className="notes">
              {!r.empty && r.notes.map(n => <li key={n}>{n}</li>)}
            </ul>
            <div className="why">
              {!r.empty && (
                <>
                  <button className="why-t" type="button" aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}>
                    <span>Как посчитано</span>
                    <IconDown />
                  </button>
                  <dl className="why-b" hidden={!whyOpen}>
                    {whyRows(l, r, a.c).map(w => (
                      <div key={w.title} style={{ display: 'contents' }}>
                        <dt>{w.title}</dt>
                        <dd>
                          <span className="w-f">{w.formula}</span>
                          {w.note && <span className="w-n">{w.note}</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          </>
        )}
        <div className="blk">
          <span className="lbl">Тип группы</span>
          <Seg<LineType> name={'t-' + l.id} value={l.type} items={TYPE_KEYS.map(k => [k, TYPES[k].short])} onChange={v => dispatch({ t: 'lineType', type: v })} />
        </div>
        {l.type !== 'light' && (
          <div className="blk">
            <span className="lbl">Помещение</span>
            <Seg<string> name={'w-' + l.id} value={l.wet ? 'wet' : 'dry'} items={[['dry', 'Обычное'], ['wet', 'Вне помещения или особо опасное']]} onChange={v => dispatch({ t: 'lineWet', wet: v === 'wet' })} />
          </div>
        )}
        {three && (
          <div className="blk">
            <span className="lbl">Фаза</span>
            <Seg<Phase> name={'p-' + l.id} value={l.phase} items={phItems} onChange={v => dispatch({ t: 'linePhase', phase: v })} />
          </div>
        )}
        <div className="grid3">
          <div className="f len-f">
            <span className="lbl">Длина линии</span>
            <Stepper
              value={l.len}
              onChange={v => dispatch({ t: 'lineField', field: 'len', value: v })}
              onStep={d => setLen(pn(l.len, 0) + d)}
              d={1}
              min={0}
              step="any"
              label="Длина линии, м"
              less="Короче"
              more="Длиннее"
            />
          </div>
          <label className="f">
            <span className="lbl">Коэффициент спроса</span>
            <input type="number" inputMode="decimal" min={0.05} max={1} step={0.05} value={String(l.kc)} onChange={e => dispatch({ t: 'lineField', field: 'kc', value: e.target.value })} />
          </label>
          <label className="f">
            <span className="lbl">cos φ</span>
            <input type="number" inputMode="decimal" min={0.3} max={1} step={0.05} value={String(l.cos)} onChange={e => dispatch({ t: 'lineField', field: 'cos', value: e.target.value })} />
          </label>
        </div>
        <div className="blk">
          <span className="lbl">Приборы</span>
          <div className="apps">
            {l.apps.length > 0 && (
              <div className="app app-h">
                <span>Прибор</span>
                <span>Мощность</span>
                <span>Штук</span>
                <span />
              </div>
            )}
            {l.apps.map((ap, i) => (
              <div className="app" key={ap.id}>
                <input className="a-name" aria-label="Название прибора" placeholder="Название прибора" value={ap.name} ref={el => { if (el && focusNew.current && i === l.apps.length - 1) { focusNew.current = false; el.focus(); } }} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'name', value: e.target.value })} />
                <label className="a-w">
                  <span className="lbl a-lbl">Мощность</span>
                  <span className="fld" data-sfx="Вт">
                    <input aria-label="Мощность, Вт" type="number" inputMode="numeric" min={0} step="any" placeholder="0" value={String(ap.w)} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'w', value: e.target.value })} />
                  </span>
                </label>
                <div className="a-n">
                  <span className="lbl a-lbl">Штук</span>
                  <div className="step">
                    <button type="button" aria-label="Меньше" onClick={() => dispatch({ t: 'appField', id: ap.id, field: 'n', value: Math.max(1, Math.min(99, pn(ap.n, 1) - 1)) })}>−</button>
                    <input aria-label="Количество" type="number" inputMode="numeric" min={0} step={1} value={String(ap.n)} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'n', value: e.target.value })} />
                    <button type="button" aria-label="Больше" onClick={() => dispatch({ t: 'appField', id: ap.id, field: 'n', value: Math.max(1, Math.min(99, pn(ap.n, 1) + 1)) })}>+</button>
                  </div>
                </div>
                <button className="icon-btn a-del" type="button" aria-label="Удалить прибор" title="Удалить прибор" onClick={() => keepChips(() => dispatch({ t: 'delApp', id: ap.id }))}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="blk meas">
          <button className="why-t" type="button" aria-expanded={measOpen} onClick={() => setMeasOpen(!measOpen)}>
            <span>Замеры после монтажа</span>
            <IconDown />
          </button>
          <div className="grid3" hidden={!measOpen}>
            <label className="f">
              <span className="lbl">Петля фаза-нуль, Ом</span>
              <input type="number" inputMode="decimal" min={0} step={0.01} aria-label="Замер петли фаза-нуль, Ом" value={String(l.meas?.zs ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'zs', value: e.target.value })} />
            </label>
            <label className="f">
              <span className="lbl">Изоляция, МОм</span>
              <input type="number" inputMode="decimal" min={0} step={0.1} aria-label="Замер сопротивления изоляции, МОм" value={String(l.meas?.ins ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'ins', value: e.target.value })} />
            </label>
            <label className="f">
              <span className="lbl">Ток утечки, мА</span>
              <input type="number" inputMode="decimal" min={0} step={0.1} aria-label="Замер тока утечки, мА" value={String(l.meas?.leak ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'leak', value: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="blk">
          <span className="lbl">Фото группы</span>
          <PhotoStrip
            name={'line'}
            line={l.id}
            tags={['before', 'after', 'plate', 'meas']}
            total={photos.length}
            photos={photos.filter(ph => ph.line === l.id)}
            onAdd={photo => dispatch({ t: 'photoAdd', photo })}
            onDel={id => dispatch({ t: 'photoDel', id })}
            onNote={(id, value) => dispatch({ t: 'photoNote', id, value })}
          />
        </div>
        <div className="blk">
          <span className="lbl">Добавить прибор</span>
          <div className="search">
            <IconSearch />
            <input type="search" aria-label="Найти прибор" placeholder="Найти прибор" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {found.length > 0 && (
            <ul className="found" aria-label="Найденные приборы">
              {found.map(it => (
                <li key={it.key + (it.mine ?? '')}>
                  <button type="button" onClick={() => addFrom(it.name, it.w)}>
                    <span>+ {it.name}</span>
                    <span className="muted">{it.w} Вт</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.trim() && found.length === 0 && (
            <button className="chip custom" type="button" onClick={() => { keepChips(() => dispatch({ t: 'addApp', name: search.trim() })); libDispatch({ t: 'use', name: search }); setSearch(''); }}>
              + Добавить «{search.trim()}»
            </button>
          )}
          {!search.trim() && often.length > 0 && (
            <div className="chips often" aria-label="Часто используемые">
              {often.map(it => (
                <button key={'o' + it.key} className="chip hot" type="button" title={it.w + ' Вт'} onClick={() => addFrom(it.name, it.w)}>
                  + {it.name}
                </button>
              ))}
            </div>
          )}
          <div className="chips" ref={chips}>
            {byUsage(catalog([]).filter(it => it.tags.indexOf(tag) >= 0), lib.usage).map(it => (
              <button key={it.key} className="chip" type="button" title={it.w + ' Вт'} onClick={() => addFrom(it.name, it.w)}>
                + {it.name}
              </button>
            ))}
            {byUsage(lib.apps.filter(m => m.tag === tag).map(m => ({ key: m.id, name: m.name, w: m.w, tags: m.tag, mine: m.id })), lib.usage).map(it => (
              <span className="chip-mine" key={it.key}>
                <button className="chip" type="button" title={it.w + ' Вт'} onClick={() => addFrom(it.name, it.w)}>+ {it.name}</button>
                <button className="chip-x" type="button" aria-label={'Убрать из моих приборов: ' + it.name} onClick={() => libDispatch({ t: 'delApp', id: it.key })}>×</button>
              </span>
            ))}
            <button className="chip custom" type="button" onClick={() => keepChips(() => { focusNew.current = true; dispatch({ t: 'addApp' }); })}>+ Свой прибор</button>
          </div>
          {l.apps.some(ap => ap.name.trim() && pn(ap.w, 0) > 0) && (
            <button className="link" type="button" onClick={() => libDispatch({ t: 'addApps', apps: l.apps.filter(ap => ap.name.trim() && pn(ap.w, 0) > 0).map(ap => ({ name: ap.name, w: pn(ap.w, 0), tag: tag as 'l' | 's' | 'p' })) })}>Сохранить приборы группы в мои</button>
          )}
        </div>
        <div className="blk">
          <button className="link" type="button" aria-expanded={quick !== null} onClick={() => { setQuick(quick === null ? '' : null); setQuickMsg(''); }}>Вставить список текстом</button>
          {quick !== null && (
            <div className="quick">
              <textarea aria-label="Список приборов" rows={3} placeholder="чайник 2200, духовка 2,5 кВт, лампы 60 x5" value={quick} onChange={e => setQuick(e.target.value)} />
              <div className="copy-row">
                <button className="btn primary" type="button" onClick={() => {
                  const r = parseApps(quick);
                  if (r.apps.length) dispatch({ t: 'addApps', apps: r.apps });
                  setQuickMsg((r.apps.length ? 'Добавлено: ' + r.apps.length : 'Ничего не добавлено') + (r.skipped.length ? '. Не разобрано: ' + r.skipped.join('; ') : ''));
                  if (r.apps.length && !r.skipped.length) setQuick('');
                }}>Добавить</button>
                <span role="status" className="muted">{quickMsg}</span>
              </div>
            </div>
          )}
        </div>
        <div className="blk">
          <button className="btn" type="button" onClick={() => dispatch({ t: 'dupLine' })}>Копия группы</button>
        </div>
        <div className="blk">
          <ArmButton className="btn danger" label="Удалить группу" armedLabel="Нажмите ещё раз, чтобы удалить" onRun={() => { dispatch({ t: 'delLine' }); onDeleted(); }} />
        </div>
      </div>
    </section>
  );
}
