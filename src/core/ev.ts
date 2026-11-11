import type { Appliance, Line, LineResult } from './types';
import { pn } from './format';

export const EV_RX = /электромобил|зарядн\S* станц|wallbox/i;
export const EV_ONE_PHASE_MAX_W = 7400;
export const EV_MIN_A = 6;

export const isEvApp = (a: Appliance): boolean => EV_RX.test(a.name);
export const isEvLine = (l: Line): boolean => l.apps.some(isEvApp);

export const evW = (a: Appliance): number => Math.max(0, pn(a.w, 0)) * Math.max(0, pn(a.n, 0));

export function evNotes(l: Line, live: Appliance[], three: boolean, r: LineResult): void {
  const ev = live.filter(isEvApp);
  if (!ev.length) return;
  const warn = (t: string) => {
    r.status = r.status === 'bad' ? 'bad' : 'warn';
    r.notes.push(t);
  };
  if (live.length > ev.length || ev.length > 1) warn('Каждую зарядку электромобиля подключают отдельной группой от щитка, без других приборов: она часами работает на полной мощности.');
  if (!three && ev.some(a => evW(a) > EV_ONE_PHASE_MAX_W)) warn('Станция мощнее 7,4 кВт трёхфазная: нужен трёхфазный ввод и группа на три фазы, иначе выберите станцию 7,4 кВт.');
  if (ev.some(a => a.alt)) r.tips.push('Отметка «Не одновременно» у зарядки занижает расчёт: зарядка длится часами и совпадает с остальной нагрузкой. Ограничьте ток зарядки в настройках станции.');
  r.tips.push('Зарядка электромобиля: УЗО или дифавтомат типа A и контроль постоянного тока утечки 6 мА в самой станции, либо УЗО типа B. Проверьте по паспорту станции.' + (l.out ? '' : ' Если станция на улице или в гараже, отметьте условия «Вне помещения».'));
}
