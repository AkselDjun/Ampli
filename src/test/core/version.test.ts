import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { APP_VERSION, NORMS_EDITION, stamp } from '../../core/version';
import { normProject, sampleProject } from '../../core/project';
import { assumptions } from '../../core/assumptions';
import { cfgN } from '../../core/calc';
import { RHO, RHO_HOT_K, SN_CH2_DATE } from '../../core/norms';

describe('version stamp', () => {
  it('takes the app version from package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('names the app version, the norms edition and the date', () => {
    const s = stamp('05.11.2026');
    expect(s).toContain('Ampli ' + pkg.version);
    expect(s).toContain(NORMS_EDITION);
    expect(s).toContain('ТКП 339-2022');
    expect(s.endsWith('05.11.2026')).toBe(true);
  });

  it('a saved file with version fields still opens', () => {
    const p = sampleProject();
    const back = normProject(JSON.parse(JSON.stringify({ app: 'ampli', version: 1, appVersion: APP_VERSION, norms: NORMS_EDITION, ...p })));
    expect(back?.lines.length).toBe(p.lines.length);
  });
  it('records checked constants and distinguishes the heating margin from a norm', () => {
    expect(RHO).toBe(0.0225);
    expect(RHO_HOT_K).toBe(1.5);
    expect(SN_CH2_DATE).toBe('07.12.2026');
    const rows = assumptions(cfgN(sampleProject().cfg));
    expect(rows.find(x => x.name === 'Удельное сопротивление меди')).toMatchObject({ basis: 'norm' });
    expect(rows.find(x => x.name === 'Сопротивление петли жил')).toMatchObject({ basis: 'practice' });
    expect(NORMS_EDITION).toContain('изм. № 2 с 07.12.2026');
  });
});
