import { useEffect, useRef, useState } from 'react';
import type { LineType } from '../core/types';
import { TYPES } from '../core/norms';

export function AddMenu({ onAdd, onRooms, fab, down }: { onAdd: (t: LineType) => void; onRooms: () => void; fab?: boolean; down?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const pick = (t: LineType) => {
    setOpen(false);
    onAdd(t);
  };
  const types: [LineType, string][] = [
    ['light', TYPES.light.label],
    ['socket', TYPES.socket.label],
    ['power', TYPES.power.label]
  ];
  return (
    <div className={'addmenu' + (fab ? ' fab' : '') + (down ? ' down' : '')} ref={ref}>
      {open && (
        <ul className="am-list" role="menu" aria-label="Тип новой группы">
          {types.map(([t, label]) => (
            <li key={t} role="none">
              <button type="button" role="menuitem" onClick={() => pick(t)}>{label}</button>
            </li>
          ))}
          <li role="none">
            <button type="button" role="menuitem" className="am-rooms" onClick={() => { setOpen(false); onRooms(); }}>Из комнат</button>
          </li>
        </ul>
      )}
      {fab ? (
        <button className="fab-b" type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Добавить группу" onClick={() => setOpen(v => !v)}>+</button>
      ) : (
        <button className="btn primary add-b" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>+ Добавить группу</button>
      )}
    </div>
  );
}
