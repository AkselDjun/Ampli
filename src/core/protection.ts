import type { CfgN, LineResult, Uzo } from './types';
import { IN_CABLE } from './norms';
import { fs } from './format';

export const poles = (r: LineResult): string => (r.three ? (r.rcbo ? '4P' : '3P') : (r.rcbo ? '1P+N' : '1P'));

export const protFull = (r: LineResult): string =>
  (r.rcbo ? 'Дифавтомат ' : 'Автомат ') + poles(r) + ' ' + r.curve + r.In + (r.rcbo ? ' ' + r.ma + ' мА' : '');

export const protName = (r: LineResult): string =>
  (r.rcbo ? 'Дифавтомат ' : 'Автомат ') + r.curve + r.In + (r.rcbo ? ' · ' + r.ma + ' мА' : '');

export const cableName = (r: LineResult): string => 'ВВГнг(А)-LS ' + (r.three ? 5 : 3) + '×' + fs(r.S as number);

export const uzoName = (u: Uzo): string => 'УЗО ' + (u.four ? '4P' : '2P') + ' ' + u.In + ' А ' + u.ma + ' мА';

export const inCableName = (c: CfgN, s: number): string => IN_CABLE[c.inCable] + ' ' + (c.supply === 3 ? 5 : 3) + '×' + fs(s);
