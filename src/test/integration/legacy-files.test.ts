import { describe, expect, it } from 'vitest';
import type { Project } from '../../core/types';
import { normProject } from '../../core/project';
import { validateBackup } from '../../store/backup';
import { KEY, loadBoot } from '../../store/storage';
import { calc } from './docs';
import rcdFile from './fixtures/project-rcd-0.2.3.json';
import rcboFile from './fixtures/project-rcbo-0.2.3.json';
import backup from './fixtures/backup-0.2.3.json';

const GROUPS = [[10, 1.5], [10, 1.5], [16, 2.5], [16, 2.5], [16, 2.5], [16, 2.5], [32, 4], [16, 2.5], [16, 2.5], [16, 2.5], [16, 2.5], [16, 2.5], [10, 2.5], [10, 2.5]];
const breakers = (p: Project) => calc(p).rows.map(x => [x.r.In, x.r.S]);

describe('files saved by version 0.2.3', () => {
  it('open a project with RCDs per room and drop the removed group fields', () => {
    const p = normProject(rcdFile) as Project;
    expect(p.name).toBe('Квартира на Сурганова');
    expect(p.lines.every(l => !('kc' in l) && !('cos' in l) && !('where' in l))).toBe(true);
    expect(p.lines.map(l => l.zone)).toEqual(['Комнаты', 'Кухня', 'Комнаты', 'Комнаты', 'Кухня', 'Кухня', 'Кухня', 'Кухня', 'Кухня', 'Ванная', 'Ванная', 'Ванная', 'Ванная', 'Комнаты']);
    const a = calc(p);
    expect(breakers(p)).toEqual(GROUPS);
    expect([a.inIn, a.size]).toEqual([50, 36]);
    expect(a.uzos.map(u => [u.zone, u.In, u.ma])).toEqual([['Комнаты', 63, 30], ['Кухня', 63, 30], ['Ванная · 1', 40, 10], ['Ванная · 2', 40, 10]]);
  });

  it('move the old location into an empty room when every group has its own RCBO', () => {
    const p = normProject(rcboFile) as Project;
    expect(p.lines.map(l => l.zone)).toEqual(['Комнаты', 'Кухня', 'Комнаты', 'Спальня', 'Кухня', 'Кухня', 'Кухня', 'Кухня', 'Кухня', 'Санузел', 'Ванная', 'Санузел', 'Ванная', 'Спальня']);
    expect(breakers(p)).toEqual(GROUPS);
    expect(calc(p).uzos).toEqual([]);
  });

  it('restore a backup without photos and keep project and group ids', () => {
    expect(() => validateBackup(backup)).not.toThrow();
    const list = backup.list.map(x => normProject(x, true) as Project);
    expect(list.map(p => p.id)).toEqual(['p-legacy-rcd', 'p-legacy-rcbo']);
    expect(list[0].lines.map(l => l.id)).toEqual(backup.list[0].lines.map(l => l.id));
    expect(list.map(breakers)).toEqual([GROUPS, GROUPS]);
  });

  it('start from the old single-key storage', () => {
    localStorage.setItem(KEY, JSON.stringify({ list: backup.list, cur: 'p-legacy-rcbo' }));
    const boot = loadBoot();
    expect(boot.source).toBe('legacy');
    expect(boot.cur).toBe('p-legacy-rcbo');
    expect(boot.list.map(p => p.id)).toEqual(['p-legacy-rcd', 'p-legacy-rcbo']);
    expect(boot.list.map(breakers)).toEqual([GROUPS, GROUPS]);
  });
});
