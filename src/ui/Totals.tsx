import { memo } from 'react';
import type { Calc } from '../core/types';
import { fmt, fs } from '../core/format';
import { inCableName } from '../core/protection';
import { IconDown } from './Icons';
import { usePop } from './pop';
import { Button } from './kit';

export interface AllocState {
  pct: number;
  k: 'ok' | 'warn' | 'bad';
  text: string;
}

export function allocState(a: Calc): AllocState {
  const alloc = a.c.alloc * 1000;
  const pct = alloc > 0 ? a.P / alloc * 100 : 0;
  if (a.P <= 0) return { pct: 0, k: 'ok', text: 'Нет нагрузки' };
  if (pct > 100) return { pct, k: 'bad', text: 'Превышение на ' + fmt((a.P - alloc) / 1000, 1) + ' кВт' };
  if (pct >= 90) return { pct, k: 'warn', text: 'На пределе' };
  return { pct, k: 'ok', text: 'Укладывается' };
}

export const Totals = memo(function Totals({ a, onNet }: { a: Calc; onNet: () => void }) {
  const { open, setOpen, ref } = usePop<HTMLDivElement>();
  const c = a.c;
  const st = allocState(a);
  const three = c.supply === 3;
  const inDev = a.inIn ? (three ? '4P' : '2P') + ' C' + a.inIn : '—';
  const inCab = a.inIn ? (a.inS ? inCableName(c, a.inS) : 'больше 35 мм²') : '—';
  const width = Math.min(100, Math.max(0, st.pct)) + '%';
  return (
    <div className={'tot-w' + (open ? ' open' : '')} ref={ref}>
      <button className={'kpis st-' + st.k} type="button" aria-expanded={open} aria-controls="tot-pop" aria-label={'Итого по квартире: ' + fmt(a.P / 1000, 1) + ' из ' + fmt(c.alloc, 1) + ' кВт, ' + st.text} onClick={() => setOpen(!open)}>
        <div><span className="lbl">Мощность</span><b>{a.P > 0 ? fmt(a.P / 1000, 1) : '—'}<small className="kp-of">/{fmt(c.alloc, 0)}</small><small> кВт</small></b></div>
        <div><span className="lbl">{three ? 'Фаза' : 'Ток'}</span><b>{a.Itot > 0 ? fmt(a.Itot, 0) + ' А' : '—'}</b></div>
        <div className="kp-in"><span className="lbl">Ввод</span><b>{a.inIn ? 'C' + a.inIn : '—'}</b></div>
        <IconDown className="kp-chev" />
        <i className="kp-meter" aria-hidden="true"><i style={{ width }} /></i>
      </button>
      {open && (
        <section className="tot-pop" id="tot-pop" aria-label="Итого по квартире">
          <div className="tp-head">
            <h2>Итого по квартире</h2>
            <span className={'pill ' + st.k}>{st.text}</span>
          </div>
          <div className="tp-main">
            <b>{fmt(a.P / 1000, 1)}</b>
            <span>из {fmt(c.alloc, 1)} кВт выделенной мощности · {Math.round(st.pct)} %</span>
          </div>
          <div className="meter tp-meter" role="img" aria-label={'Загрузка выделенной мощности ' + Math.round(st.pct) + ' %'}>
            <i className={st.k === 'ok' ? '' : st.k} style={{ width }} />
          </div>
          <dl className="tp-dl">
            <div><dt>Установлено</dt><dd>{fmt(a.sumInst / 1000, 1)} кВт</dd></div>
            <div><dt>Одновременность</dt><dd>{fs(c.ko)}</dd></div>
            <div><dt>{three ? 'Макс. фаза' : 'Ток ввода'}</dt><dd>{fmt(a.Itot, 0)} А</dd></div>
            <div><dt>Вводной автомат</dt><dd>{inDev}</dd></div>
            <div className="wide"><dt>Вводной кабель</dt><dd>{inCab}</dd></div>
          </dl>
          <Button size="sm" onClick={() => { setOpen(false); onNet(); }}>Изменить выделенную мощность</Button>
        </section>
      )}
    </div>
  );
});
