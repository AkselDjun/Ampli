import type { Calc, Cfg, Line, Project } from './types';
import { balanceLines, calcAll } from './calc';
import { EV_MIN_A, evW, isEvApp } from './ev';
import { fmt, pn } from './format';

export type FitKind = 'ev' | 'prio' | 'three' | 'alloc';

export interface FitOption {
  kind: FitKind;
  title: string;
  text: string;
  P: number;
  inIn: number | null;
  fits: boolean;
  set?: Record<string, 'p' | 's' | ''>;
  supply?: 3;
  alloc?: number;
  ev?: { line: string; app: string; w: number };
}

export interface PowerFit {
  over: boolean;
  P: number;
  alloc: number;
  allocA: number;
  inIn: number | null;
  options: FitOption[];
}

const SHED_RX = /водонагрев|бойлер|т[её]пл\S* пол|полотенцесуш|сушил|конвектор|обогрев|радиатор|кондиционер|зарядк|насос/i;

export const allocAmps = (a: Calc): number => a.c.alloc * 1000 / (a.c.supply === 3 ? Math.sqrt(3) * 400 : 230);

export const isOver = (a: Calc): boolean => a.P > a.c.alloc * 1000;

const name = (l: Line): string => '«' + (l.name || 'Без названия') + '»';

const sheddable = (l: Line): boolean => l.type === 'power' && l.apps.some(x => SHED_RX.test(x.name));

export function powerFit(p: Project, a: Calc = calcAll(p.lines, p.cfg, p)): PowerFit {
  const alloc = a.c.alloc;
  const options: FitOption[] = [];
  const over = isOver(a) || (a.c.supply === 1 && a.hint3);
  const fits = (b: Calc) => !isOver(b);
  if (isOver(a)) {
    const ev = evLimit(p, a, fits);
    if (ev) options.push(ev);
  }
  if (isOver(a) && !a.prio) {
    const live = a.rows.filter(x => !x.r.empty && x.r.In && x.l.type === 'power');
    const pri = [...live].filter(x => !sheddable(x.l)).sort((x, y) => y.r.pd - x.r.pd)[0];
    if (pri) {
      const cands = live.filter(x => x !== pri && sheddable(x.l)).sort((x, y) => y.r.pd - x.r.pd);
      const shed: Line[] = [];
      let best: Calc | null = null;
      for (const x of cands) {
        shed.push(x.l);
        const lines = p.lines.map(l => (l.id === pri.l.id ? { ...l, prio: 'p' as const } : shed.some(x => x.id === l.id) ? { ...l, prio: 's' as const } : l));
        best = calcAll(lines, p.cfg, p);
        if (fits(best)) break;
      }
      if (best && best.P < a.P) {
        const set: Record<string, 'p' | 's' | ''> = { [pri.l.id]: 'p' };
        shed.forEach(l => { set[l.id] = 's'; });
        options.push({
          kind: 'prio',
          title: 'Реле приоритета нагрузки',
          text: 'Пока работает ' + name(pri.l) + ', реле отключает ' + shed.map(name).join(', ') + '. Отключаемые группы питаются через контактор.',
          P: best.P,
          inIn: best.inIn,
          fits: fits(best),
          set
        });
      }
    }
  }
  if (a.c.supply === 1 && a.hint3) {
    const cfg: Cfg = { ...p.cfg, supply: 3 };
    const b = calcAll(balanceLines(p.lines, cfg), cfg, p);
    options.push({
      kind: 'three',
      title: 'Перейти на три фазы',
      text: 'Нагрузка больше 12 кВт, по СН 4.04.01-2019, п. 9.12 нужен трёхфазный ввод. Группы раскладываются по фазам, вводной автомат C' + (b.inIn ?? '—') + '. Нужны технические условия на трёхфазный ввод.',
      P: b.P,
      inIn: b.inIn,
      fits: fits(b),
      supply: 3
    });
  }
  if (a.P > alloc * 1000) {
    const best = options.find(o => o.kind === 'prio');
    const need = Math.ceil((best && !best.fits ? best.P : a.P) / 500) / 2;
    options.push({
      kind: 'alloc',
      title: 'Увеличить выделенную мощность',
      text: 'Запросить в энергоснабжающей организации ' + String(need).replace('.', ',') + ' кВт вместо ' + String(alloc).replace('.', ',') + ' кВт. Это новые технические условия и обычно самый долгий и дорогой путь.',
      P: a.P,
      inIn: a.inIn,
      fits: true,
      alloc: need
    });
  }
  return { over, P: a.P, alloc, allocA: allocAmps(a), inIn: a.inIn, options };
}

function evLimit(p: Project, a: Calc, fits: (b: Calc) => boolean): FitOption | null {
  for (const x of a.rows) {
    if (x.r.empty) continue;
    const app = x.l.apps.find(q => isEvApp(q) && evW(q) > 0);
    if (!app) continue;
    const volt = x.r.three ? Math.sqrt(3) * 400 : 230;
    for (let amp = Math.ceil(pn(app.w, 0) / volt) - 1; amp >= EV_MIN_A; amp--) {
      const w = Math.round(amp * volt / 10) * 10;
      const lines = p.lines.map(l => (l.id === x.l.id ? { ...l, apps: l.apps.map(q => (q.id === app.id ? { ...q, w } : q)) } : l));
      const b = calcAll(lines, p.cfg, p);
      if (!fits(b)) continue;
      return {
        kind: 'ev',
        title: 'Ограничить ток зарядки',
        text: 'Настройте в станции ' + name(x.l) + ' ток зарядки не больше ' + amp + ' А (' + fmt(w / 1000, 1) + ' кВт) или поставьте станцию с балансировкой по току ввода. Машина заряжается дольше, остальная техника работает как обычно.',
        P: b.P,
        inIn: b.inIn,
        fits: true,
        ev: { line: x.l.id, app: app.id, w }
      };
    }
  }
  return null;
}

export function prioNames(p: Project): { p: string[]; s: string[] } {
  return {
    p: p.lines.filter(l => l.prio === 'p').map(l => l.name || 'Без названия'),
    s: p.lines.filter(l => l.prio === 's').map(l => l.name || 'Без названия')
  };
}
