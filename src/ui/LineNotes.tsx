import { useState } from 'react';
import type { Note } from '../core/notes';
import { NOTE_MAX, NOTES_MAX, openNotes } from '../core/notes';
import { plural } from '../core/format';
import { whenLabel } from '../core/recent';
import { IconDown, IconTrash } from './Icons';
import { Button } from './kit';
import '../styles/notes.css';

export function LineNotes({ notes, now, onAdd, onToggle, onDel }: {
  notes: readonly Note[];
  now: number;
  onAdd: (t: string) => void;
  onToggle: (id: string) => void;
  onDel: (id: string) => void;
}) {
  const [open, setOpen] = useState(notes.length > 0);
  const [text, setText] = useState('');
  const left = openNotes(notes);
  const full = notes.length >= NOTES_MAX;
  const add = () => {
    if (!text.trim() || full) return;
    onAdd(text);
    setText('');
  };
  return (
    <div className="blk fold-in gn">
      <button className="why-t" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>Заметки</span>
        <small className="muted">{notes.length ? (left ? left + ' ' + plural(left, ['открыта', 'открыты', 'открыто']) : 'все отмечены') : 'для себя, заказчик их не увидит'}</small>
        <IconDown />
      </button>
      <div className="fold-in-b" hidden={!open}>
        {notes.length > 0 && (
          <ul className="gn-list">
            {notes.map(n => (
              <li key={n.id} className={n.done ? 'done' : undefined}>
                <label className="gn-t">
                  <input type="checkbox" checked={!!n.done} onChange={() => onToggle(n.id)} />
                  <span>{n.t}</span>
                </label>
                <small className="muted">{n.at ? whenLabel(n.at, now) : ''}</small>
                <button type="button" className="gn-del" aria-label={'Удалить заметку «' + n.t.slice(0, 40) + '»'} onClick={() => onDel(n.id)}><IconTrash /></button>
              </li>
            ))}
          </ul>
        )}
        <form className="gn-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input type="text" aria-label="Новая заметка" placeholder={full ? 'Заметок уже ' + NOTES_MAX + ', удалите лишние' : 'Например, перенести розетку к окну'} maxLength={NOTE_MAX} value={text} disabled={full} onChange={e => setText(e.target.value)} />
          <Button type="submit" disabled={full || !text.trim()}>Добавить</Button>
        </form>
      </div>
    </div>
  );
}
