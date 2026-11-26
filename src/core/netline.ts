import type { CfgN } from './types';
import { fmt } from './format';

export const netLine = (c: CfgN): string => [c.house ? 'Дом' : 'Квартира', c.supply === 3 ? '3 фазы' : '1 фаза', fmt(c.alloc, 1).replace(/,0$/, '') + ' кВт'].join(' · ');
