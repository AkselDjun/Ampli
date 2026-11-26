import type { StageAct } from '../core/stage';
import '../styles/stage.css';
import { STAGES } from '../core/stage';
import { IconChev, IconDown } from './Icons';
import { MenuButton } from './MenuButton';

export function StageBar({ n, sentAt, onStage, onAct, pill }: {
  pill?: boolean;
  n: number;
  sentAt?: string;
  onStage: (n: number) => void;
  onAct: (a: StageAct) => void;
}) {
  const st = STAGES[n];
  const act = st.act;
  if (pill) {
    return (
      <span className="stg-w" data-stage={n}>
      <MenuButton
        className="stg-pill"
        box="stg-dd"
        menuClass="stg-menu"
        label={'Этап: ' + st.name + '. Сменить этап'}
        trigger={<><span className="sd" aria-hidden="true" /><span className="vh">Этап проекта: </span>{st.name}<IconDown className="dd-c" /></>}
        groups={[
          { id: 'next', title: 'Следующий шаг', items: act ? [{ id: 'next', label: act.label, hint: st.next, icon: <IconChev />, run: () => onAct(act) }] : [] },
          {
            id: 'st',
            title: 'Этап проекта',
            items: STAGES.map((s, i) => ({
              id: String(i),
              label: s.name,
              hint: i === 1 && sentAt ? s.sub + ' · ' + sentAt : s.sub,
              mark: i < n ? '✓' : String(i + 1),
              current: i === n,
              run: () => onStage(i)
            }))
          }
        ]}
      />
      </span>
    );
  }
  return (
    <div className="stg" role="group" aria-label="Этап проекта" data-stage={n}>
      <MenuButton
        className="stg-b"
        box="stg-dd"
        label={'Этап: ' + st.name + '. Сменить этап'}
        trigger={
          <>
            <span className="stg-dots" aria-hidden="true">
              {STAGES.map((_, i) => <i key={i} className={i <= n ? 'on' : undefined} />)}
            </span>
            <span className="stg-n">{st.name}</span>
            <IconChev className="chev" />
          </>
        }
        groups={[{
          id: 'st',
          title: 'Этап проекта',
          items: STAGES.map((s, i) => ({
            id: String(i),
            label: s.name,
            hint: i === 1 && sentAt ? s.sub + ' · ' + sentAt : s.sub,
            mark: String(i + 1),
            current: i === n,
            run: () => onStage(i)
          }))
        }]}
      />
      <p className="stg-next"><span className="vh">Следующий шаг: </span>{st.next}</p>
      {st.act && (
        <button type="button" className="stg-go" onClick={() => st.act && onAct(st.act)}>
          {st.act.label}
        </button>
      )}
    </div>
  );
}
