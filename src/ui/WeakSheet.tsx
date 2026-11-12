import type { Project } from '../core/types';
import { UTP_MAX, WEAK_KEYS, WEAK_KINDS, weakCalc, weakSpec } from '../core/weak';
import type { WeakKind } from '../core/weak';
import { fmt, plural, pn } from '../core/format';
import type { Action } from '../store/reducer';
import { Err, Sheet, errAttrs } from './common';
import { asLabel, fieldErr } from '../core/limits';
import type { FieldErr } from '../core/limits';
import { toastOk } from './toast';
import { IconAlert, IconClose, IconInfo } from './Icons';
import { IconButton } from './kit';


const nErr = (v: unknown): FieldErr | null => {
  const e = fieldErr('wkN', v);
  return e && asLabel('Количество', e);
};
export function WeakSheet({ open, onClose, p, dispatch }: { open: boolean; onClose: () => void; p: Project; dispatch: (a: Action) => void }) {
  const w = p.weak;
  const pts = w?.pts ?? [];
  const c = w && pts.length ? weakCalc(w) : null;
  const spec = c ? weakSpec(c) : [];
  const zones = Array.from(new Set([...p.lines.map(l => (l.zone ?? '').trim()), ...(p.floor ?? []).map(r => r.name.trim())].filter(Boolean)));
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
              <input aria-label="Количество" type="text" inputMode="numeric" min={1} {...errAttrs(nErr(x.n), 'e-wn-' + x.id)} value={String(x.n)} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'n', value: e.target.value })} onBlur={() => { if (!(pn(x.n, 0) >= 1)) dispatch({ t: 'weakSet', id: x.id, field: 'n', value: '1' }); }} />
              <input aria-label="Длина от щитка, м" type="text" inputMode="decimal" min={0} placeholder="м" value={String(x.len)} onChange={e => dispatch({ t: 'weakSet', id: x.id, field: 'len', value: e.target.value })} />
              <IconButton label="Удалить точку" onClick={() => { dispatch({ t: 'weakDel', id: x.id }); toastOk('Точка удалена: ' + (x.room || WEAK_KINDS[x.kind].short)); }}><IconClose /></IconButton>
              <Err e={nErr(x.n)} id={'e-wn-' + x.id} />
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
