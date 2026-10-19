import type { Calc } from './types';
import { fmt, pn } from './format';
import { protName } from './protection';

export interface PassItem {
  name: string;
  watts: number;
}

export interface PassRow {
  no: string;
  name: string;
  where: string;
  prot: string;
  rcd: boolean;
  capW: number;
  totalW: number;
  heavy: PassItem[];
  together: string | null;
}

export interface PassInput {
  text: string;
  allocKw: number;
  pKw: number;
}

export const TRIP_STEPS = [
  'Выключите или выдерните из розеток приборы этой группы.',
  'Поднимите рычаг автомата вверх.',
  'Если автомат держит, подключайте приборы по одному. Тот, при котором снова отключилось, перегружает группу или неисправен.',
  'Если автомат не включается или отключается сразу при пустой группе, не удерживайте рычаг и не заменяйте автомат на более мощный. Вызовите электрика.'
];

export const TEST_NOTE = 'У дифавтоматов и УЗО есть кнопка «Т» (тест). Изготовители рекомендуют нажимать её раз в месяц: аппарат должен отключиться. Если не отключился, вызовите электрика.';

export const SCOPE_NOTE = 'Паспорт составлен по расчёту Ampli и носит справочный характер. Фактическое состояние щитка и проводки подтверждает монтажник и протокол замеров.';

const roundTo = (v: number, step: number): number => Math.round(v / step) * step;

export function passportRows(a: Calc): PassRow[] {
  const out: PassRow[] = [];
  a.rows.forEach((x, i) => {
    const r = x.r;
    if (r.empty || !r.In) return;
    const items: PassItem[] = x.l.apps
      .map(ap => ({ name: ap.name.trim(), watts: pn(ap.w, 0) * Math.max(1, pn(ap.n, 1)) }))
      .filter(it => it.name && it.watts > 0)
      .sort((p, q) => q.watts - p.watts);
    const u = r.three ? 400 * Math.sqrt(3) : 230;
    const capW = roundTo(u * r.In * (r.cos > 0 ? r.cos : 1), 100);
    const totalW = items.reduce((s, it) => s + it.watts, 0);
    const together = items.length > 1 && totalW > capW
      ? items[0].name + ' и ' + items[1].name
      : null;
    out.push({
      no: 'Г' + (i + 1),
      name: x.l.name || 'Без названия',
      where: (x.l.where ?? '').trim(),
      prot: protName(r),
      rcd: r.rcd,
      capW,
      totalW,
      heavy: items.slice(0, 3),
      together
    });
  });
  return out;
}

export function passportInput(a: Calc): PassInput {
  const three = a.c.supply === 3;
  return {
    text: a.inIn ? 'Вводной автомат ' + (three ? '4P' : '2P') + ' C' + a.inIn : 'Вводной автомат не подобран',
    allocKw: a.c.alloc,
    pKw: Math.round(a.P / 100) / 10
  };
}

export const watts = (w: number): string => fmt(w, 0) + ' Вт';
