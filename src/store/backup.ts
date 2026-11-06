import type { Project } from '../core/types';
import { APP_VERSION, NORMS_EDITION } from '../core/version';
import { SCHEMA } from './storage';

export const BACKUP_AT = 'ampli-backup-at';
export const BACKUP_SNOOZE = 'ampli-backup-snooze';
export const DAY = 24 * 3600 * 1000;
export const WEEK = 7 * DAY;

const read = (k: string): number => {
  try {
    return Number(localStorage.getItem(k)) || 0;
  } catch (e) {
    void e;
    return 0;
  }
};

const write = (k: string, v: number): void => {
  try {
    localStorage.setItem(k, String(v));
  } catch (e) {
    void e;
  }
};

const own = (list: Project[]): Project[] => list.filter(p => !p.sample);

export const lastBackup = (): number => read(BACKUP_AT);
export const markBackup = (now = Date.now()): void => write(BACKUP_AT, now);
export const snoozeBackup = (now = Date.now()): void => write(BACKUP_SNOOZE, now + DAY);

export function backupDue(list: Project[], now = Date.now()): boolean {
  const mine = own(list);
  if (!mine.length || read(BACKUP_SNOOZE) > now) return false;
  const last = lastBackup();
  const since = last || Math.min(...mine.map(p => p.created));
  return now - since >= WEEK && mine.some(p => p.updated > last);
}

export function backupFile(list: Project[], now = Date.now()): { name: string; text: string } {
  const data = { app: 'ampli', kind: 'backup', version: 1, schema: SCHEMA, appVersion: APP_VERSION, norms: NORMS_EDITION, created: now, list: own(list) };
  return { name: 'ampli-backup-' + new Date(now).toISOString().slice(0, 10) + '.json', text: JSON.stringify(data) };
}

export async function keepData(): Promise<boolean> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s || typeof s.persist !== 'function') return false;
  try {
    if (typeof s.persisted === 'function' && (await s.persisted())) return true;
    return await s.persist();
  } catch (e) {
    void e;
    return false;
  }
}
