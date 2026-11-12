import type { Calc, CfgN, Device, LineResult, Uzo } from './types';
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

export const inPoles = (c: Pick<CfgN, 'supply'>): string => (c.supply === 3 ? '4P' : '2P');

export const inName = (c: Pick<CfgN, 'supply'>, inIn: number | null | undefined, none = '—'): string => (inIn ? inPoles(c) + ' C' + inIn : none);

export const inOf = (a: Pick<Calc, 'c' | 'inIn' | 'P'>): string => inName(a.c, a.inIn, a.P > 0 ? 'не подобран, см. замечания' : '—');

export const vrContactor = (d: Pick<Device, 'kind' | 'sub'>): boolean => d.kind === 'vr' && d.sub === 'контактор';

export const prioContactor = (d: Pick<Device, 'kind' | 'sub'>): boolean => d.kind === 'prio' && d.sub !== 'приоритет';

export function deviceKind(d: Device, c: Pick<CfgN, 'supply' | 'house'>, rcdA: boolean, uzoTypeA: boolean): string {
  switch (d.kind) {
    case 'in': return c.supply === 3 ? '4 полюса' : '2 полюса';
    case 'rcd': return (d.arc ? 'УЗДП с дифавтоматом ' : 'дифавтомат ') + d.ma + ' мА' + (rcdA ? ', тип A' : '');
    case 'uzo': return d.sub.replace('мА', ' мА') + (uzoTypeA ? ', тип A' : '') + ', своя шина N';
    case 'spd': return 'тип ' + spdType(c) + ', ' + (c.supply === 3 ? '3P+N' : '1P+N');
    case 'vr': return vrContactor(d) ? 'управляется реле напряжения' : (c.supply === 3 ? 'по одному на фазу' : 'отключит квартиру при скачке напряжения');
    case 'prio': return d.title.split(': ')[1] ?? '';
    default: return d.arc ? 'УЗДП с автоматом' : 'автомат';
  }
}
