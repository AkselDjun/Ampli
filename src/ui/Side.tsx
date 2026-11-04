import type { Calc } from '../core/types';
import { fmt, fs } from '../core/format';
import { ROWLEN } from '../core/norms';
import { layout } from '../core/calc';
import { Fragment, useState } from 'react';
import { Fold, Tip } from './common';

export function Summary({ a, onBalance, solo = false }: { a: Calc; onBalance: () => void; solo?: boolean }) {
  const mx = a.phases ? Math.max(a.phases.L1, a.phases.L2, a.phases.L3, 0.001) : 1;
  const cols = { L1: 'var(--l1)', L2: 'var(--l2)', L3: 'var(--l3)' };
  return (
    <div className="pane-sum">
      {a.phases && (
        <Fold title="Нагрузка по фазам" className="c-phase" open={solo || a.imb > 25} badge={<span className={'pill ' + (a.imb > 25 ? 'warn' : 'ok')}>{a.imb > 25 ? 'Перекос ' + fmt(a.imb, 0) + ' %' : 'Ровно'}</span>}>
          <button className="btn sm" type="button" onClick={onBalance}>Выровнять</button>
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
}

const EXTRA: Record<string, [string, string]> = { spd: ['УЗИП', 'Защита от перенапряжений'], vr: ['Реле U', 'Реле контроля напряжения'] };

export function shortName(t: string): string {
  const w = (t.trim().split(/[\s,:;]+/)[0] ?? '').replace(/[^\p{L}\d-]/gu, '');
  if (w.length <= 6) return w;
  let cut = w.slice(0, 5);
  while (cut.length > 3 && /[аеёиоуыэюяaeiouy]$/i.test(cut)) cut = cut.slice(0, -1);
  return cut + '.';
}

export function PanelPane({ a, onPick, onMove, sel = null, hot = null, onHot = () => undefined }: { a: Calc; onPick?: (id: string) => void; onMove?: (id: string, to: string) => void; sel?: string | null; hot?: string | null; onHot?: (id: string | null) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const kinds = new Set(a.devs.map(d => d.kind));
  const c = a.c;
  const rl = ROWLEN[a.size];
  const slots = layout(a.devs, rl);
  const gapBefore = slots.map((sl, i) => (i > 0 && sl.row > slots[i - 1].row ? sl.row * rl - (slots[i - 1].row * rl + slots[i - 1].col + a.devs[i - 1].mod) : 0));
  const free = Math.max(0, Math.max(a.size, Math.ceil(a.placed / rl) * rl) - a.placed);
  const nameOf: Record<string, string> = {};
  a.rows.forEach((x, i) => {
    nameOf['Г' + (i + 1)] = x.l.name || 'Без названия';
  });
  return (
    <div className="pane-panel">
      <Fold title="Щиток" className="c-panel" open>
        <p className="muted">
          Приборов на {a.modSum} мод. Нужен корпус на <b>{a.size}</b> мод. с запасом 20 %{a.fits ? '.' : ', но и он тесен: разделите щиток на два.'}
        </p>
        <div className="rail-wrap">
          <div className="rail" data-rc={rl} style={{ ['--rc' as string]: rl }}>
            {a.devs.map((d, i) => <Fragment key={(d.lid ?? d.kind) + i}>{Array.from({ length: gapBefore[i] }, (_, g) => <div key={'g' + g} className="dev dev-free" data-tip="Резерв" />)}{((): JSX.Element => {
              const cls = 'dev dev-' + d.kind + (d.st ? ' st-' + d.st : '') + (d.lid && drag === d.lid ? ' drag' : '') + (d.lid && over === d.lid && drag !== d.lid ? ' over' : '') + (d.lid && d.lid === sel ? ' sel' : '') + (d.lid && d.lid === hot ? ' hot' : '');
              const style = { gridColumn: 'span ' + d.mod, ['--i' as string]: i };
              if (!d.lid) {
                return (
                  <div key={'in' + i} className={cls} style={style} data-tip={d.title}>
                    <b>{d.label}</b>
                    <i>{d.sub}</i>
                    <em className="dev-cap">{d.kind === 'in' ? 'Ввод' : (d.kind === 'spd' || d.kind === 'vr' ? EXTRA[d.kind][0] : d.zone)}</em>
                  </div>
                );
              }
              const lid = d.lid;
              const idx = a.devs.filter(x => x.lid).findIndex(x => x.lid === lid);
              const lids = a.devs.filter(x => x.lid).map(x => x.lid as string);
              return (
                <button
                  key={lid}
                  type="button"
                  className={cls}
                  style={style}
                  data-tip={d.title}
                  aria-label={d.title + ', ' + d.label + '. Открыть группу. Alt и стрелки меняют порядок'}
                  data-ph={d.ph}
                  data-t={a.rows.find(y => y.l.id === lid)?.l.type}
                  aria-current={d.lid === sel ? 'true' : undefined}
                  onMouseEnter={() => onHot(lid)}
                  onMouseLeave={() => onHot(null)}
                  draggable={!!onMove}
                  onClick={() => onPick?.(lid)}
                  onDragStart={e => { setDrag(lid); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', lid); }}
                  onDragOver={e => { if (drag) { e.preventDefault(); setOver(lid); } }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onDrop={e => { e.preventDefault(); if (drag && drag !== lid) onMove?.(drag, lid); setDrag(null); setOver(null); }}
                  onKeyDown={e => {
                    if (!e.altKey || !onMove) return;
                    const t = e.key === 'ArrowLeft' ? lids[idx - 1] : (e.key === 'ArrowRight' ? lids[idx + 1] : undefined);
                    if (t) { e.preventDefault(); onMove(lid, t); }
                  }}
                >
                  <b>{d.label}</b>
                  <i>{d.sub}</i>
                  <em className={'dev-cap' + (d.mod === 1 ? ' sm' : '')}>{d.mod === 1 ? shortName(nameOf[d.sub.split(' ')[0]]) : nameOf[d.sub.split(' ')[0]]}</em>
                </button>
              );
            })()}</Fragment>)}
            {Array.from({ length: free }, (_, i) => (
              <div key={'f' + i} className="dev dev-free" data-tip="Резерв" />
            ))}
          </div>
        </div>
        <div className="legend">
          <span><i className="dev-in" />Ввод</span>
          {(['light', 'socket', 'power'] as const).filter(t => a.rows.some(x => x.l.type === t && x.r.In)).map(t => <span key={t}><i className="lg-ty" data-t={t} />{t === 'light' ? 'Свет' : (t === 'socket' ? 'Розетки' : 'Силовая')}</span>)}
          {kinds.has('uzo') && <span><i className="dev-uzo" />УЗО</span>}
          {kinds.has('vr') && <span><i className="dev-vr" />Реле напряжения</span>}
          {kinds.has('spd') && <span><i className="dev-spd" />УЗИП</span>}
          <span><i className="dev-free" style={{ border: '1px dashed var(--ink-2)' }} />Резерв</span>
          <Tip label="Как пользоваться щитком">Нажмите на модуль, чтобы открыть группу. Порядок меняется перетаскиванием или клавишами Alt и стрелка. Цвет рычажка показывает статус группы.</Tip>
        </div>
        <ul className="bd-list" aria-label="Состав щитка">
          {a.devs.map((d, i) => {
            const row = d.lid ? a.rows.find(y => y.l.id === d.lid) : undefined;
            const g = d.lid ? d.sub.split(' ')[0] : '';
            const load = d.kind === 'in' ? (a.inIn ? a.Itot / a.inIn * 100 : 0) : (row && row.r.In ? row.r.I / row.r.In * 100 : null);
            const cl = load === null ? '' : (load > 100 ? 'bad' : (load > 80 ? 'warn' : ''));
            const u = d.kind === 'uzo' ? a.uzos.find(z => z.zone === d.zone) : undefined;
            const extra = d.kind === 'spd' || d.kind === 'vr';
            const name = d.kind === 'in' ? 'Вводной автомат' : (d.kind === 'uzo' ? 'УЗО: ' + d.zone : (extra ? EXTRA[d.kind][1] : nameOf[g]));
            const kind = d.kind === 'in' ? (c.supply === 3 ? '4 полюса' : '2 полюса') : (d.kind === 'rcd' ? 'дифавтомат ' + d.ma + ' мА' + (row?.r.rcdA ? ', тип A' : '') : (d.kind === 'uzo' ? d.sub.replace('мА', ' мА') + (u?.typeA ? ', тип A' : '') + ', своя шина N' : (d.kind === 'spd' ? 'тип 2, ' + (c.supply === 3 ? '3P+N' : '1P+N') : (d.kind === 'vr' ? (c.supply === 3 ? 'по одному на фазу' : 'отключит квартиру при скачке напряжения') : 'автомат'))));
            const body = (
              <>
                <span className={'bd-no k-' + d.kind}>{d.kind === 'in' ? 'Ввод' : (d.kind === 'uzo' ? 'УЗО' : (extra ? (d.kind === 'spd' ? 'FV' : 'KV') : g))}</span>
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
      </Fold>
    </div>
  );
}
