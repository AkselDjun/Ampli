import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { SpecItem } from '../../core/types';
import { buildSpec } from '../../core/spec';
import { cableName, protFull, uzoName } from '../../core/protection';
import { passportInput, passportRows } from '../../core/passport';
import { protocolRows } from '../../core/protocol';
import { cableRuns } from '../../core/acts';
import { autoQty } from '../../core/labor';
import { tierEstimates } from '../../core/tiers';
import { reportText } from '../../core/report';
import { APP_VERSION, NORMS_EDITION } from '../../core/version';
import { DrawingA3 } from '../../ui/DrawingA3';
import { PrintDoc } from '../../ui/PrintDoc';
import type { PrintMode } from '../../ui/WorkSheet';
import { fullProject } from './full';
import { LABOR, MARKUP, PRICES, calc } from './docs';

const count = (spec: SpecItem[], names: Set<string>): number => spec.filter(i => names.has(i.name)).reduce((s, i) => s + (i.n ?? 0), 0);

describe('documents of one project agree with each other', () => {
  const p = fullProject();
  const a = calc(p);
  const spec = buildSpec(a);
  const groups = a.rows.map((x, i) => ({ ...x, no: 'Г' + (i + 1) })).filter(x => !x.r.empty && x.r.In);

  it('lists every group once on the panel, in the passport and in the protocol', () => {
    const onPanel = a.devs.filter(d => d.kind === 'mcb' || d.kind === 'rcd');
    expect(onPanel.map(d => d.lid).sort()).toEqual(groups.map(x => x.l.id).sort());
    expect(passportRows(a).map(r => r.no)).toEqual(groups.map(x => x.no));
    expect(protocolRows(a).map(r => r.no)).toEqual(groups.map(x => x.no));
  });

  it('buys exactly the breakers and RCDs that sit on the panel', () => {
    const prot = new Set(groups.map(x => protFull(x.r)));
    expect(count(spec, prot)).toBe(groups.length);
    const uzo = new Set(a.uzos.map(uzoName));
    expect(count(spec, uzo)).toBe(a.devs.filter(d => d.kind === 'uzo').length);
    expect(a.uzos.length).toBe(a.devs.filter(d => d.kind === 'uzo').length);
  });

  it('names the same input breaker on the panel, in the spec, the passport and the report', () => {
    const name = '4P C' + a.inIn;
    expect(a.devs.filter(d => d.kind === 'in').map(d => d.label)).toEqual(['C' + a.inIn]);
    expect(spec.some(i => i.name === 'Вводной автомат ' + name)).toBe(true);
    expect(passportInput(a).text).toBe('Вводной автомат ' + name);
    expect(reportText(p, a)).toContain('Вводной автомат: ' + name);
  });

  it('adds the voltage relay, surge protector and load priority relay to both panel and spec', () => {
    expect(a.devs.some(d => d.kind === 'vr')).toBe(true);
    expect(spec.some(i => i.name.startsWith('Реле контроля напряжения'))).toBe(true);
    expect(a.devs.filter(d => d.kind === 'spd').map(d => d.sub)).toEqual(['тип 1+2']);
    expect(spec.some(i => i.name === 'УЗИП тип 1+2 3P+N')).toBe(true);
    const prio = a.devs.filter(d => d.kind === 'prio');
    expect(prio.length).toBe(1 + (a.prio?.s.length ?? 0));
    expect(spec.filter(i => i.name === 'Реле приоритета нагрузки').length).toBe(1);
    expect(spec.filter(i => i.name.startsWith('Контактор модульный')).reduce((s, i) => s + (i.n ?? 0), 0)).toBe(a.prio?.s.length);
  });

  it('fits the panel modules into the panel that is bought', () => {
    expect(a.modSum).toBeLessThanOrEqual(a.size);
    expect(spec[0].name).toMatch(new RegExp('^Щиток на ' + a.size + ' '));
  });

  it('counts the same cable in the spec, the hidden works act and the work estimate', () => {
    const runs = cableRuns(a);
    const bought = spec.filter(i => runs.some(r => r.name === i.name));
    expect(bought.map(i => i.name).sort()).toEqual(runs.map(r => r.name).sort());
    for (const r of runs) {
      const raw = groups.filter(x => cableName(x.r) === r.name).reduce((s, x) => s + x.r.cable, 0);
      expect(r.m).toBe(Math.ceil(raw));
      expect(bought.find(i => i.name === r.name)?.n).toBe(Math.ceil(raw * 1.1));
    }
    expect(autoQty(a).cable).toBe(runs.reduce((s, r) => s + r.m, 0));
  });

  it('only adds protection in richer estimate tiers', () => {
    const tiers = tierEstimates(p, PRICES, LABOR, MARKUP);
    expect(tiers[0].calc.devs.map(d => d.kind)).toEqual(a.devs.map(d => d.kind));
    for (let i = 1; i < tiers.length; i++) {
      const prev = buildSpec(tiers[i - 1].calc).map(x => x.name);
      const next = new Set(buildSpec(tiers[i].calc).map(x => x.name));
      expect(prev.filter(n => !next.has(n) && !/^(Щиток на|Дифавтомат|Автомат|УЗО|Шина)/.test(n))).toEqual([]);
      expect(tiers[i].calc.devs.length).toBeGreaterThanOrEqual(tiers[i - 1].calc.devs.length);
    }
  });

  it('draws every group on the A3 sheet', () => {
    render(<DrawingA3 p={p} a={a} company="" />);
    const t = Array.from(document.querySelectorAll('svg.a3 text')).map(e => e.textContent).join(' ');
    for (const x of groups) expect(t).toContain(x.r.curve + x.r.In);
    expect(t).toContain('C' + a.inIn);
  });

  it('prints every document of the full project and stamps the calculation documents', () => {
    const modes: PrintMode[] = ['report', 'proto', 'stickers', 'tags', 'passport', 'a3', 'hidden', 'wiring', 'accept', 'old'];
    const stamped: PrintMode[] = [];
    for (const mode of modes) {
      const { unmount } = render(<PrintDoc p={p} a={a} mode={mode} />);
      const text = document.body.textContent ?? '';
      expect(text.length).toBeGreaterThan(0);
      if (text.includes(APP_VERSION) && text.includes(NORMS_EDITION)) stamped.push(mode);
      unmount();
    }
    expect(stamped).toEqual(expect.arrayContaining(['report', 'proto']));
  });
});
