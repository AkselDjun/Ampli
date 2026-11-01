import { useEffect, useState } from 'react';
import type { Calc, Project } from '../core/types';
import { CHECK_ITEMS, progress } from '../core/checklist';
import { protocolRows } from '../core/protocol';
import { dfmt } from '../core/format';
import type { Action } from '../store/reducer';
import { Sheet, TabPanel, Tabs } from './common';
import { BoardMeasure } from './BoardMeasure';

export type PrintMode = 'report' | 'proto' | 'stickers' | 'tags' | 'passport';

export function WorkSheet({
  open, onClose, p, a, dispatch, want
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  dispatch: (x: Action) => void;
  want?: { tab: string; n: number };
}) {
  const [tab, setTab] = useState('check');
  useEffect(() => {
    if (want) setTab(want.tab);
  }, [want]);
  const checks = p.checks ?? {};
  const pr = progress(p.checks);
  const rows = protocolRows(a);
  const done = rows.filter(r => r.verdict !== 'none').length;
  const proto = p.proto ?? { date: '', device: '', by: '' };
  return (
    <Sheet open={open} onClose={onClose} title="Монтаж и приёмка" bar={<Tabs scope="wk" label="Разделы приёмки" cur={tab} onChange={setTab} items={[{ id: 'check', label: 'Чек-лист ' + pr.done + '/' + pr.total }, { id: 'meas', label: 'Замеры на щитке ' + done + '/' + rows.length }]} />} tip="На вкладке «Замеры на щитке» щиток нарисован как настоящий: нажмите на автомат и введите замеры. Их же можно ввести в карточке группы. Протокол, наклейки и паспорт печатаются в окне «Документы».">
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
      <details className="bd-help proto-d">
        <summary>Данные протокола{proto.date || proto.by || proto.device ? ': ' + [proto.date ? dfmt(new Date(proto.date).getTime()) : '', proto.by, proto.device].filter(Boolean).join(', ') : ''}</summary>
      <div className="meta-grid">
        <div className="f"><label className="lbl" htmlFor="pDate">Дата замеров</label><input id="pDate" type="date" value={proto.date} onChange={e => dispatch({ t: 'proto', field: 'date', value: e.target.value })} /></div>
        <div className="f"><label className="lbl" htmlFor="pBy">Измерения выполнил</label><input id="pBy" type="text" maxLength={80} autoComplete="off" value={proto.by} onChange={e => dispatch({ t: 'proto', field: 'by', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="pDev">Прибор, номер, поверка</label><input id="pDev" type="text" maxLength={120} autoComplete="off" value={proto.device} onChange={e => dispatch({ t: 'proto', field: 'device', value: e.target.value })} /></div>
      </div>
      </details>
      <BoardMeasure open={open && tab === 'meas'} a={a} dispatch={dispatch} />
      </TabPanel>
    </Sheet>
  );
}
