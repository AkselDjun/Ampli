import { useState } from 'react';
import type { Project } from '../core/types';
import { FLOOR_SYS, FLOOR_USES, SYS_KEYS, USE_KEYS, floorAppName, floorCalc } from '../core/floor';
import type { FloorRoom, FloorUse } from '../core/floor';
import { fmt } from '../core/format';
import type { Action } from '../store/reducer';
import { ArmButton, Err, Sheet, errAttrs } from './common';
import { fieldErr } from '../core/limits';
import { IconAlert, IconDone } from './Icons';
import { toastOk } from './toast';
import { Button } from './kit';

const ADD: [FloorUse, string][] = [['bath', 'Ванная'], ['kitchen', 'Кухня'], ['room', 'Комната'], ['loggia', 'Лоджия']];

function RoomCard({ r, p, dispatch }: { r: FloorRoom; p: Project; dispatch: (a: Action) => void }) {
  const res = floorCalc(r);
  const name = floorAppName(r);
  const lines = p.lines.map((l, i) => ({ l, i })).filter(x => x.l.type === 'power' || x.l.apps.some(a => a.name === name));
  const mine = lines.find(x => x.l.apps.some(a => a.name === name));
  const [target, setTarget] = useState('');
  const to = target && (target === 'new' || lines.some(x => x.l.id === target)) ? target : mine ? mine.l.id : 'new';
  const areaErr = fieldErr('area', r.area);
  const wpmErr = r.sys === 'mat' ? null : fieldErr('floorWpm', r.wpm);
  const set = (field: Exclude<keyof FloorRoom, 'id'>) => (value: string) => dispatch({ t: 'floorSet', id: r.id, field, value });
  const apply = () => {
    const x = lines.find(o => o.l.id === to);
    dispatch({ t: 'floorApply', id: r.id, line: to });
    toastOk((x ? 'Записано в Г' + (x.i + 1) : 'Создана группа тёплого пола') + ': ' + fmt(res.watts, 0) + ' Вт');
  };
  return (
    <section className="card fl-room" aria-label={'Тёплый пол: ' + r.name}>
      <div className="card-head">
        <input className="ed-name" aria-label="Название помещения" value={r.name} onChange={e => set('name')(e.target.value)} />
        <ArmButton variant="danger" size="sm" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'floorDel', id: r.id })} />
      </div>
      <div className="fl-grid">
        <label className="f">
          <span className="lbl">Помещение</span>
          <select value={r.use} onChange={e => set('use')(e.target.value)}>
            {USE_KEYS.map(k => <option key={k} value={k}>{FLOOR_USES[k].label}</option>)}
          </select>
        </label>
        <label className="f">
          <span className="lbl">Система</span>
          <select value={r.sys} onChange={e => set('sys')(e.target.value)}>
            {SYS_KEYS.map(k => <option key={k} value={k}>{FLOOR_SYS[k].label}</option>)}
          </select>
        </label>
        <label className="f">
          <span className="lbl">Свободная площадь, м²</span>
          <input type="text" inputMode="decimal" min={0} step={0.1} placeholder="3,5" {...errAttrs(areaErr, 'e-fa-' + r.id)} value={String(r.area)} onChange={e => set('area')(e.target.value)} />
          <Err e={areaErr} id={'e-fa-' + r.id} />
        </label>
        <label className="f">
          <span className="lbl">Мощность, Вт/м²</span>
          <input type="text" inputMode="numeric" min={0} step={10} {...errAttrs(wpmErr, 'e-fw-' + r.id)} value={String(r.wpm)} disabled={r.sys === 'mat'} onChange={e => set('wpm')(e.target.value)} />
          <Err e={wpmErr} id={'e-fw-' + r.id} />
        </label>
      </div>
      <p className="muted fl-hint">{FLOOR_SYS[r.sys].hint}. Площадь без мебели, ванны и сантехники.</p>
      {res.ok ? (
        <div className="fl-res" aria-live="polite">
          <div className="fl-prod"><b>{res.product}</b><span className="mono">{res.size}</span></div>
          <dl className="fl-kv">
            <div><dt>Мощность</dt><dd className="mono">{fmt(res.watts, 0)} Вт</dd></div>
            <div><dt>Ток</dt><dd className="mono">{fmt(res.amps, 1)} А</dd></div>
            <div><dt>На м²</dt><dd className="mono">{fmt(res.wpm, 0)} Вт</dd></div>
            {r.sys === 'cable' && <div><dt>Шаг укладки</dt><dd className="mono">{fmt(res.step, 1)} см</dd></div>}
          </dl>
          <ul className="ow-list">
            {res.notes.map((n, i) => (
              <li key={i} className={'ow-f k-' + n.k}>
                {n.k === 'ok' ? <IconDone className="ow-i" /> : <IconAlert className="ow-i" />}
                <div>
                  <p>{n.text}</p>
                  {n.ref && <small>{n.ref === 'практика' ? <span className="ow-pr">практика</span> : n.ref}</small>}
                </div>
              </li>
            ))}
          </ul>
          <div className="fl-apply">
            <label className="f">
              <span className="lbl">Записать в группу</span>
              <select value={to} onChange={e => setTarget(e.target.value)}>
                <option value="new">Новая группа тёплого пола</option>
                {lines.map(x => <option key={x.l.id} value={x.l.id}>Г{x.i + 1} {x.l.name || 'Без названия'}</option>)}
              </select>
            </label>
            <Button variant="primary" onClick={apply}>Записать</Button>
          </div>
        </div>
      ) : (
        <p className="muted fl-wait">{res.notes.length ? res.notes[0].text : 'Введите свободную площадь пола, мощность и изделие появятся сразу.'}</p>
      )}
    </section>
  );
}

export function FloorSheet({ open, onClose, p, dispatch }: { open: boolean; onClose: () => void; p: Project; dispatch: (a: Action) => void }) {
  const rooms = p.floor ?? [];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Тёплый пол"
      tip={<>Электрический тёплый пол по помещениям: мат, кабель или плёнка, мощность, терморегулятор и отдельная группа. Изделия попадают в спецификацию и смету. Удельная мощность по умолчанию из практики, её можно изменить для кабеля и плёнки.</>}
    >
      <div className="chips room-add" aria-label="Добавить помещение">
        {ADD.map(([k, label]) => (
          <button key={k} className="chip" type="button" onClick={() => dispatch({ t: 'floorAdd', use: k })}>+ {label}</button>
        ))}
      </div>
      {rooms.length === 0 && <div className="empty">Добавьте помещение кнопкой выше и введите свободную площадь пола.</div>}
      {rooms.map(r => <RoomCard key={r.id} r={r} p={p} dispatch={dispatch} />)}
    </Sheet>
  );
}
