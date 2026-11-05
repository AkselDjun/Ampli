import { Fragment, useState } from 'react';
import type { Calc } from '../core/types';
import { fmt } from '../core/format';
import { ROWLEN } from '../core/norms';
import { railCells, useFitCols } from './railfit';
import { VERDICT, protocolRows } from '../core/protocol';
import type { ProtoRow } from '../core/protocol';
import { cableName } from '../core/protection';
import type { Action, MeasField } from '../store/reducer';
import { Sheet } from './common';
import { shortName } from './Side';

const FIELDS: { f: MeasField; label: string; unit: string; step: number }[] = [
  { f: 'zs', label: 'Петля фаза-нуль', unit: 'Ом', step: 0.01 },
  { f: 'ins', label: 'Изоляция', unit: 'МОм', step: 0.1 },
  { f: 'leak', label: 'Утечка', unit: 'мА', step: 0.1 },
  { f: 'rcd', label: 'Отключение УЗО', unit: 'мс', step: 1 }
];

const STRIP: Record<string, [string, string]> = { in: ['Ввод', 'вся квартира'], uzo: ['УЗО', ''], spd: ['УЗИП', 'перенапряж.'], vr: ['Реле U', 'напряжение'], rcd: ['', ''], mcb: ['', ''] };

const pillOf = (v: ProtoRow['verdict']): string => (v === 'ok' ? 'ok' : (v === 'bad' ? 'bad' : 'warn'));

export function PanelMode({ open, onClose, a, dispatch }: { open: boolean; onClose: () => void; a: Calc; dispatch: (x: Action) => void }) {
  const rows = protocolRows(a);
  const byNo = new Map(rows.map(r => [r.no, r]));
  const noOf = (lid: string): string => 'Г' + (a.rows.findIndex(x => x.l.id === lid) + 1);
  const order = a.devs.filter(d => d.lid && byNo.has(noOf(d.lid))).map(d => d.lid as string);
  const firstOpen = order.find(id => byNo.get(noOf(id))?.verdict === 'none') ?? order[0];
  const [pick, setPick] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setPick(null);
  }
  const cur = pick && order.includes(pick) ? pick : (firstOpen ?? null);
  const done = rows.filter(r => r.verdict !== 'none').length;
  const rl = ROWLEN[a.size];
  const [railRef, cols] = useFitCols<HTMLDivElement>(rl, 42, 2);
  const { gapBefore, free } = railCells(a.devs, cols, rl, a.size);
  const x = cur ? a.rows.find(y => y.l.id === cur) : undefined;
  const r = cur ? byNo.get(noOf(cur)) : undefined;
  const at = cur ? order.indexOf(cur) : -1;
  const go = (k: number) => {
    setPick(order[k]);
    requestAnimationFrame(() => {
      const el = document.querySelector('.pmb-dev.sel');
      if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };
  const hint = (f: MeasField): string => {
    if (!x) return '';
    if (f === 'zs') return 'до ' + fmt(230 / x.r.ikNeed, 2);
    if (f === 'ins') return 'от 0,5';
    if (f === 'leak') return 'до ' + fmt(x.r.leakLim, 1);
    return 'до ' + fmt(x.r.rcdLim, 0);
  };
  const plate = (key: string) => <div key={key} className="pmb-dev pmb-free" aria-hidden="true"><span className="pmb-strip" /><span className="pmb-blank" /></div>;
  return (
    <Sheet open={open} onClose={onClose} title="На щитке" tip="Щиток показан так же, как он собран: нажмите на автомат и введите замеры. Цвет рычажка: зелёный соответствует, красный не соответствует, серый ещё не измерено.">
      {rows.length === 0 && <p className="muted">Добавьте группы с приборами, они появятся здесь.</p>}
      {rows.length > 0 && (
        <>
          <div className="pmb-top">
            <span><b>{done}</b> из {rows.length} групп измерено</span>
            <span className="pmb-leg"><i className="v-ok" />соответствует <i className="v-bad" />нет <i className="v-none" />не измерено</span>
          </div>
          <div className="pmb-box">
            <div className="pmb-rail" ref={railRef} data-rc={cols} style={{ ['--rc' as string]: cols }}>
              {a.devs.map((d, i) => {
                const gaps = Array.from({ length: gapBefore[i] }, (_, g) => plate('g' + i + '-' + g));
                const style = { gridColumn: 'span ' + d.mod };
                if (!d.lid) {
                  return (
                    <Fragment key={d.kind + i}>
                      {gaps}
                      <div className={'pmb-dev k-' + d.kind} style={style} data-tip={d.title}>
                        <span className="pmb-strip"><b>{STRIP[d.kind][0]}</b><span>{d.kind === 'uzo' ? d.zone : STRIP[d.kind][1]}</span></span>
                        <span className="pmb-scr" />
                        <span className="pmb-rate">{d.label}</span>
                        <span className="pmb-lever v-in" />
                        <span className="pmb-sub">{d.kind === 'in' ? (a.c.supply === 3 ? '4P' : '2P') : d.sub}</span>
                        <span className="pmb-scr" />
                      </div>
                    </Fragment>
                  );
                }
                const lid = d.lid;
                const no = noOf(lid);
                const pr = byNo.get(no);
                const name = a.rows.find(y => y.l.id === lid)?.l.name || 'Без названия';
                if (!pr) return <Fragment key={lid}>{gaps}</Fragment>;
                return (
                  <Fragment key={lid}>
                    {gaps}
                    <button
                      type="button"
                      className={'pmb-dev k-' + d.kind + ' v-' + pr.verdict + (cur === lid ? ' sel' : '')}
                      style={style}
                      aria-pressed={cur === lid}
                      aria-label={no + ' ' + name + ', ' + d.label + ', ' + VERDICT[pr.verdict]}
                      data-tip={no + ' ' + name}
                      onClick={() => setPick(lid)}
                    >
                      <span className="pmb-strip"><b>{no}</b><span>{d.mod > 1 ? name : shortName(name)}</span></span>
                      <span className="pmb-scr" />
                      <span className="pmb-rate">{d.label}</span>
                      <span className={'pmb-lever v-' + pr.verdict} />
                      <span className="pmb-sub">{d.kind === 'rcd' ? (d.ma ?? '') + 'мА' : ''}</span>
                      <span className="pmb-scr" />
                    </button>
                  </Fragment>
                );
              })}
              {Array.from({ length: free }, (_, i) => plate('f' + i))}
            </div>
          </div>
        </>
      )}
      {x && r && (
        <section className={'pm ' + r.verdict} aria-label={'Замеры ' + r.no}>
          <div className="pm-head">
            <span className="no">{r.no}</span>
            <span className="pm-name">{r.name}</span>
            <span className={'pill ' + pillOf(r.verdict)}>{VERDICT[r.verdict]}</span>
          </div>
          <div className="pm-prot">
            <b className="mono">{r.prot}</b>
            <span className="mono">{x.r.In ? cableName(x.r) : ''}</span>
            {x.l.where && <span className="pm-where">{x.l.where}</span>}
          </div>
          <div className="pm-in">
            {FIELDS.filter(fd => fd.f !== 'rcd' || x.r.rcd).map(fd => (
              <label key={fd.f} className="f">
                <span className="lbl">{fd.label}, {fd.unit}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  min={0}
                  step={fd.step}
                  aria-label={r.no + ': ' + fd.label + ', ' + fd.unit}
                  placeholder={hint(fd.f)}
                  value={String((x.l.meas ?? {})[fd.f] ?? '')}
                  onChange={e => {
                    setPick(x.l.id);
                    dispatch({ t: 'lineMeasAt', id: x.l.id, field: fd.f, value: e.target.value });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="pm-note">
            {r.zs !== null && <span>Ток КЗ {fmt(r.ik as number, 0)} А, нужно не меньше {fmt(r.need, 0)} А</span>}
            {r.leak !== null && <span>Утечка до {fmt(r.leakLim, 1)} мА</span>}
            {r.rcdT !== null && <span>УЗО до {fmt(r.rcdLim, 0)} мс</span>}
          </div>
          <div className="pm-nav">
            <button className="btn" type="button" disabled={at <= 0} onClick={() => go(at - 1)}>← {at > 0 ? noOf(order[at - 1]) : 'Назад'}</button>
            <button className="btn primary" type="button" disabled={at >= order.length - 1} onClick={() => go(at + 1)}>{at < order.length - 1 ? 'Дальше: ' + noOf(order[at + 1]) : 'Последняя группа'} →</button>
          </div>
        </section>
      )}
    </Sheet>
  );
}
