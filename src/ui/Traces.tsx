import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Photo, Trace } from '../core/types';
import { TRACE_GRID, TRACE_MAX, TRACE_NOTE_MAX, addPoint, dropPoint } from '../core/traces';
import { Sheet } from './common';
import { Button } from './kit';
import { TraceNums, TraceOverlay } from './TraceOverlay';

export function TraceSheet({ photo, url, onSave, onClose }: { photo: Photo; url: string; onSave: (traces: Trace[]) => void; onClose: () => void }) {
  const [list, setList] = useState<Trace[]>(() => (photo.traces?.length ? photo.traces : [{ pts: [], note: '' }]));
  const [cur, setCur] = useState(() => (photo.traces?.length ?? 1) - 1);
  const [square, setSquare] = useState(true);
  const t = list[cur];
  const put = (i: number, next: Trace) => setList(l => l.map((x, k) => (k === i ? next : x)));
  const tap = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = (e.clientX - box.left) / box.width * TRACE_GRID;
    const y = (e.clientY - box.top) / box.height * TRACE_GRID;
    put(cur, addPoint(t, x, y, square));
  };
  const fresh = () => {
    if (list.length >= TRACE_MAX) return;
    setList(l => [...l, { pts: [], note: '' }]);
    setCur(list.length);
  };
  const remove = () => {
    const next = list.filter((_x, k) => k !== cur);
    setList(next.length ? next : [{ pts: [], note: '' }]);
    setCur(Math.max(0, Math.min(cur, next.length - 1)));
  };
  const done = () => {
    onSave(list.filter(x => x.pts.length >= 4));
    onClose();
  };
  const ready = list.filter(x => x.pts.length >= 4);
  return (
    <Sheet open onClose={onClose} title="Разметка трасс" tip="Нажимайте на фото по ходу кабеля: от коробки или щитка до розетки. С включёнными прямыми углами каждый отрезок идёт строго по горизонтали или вертикали, как кабель в штробе.">
      <div className="tr-wrap" onPointerDown={tap} role="img" aria-label={'Фото стены, трасс: ' + ready.length}>
        <img src={url} alt="" draggable={false} />
        <TraceOverlay traces={list} cur={cur} />
        <TraceNums traces={list.filter(x => x.pts.length >= 2)} />
      </div>
      <div className="tr-bar">
        <label className="tr-sq">
          <input type="checkbox" checked={square} onChange={e => setSquare(e.target.checked)} />
          <span>Прямые углы</span>
        </label>
        <Button size="sm" variant="ghost" disabled={t.pts.length === 0} onClick={() => put(cur, dropPoint(t))}>Убрать точку</Button>
        <Button size="sm" variant="ghost" disabled={list.length >= TRACE_MAX || t.pts.length < 4} onClick={fresh}>Новая трасса</Button>
        <Button size="sm" variant="ghost" disabled={list.length === 1 && t.pts.length === 0} onClick={remove}>Удалить трассу</Button>
      </div>
      <ol className="tr-list">
        {list.map((x, i) => (
          <li key={i} className={i === cur ? 'cur' : ''}>
            <button type="button" className="tr-pick" aria-pressed={i === cur} onClick={() => setCur(i)}>Трасса {i + 1}{x.pts.length < 4 ? ', нужно ещё ' + (x.pts.length ? '1 точка' : '2 точки') : ''}</button>
            <input type="text" maxLength={TRACE_NOTE_MAX} aria-label={'Привязка трассы ' + (i + 1)} placeholder="Например: 15 см от потолка, 40 см от угла" value={x.note} onChange={e => put(i, { ...x, note: e.target.value })} />
          </li>
        ))}
      </ol>
      <div className="tr-act">
        <Button variant="primary" onClick={done}>Сохранить</Button>
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
      </div>
    </Sheet>
  );
}
