import type { CfgN } from './types';
import { INS_MIN_MOHM, KZ_TIME, LEAK_FRACTION, LEAK_PER_M_MA, PE_MAX_S, RHO, RHO_HOT_K, SINGLE_INPUT_KW, TRIP_MULT, TYPES } from './norms';
import { fmt, fs } from './format';

export type Basis = 'norm' | 'practice' | 'user';

export interface Assumption {
  name: string;
  value: string;
  basis: Basis;
  source: string;
}

export const BASIS_LABEL: Record<Basis, string> = {
  norm: 'Норма',
  practice: 'Практика',
  user: 'Задано вами'
};

export function assumptions(c: CfgN): Assumption[] {
  return [
    { name: 'Допустимые токи жил', value: 'медь, поправка ' + fs(c.k), basis: 'norm', source: 'ПУЭ, табл. 1.3.4 (значения сверены); поправка на температуру и группировку задана вами' },
    { name: 'Прокладка', value: c.method === 'open' ? 'открытая' : 'скрытая, в трубе', basis: 'user', source: 'Параметры сети' },
    { name: 'Наименьшее сечение жилы', value: fs(TYPES.light.minS) + ' мм² (свет), ' + fs(TYPES.socket.minS) + ' мм² (розетки, мощные)', basis: 'norm', source: 'ТКП 339-2022, п. 8.4.4, табл. 8.1; строгая норма включается в параметрах' },
    { name: 'Удельное сопротивление меди', value: fs(RHO) + ' Ом·мм²/м', basis: 'practice', source: 'Расчёт потери напряжения при нагретой жиле, с запасом' },
    { name: 'Допустимая потеря напряжения', value: '3 % свет, 5 % прочие', basis: 'norm', source: 'СН 4.04.01-2019, п. 9.14' },
    { name: 'Время отключения КЗ', value: fs(KZ_TIME) + ' с при 230 В', basis: 'norm', source: 'ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1' },
    { name: 'Ток мгновенного срабатывания', value: 'B: ' + TRIP_MULT.B + '×In, C: ' + TRIP_MULT.C + '×In', basis: 'practice', source: 'Верхняя граница диапазона срабатывания автомата по ГОСТ IEC 60898-1' },
    { name: 'Петля фаза-нуль питающей сети', value: fmt(c.zs, 2) + ' Ом', basis: 'user', source: 'Параметры сети; замер в карточке группы заменяет расчёт' },
    { name: 'Сопротивление петли жил', value: 'ρ × ' + fs(RHO_HOT_K) + ', PE равен фазе до ' + PE_MAX_S + ' мм²', basis: 'practice', source: 'Запас на нагрев при КЗ; PE по ГОСТ 30331.15-2001, п. 524.2' },
    { name: 'Ток УЗО', value: '30 мА, мокрые помещения 10 мА, свыше 32 А 100 мА', basis: 'norm', source: 'СН 4.04.01-2019, изм. 2, п. 16.3.3, 16.3.13' },
    { name: 'Ток утечки', value: 'не более ' + fs(Math.round(LEAK_FRACTION * 100)) + ' % уставки; оценка ' + fs(LEAK_PER_M_MA) + ' мА/м', basis: 'norm', source: 'СН 4.04.01-2019, п. 16.3.7 (граница); оценка по длине принята по практике' },
    { name: 'Сопротивление изоляции', value: 'не менее ' + fs(INS_MIN_MOHM) + ' МОм', basis: 'norm', source: 'ТКП 339-2022, п. 4.4.29.2' },
    { name: 'Однофазный ввод', value: 'до ' + SINGLE_INPUT_KW + ' кВт', basis: 'norm', source: 'СН 4.04.01-2019, п. 9.12' },
    { name: 'Вводной автомат', value: 'на две ступени выше наибольшего группового', basis: 'norm', source: 'СН 4.04.01-2019, п. 10.5' },
    { name: 'Коэффициент одновременности Ко', value: fs(c.ko), basis: 'user', source: 'Задан вами; значение по умолчанию принято по практике' },
    { name: 'Кс, cos φ, мощности приборов', value: 'по типу группы и справочнику приборов', basis: 'practice', source: 'Типовые значения, не из норм: проверьте по паспорту оборудования' }
  ];
}
