import type { Calc, Project } from '../core/types';
import { fmt } from '../core/format';
import { CHECK_ITEMS, progress } from '../core/checklist';
import { VERDICT, protocolRows } from '../core/protocol';
import type { Action } from '../store/reducer';
import { Sheet } from './common';

export type PrintMode = 'report' | 'proto' | 'stickers' | 'tags';

export function WorkSheet({
  open, onClose, p, a, dispatch, onPrint
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  dispatch: (x: Action) => void;
  onPrint: (m: PrintMode) => void;
}) {
  const checks = p.checks ?? {};
  const pr = progress(p.checks);
  const rows = protocolRows(a);
  const proto = p.proto ?? { date: '', device: '', by: '' };
  return (
    <Sheet open={open} onClose={onClose} title="Монтаж и приёмка">
      <div className="wk-prog">
        <span><b>{pr.done}</b> из {pr.total} пунктов выполнено</span>
        <div className="meter" role="img" aria-label={'Выполнено ' + pr.done + ' из ' + pr.total}>
          <i style={{ width: (pr.total ? pr.done / pr.total * 100 : 0) + '%' }} />
        </div>
      </div>
      <ul className="ck">
        {CHECK_ITEMS.map(it => (
          <li key={it.id}>
            <label>
              <input type="checkbox" checked={!!checks[it.id]} onChange={e => dispatch({ t: 'check', id: it.id, on: e.target.checked })} />
              <span className="ck-t"><b>{it.title}</b><small>{it.hint}</small></span>
            </label>
          </li>
        ))}
      </ul>
      <h3 className="sec-t">Протокол замеров</h3>
      <div className="meta-grid">
        <div className="f"><label className="lbl" htmlFor="pDate">Дата замеров</label><input id="pDate" type="date" value={proto.date} onChange={e => dispatch({ t: 'proto', field: 'date', value: e.target.value })} /></div>
        <div className="f"><label className="lbl" htmlFor="pBy">Измерения выполнил</label><input id="pBy" type="text" maxLength={80} autoComplete="off" value={proto.by} onChange={e => dispatch({ t: 'proto', field: 'by', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="pDev">Прибор, номер, поверка</label><input id="pDev" type="text" maxLength={120} autoComplete="off" value={proto.device} onChange={e => dispatch({ t: 'proto', field: 'device', value: e.target.value })} /></div>
      </div>
      <p className="muted">Значения замеров вводятся в карточке группы, раздел «Замеры после монтажа». Они подставляются в проверку КЗ, УЗО и изоляции.</p>
      <div className="tablewrap">
        <table className="t2">
          <thead>
            <tr><th>Гр.</th><th>Защита</th><th className="num">Петля, Ом</th><th className="num">Iк, А</th><th className="num">Изоляция, МОм</th><th className="num">Утечка, мА</th><th>Итог</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.no}>
                <td className="mono t-no" data-label="Гр.">{r.no}</td>
                <td className="mono" data-label="Защита">{r.prot}</td>
                <td className="num" data-label="Петля, Ом">{r.zs === null ? '—' : fmt(r.zs, 2)}</td>
                <td className="num" data-label="Iк, А">{r.ik === null ? '—' : fmt(r.ik, 0) + ' / ' + fmt(r.need, 0)}</td>
                <td className="num" data-label="Изоляция, МОм">{r.ins === null ? '—' : fmt(r.ins, 2)}</td>
                <td className="num" data-label="Утечка, мА">{r.leak === null ? '—' : fmt(r.leak, 1) + ' / ' + fmt(r.leakLim, 1)}</td>
                <td data-label="Итог"><span className={'pill ' + (r.verdict === 'ok' ? 'ok' : (r.verdict === 'bad' ? 'bad' : 'warn'))}>{VERDICT[r.verdict]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="copy-row">
        <button className="btn primary" type="button" onClick={() => onPrint('proto')}>Печать протокола</button>
        <button className="btn" type="button" onClick={() => onPrint('stickers')}>Наклейки щитка</button>
        <button className="btn" type="button" onClick={() => onPrint('tags')}>Бирки кабелей</button>
      </div>
    </Sheet>
  );
}
