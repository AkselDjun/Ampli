import type { Calc, OldSign, OldWiring, Project } from '../core/types';
import { OLD_EMPTY, OLD_SIGNS, oldVerdict } from '../core/oldwire';
import type { OldKey } from '../core/oldwire';
import type { Action } from '../store/reducer';
import { plural } from '../core/format';
import { ArmButton, DoneFoot, Seg, Sheet } from './common';
import { IconAlert, IconDone } from './Icons';
import type { PrintMode } from './WorkSheet';
import { Button } from './kit';

const pillK = (k: string): string => (k === 'none' ? 'warn' : k);

export function Findings({ o, a }: { o: OldWiring | undefined; a: Calc }) {
  const v = oldVerdict(o, a);
  return (
    <>
      <ul className="ow-list">
        {v.findings.map(f => (
          <li key={f.id} className={'ow-f k-' + f.k}>
            {f.k === 'ok' ? <IconDone className="ow-i" /> : <IconAlert className="ow-i" />}
            <div>
              <b>{f.title}</b>
              <p>{f.text}</p>
              <small>{f.practice ? <span className="ow-pr">практика</span> : f.ref}</small>
            </div>
          </li>
        ))}
      </ul>
      {v.groups.length > 0 && (
        <ul className="ow-gr" aria-label="Группы проекта на старой линии">
          {v.groups.map(g => (
            <li key={g.no} className={g.fit ? 'ok' : 'bad'}>
              <span className="ow-no">{g.no}</span>
              <span className="ow-nm">{g.name}</span>
              <span className="ow-v">{g.fit ? 'можно на старой линии' : 'новая линия'}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function OldSheet({ open, onClose, p, a, dispatch, onPrint }: { open: boolean; onClose: () => void; p: Project; a: Calc; dispatch: (x: Action) => void; onPrint: (m: PrintMode) => void }) {
  const o = p.old ?? OLD_EMPTY;
  const v = oldVerdict(p.old, a);
  const set = (field: OldKey) => (value: string | number) => dispatch({ t: 'old', field, value: String(value) });
  const seg = (field: OldKey, label: string, items: [string, string][]) => (
    <div className="f">
      <span className="lbl" id={'l-ow-' + field}>{label}</span>
      <Seg<string> name={'ow-' + field} labelledBy={'l-ow-' + field} value={String(o[field])} items={items} onChange={set(field)} />
    </div>
  );
  const bad = v.findings.filter(f => f.k === 'bad').length;
  const warn = v.findings.filter(f => f.k === 'warn').length;
  return (
    <Sheet open={open} onClose={onClose} title="Старая проводка" kind="panel" footer={<DoneFoot onDone={onClose} status={v.label} />} tip="Обследование проводки перед ремонтом: что можно оставить, что заменить и что сделать с PE и УЗО. Выводы со ссылками на ТКП 339-2022, СН 4.04.01-2019, ПУЭ и ГОСТ 30331.15. Пометка «практика» означает совет без прямой нормы.">
      <div className={'ow-head k-' + v.status}>
        <span className={'pill ' + pillK(v.status)}>{v.label}</span>
        <span className="muted">{v.status === 'none' ? 'Ответьте на вопросы ниже, вывод появится сразу' : [bad ? bad + ' ' + plural(bad, ['замечание', 'замечания', 'замечаний']) : '', warn ? warn + ' ' + plural(warn, ['условие', 'условия', 'условий']) : ''].filter(Boolean).join(', ') || 'Замечаний нет'}</span>
      </div>
      <div className="ow-form">
        {seg('metal', 'Материал жил', [['', 'Не знаю'], ['cu', 'Медь'], ['al', 'Алюминий']])}
        {seg('sec', 'Сечение жил групп, мм²', [['0', 'Не знаю'], ['1.5', '1,5'], ['2.5', '2,5'], ['4', '4'], ['6', '6']])}
        {seg('pe', 'Третий провод PE в розетках', [['', 'Не знаю'], ['yes', 'Есть'], ['no', 'Нет'], ['jumper', 'Перемычка с N']])}
        {seg('net', 'Этажный щит', [['', 'Не знаю'], ['tncs', 'Есть PE'], ['tnc', 'Только PEN']])}
        {seg('panel', 'Щиток квартиры', [['', 'Не знаю'], ['fuse', 'Пробки'], ['old', 'Старые автоматы'], ['mod', 'Модульный']])}
        <div className="ow-nums">
          <label className="f"><span className="lbl">Наименьшая изоляция, МОм</span><input type="text" inputMode="decimal" min={0} step={0.1} placeholder="по замеру" value={o.ins} onChange={e => set('ins')(e.target.value)} /></label>
          <label className="f"><span className="lbl">Возраст проводки, лет</span><input type="text" inputMode="numeric" min={0} max={120} step={1} placeholder="примерно" value={o.age} onChange={e => set('age')(e.target.value)} /></label>
        </div>
        <fieldset className="ow-signs">
          <legend className="lbl">Что видно при осмотре</legend>
          {OLD_SIGNS.map(([id, label]) => (
            <label key={id}>
              <input type="checkbox" checked={o.signs.includes(id)} onChange={e => dispatch({ t: 'oldSign', id: id as OldSign, on: e.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {v.status !== 'none' && (
        <>
          <h3 className="sec-t">Вывод</h3>
          <Findings o={p.old} a={a} />
          <div className="copy-row">
            <Button variant="primary" onClick={() => onPrint('old')}>Печать заключения</Button>
            <ArmButton label="Очистить ответы" onRun={() => dispatch({ t: 'oldReset' })} />
          </div>
        </>
      )}
    </Sheet>
  );
}
