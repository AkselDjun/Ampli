import type { Calc, Project } from './types';
import { fmt, plural } from './format';
import { buildSpec, estimate } from './spec';
import { cableName, inCableName, inName, protName, uzoName } from './protection';

export const dropText = (drop: number, feeder = 0): string =>
  drop > 0 ? 'не более ' + fmt(drop, 0) + ' %' : fmt(3 - feeder, 1).replace(',0', '') + ' % освещение, ' + fmt(5 - feeder, 1).replace(',0', '') + ' % прочие (СН 4.04.01-2019, п. 9.14' + (feeder > 0 ? ', за вычетом ' + fmt(feeder, 1) + ' % до щитка' : '') + ')';

export function reportText(p: Project, a: Calc, prices: Record<string, number> = {}): string {
  const c = a.c;
  const out: string[] = [];
  out.push('Расчёт электрощита: ' + (p.name || 'Без названия'));
  if (p.address) out.push('Объект: ' + p.address);
  if (p.client) out.push('Заказчик: ' + p.client);
  if (p.author) out.push('Исполнитель: ' + p.author);
  out.push('Питание: ' + (c.supply === 3 ? '3 фазы, 400 В' : '1 фаза, 230 В') + '; прокладка: ' + (c.method === 'wall' ? 'скрытая' : 'открытая') + '; допустимая потеря напряжения: ' + dropText(c.drop, c.feeder));
  out.push('');
  a.rows.forEach((x, i) => {
    const r = x.r;
    const ph = c.supply === 3 ? ' [' + (r.three ? '3Ф' : x.l.phase) + ']' : '';
    if (r.empty) {
      out.push('Г' + (i + 1) + ' ' + x.l.name + ph + ': нет приборов');
      return;
    }
    if (!r.In) {
      out.push('Г' + (i + 1) + ' ' + x.l.name + ph + ': ' + fmt(r.pInst, 0) + ' Вт, ток ' + fmt(r.I, 1) + ' А. ' + r.notes.join(' '));
      return;
    }
    out.push('Г' + (i + 1) + ' ' + x.l.name + ph + ': ' + fmt(r.pInst, 0) + ' Вт, ток ' + fmt(r.I, 1) + ' А, ' + protName(r) + ', ' + cableName(r) + ', ΔU ' + fmt(r.drop, 1) + ' %' + (r.ik > 0 ? ', Iк ' + fmt(r.ik, 0) + ' А' : ''));
  });
  out.push('');
  out.push('Установленная мощность: ' + fmt(a.sumInst / 1000, 1) + ' кВт');
  out.push('Расчётная мощность: ' + fmt(a.P / 1000, 1) + ' кВт, ток ' + fmt(a.Itot, 0) + ' А');
  out.push('Вводной автомат: ' + inName(c, a.inIn) + (a.inS ? ', кабель ' + inCableName(c, a.inS) : ''));
  out.push('Защита групп: ' + (c.rcdMode ? 'УЗО на помещение и автоматы' : 'дифавтомат на каждую группу'));
  a.uzos.forEach(u => out.push(uzoName(u) + ': ' + u.zone + ' (' + u.groups.map(g => 'Г' + (g + 1)).join(', ') + '), своя шина N'));
  if (a.phases) out.push('Фазы: L1 ' + fmt(a.phases.L1, 1) + ' А, L2 ' + fmt(a.phases.L2, 1) + ' А, L3 ' + fmt(a.phases.L3, 1) + ' А');
  out.push('Щиток: ' + a.size + ' ' + plural(a.size, ['модуль', 'модуля', 'модулей']));
  out.push('');
  out.push('Спецификация:');
  buildSpec(a).forEach(x => {
    out.push('- ' + x.name + ' — ' + x.qty + (x.note ? ' (' + x.note + ')' : ''));
  });
  if (Object.keys(prices).length) {
    const e = estimate(buildSpec(a), prices);
    out.push('');
    out.push('Итого по смете: ' + fmt(e.total, 2) + ' BYN' + (e.missing ? ' (цена не задана для ' + e.missing + ' поз.)' : ''));
  }
  return out.join('\n');
}
