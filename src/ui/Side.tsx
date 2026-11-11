import type { Calc, Device, LineType } from '../core/types';
import { fmt, fs, plural } from '../core/format';
import { ROWLEN } from '../core/norms';
import { railCells, useFitCols } from './railfit';
import { Fragment, memo, useState } from 'react';
import { Fold, Tip } from './common';
import { same } from './hold';
import { Button } from './kit';

export const Summary = memo(function Summary({ a, onBalance, solo = false }: { a: Calc; onBalance: () => void; solo?: boolean }) {
  const mx = a.phases ? Math.max(a.phases.L1, a.phases.L2, a.phases.L3, 0.001) : 1;
  const cols = { L1: 'var(--l1)', L2: 'var(--l2)', L3: 'var(--l3)' };
  return (
    <div className="pane-sum">
      {a.phases && (
        <Fold title="Нагрузка по фазам" className="c-phase" open={solo || a.imb > 25} badge={<span className={'pill ' + (a.imb > 25 ? 'warn' : 'ok')}>{a.imb > 25 ? 'Перекос ' + fmt(a.imb, 0) + ' %' : 'Ровно'}</span>}>
          <Button size="sm" onClick={onBalance}>Выровнять</Button>
          {(['L1', 'L2', 'L3'] as const).map(k => (
            <div className="phase" key={k}>
              <span className="n">{k}</span>
              <div className="meter"><i style={{ width: ((a.phases as NonNullable<Calc['phases']>)[k] / mx * 100) + '%', background: cols[k] }} /></div>
              <b>{fmt((a.phases as NonNullable<Calc['phases']>)[k], 1)} А</b>
            </div>
          ))}
        </Fold>
      )}
    </div>
  );
});

const EXTRA: Record<string, [string, string]> = { spd: ['УЗИП', 'Защита от перенапряжений'], vr: ['Реле U', 'Реле контроля напряжения'], prio: ['Приоритет', 'Реле приоритета нагрузки'] };

export function shortName(t: string): string {
  const w = (t.trim().split(/[\s,:;]+/)[0] ?? '').replace(/[^\p{L}\d-]/gu, '');
  if (w.length <= 6) return w;
  let cut = w.slice(0, 5);
  while (cut.length > 3 && /[аеёиоуыэюяaeiouy]$/i.test(cut)) cut = cut.slice(0, -1);
  return cut + '.';
}

type ModProps = {
  d: Device;
  i: number;
  cap: string;
  t?: LineType;
  drag: string | null;
  over: boolean;
  sel: boolean;
  hot: boolean;
  prev?: string;
  next?: string;
  onPick?: (id: string) => void;
  onMove?: (id: string, to: string) => void;
  onHot: (id: string | null) => void;
  setDrag: (v: string | null) => void;
  setOver: (v: string | null) => void;
};

const sameMod = (a: ModProps, b: ModProps): boolean => {
  const { d: da, ...ra } = a;
  const { d: db, ...rb } = b;
  return same(ra, rb) && same(da, db);
};

const Module = memo(function Module({ d, i, cap, t, drag, over, sel, hot, prev, next, onPick, onMove, onHot, setDrag, setOver }: ModProps) {
  const cls = 'dev dev-' + d.kind + (d.arc ? ' arc' : '') + (d.st ? ' st-' + d.st : '') + (d.lid && drag === d.lid ? ' drag' : '') + (over && drag !== d.lid ? ' over' : '') + (sel ? ' sel' : '') + (hot ? ' hot' : '');
  const style = { gridColumn: 'span ' + d.mod, ['--i' as string]: i };
  if (!d.lid) {
    return (
      <div className={cls} style={style} data-tip={d.title}>
        <b>{d.label}</b>
        <i>{d.sub}</i>
        <em className="dev-cap">{d.kind === 'in' ? 'Ввод' : (d.kind === 'spd' || d.kind === 'vr' || d.kind === 'prio' ? EXTRA[d.kind][0] : d.zone)}</em>
      </div>
    );
  }
  const lid = d.lid;
  return (
    <button
      type="button"
      className={cls}
      style={style}
      data-tip={d.title}
      data-ph={d.ph}
      data-t={t}
      aria-current={sel ? 'true' : undefined}
      onMouseEnter={() => onHot(lid)}
      onMouseLeave={() => onHot(null)}
      data-lid={lid}
      draggable={!!onMove}
      onClick={() => onPick?.(lid)}
      onDragStart={e => { setDrag(lid); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', lid); }}
      onDragOver={e => { if (drag) { e.preventDefault(); setOver(lid); } }}
      onDragEnd={() => { setDrag(null); setOver(null); }}
      onDrop={e => { e.preventDefault(); if (drag && drag !== lid) onMove?.(drag, lid); setDrag(null); setOver(null); }}
      onKeyDown={e => {
        if (!e.altKey || !onMove) return;
        const to = e.key === 'ArrowLeft' ? prev : (e.key === 'ArrowRight' ? next : undefined);
        if (to) {
          e.preventDefault();
          onMove(lid, to);
          requestAnimationFrame(() => (document.querySelector('.rail [data-lid="' + lid + '"]') as HTMLElement | null)?.focus());
        }
      }}
    >
      {d.arc && <span className="dev-arc" aria-hidden="true">ДП</span>}
      {d.ph && <span className="dev-ph" aria-hidden="true">{d.ph === '3' ? '3Ф' : d.ph}</span>}
      <b>{d.label}</b>{' '}
      <i>{d.sub}</i>{' '}
      <em className={'dev-cap' + (d.mod === 1 ? ' sm' : '')}>{cap}</em>
      <span className="vh">{'. ' + d.title + ', ' + d.label + '. Открыть группу. Alt и стрелки меняют порядок'}</span>
    </button>
  );
}, sameMod);

export const PanelPane = memo(function PanelPane({ a, onPick, onMove, sel = null, hot = null, onHot = () => undefined }: { a: Calc; onPick?: (id: string) => void; onMove?: (id: string, to: string) => void; sel?: string | null; hot?: string | null; onHot?: (id: string | null) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const kinds = new Set(a.devs.map(d => d.kind));
  const c = a.c;
  const rl = ROWLEN[a.size];
  const [railRef, cols] = useFitCols<HTMLDivElement>(rl, 28, 3);
  const { gapBefore, free } = railCells(a.devs, cols, rl, a.size);
  const nameOf: Record<string, string> = {};
  const typeOf = new Map<string, LineType>();
  a.rows.forEach((x, i) => {
    nameOf['Г' + (i + 1)] = x.l.name || 'Без названия';
    typeOf.set(x.l.id, x.l.type);
  });
  const lids = a.devs.filter(x => x.lid).map(x => x.lid as string);
  const [listOpen, setListOpen] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1000px)').matches);
  return (
    <div className="pane-panel">
      <Fold title="Щиток" className="c-panel" open>
        <p className="muted">
          Приборов на {a.modSum} мод. Нужен корпус на <b>{a.size}</b> мод. с запасом 20 %{a.fits ? '.' : ', но и он тесен: разделите щиток на два.'}
        </p>
        <div className="rail-wrap">
          <div className="rail" ref={railRef} data-rc={cols} style={{ ['--rc' as string]: cols }}>
            {a.devs.map((d, i) => {
              const lid = d.lid;
              const k = lid ? lids.indexOf(lid) : -1;
              const cap = lid ? (d.mod === 1 ? shortName(nameOf[d.sub.split(' ')[0]]) : nameOf[d.sub.split(' ')[0]]) : '';
              return (
                <Fragment key={d.lid ?? d.kind + i}>
                  {Array.from({ length: gapBefore[i] }, (_, g) => <div key={'g' + g} className="dev dev-free" data-tip="Резерв" aria-hidden="true" />)}
                  <Module d={d} i={i} cap={cap} t={lid ? typeOf.get(lid) : undefined} drag={drag} over={!!lid && over === lid} sel={!!lid && lid === sel} hot={!!lid && lid === hot} prev={k > 0 ? lids[k - 1] : undefined} next={k >= 0 ? lids[k + 1] : undefined} onPick={onPick} onMove={onMove} onHot={onHot} setDrag={setDrag} setOver={setOver} />
                </Fragment>
              );
            })}
            {Array.from({ length: free }, (_, i) => (
              <div key={'f' + i} className="dev dev-free" data-tip="Резерв" aria-hidden="true" />
            ))}
          </div>
        </div>
        <div className="legend">
          <span><i className="dev-in" />Ввод</span>
          {(['light', 'socket', 'power'] as const).filter(t => a.rows.some(x => x.l.type === t && x.r.In)).map(t => <span key={t}><i className="lg-ty" data-t={t} />{t === 'light' ? 'Свет' : (t === 'socket' ? 'Розетки' : 'Силовая')}</span>)}
          {kinds.has('uzo') && <span><i className="dev-uzo" />УЗО</span>}
          {kinds.has('vr') && <span><i className="dev-vr" />Реле напряжения</span>}
          {kinds.has('spd') && <span><i className="dev-spd" />УЗИП</span>}
          {a.devs.some(d => d.arc) && <span><i className="lg-arc" />УЗДП</span>}
          <span><i className="dev-free" style={{ border: '1px dashed var(--ink-2)' }} />Резерв</span>
          <Tip label="Как пользоваться щитком">Нажмите на модуль, чтобы открыть группу. Цвет рычажка показывает статус группы. Порядок групп меняется в карточке группы, в меню «Ещё действия», а на компьютере ещё перетаскиванием или клавишами Alt и стрелка.</Tip>
        </div>
        <details className="bd-fold" open={listOpen} onToggle={e => setListOpen(e.currentTarget.open)}>
        <summary>{'Состав щитка: ' + a.devs.length + ' ' + plural(a.devs.length, ['аппарат', 'аппарата', 'аппаратов'])}</summary>
        <ul className="bd-list" aria-label="Состав щитка">
          {a.devs.map((d, i) => {
            const row = d.lid ? a.rows.find(y => y.l.id === d.lid) : undefined;
            const g = d.lid ? d.sub.split(' ')[0] : '';
            const load = d.kind === 'in' ? (a.inIn ? a.Itot / a.inIn * 100 : 0) : (row && row.r.In ? row.r.I / row.r.In * 100 : null);
            const cl = load === null ? '' : (load > 100 ? 'bad' : (load > 80 ? 'warn' : ''));
            const u = d.kind === 'uzo' ? a.uzos.find(z => z.zone === d.zone) : undefined;
            const extra = d.kind === 'spd' || d.kind === 'vr' || d.kind === 'prio';
            const name = d.kind === 'in' ? 'Вводной автомат' : (d.kind === 'uzo' ? 'УЗО: ' + d.zone : (d.kind === 'prio' && d.sub !== 'приоритет' ? 'Контактор ' + d.sub : (extra ? EXTRA[d.kind][1] : nameOf[g])));
            const kind = d.kind === 'in' ? (c.supply === 3 ? '4 полюса' : '2 полюса') : (d.kind === 'rcd' ? (d.arc ? 'УЗДП с дифавтоматом ' : 'дифавтомат ') + d.ma + ' мА' + (row?.r.rcdA ? ', тип A' : '') : (d.kind === 'uzo' ? d.sub.replace('мА', ' мА') + (u?.typeA ? ', тип A' : '') + ', своя шина N' : (d.kind === 'spd' ? 'тип 2, ' + (c.supply === 3 ? '3P+N' : '1P+N') : (d.kind === 'vr' ? (c.supply === 3 ? 'по одному на фазу' : 'отключит квартиру при скачке напряжения') : d.kind === 'prio' ? d.title.split(': ')[1] ?? '' : (d.arc ? 'УЗДП с автоматом' : 'автомат')))));
            const body = (
              <>
                <span className={'bd-no k-' + d.kind}>{d.kind === 'in' ? 'Ввод' : (d.kind === 'uzo' ? 'УЗО' : (extra ? (d.kind === 'spd' ? 'FV' : (d.kind === 'prio' && d.sub !== 'приоритет' ? 'KM' : 'KV')) : g))}</span>
                <span className="bd-main">
                  <span className="bd-name">{name}</span>
                  <span className="bd-sub">{kind}{row && row.r.S ? ', ' + fs(row.r.S) + ' мм²' : ''}{u ? ' · ' + u.groups.map(k => 'Г' + (k + 1)).join(', ') : ''}</span>
                </span>
                <b className="bd-lbl">{d.label}</b>
                {load !== null && (
                  <span className="bd-load">
                    <span className="gl-bar" role="img" aria-label={'Загрузка ' + Math.round(load) + ' %'}><i className={cl} style={{ width: Math.min(100, load) + '%' }} /></span>
                    <small>{d.kind === 'in' ? fmt(a.Itot, 0) : fmt((row as NonNullable<typeof row>).r.I, 1)} / {d.kind === 'in' ? a.inIn : (row as NonNullable<typeof row>).r.In} А</small>
                  </span>
                )}
              </>
            );
            return (
              <li key={d.kind + i} className={'bd-r' + (d.kind === 'mcb' && c.rcdMode && d.zone ? ' sub' : '') + (d.lid && d.lid === sel ? ' sel' : '') + (d.lid && d.lid === hot ? ' hot' : '')}>
                {d.lid && onPick ? <button type="button" className="bd-b" aria-current={d.lid === sel ? 'true' : undefined} onMouseEnter={() => onHot(d.lid as string)} onMouseLeave={() => onHot(null)} onClick={() => onPick(d.lid as string)}>{body}</button> : <div className="bd-b">{body}</div>}
              </li>
            );
          })}
        </ul>
        </details>
      </Fold>
    </div>
  );
});
