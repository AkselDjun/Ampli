import type { CfgN, LineResult, Uzo } from './types';
import { IN_CABLE } from './norms';
import { fs } from './format';

export const poles = (r: LineResult): string => (r.three ? (r.rcbo ? '4P' : '3P') : (r.rcbo || r.arc ? '1P+N' : '1P'));

const head = (r: LineResult): string => (r.arc ? (r.rcbo ? 'УЗДП с дифавтоматом ' : 'УЗДП с автоматом ') : (r.rcbo ? 'Дифавтомат ' : 'Автомат '));

export const protFull = (r: LineResult): string =>
  head(r) + poles(r) + ' ' + r.curve + r.In + (r.rcbo ? ' ' + r.ma + ' мА' + (r.rcdA ? ' тип A' : '') : '');

export const protName = (r: LineResult): string =>
  head(r) + r.curve + r.In + (r.rcbo ? ' · ' + r.ma + ' мА' + (r.rcdA ? ' · тип A' : '') : '');

export const cableName = (r: LineResult): string => (r.cab || 'ВВГнг(А)-LS') + ' ' + (r.three ? 5 : 3) + '×' + fs(r.S as number);

export const uzoName = (u: Uzo): string => 'УЗО ' + (u.four ? '4P' : '2P') + ' ' + u.In + ' А ' + u.ma + ' мА' + (u.typeA ? ' тип A' : '');

export const spdType = (c: Pick<CfgN, 'house'>): string => (c.house ? '1+2' : '2');

export const spdName = (c: Pick<CfgN, 'house' | 'supply'>): string => 'УЗИП тип ' + spdType(c) + ' ' + (c.supply === 3 ? '3P+N' : '1P+N');

export const inCableName = (c: CfgN, s: number): string => IN_CABLE[c.inCable] + ' ' + (c.supply === 3 ? 5 : 3) + '×' + fs(s);
