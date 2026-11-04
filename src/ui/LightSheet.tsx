import { useState } from 'react';
import type { Project } from '../core/types';
import { FIXTURES, KIND_KEYS, KZ, LIGHT_KINDS, LUX_REF, OWN_FX, lightCalc } from '../core/light';
import type { LightKind, LightRoom } from '../core/light';
import { fmt, plural } from '../core/format';
import type { HAction } from '../store/history';
import { ArmButton, Sheet, Tip } from './common';
import { toastUndo } from './toast';

const ADD: [LightKind, string][] = [['living', 'Гостиная'], ['bed', 'Спальня'], ['kitchen', 'Кухня'], ['kids', 'Детская'], ['study', 'Кабинет'], ['hall', 'Прихожая'], ['bath', 'Ванная'], ['store', 'Кладовая']];

function RoomCard({ r, p, dispatch }: { r: LightRoom; p: Project; dispatch: (a: HAction) => void }) {
  const res = lightCalc(r);
  const lights = p.lines.map((l, i) => ({ l, i })).filter(x => x.l.type === 'light');
  const zoneMatch = lights.find(x => (x.l.zone ?? '').trim().toLowerCase() === r.name.trim().toLowerCase());
  const [target, setTarget] = useState<string>('');
  const to = target && (target === 'new' || lights.some(x => x.l.id === target)) ? target : zoneMatch ? zoneMatch.l.id : lights.length ? lights[0].l.id : 'new';
  const set = (field: Exclude<keyof LightRoom, 'id'>) => (value: string) => dispatch({ t: 'lightSet', id: r.id, field, value });
  const def = LIGHT_KINDS[r.kind];
  const apply = () => {
    const idx = lights.findIndex(x => x.l.id === to);
    dispatch({ t: 'lightApply', id: r.id, line: to });
    toastUndo((to === 'new' ? 'Создана группа освещения' : 'Записано в Г' + (lights[idx].i + 1)) + ': ' + res.n + ' × ' + res.fxName, () => dispatch({ t: 'undo' }));
  };
  return (
    <section className="card lt-room" aria-label={'Помещение ' + r.name}>
      <div className="card-head">
        <input className="ed-name" aria-label="Название помещения" value={r.name} onChange={e => set('name')(e.target.value)} />
        <ArmButton className="btn danger sm" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'lightDel', id: r.id })} />
      </div>
      <div className="lt-grid">
        <label className="f lt-kind">
          <span className="lbl">Назначение</span>
          <select value={r.kind} onChange={e => set('kind')(e.target.value)}>
            {KIND_KEYS.map(k => <option key={k} value={k}>{LIGHT_KINDS[k].label}, {LIGHT_KINDS[k].lux} лк</option>)}
          </select>
        </label>
        <label className="f"><span className="lbl">Длина, м</span><input type="number" inputMode="decimal" min={0} step={0.1} placeholder="4" value={String(r.a)} onChange={e => set('a')(e.target.value)} /></label>
        <label className="f"><span className="lbl">Ширина, м</span><input type="number" inputMode="decimal" min={0} step={0.1} placeholder="3" value={String(r.b)} onChange={e => set('b')(e.target.value)} /></label>
        <label className="f"><span className="lbl">Высота, м</span><input type="number" inputMode="decimal" min={0} step={0.1} value={String(r.h)} onChange={e => set('h')(e.target.value)} /></label>
        <label className="f lt-fx">
          <span className="lbl">Светильник</span>
          <select value={r.fx} onChange={e => set('fx')(e.target.value)}>
            {FIXTURES.map(f => <option key={f.id} value={f.id}>{f.name}, {f.lm} лм</option>)}
            <option value={OWN_FX}>Свой светильник</option>
          </select>
        </label>
        <label className="f"><span className="lbl">Мощность, Вт</span><input type="number" inputMode="decimal" min={0} value={String(r.w)} onChange={e => set('w')(e.target.value)} /></label>
        <label className="f"><span className="lbl">Световой поток, лм</span><input type="number" inputMode="numeric" min={0} value={String(r.lm)} onChange={e => set('lm')(e.target.value)} /></label>
      </div>
      {res.ok ? (
        <div className="lt-res" aria-live="polite">
          <div className="lt-n"><b className="mono">{res.n}</b><span>{plural(res.n, ['светильник', 'светильника', 'светильников'])}</span></div>
          <dl className="lt-kv">
            <div><dt>Освещённость</dt><dd className="mono">≈ {fmt(res.lux, 0)} лк</dd></div>
            <div><dt>Норма</dt><dd className="mono">{res.need} лк{def.practice ? <span className="ow-pr">практика</span> : null}</dd></div>
            <div><dt>Мощность</dt><dd className="mono">{fmt(res.watts, 0)} Вт · {fmt(res.density, 1)} Вт/м²</dd></div>
            <div><dt>Площадь</dt><dd className="mono">{fmt(res.area, 1)} м²</dd></div>
          </dl>
          {r.kind === 'bath' && <p className="muted lt-tip">Для ванной берите светильники со степенью защиты не ниже IP44.</p>}
          <div className="lt-apply">
            <label className="f">
              <span className="lbl">Записать в группу</span>
              <select value={to} onChange={e => setTarget(e.target.value)}>
                {lights.map(x => <option key={x.l.id} value={x.l.id}>Г{x.i + 1} {x.l.name || 'Без названия'}</option>)}
                <option value="new">Новая группа освещения</option>
              </select>
            </label>
            <button className="btn primary" type="button" onClick={apply}>Записать</button>
          </div>
        </div>
      ) : (
        <p className="muted lt-wait">Введите длину, ширину и высоту помещения, число светильников появится сразу.</p>
      )}
    </section>
  );
}

export function LightSheet({ open, onClose, p, dispatch }: { open: boolean; onClose: () => void; p: Project; dispatch: (a: HAction) => void }) {
  const rooms = p.light ?? [];
  const total = rooms.reduce((s, r) => s + lightCalc(r).watts, 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Освещение"
      tip={<>Сколько светильников нужно в помещение, чтобы получить нормируемую освещённость. Нормы для квартир рекомендуемые: {LUX_REF}. Расчёт методом коэффициента использования: N = E · S · Kз / (Φ · η), Kз = {fmt(KZ, 2)}, η по индексу помещения для светлой отделки, это практика.</>}
    >
      <div className="chips room-add" aria-label="Добавить помещение">
        {ADD.map(([k, label]) => (
          <button key={k} className="chip" type="button" onClick={() => dispatch({ t: 'lightAdd', kind: k })}>+ {label}</button>
        ))}
      </div>
      {rooms.length === 0 && <div className="empty">Добавьте помещение кнопкой выше и введите его размеры.</div>}
      {rooms.map(r => <RoomCard key={r.id} r={r} p={p} dispatch={dispatch} />)}
      {rooms.length > 1 && total > 0 && (
        <p className="muted lt-sum">Всего на освещение по расчёту: <b className="mono">{fmt(total, 0)} Вт</b><Tip>Сумма по всем помещениям этого окна. В нагрузку групп попадает только то, что вы записали в группы.</Tip></p>
      )}
    </Sheet>
  );
}
