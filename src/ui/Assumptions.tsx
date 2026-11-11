import type { CfgN } from '../core/types';
import { BASIS_LABEL, assumptions } from '../core/assumptions';

export function Assumptions({ cfg, ev = false }: { cfg: CfgN; ev?: boolean }) {
  return (
    <div className="tablewrap" role="region" aria-label="Допущения и источники" tabIndex={0}>
      <table className="t2 assum">
        <thead>
          <tr><th>Параметр</th><th>Значение</th><th>Основание</th></tr>
        </thead>
        <tbody>
          {assumptions(cfg, { ev }).map(a => (
            <tr key={a.name}>
              <td>{a.name}</td>
              <td>{a.value}</td>
              <td><span className={'basis ' + a.basis}>{BASIS_LABEL[a.basis]}</span> {a.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
