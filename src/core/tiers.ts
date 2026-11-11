import type { Calc, Cfg, Project } from './types';
import { calcAll } from './calc';
import { buildSpec, estimate } from './spec';
import { grandTotal, laborEstimate } from './labor';
import type { LaborEstimate, WorkPrices } from './labor';
import type { Markup } from './links';

export type TierId = 'base' | 'safe' | 'max';

export interface TierDef {
  id: TierId;
  title: string;
  about: string;
}

export const TIERS: TierDef[] = [
  { id: 'base', title: 'Базовый', about: 'Щиток по нормам, ничего лишнего' },
  { id: 'safe', title: 'Надёжный', about: 'Плюс защита техники от скачков напряжения и грозы' },
  { id: 'max', title: 'Максимум', about: 'Плюс защита от возгорания проводки' }
];

export const ZERO_MARKUP: Markup = [0, 0, 0];

export const PERKS = {
  vr: 'Реле напряжения: отключит щиток при скачке или обрыве нуля и сбережёт технику',
  spd: 'УЗИП: защита от импульсов при грозе и коммутациях в сети',
  afdd: 'УЗДП на розетках: отключит линию при искрении в проводке, снижает риск пожара',
  brand: 'Аппараты более высокого класса'
} as const;

export function tierCfg(cfg: Cfg, id: TierId): Cfg {
  if (id === 'base') return cfg;
  const safe: Cfg = { ...cfg, vr: 'on', spd: 'on' };
  if (id === 'safe') return safe;
  return { ...safe, afdd: cfg.afdd === 'all' ? 'all' : 'sock' };
}

export function cfgChanges(from: Cfg, to: Cfg): { field: 'vr' | 'spd' | 'afdd'; value: string }[] {
  const out: { field: 'vr' | 'spd' | 'afdd'; value: string }[] = [];
  if ((to.vr === 'on') !== (from.vr === 'on')) out.push({ field: 'vr', value: to.vr ?? '' });
  if ((to.spd === 'on') !== (from.spd === 'on')) out.push({ field: 'spd', value: to.spd ?? '' });
  const fa = from.afdd === 'sock' || from.afdd === 'all' ? from.afdd : 'off';
  const ta = to.afdd === 'sock' || to.afdd === 'all' ? to.afdd : 'off';
  if (fa !== ta) out.push({ field: 'afdd', value: ta });
  return out;
}

export interface TierEstimate {
  def: TierDef;
  cfg: Cfg;
  calc: Calc;
  markup: number;
  materials: number;
  works: number;
  total: number;
  missing: number;
  perks: string[];
  le: LaborEstimate;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function markPrices(prices: Record<string, number>, markup: number): Record<string, number> {
  if (!markup) return prices;
  const out: Record<string, number> = {};
  Object.entries(prices).forEach(([n, v]) => { out[n] = r2(v * (1 + markup / 100)); });
  return out;
}

export function tierEstimates(p: Project, prices: Record<string, number>, labor: WorkPrices, markup: Markup): TierEstimate[] {
  const out: TierEstimate[] = [];
  TIERS.forEach((def, i) => {
    const cfg = tierCfg(p.cfg, def.id);
    const calc = calcAll(p.lines, cfg, p);
    const est = estimate(buildSpec(calc), markPrices(prices, markup[i]));
    const le = laborEstimate(calc, p.work, labor);
    const materials = est.total;
    const prev = out[out.length - 1];
    const perks: string[] = [];
    if (prev) {
      cfgChanges(prev.cfg, cfg).forEach(ch => perks.push(PERKS[ch.field]));
      if (markup[i] > prev.markup) perks.push(PERKS.brand);
    }
    out.push({ def, cfg, calc, markup: markup[i], materials, works: le.total, total: grandTotal(materials, le.total), missing: est.missing, perks, le });
  });
  return out.filter((t, i) => i === 0 || t.perks.length > 0);
}

export function tierPriceNames(p: Project): Set<string> {
  const names = new Set<string>();
  TIERS.forEach(def => {
    const cfg = tierCfg(p.cfg, def.id);
    buildSpec(calcAll(p.lines, cfg, p)).forEach(i => names.add(i.name));
  });
  return names;
}
