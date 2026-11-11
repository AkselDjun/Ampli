import { describe, expect, it } from 'vitest';
import { SCHEMA, migrate, needsMigration, schemaOf } from '../../core/migrate';
import { normProject, sampleProject } from '../../core/project';
import { BOOT_KEY, KEY, PREMIGRATE_KEY, keepPremigration, loadBoot, readProjects, writeProjects } from '../../store/storage';

const v1 = () => ({
  id: 'p-old',
  name: 'Квартира 0.2.0',
  address: 'Минск',
  client: '',
  author: '',
  created: 1762300000000,
  updated: 1762300000000,
  sample: false,
  cfg: { supply: 1, method: 'wall', drop: 0, ko: 1, k: 1, alloc: 10, minS: '1.5', zs: 0.3, feeder: 0, prot: 'rcbo' },
  lines: [
    { id: 'a', name: 'Розетки кухни', type: 'socket', phase: 'L1', len: 12, kc: 0.8, cos: 0.95, where: ' Кухня ', apps: [{ id: 'x', name: 'Чайник', w: 2200, n: 1 }] },
    { id: 'b', name: 'Свет', type: 'light', phase: 'L1', len: 15, zone: 'Коридор', where: 'Прихожая', apps: [{ id: 'y', name: 'Люстра', w: 100, n: 2 }] }
  ]
});

describe('project schema', () => {
  it('treats data without a number as the first schema', () => {
    expect(schemaOf(v1())).toBe(1);
    expect(schemaOf({ schema: 0 })).toBe(1);
    expect(schemaOf({ schema: 1.5 })).toBe(1);
    expect(schemaOf(null)).toBe(1);
    expect(schemaOf({ schema: 2 })).toBe(2);
    expect(needsMigration(v1())).toBe(true);
    expect(needsMigration({ schema: SCHEMA })).toBe(false);
    expect(needsMigration('text')).toBe(false);
  });

  it('moves the old location into the room and drops group demand factors', () => {
    const m = migrate(v1()) as { lines: Record<string, unknown>[] };
    expect(m.lines[0]).not.toHaveProperty('where');
    expect(m.lines[0]).not.toHaveProperty('kc');
    expect(m.lines[0]).not.toHaveProperty('cos');
    expect(m.lines[0].zone).toBe('Кухня');
    expect(m.lines[1].zone).toBe('Коридор');
  });

  it('drops the old location when rooms drive the RCDs', () => {
    const o = v1();
    const m = migrate({ ...o, cfg: { ...o.cfg, prot: 'rcd' } }) as { lines: Record<string, unknown>[] };
    expect(m.lines[0].zone).toBeUndefined();
  });

  it('leaves current, future and malformed data alone', () => {
    const cur = { schema: SCHEMA, lines: [{ where: 'x' }] };
    expect(migrate(cur)).toBe(cur);
    const future = { schema: SCHEMA + 1, lines: [] };
    expect(migrate(future)).toBe(future);
    expect(migrate('x')).toBe('x');
    const bare = { schema: 1, lines: 'no' };
    expect(migrate(bare)).toEqual(bare);
    expect((migrate({ lines: [null, { where: 'Кухня' }] }) as { lines: unknown[] }).lines).toEqual([null, { zone: 'Кухня' }]);
  });

  it('loads an old project at the current schema with the calculation intact', () => {
    const p = normProject(v1(), true);
    expect(p?.schema).toBe(SCHEMA);
    expect(p?.lines.map(l => l.zone)).toEqual(['Кухня', 'Коридор']);
    expect(p?.lines[0].apps[0].w).toBe(2200);
    expect(sampleProject().schema).toBe(SCHEMA);
  });
});

describe('copy before migration', () => {
  it('keeps the first copy of old records only', () => {
    keepPremigration([sampleProject()]);
    expect(localStorage.getItem(PREMIGRATE_KEY)).toBeNull();
    keepPremigration([v1(), sampleProject()]);
    const saved = JSON.parse(localStorage.getItem(PREMIGRATE_KEY) as string);
    expect(saved.schema).toBe(SCHEMA);
    expect(saved.list).toEqual([v1()]);
    keepPremigration([{ ...v1(), name: 'Другая' }]);
    expect(JSON.parse(localStorage.getItem(PREMIGRATE_KEY) as string).list[0].name).toBe('Квартира 0.2.0');
  });

  it('survives a full storage', () => {
    const set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => keepPremigration([v1()])).not.toThrow();
    localStorage.setItem = set;
  });

  it('copies old projects found in local storage, the boot record and the database', async () => {
    localStorage.setItem(KEY, JSON.stringify({ cur: 'p-old', list: [v1()] }));
    const b = loadBoot();
    expect(b.list[0].schema).toBe(SCHEMA);
    expect(JSON.parse(localStorage.getItem(PREMIGRATE_KEY) as string).list[0].id).toBe('p-old');
    localStorage.clear();
    localStorage.setItem(BOOT_KEY, JSON.stringify({ schema: 1, cur: 'p-old', order: ['p-old'], project: v1() }));
    expect(loadBoot().list[0].lines[0].zone).toBe('Кухня');
    expect(localStorage.getItem(PREMIGRATE_KEY)).not.toBeNull();
    localStorage.clear();
    await writeProjects([v1() as never], []);
    const list = await readProjects();
    expect(list[0].schema).toBe(SCHEMA);
    expect(localStorage.getItem(PREMIGRATE_KEY)).not.toBeNull();
  });
});
