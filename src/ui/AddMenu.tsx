import { useEffect, useRef, useState } from 'react';
import type { LineType } from '../core/types';
import { TYPES } from '../core/norms';
import { IconBolt, IconBulb, IconRooms, IconSocket } from './Icons';
import { useMenuKeys } from './menu';

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
  const keys = useMenuKeys(open, () => setOpen(false));
  const [hide, setHide] = useState(false);
  useEffect(() => {
    if (!fab) return;
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHide(y > last && y > 80);
      last = y;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [fab]);
  const pick = (t: LineType) => {
    keys.back();
    onAdd(t);
  };
  const types: [LineType, string, string, JSX.Element][] = [
    ['light', TYPES.light.label, 'Светильники, LED-лента · B10, 1,5 мм²', <IconBulb key="i" />],
    ['socket', TYPES.socket.label, 'Розетки помещения · C16, 2,5 мм²', <IconSocket key="i" />],
    ['power', TYPES.power.label, 'Плита, бойлер, стиральная машина', <IconBolt key="i" />]
  ];
  return (
    <div className={'addmenu' + (fab ? ' fab' : '') + (down ? ' down' : '') + (hide && !open ? ' hide' : '')} ref={ref}>
      {open && (
        <ul className="am-list" role="menu" aria-label="Тип новой группы" ref={el => { keys.list.current = el; }} onKeyDown={keys.onKeyDown}>
          {types.map(([t, label, hint, icon]) => (
            <li key={t} role="none">
              <button type="button" role="menuitem" className={'am-' + t} aria-label={label} onClick={() => pick(t)}>
                <span className="am-ic">{icon}</span>
                <span className="am-tx">{label}<small>{hint}</small></span>
              </button>
            </li>
          ))}
          <li role="none">
            <button type="button" role="menuitem" className="am-rooms" aria-label="Из комнат" onClick={() => { keys.back(); onRooms(); }}>
              <span className="am-ic"><IconRooms /></span>
              <span className="am-tx">Из комнат<small>Отметьте помещения, группы соберутся сами</small></span>
            </button>
          </li>
        </ul>
      )}
      {fab ? (
        <button className="fab-b" ref={keys.trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Добавить группу" onClick={() => setOpen(v => !v)}>+</button>
      ) : (
        <button className="btn primary add-b" ref={keys.trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>+ Добавить группу</button>
      )}
    </div>
  );
}
