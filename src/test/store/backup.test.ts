import { describe, expect, it, vi } from 'vitest';
import { newProject, sampleProject } from '../../core/project';
import { blank } from '../../core/templates';
import { BACKUP_AT, BACKUP_SNOOZE, DAY, WEEK, backupDue, backupFile, keepData, lastBackup, markBackup, snoozeBackup } from '../../store/backup';
import { SCHEMA } from '../../store/storage';

const now = Date.UTC(2026, 10, 6);
const project = (created: number, updated = created) => ({ ...newProject(blank(), 'Объект'), created, updated });
const setStorage = (v: unknown) => Object.defineProperty(navigator, 'storage', { value: v, configurable: true });

describe('backup reminder', () => {
  it('stays quiet without own projects or before a week has passed', () => {
    expect(backupDue([sampleProject()], now)).toBe(false);
    expect(backupDue([project(now - 2 * DAY)], now)).toBe(false);
  });

  it('asks for a first copy a week after the oldest project was created', () => {
    expect(backupDue([project(now - WEEK - 1), project(now)], now)).toBe(true);
  });

  it('asks again a week after the last copy only when something changed', () => {
    markBackup(now - WEEK - 1);
    expect(lastBackup()).toBe(now - WEEK - 1);
    expect(backupDue([project(now - 30 * DAY, now - 20 * DAY)], now)).toBe(false);
    expect(backupDue([project(now - 30 * DAY, now - DAY)], now)).toBe(true);
  });

  it('waits a day after the reminder was shown', () => {
    snoozeBackup(now);
    expect(Number(localStorage.getItem(BACKUP_SNOOZE))).toBe(now + DAY);
    expect(backupDue([project(now - 30 * DAY)], now)).toBe(false);
    expect(backupDue([project(now - 30 * DAY)], now + DAY + 1)).toBe(true);
  });

  it('treats broken storage as no copy at all', () => {
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('x'); });
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('x'); });
    expect(lastBackup()).toBe(0);
    expect(() => markBackup(now)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
    expect(localStorage.getItem(BACKUP_AT)).toBeNull();
  });
});

describe('backup file', () => {
  it('holds own projects with the schema version and a dated name', () => {
    const a = project(now);
    const f = backupFile([sampleProject(), a], now);
    expect(f.name).toBe('ampli-backup-2026-11-06.json');
    const o = JSON.parse(f.text);
    expect(o).toMatchObject({ app: 'ampli', kind: 'backup', schema: SCHEMA, created: now });
    expect(o.list.map((x: { id: string }) => x.id)).toEqual([a.id]);
  });
});

describe('persistent storage', () => {
  it('asks the browser to keep data unless it already does', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    expect(await keepData()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    const again = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist: again });
    expect(await keepData()).toBe(true);
    expect(again).not.toHaveBeenCalled();
  });

  it('reports false when the browser cannot keep data', async () => {
    setStorage(undefined);
    expect(await keepData()).toBe(false);
    setStorage({ persist: vi.fn().mockRejectedValue(new Error('x')) });
    expect(await keepData()).toBe(false);
    setStorage({ persist: vi.fn().mockResolvedValue(false) });
    expect(await keepData()).toBe(false);
  });
});
