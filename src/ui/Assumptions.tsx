import type { CfgN } from '../core/types';
import { BASIS_LABEL, assumptions } from '../core/assumptions';
import { DataTable } from './kit';

export function Assumptions({ cfg, ev = false }: { cfg: CfgN; ev?: boolean }) {
  return (
    <DataTable label="Допущения и источники" className="assum" head={<><th>Параметр</th><th>Значение</th><th>Основание</th></>}>
      {assumptions(cfg, { ev }).map(a => (
        <tr key={a.name}>
          <td className="c-t">{a.name}</td>
          <td className="c-m as-v">{a.value}</td>
          <td className="c-m as-b"><span className={'basis ' + a.basis}>{BASIS_LABEL[a.basis]}</span> {a.source}</td>
        </tr>
      ))}
    </DataTable>
  );
}
