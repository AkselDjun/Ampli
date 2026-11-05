import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Calc, Line, LineType, Phase, Photo } from '../core/types';
import { NB, fmt, fs, plural, pn, round2 } from '../core/format';
import { STATUS, TYPES, TYPE_KEYS } from '../core/norms';
import { ZONES } from '../core/rooms';
import { byUsage, catalog, searchCatalog, topUsed } from '../core/catalog';
import { whyRows } from '../core/why';
import type { Action } from '../store/reducer';
import { toastOk } from './toast';
import { IconDown, IconSearch } from './Icons';
import { usePop } from './pop';
import { useMenuKeys } from './menu';
import { PhotoStrip } from './PhotoStrip';
import { FixBar } from './FixBar';
import { fixFor } from '../core/fixes';
import { ArmButton, Seg, Stepper } from './common';
import { useLib } from '../store/LibContext';
import { parseApps } from '../core/quick';
import { zoneOf } from '../core/calc';
import { useByRoom } from './prefs';

const CHIP_MAX = 6;

function Flash({ v }: { v: string }) {
  const prev = useRef(v);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current === v) return;
    prev.current = v;
    setN(k => k + 1);
  }, [v]);
  return <b key={n} className={n ? 'flash' : undefined}>{v}</b>;
}

function Tile({ label, val, sub }: { label: string; val: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="lbl">{label}</span>
      <Flash v={val} />
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [byRoom] = useByRoom();
  const [quick, setQuick] = useState<string | null>(null);
  const [quickMsg, setQuickMsg] = useState('');
  const [allChips, setAllChips] = useState(false);
  const resRef = useRef<HTMLDivElement>(null);
  const [mini, setMini] = useState(false);
  const [brOn, setBrOn] = useState(false);
  const { ref: menuRef, open: menuOpen, setOpen: setMenuOpen } = usePop<HTMLDivElement>();
  const { listRef: mkListRef, triggerRef: mkTriggerRef, onKeyDown: mkKeyDown, back: mkBack } = useMenuKeys(menuOpen, () => setMenuOpen(false));
  const powRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lid = l?.id;
  const [lidSeen, setLidSeen] = useState(lid);
  if (lid !== lidSeen) {
    setLidSeen(lid);
    setMini(false);
    setBrOn(false);
  }
  useEffect(() => {
    const el = resRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setMini(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds ? e.rootBounds.top : 56) + 1), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [lid]);
  const xr = l ? a.rows.find(y => y.l.id === l.id)?.r : undefined;
  const speak = xr && !xr.empty && xr.In ? 'ток ' + fmt(xr.I, 1) + ' А, автомат ' + xr.curve + xr.In + ', кабель ' + fs(xr.S as number) + ' мм², потеря ' + fmt(xr.drop, 1) + ' %, ' + STATUS[xr.status].toLowerCase() : (xr && !xr.empty ? 'подбор невозможен' : '');
  const [say, setSay] = useState('');
  const last = useRef<{ id: string | undefined; v: string }>({ id: undefined, v: '' });
  useEffect(() => {
    const prev = last.current;
    last.current = { id: lid, v: speak };
    if (prev.id !== lid) {
      setSay('');
      return;
    }
    if (prev.v === speak || !speak) return;
    const t = window.setTimeout(() => setSay('Г' + (idx + 1) + ': ' + speak), 700);
    return () => window.clearTimeout(t);
  }, [lid, speak, idx]);
  if (!l) {
    return (
      <section className="col col-edit" id="editor" tabIndex={-1} aria-label="Редактор группы">
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
  const fix = r ? fixFor(l, r, a.c) : null;
  const cat = catalog();
  const found = searchCatalog(cat, search, lib.usage, tag);
  const often = topUsed(cat, lib.usage, tag);
  const presets = byUsage(catalog().filter(it => it.tags.indexOf(tag) >= 0 && (search.trim() || !often.some(o => o.key === it.key))), lib.usage);
  const addFrom = (name: string, w: number) => {
    keepChips(() => dispatch({ t: 'addApp', name, w, ...(/лент/i.test(name) ? { m: 5 } : {}) }));
    libDispatch({ t: 'use', name });
    setSearch('');
  };
  const nMeas = (['zs', 'ins', 'leak', 'rcd'] as const).filter(k => String(l.meas?.[k] ?? '').trim() !== '').length;
  const nPhotos = photos.filter(ph => ph.line === l.id).length;
  const measSum = [nMeas ? nMeas + ' ' + plural(nMeas, ['замер', 'замера', 'замеров']) : '', nPhotos ? nPhotos + ' фото' : ''].filter(Boolean).join(', ');
  const moreSum = [a.c.rcdMode ? '' : (l.zone?.trim() ?? ''), l.where?.trim() ?? '', l.type !== 'light' ? (l.wet ? 'особо опасные условия' : 'обычные условия') : ''].filter(Boolean).join(', ');
  const zones = Array.from(new Set([...a.rows.map(y => (y.l.zone ?? '').trim()).filter(Boolean), ...ZONES]));
  const hasBr = !!r && r.len > pn(l.len, 0);
  const showBr = brOn || l.apps.some(ap => pn(ap.br, 0) > 0);
  const addEmpty = () => keepChips(() => { focusNew.current = true; dispatch({ t: 'addApp' }); });
  const onPowKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = l.apps[i + 1];
    if (next) powRefs.current[next.id]?.focus();
    else addEmpty();
  };
  const peers = a.rows.map((_y, i) => i).filter(i => !(byRoom || a.c.rcdMode) || zoneOf(a.rows[i].l).toLowerCase() === zoneOf(l).toLowerCase());
  const pi = peers.indexOf(idx);
  const prevPeer = pi > 0 ? peers[pi - 1] : -1;
  const nextPeer = pi >= 0 && pi < peers.length - 1 ? peers[pi + 1] : -1;
  const setLen = (v: number) => dispatch({ t: 'lineField', field: 'len', value: Math.max(0, Math.min(500, round2(v))) });
  return (
    <section className="col col-edit" id="editor" tabIndex={-1} aria-label="Редактор группы">
      <div className="ed">
        <h2 className="vh">Группа Г{idx + 1} {l.name || 'Без названия'}</h2>
        <p className="vh ed-say" aria-live="polite" aria-atomic="true">{say}</p>
        <div className="ed-head">
          <span className="no">Г{idx + 1}</span>
          <input className="ed-name" aria-label="Название группы" value={l.name} onChange={e => dispatch({ t: 'lineField', field: 'name', value: e.target.value })} />
          {r && !r.empty && <span className={'pill ' + r.status}>{STATUS[r.status]}</span>}
        </div>
        {r && (
          <>
            {mini && !r.empty && r.In && document.getElementById('ab-sub') && createPortal(
              <button type="button" className={'ed-mini ' + r.status} aria-label={'Г' + (idx + 1) + ': ' + speak + '. Показать расчёт'} onClick={() => resRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
                <i className="dot" aria-hidden="true">{r.status === 'ok' ? '' : '!'}</i>
                <Flash v={fmt(r.I, 1) + NB + 'А'} />
                <Flash v={r.curve + r.In} />
                <Flash v={fs(r.S as number) + NB + 'мм²'} />
                <Flash v={'ΔU ' + fmt(r.drop, 1) + NB + '%'} />
              </button>,
              document.getElementById('ab-sub') as HTMLElement
            )}
            <div className={'ed-res' + (r.empty ? '' : ' ' + r.status)} ref={resRef} key={l.id}>
              {r.empty ? (
                <p>Добавьте приборы ниже, расчёт появится здесь.</p>
              ) : (
                <>
                  <Tile label="Ток" val={fmt(r.I, 1) + NB + 'А'} sub={'нагрузка ' + fmt(r.pd, 0) + NB + 'Вт'} />
                  {r.In ? (
                    <>
                      <Tile label="Автомат" val={r.curve + r.In} sub={(r.rcbo ? 'дифавтомат ' + r.ma + ' мА' : r.rcd ? 'УЗО «' + r.zone + '» ' + r.ma + ' мА' : 'автомат') + (r.rcd && r.rcdA ? ', тип A' : '')} />
                      <Tile label="Кабель" val={fs(r.S as number) + NB + 'мм²'} sub={(r.three ? 5 : 3) + '-жильный'} />
                      <Tile label="Потеря" val={fmt(r.drop, 1) + NB + '%'} sub={'напряжения, до ' + fmt(r.limit, 1) + NB + '%'} />
                    </>
                  ) : (
                    <p style={{ gridColumn: 'span 3' }}>Подбор невозможен, см. замечание ниже.</p>
                  )}
                </>
              )}
            </div>
            {fix && (
              <FixBar
                fix={fix}
                onApply={() => {
                  if (!fix.act) return;
                  if (fix.act.k === 'len') dispatch({ t: 'lineField', field: 'len', value: fix.act.len });
                  else dispatch({ t: 'splitLine', mode: fix.act.k });
                  toastOk('Исправлено');
                }}
              />
            )}
            <ul className={'notes' + (r.status === 'bad' ? ' bad' : '')}>
              {!r.empty && r.notes.map(n => <li key={n}>{n}</li>)}
              {!r.empty && r.tips.map(n => <li key={n} className="tip-n">{n}</li>)}
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
        {l.type === 'socket' && (
          <div className="grid3 sock">
            <label className="f">
              <span className="lbl">Розеток, шт</span>
              <input type="text" inputMode="numeric" min={0} step={1} aria-label="Розеток в группе, шт" placeholder="0" value={String(l.sockets ?? '')} onChange={e => dispatch({ t: 'lineField', field: 'sockets', value: e.target.value })} />
            </label>
            <label className="f">
              <span className="lbl">На розетку, Вт</span>
              <input type="text" inputMode="numeric" min={0} step="any" aria-label="Нагрузка на розетку, Вт" placeholder="0" value={String(l.perSocket ?? '')} onChange={e => dispatch({ t: 'lineField', field: 'perSocket', value: e.target.value })} />
            </label>
          </div>
        )}
        <div className="blk">
          <span className="lbl">Приборы</span>
          <div className={'apps' + (showBr ? '' : ' no-br')}>
            {l.apps.length > 0 && (
              <div className="app app-h">
                <span>Прибор</span>
                <span>Мощность</span>
                <span>Штук / длина</span>
                {showBr && <span data-tip="Длина кабеля от распредкоробки до прибора">Отвод, м</span>}
                <span />
              </div>
            )}
            {l.apps.map((ap, i) => (
              <div className="app" key={ap.id}>
                <input className="a-name" aria-label="Название прибора" placeholder="Название прибора" value={ap.name} ref={el => { if (el && focusNew.current && i === l.apps.length - 1) { focusNew.current = false; el.focus(); } }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); powRefs.current[ap.id]?.focus(); } }} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'name', value: e.target.value })} />
                <label className="a-w">
                  <span className="lbl a-lbl">Мощность</span>
                  <span className="fld" data-sfx={ap.m !== undefined ? 'Вт/м' : 'Вт'}>
                    <input aria-label={ap.m !== undefined ? 'Мощность, Вт на метр' : 'Мощность, Вт'} type="text" inputMode="numeric" enterKeyHint="next" min={0} step="any" placeholder="0" value={String(ap.w)} ref={el => { powRefs.current[ap.id] = el; }} onKeyDown={e => onPowKey(e, i)} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'w', value: e.target.value })} />
                  </span>
                </label>
                {ap.m !== undefined ? (
                  <label className="a-n">
                    <span className="lbl a-lbl">Длина ленты</span>
                    <span className="fld" data-sfx="м">
                      <input aria-label="Длина ленты, м" type="text" inputMode="decimal" min={0} step="any" value={String(ap.m)} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'm', value: e.target.value })} />
                    </span>
                  </label>
                ) : (
                  <div className="a-n">
                    <span className="lbl a-lbl">Штук</span>
                    <div className="step">
                      <button type="button" aria-label="Меньше" onClick={() => dispatch({ t: 'appField', id: ap.id, field: 'n', value: Math.max(1, Math.min(999, pn(ap.n, 1) - 1)) })}>−</button>
                      <input aria-label="Количество" type="text" inputMode="numeric" min={0} step={1} value={String(ap.n)} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'n', value: e.target.value })} />
                      <button type="button" aria-label="Больше" onClick={() => dispatch({ t: 'appField', id: ap.id, field: 'n', value: Math.max(1, Math.min(999, pn(ap.n, 1) + 1)) })}>+</button>
                    </div>
                  </div>
                )}
                {showBr && (
                  <label className="a-br">
                    <span className="lbl a-lbl">Отвод</span>
                    <span className="fld" data-sfx="м">
                      <input aria-label="Отвод от коробки, м" type="text" inputMode="decimal" min={0} step="any" placeholder="0" value={String(ap.br ?? '')} onChange={e => dispatch({ t: 'appField', id: ap.id, field: 'br', value: e.target.value })} />
                    </span>
                  </label>
                )}
                <button className="icon-btn a-del" type="button" aria-label="Удалить прибор" data-tip="Удалить прибор" onClick={() => keepChips(() => { dispatch({ t: 'delApp', id: ap.id }); if (ap.name.trim() || pn(ap.w, 0) > 0) toastOk('Прибор удалён: ' + (ap.name.trim() || 'без названия')); })}>×</button>
              </div>
            ))}
          </div>
          <div className="search">
            <IconSearch />
            <input type="search" aria-label="Найти прибор" placeholder="Найти прибор" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {found.length > 0 && (
            <ul className="found" aria-label="Найденные приборы">
              {found.map(it => (
                <li key={it.key}>
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
                <button key={'o' + it.key} className="chip hot" type="button" data-tip={it.w + ' Вт'} onClick={() => addFrom(it.name, it.w)}>
                  + {it.name}
                </button>
              ))}
            </div>
          )}
          <div className={'chips' + (allChips ? ' all' : '')} ref={chips}>
            <button className="chip custom" type="button" onClick={addEmpty}>+ Свой прибор</button>
            {presets.slice(0, allChips ? presets.length : CHIP_MAX).map(it => (
              <button key={it.key} className="chip" type="button" data-tip={it.w + ' Вт'} onClick={() => addFrom(it.name, it.w)}>
                + {it.name}
              </button>
            ))}
            {presets.length > CHIP_MAX && (
              <button className="chip more" type="button" aria-expanded={allChips} onClick={() => setAllChips(!allChips)}>{allChips ? 'Свернуть' : 'Ещё ' + (presets.length - CHIP_MAX)}</button>
            )}
          </div>
          <div className="ed-more" ref={menuRef}>
            <button className="link ed-more-b" ref={mkTriggerRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Ещё действия<IconDown /></button>
            {menuOpen && (
              <div className="ed-menu" role="menu" aria-label="Действия с группой" ref={el => { mkListRef.current = el; }} onKeyDown={mkKeyDown}>
                <button type="button" role="menuitem" onClick={() => { mkBack(); setQuick(quick === null ? '' : null); setQuickMsg(''); }}>{quick === null ? 'Вставить список текстом' : 'Скрыть вставку списком'}</button>
                {(brOn || !showBr) && <button type="button" role="menuitem" onClick={() => { mkBack(); setBrOn(!brOn); }}>{brOn ? 'Скрыть отводы к точкам' : 'Указать отводы к точкам'}</button>}
                {prevPeer >= 0 && <button type="button" role="menuitem" onClick={() => { mkBack(); dispatch({ t: 'moveLine', id: l.id, to: a.rows[prevPeer].l.id }); toastOk('Группа перемещена на место Г' + (prevPeer + 1)); }}>Переставить раньше, на место Г{prevPeer + 1}</button>}
                {nextPeer >= 0 && <button type="button" role="menuitem" onClick={() => { mkBack(); dispatch({ t: 'moveLine', id: l.id, to: a.rows[nextPeer].l.id }); toastOk('Группа перемещена на место Г' + (nextPeer + 1)); }}>Переставить позже, на место Г{nextPeer + 1}</button>}
              </div>
            )}
          </div>
          {quick !== null && (
            <div className="quick">
              <textarea aria-label="Список приборов" rows={3} placeholder="чайник 2200, духовка 2,5 кВт, лампы 60 x5" value={quick} onChange={e => setQuick(e.target.value)} />
              <div className="copy-row">
                <button className="btn primary" type="button" onClick={() => {
                  const r = parseApps(quick);
                  if (r.apps.length) dispatch({ t: 'addApps', apps: r.apps });
                  setQuickMsg((r.apps.length ? 'Добавлено: ' + r.apps.length : 'Ничего не добавлено') + (r.skipped.length ? '. Не разобрано: ' + r.skipped.join('; ') : ''));
                  if (r.apps.length) setQuick(r.skipped.join('\n'));
                }}>Добавить</button>
                <span role="status" className="muted">{quickMsg}</span>
              </div>
            </div>
          )}
        </div>
        {a.c.rcdMode && (
          <label className="blk">
            <span className="lbl">Помещение (группы помещения идут на одно УЗО)</span>
            <input className="ed-zone" list={'zones-' + l.id} aria-label="Помещение для УЗО" placeholder="Например, кухня" maxLength={60} value={l.zone ?? ''} onChange={e => dispatch({ t: 'lineField', field: 'zone', value: e.target.value })} />
            <datalist id={'zones-' + l.id}>
              {zones.map(z => <option key={z} value={z} />)}
            </datalist>
          </label>
        )}
        <div className="blk">
          <span className="lbl">Тип группы</span>
          <Seg<LineType> name={'t-' + l.id} value={l.type} items={TYPE_KEYS.map(k => [k, TYPES[k].short])} onChange={v => dispatch({ t: 'lineType', type: v })} />
        </div>
        <div className="grid3 ed-core">
          <div className="f len-f">
            <span className="lbl">Длина до распредкоробки</span>
            <Stepper
              value={l.len}
              onChange={v => dispatch({ t: 'lineField', field: 'len', value: v })}
              onStep={d => setLen(pn(l.len, 0) + d)}
              d={1}
              min={0}
              max={500}
              step="any"
              label="Длина линии, м"
              less="Короче"
              more="Длиннее"
            />
          </div>
          <p className="muted len-note">{hasBr && r ? 'До дальней точки ' + fmt(r.len, 0) + ' м, кабеля всего ' + fmt(r.cable, 0) + ' м.' : 'Если коробки нет, это вся длина линии.'}</p>
          {three && (
            <div className="f ph-f">
              <span className="lbl">Фаза</span>
              <Seg<Phase> name={'p-' + l.id} value={l.phase} items={phItems} onChange={v => dispatch({ t: 'linePhase', phase: v })} />
            </div>
          )}
        </div>
        <div className="blk fold-in">
          <button className="why-t" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
            <span>Дополнительно</span>
            <small className="muted">{moreSum}</small>
            <IconDown />
          </button>
          <div className="fold-in-b" hidden={!moreOpen}>
            {!a.c.rcdMode && (
              <label className="blk">
                <span className="lbl">Помещение</span>
                <input className="ed-zone" list={'zones-' + l.id} aria-label="Помещение группы" placeholder="Например, кухня" maxLength={60} value={l.zone ?? ''} onChange={e => dispatch({ t: 'lineField', field: 'zone', value: e.target.value })} />
                <datalist id={'zones-' + l.id}>
                  {zones.map(z => <option key={z} value={z} />)}
                </datalist>
              </label>
            )}
            <label className="blk">
              <span className="lbl">Где находится</span>
              <input className="ed-where" aria-label="Где находится группа" placeholder="Например, кухня и коридор" maxLength={80} value={l.where ?? ''} onChange={e => dispatch({ t: 'lineField', field: 'where', value: e.target.value })} />
            </label>
            {l.type !== 'light' && (
              <div className="blk">
                <span className="lbl">Условия</span>
                <Seg<string> name={'w-' + l.id} value={l.wet ? 'wet' : 'dry'} items={[['dry', 'Обычные'], ['wet', 'Вне помещения или особо опасные']]} onChange={v => dispatch({ t: 'lineWet', wet: v === 'wet' })} />
              </div>
            )}
          </div>
        </div>
        <div className="blk meas fold-in">
          <button className="why-t" type="button" aria-expanded={measOpen} onClick={() => setMeasOpen(!measOpen)}>
            <span>Замеры и фото</span>
            <small className="muted">{measSum}</small>
            <IconDown />
          </button>
          <div className="fold-in-b" hidden={!measOpen}>
            <div className="grid3">
              <label className="f">
                <span className="lbl">Петля фаза-нуль, Ом</span>
                <input type="text" inputMode="decimal" min={0} step={0.01} aria-label="Замер петли фаза-нуль, Ом" value={String(l.meas?.zs ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'zs', value: e.target.value })} />
              </label>
              <label className="f">
                <span className="lbl">Изоляция, МОм</span>
                <input type="text" inputMode="decimal" min={0} step={0.1} aria-label="Замер сопротивления изоляции, МОм" value={String(l.meas?.ins ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'ins', value: e.target.value })} />
              </label>
              <label className="f">
                <span className="lbl">Ток утечки, мА</span>
                <input type="text" inputMode="decimal" min={0} step={0.1} aria-label="Замер тока утечки, мА" value={String(l.meas?.leak ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'leak', value: e.target.value })} />
              </label>
              {r?.rcd && (
                <label className="f">
                  <span className="lbl">УЗО при IΔn, мс</span>
                  <input type="text" inputMode="numeric" min={0} step={1} aria-label="Замер времени отключения УЗО, мс" placeholder={'до ' + fmt(r.rcdLim, 0)} value={String(l.meas?.rcd ?? '')} onChange={e => dispatch({ t: 'lineMeas', field: 'rcd', value: e.target.value })} />
                </label>
              )}
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
          </div>
        </div>
        <div className="ed-end">
          <button className="btn" type="button" onClick={() => { dispatch({ t: 'dupLine' }); toastOk('Создана копия группы'); }}>Копировать группу</button>
          <ArmButton className="btn danger" label="Удалить группу" armedLabel="Нажмите ещё раз, чтобы удалить" onRun={() => { dispatch({ t: 'delLine' }); onDeleted(); toastOk('Группа удалена'); }} />
        </div>
      </div>
    </section>
  );
}
