import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { APP_VERSION, NORMS_EDITION, stamp } from '../../core/version';
import { normProject, sampleProject } from '../../core/project';

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
});
