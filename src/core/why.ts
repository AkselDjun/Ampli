import type { CfgN, Line, LineResult } from './types';
import { IZ, KZ_TIME, RHO, RHO_20, RHO_HOT_K, SECTIONS, TYPES } from './norms';
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
  const alt = l.apps.some(a => a.alt);
  rows.push({
    title: 'Нагрузка',
    formula: fmt(r.pInst, 0) + NB + 'Вт',
    note: 'Сумма мощностей приборов группы' + (r.sockets > 0 ? ' и розеток (' + r.sockets + ' шт.)' : '') + (alt ? '. Из приборов, отмеченных «не одновременно», в расчёт идёт только самый мощный: ' + fmt(r.pd, 0) + NB + 'Вт.' : ', все приборы группы считаются включёнными одновременно.')
  });
  rows.push({
    title: 'Ток',
    formula: 'I = ' + fmt(r.pd, 0) + (r.cos < 0.999 ? ' / ' + fs(round2(r.cos)) : '') + ' / ' + (r.three ? '(√3 · 400)' : '230') + ' = ' + fmt(r.I, 1) + NB + 'А',
    note: r.cos < 0.999 ? 'cos φ группы ' + fs(round2(r.cos)) + ': у кондиционеров, насосов и компрессоров ток больше, чем мощность / 230 В. cos φ прибора можно задать в списке приборов.' : ''
  });
  if (r.In) {
    const note =
      (r.I <= t.minIn && c.margin === 1 ? 'Для такой группы берём номинал не меньше ' + t.minIn + NB + 'А. ' : 'Ближайший номинал не меньше ' + (c.margin > 1 ? 'тока ' + fmt(r.I, 1) + NB + 'А × запас ' + fs(c.margin) : 'тока ' + fmt(r.I, 1) + NB + 'А') + '. ') +
      'Загрузка автомата ' + fmt(r.load * 100, 0) + NB + '%. ' +
      (l.type === 'light' ? 'Кривая B подходит для освещения.' : 'Кривая C выдерживает пусковые токи приборов.') +
      (r.rcd
        ? (r.rcbo ? ' Дифавтомат ' + r.ma + ' мА: ' : ' Автомат стоит после УЗО ' + r.ma + ' мА помещения «' + r.zone + '»: ') + (l.type === 'power' ? 'для мощных приборов УЗО ставим по практике' : 'для розеток до 32 А и для светильников в жилых помещениях УЗО до 30 мА обязательно (ТКП 339-2022 с изм. № 1, п. 4.3.18.5)') +
          (r.ma === 10 ? '; для розеток вне помещений и в особо опасных помещениях УЗО до 10 мА (СН 4.04.01-2019, п. 16.3.13).' : '.')
        : '');
    rows.push({ title: 'Автомат', formula: r.curve + r.In + (r.rcd ? (r.rcbo ? ', ' : ', УЗО ') + r.ma + ' мА' + (r.rcdA ? ', тип A' : '') : ''), note: note + (r.rcd && r.rcdA ? ' Тип A: в группе есть приборы с электроникой (стиральная машина, индукционная панель, инверторный кондиционер), их ток утечки пульсирующий, УЗО типа AC на него может не реагировать.' : '') });
    const mS = c.safe ? t.minS : 1.5;
    const iCur = tbl.findIndex(v => v * c.k >= (r.In as number));
    const sCur = iCur < 0 ? 0 : SECTIONS[iCur];
    let cn: string;
    const sMin = Math.max(sCur, mS);
    const dropOf = (S: number): number => (r.three ? Math.sqrt(3) * RHO * r.len * r.I / (S * 400) : 2 * RHO * r.len * r.I / (S * 230)) * 100;
    const sDrop = SECTIONS.find(S => S >= sMin && dropOf(S) <= r.limit) ?? sMin;
    if ((r.S as number) > Math.max(sMin, sDrop)) cn = 'Увеличено до ' + fs(r.S as number) + NB + 'мм², чтобы автомат отключил короткое замыкание в конце линии за ' + fs(KZ_TIME) + NB + 'с' + (sDrop > sMin ? ' (по потере напряжения хватило бы ' + fs(sDrop) + NB + 'мм²)' : '') + '.';
    else if ((r.S as number) > sMin) cn = 'Увеличено, чтобы потеря напряжения не превысила ' + fmt(r.limit, 1) + NB + '%.';
    else if (mS > sCur) cn = 'По току хватило бы ' + fs(sCur) + NB + 'мм², но выбран минимум ' + fs(mS) + NB + 'мм² (по ГОСТ 30331.15-2001, табл. 52J, достаточно 1,5 мм²; настройка в параметрах).';
    else cn = 'Наименьшее сечение, у которого допустимый ток с поправкой не меньше номинала автомата.';
    const iz = tbl[SECTIONS.indexOf(r.S as number)] * c.k;
    rows.push({ title: 'Кабель', formula: cableName(r), note: 'Допустимый ток ' + fmt(iz, 1) + NB + 'А с поправкой ' + kk + ' (' + (c.method === 'wall' ? 'скрытая прокладка, способы 2 и 5A' : 'открытая прокладка, способы 4A и 11') + ' по табл. 52Н ГОСТ 30331.15). ' + cn });
    const dv = r.drop * U / 100;
    rows.push({
      title: 'Потеря напряжения',
      formula: 'ΔU = ' + (r.three ? '√3' : '2') + ' · 0,0225 · ' + fmt(r.len, 0) + ' · ' + fmt(r.I, 1) + ' / (' + fs(r.S as number) + ' · ' + U + ') = ' + fmt(dv, 1) + NB + 'В',
      note: (r.len > r.cable - 0.001 ? '' : 'Длина до самой дальней точки: ' + fmt(r.len, 0) + NB + 'м (до коробки и отвод). ') + 'Это ' + fmt(r.drop, 1) + NB + '% при допустимых ' + fmt(r.limit, 1) + NB + '% (СН 4.04.01-2019, п. 9.14' + (c.feeder > 0 ? '; на стояк до щитка заложено ' + fmt(c.feeder, 1) + NB + '%' : '') + ').'
    });
    if (r.len > 0) {
      const zl = loopOhm(r.S as number, r.len);
      rows.push({
        title: 'Короткое замыкание',
        formula: r.ikSrc === 'meas' && r.zsMeas !== null ? 'Iк = 230 / ' + fmt(r.zsMeas, 2) + ' (замер петли) = ' + fmt(r.ik, 0) + NB + 'А' : 'Iк = 230 / (' + fmt(c.zs, 2) + ' + ' + fmt(zl, 2) + ') = ' + fmt(r.ik, 0) + NB + 'А',
        note: 'Нужно не меньше ' + fmt(r.ikNeed, 0) + NB + 'А (' + (r.curve === 'B' ? 5 : 10) + ' × ' + r.curve + r.In + '), чтобы автомат отключил линию за ' + fs(KZ_TIME) + NB + 'с при 230' + NB + 'В (ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1). ' + (r.ikSrc === 'meas' ? 'Ток посчитан по замеренному сопротивлению петли в конце линии, расчётный был бы ' + fmt(230 / (c.zs + zl), 0) + NB + 'А.' : 'Петля фаза-нуль питающей сети ' + fmt(c.zs, 2) + NB + 'Ом задана в параметрах, сопротивление жил фазы и PE взято с коэффициентом ' + fs(RHO_HOT_K) + ' на нагрев к ' + fs(RHO_20) + NB + 'Ом·мм²/м при 20' + NB + '°C.')
      });
    }
  }
  return rows;
}
