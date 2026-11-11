import { Suspense, useMemo, useState } from 'react';
import type { Project, RoomApp } from '../core/types';
import { PRESETS } from '../core/norms';
import { ROOM_PRESETS, assemble, makeRoom } from '../core/rooms';
import { nid } from '../core/ids';
import { plural } from '../core/format';
import type { Action } from '../store/reducer';
import { toastOk } from './toast';
import { ArmButton, Err, Sheet, errAttrs } from './common';
import { asLabel, fieldErr } from '../core/limits';
import { Button, IconButton } from './kit';
import { Mic } from './parts';
import { parseRooms } from '../core/roomtext';

export function RoomsSheet({
  open, onClose, p, dispatch
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  dispatch: (a: Action) => void;
}) {
  const rooms = p.rooms ?? [];
  const planned = useMemo(() => assemble(p.rooms ?? []).length, [p.rooms]);
  const addApp = (rid: string, app: RoomApp) => dispatch({ t: 'roomAppAdd', rid, app });
  const [text, setText] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const fromText = () => {
    const r = parseRooms(text ?? '');
    r.rooms.forEach(room => dispatch({ t: 'roomAdd', room }));
    const apps = r.rooms.reduce((s, x) => s + x.apps.length, 0);
    setMsg((r.rooms.length ? 'Добавлено: ' + r.rooms.length + ' ' + plural(r.rooms.length, ['комната', 'комнаты', 'комнат']) + ', ' + apps + ' ' + plural(apps, ['прибор', 'прибора', 'приборов']) : 'Ничего не добавлено') + (r.skipped.length ? '. Не разобрано: ' + r.skipped.join('; ') : ''));
    if (r.rooms.length) setText(r.skipped.join('\n'));
  };
  return (
    <Sheet open={open} onClose={onClose} title="Комнаты" tourId="rooms" tip="Опишите комнаты и приборы, группы соберутся сами: свет и розетки по комнатам, мощные приборы отдельными линиями. Потом группы можно поправить вручную.">
      <div className="chips room-add">
        {ROOM_PRESETS.map(r => (
          <button key={r.key} className="chip" type="button" onClick={() => dispatch({ t: 'roomAdd', room: makeRoom(r) })}>+ {r.title}</button>
        ))}
      </div>
      <div className="room-text">
        <Button size="sm" variant="ghost" aria-expanded={text !== null} onClick={() => { setText(text === null ? '' : null); setMsg(''); }}>{text === null ? 'Из сообщения клиента или голосом' : 'Скрыть ввод текстом'}</Button>
        {text !== null && (
          <div className="quick">
            <textarea aria-label="Комнаты и приборы текстом" rows={4} placeholder={'Кухня: плита 7 кВт, духовка 3,5 кВт, посудомойка\nВанная: бойлер 2 кВт, стиральная машина'} value={text} onChange={e => setText(e.target.value)} />
            <div className="copy-row">
              <Button variant="primary" onClick={fromText}>Добавить комнаты</Button>
              <Suspense fallback={null}><Mic rooms label="Диктовать комнаты и приборы" onText={t => setText(q => (q && q.trim() ? q.replace(/\s*$/, '') + '\n' : '') + t)} /></Suspense>
              <span role="status" className="muted">{msg}</span>
            </div>
          </div>
        )}
      </div>
      {rooms.length === 0 && <div className="empty">Комнат пока нет. Добавьте первую кнопкой выше.</div>}
      {rooms.map(r => (
        <section className="card room" key={r.id}>
          <div className="card-head">
            <input className="ed-name" aria-label="Название комнаты" value={r.name} onChange={e => dispatch({ t: 'roomName', id: r.id, value: e.target.value })} />
            <ArmButton variant="danger" size="sm" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'roomDel', id: r.id })} />
          </div>
          {r.apps.map(ap => {
            const we = fieldErr('w', ap.w);
            const ne = fieldErr('n', ap.n);
            return (
              <div className="room-app" key={ap.id}>
                <input aria-label="Название прибора" placeholder="Прибор" value={ap.name} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'name', value: e.target.value })} />
                <span className="fld" data-sfx="Вт"><input aria-label="Мощность, Вт" type="text" inputMode="numeric" min={0} placeholder="0" {...errAttrs(we, 'e-rw-' + ap.id)} value={String(ap.w)} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'w', value: e.target.value })} /></span>
                <span className="fld" data-sfx="шт"><input aria-label="Количество" type="text" inputMode="numeric" min={1} {...errAttrs(ne, 'e-rn-' + ap.id)} value={String(ap.n)} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'n', value: e.target.value })} /></span>
                <select aria-label="Тип нагрузки" value={ap.tag} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'tag', value: e.target.value })}>
                  <option value="l">Свет</option>
                  <option value="s">Розетка</option>
                  <option value="p">Мощный</option>
                </select>
                <IconButton label="Удалить прибор" onClick={() => dispatch({ t: 'roomAppDel', rid: r.id, aid: ap.id })}>×</IconButton>
                <Err e={we && asLabel('Мощность', we)} id={'e-rw-' + ap.id} />
                <Err e={ne && asLabel('Количество', ne)} id={'e-rn-' + ap.id} />
              </div>
            );
          })}
          <div className="room-tools">
            <select aria-label={'Добавить прибор в комнату ' + r.name} value="" onChange={e => {
              const pr = PRESETS[Number(e.target.value)];
              if (pr) addApp(r.id, { id: nid(), name: pr[0], w: pr[1], n: 1, tag: (pr[2].includes('l') ? 'l' : (pr[2].includes('p') && !pr[2].includes('s') ? 'p' : 's')) });
            }}>
              <option value="">+ Прибор из списка</option>
              {PRESETS.map((pr, i) => <option key={pr[0]} value={i}>{pr[0]}, {pr[1]} Вт</option>)}
            </select>
            <Button onClick={() => addApp(r.id, { id: nid(), name: '', w: '', n: 1, tag: 's' })}>+ Свой прибор</Button>
          </div>
        </section>
      ))}
      <div className="copy-row">
        <ArmButton variant="primary" label={'Собрать группы: ' + planned + ' ' + plural(planned, ['группа', 'группы', 'групп'])} armedLabel="Заменить текущие группы?" disabled={planned === 0} onRun={() => { dispatch({ t: 'assemble' }); onClose(); toastOk('Собрано из комнат: ' + planned + ' ' + plural(planned, ['группа', 'группы', 'групп'])); }} />
      </div>
    </Sheet>
  );
}
