import type { Calc, Device, LineType } from '../core/types';
import { fmt, fs, plural } from '../core/format';
import { ROWLEN } from '../core/norms';
import { cableName, deviceKind, prioContactor, vrContactor } from '../core/protection';
import { railCells, useFitCols } from './railfit';
import { memo, useState } from 'react';
import type { ReactNode } from 'react';
import { Fold, Tip } from './common';
import { same } from './hold';
import { Button } from './kit';
import { BP, useMedia } from './media';

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
  const cls = 'dev dev-' + d.kind + (d.arc ? ' arc' : '') + (d.st ? ' is-' + d.st : '') + (d.lid && drag === d.lid ? ' drag' : '') + (over && drag !== d.lid ? ' over' : '') + (sel ? ' sel' : '') + (hot ? ' hot' : '');
  const style = { ['--n' as string]: d.mod, ['--i' as string]: i };
  if (!d.lid) {
    return (
      <div className={cls} style={style} data-tip={d.title}>
        <i className="scr" aria-hidden="true" />
        <b>{d.label}</b>
        <i>{d.sub}</i>
        <span className="slot" aria-hidden="true"><i className="lv" /></span>
        {d.kind === 'uzo' || d.kind === 'rcd' ? <span className="tbt" aria-hidden="true">T</span> : null}
        <i className="scr b" aria-hidden="true" />
        <em className="dev-cap">{d.kind === 'in' ? 'Ввод' : (vrContactor(d) ? 'Контактор' : (d.kind === 'spd' || d.kind === 'vr' || d.kind === 'prio' ? EXTRA[d.kind][0] : d.zone))}</em>
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
      <i className="scr" aria-hidden="true" />
      <b>{d.label}</b>{' '}
      <i>{d.mod > 1 ? d.sub : ''}</i>{' '}
      <span className="slot" aria-hidden="true"><i className={'lv' + (d.st && d.st !== 'ok' ? ' ' + d.st : '')} /></span>
      <i className="scr b" aria-hidden="true" />
      <em className={'dev-cap' + (d.mod === 1 ? ' sm' : '')}>{cap}</em>
      <span className="vh">{'. ' + d.title + ', ' + d.label + '. Открыть группу. Alt и стрелки меняют порядок'}</span>
    </button>
  );
}, sameMod);

export const PanelPane = memo(function PanelPane({ a, onPick, onMove, sel = null, hot = null, onHot = () => undefined, mini = false, onMore }: { a: Calc; onPick?: (id: string) => void; onMove?: (id: string, to: string) => void; sel?: string | null; hot?: string | null; onHot?: (id: string | null) => void; mini?: boolean; onMore?: () => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const kinds = new Set(a.devs.map(d => d.kind));
  const c = a.c;
  const rl = ROWLEN[a.size];
  const [railRef, cols] = useFitCols<HTMLDivElement>(rl, mini ? 14 : 28, mini ? 1 : 3);
  const { gapBefore, free } = railCells(a.devs, cols, rl, a.size);
  const nameOf: Record<string, string> = {};
  const typeOf = new Map<string, LineType>();
  a.rows.forEach((x, i) => {
    nameOf['Г' + (i + 1)] = x.l.name || 'Без названия';
    typeOf.set(x.l.id, x.l.type);
  });
  const lids = a.devs.filter(x => x.lid).map(x => x.lid as string);
  const desktop = useMedia(BP.desktop, true);
  const [listPick, setListOpen] = useState<boolean | null>(null);
  const listOpen = listPick ?? desktop;
  const rows = Math.max(1, Math.round(a.size / rl));
  const selRow = sel ? a.rows.findIndex(x => x.l.id === sel) : -1;
  const idx = new Map(a.rows.map((x, i) => [x.l.id, i]));
  type Cell = { key: string; n: number; node: ReactNode; lb: string; txt: string };
  const free1 = (key: string): Cell => ({ key, n: 1, node: <div key={key} style={{ ['--n' as string]: 1 }} className="dev dev-free" data-tip="Резерв" aria-hidden="true" />, lb: ' free', txt: '' });
  const cells: Cell[] = [];
  a.devs.forEach((d, i) => {
    const lid = d.lid;
    for (let g = 0; g < gapBefore[i]; g++) cells.push(free1('g' + i + '-' + g));
    const k = lid ? lids.indexOf(lid) : -1;
    const cap = lid && d.mod > 1 ? nameOf[d.sub.split(' ')[0]] : '';
    const n = lid ? idx.get(lid) ?? -1 : -1;
    const t = lid ? typeOf.get(lid) : undefined;
    const txt = n >= 0 ? String(n + 1).padStart(2, '0') : (d.kind === 'in' ? 'Ввод' : (d.kind === 'uzo' || d.kind === 'rcd' ? (d.zone || 'УЗО') : (vrContactor(d) ? 'KM' : (EXTRA[d.kind]?.[0] ?? ''))));
    cells.push({
      key: lid ?? d.kind + i,
      n: d.mod,
      lb: ' k-' + d.kind + (t ? ' lt-' + t : '') + (lid && lid === sel ? ' sel' : ''),
      txt,
      node: <Module key={lid ?? d.kind + i} d={d} i={i} cap={cap} t={t} drag={drag} over={!!lid && over === lid} sel={!!lid && lid === sel} hot={!!lid && lid === hot} prev={k > 0 ? lids[k - 1] : undefined} next={k >= 0 ? lids[k + 1] : undefined} onPick={onPick} onMove={mini ? undefined : onMove} onHot={onHot} setDrag={setDrag} setOver={setOver} />
    });
  });
  for (let i = 0; i < free; i++) cells.push(free1('f' + i));
  const lines: Cell[][] = [];
  let acc = 0;
  for (const x of cells) {
    if (!lines.length || acc + x.n > cols) { lines.push([]); acc = 0; }
    lines[lines.length - 1].push(x);
    acc += x.n;
  }
  const sr = selRow >= 0 ? a.rows[selRow] : null;
  return (
    <section className={'box pane-panel' + (mini ? ' mini' : '')} aria-labelledby={mini ? 'pp-h-m' : 'pp-h'}>
      <div className="box-h">
        <h2 id={mini ? 'pp-h-m' : 'pp-h'}>Щиток</h2>
        {!mini && <span className="note grow">{rows} {plural(rows, ['ряд', 'ряда', 'рядов'])} по {rl} {plural(rl, ['модулю', 'модуля', 'модулей'])}</span>}
        {mini && <span className="grow" />}
        <span className="mono note">{a.size} мод.</span>
        {mini && onMore && <Button size="sm" onClick={onMore}>Подробно</Button>}
      </div>
      <div className="pp-body">
        {!mini && (a.rows.some(x => x.r.In) ? (
          <p className="muted">
            Приборов на {a.modSum} мод. Нужен корпус на <b>{a.size}</b> мод. с запасом 20 %{a.fits ? '.' : ', но и он тесен: разделите щиток на два.'}
          </p>
        ) : <p className="muted bd-empty">Щиток соберётся, когда в проекте появится группа с приборами.</p>)}
        <div className="rail-wrap encl">
          <div className="rail" ref={railRef} data-rc={cols} style={{ ['--rc' as string]: cols }}>
            {lines.map((row, ri) => (
              <div className="dr" key={ri}>
                <div className="cut"><div className="mods">{row.map(x => x.node)}</div></div>
                <div className="strip" aria-hidden="true">{row.map(x => <span key={x.key} className={'lb' + x.lb} style={{ ['--n' as string]: x.n }}>{x.txt}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {mini ? (sr && (
        <div className="pp-sel">
          <span className="no" data-t={sr.l.type}>{String(selRow + 1).padStart(2, '0')}</span>
          <span className="grow">{sr.l.name || 'Без названия'}</span>
          <span className="mono note">{sr.r.In ? sr.r.curve + sr.r.In : '—'}{sr.r.rcd && !sr.r.rcbo ? ' · УЗО «' + sr.r.zone + '»' : ''}</span>
        </div>
      )) : (
      <>
        <div className="legend">
          <span><i className="dev-in" />Ввод</span>
          {(['light', 'socket', 'power'] as const).filter(t => a.rows.some(x => x.l.type === t && x.r.In)).map(t => <span key={t}><i className="lg-ty" data-t={t} />{t === 'light' ? 'Свет' : (t === 'socket' ? 'Розетки' : 'Силовая')}</span>)}
          {kinds.has('uzo') && <span><i className="dev-uzo" />УЗО</span>}
          {kinds.has('vr') && <span><i className="dev-vr" />Реле напряжения</span>}
          {kinds.has('spd') && <span><i className="dev-spd" />УЗИП</span>}
          {a.devs.some(d => d.arc) && <span><i className="lg-arc" />УЗДП</span>}
          <span><i className="dev-free" />Резерв</span>
          <Tip label="Как пользоваться щитком">Нажмите на модуль, чтобы открыть группу. Цвет рычажка показывает статус группы. Порядок групп меняется в карточке группы, в меню «Ещё действия», а на компьютере ещё перетаскиванием или клавишами Alt и стрелка.</Tip>
        </div>
        <details className="bd-fold" open={listOpen} onToggle={e => setListOpen(e.currentTarget.open)}>
        <summary>{'Состав щитка: ' + a.devs.length + ' ' + plural(a.devs.length, ['аппарат', 'аппарата', 'аппаратов'])}</summary>
        <ul className="bd-list" aria-label="Состав щитка">
          {a.devs.map((d, i) => {
            const row = d.lid ? a.rows.find(y => y.l.id === d.lid) : undefined;
            const g = d.lid ? String(a.rows.findIndex(y => y.l.id === d.lid) + 1).padStart(2, '0') : '';
            const load = d.kind === 'in' ? (a.inIn ? a.Itot / a.inIn * 100 : 0) : (row && row.r.In ? row.r.I / row.r.In * 100 : null);
            const cl = load === null ? '' : (load > 100 ? 'bad' : (load > 80 ? 'warn' : ''));
            const u = d.kind === 'uzo' ? a.uzos.find(z => z.zone === d.zone) : undefined;
            const extra = d.kind === 'spd' || d.kind === 'vr' || d.kind === 'prio';
            const name = d.kind === 'in' ? 'Вводной автомат' : (d.kind === 'uzo' ? 'УЗО: ' + d.zone : (prioContactor(d) ? 'Контактор ' + d.sub : (vrContactor(d) ? 'Контактор ввода' : (extra ? EXTRA[d.kind][1] : nameOf[g]))));
            const kind = deviceKind(d, c, !!row?.r.rcdA, !!u?.typeA);
            const body = (
              <>
                <span className={'bd-no k-' + d.kind}>{d.kind === 'in' ? 'Ввод' : (d.kind === 'uzo' ? 'УЗО' : (extra ? (d.kind === 'spd' ? 'FV' : (prioContactor(d) || vrContactor(d) ? 'KM' : 'KV')) : g))}</span>
                <span className="bd-main">
                  <span className="bd-name">{name}</span>
                  <span className="bd-sub">{kind}{row && row.r.S ? ', ' + fs(row.r.S) + ' мм²' : ''}{u ? ' · ' + u.groups.map(k => String(k + 1).padStart(2, '0')).join(', ') : ''}</span>
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
      </>
      )}
    </section>
  );
});

export const PanelSel = memo(function PanelSel({ a, sel, onOpen }: { a: Calc; sel: string | null; onOpen: (id: string) => void }) {
  const i = sel ? a.rows.findIndex(x => x.l.id === sel) : -1;
  const x = i >= 0 ? a.rows[i] : null;
  if (!x || x.r.empty) {
    return <p className="box note pp-hint">Выберите аппарат на рейке. Цвет рычажка показывает статус группы: серый норма, оранжевый совет, красный нарушение.</p>;
  }
  const r = x.r;
  const load = r.In ? r.I / r.In * 100 : 0;
  return (
    <section className="box pp-dev" aria-labelledby="pp-dev-h">
      <div className="box-h">
        <span className="no" data-t={x.l.type}>{String(i + 1).padStart(2, '0')}</span>
        <h2 id="pp-dev-h" className="grow">{x.l.name || 'Без названия'}</h2>
      </div>
      <dl className="kvs">
        <div className="kv"><dt>Автомат</dt><dd className="mono">{r.In ? r.curve + r.In : '—'}</dd></div>
        {r.S ? <div className="kv"><dt>Кабель</dt><dd className="mono">{cableName(r)}</dd></div> : null}
        <div className="kv"><dt>Ток</dt><dd className="mono">{fmt(r.I, 1)} А</dd></div>
        {r.In ? <div className="kv"><dt>Загрузка</dt><dd className={'mono' + (load > 90 ? ' warn' : '')}>{Math.round(load)} %</dd></div> : null}
        {r.rcd && !r.rcbo && r.zone ? <div className="kv"><dt>УЗО</dt><dd>{r.zone}</dd></div> : null}
        {x.l.phase && a.c.supply === 3 ? <div className="kv"><dt>Фаза</dt><dd className="mono">{x.l.phase}</dd></div> : null}
      </dl>
      <div className="pp-act"><Button size="sm" onClick={() => onOpen(x.l.id)}>Открыть группу</Button></div>
    </section>
  );
});
