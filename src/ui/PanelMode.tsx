import type { Calc } from '../core/types';
import { fmt } from '../core/format';
import { VERDICT, protocolRows } from '../core/protocol';
import { cableName } from '../core/protection';
import type { Action } from '../store/reducer';
import { Sheet } from './common';

type Field = 'zs' | 'ins' | 'leak';

const FIELDS: { f: Field; label: string; unit: string; step: number }[] = [
  { f: 'zs', label: 'Петля', unit: 'Ом', step: 0.01 },
  { f: 'ins', label: 'Изоляция', unit: 'МОм', step: 0.1 },
  { f: 'leak', label: 'Утечка', unit: 'мА', step: 0.1 }
];

export function PanelMode({ open, onClose, a, dispatch }: { open: boolean; onClose: () => void; a: Calc; dispatch: (x: Action) => void }) {
  const rows = protocolRows(a);
  const byNo = new Map(a.rows.map((x, i) => ['Г' + (i + 1), x]));
  return (
    <Sheet open={open} onClose={onClose} title="На щитке" tip="Крупные номиналы и поля замеров для работы у щитка. Замеры сразу попадают в проверки и протокол.">
      {rows.length === 0 && <p className="muted">Добавьте группы с приборами, они появятся здесь.</p>}
      <ul className="pm-list">
        {rows.map(r => {
          const x = byNo.get(r.no);
          if (!x) return null;
          const m = x.l.meas ?? {};
          return (
            <li key={x.l.id} className={'pm ' + r.verdict}>
              <div className="pm-head">
                <span className="no">{r.no}</span>
                <span className="pm-name">{r.name}</span>
                <span className={'pill ' + (r.verdict === 'ok' ? 'ok' : (r.verdict === 'bad' ? 'bad' : 'warn'))}>{VERDICT[r.verdict]}</span>
              </div>
              <div className="pm-prot">
                <b className="mono">{r.prot}</b>
                <span className="mono">{x.r.In ? cableName(x.r) : ''}</span>
              </div>
              <div className="pm-in">
                {FIELDS.map(fd => (
                  <label key={fd.f} className="f">
                    <span className="lbl">{fd.label}, {fd.unit}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={fd.step}
                      aria-label={r.no + ': ' + fd.label + ', ' + fd.unit}
                      value={String(m[fd.f] ?? '')}
                      onChange={e => dispatch({ t: 'lineMeasAt', id: x.l.id, field: fd.f, value: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="pm-note">
                {r.zs !== null && <span>Iк {fmt(r.ik as number, 0)} А, нужно {fmt(r.need, 0)} А</span>}
                {r.leak !== null && <span>Утечка до {fmt(r.leakLim, 1)} мА</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
