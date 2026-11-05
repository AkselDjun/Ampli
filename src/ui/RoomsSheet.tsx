import { useMemo } from 'react';
import type { Project, RoomApp } from '../core/types';
import { PRESETS } from '../core/norms';
import { ROOM_PRESETS, assemble, makeRoom } from '../core/rooms';
import { nid } from '../core/ids';
import { plural } from '../core/format';
import type { Action } from '../store/reducer';
import { toastOk } from './toast';
import { ArmButton, Sheet } from './common';
import { Button, IconButton } from './kit';

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
  return (
    <Sheet open={open} onClose={onClose} title="Комнаты" tip="Опишите комнаты и приборы, группы соберутся сами: свет и розетки по комнатам, мощные приборы отдельными линиями. Потом группы можно поправить вручную.">
      <div className="chips room-add">
        {ROOM_PRESETS.map(r => (
          <button key={r.key} className="chip" type="button" onClick={() => dispatch({ t: 'roomAdd', room: makeRoom(r) })}>+ {r.title}</button>
        ))}
      </div>
      {rooms.length === 0 && <div className="empty">Комнат пока нет. Добавьте первую кнопкой выше.</div>}
      {rooms.map(r => (
        <section className="card room" key={r.id}>
          <div className="card-head">
            <input className="ed-name" aria-label="Название комнаты" value={r.name} onChange={e => dispatch({ t: 'roomName', id: r.id, value: e.target.value })} />
            <ArmButton variant="danger" size="sm" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'roomDel', id: r.id })} />
          </div>
          {r.apps.map(ap => (
            <div className="room-app" key={ap.id}>
              <input aria-label="Название прибора" placeholder="Прибор" value={ap.name} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'name', value: e.target.value })} />
              <span className="fld" data-sfx="Вт"><input aria-label="Мощность, Вт" type="text" inputMode="numeric" min={0} placeholder="0" value={String(ap.w)} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'w', value: e.target.value })} /></span>
              <span className="fld" data-sfx="шт"><input aria-label="Количество" type="text" inputMode="numeric" min={1} value={String(ap.n)} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'n', value: e.target.value })} /></span>
              <select aria-label="Тип нагрузки" value={ap.tag} onChange={e => dispatch({ t: 'roomAppField', rid: r.id, aid: ap.id, field: 'tag', value: e.target.value })}>
                <option value="l">Свет</option>
                <option value="s">Розетка</option>
                <option value="p">Мощный</option>
              </select>
              <IconButton label="Удалить прибор" onClick={() => dispatch({ t: 'roomAppDel', rid: r.id, aid: ap.id })}>×</IconButton>
            </div>
          ))}
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
