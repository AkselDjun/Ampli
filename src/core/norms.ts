import type { LineType } from './types';

export const STD = [6, 10, 16, 20, 25, 32, 40, 50, 63];
export const STD_IN = [16, 20, 25, 32, 40, 50, 63, 80, 100];
export const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35];

export const IZ: Record<'wall' | 'open', Record<1 | 3, number[]>> = {
  wall: { 1: [19, 27, 38, 46, 70, 85, 115, 135], 3: [17, 25, 35, 42, 60, 80, 100, 125] },
  open: { 1: [23, 30, 41, 50, 80, 100, 140, 170], 3: [23, 30, 41, 50, 80, 100, 140, 170] }
};

export const RHO = 0.0225;
export const SIZES = [12, 18, 24, 36, 48, 72];
export const ROWLEN: Record<number, number> = { 12: 12, 18: 18, 24: 12, 36: 18, 48: 12, 72: 18 };

export interface TypeDef {
  label: string;
  short: string;
  kc: number;
  cos: number;
  minS: number;
  minIn: number;
  curve: string;
  rcd: boolean;
  tag: string;
}

export const TYPES: Record<LineType, TypeDef> = {
  light: { label: 'Освещение', short: 'Свет', kc: 1, cos: 0.95, minS: 1.5, minIn: 10, curve: 'B', rcd: true, tag: 'l' },
  socket: { label: 'Розетки', short: 'Розетки', kc: 0.7, cos: 0.95, minS: 2.5, minIn: 16, curve: 'C', rcd: true, tag: 's' },
  power: { label: 'Мощный прибор', short: 'Мощный', kc: 1, cos: 1, minS: 2.5, minIn: 10, curve: 'C', rcd: true, tag: 'p' }
};

export const TYPE_KEYS = Object.keys(TYPES) as LineType[];

export const PRESETS: [string, number, string][] = [
  ['Чайник', 2200, 's'], ['Микроволновая печь', 1200, 's'], ['Холодильник', 150, 's'], ['Вытяжка', 200, 's'],
  ['Посудомоечная машина', 2000, 'sp'], ['Стиральная машина', 2200, 'sp'], ['Духовой шкаф', 2500, 'p'],
  ['Варочная панель', 4500, 'p'], ['Электроплита', 7000, 'p'], ['Водонагреватель', 2000, 'p'],
  ['Кондиционер', 1200, 'p'], ['Телевизор', 150, 's'], ['Компьютер', 400, 's'], ['Пылесос', 1600, 's'],
  ['Фен', 1800, 's'], ['Утюг', 2200, 's'], ['Обогреватель', 1500, 'sp'], ['Тёплый пол', 800, 'p'],
  ['Светильник', 60, 'l'], ['Люстра', 180, 'l'], ['LED-лента', 40, 'l']
];

export const STATUS = { ok: 'Норма', warn: 'Проверьте', bad: 'Не подходит' } as const;

export const CLIMITS: Record<string, [number, number]> = { ko: [0.3, 1], k: [0.5, 1], alloc: [1, 500] };
