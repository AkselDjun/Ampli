import { useEffect, useState } from 'react';
import type { Calc, CfgN, LineType, Project, Row } from '../core/types';
import { NB, fmt, fs, plural } from '../core/format';
import { STATUS, TYPES } from '../core/norms';
import { fixFor } from '../core/fixes';
import type { FixAct } from '../core/fixes';
import { IconChev, IconCopy, IconFolder, IconNet, IconTrash } from './Icons';
import { ArmButton } from './common';
import { AddMenu } from './AddMenu';
import { FixBar } from './FixBar';
import { useSwipe } from './swipe';

function rowSub(x: Row, three: boolean): string {
  const { l, r } = x;
  const parts = [TYPES[l.type].short];
  if (three) parts.push(r.three ? '3Ф' : l.phase);
  if (r.empty) parts.push('нет приборов');
  else {
    parts.push(fmt(r.pd, 0) + NB + 'Вт');
    parts.push(fmt(r.I, 1) + NB + 'А');
    if (r.S) parts.push(fs(r.S) + NB + 'мм²');
  }
  return parts.join(' · ');
}

function GroupRow({
  x, i, c, three, sel, onSelect, onCopy, onDelete, onFix
}: {
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
        className={'row' + (sel ? ' sel' : '')}
        type="button"
        style={dx ? { transform: 'translateX(' + dx + 'px)', transition: 'none' } : undefined}
        onClick={() => onSelect(x.l.id)}
        {...handlers}
      >
        <span className="no">Г{i + 1}</span>
        <span className="row-main">
          <span className="row-name">{x.l.name || 'Без названия'}</span>
          <span className="row-sub">{rowSub(x, three)}</span>
        </span>
        <span className="row-end">
          {x.r.status !== 'ok' && !x.r.empty && (
            <span className={'flag ' + x.r.status} title={STATUS[x.r.status]} aria-label={STATUS[x.r.status]}>!</span>
          )}
          {x.r.In && <span className={'brk' + (x.r.rcd ? ' rcd' : '')}>{x.r.curve}{x.r.In}</span>}
        </span>
        <IconChev className="chev" />
      </button>
      <div className="row-act">
        <button type="button" className="ra-b" aria-label={'Копировать группу Г' + (i + 1)} title="Копировать" onClick={() => onCopy(x.l.id)}><IconCopy /></button>
        <button type="button" className="ra-b del" aria-label={'Удалить группу Г' + (i + 1)} title="Удалить" onClick={() => onDelete(x.l.id)}><IconTrash /></button>
      </div>
      {fix && <FixBar fix={fix} onApply={() => fix.act && onFix(x.l.id, fix.act)} />}
    </div>
  );
}

export function GroupList({
  p, a, sel, onSelect, onAdd, onOpenProj, onOpenNet, onRooms, onBlank, canUndo, canRedo, onUndo, onRedo, onCopy, onDelete, onFix
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
  onRooms: () => void;
  onBlank: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const c = a.c;
  const three = c.supply === 3;
  const [netOpen, setNetOpen] = useState(false);
  const count = p.lines.length;
  useEffect(() => {
    const el = document.querySelector('.col-list .row.sel');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [count]);
  const sub: string[] = [];
  if (p.address) sub.push(p.address);
  sub.push(count + ' ' + plural(count, ['группа', 'группы', 'групп']));
  const net: [string, string][] = [
    ['Питание', three ? '3 фазы, 400 В' : '1 фаза, 230 В'],
    ['Прокладка', c.method === 'wall' ? 'Скрытая' : 'Открытая'],
    ['Потеря напряжения', c.drop > 0 ? 'до ' + fmt(c.drop, 0) + ' %' : 'по СН: 3 / 5 %'],
    ['Выделено', fmt(c.alloc, 1) + ' кВт']
  ];
  return (
    <section className="col col-list" aria-label="Группы линий">
      <button className="projbar" type="button" onClick={onOpenProj} aria-label="Проекты">
        <IconFolder />
        <span className="pb-main">
          <span className="pb-name">{p.name || 'Без названия'}</span>
          <span className="pb-sub">{sub.join(' · ')}</span>
        </span>
        <span className="pb-more">Проекты</span>
      </button>
      <div className="netchips">
        <button className="netfold" type="button" aria-expanded={netOpen} aria-label="Параметры сети" onClick={() => setNetOpen(v => !v)}>
          <IconNet />
          <span className="nf-main">Параметры сети<small>{net[0][1]} · {net[3][1]}</small></span>
          <IconChev className={'chev' + (netOpen ? ' open' : '')} />
        </button>
        {netOpen && (
          <div className="nf-body">
            <span className="nl-items">
              {net.map(t => (
                <span key={t[0]}><small>{t[0]}</small>{t[1]}</span>
              ))}
            </span>
            <button className="link" type="button" onClick={onOpenNet}>Изменить</button>
          </div>
        )}
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
          <button className="icon-btn" type="button" disabled={!canUndo} onClick={onUndo} aria-label="Отменить" title="Отменить (Ctrl+Z)">↶</button>
          <button className="icon-btn" type="button" disabled={!canRedo} onClick={onRedo} aria-label="Вернуть" title="Вернуть (Ctrl+Shift+Z)">↷</button>
          <span className="count">{count ? count + ' шт.' : ''}</span>
        </span>
      </div>
      <AddMenu down onAdd={onAdd} onRooms={onRooms} />
      <div className="rows">
        {count ? (
          a.rows.map((x, i) => (
            <GroupRow key={x.l.id} x={x} i={i} c={c} three={three} sel={x.l.id === sel} onSelect={onSelect} onCopy={onCopy} onDelete={onDelete} onFix={onFix} />
          ))
        ) : (
          <div className="empty">Групп пока нет. Добавьте первую кнопкой «+».</div>
        )}
      </div>
      <AddMenu fab onAdd={onAdd} onRooms={onRooms} />
    </section>
  );
}
