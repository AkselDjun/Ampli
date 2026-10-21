import { useEffect, useMemo, useRef, useState } from 'react';
import type { EstimateShare } from '../core/share';
import { calcAll } from '../core/calc';
import { buildSpec, estimate } from '../core/spec';
import { grandTotal, laborEstimate } from '../core/labor';
import { dfmt, fmt, plural } from '../core/format';
import { Toaster } from './common';
import { Totals } from './Labor';
import { toast, toastOk } from './toast';

export function approveText(e: EstimateShare, materials: number, works: number, url: string): string {
  const p = e.p;
  return 'Согласую смету «' + (p.name || 'Без названия') + '»' + (p.address ? ', ' + p.address : '') + ' на ' + fmt(grandTotal(materials, works), 2) + ' BYN (работы ' + fmt(works, 2) + ', материалы ' + fmt(materials, 2) + '). ' + url;
}

export function EstimateView({ data, onClose }: { data: EstimateShare; onClose: () => void }) {
  const p = data.p;
  const a = useMemo(() => calcAll(p.lines, p.cfg), [p]);
  const est = useMemo(() => estimate(buildSpec(a), data.prices), [a, data.prices]);
  const le = useMemo(() => laborEstimate(a, p.work, data.labor), [a, p.work, data.labor]);
  const works = le.rows.filter(r => r.qty > 0 && r.price !== null);
  const groups = a.rows.filter(x => !x.r.empty && x.r.In).length;
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const approve = async () => {
    const text = approveText(data, est.total, le.total, window.location.href);
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ text });
        return;
      } catch (e) {
        void e;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setFallback(null);
      toastOk('Текст согласования скопирован. Отправьте его мастеру');
    } catch (e) {
      void e;
      setFallback(text);
      toast('Текст выделен, скопируйте его и отправьте мастеру');
    }
  };
  return (
    <main className="owner est-view">
      <div>
        {(data.company || data.contacts) && (
          <p className="ev-brand">
            {data.company && <b>{data.company}</b>}
            {data.contacts && <span>{data.contacts}</span>}
          </p>
        )}
        <h1>Смета: {p.name || 'Без названия'}</h1>
        <p className="pp-sub">
          {p.address ? p.address + '. ' : ''}{groups} {plural(groups, ['группа', 'группы', 'групп'])}, щиток на {a.size} модулей.{data.at ? ' Цены на ' + dfmt(data.at) + '.' : ''}
        </p>
        <Totals materials={est.total} works={le.total} total={grandTotal(est.total, le.total)} />
        <div className="owner-act ev-act">
          <button className="btn primary" type="button" onClick={approve}>Согласовать</button>
          <button className="btn ghost" type="button" onClick={() => window.print()}>Сохранить в PDF</button>
        </div>
        {fallback !== null && <textarea className="ev-fallback" ref={ta} readOnly value={fallback} aria-label="Текст согласования" />}
        {works.length > 0 && (
          <>
            <h2>Работы</h2>
            <div className="tablewrap">
              <table className="t2">
                <thead>
                  <tr><th>Работа</th><th className="num">Количество</th><th className="num">Цена, BYN</th><th className="num">Сумма, BYN</th></tr>
                </thead>
                <tbody>
                  {works.map(r => (
                    <tr key={r.def.key}>
                      <td className="t-name">{r.def.name}</td>
                      <td className="num" data-label="Количество">{fmt(r.qty, r.qty % 1 ? 1 : 0)} {r.def.unit}</td>
                      <td className="num" data-label="Цена, BYN">{fmt(r.price as number, 2)}</td>
                      <td className="num" data-label="Сумма, BYN">{fmt(r.sum as number, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <h2>Материалы</h2>
        <div className="tablewrap">
          <table className="t2">
            <thead>
              <tr><th>Позиция</th><th className="num">Количество</th><th className="num">Цена, BYN</th><th className="num">Сумма, BYN</th></tr>
            </thead>
            <tbody>
              {est.rows.map(({ item, price, sum }, i) => (
                <tr key={i}>
                  <td className="t-name">{item.name}</td>
                  <td className="num" data-label="Количество">{item.qty}</td>
                  <td className="num" data-label="Цена, BYN">{price === null ? '—' : fmt(price, 2)}</td>
                  <td className="num" data-label="Сумма, BYN">{sum === null ? '—' : fmt(sum, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {est.missing > 0 && <p className="pp-note">Для {est.missing} поз. цена не указана, они не входят в итог.</p>}
        <p className="pp-note">Смета составлена в Ampli по расчёту щитка. Количество кабеля дано с запасом 10 %, точный расход уточняется по месту.</p>
        <div className="owner-act">
          <button className="btn ghost" type="button" onClick={onClose}>Открыть Ampli</button>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
