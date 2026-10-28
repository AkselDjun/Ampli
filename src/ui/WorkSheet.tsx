import { useState } from 'react';
import type { Calc, Project } from '../core/types';
import { fmt } from '../core/format';
import { CHECK_ITEMS, progress } from '../core/checklist';
import { VERDICT, protocolRows } from '../core/protocol';
import type { Action } from '../store/reducer';
import { Sheet, TabPanel, Tabs } from './common';
import { ShareBlock } from './ShareBlock';

export type PrintMode = 'report' | 'proto' | 'stickers' | 'tags' | 'passport';

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
  const [tab, setTab] = useState('check');
  const checks = p.checks ?? {};
  const pr = progress(p.checks);
  const rows = protocolRows(a);
  const proto = p.proto ?? { date: '', device: '', by: '' };
  return (
    <Sheet open={open} onClose={onClose} title="Монтаж и приёмка" bar={<Tabs scope="wk" label="Разделы приёмки" cur={tab} onChange={setTab} items={[{ id: 'check', label: 'Чек-лист ' + pr.done + '/' + pr.total }, { id: 'meas', label: 'Замеры' }, { id: 'docs', label: 'Документы' }]} />} tip="Замеры вводятся в карточке группы, раздел «Замеры и фото», или в режиме «На щитке». По ним проверяются КЗ, УЗО и изоляция.">
      <TabPanel scope="wk" id="check" cur={tab}>
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
      </TabPanel>
      <TabPanel scope="wk" id="meas" cur={tab}>
      <h3 className="sec-t">Протокол замеров</h3>
      <div className="meta-grid">
        <div className="f"><label className="lbl" htmlFor="pDate">Дата замеров</label><input id="pDate" type="date" value={proto.date} onChange={e => dispatch({ t: 'proto', field: 'date', value: e.target.value })} /></div>
        <div className="f"><label className="lbl" htmlFor="pBy">Измерения выполнил</label><input id="pBy" type="text" maxLength={80} autoComplete="off" value={proto.by} onChange={e => dispatch({ t: 'proto', field: 'by', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="pDev">Прибор, номер, поверка</label><input id="pDev" type="text" maxLength={120} autoComplete="off" value={proto.device} onChange={e => dispatch({ t: 'proto', field: 'device', value: e.target.value })} /></div>
      </div>
      <div className="tablewrap">
        <table className="t2">
          <thead>
            <tr><th>Гр.</th><th>Защита</th><th className="num">Петля, Ом</th><th className="num">Iк, А</th><th className="num">Изоляция, МОм</th><th className="num">Утечка, мА</th><th className="num">УЗО, мс</th><th>Итог</th></tr>
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
                <td className="num" data-label="УЗО, мс">{r.rcdT === null ? '—' : fmt(r.rcdT, 0) + ' / ' + fmt(r.rcdLim, 0)}</td>
                <td data-label="Итог"><span className={'pill ' + (r.verdict === 'ok' ? 'ok' : (r.verdict === 'bad' ? 'bad' : 'warn'))}>{VERDICT[r.verdict]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </TabPanel>
      <TabPanel scope="wk" id="docs" cur={tab}>
      <h3 className="sec-t">Паспорт для владельца</h3>
      <p className="muted">Страница для заказчика: что на каком автомате, сколько можно включать и что делать, если выбило. Отправьте ссылкой или распечатайте с QR-кодом для дверцы щитка.</p>
      <div className="copy-row">
        <button className="btn primary" type="button" onClick={() => onPrint('passport')}>Печать паспорта</button>
      </div>
      <ShareBlock p={p} owner />
      <h3 className="sec-t">Протокол, наклейки и бирки</h3>
      <div className="copy-row">
        <button className="btn primary" type="button" onClick={() => onPrint('proto')}>Печать протокола</button>
        <button className="btn" type="button" onClick={() => onPrint('stickers')}>Наклейки щитка</button>
        <button className="btn" type="button" onClick={() => onPrint('tags')}>Бирки кабелей</button>
      </div>
      </TabPanel>
    </Sheet>
  );
}
