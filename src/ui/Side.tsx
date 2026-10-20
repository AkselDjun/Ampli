import type { Calc } from '../core/types';
import { fmt, fs, plural } from '../core/format';
import { ROWLEN } from '../core/norms';
import { useState } from 'react';
import { Fold, Tip } from './common';

function Kv({ l, v }: { l: string; v: string }) {
  return (
    <div className="kv">
      <span className="lbl">{l}</span>
      <b>{v}</b>
    </div>
  );
}

interface Check {
  k: 'ok' | 'warn' | 'bad';
  t: string;
}

function checksOf(a: Calc): Check[] {
  const c = a.c;
  const out: Check[] = [];
  if (a.hint3) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт больше 12 кВт. Для квартиры нужен трёхфазный ввод (СН 4.04.01-2019, п. 9.12): включите «3 фазы» в параметрах.' });
  else if (c.supply === 3 && a.P > 0 && a.P <= 12000) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт не больше 12 кВт: по СН 4.04.01-2019, п. 9.12 достаточно однофазного ввода.' });
  else if (a.P > 0) out.push({ k: 'ok', t: 'Тип ввода соответствует нагрузке (до 12 кВт однофазный, больше трёхфазный, СН п. 9.12).' });
  if (a.inIn && a.inStep >= 2) out.push({ k: 'ok', t: 'Селективность: вводной автомат C' + a.inIn + ' на ' + a.inStep + ' ступ. выше наибольшего группового (СН 4.04.01-2019, п. 10.5).' });
  else if (a.inIn && a.inStep === 1) out.push({ k: 'warn', t: 'Селективность: вводной автомат C' + a.inIn + ' выше группового только на одну ступень. Это допускается лишь в обоснованных случаях (СН 4.04.01-2019, п. 10.5).' });
  else if (a.inIn && a.inStep < 1) out.push({ k: 'bad', t: 'Селективность не обеспечена: вводной автомат C' + a.inIn + ' не выше группового (СН 4.04.01-2019, п. 10.5).' });
  const act = a.rows.filter(x => !x.r.empty && x.r.In);
  const kzBad = act.filter(x => x.r.len > 0 && x.r.ik < x.r.ikNeed);
  const kzNo = act.filter(x => x.r.len === 0);
  if (kzBad.length) out.push({ k: 'bad', t: 'Короткое замыкание: автомат может не отключить ' + kzBad.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ' за 0,4 с. Сократите линию.' });
  else if (act.length && !kzNo.length) out.push({ k: 'ok', t: 'Короткое замыкание в конце каждой линии отключается за 0,4 с (ТКП 339-2022, п. 4.3.5.4). Петля питающей сети ' + fmt(c.zs, 2) + ' Ом задана вами, проверьте её.' });
  else if (kzNo.length) out.push({ k: 'warn', t: 'Короткое замыкание не проверено для ' + kzNo.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ': не задана длина.' });
  return out;
}

export function Summary({ a, onBalance, solo = false }: { a: Calc; onBalance: () => void; solo?: boolean }) {
  const c = a.c;
  const pct = c.alloc > 0 ? a.P / (c.alloc * 1000) * 100 : 0;
  let ac: 'ok' | 'warn' | 'bad' = 'ok';
  let at = 'Укладывается';
  if (a.P <= 0) at = 'Нет нагрузки';
  else if (pct > 100) {
    ac = 'bad';
    at = 'Превышение на ' + fmt((a.P - c.alloc * 1000) / 1000, 1) + ' кВт';
  } else if (pct >= 90) {
    ac = 'warn';
    at = 'На пределе';
  }
  const inDev = a.inIn ? (c.supply === 3 ? '4P' : '2P') + ' C' + a.inIn : '—';
  let inCab = '—';
  if (a.inIn) inCab = a.inS ? 'ВВГнг(А)-LS ' + (c.supply === 3 ? 5 : 3) + '×' + fs(a.inS) : 'больше 35 мм²';
  const gl = a.rows.filter(x => !x.r.empty && x.r.In);
  const checks = checksOf(a);
  const problems = checks.filter(x => x.k !== 'ok').length;
  const worst: 'ok' | 'warn' | 'bad' = checks.some(x => x.k === 'bad') ? 'bad' : (problems ? 'warn' : 'ok');
  const mx = a.phases ? Math.max(a.phases.L1, a.phases.L2, a.phases.L3, 0.001) : 1;
  const cols = { L1: 'var(--l1)', L2: 'var(--l2)', L3: 'var(--l3)' };
  return (
    <div className="pane-sum">
      <section className="card c-total">
        <div className="card-head"><h2>Итого по квартире</h2></div>
        <div className="kvs">
          <Kv l="Установлено" v={fmt(a.sumInst / 1000, 1) + ' кВт'} />
          <Kv l="Расчётная" v={fmt(a.P / 1000, 1) + ' кВт'} />
          <Kv l={c.supply === 3 ? 'Макс. фаза' : 'Ток ввода'} v={fmt(a.Itot, 0) + ' А'} />
        </div>
        <div className="alloc">
          <div className="alloc-top">
            <span className="lbl">Выделено {fmt(c.alloc, 1)} кВт</span>
            <span className={'pill ' + ac}>{at}</span>
          </div>
          <div className="meter" role="img" aria-label={'Загрузка выделенной мощности ' + Math.round(pct) + ' %'}>
            <i className={ac === 'ok' ? '' : ac} style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} />
          </div>
        </div>
        <dl className="dl">
          <dt>Вводной автомат</dt>
          <dd>{inDev}</dd>
          <dt>Вводной кабель</dt>
          <dd>{inCab}</dd>
        </dl>
      </section>
      {checks.length > 0 && (
        <Fold title="Проверки по нормам" className="c-checks" open={solo || worst !== 'ok'} badge={<span className={'pill ' + worst}>{worst === 'ok' ? 'Всё в норме' : problems + ' ' + plural(problems, ['замечание', 'замечания', 'замечаний'])}</span>}>
          <ul className="chk">
            {checks.map((x, i) => (
              <li key={i} className={x.k}>{x.t}</li>
            ))}
          </ul>
        </Fold>
      )}
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
      {gl.length > 0 && (
        <Fold title="Запас автоматов" className="c-reserve" open={solo}>
          <Tip>Какую часть номинала автомата занимает ток группы.</Tip>
          <div className="gl">
            {gl.map(x => {
              const u = x.r.I / (x.r.In as number) * 100;
              const cl = u > 100 ? 'bad' : (u > 80 ? 'warn' : '');
              return (
                <div className="gl-r" key={x.l.id}>
                  <span className="no">Г{a.rows.indexOf(x) + 1}</span>
                  <span className="gl-name">{x.l.name || 'Без названия'}</span>
                  <b>{fmt(x.r.I, 1)} из {x.r.In} А</b>
                  <div className="gl-bar" role="img" aria-label={'Загрузка автомата ' + Math.round(u) + ' %'}>
                    <i className={cl} style={{ width: Math.min(100, u) + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Fold>
      )}
    </div>
  );
}

export function PanelPane({ a, solo = false, onPick, onMove }: { a: Calc; solo?: boolean; onPick?: (id: string) => void; onMove?: (id: string, to: string) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const c = a.c;
  const free = Math.max(0, a.size - a.placed);
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
          <div className="rail" data-rc={ROWLEN[a.size]} style={{ ['--rc' as string]: ROWLEN[a.size] }}>
            {a.devs.map((d, i) => {
              const cls = 'dev dev-' + d.kind + (d.st ? ' st-' + d.st : '') + (d.lid && drag === d.lid ? ' drag' : '') + (d.lid && over === d.lid && drag !== d.lid ? ' over' : '');
              const style = { gridColumn: 'span ' + d.mod, ['--i' as string]: i };
              if (!d.lid) {
                return (
                  <div key={'in' + i} className={cls} style={style} title={d.title}>
                    <b>{d.label}</b>
                    <i>{d.sub}</i>
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
                  title={d.title}
                  aria-label={d.title + ', ' + d.label + '. Открыть группу. Alt и стрелки меняют порядок'}
                  data-ph={d.ph}
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
                </button>
              );
            })}
            {Array.from({ length: free }, (_, i) => (
              <div key={'f' + i} className="dev dev-free" title="Резерв" />
            ))}
          </div>
        </div>
        <div className="legend">
          <span><i className="dev-in" />Ввод</span>
          <span><i className="dev-rcd" />Дифавтомат</span>
          <span><i className="dev-mcb" style={{ border: '1px solid var(--ink-2)' }} />Автомат</span>
          <span><i className="dev-free" style={{ border: '1px dashed var(--ink-2)' }} />Резерв</span>
          <Tip label="Как пользоваться щитком">Нажмите на модуль, чтобы открыть группу. Перетащите его или нажмите Alt и стрелку, чтобы поменять порядок. Цвет рычажка показывает статус группы.</Tip>
        </div>
      </Fold>
      <Fold title="Состав щитка" className="c-sched" open={solo}>
        <div className="sc">
          {a.devs.map((d, i) => {
            const g = d.kind === 'in' ? '' : d.sub.split(' ')[0];
            return (
              <div className="sc-r" key={i}>
                <span className="no">{d.kind === 'in' ? 'Ввод' : g}</span>
                <span className="sc-name">{d.kind === 'in' ? 'Вводной автомат' : nameOf[g]}</span>
                <b>{d.label}</b>
                <span className="sc-sub">{d.kind === 'rcd' ? 'дифавтомат ' + d.ma + ' мА' : (d.kind === 'in' ? (c.supply === 3 ? '4 полюса' : '2 полюса') : 'автомат')}</span>
                <span className="sc-m">{d.mod} мод.</span>
              </div>
            );
          })}
        </div>
      </Fold>
    </div>
  );
}
