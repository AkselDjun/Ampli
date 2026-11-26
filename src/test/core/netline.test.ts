import { describe, expect, it } from 'vitest';
import { netLine } from '../../core/netline';
import type { CfgN } from '../../core/types';

const c = (o: Partial<CfgN>) => ({ house: false, supply: 1, alloc: 15, ...o }) as CfgN;

describe('netLine', () => {
  it('names the object, the supply and the allocated power', () => {
    expect(netLine(c({}))).toBe('Квартира · 1 фаза · 15 кВт');
    expect(netLine(c({ house: true, supply: 3, alloc: 12.5 }))).toBe('Дом · 3 фазы · 12,5 кВт');
  });
});
