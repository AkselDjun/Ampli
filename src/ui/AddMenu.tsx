import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LineType } from '../core/types';
import { TYPES } from '../core/norms';
import { IconBolt, IconBulb, IconHeat, IconLan, IconRooms, IconSocket } from './Icons';
import { useScrollHide } from './useScrollHide';
import { useMenuKeys } from './menu';
import { Button } from './kit';

export function AddMenu({ onAdd, onRooms, onFloor, onWeak, fab, down }: { onAdd: (t: LineType) => void; onRooms: () => void; onFloor?: () => void; onWeak?: () => void; fab?: boolean; down?: boolean }) {
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
  const { listRef, triggerRef, onKeyDown, back } = useMenuKeys(open, () => setOpen(false));
  const hide = useScrollHide(!!fab);
  const pick = (t: LineType) => {
    back();
    onAdd(t);
  };
  const extra: [string, string, JSX.Element, () => void][] = [
    ...(onFloor ? [['floor', 'Тёплый пол', <IconHeat key="i" />, onFloor] as [string, string, JSX.Element, () => void]] : []),
    ...(onWeak ? [['weak', 'Слаботочка', <IconLan key="i" />, onWeak] as [string, string, JSX.Element, () => void]] : [])
  ];
  const types: [LineType, string, string, JSX.Element][] = [
    ['light', TYPES.light.label, 'Светильники, LED-лента · B10, 1,5 мм²', <IconBulb key="i" />],
    ['socket', TYPES.socket.label, 'Розетки помещения · C16, 2,5 мм²', <IconSocket key="i" />],
    ['power', TYPES.power.label, 'Плита, бойлер, стиральная машина', <IconBolt key="i" />]
  ];
  return (
    <div className={'addmenu' + (fab ? ' fab' : '') + (down ? ' down' : '') + (hide && !open ? ' hide' : '')} ref={ref} data-tour="add">
      {open && (
        <ul className="am-list" role="menu" aria-label="Добавить в проект" ref={el => { listRef.current = el; }} onKeyDown={onKeyDown}>
          {types.map(([t, label, hint, icon]) => (
            <li key={t} role="none">
              <button type="button" role="menuitem" className={'am-' + t} aria-label={label} onClick={() => pick(t)}>
                <span className="am-ic">{icon}</span>
                <span className="am-tx">{label}<small>{hint}</small></span>
              </button>
            </li>
          ))}
          <li role="none">
            <button type="button" role="menuitem" className="am-rooms" aria-label="Из комнат" onClick={() => { back(); onRooms(); }}>
              <span className="am-ic"><IconRooms /></span>
              <span className="am-tx">Из комнат<small>Отметьте помещения, группы соберутся сами</small></span>
            </button>
          </li>
          {extra.length > 0 && <li role="separator" className="am-sep" />}
          {extra.length > 0 && (
            <li role="none" className="am-pair">
              {extra.map(([k, label, icon, run]) => (
                <button key={k} type="button" role="menuitem" className={'am-' + k} aria-label={label} onClick={() => { back(); run(); }}>
                  <span className="am-ic">{icon}</span>
                  <span className="am-tx">{label}</span>
                </button>
              ))}
            </li>
          )}
        </ul>
      )}
      {fab ? (
        <button className="fab-b" ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Добавить группу" onClick={() => setOpen(v => !v)}>+</button>
      ) : (
        <Button variant="primary" className="add-b" ref={triggerRef} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>+ Добавить группу</Button>
      )}
    </div>
  );
}
