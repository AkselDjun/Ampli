import { memo } from 'react';
import type { Calc } from '../core/types';
import { fmt, plural } from '../core/format';
import { ALL_STEPS, STD_IN } from '../core/norms';
import { IconAlert, IconDone } from './Icons';
import { usePop } from './pop';
import { Button } from './kit';
import type { HeaderCheckFix } from '../app/types';
import { houseChecks } from '../core/house';

export type CheckFix = HeaderCheckFix;

export interface Check {
  k: 'ok' | 'warn' | 'bad' | 'info';
  t: string;
  groups?: string[];
  fix?: CheckFix;
}

export const FIX_LABEL: Record<CheckFix, string> = { phase3: 'Включить 3 фазы', phase1: 'Перейти на 1 фазу', net: 'Параметры сети' };

export function checksOf(a: Calc): Check[] {
  const c = a.c;
  const out: Check[] = [];
  const three = a.rows.filter(x => !x.r.empty && x.r.three);
  if (a.hint3) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт больше 12 кВт. ' + (c.house ? 'Для дома' : 'Для квартиры') + ' нужен трёхфазный ввод (СН 4.04.01-2019, п. 9.12).', fix: 'phase3' });
  else if (c.supply === 3 && a.P > 0 && a.P <= 12000 && three.length) out.push({ k: 'ok', t: 'Трёхфазный ввод нужен для трёхфазных приборов: ' + three.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + '.' });
  else if (c.supply === 3 && a.P > 0 && a.P <= 12000) out.push({ k: 'warn', t: 'Расчётная нагрузка ' + fmt(a.P / 1000, 1) + ' кВт не больше 12 кВт: по СН 4.04.01-2019, п. 9.12 достаточно однофазного ввода.', fix: 'phase1' });
  else if (a.P > 0) out.push({ k: 'ok', t: 'Тип ввода соответствует нагрузке (до 12 кВт однофазный, больше трёхфазный, СН п. 9.12).' });
  if (a.Itot > 0 && !a.inIn) out.push({ k: 'bad', t: 'Вводной автомат не подобран: расчётный ток ввода ' + fmt(a.Itot, 0) + ' А больше 100 А. Уменьшите нагрузку или Ко' + (c.supply === 1 ? ', либо перейдите на трёхфазный ввод' : '') + '.', fix: c.supply === 1 ? 'phase3' : 'net' });
  if (a.P > 0 && a.P > c.alloc * 1000) out.push({ k: 'bad', t: 'Расчётная мощность ' + fmt(a.P / 1000, 1) + ' кВт больше выделенной ' + fmt(c.alloc, 1) + ' кВт. Уменьшите нагрузку или Ко, либо запросите увеличение мощности.', fix: 'net' });
  const allocA = c.alloc * 1000 / (c.supply === 3 ? Math.sqrt(3) * 400 : 230);
  if (a.inIn && a.inIn > allocA * 1.05 && a.P <= c.alloc * 1000) {
    const sel = inputBySelectivity(a);
    if (sel) {
      const big = sel.groups.map(x => x.l.id);
      const names = sel.groups.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ');
      const pow = sel.groups.some(x => x.l.type === 'power' && !x.r.three);
      out.push({ k: 'warn', t: 'Вводной автомат C' + a.inIn + ' задан селективностью с ' + names + ' (C' + sel.top + ') и больше тока выделенной мощности ' + fmt(c.alloc, 1) + ' кВт (' + fmt(allocA, 0) + ' А). Варианты: разделите ' + names + ' на две группы' + (sel.groups.some(x => /плит|варочн|духов/i.test(x.l.name + ' ' + x.l.apps.map(ap => ap.name).join(' '))) ? ', например варочную панель и духовой шкаф отдельно' : '') + (pow && c.supply === 1 ? ', или питайте прибор от трёх фаз' : '') + '; тогда хватит ввода ' + (sel.next ? 'C' + sel.next : 'меньшего номинала') + '. Либо согласуйте номинал ввода в технических условиях.', groups: big, fix: pow && c.supply === 1 ? 'phase3' : 'net' });
    } else {
      out.push({ k: 'warn', t: 'Вводной автомат C' + a.inIn + ' больше тока выделенной мощности ' + fmt(c.alloc, 1) + ' кВт (' + fmt(allocA, 0) + ' А). Номинал ввода задают технические условия: согласуйте его или уменьшите нагрузку.', fix: 'net' });
    }
  }
  if (a.inIn && a.inStep >= 2) out.push({ k: 'ok', t: 'Селективность: вводной автомат C' + a.inIn + ' на ' + a.inStep + ' ступ. выше наибольшего группового (СН 4.04.01-2019, п. 10.5).' });
  else if (a.inIn && a.inStep === 1) out.push({ k: 'warn', t: 'Селективность: вводной автомат C' + a.inIn + ' выше группового только на одну ступень. Это допускается лишь в обоснованных случаях (СН 4.04.01-2019, п. 10.5).', fix: 'net' });
  else if (a.inIn && a.inStep < 1) out.push({ k: 'bad', t: 'Селективность не обеспечена: вводной автомат C' + a.inIn + ' не выше группового (СН 4.04.01-2019, п. 10.5).', fix: 'net' });
  const act = a.rows.filter(x => !x.r.empty && x.r.In);
  const kzBad = act.filter(x => x.r.len > 0 && x.r.ik < x.r.ikNeed);
  const kzNo = act.filter(x => x.r.len === 0);
  if (kzBad.length) out.push({ k: 'bad', t: 'Короткое замыкание: автомат может не отключить ' + kzBad.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ' за 0,4 с. Сократите линию.', groups: kzBad.map(x => x.l.id) });
  else if (act.length && !kzNo.length) out.push({ k: 'ok', t: 'Короткое замыкание в конце каждой линии отключается за 0,4 с (ТКП 339-2022, п. 4.3.5.4). Петля питающей сети ' + fmt(c.zs, 2) + ' Ом: если её не замеряли, замерьте на вводе или уточните у энергоснабжающей организации.' });
  else if (kzNo.length) out.push({ k: 'warn', t: 'Короткое замыкание не проверено для ' + kzNo.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + ': не задана длина.', groups: kzNo.map(x => x.l.id) });
  out.push(...houseChecks(a));
  const gr = a.rows.filter(x => !x.r.empty && x.r.status !== 'ok' && !kzBad.includes(x));
  if (gr.length) out.push({ k: gr.some(x => x.r.status === 'bad') ? 'bad' : 'warn', t: 'Замечания в ' + plural(gr.length, ['группе', 'группах', 'группах']) + ' ' + gr.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + '. Подробности в карточке группы.', groups: gr.map(x => x.l.id) });
  const adv = a.rows.filter(x => !x.r.empty && x.r.status === 'ok' && x.r.tips.length);
  if (adv.length) out.push({ k: 'info', t: 'Советы в ' + plural(adv.length, ['группе', 'группах', 'группах']) + ' ' + adv.map(x => 'Г' + (a.rows.indexOf(x) + 1)).join(', ') + '. Это не нарушения норм, подробности в карточке группы.', groups: adv.map(x => x.l.id) });
  return out;
}

export function inputBySelectivity(a: Calc): { top: number; next: number | null; groups: Calc['rows'] } | null {
  if (!a.inIn) return null;
  const live = a.rows.filter(x => !x.r.empty && x.r.In);
  const top = live.reduce((m, x) => Math.max(m, x.r.In as number), 0);
  const gi = ALL_STEPS.indexOf(top);
  if (gi < 1) return null;
  const selIn = ALL_STEPS[gi + 2];
  if (!selIn || a.Itot >= selIn || STD_IN.find(x => x >= a.Itot) === a.inIn) return null;
  const need = Math.max(a.Itot, ALL_STEPS[gi + 1]);
  const next = STD_IN.find(x => x >= need) ?? null;
  return { top, next: next !== null && next < a.inIn ? next : null, groups: live.filter(x => x.r.In === top) };
}

export function checksState(list: Check[]): { k: 'ok' | 'warn' | 'bad'; n: number; text: string } {
  const n = list.filter(x => x.k === 'warn' || x.k === 'bad').length;
  const k = list.some(x => x.k === 'bad') ? 'bad' : (n ? 'warn' : 'ok');
  return { k, n, text: n ? n + ' ' + plural(n, ['замечание', 'замечания', 'замечаний']) : 'Всё в норме' };
}

export const Checks = memo(function Checks({ a, onGroup, onFix }: { a: Calc; onGroup: (id: string) => void; onFix: (f: CheckFix) => void }) {
  const { open, setOpen, ref } = usePop<HTMLDivElement>();
  const list = checksOf(a);
  if (!list.length) return null;
  const st = checksState(list);
  const noOf = (id: string): string => 'Г' + (a.rows.findIndex(x => x.l.id === id) + 1);
  return (
    <div className={'chk-w' + (open ? ' open' : '')} ref={ref}>
      <button className={'chk-b st-' + st.k} type="button" aria-expanded={open} aria-controls="chk-pop" data-tip={open ? undefined : 'Проверки по нормам: ' + st.text.toLowerCase()} onClick={() => setOpen(!open)}>
        <span className="vh">{'Проверки по нормам: ' + st.text + '. '}</span>
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
                    {x.fix && <Button size="sm" onClick={() => { setOpen(false); onFix(x.fix as CheckFix); }}>{FIX_LABEL[x.fix]}</Button>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});
