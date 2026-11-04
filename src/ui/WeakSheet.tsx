import type { Project } from '../core/types';
import { UTP_MAX, WEAK_KEYS, WEAK_KINDS, weakCalc, weakSpec } from '../core/weak';
import type { WeakKind } from '../core/weak';
import { fmt, plural } from '../core/format';
import type { HAction } from '../store/history';
import { Sheet } from './common';
import { IconAlert, IconInfo } from './Icons';

export function WeakSheet({ open, onClose, p, dispatch }: { open: boolean; onClose: () => void; p: Project; dispatch: (a: HAction) => void }) {
  const w = p.weak;
  const pts = w?.pts ?? [];
  const c = w && pts.length ? weakCalc(w) : null;
  const spec = c ? weakSpec(c) : [];
  const zones = Array.from(new Set([...p.lines.map(l => (l.zone ?? '').trim()), ...(p.light ?? []).map(r => r.name.trim())].filter(Boolean)));
  const lastRoom = pts.length ? pts[pts.length - 1].room : '';
  return (
    <Sheet open={open} onClose={onClose} title="Слаботочка" tip={<>Интернет, телевидение, камеры и домофон: точки по помещениям, кабели, слаботочный щиток, коммутатор и делитель. Кабели, розетки и оборудование попадают в спецификацию и смету. Каждая точка тянется отдельной линией от слаботочного щитка, длина UTP до {UTP_MAX} м по ISO/IEC 11801.</>}>
      {c && (
        <div className="ow-head wk-head">
          <span className={'pill ' + (c.notes.some(n => n.k === 'bad') ? 'bad' : c.notes.some(n => n.k === 'warn') ? 'warn' : 'ok')}>{c.points} {plural(c.points, ['точка', 'точки', 'точек'])}</span>
          <span className="muted">{WEAK_KEYS.filter(k => c.count[k]).map(k => WEAK_KINDS[k].short + ' ' + c.count[k]).join(' · ')}{c.meters ? ' · ' + fmt(c.meters, 0) + ' м кабеля' : ''}</span>
        </div>
      )}
      <div className="chips room-add" aria-label="Добавить точку">
        {WEAK_KEYS.map(k => (
          <button key={k} className="chip" type="button" onClick={() => dispatch({ t: 'weakAdd', kind: k, room: lastRoom })}>+ {WEAK_KINDS[k].short}</button>
        ))}
      </div>
      {pts.length === 0 ? (
        <div className="empty">Добавьте точки кнопками выше: помещение, сколько розеток и длина от слаботочного щитка.</div>
      ) : (
        <div className="wk-list" role="list" aria-label="Слаботочные точки">
          <datalist id="wk-zones">{zones.map(z => <option key={z} value={z} />)}</datalist>
          <div className="wk-row wk-th" aria-hidden="true"><span>Помещение</span><span>Что</span><span>Шт.</span><span>Длина, м</span><span /></div>
          {pts.map(x => (
            <div className="wk-row" role="listitem" key={x.id}>
              <input aria-label="Помещение" list="wk-zones" placeholder="Помещение" value={x.room} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'room', value: e.target.value })} />
              <select aria-label="Что подключаем" value={x.kind} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'kind', value: e.target.value as WeakKind })}>
                {WEAK_KEYS.map(k => <option key={k} value={k}>{WEAK_KINDS[k].label}</option>)}
              </select>
              <input aria-label="Количество" type="number" inputMode="numeric" min={1} value={String(x.n)} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'n', value: e.target.value })} />
              <input aria-label="Длина от щитка, м" type="number" inputMode="decimal" min={0} placeholder="м" value={String(x.len)} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'len', value: e.target.value })} />
              <button className="icon-btn" type="button" aria-label="Удалить точку" onClick={() => dispatch({ t: 'weakDel', id: x.id })}>×</button>
            </div>
          ))}
        </div>
      )}
      <label className="wk-ont">
        <input type="checkbox" checked={w?.ont !== false} onChange={e => dispatch({ t: 'weakOnt', on: e.target.checked })} />
        <span>Оптический терминал провайдера в слаботочном щитке</span>
      </label>
      {c && (
        <>
          <h3 className="sec-t">Что понадобится</h3>
          <ul className="wk-spec">
            {spec.map(i => (
              <li key={i.name}><span>{i.name}</span><b className="mono">{i.qty}</b>{i.note && <small className="muted">{i.note}</small>}</li>
            ))}
          </ul>
          <h3 className="sec-t">Проверки и советы</h3>
          <ul className="ow-list">
            {c.notes.map((n, i) => (
              <li key={i} className={'ow-f k-' + n.k}>
                {n.k === 'tip' ? <IconInfo className="ow-i" /> : <IconAlert className="ow-i" />}
                <div>
                  <p>{n.text}</p>
                  {n.ref && <small>{n.ref === 'практика' ? <span className="ow-pr">практика</span> : n.ref}</small>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
