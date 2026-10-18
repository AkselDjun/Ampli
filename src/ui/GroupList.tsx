import type { Calc, Row } from '../core/types';
import type { Project } from '../core/types';
import { NB, fmt, fs, plural } from '../core/format';
import { STATUS, TYPES } from '../core/norms';
import { IconChev, IconFolder, IconNet } from './Icons';
import { ArmButton } from './common';
import type { LineType } from '../core/types';

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

function Kpi({ a }: { a: Calc }) {
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
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span><b>{fmt(a.P / 1000, 1)} кВт</b> из {fmt(c.alloc, 1)}</span>
        <span className={'pill ' + ac}>{at}</span>
      </div>
      <div className="meter" role="img" aria-label={'Загрузка выделенной мощности ' + Math.round(pct) + ' %'}>
        <i className={ac === 'ok' ? '' : ac} style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} />
      </div>
      <div className="kpi-sub">Ввод {inDev}{a.inS ? ' · ' + fs(a.inS) + ' мм²' : ''} · щиток на {a.size} мод.</div>
    </div>
  );
}

export function GroupList({
  p, a, sel, onSelect, onAdd, onOpenProj, onOpenNet, onRooms, onBlank, canUndo, canRedo, onUndo, onRedo
}: {
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
  const sub: string[] = [];
  if (p.address) sub.push(p.address);
  sub.push(p.lines.length + ' ' + plural(p.lines.length, ['группа', 'группы', 'групп']));
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
        <button className="netline" type="button" onClick={onOpenNet} aria-label="Параметры сети">
          <IconNet />
          <span className="nl-items">
            {net.map(t => (
              <span key={t[0]}><small>{t[0]}</small>{t[1]}</span>
            ))}
          </span>
          <IconChev className="chev" />
        </button>
      </div>
      {p.sample && (
        <div className="sample">
          Пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.{' '}
          <ArmButton className="link js-blank" label="Начать с нуля" onRun={onBlank} />
        </div>
      )}
      <Kpi a={a} />
      <div className="list-head">
        <h2>Группы линий</h2>
        <button className="link" type="button" onClick={onRooms}>Из комнат</button>
        <span className="hist">
          <button className="icon-btn" type="button" disabled={!canUndo} onClick={onUndo} aria-label="Отменить" title="Отменить (Ctrl+Z)">↶</button>
          <button className="icon-btn" type="button" disabled={!canRedo} onClick={onRedo} aria-label="Вернуть" title="Вернуть (Ctrl+Shift+Z)">↷</button>
          <span className="count">{p.lines.length ? p.lines.length + ' шт.' : ''}</span>
        </span>
      </div>
      <div className="rows">
        {p.lines.length ? (
          a.rows.map((x, i) => (
            <button key={x.l.id} className={'row' + (x.l.id === sel ? ' sel' : '')} type="button" onClick={() => onSelect(x.l.id)}>
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
          ))
        ) : (
          <div className="empty">Групп пока нет. Добавьте первую кнопкой ниже.</div>
        )}
      </div>
      <div className="adders">
        <button className="btn primary" type="button" onClick={() => onAdd('light')}>+ Освещение</button>
        <button className="btn primary" type="button" onClick={() => onAdd('socket')}>+ Розетки</button>
        <button className="btn primary" type="button" onClick={() => onAdd('power')}>+ Мощный прибор</button>
      </div>
    </section>
  );
}
