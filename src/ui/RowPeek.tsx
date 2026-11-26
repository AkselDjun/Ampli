import type { Row } from '../core/types';
import type { Note } from '../core/notes';
import { peekOf } from '../core/peek';
import { STATUS } from '../core/norms';

export function RowPeek({ x, no, top, left, since, notes }: {
  x: Row;
  no: number;
  top: number;
  left: number;
  since: string[];
  notes: readonly Note[];
}) {
  const pk = peekOf(x);
  const open = notes.filter(n => !n.done);
  return (
    <div className="peek" aria-hidden="true" style={{ top, left }}>
      <div className="peek-h">
        <span className="no" data-t={x.l.type}>Г{no}</span>
        <span className="peek-n">
          <b>{x.l.name || 'Без названия'}</b>
          <small>{(x.l.zone || 'Без помещения') + (x.r.empty ? '' : ' · ' + STATUS[x.r.status])}</small>
        </span>
      </div>
      <dl className="peek-f">
        {pk.facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {pk.apps.length > 0 && (
        <p className="peek-a">{pk.apps.join(', ') + (pk.more ? ' и ещё ' + pk.more : '')}</p>
      )}
      {since.length > 0 && <p className="peek-c">{'После сметы: ' + since.join('; ')}</p>}
      {open.length > 0 && <p className="peek-c">{'Заметка: ' + open[0].t + (open.length > 1 ? ' (ещё ' + (open.length - 1) + ')' : '')}</p>}
    </div>
  );
}
