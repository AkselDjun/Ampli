import { memo, useState } from 'react';
import type { JSX } from 'react';
import type { Calc } from '../core/types';
import '../styles/overview.css';
import { fmt, plural } from '../core/format';
import { inOf } from '../core/protection';
import { checksOf, FIX_LABEL } from './Checks';
import type { CheckFix } from './Checks';
import { allocState } from './Totals';
import { IconList, IconStBad, IconStOk, IconStWarn } from './Icons';
import { Button } from './kit';

type Tone = 'ok' | 'warn' | 'bad';

export const ST_ICON: Record<Tone, JSX.Element> = { ok: <IconStOk />, warn: <IconStWarn />, bad: <IconStBad /> };

export interface Issue {
  k: 'warn' | 'bad';
  title: string;
  text: string;
  id?: string;
  fix?: CheckFix;
}

export function issuesOf(a: Calc): Issue[] {
  const out: Issue[] = [];
  a.rows.forEach((x, i) => {
    if (x.r.empty || x.r.status === 'ok') return;
    const k = x.r.status === 'bad' ? 'bad' : 'warn';
    out.push({ k, title: 'Группа ' + String(i + 1).padStart(2, '0') + ' · ' + (x.l.name || 'Без названия'), text: (x.r.notes[0] ?? x.r.tips[0] ?? '').replace(/\s*\([^)]*\)\.?$/, ''), id: x.l.id });
  });
  for (const c of checksOf(a)) {
    if (c.k !== 'warn' && c.k !== 'bad') continue;
    if (c.groups?.length && c.t.startsWith('Замечания в')) continue;
    out.push({ k: c.k, title: 'Щиток', text: c.t, id: c.groups?.[0], fix: c.fix });
  }
  return out.sort((x, y) => (x.k === y.k ? 0 : x.k === 'bad' ? -1 : 1));
}

const count = (n: number, w: [string, string, string]) => n + ' ' + plural(n, w);

export const SumBox = memo(function SumBox({ a, onNet }: { a: Calc; onNet: () => void }) {
  const st = allocState(a);
  const three = a.c.supply === 3;
  return (
    <section className="box ov-sum" aria-labelledby="ov-sum-h">
      <div className="box-h"><h2 id="ov-sum-h">Итоги</h2><span className="note">предварительно</span></div>
      <dl className="kvs">
        <div className="kv"><dt>Установленная</dt><dd className="mono">{fmt(a.sumInst / 1000, 1)} кВт</dd></div>
        <div className="kv"><dt>Расчётная</dt><dd className="mono strong">{fmt(a.P / 1000, 1)} кВт</dd></div>
        <div className="kv"><dt>{three ? 'Ток макс. фазы' : 'Ток ввода'}</dt><dd className="mono strong">{fmt(a.Itot, 1)} А</dd></div>
        <div className="kv"><dt>Вводной автомат</dt><dd className={'mono' + (!a.inIn && a.P > 0 ? ' bad' : '')}>{inOf(a)}</dd></div>
      </dl>
      <button type="button" className="ov-meter" onClick={onNet}>
        <span className="ov-meter-r"><span>Выделено {fmt(a.c.alloc, 1).replace(/,0$/, '')} кВт</span><span className="mono">{Math.round(st.pct)} %</span></span>
        <span className="track" aria-hidden="true"><i className={st.k === 'ok' ? '' : st.k} style={{ width: Math.min(100, st.pct) + '%' }} /></span>
        <span className="vh">{st.text}. Изменить выделенную мощность</span>
      </button>
    </section>
  );
});

export const ChecksBox = memo(function ChecksBox({ a, onGroup, onFix }: { a: Calc; onGroup: (id: string) => void; onFix: (f: CheckFix) => void }) {
  const list = issuesOf(a);
  const bad = list.filter(x => x.k === 'bad').length;
  const warn = list.length - bad;
  return (
    <section className="box ov-chk" aria-labelledby="ov-chk-h">
      <div className="box-h">
        <h2 id="ov-chk-h">Проверки</h2>
        {bad > 0 && <span className="pill bad">{count(bad, ['нарушение', 'нарушения', 'нарушений'])}</span>}
        {warn > 0 && <span className="pill warn">{count(warn, ['совет', 'совета', 'советов'])}</span>}
      </div>
      {list.length ? (
        <ul className="iss-l">
          {list.map((x, i) => (
            <li key={i} className="iss">
              <span className={'st ' + x.k}>{ST_ICON[x.k]}<span className="vh">{x.k === 'bad' ? 'Нарушение' : 'Совет'}: </span></span>
              <span className="iss-b">
                {x.id ? <button type="button" className="iss-t" onClick={() => onGroup(x.id as string)}>{x.title}</button> : <span className="iss-t">{x.title}</span>}
                <span className="iss-s">{x.text}</span>
                {x.fix && <Button size="sm" onClick={() => onFix(x.fix as CheckFix)}>{FIX_LABEL[x.fix]}</Button>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="note ov-clean"><span className="st ok"><IconStOk /></span>Нарушений и советов нет.</p>}
    </section>
  );
});

export const HomeSum = memo(function HomeSum({ a, onNet, onGroup, onFix }: { a: Calc; onNet: () => void; onGroup: (id: string) => void; onFix: (f: CheckFix) => void }) {
  const st = allocState(a);
  const list = issuesOf(a);
  const [at, setAt] = useState(0);
  const k = list.length ? at % list.length : 0;
  const cur = list[k];
  const three = a.c.supply === 3;
  return (
    <div className="home-sum">
      <button type="button" className="hs-nums" onClick={onNet}>
        <span className="vh">Итоги, открыть параметры сети. </span>
        <span className="hs-n"><span className="hs-k">Расчётная</span><b className="mono">{fmt(a.P / 1000, 1)}<small>кВт</small></b></span>
        <span className="hs-n"><span className="hs-k">{three ? 'Макс. фаза' : 'Ток ввода'}</span><b className="mono">{fmt(a.Itot, 1)}<small>А</small></b></span>
        <span className="hs-n"><span className="hs-k">Вводной</span><b className={'mono' + (!a.inIn && a.P > 0 ? ' bad' : '')}>{a.inIn ? 'C' + a.inIn : '—'}</b></span>
        <span className="hs-of">{Math.round(st.pct)} % от выделенных {fmt(a.c.alloc, 1).replace(/,0$/, '')} кВт</span>
        <span className="track" aria-hidden="true"><i className={st.k === 'ok' ? '' : st.k} style={{ width: Math.min(100, st.pct) + '%' }} /></span>
      </button>
      {cur && (
        <div className={'hs-iss ' + cur.k}>
          <span className="hs-bars" aria-hidden="true">{list.slice(0, 6).map((_, i) => <i key={i} className={i === k ? 'on' : undefined} />)}</span>
          <button type="button" className="hs-it" onClick={() => (cur.id ? onGroup(cur.id) : cur.fix && onFix(cur.fix))}>
            <span className="hs-ik">{cur.k === 'bad' ? 'Нарушение' : 'Совет'} · {k + 1} из {list.length}</span>
            <span className="hs-is">{cur.title.replace(/^Группа /, '')}: {cur.text}</span>
          </button>
          {list.length > 1 && <button type="button" className="hs-next" aria-label="Следующее замечание" onClick={() => setAt(k + 1)}><IconList /></button>}
        </div>
      )}
    </div>
  );
});
