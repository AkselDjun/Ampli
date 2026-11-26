import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useMenuKeys } from './menu';
import { IconDone } from './Icons';

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  mark?: string;
  current?: boolean;
  run: () => void;
}

export interface MenuGroup {
  id: string;
  title?: string;
  items: MenuItem[];
}

export function MenuButton({ label, trigger, className, box, menuClass, groups, up, end, tour, tip }: {
  label: string;
  trigger: ReactNode;
  className: string;
  box?: string;
  menuClass?: string;
  groups: MenuGroup[];
  up?: boolean;
  end?: boolean;
  tour?: string;
  tip?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const { listRef, triggerRef, onKeyDown, back } = useMenuKeys(open, () => setOpen(false));
  const pick = (run: () => void) => {
    back();
    run();
  };
  const shown = groups.filter(g => g.items.length);
  return (
    <div className={'dd' + (box ? ' ' + box : '') + (up ? ' up' : '') + (end ? ' end' : '') + (open ? ' open' : '')} ref={ref}>
      <button
        type="button"
        className={className}
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        data-tour={tour}
        data-tip={open ? undefined : tip}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <ul id={id} className={'dd-pop' + (menuClass ? ' ' + menuClass : '')} role="menu" aria-label={label} ref={el => { listRef.current = el; }} onKeyDown={onKeyDown}>
          {shown.map((g, gi) => (
            <li key={g.id} role="none" className={'dd-g' + (gi && !g.title ? ' sep' : '')}>
              {g.title && <span className="dd-h" aria-hidden="true">{g.title}</span>}
              <ul role="group" aria-label={g.title}>
                {g.items.map(it => (
                  <li key={it.id} role="none">
                    <button type="button" role="menuitem" className="dd-i" aria-current={it.current ? 'true' : undefined} onClick={() => pick(it.run)}>
                      {it.mark !== undefined ? <span className="dd-mark" aria-hidden="true">{it.mark}</span> : it.icon && <span className="dd-ic" aria-hidden="true">{it.icon}</span>}
                      <span className="dd-tx">
                        <span className="dd-l">{it.label}</span>
                        {it.hint && <small>{it.hint}</small>}
                      </span>
                      {it.current && <IconDone className="dd-cur" />}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
