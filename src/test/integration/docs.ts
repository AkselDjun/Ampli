import type { Calc, Project } from '../../core/types';
import { calcAll } from '../../core/calc';
import { buildSpec, estimate } from '../../core/spec';
import { passportInput, passportRows } from '../../core/passport';
import { protocolRows } from '../../core/protocol';
import { cableRuns, hiddenMaterials, hiddenWorks } from '../../core/acts';
import { autoQty, laborEstimate } from '../../core/labor';
import { tierEstimates } from '../../core/tiers';
import { reportText } from '../../core/report';
import { exportTables, toCsv } from '../../core/export';
import { powerFit } from '../../core/powerfit';
import { withoutIds } from './full';

export const PRICES: Record<string, number> = { 'Шина PE (заземления)': 4.5, 'Реле приоритета нагрузки': 95 };
export const LABOR = { panel: 120, module: 9, cable: 2.4, socket: 8, light: 7, power: 25, floor: 15, weak: 6, weakCable: 1.2 };
export const MARKUP: [number, number, number] = [5, 10, 15];

export const calc = (p: Project): Calc => calcAll(p.lines, p.cfg, p);

export function documents(p: Project) {
  const a = calc(p);
  const spec = buildSpec(a);
  return withoutIds({
    groups: a.rows.map(x => ({ name: x.l.name, r: x.r })),
    panel: { devs: a.devs, size: a.size, placed: a.placed, inIn: a.inIn, inS: a.inS, uzos: a.uzos, prio: a.prio, phases: a.phases, issues: a.issues },
    house: a.house,
    weak: a.weak,
    floor: a.floor,
    spec,
    estimate: estimate(spec, PRICES),
    passport: { rows: passportRows(a), input: passportInput(a) },
    protocol: protocolRows(a),
    acts: { runs: cableRuns(a), works: hiddenWorks(a), materials: hiddenMaterials(a) },
    labor: { auto: autoQty(a), est: laborEstimate(a, p.work, LABOR) },
    tiers: tierEstimates(p, PRICES, LABOR, MARKUP),
    report: reportText(p, a, PRICES),
    csv: toCsv(...exportTables(a, PRICES, LABOR, p.work)),
    fit: powerFit(p, a)
  });
}
