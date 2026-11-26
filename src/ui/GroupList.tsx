import type { JSX } from 'react';
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Calc, CfgN, LineType, Project, Row } from '../core/types';
import { NB, fmt, fs, plural } from '../core/format';
import { STATUS, TYPES } from '../core/norms';
import { fixFor } from '../core/fixes';
import type { FixAct } from '../core/fixes';
import { IconBolt, IconBulb, IconChev, IconCopy, IconFolder, IconHeat, IconLan, IconNet, IconRooms, IconSocket, IconTrash, IconWire } from './Icons';
import { floorSummary } from '../core/floor';
import { weakSummary } from '../core/weak';
import { roomGroups } from '../core/zonelist';
import type { ZoneGroup } from '../core/zonelist';
import { listCounts, listView } from '../core/listview';
import type { ListFilter, ListSort } from '../core/listview';
import { BulkBar, ListBar } from './ListBar';
import { ArmButton } from './common';
import { AddMenu } from './AddMenu';
import { FixBar } from './FixBar';
import { useSwipe } from './swipe';
import { same } from './hold';

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

type RowProps = {
  tour?: boolean;
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
  picked?: boolean;
  onPick?: (id: string) => void;
};

const sameRow = (a: RowProps, b: RowProps): boolean =>
  a.i === b.i && a.three === b.three && a.sel === b.sel && a.hot === b.hot && a.tour === b.tour && a.onHot === b.onHot && a.onSelect === b.onSelect && a.onCopy === b.onCopy && a.onDelete === b.onDelete && a.onFix === b.onFix && a.picked === b.picked && a.onPick === b.onPick && a.x.l === b.x.l && same(a.x.r, b.x.r) && same(a.c, b.c);

const GroupRow = memo(function GroupRow({
  x, i, c, three, sel, hot, tour, onHot, onSelect, onCopy, onDelete, onFix, picked, onPick
}: RowProps) {
  const picking = picked !== undefined && !!onPick;
  const { dx, handlers } = useSwipe(() => onDelete(x.l.id), () => onCopy(x.l.id));
  const fix = fixFor(x.l, x.r, c);
  return (
    <div className={'row-wrap' + (dx > 0 ? ' sw-r' : (dx < 0 ? ' sw-l' : ''))} data-tour={tour ? 'group' : undefined}>
      <div className="swipe-bg" aria-hidden="true">
        <span className="sw-copy">Копия</span>
        <span className="sw-del">Удалить</span>
      </div>
      <button
        className={'row' + (sel && !picking ? ' sel' : '') + (hot ? ' hot' : '') + (picking ? ' picking' : '') + (picked ? ' picked' : '')}
        type="button"
        aria-pressed={picking ? picked : undefined}
        onMouseEnter={() => onHot(x.l.id)}
        onMouseLeave={() => onHot(null)}
        style={dx ? { transform: 'translateX(' + dx + 'px)', transition: 'none' } : undefined}
        onClick={() => (picking ? onPick(x.l.id) : onSelect(x.l.id))}
        aria-keyshortcuts="Control+D Delete"
        onKeyDown={e => {
          if (e.key === 'Delete') {
            e.preventDefault();
            const gone = e.currentTarget;
            const all = Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
            const at = all.indexOf(gone);
            const next = all[at + 1] ?? all[at - 1];
            onDelete(x.l.id);
            let tries = 10;
            const land = () => {
              if (gone.isConnected && --tries > 0) {
                requestAnimationFrame(land);
                return;
              }
              const now = Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
              (next?.isConnected ? next : now[Math.min(at, now.length - 1)] ?? document.querySelector<HTMLElement>('.list-head h2'))?.focus();
            };
            requestAnimationFrame(land);
          } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'в')) {
            e.preventDefault();
            onCopy(x.l.id);
          }
        }}
        {...handlers}
      >
        {picking && <span className={'row-cb' + (picked ? ' on' : '')} aria-hidden="true" />}
        <span className="no" data-t={x.l.type}>Г{i + 1}</span>
        <span className="row-main">
          <span className="row-name">{x.l.name || 'Без названия'}</span>
          <span className="row-sub"><span className="row-ty" data-t={x.l.type}>{TYPE_IC[x.l.type]}<span className="vh">{TYPES[x.l.type].short}</span></span>{rowSub(x, three).map((t, k) => <span key={k}>{t}</span>)}</span>
        </span>
        <span className="row-end">
          {x.r.status !== 'ok' && !x.r.empty && (
            <span className={'flag ' + x.r.status} data-tip={STATUS[x.r.status]} aria-label={STATUS[x.r.status]}>!</span>
          )}
          {x.r.In && (() => {
            const load = Math.round(x.r.I / x.r.In * 100);
            const tip = 'Загрузка автомата ' + load + ' %' + (x.r.rcd ? (x.r.rcbo ? ', дифавтомат ' : ', УЗО «' + x.r.zone + '» ') + x.r.ma + ' мА' : '');
            return (
              <span className={'brk' + (x.r.rcbo ? ' rcd' : '')} data-tip={tip}>
                {x.r.curve}{x.r.In}
                <i className={'brk-load' + (load > 90 ? ' warn' : '')} aria-hidden="true"><i style={{ width: Math.min(100, load) + '%' }} /></i>
              </span>
            );
          })()}
        </span>
        <IconChev className="chev" />
      </button>
      <div className="row-act">
        <button type="button" className="ra-b" tabIndex={-1} aria-label={'Копировать группу Г' + (i + 1)} data-tip="Копировать (Ctrl+D)" onClick={() => onCopy(x.l.id)}><IconCopy /></button>
        <button type="button" className="ra-b del" tabIndex={-1} aria-label={'Удалить группу Г' + (i + 1)} data-tip="Удалить (Delete)" onClick={() => onDelete(x.l.id)}><IconTrash /></button>
      </div>
      {fix && !picking && <FixBar fix={fix} bad={x.r.status === 'bad'} onApply={() => fix.act && onFix(x.l.id, fix.act)} />}
    </div>
  );
}, sameRow);

export const GroupList = memo(function GroupList({
  p, a, sel, onSelect, onAdd, onBulkZone = () => undefined, onBulkCopy = () => undefined, onBulkDelete = () => undefined, onOpenProj, onOpenNet, onOpenOld, onOpenFloor = () => undefined, onOpenWeak = () => undefined, oldLabel, hot = null, onHot = () => undefined, onSample, onRooms, onBlank, onCopy, onDelete, onFix, onRenumber = () => undefined
}: {
  onRenumber?: () => void;
  onBulkZone?: (ids: string[], zone: string) => void;
  onBulkCopy?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
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
  onOpenFloor?: () => void;
  onOpenWeak?: () => void;
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
  const zoned = roomGroups(a.rows.map(x => x.l));
  const base: ZoneGroup[] = zoned.length > 1 ? zoned : [{ zone: null, items: a.rows.map((_, i) => i) }];
  const jumbled = base.flatMap(g => g.items).some((k, j) => k !== j);
  const [filter, setFilter] = useState<ListFilter | null>(null);
  const [sort, setSort] = useState<ListSort>('no');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const live = picked.filter(id => p.lines.some(l => l.id === id));
  const groups = filter || sort !== 'no' ? listView(a.rows, filter, sort) : base;
  const cnt = listCounts(a.rows);
  const zones = [...new Set(p.lines.map(l => (l.zone ?? '').trim()).filter(Boolean))];
  const togglePick = useCallback((id: string) => setPicked(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id])), []);
  const stopPick = () => {
    setPicking(false);
    setPicked([]);
  };
  const uzoOf = (z: string) => a.uzos.find(u => u.zone.toLowerCase() === z.toLowerCase());
  const [shut, setShut] = useState<string[]>([]);
  const selZone = groups.find(g => g.zone !== null && g.items.some(k => a.rows[k].l.id === sel))?.zone ?? null;
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
    ...(c.spd ? [['УЗИП', 'УЗИП'] as [string, string]] : []),
    ...(c.afdd !== 'off' ? [['УЗДП', c.afdd === 'sock' ? 'УЗДП на розетки' : 'УЗДП на группы'] as [string, string]] : [])
  ];
  return (
    <section className="col col-list" id="groups" tabIndex={-1} aria-label="Группы линий" onKeyDown={e => { if (picking && e.key === 'Escape' && !e.defaultPrevented) stopPick(); }}>
      <div className="proj-box">
        <button className="projbar" type="button" onClick={onOpenProj} data-tour="projects">
          <span className="vh">Проекты: </span>
          <IconFolder />
          <span className="pb-main">
            <span className="pb-name">{p.name || 'Без названия'}</span>
            <span className="pb-sub">{sub.join(' · ')}</span>
          </span>
          <span className="pb-more">Проекты</span>
        </button>
        <div className="netchips" data-tour="network">
          <button className="netfold" type="button" onClick={onOpenNet}>
            <IconNet />
            <span className="nf-main">Параметры сети<span className="vh">: </span><small>{net.map(t => t[1]).join(', ')}</small></span>
            <IconChev className="chev" />
          </button>
          {oldLabel && (
            <button className="netfold" type="button" onClick={onOpenOld}>
              <IconWire />
              <span className="nf-main">Старая проводка<span className="vh">: </span><small>{oldLabel}</small></span>
              <IconChev className="chev" />
            </button>
          )}
          {(floorSummary(p.floor) || weakSummary(p.weak)) && (
            <div className="nf-pair">
              {floorSummary(p.floor) && (
                <button className="netfold" type="button" onClick={onOpenFloor}>
                  <IconHeat />
                  <span className="nf-main">Тёплый пол<span className="vh">: </span><small>{floorSummary(p.floor)}</small></span>
                  <IconChev className="chev" />
                </button>
              )}
              {weakSummary(p.weak) && (
                <button className="netfold" type="button" onClick={onOpenWeak}>
                  <IconLan />
                  <span className="nf-main">Слаботочка<span className="vh">: </span><small>{weakSummary(p.weak)}</small></span>
                  <IconChev className="chev" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {p.sample && (
        <div className="sample">
          Пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.{' '}
          <ArmButton link className="js-blank" label="Начать с нуля" onRun={onBlank} />
        </div>
      )}
      <div className="list-head">
        <h2>Группы линий</h2>
        <span className="hist">
          {jumbled && (
            <button className="lv-link" type="button" data-tip="Номера групп пойдут подряд по помещениям, как на щитке" onClick={onRenumber}>
              <span>Номера по порядку</span>
            </button>
          )}
        </span>
        {count > 0 && !picking && (
          <ListBar
            chips={[{ id: 'bad', label: 'Нарушения', n: cnt.bad }, { id: 'warn', label: 'Советы', n: cnt.warn }]}
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onSort={setSort}
            onPick={() => setPicking(true)}
          />
        )}
      </div>
      <AddMenu down onAdd={onAdd} onRooms={onRooms} onFloor={onOpenFloor} onWeak={onOpenWeak} />
      {count > 0 && picking && (
        <BulkBar
          n={live.length}
          zones={zones}
          onZone={z => { onBulkZone(live, z); stopPick(); }}
          onCopy={() => { onBulkCopy(live); stopPick(); }}
          onDelete={() => { onBulkDelete(live); stopPick(); }}
          onDone={stopPick}
        />
      )}
      <div className="rows">
        {count && !groups.length ? (
          <div className="rows-none">
            <p>Нет групп с таким отбором.</p>
            <button type="button" className="link" onClick={() => setFilter(null)}>Показать все группы</button>
          </div>
        ) : count ? (
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
                        <small>{(() => {
                          const u = uzoOf(z);
                          const parts = [g.items.length + ' ' + plural(g.items.length, ['группа', 'группы', 'групп'])];
                          if (u) parts.push('УЗО ' + u.In + NB + 'А · ' + u.ma + NB + 'мА' + (u.typeA ? ' · тип A' : ''));
                          parts.push(fmt(g.items.reduce((t, k) => t + a.rows[k].r.pd, 0) / 1000, 1) + NB + 'кВт');
                          return parts.join(' · ');
                        })()}</small>
                        {closed && <span className="zone-brk" aria-hidden="true">{g.items.filter(k => a.rows[k].r.In).map(k => <i key={k} className={a.rows[k].r.rcbo ? 'rcd' : ''}>{a.rows[k].r.curve}{a.rows[k].r.In}</i>)}</span>}
                      </button>
                    </h3>
                    <div className="zone-b" id={bid} hidden={closed}>
                      {g.items.map(i => {
                        const x = a.rows[i];
                        return <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} hot={x.l.id === hot} tour={i === 0} onHot={onHot} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} picked={picking ? live.includes(x.l.id) : undefined} onPick={togglePick} />;
                      })}
                    </div>
                  </>
                );
              })()}
              {g.zone === null && g.items.map(i => {
                const x = a.rows[i];
                return <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} hot={x.l.id === hot} tour={i === 0} onHot={onHot} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} picked={picking ? live.includes(x.l.id) : undefined} onPick={togglePick} />;
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
      <AddMenu fab onAdd={onAdd} onRooms={onRooms} onFloor={onOpenFloor} onWeak={onOpenWeak} />
    </section>
  );
});
