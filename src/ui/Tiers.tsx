import { useMemo, useState } from 'react';
import type { Project } from '../core/types';
import type { Action } from '../store/reducer';
import { TIERS, cfgChanges, tierEstimates } from '../core/tiers';
import type { TierEstimate, TierId } from '../core/tiers';
import { fmt } from '../core/format';
import { useLib } from '../store/LibContext';
import { Button, Field } from './kit';
import { Tip } from './common';
import { toastOk } from './toast';
import '../styles/tiers.css';

export function TierCards({ list, cur, onPick, name }: { list: TierEstimate[]; cur: TierId; onPick: (id: TierId) => void; name: string }) {
  return (
    <div className="tiers" role="radiogroup" aria-label="Варианты сметы">
      {list.map(t => (
        <label key={t.def.id} className={'tier' + (t.def.id === cur ? ' on' : '')}>
          <span className="tier-h">
            <input type="radio" name={name} value={t.def.id} checked={t.def.id === cur} onChange={() => onPick(t.def.id)} />
            <b>{t.def.title}</b>
          </span>
          <span className="tier-sum mono">{fmt(t.total, 2)} BYN</span>
          <small>{t.def.about}</small>
          {t.perks.length > 0 && (
            <ul className="tier-perks">
              {t.perks.map(x => <li key={x}>{x}</li>)}
            </ul>
          )}
        </label>
      ))}
    </div>
  );
}

export function TierSettings({ p, dispatch }: { p: Project; dispatch: (a: Action) => void }) {
  const { lib, dispatch: libDispatch } = useLib();
  const list = useMemo(() => tierEstimates(p, lib.prices, lib.labor, lib.tiers.markup), [p, lib.prices, lib.labor, lib.tiers.markup]);
  const [pick, setPick] = useState<TierId>('base');
  const cur = list.find(t => t.def.id === pick) ?? list[0];
  const changes = cfgChanges(p.cfg, cur.cfg);
  const apply = () => {
    changes.forEach(ch => dispatch({ t: 'cfg', field: ch.field, value: ch.value }));
    toastOk('Вариант «' + cur.def.title + '» применён к проекту');
    setPick('base');
  };
  return (
    <section className="tier-set" aria-labelledby="tier-set-t">
      <div className="lbl-row">
        <h3 className="sec-t" id="tier-set-t">Три варианта для клиента</h3>
        <Tip label="О вариантах">Клиент по ссылке увидит варианты «Базовый», «Надёжный» и «Максимум» и сам выберет. Базовый это проект как есть. Остальные только добавляют защиту: реле напряжения, УЗИП, УЗДП на розетки. Наценка учитывает аппараты более дорогого бренда.</Tip>
      </div>
      <label className="tier-on">
        <input type="checkbox" checked={lib.tiers.on} onChange={e => libDispatch({ t: 'tiersOn', on: e.target.checked })} />
        <span>Показывать варианты в ссылке для клиента</span>
      </label>
      {lib.tiers.on && (
        <>
          <div className="tier-mk">
            {TIERS.map((d, i) => (
              <Field key={d.id} id={'tier-mk-' + d.id} label={'Наценка «' + d.title + '», %'}>
                <input id={'tier-mk-' + d.id} type="text" inputMode="numeric" value={lib.tiers.markup[i] || ''} placeholder="0" onChange={e => libDispatch({ t: 'tierMarkup', i: i as 0 | 1 | 2, value: e.target.value })} />
              </Field>
            ))}
          </div>
          {list.length < 2 && <p className="muted">В проекте уже включена вся дополнительная защита, поэтому клиент увидит один вариант. Задайте наценку, чтобы варианты отличались классом аппаратов.</p>}
          <TierCards list={list} cur={cur.def.id} onPick={setPick} name="tier-own" />
          {list.some(t => t.missing > 0) && <p className="muted">Не у всех позиций задана цена, такие позиции не входят в итог варианта.</p>}
          {changes.length > 0 && <Button onClick={apply}>Применить «{cur.def.title}» к проекту</Button>}
        </>
      )}
    </section>
  );
}
