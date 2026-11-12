import { useEffect, useState } from 'react';
import type { Calc, Project } from '../core/types';
import { plural, ymd } from '../core/format';
import { CHECK_ITEMS, progress } from '../core/checklist';
import { protocolRows } from '../core/protocol';
import { MeasBoard } from './MeasBoard';
import type { Action } from '../store/reducer';
import { Sheet, TabPanel, Tabs } from './common';
import { ShareBlock } from './ShareBlock';
import { actsOf, actsSummary } from '../core/acts';
import { oldStarted } from '../core/oldwire';
import { tracedCount, wallPhotos } from '../core/traces';
import { IconPrint } from './Icons';
import { usePack } from './pack';
import { Button, Field, IconButton } from './kit';

export type PrintMode = 'report' | 'proto' | 'stickers' | 'tags' | 'passport' | 'a3' | 'hidden' | 'wiring' | 'accept' | 'old';

export function WorkSheet({
  open, onClose, p, a, dispatch, onPrint, want, onTab
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  dispatch: (x: Action) => void;
  onPrint: (m: PrintMode | PrintMode[]) => void;
  want?: { tab: string; n: number };
  onTab?: (tab: string) => void;
}) {
  const [tab, setTab] = useState(want ? want.tab : 'check');
  const [wantSeen, setWantSeen] = useState(want);
  if (want !== wantSeen) {
    setWantSeen(want);
    if (want) setTab(want.tab);
  }
  useEffect(() => {
    if (open) onTab?.(tab);
  }, [open, tab, onTab]);
  const checks = p.checks ?? {};
  const pr = progress(p.checks);
  const rows = protocolRows(a);
  const proto = p.proto ?? { date: '', device: '', by: '' };
  const acts = actsOf(p.acts);
  const actSum = actsSummary(p.acts);
  const [pack, setPack] = usePack();
  const done = rows.filter(r => r.verdict !== 'none').length;
  const failed = rows.filter(r => r.verdict === 'bad').length;
  const empty = !rows.length;
  const walls = wallPhotos(p.photos).length;
  const traced = tracedCount(p.photos);
  const docs: { m: PrintMode; name: string; hint: string; one: string }[] = [
    { m: 'report', name: 'Отчёт и спецификация', hint: 'расчёт групп, схема, материалы и смета', one: 'Печать отчёта' },
    { m: 'a3', name: 'Схема щитка А3', hint: 'однолинейная по ГОСТ 21.613 со штампом', one: 'Печать схемы А3' },
    { m: 'proto', name: 'Протокол замеров', hint: rows.length ? 'измерено ' + done + ' из ' + rows.length + ' групп' : 'групп пока нет', one: 'Печать протокола' },
    { m: 'hidden', name: 'Акт скрытых работ', hint: 'подписывают до заделки штроб', one: 'Акт скрытых работ' },
    { m: 'wiring', name: 'Карта скрытой проводки', hint: walls ? 'фото стен: ' + walls + ', трасс: ' + traced : 'в карточке группы добавьте фото «Стена» и разметьте трассы', one: 'Печать карты проводки' },
    { m: 'accept', name: 'Акт сдачи-приёмки', hint: failed ? 'в протоколе ' + failed + ' ' + plural(failed, ['группа не соответствует', 'группы не соответствуют', 'групп не соответствуют']) + ', сначала устраните' : 'работы из сметы, сроки и гарантия', one: 'Акт приёмки' },
    { m: 'passport', name: 'Паспорт для владельца', hint: 'оставить у щитка', one: 'Печать паспорта' },
    { m: 'stickers', name: 'Наклейки щитка', hint: 'по рядам, в размер модулей', one: 'Наклейки щитка' },
    { m: 'tags', name: 'Бирки кабелей', hint: 'по две на группу', one: 'Бирки кабелей' },
    ...(oldStarted(p.old) ? [{ m: 'old' as PrintMode, name: 'Заключение по старой проводке', hint: 'результаты осмотра и вывод', one: 'Печать заключения по проводке' }] : [])
  ];
  const chosen = docs.map(d => d.m).filter(m => pack.includes(m) && (m !== 'wiring' || walls > 0));
  return (
    <Sheet open={open} onClose={onClose} title="Приёмка" tourId="work" sub={p.name || 'Без названия'} footer={tab === 'meas' ? undefined : (
      <>
        <span className="foot-st">Чек-лист <b>{pr.done}/{pr.total}</b>{rows.length ? <>, замеры <b>{done}/{rows.length}</b></> : null}</span>
        {tab === 'docs'
          ? <Button variant="primary" disabled={!chosen.length || empty} onClick={() => onPrint(chosen)}>Печать комплекта{chosen.length ? ' · ' + chosen.length : ''}</Button>
          : <Button variant="primary" onClick={() => setTab('docs')}>К документам</Button>}
      </>
    )} bar={<Tabs scope="wk" label="Разделы приёмки" cur={tab} onChange={setTab} items={[{ id: 'check', label: 'Чек-лист ' + pr.done + '/' + pr.total }, { id: 'meas', label: rows.length ? 'Замеры ' + done + '/' + rows.length : 'Замеры' }, { id: 'docs', label: 'Документы' }]} />} tip="Во вкладке «Замеры» щиток показан так же, как он собран: нажмите на автомат и введите замеры. Цвет рычажка: зелёный соответствует, красный не соответствует, серый ещё не измерено. Те же значения есть в карточке группы.">
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
              <span className="ck-t"><b>{it.title}</b>{!checks[it.id] && <small>{it.hint}</small>}</span>
            </label>
          </li>
        ))}
      </ul>
      </TabPanel>
      <TabPanel scope="wk" id="meas" cur={tab}>
      <MeasBoard open={open} a={a} dispatch={dispatch}>
        <details className="bd-help proto-d">
          <summary>Данные протокола{proto.date || proto.by || proto.device ? ': ' + [proto.date ? ymd(proto.date) : '', proto.by, proto.device].filter(Boolean).join(', ') : ''}</summary>
        <div className="meta-grid">
          <Field id="pDate" label="Дата замеров"><input id="pDate" type="date" value={proto.date} onChange={e => dispatch({ t: 'proto', field: 'date', value: e.target.value })} /></Field>
          <Field id="pBy" label="Измерения выполнил"><input id="pBy" type="text" maxLength={80} autoComplete="off" value={proto.by} onChange={e => dispatch({ t: 'proto', field: 'by', value: e.target.value })} /></Field>
          <Field id="pDev" label="Прибор, номер, поверка" wide><input id="pDev" type="text" maxLength={120} autoComplete="off" value={proto.device} onChange={e => dispatch({ t: 'proto', field: 'device', value: e.target.value })} /></Field>
        </div>
        </details>
      </MeasBoard>
      </TabPanel>
      <TabPanel scope="wk" id="docs" cur={tab}>
      <h3 className="sec-t">Комплект для сдачи</h3>
      <p className="muted">Отметьте документы и напечатайте их одним файлом. Значок принтера печатает один документ.</p>
      <ul className="pack" aria-label="Документы комплекта">
        {docs.map(d => (
          <li key={d.m}>
            <label>
              <input type="checkbox" checked={pack.includes(d.m)} onChange={e => setPack(e.target.checked ? [...pack, d.m] : pack.filter(x => x !== d.m))} />
              <span className="pk-t"><b>{d.name}</b><small>{d.hint}</small></span>
            </label>
            <IconButton className="pk-p" label={d.one} tip="Напечатать только этот" disabled={(empty && d.m !== 'old') || (d.m === 'wiring' && !walls)} onClick={() => onPrint(d.m)}><IconPrint /></IconButton>
          </li>
        ))}
      </ul>
      {empty && <p className="muted">В проекте нет групп, печатать пока нечего.</p>}
      <details className="bd-help proto-d acts-d">
        <summary>Сроки и гарантия для актов{actSum ? ': ' + actSum : ''}</summary>
        <div className="meta-grid">
          <Field id="aStart" label="Начало работ"><input id="aStart" type="date" value={acts.start} onChange={e => dispatch({ t: 'acts', field: 'start', value: e.target.value })} /></Field>
          <Field id="aEnd" label="Окончание работ"><input id="aEnd" type="date" value={acts.end} onChange={e => dispatch({ t: 'acts', field: 'end', value: e.target.value })} /></Field>
          <Field id="aWar" label="Гарантия, мес."><input id="aWar" type="text" inputMode="numeric" min={0} max={120} step={1} value={acts.warranty || ''} placeholder="без гарантии" onChange={e => dispatch({ t: 'acts', field: 'warranty', value: e.target.value })} /></Field>
        </div>
      </details>
      <h3 className="sec-t">Паспорт для владельца</h3>
      <p className="muted">Что на каком автомате, сколько можно включать и что делать, если выбило. Можно отправить ссылкой.</p>
      <ShareBlock p={p} owner />
      </TabPanel>
    </Sheet>
  );
}
