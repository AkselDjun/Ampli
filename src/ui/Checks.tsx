import type { Calc } from '../core/types';
import { fmt, plural } from '../core/format';
import { IconAlert, IconDone } from './Icons';
import { usePop } from './pop';

export type CheckFix = 'phase3' | 'phase1' | 'net';

export interface Check {
  k: 'ok' | 'warn' | 'bad';
  t: string;
  groups?: string[];
  fix?: CheckFix;
}

export const FIX_LABEL: Record<CheckFix, string> = { phase3: 'Включить 3 фазы', phase1: 'Перейти на 1 фазу', net: 'Параметры сети' };

export function checksOf(a: Calc): Check[] {
  const c = a.c;
  const out: Check[] = [];
  if (a.hint3) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт больше 12 кВт. Для квартиры нужен трёхфазный ввод (СН 4.04.01-2019, п. 9.12).', fix: 'phase3' });
  else if (c.supply === 3 && a.P > 0 && a.P <= 12000) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт не больше 12 кВт: по СН 4.04.01-2019, п. 9.12 достаточно однофазного ввода.', fix: 'phase1' });
  else if (a.P > 0) out.push({ k: 'ok', t: 'Тип ввода соответствует нагрузке (до 12 кВт однофазный, больше трёхфазный, СН п. 9.12).' });
  if (a.inIn && a.inStep >= 2) out.push({ k: 'ok', t: 'Селективность: вводной автомат C' + a.inIn + ' на ' + a.inStep + ' ступ. выше наибольшего группового (СН 4.04.01-2019, п. 10.5).' });
  else if (a.inIn && a.inStep === 1) out.push({ k: 'warn', t: 'Селективность: вводной автомат C' + a.inIn + ' выше группового только на одну ступень. Это допускается лишь в обоснованных случаях (СН 4.04.01-2019, п. 10.5).', fix: 'net' });
  else if (a.inIn && a.inStep < 1) out.push({ k: 'bad', t: 'Селективность не обеспечена: вводной автомат C' + a.inIn + ' не выше группового (СН 4.04.01-2019, п. 10.5).', fix: 'net' });
  const act = a.rows.filter(x => !x.r.empty && x.r.In);
  const kzBad = act.filter(x => x.r.len > 0 && x.r.ik < x.r.ikNeed);
  const kzNo = act.filter(x => x.r.len === 0);
  if (kzBad.length) out.push({ k: 'bad', t: 'Короткое замыкание: автомат может не отключить ' + kzBad.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ' за 0,4 с. Сократите линию.', groups: kzBad.map(x => x.l.id) });
  else if (act.length && !kzNo.length) out.push({ k: 'ok', t: 'Короткое замыкание в конце каждой линии отключается за 0,4 с (ТКП 339-2022, п. 4.3.5.4). Петля питающей сети ' + fmt(c.zs, 2) + ' Ом задана вами, проверьте её.' });
  else if (kzNo.length) out.push({ k: 'warn', t: 'Короткое замыкание не проверено для ' + kzNo.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ': не задана длина.', groups: kzNo.map(x => x.l.id) });
  const gr = a.rows.filter(x => !x.r.empty && x.r.status !== 'ok' && !kzBad.includes(x));
  if (gr.length) out.push({ k: gr.some(x => x.r.status === 'bad') ? 'bad' : 'warn', t: 'Замечания в ' + plural(gr.length, ['группе', 'группах', 'группах']) + ' ' + gr.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + '. Подробности в карточке группы.', groups: gr.map(x => x.l.id) });
  return out;
}

export function checksState(list: Check[]): { k: 'ok' | 'warn' | 'bad'; n: number; text: string } {
  const n = list.filter(x => x.k !== 'ok').length;
  const k = list.some(x => x.k === 'bad') ? 'bad' : (n ? 'warn' : 'ok');
  return { k, n, text: n ? n + ' ' + plural(n, ['замечание', 'замечания', 'замечаний']) : 'Всё в норме' };
}

export function Checks({ a, onGroup, onFix }: { a: Calc; onGroup: (id: string) => void; onFix: (f: CheckFix) => void }) {
  const { open, setOpen, ref } = usePop<HTMLDivElement>();
  const list = checksOf(a);
  if (!list.length) return null;
  const st = checksState(list);
  const noOf = (id: string): string => 'Г' + (a.rows.findIndex(x => x.l.id === id) + 1);
  return (
    <div className={'chk-w' + (open ? ' open' : '')} ref={ref}>
      <button className={'chk-b st-' + st.k} type="button" aria-expanded={open} aria-controls="chk-pop" aria-label={'Проверки по нормам: ' + st.text} data-tip={open ? undefined : 'Проверки по нормам: ' + st.text.toLowerCase()} onClick={() => setOpen(!open)}>
        <span className="lbl">Нормы</span>
        <b>{st.k === 'ok' ? <IconDone /> : <IconAlert />}{st.n > 0 && <em className="chk-n">{st.n}</em>}</b>
      </button>
      {open && (
        <section className="tot-pop chk-pop" id="chk-pop" aria-label="Проверки по нормам">
          <div className="tp-head">
            <h2>Проверки по нормам</h2>
            <span className={'pill ' + st.k}>{st.text}</span>
          </div>
          <ul className="chk">
            {list.map((x, i) => (
              <li key={i} className={x.k}>
                <span>{x.t}</span>
                {(x.groups?.length || x.fix) && (
                  <span className="chk-act">
                    {x.groups?.map(id => (
                      <button key={id} type="button" className="chk-g" aria-label={'Открыть группу ' + noOf(id)} onClick={() => { setOpen(false); onGroup(id); }}>{noOf(id)}</button>
                    ))}
                    {x.fix && <button type="button" className="btn sm" onClick={() => { setOpen(false); onFix(x.fix as CheckFix); }}>{FIX_LABEL[x.fix]}</button>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
