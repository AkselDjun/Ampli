import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyEvent } from 'react';
import { IconSearch } from './Icons';

export interface Cmd {
  id: string;
  label: string;
  group: string;
  hint?: string;
  words?: string;
  run: () => void;
}

const norm = (t: string): string => t.toLowerCase().replace(/ё/g, 'е');

export function filterCmds(cmds: Cmd[], q: string): Cmd[] {
  const parts = norm(q).split(/\s+/).filter(Boolean);
  if (!parts.length) return cmds;
  return cmds.filter(c => {
    const hay = norm(c.label + ' ' + (c.words ?? '') + ' ' + (c.hint ?? ''));
    return parts.every(p => hay.includes(p));
  });
}

export function Palette({ open, onClose, cmds }: { open: boolean; onClose: () => void; cmds: Cmd[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [act, setAct] = useState(0);
  const list = useMemo(() => filterCmds(cmds, q), [cmds, q]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setAct(0);
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      input.current?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  useEffect(() => {
    document.getElementById('pal-o-' + act)?.scrollIntoView?.({ block: 'nearest' });
  }, [act]);
  const run = (c: Cmd) => {
    onClose();
    c.run();
  };
  const key = (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!list.length) return;
      setAct(i => (i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = list[Math.min(act, list.length - 1)];
      if (c) run(c);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  let last = '';
  return (
    <dialog ref={ref} className="pal" aria-labelledby="pal-t" onClose={onClose}>
      <h2 id="pal-t" className="sr">Быстрые действия</h2>
      <div className="pal-in">
        <IconSearch />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="pal-list"
          aria-autocomplete="list"
          aria-activedescendant={list.length ? 'pal-o-' + Math.min(act, list.length - 1) : undefined}
          aria-label="Найти действие или группу"
          placeholder="Действие или группа"
          autoFocus
          value={q}
          onChange={e => { setQ(e.target.value); setAct(0); }}
          onKeyDown={key}
        />
        <button type="button" className="pal-x" onClick={onClose}>Закрыть</button>
      </div>
      <ul id="pal-list" role="listbox" aria-label="Результаты" className="pal-list">
        {list.map((c, i) => {
          const head = c.group !== last ? c.group : '';
          last = c.group;
          return (
            <li key={c.id} role="presentation">
              {head && <div className="pal-g" role="presentation">{head}</div>}
              <div
                id={'pal-o-' + i}
                role="option"
                aria-selected={i === Math.min(act, list.length - 1)}
                className="pal-o"
                onMouseMove={() => setAct(i)}
                onClick={() => run(c)}
              >
                <span>{c.label}</span>
                {c.hint && <small>{c.hint}</small>}
              </div>
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="pal-empty">Ничего не нашлось. Попробуйте другое слово, например «смета» или «щиток».</p>}
    </dialog>
  );
}
