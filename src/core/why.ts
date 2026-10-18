import type { CfgN, Line, LineResult } from './types';
import { IZ, SECTIONS, TYPES } from './norms';
import { NB, fmt, fs, round2 } from './format';
import { cableName } from './protection';

export interface WhyRow {
  title: string;
  formula: string;
  note: string;
}

export function whyRows(l: Line, r: LineResult, c: CfgN): WhyRow[] {
  const t = TYPES[l.type];
  const U = r.three ? 400 : 230;
  const tbl = IZ[c.method][r.three ? 3 : 1];
  const kk = fs(round2(c.k));
  const rows: WhyRow[] = [];
  rows.push({
    title: 'Нагрузка',
    formula: fmt(r.pInst, 0) + NB + 'Вт' + (r.kc < 1 ? ' × Кс ' + fs(round2(r.kc)) + ' = ' + fmt(r.pd, 0) + NB + 'Вт' : ''),
    note: 'Кс учитывает, что приборы группы работают не все сразу.'
  });
  rows.push({
    title: 'Ток',
    formula: 'I = ' + fmt(r.pd, 0) + ' / (' + (r.three ? '√3 · 400' : '230') + ' · ' + fs(round2(r.cos)) + ') = ' + fmt(r.I, 1) + NB + 'А',
    note: ''
  });
  if (r.In) {
    const note =
      (r.I <= t.minIn ? 'Для такой группы берём номинал не меньше ' + t.minIn + NB + 'А. ' : 'Ближайший номинал не меньше тока ' + fmt(r.I, 1) + NB + 'А. ') +
      (l.type === 'light' ? 'Кривая B подходит для освещения.' : 'Кривая C выдерживает пусковые токи приборов.') +
      (r.rcd
        ? ' Дифавтомат ' + r.ma + ' мА: для таких групп УЗО обязательно (СН 4.04.01-2019, изм. 2, п. 16.3.3)' +
          (r.ma === 100 ? ', при расчётном токе больше 32 А до 100 мА со временем срабатывания не более 100 мс (п. 16.3.13).' : '.')
        : '');
    rows.push({ title: 'Автомат', formula: r.curve + r.In + (r.rcd ? ', ' + r.ma + ' мА' : ''), note });
    const mS = c.safe ? t.minS : 1.5;
    const iCur = tbl.findIndex(v => v * c.k >= (r.In as number));
    const sCur = iCur < 0 ? 0 : SECTIONS[iCur];
    let cn: string;
    if ((r.S as number) > Math.max(sCur, mS)) cn = 'Увеличено, чтобы потеря напряжения не превысила ' + fmt(r.limit, 1) + NB + '%.';
    else if (mS > sCur) cn = 'По току хватило бы ' + fs(sCur) + NB + 'мм², но выбран минимум ' + fs(mS) + NB + 'мм² (по ТКП 339-2022 достаточно 1,5 мм², табл. 8.1; настройка в параметрах).';
    else cn = 'Наименьшее сечение, у которого допустимый ток с поправкой не меньше номинала автомата.';
    const iz = tbl[SECTIONS.indexOf(r.S as number)] * c.k;
    rows.push({ title: 'Кабель', formula: cableName(r), note: 'Допустимый ток ' + fmt(iz, 1) + NB + 'А с поправкой ' + kk + '. ' + cn });
    const dv = r.drop * U / 100;
    rows.push({
      title: 'Потеря напряжения',
      formula: 'ΔU = ' + (r.three ? '√3' : '2') + ' · 0,0225 · ' + fmt(r.len, 0) + ' · ' + fmt(r.I, 1) + ' · ' + fs(round2(r.cos)) + ' / (' + fs(r.S as number) + ' · ' + U + ') = ' + fmt(dv, 1) + NB + 'В',
      note: 'Это ' + fmt(r.drop, 1) + NB + '% при допустимых ' + fmt(r.limit, 1) + NB + '%.'
    });
  }
  return rows;
}
