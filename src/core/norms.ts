import type { LineType } from './types';

export const STD = [6, 10, 16, 20, 25, 32, 40, 50, 63];
export const STD_IN = [16, 20, 25, 32, 40, 50, 63, 80, 100];
export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35];

export const IZ: Record<'wall' | 'open', Record<1 | 3, number[]>> = {
  wall: { 1: [19, 27, 38, 46, 70, 85, 115, 135], 3: [17, 25, 35, 42, 60, 80, 100, 125] },
  open: { 1: [23, 30, 41, 50, 80, 100, 140, 170], 3: [23, 30, 41, 50, 80, 100, 140, 170] }
};

export const RHO = 0.0225;
export const RHO_20 = 0.0175;
export const RHO_HOT_K = 1.5;
export const ALL_STEPS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
export const TRIP_MULT: Record<string, number> = { B: 5, C: 10 };
export const PE_MAX_S = 16;
export const KZ_TIME = 0.4;
export const SINGLE_INPUT_KW = 12;
export const INS_MIN_MOHM = 0.5;
export const LEAK_FRACTION = 1 / 3;
export const rcdTripMs = (ma: number): number => (ma > 30 ? 500 : 300);
export const RCD_STD_REF = 'ГОСТ IEC 61008-1 и ГОСТ IEC 61009-1, табл. 1';
export const LEAK_PER_M_MA = 0.01;
export const LEAK_PER_A_MA = 0.4;
export const SIZES = [12, 18, 24, 36, 48, 72];
export const HEAT_RX = /водонагрев|бойлер|кот[её]л|т[её]плый пол|конвектор|электроотоп|полотенцесуш|проточн/i;
export const HEAT_PLUG_KW = 5;
export const TYPE_A_RX = /стиральн|сушильн|посудомо|индукц|варочн|электроплит|кондицион|тепловой насос|электромобил|зарядная станц|wallbox/i;
export const VR_STD = [40, 50, 63];
export const SN_CH2_DATE = '07.12.2026';
export const RCD_STD = [16, 25, 40, 63, 80, 100];
export const RCD10_MAX_IN = 40;
export const MOTOR_RX = /кондицион|тепловой насос|насос|компрессор/i;
export const MOTOR_COS = 0.8;
export const LONG_RX = /стиральн|сушильн|посудомо|водонагрев|бойлер/i;
export const LONG_MIN_IN = 16;
export const LOAD_WARN = 0.9;
export const MARGIN_MAX = 1.5;
export const BOX_NAME: Record<'brick' | 'gkl' | 'surface', string> = { brick: 'для бетона и кирпича', gkl: 'для гипсокартона', surface: 'накладная IP54' };
export const IN_CABLE: Record<'vvg' | 'frls' | 'nym', string> = { vvg: 'ВВГнг(А)-LS', frls: 'ВВГнг(А)-FRLS', nym: 'NYM' };
export const ROWLEN: Record<number, number> = { 12: 12, 18: 18, 24: 12, 36: 18, 48: 12, 72: 18 };

export interface TypeDef {
  label: string;
  short: string;
  minS: number;
  minIn: number;
  curve: string;
  rcd: boolean;
  tag: string;
}

export const TYPES: Record<LineType, TypeDef> = {
  light: { label: 'Освещение', short: 'Свет', minS: 1.5, minIn: 10, curve: 'B', rcd: true, tag: 'l' },
  socket: { label: 'Розетки', short: 'Розетки', minS: 2.5, minIn: 16, curve: 'C', rcd: true, tag: 's' },
  power: { label: 'Мощный прибор', short: 'Мощный', minS: 2.5, minIn: 10, curve: 'C', rcd: true, tag: 'p' }
};

export const TYPE_KEYS = Object.keys(TYPES) as LineType[];

export const PRESETS: [string, number, string][] = [
  ['Чайник', 2200, 's'], ['Микроволновая печь', 1200, 's'], ['Холодильник', 150, 's'], ['Вытяжка', 200, 's'],
  ['Посудомоечная машина', 2000, 'sp'], ['Стиральная машина', 2200, 'sp'], ['Духовой шкаф', 2500, 'p'],
  ['Варочная панель', 4500, 'p'], ['Электроплита', 7000, 'p'], ['Водонагреватель', 2000, 'p'],
  ['Кондиционер', 1200, 'p'], ['Телевизор', 150, 's'], ['Компьютер', 400, 's'], ['Пылесос', 1600, 's'],
  ['Фен', 1800, 's'], ['Утюг', 2200, 's'], ['Обогреватель', 1500, 'sp'], ['Тёплый пол', 800, 'p'],
  ['Светильник', 60, 'l'], ['Люстра', 180, 'l'], ['LED-лента', 14, 'l'], ['Зарядка электромобиля', 7400, 'p']
];

export const STATUS = { ok: 'Норма', warn: 'Проверьте', bad: 'Не подходит' } as const;

export const CLIMITS: Record<string, [number, number]> = { ko: [0.3, 1], k: [0.5, 1], alloc: [1, 500], zs: [0.05, 2], feeder: [0, 3], margin: [1, 1.5], sip: [0, 500], rz: [0, 500] };
