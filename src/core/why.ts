import type { CfgN, Line, LineResult } from './types';
import { IZ, KZ_TIME, RHO, RHO_HOT_K, SECTIONS, TYPES } from './norms';
import { NB, fmt, fs, round2 } from './format';
import { cableName } from './protection';
import { loopOhm } from './calc';

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
        ? ' Дифавтомат ' + r.ma + ' мА: ' + (l.type === 'power' ? 'для мощных приборов УЗО ставим по практике' : 'для розеток до 32 А и для светильников в жилых помещениях УЗО до 30 мА обязательно (ТКП 339-2022 с изм. № 1, п. 4.3.18.5)') +
          (r.ma === 10 ? '; для розеток вне помещений и в особо опасных помещениях УЗО до 10 мА (СН 4.04.01-2019, п. 16.3.13).' : (r.ma === 100 ? ', при расчётном токе больше 32 А до 100 мА со временем срабатывания не более 100 мс (СН 4.04.01-2019, п. 16.3.13).' : '.'))
        : '');
    rows.push({ title: 'Автомат', formula: r.curve + r.In + (r.rcd ? ', ' + r.ma + ' мА' : ''), note });
    const mS = c.safe ? t.minS : 1.5;
    const iCur = tbl.findIndex(v => v * c.k >= (r.In as number));
    const sCur = iCur < 0 ? 0 : SECTIONS[iCur];
    let cn: string;
    if ((r.S as number) > Math.max(sCur, mS)) cn = 'Увеличено, чтобы потеря напряжения не превысила ' + fmt(r.limit, 1) + NB + '%.';
    else if (mS > sCur) cn = 'По току хватило бы ' + fs(sCur) + NB + 'мм², но выбран минимум ' + fs(mS) + NB + 'мм² (по ГОСТ 30331.15-2001, табл. 52J, достаточно 1,5 мм²; настройка в параметрах).';
    else cn = 'Наименьшее сечение, у которого допустимый ток с поправкой не меньше номинала автомата.';
    const iz = tbl[SECTIONS.indexOf(r.S as number)] * c.k;
    rows.push({ title: 'Кабель', formula: cableName(r), note: 'Допустимый ток ' + fmt(iz, 1) + NB + 'А с поправкой ' + kk + ' (' + (c.method === 'wall' ? 'скрытая прокладка, способы 2 и 5A' : 'открытая прокладка, способы 4A и 11') + ' по табл. 52Н ГОСТ 30331.15). ' + cn });
    const dv = r.drop * U / 100;
    rows.push({
      title: 'Потеря напряжения',
      formula: 'ΔU = ' + (r.three ? '√3' : '2') + ' · 0,0225 · ' + fmt(r.len, 0) + ' · ' + fmt(r.I, 1) + ' · ' + fs(round2(r.cos)) + ' / (' + fs(r.S as number) + ' · ' + U + ') = ' + fmt(dv, 1) + NB + 'В',
      note: 'Это ' + fmt(r.drop, 1) + NB + '% при допустимых ' + fmt(r.limit, 1) + NB + '% (СН 4.04.01-2019, п. 9.14' + (c.feeder > 0 ? '; на стояк до щитка заложено ' + fmt(c.feeder, 1) + NB + '%' : '') + ').'
    });
    if (r.len > 0) {
      const zl = loopOhm(r.S as number, r.len);
      rows.push({
        title: 'Короткое замыкание',
        formula: 'Iк = 230 / (' + fmt(c.zs, 2) + ' + ' + fmt(zl, 2) + ') = ' + fmt(r.ik, 0) + NB + 'А',
        note: 'Нужно не меньше ' + fmt(r.ikNeed, 0) + NB + 'А (' + (r.curve === 'B' ? 5 : 10) + ' × ' + r.curve + r.In + '), чтобы автомат отключил линию за ' + fs(KZ_TIME) + NB + 'с при 230' + NB + 'В (ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1). Петля фаза-нуль питающей сети ' + fmt(c.zs, 2) + NB + 'Ом задана в параметрах, сопротивление жил фазы и PE взято с коэффициентом ' + fs(RHO_HOT_K) + ' на нагрев (' + fs(RHO) + NB + 'Ом·мм²/м).'
      });
    }
  }
  return rows;
}
