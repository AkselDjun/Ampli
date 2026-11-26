import type { JSX } from 'react';
import { Fragment, Suspense, memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Calc, CfgN, LineType, Project, Row } from '../core/types';
import { NB, fmt, fs, plural } from '../core/format';
import { STATUS, TYPES } from '../core/norms';
import type { FixAct } from '../core/fixes';
import { IconBolt, IconBulb, IconChev, IconCopy, IconDown, IconHeat, IconLan, IconNote, IconRooms, IconSocket, IconStBad, IconStOk, IconStWarn, IconTrash, IconWire } from './Icons';
import { changedIds } from '../core/sent';
import { openNotes } from '../core/notes';
import { stageOf } from '../core/stage';
import type { StageAct } from '../core/stage';
import { whenLabel } from '../core/recent';
import { BulkBar, HomeSum, PanelPane, RowPeek, StageBar } from './parts';
import { MenuButton } from './MenuButton';
import type { CheckFix } from './Checks';
import { lineChanges } from '../core/sent';
import { mediaMatches } from './media';
import { useNow } from './now';
import { floorSummary } from '../core/floor';
import { weakSummary } from '../core/weak';
import { roomGroups } from '../core/zonelist';
import type { ZoneGroup } from '../core/zonelist';
import { listCounts, listView } from '../core/listview';
import type { ListFilter, ListSort } from '../core/listview';
import { ListBar } from './ListBar';
import { ArmButton } from './common';
import { AddMenu } from './AddMenu';
import { useSwipe } from './swipe';
import { same } from './hold';

const TYPE_IC: Record<LineType, JSX.Element> = { light: <IconBulb />, socket: <IconSocket />, power: <IconBolt /> };
const ST_IC = { ok: <IconStOk />, warn: <IconStWarn />, bad: <IconStBad /> };

export const no2 = (i: number): string => String(i + 1).padStart(2, '0');

function rowMeta(x: Row, three: boolean): string {
  const { l, r } = x;
  if (r.empty) return 'нет приборов';
  const parts: string[] = [];
  if (three) parts.push(r.three ? '3Ф' : l.phase);
  if (r.In) parts.push(r.curve + r.In);
  if (r.S) parts.push(fs(r.S) + NB + 'мм²');
  parts.push(fmt(r.len, 0) + NB + 'м');
  return parts.join(' · ');
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
  chg?: boolean;
  notes?: number;
};

const sameRow = (a: RowProps, b: RowProps): boolean =>
  a.i === b.i && a.three === b.three && a.sel === b.sel && a.hot === b.hot && a.tour === b.tour && a.onHot === b.onHot && a.onSelect === b.onSelect && a.onCopy === b.onCopy && a.onDelete === b.onDelete && a.onFix === b.onFix && a.picked === b.picked && a.onPick === b.onPick && a.chg === b.chg && a.notes === b.notes && a.x.l === b.x.l && same(a.x.r, b.x.r) && same(a.c, b.c);

const GroupRow = memo(function GroupRow({
  x, i, three, sel, hot, tour, onHot, onSelect, onCopy, onDelete, picked, onPick, chg, notes
}: RowProps) {
  const picking = picked !== undefined && !!onPick;
  const { dx, handlers } = useSwipe(() => onDelete(x.l.id), () => onCopy(x.l.id));
  const st = x.r.empty ? 'ok' : x.r.status;
  const load = x.r.In ? Math.round(x.r.I / x.r.In * 100) : null;
  return (
    <div className={'row-wrap' + (dx > 0 ? ' sw-r' : (dx < 0 ? ' sw-l' : ''))} data-tour={tour ? 'group' : undefined}>
      <div className="swipe-bg" aria-hidden="true">
        <span className="sw-copy">Копия</span>
        <span className="sw-del">Удалить</span>
      </div>
      <button
        className={'row' + (sel && !picking ? ' sel' : '') + (hot ? ' hot' : '') + (picking ? ' picking' : '') + (picked ? ' picked' : '')}
        type="button"
        data-id={x.l.id}
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
        <span className="no" data-t={x.l.type}><span className="vh">Группа </span>{no2(i)}<span className="vh">, {TYPES[x.l.type].short}</span></span>
        <span className="row-main">
          <span className="row-name">{x.l.name || 'Без названия'}</span>
          <span className="row-sub">
            <span className="row-meta mono">{rowMeta(x, three)}{!x.r.empty && <span className="row-du-s"> · ΔU {fmt(x.r.drop, 1)}{NB}%</span>}</span>
            {chg && <span className="row-mk chg" data-tip="Изменено после отправки сметы">изменено<span className="vh"> после отправки сметы</span></span>}
            {!!notes && <span className="row-mk note" data-tip={'Заметки: ' + notes}><IconNote /><b>{notes}</b><span className="vh"> {plural(notes, ['заметка', 'заметки', 'заметок'])}</span></span>}
          </span>
          {!x.r.empty && load !== null && <span className="row-bar" aria-hidden="true"><i className={load > 90 ? 'hot' : undefined} style={{ width: Math.min(100, load) + '%' }} /></span>}
        </span>
        <span className="row-p mono">{x.r.empty ? '—' : fmt(x.r.pd, 0)}<span className="vh"> Вт</span></span>
        <span className="row-i mono">
          {x.r.empty ? '—' : fmt(x.r.I, 1)}<span className="row-u">{NB}А</span>
          {!x.r.empty && load !== null && <span className="row-bar" aria-hidden="true"><i className={load > 90 ? 'hot' : undefined} style={{ width: Math.min(100, load) + '%' }} /></span>}
          {load !== null && <span className="vh">, загрузка автомата {load} %</span>}
        </span>
        <span className="row-du mono"><span className={x.r.drop > x.r.limit ? 'bad' : undefined}>{x.r.empty ? '—' : fmt(x.r.drop, 1)}</span><span className="vh"> % потери напряжения</span></span>
        <span className={'st ' + st} data-tip={STATUS[st]}>{x.r.empty ? null : ST_IC[st]}<span className="vh">{x.r.empty ? '' : ', ' + STATUS[st]}</span></span>
      </button>
      <div className="row-act">
        <button type="button" className="ra-b" tabIndex={-1} aria-label={'Копировать группу ' + no2(i)} data-tip="Копировать (Ctrl+D)" onClick={() => onCopy(x.l.id)}><IconCopy /></button>
        <button type="button" className="ra-b del" tabIndex={-1} aria-label={'Удалить группу ' + no2(i)} data-tip="Удалить (Delete)" onClick={() => onDelete(x.l.id)}><IconTrash /></button>
      </div>
    </div>
  );
}, sameRow);

export const GroupList = memo(function GroupList({
  p, a, sel, onSelect, onAdd, onPanel = () => undefined, onCheckFix = () => undefined, onStage = () => undefined, onStageAct = () => undefined, onBulkZone = () => undefined, onBulkCopy = () => undefined, onBulkDelete = () => undefined, onOpenNet, onOpenOld, onOpenFloor = () => undefined, onOpenWeak = () => undefined, oldLabel, hot = null, onHot = () => undefined, onSample, onRooms, onBlank, onCopy, onDelete, onFix, onRenumber = () => undefined
}: {
  onRenumber?: () => void;
  onPanel?: () => void;
  onCheckFix?: (f: CheckFix) => void;
  onStage?: (n: number) => void;
  onStageAct?: (a: StageAct) => void;
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
  const now = useNow();
  const [peek, setPeek] = useState<{ id: string; top: number; left: number } | null>(null);
  const peekT = useRef(0);
  useEffect(() => () => window.clearTimeout(peekT.current), []);
  const peekOver = (e: { target: EventTarget }) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.row[data-id]');
    const id = el?.dataset.id;
    if (!el || !id || peek?.id === id) return;
    window.clearTimeout(peekT.current);
    setPeek(null);
    if (!mediaMatches('(hover: hover) and (pointer: fine) and (min-width: 1000px)')) return;
    peekT.current = window.setTimeout(() => {
      if (!el.isConnected || !el.matches(':hover')) return;
      const b = el.getBoundingClientRect();
      setPeek({ id, top: Math.max(64, Math.min(b.top, window.innerHeight - 280)), left: b.right + 12 });
    }, 450);
  };
  useEffect(() => {
    if (!peek) return;
    const off = () => setPeek(null);
    window.addEventListener('scroll', off, { passive: true });
    return () => window.removeEventListener('scroll', off);
  }, [peek]);
  const peekOut = () => {
    window.clearTimeout(peekT.current);
    setPeek(null);
  };
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
  const chg = changedIds(p.sent, a.rows);
  const noted = new Set(p.lines.filter(l => openNotes(l.notes) > 0).map(l => l.id));
  const groups = filter || sort !== 'no' ? listView(a.rows, filter, sort, { chg, note: noted }) : base;
  const cnt = listCounts(a.rows);
  const stage = stageOf(p);
  const showChg = !!p.sent && stage > 0;
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
  const [room, setRoom] = useState<string | null>(null);
  const roomKey = (z: string | null) => (z ?? '').toLowerCase();
  const rooms = zoned.length > 1 ? zoned.map(g => ({ zone: g.zone as string, n: g.items.length })) : [];
  const curRoom = room && rooms.some(r => roomKey(r.zone) === roomKey(room)) ? room : null;
  const shown = curRoom ? groups.filter(g => roomKey(g.zone) === roomKey(curRoom)) : groups;
  const zoneHead = (g: ZoneGroup, gi: number) => {
    const z = g.zone as string;
    const closed = shut.includes(z);
    const u = uzoOf(z);
    const kw = fmt(g.items.reduce((t, k) => t + a.rows[k].r.pd, 0) / 1000, 1);
    const worst = g.items.some(k => !a.rows[k].r.empty && a.rows[k].r.status === 'bad') ? 'bad' : (g.items.some(k => !a.rows[k].r.empty && a.rows[k].r.status === 'warn') ? 'warn' : '');
    return (
      <h3 className={'zone-h' + (closed ? ' shut' : '')}>
        <button type="button" aria-expanded={!closed} aria-controls={'zone-' + gi} onClick={() => flip(z)}>
          <IconChev className="zone-chev" />
          <b>{z}</b>
          <span className="cnt mono">{g.items.length}<span className="vh"> {plural(g.items.length, ['группа', 'группы', 'групп'])}</span></span>
          {worst && <span className="vh">{STATUS[worst]}</span>}
          <small className="zone-m">{u ? 'УЗО ' + u.In + NB + 'А · ' + u.ma + NB + 'мА' + (u.typeA ? ' · тип A' : '') : ''}</small>
          <small className="zone-kw mono">{kw}{NB}кВт</small>
        </button>
      </h3>
    );
  };
  const rowOf = (i: number) => {
    const x = a.rows[i];
    return <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} hot={x.l.id === hot} tour={i === 0} onHot={onHot} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} picked={picking ? live.includes(x.l.id) : undefined} onPick={togglePick} chg={showChg && chg.has(x.l.id)} notes={openNotes(x.l.notes)} />;
  };
  return (
    <section className="col col-list" id="groups" tabIndex={-1} aria-label="Группы линий" onKeyDown={e => { if (picking && e.key === 'Escape' && !e.defaultPrevented) stopPick(); }}>
      <h2 className="vh list-h" tabIndex={-1}>Группы линий</h2>
      {!p.sample && count > 0 && <Suspense fallback={<div className="stg stg-wait" aria-hidden="true" />}><StageBar n={stage} sentAt={p.sent ? whenLabel(p.sent.at, now) : undefined} onStage={onStage} onAct={onStageAct} /></Suspense>}
      {p.sample && (
        <div className="sample">
          Пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.{' '}
          <ArmButton link className="js-blank" label="Начать с нуля" onRun={onBlank} />
        </div>
      )}
      {count > 0 && <div className="home" data-tour="summary"><Suspense fallback={<div className="home-wait" aria-hidden="true" />}><HomeSum a={a} onNet={onOpenNet} onGroup={onSelect} onFix={onCheckFix} /></Suspense></div>}
      {count > 0 && <div className="home-panel"><Suspense fallback={null}><PanelPane mini a={a} sel={sel} hot={hot} onHot={onHot} onPick={onSelect} onMore={onPanel} /></Suspense></div>}
      {(oldLabel || floorSummary(p.floor) || weakSummary(p.weak)) && (
        <div className="extras">
          {oldLabel && <button className="xchip" type="button" onClick={onOpenOld}><IconWire /><span className="vh">Старая проводка: </span>{oldLabel}</button>}
          {floorSummary(p.floor) && <button className="xchip" type="button" onClick={onOpenFloor}><IconHeat /><span className="vh">Тёплый пол: </span>{floorSummary(p.floor)}</button>}
          {weakSummary(p.weak) && <button className="xchip" type="button" onClick={onOpenWeak}><IconLan /><span className="vh">Слаботочка: </span>{weakSummary(p.weak)}</button>}
        </div>
      )}
      <div className={'box lst' + (picking ? ' picking' : '')}>
        {rooms.length > 0 && (
          <div className="folders" role="group" aria-label="Помещения">
            <button type="button" className="fold" aria-pressed={!curRoom} onClick={() => setRoom(null)}>Все<span className="cnt mono">{count}</span></button>
            {rooms.map(r => (
              <button key={r.zone} type="button" className="fold" aria-pressed={roomKey(curRoom) === roomKey(r.zone)} onClick={() => setRoom(roomKey(curRoom) === roomKey(r.zone) ? null : r.zone)}>{r.zone}<span className="cnt mono">{r.n}</span></button>
            ))}
          </div>
        )}
        <div className="list-head">
          {rooms.length > 0 && (
            <MenuButton
              className="btn sm room-dd"
              label={'Помещение: ' + (curRoom ?? 'все помещения')}
              trigger={<><b>{curRoom ?? 'Все помещения'}</b><IconDown className="dd-c" /></>}
              groups={[{ id: 'rooms', items: [{ id: '*', label: 'Все помещения', mark: String(count), current: !curRoom, run: () => setRoom(null) }, ...rooms.map(r => ({ id: r.zone, label: r.zone, mark: String(r.n), current: roomKey(curRoom) === roomKey(r.zone), run: () => setRoom(r.zone) }))] }]}
            />
          )}
          {count > 0 && !picking && (
            <ListBar
              chips={[{ id: 'bad', label: 'Нарушения', n: cnt.bad }, { id: 'warn', label: 'Советы', n: cnt.warn }, { id: 'chg', label: 'Изменено', n: showChg ? chg.size : 0 }, { id: 'note', label: 'Заметки', n: noted.size }]}
              filter={filter}
              onFilter={setFilter}
              sort={sort}
              onSort={setSort}
              onPick={() => setPicking(true)}
              renumber={jumbled ? onRenumber : undefined}
            />
          )}
          <AddMenu down onAdd={onAdd} onRooms={onRooms} onFloor={onOpenFloor} onWeak={onOpenWeak} />
        </div>
        {count > 0 && picking && (
          <Suspense fallback={null}>
            <BulkBar
              n={live.length}
              zones={zones}
              onZone={z => { onBulkZone(live, z); stopPick(); }}
              onCopy={() => { onBulkCopy(live); stopPick(); }}
              onDelete={() => { onBulkDelete(live); stopPick(); }}
              onDone={stopPick}
            />
          </Suspense>
        )}
        {count > 0 && (
          <div className="lst-th" aria-hidden="true">
            <span>№</span><span>Группа</span><span>P, Вт</span><span>I, А</span><span>ΔU, %</span><span />
          </div>
        )}
        <div className="rows" onMouseOver={peekOver} onMouseLeave={peekOut} onPointerDown={peekOut} onScroll={peekOut}>
          {count && !shown.length ? (
            <div className="rows-none">
              <p>Нет групп с таким отбором.</p>
              <button type="button" className="link" onClick={() => { setFilter(null); setRoom(null); }}>Показать все группы</button>
            </div>
          ) : count ? (
            shown.map((g, gi) => (
              <Fragment key={g.zone ?? '-'}>
                {g.zone !== null && zoneHead(g, gi)}
                {g.zone !== null ? <div className="zone-b" id={'zone-' + gi} hidden={shut.includes(g.zone)}>{g.items.map(rowOf)}</div> : g.items.map(rowOf)}
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
      </div>
      {count > 0 && <p className="note lst-foot">Расчёт предварительный. ТКП 339-2022 с изм. № 1, СН 4.04.01-2019 с изм. № 1 и № 2.<span className="lst-keys"> <kbd>J</kbd> <kbd>K</kbd> по группам · <kbd>?</kbd> все клавиши</span></p>}
      {peek && !picking && peek.id !== sel && (() => {
        const k = a.rows.findIndex(y => y.l.id === peek.id);
        if (k < 0) return null;
        const x = a.rows[k];
        const since = showChg && p.sent ? lineChanges(p.sent.lines.find(y => y.id === x.l.id), x) : [];
        return <Suspense fallback={null}><RowPeek x={x} no={k + 1} top={peek.top} left={peek.left} since={since} notes={x.l.notes ?? []} /></Suspense>;
      })()}
      <AddMenu fab onAdd={onAdd} onRooms={onRooms} onFloor={onOpenFloor} onWeak={onOpenWeak} />
    </section>
  );
});
