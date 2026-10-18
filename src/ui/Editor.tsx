import { useRef } from 'react';
import type { Calc, Line, LineType, Phase } from '../core/types';
import { NB, fmt, fs, pn, round2 } from '../core/format';
import { PRESETS, STATUS, TYPES, TYPE_KEYS } from '../core/norms';
import { whyRows } from '../core/why';
import type { Action } from '../store/reducer';
import { IconDown } from './Icons';
import { ArmButton, Seg, Stepper } from './common';

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
  l, idx, a, dispatch, whyOpen, setWhyOpen, onDeleted
}: {
  l: Line | null;
  idx: number;
  a: Calc;
  dispatch: (x: Action) => void;
  whyOpen: boolean;
  setWhyOpen: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const chips = useRef<HTMLDivElement>(null);
  const focusNew = useRef(false);
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
                <button className="icon-btn a-del" type="button" aria-label="Удалить прибор" onClick={() => keepChips(() => dispatch({ t: 'delApp', id: ap.id }))}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="blk">
          <span className="lbl">Добавить прибор</span>
          <div className="chips" ref={chips}>
            {PRESETS.filter(p => p[2].indexOf(tag) >= 0).map(p => (
              <button key={p[0]} className="chip" type="button" title={p[1] + ' Вт'} onClick={() => keepChips(() => dispatch({ t: 'addApp', name: p[0], w: p[1] }))}>
                + {p[0]}
              </button>
            ))}
            <button className="chip custom" type="button" onClick={() => keepChips(() => { focusNew.current = true; dispatch({ t: 'addApp' }); })}>+ Свой прибор</button>
          </div>
        </div>
        <div className="blk">
          <ArmButton className="btn danger" label="Удалить группу" armedLabel="Нажмите ещё раз, чтобы удалить" onRun={() => { dispatch({ t: 'delLine' }); onDeleted(); }} />
        </div>
      </div>
    </section>
  );
}
