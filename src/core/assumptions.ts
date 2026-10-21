import type { CfgN } from './types';
import { INS_MIN_MOHM, KZ_TIME, LEAK_LOAD_ABOVE_A, LEAK_PER_A_MA, LEAK_PER_M_MA, PE_MAX_S, RHO, RHO_HOT_K, SINGLE_INPUT_KW, TRIP_MULT, TYPES } from './norms';
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
    { name: 'Допустимые токи жил', value: 'медь, поправка ' + fs(c.k), basis: 'norm', source: 'ПУЭ, табл. 1.3.4 (значения сверены); поправка на температуру по табл. 1.3.3 считается в параметрах, группировку учтите сами' },
    { name: 'Прокладка', value: c.method === 'open' ? 'открытая' : 'скрытая, в трубе', basis: 'user', source: 'Параметры сети' },
    { name: 'Наименьшее сечение жилы', value: fs(TYPES.light.minS) + ' мм² (свет), ' + fs(TYPES.socket.minS) + ' мм² (розетки, мощные)', basis: 'norm', source: 'ГОСТ 30331.15-2001, табл. 52J; строгая норма включается в параметрах' },
    { name: 'Удельное сопротивление меди', value: fs(RHO) + ' Ом·мм²/м', basis: 'norm', source: 'ГОСТ Р 50571.5.52, прил. G: 1,25 × ρ при 20 °C (ссылка из справки, по тексту не сверена)' },
    { name: 'Допустимая потеря напряжения', value: '3 % свет, 5 % прочие', basis: 'norm', source: 'СН 4.04.01-2019, п. 9.14' },
    { name: 'Время отключения КЗ', value: fs(KZ_TIME) + ' с при 230 В', basis: 'norm', source: 'ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1' },
    { name: 'Ток мгновенного срабатывания', value: 'B: ' + TRIP_MULT.B + '×In, C: ' + TRIP_MULT.C + '×In', basis: 'practice', source: 'Верхняя граница диапазона срабатывания автомата по ГОСТ IEC 60898-1' },
    { name: 'Петля фаза-нуль питающей сети', value: fmt(c.zs, 2) + ' Ом', basis: 'user', source: 'Параметры сети; замер в карточке группы заменяет расчёт' },
    { name: 'Сопротивление петли жил', value: 'ρ × ' + fs(RHO_HOT_K) + ', PE равен фазе до ' + PE_MAX_S + ' мм²', basis: 'practice', source: 'Множитель 1,5 на нагрев при КЗ по ГОСТ Р 50571.16 (по тексту не сверен), вместе с ρ = 0,0225 даёт запас; PE по ГОСТ 30331.15-2001, п. 524.2' },
    { name: 'Ток УЗО', value: '30 мА на розетки и свет, мокрые помещения 10 мА, свыше 32 А 100 мА', basis: 'norm', source: 'ТКП 339-2022 с изм. № 1, п. 4.3.18.5; СН 4.04.01-2019, п. 16.3.13. На мощные приборы УЗО ставится по практике' },
    { name: 'Время отключения УЗО при IΔn', value: '30 мА: 0,5 с; 10 мА: 5 с; свыше 30 мА: 2 с', basis: 'norm', source: 'ТКП 339-2022 с изм. № 1, табл. 4.4.47, 4.4.48 (УЗО типа AC)' },
    { name: 'Ток утечки', value: 'не более 1/3 уставки; сеть ' + fs(LEAK_PER_M_MA) + ' мА/м, приборы свыше ' + LEAK_LOAD_ABOVE_A + ' А по ' + fs(LEAK_PER_A_MA) + ' мА/А', basis: 'norm', source: 'СН 4.04.01-2019, п. 16.3.7' },
    { name: 'Сопротивление изоляции', value: 'не менее ' + fs(INS_MIN_MOHM) + ' МОм', basis: 'norm', source: 'ТКП 339-2022, п. 4.4.29.2' },
    { name: 'Однофазный ввод', value: 'до ' + SINGLE_INPUT_KW + ' кВт', basis: 'norm', source: 'СН 4.04.01-2019, п. 9.12' },
    { name: 'Вводной автомат', value: 'на две ступени выше наибольшего группового', basis: 'norm', source: 'СН 4.04.01-2019, п. 10.5' },
    { name: 'Коэффициент одновременности Ко', value: fs(c.ko), basis: 'user', source: 'Задан вами; значение по умолчанию принято по практике' },
    { name: 'Кс, cos φ, мощности приборов', value: 'по типу группы и справочнику приборов', basis: 'practice', source: 'Типовые значения, не из норм: проверьте по паспорту оборудования' }
  ];
}
