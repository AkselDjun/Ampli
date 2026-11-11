import { useMemo } from 'react';
import type { Project } from '../core/types';
import type { Action } from '../store/reducer';
import { calcAll } from '../core/calc';
import { powerFit, prioNames } from '../core/powerfit';
import type { FitOption } from '../core/powerfit';
import { fmt } from '../core/format';
import { Button } from './kit';
import { toastOk } from './toast';

export function PowerFitBlock({ p, dispatch }: { p: Project; dispatch: (a: Action) => void }) {
  const a = useMemo(() => calcAll(p.lines, p.cfg, p), [p]);
  const fit = useMemo(() => powerFit(p, a), [p, a]);
  const names = prioNames(p);
  const hasPrio = names.p.length > 0 || names.s.length > 0;
  if (!fit.over && !hasPrio) return null;
  const apply = (o: FitOption) => {
    if (o.ev) dispatch({ t: 'appPower', line: o.ev.line, app: o.ev.app, w: o.ev.w });
    if (o.set) dispatch({ t: 'prio', set: o.set });
    if (o.supply) dispatch({ t: 'cfg', field: 'supply', value: o.supply });
    if (o.alloc) dispatch({ t: 'cfg', field: 'alloc', value: o.alloc });
    toastOk('Применено: ' + o.title.toLowerCase());
  };
  const clear = () => {
    const set: Record<string, ''> = {};
    p.lines.forEach(l => { if (l.prio) set[l.id] = ''; });
    dispatch({ t: 'prio', set });
  };
  return (
    <section className="pfit" aria-labelledby="pfit-t">
      <h3 className="sec-t" id="pfit-t">Уложиться в выделенную мощность</h3>
      {fit.over && (
        <p className="pfit-lead">
          Расчётная мощность {fmt(fit.P / 1000, 1)} кВт при выделенной {fmt(fit.alloc, 1)} кВт.
          {fit.options.length > 0 ? ' Что можно сделать, от дешёвого к дорогому:' : ''}
        </p>
      )}
      {fit.options.length > 0 && (
        <ul className="pfit-list">
          {fit.options.map(o => (
            <li key={o.kind} className={'pfit-o' + (o.fits ? ' ok' : '')}>
              <b>{o.title}</b>
              <span>{o.text}</span>
              <small className="mono">
                {o.kind === 'alloc' ? 'Выделенная ' + fmt(o.alloc ?? 0, 1) + ' кВт' : 'Расчётная ' + fmt(o.P / 1000, 1) + ' кВт' + (o.inIn ? ', ввод C' + o.inIn : '')}
                {o.fits ? ' · укладывается' : ' · ещё не укладывается'}
              </small>
              <Button size="sm" onClick={() => apply(o)}>{o.kind === 'alloc' ? 'Указать ' + fmt(o.alloc ?? 0, 1) + ' кВт' : 'Применить'}</Button>
            </li>
          ))}
        </ul>
      )}
      {hasPrio && (
        <div className="pfit-now">
          <p>
            Реле приоритета: {names.p.length ? 'приоритет у «' + names.p.join('», «') + '»' : 'приоритетная группа не выбрана'}; {names.s.length ? 'отключаются «' + names.s.join('», «') + '»' : 'отключаемые группы не выбраны'}.
          </p>
          <Button size="sm" variant="ghost" onClick={clear}>Убрать реле приоритета</Button>
        </div>
      )}
    </section>
  );
}
