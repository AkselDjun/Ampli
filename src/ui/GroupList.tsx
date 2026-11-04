import { Fragment, useEffect, useRef, useState } from 'react';
import type { Calc, CfgN, LineType, Project, Row } from '../core/types';
import { NB, fmt, fs, plural } from '../core/format';
import { STATUS, TYPES } from '../core/norms';
import { fixFor } from '../core/fixes';
import type { FixAct } from '../core/fixes';
import { IconBolt, IconBulb, IconChev, IconCopy, IconFolder, IconNet, IconRooms, IconSocket, IconTrash, IconWire } from './Icons';
import { useByRoom } from './prefs';
import { zoneOf } from '../core/calc';
import { ArmButton } from './common';
import { AddMenu } from './AddMenu';
import { FixBar } from './FixBar';
import { useSwipe } from './swipe';

const TYPE_IC: Record<LineType, JSX.Element> = { light: <IconBulb />, socket: <IconSocket />, power: <IconBolt /> };

function rowSub(x: Row, three: boolean): string[] {
  const { l, r } = x;
  const parts: string[] = [];
  if (three) parts.push(r.three ? '3Ф' : l.phase);
  if (r.empty) parts.push('нет приборов');
  else {
    parts.push(fmt(r.pd, 0) + NB + 'Вт');
    parts.push(fmt(r.I, 1) + NB + 'А');
    if (r.S) parts.push(fs(r.S) + NB + 'мм²');
  }
  return parts;
}

function GroupRow({
  x, i, c, three, sel, hot, onHot, onSelect, onCopy, onDelete, onFix
}: {
  hot: boolean;
  onHot: (id: string | null) => void;
  x: Row;
  c: CfgN;
  i: number;
  three: boolean;
  sel: boolean;
  onSelect: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onFix: (id: string, act: FixAct) => void;
}) {
  const { dx, handlers } = useSwipe(() => onDelete(x.l.id), () => onCopy(x.l.id));
  const fix = fixFor(x.l, x.r, c);
  return (
    <div className={'row-wrap' + (dx > 0 ? ' sw-r' : (dx < 0 ? ' sw-l' : ''))}>
      <div className="swipe-bg" aria-hidden="true">
        <span className="sw-copy">Копия</span>
        <span className="sw-del">Удалить</span>
      </div>
      <button
        className={'row' + (sel ? ' sel' : '') + (hot ? ' hot' : '')}
        type="button"
        onMouseEnter={() => onHot(x.l.id)}
        onMouseLeave={() => onHot(null)}
        style={dx ? { transform: 'translateX(' + dx + 'px)', transition: 'none' } : undefined}
        onClick={() => onSelect(x.l.id)}
        aria-keyshortcuts="Control+D Delete"
        onKeyDown={e => {
          if (e.key === 'Delete') {
            e.preventDefault();
            onDelete(x.l.id);
          } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'в')) {
            e.preventDefault();
            onCopy(x.l.id);
          }
        }}
        {...handlers}
      >
        <span className="no">Г{i + 1}</span>
        <span className="row-main">
          <span className="row-name">{x.l.name || 'Без названия'}</span>
          <span className="row-sub"><span className="row-ty" data-t={x.l.type}>{TYPE_IC[x.l.type]}<span className="vh">{TYPES[x.l.type].short}</span></span>{rowSub(x, three).map((t, k) => <span key={k}>{t}</span>)}</span>
        </span>
        <span className="row-end">
          {x.r.status !== 'ok' && !x.r.empty && (
            <span className={'flag ' + x.r.status} data-tip={STATUS[x.r.status]} aria-label={STATUS[x.r.status]}>!</span>
          )}
          {x.r.In && <span className={'brk' + (x.r.rcbo ? ' rcd' : '')}>{x.r.curve}{x.r.In}</span>}
        </span>
        <IconChev className="chev" />
      </button>
      <div className="row-act">
        <button type="button" className="ra-b" tabIndex={-1} aria-label={'Копировать группу Г' + (i + 1)} data-tip="Копировать (Ctrl+D)" onClick={() => onCopy(x.l.id)}><IconCopy /></button>
        <button type="button" className="ra-b del" tabIndex={-1} aria-label={'Удалить группу Г' + (i + 1)} data-tip="Удалить (Delete)" onClick={() => onDelete(x.l.id)}><IconTrash /></button>
      </div>
      {fix && <FixBar fix={fix} onApply={() => fix.act && onFix(x.l.id, fix.act)} />}
    </div>
  );
}

export function GroupList({
  p, a, sel, onSelect, onAdd, onOpenProj, onOpenNet, onOpenOld, oldLabel, hot = null, onHot = () => undefined, onSample, onRooms, onBlank, onCopy, onDelete, onFix
}: {
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onFix: (id: string, act: FixAct) => void;
  p: Project;
  a: Calc;
  sel: string | null;
  onSelect: (id: string) => void;
  onAdd: (t: LineType) => void;
  onOpenProj: () => void;
  onOpenNet: () => void;
  onOpenOld: () => void;
  oldLabel: string;
  hot?: string | null;
  onHot?: (id: string | null) => void;
  onRooms: () => void;
  onBlank: () => void;
  onSample?: () => void;
}) {
  const c = a.c;
  const three = c.supply === 3;
  const count = p.lines.length;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = document.querySelector('.col-list .row.sel');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [count]);
  const sub: string[] = [];
  if (p.address) sub.push(p.address);
  sub.push(count + ' ' + plural(count, ['группа', 'группы', 'групп']));
  const [byRoom, setByRoom] = useByRoom();
  const groups: { zone: string | null; items: number[] }[] = [];
  if (byRoom && count > 1) {
    a.rows.forEach((x, i) => {
      const z = zoneOf(x.l);
      const g = groups.find(y => y.zone === z);
      if (g) g.items.push(i);
      else groups.push({ zone: z, items: [i] });
    });
    groups.sort((p, q) => Number(p.zone === 'Без помещения') - Number(q.zone === 'Без помещения'));
  } else groups.push({ zone: null, items: a.rows.map((_, i) => i) });
  const [shut, setShut] = useState<string[]>([]);
  const selZone = byRoom ? (() => { const x = a.rows.find(y => y.l.id === sel); return x ? zoneOf(x.l) : null; })() : null;
  useEffect(() => {
    if (selZone) setShut(v => (v.includes(selZone) ? v.filter(z => z !== selZone) : v));
  }, [sel, selZone]);
  const flip = (z: string) => setShut(v => (v.includes(z) ? v.filter(y => y !== z) : [...v, z]));
  const net: [string, string][] = [
    ['Питание', three ? '3 фазы, 400 В' : '1 фаза, 230 В'],
    ['Прокладка', c.method === 'wall' ? 'Скрытая' : 'Открытая'],
    ['Защита', c.rcdMode ? 'УЗО на помещение' : 'дифавтоматы'],
    ['Выделено', fmt(c.alloc, 1) + ' кВт'],
    ...(c.vr ? [['Реле', 'реле напряжения'] as [string, string]] : []),
    ...(c.spd ? [['УЗИП', 'УЗИП'] as [string, string]] : [])
  ];
  return (
    <section className="col col-list" id="groups" tabIndex={-1} aria-label="Группы линий">
      <div className="proj-box">
        <button className="projbar" type="button" onClick={onOpenProj} aria-label="Проекты">
          <IconFolder />
          <span className="pb-main">
            <span className="pb-name">{p.name || 'Без названия'}</span>
            <span className="pb-sub">{sub.join(' · ')}</span>
          </span>
          <span className="pb-more">Проекты</span>
        </button>
        <div className="netchips">
          <button className="netfold" type="button" aria-label="Параметры сети" onClick={onOpenNet}>
            <IconNet />
            <span className="nf-main">Параметры сети<small>{net.map(t => t[1]).join(', ')}</small></span>
            <IconChev className="chev" />
          </button>
          {oldLabel && (
            <button className="netfold" type="button" aria-label={'Старая проводка: ' + oldLabel} onClick={onOpenOld}>
              <IconWire />
              <span className="nf-main">Старая проводка<small>{oldLabel}</small></span>
              <IconChev className="chev" />
            </button>
          )}
        </div>
      </div>
      {p.sample && (
        <div className="sample">
          Пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.{' '}
          <ArmButton className="link js-blank" label="Начать с нуля" onRun={onBlank} />
        </div>
      )}
      <div className="list-head">
        <h2>Группы линий</h2>
        <span className="hist">
          {count > 1 && (
            <button className={'lv-t' + (byRoom ? ' on' : '')} type="button" aria-pressed={byRoom} data-tip="Сгруппировать по помещениям" onClick={() => setByRoom(!byRoom)}>
              <IconRooms />
              <span>По помещениям</span>
            </button>
          )}
          <span className="count">{count ? count + ' шт.' : ''}</span>
        </span>
      </div>
      <AddMenu down onAdd={onAdd} onRooms={onRooms} />
      <div className="rows">
        {count ? (
          groups.map((g, gi) => (
            <Fragment key={g.zone ?? '-'}>
              {g.zone !== null && (() => {
                const z = g.zone;
                const closed = shut.includes(z);
                const worst = g.items.some(k => !a.rows[k].r.empty && a.rows[k].r.status === 'bad') ? 'bad' : (g.items.some(k => !a.rows[k].r.empty && a.rows[k].r.status === 'warn') ? 'warn' : '');
                const bid = 'zone-' + gi;
                return (
                  <>
                    <h3 className={'zone-h' + (closed ? ' shut' : '')}>
                      <button type="button" aria-expanded={!closed} aria-controls={bid} onClick={() => flip(z)}>
                        <IconChev className="zone-chev" />
                        <b>{z}</b>
                        {worst && <span className={'flag ' + worst} aria-label={STATUS[worst]}>!</span>}
                        <small>{g.items.length + ' ' + plural(g.items.length, ['группа', 'группы', 'групп']) + ' · ' + fmt(g.items.reduce((t, k) => t + a.rows[k].r.pd, 0) / 1000, 1) + NB + 'кВт'}</small>
                        {closed && <span className="zone-brk" aria-hidden="true">{g.items.filter(k => a.rows[k].r.In).map(k => <i key={k} className={a.rows[k].r.rcbo ? 'rcd' : ''}>{a.rows[k].r.curve}{a.rows[k].r.In}</i>)}</span>}
                      </button>
                    </h3>
                    <div className="zone-b" id={bid} hidden={closed}>
                      {g.items.map(i => {
                        const x = a.rows[i];
                        return <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} hot={x.l.id === hot} onHot={onHot} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} />;
                      })}
                    </div>
                  </>
                );
              })()}
              {g.zone === null && g.items.map(i => {
                const x = a.rows[i];
                return <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} hot={x.l.id === hot} onHot={onHot} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} />;
              })}
            </Fragment>
          ))
        ) : (
          <div className="start">
            <h3 className="start-t">С чего начать</h3>
            <button className="start-b main" type="button" onClick={onRooms}>
              <span className="start-ic"><IconRooms /></span>
              <span className="start-tx"><b>Собрать по комнатам</b><small>Отметьте помещения, группы и приборы появятся сами</small></span>
            </button>
            <div className="start-row" role="group" aria-label="Добавить группу вручную">
              <span className="start-l">Или добавьте группу:</span>
              {(['light', 'socket', 'power'] as LineType[]).map(t => (
                <button key={t} className="start-ty" type="button" data-t={t} onClick={() => onAdd(t)}>{TYPE_IC[t]}{TYPES[t].short}</button>
              ))}
            </div>
            {onSample && <button className="link start-s" type="button" onClick={onSample}>Посмотреть на примере двухкомнатной квартиры</button>}
          </div>
        )}
      </div>
      <AddMenu fab onAdd={onAdd} onRooms={onRooms} />
    </section>
  );
}
