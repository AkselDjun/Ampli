import type { LineResult } from './types';
import { fs } from './format';

export const poles = (r: LineResult): string => (r.three ? (r.rcd ? '4P' : '3P') : (r.rcd ? '1P+N' : '1P'));

export const protFull = (r: LineResult): string =>
  (r.rcd ? 'Дифавтомат ' : 'Автомат ') + poles(r) + ' ' + r.curve + r.In + (r.rcd ? ' ' + r.ma + ' мА' : '');

export const protName = (r: LineResult): string =>
  (r.rcd ? 'Дифавтомат ' : 'Автомат ') + r.curve + r.In + (r.rcd ? ' · ' + r.ma + ' мА' : '');

export const cableName = (r: LineResult): string => 'ВВГнг(А)-LS ' + (r.three ? 5 : 3) + '×' + fs(r.S as number);
