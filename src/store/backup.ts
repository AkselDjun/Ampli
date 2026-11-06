import type { Project } from '../core/types';
import { APP_VERSION, NORMS_EDITION } from '../core/version';
import { SCHEMA } from './storage';
import { getPhoto, putPhotos } from './photos';
import { referencedPhotoIds } from '../core/photos';
import { normProject } from '../core/project';

export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

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

export async function backupArchive(list: Project[], now = Date.now()): Promise<{ name: string; text: string }> {
  const base = backupFile(list, now);
  const photos: Record<string, { type: string; data: string }> = {};
  for (const id of referencedPhotoIds(list.filter(p => !p.sample))) {
    const blob = await getPhoto(id);
    if (!blob) throw new Error('missing photo: ' + id);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    photos[id] = { type: blob.type, data: btoa(binary) };
  }
  return { ...base, text: JSON.stringify({ ...JSON.parse(base.text), version: 2, photos }) };
}

export function validateBackup(data: unknown): Map<string, Blob> {
  if (!data || typeof data !== 'object') throw new Error('invalid backup');
  const archive = data as { app?: unknown; kind?: unknown; version?: unknown; schema?: unknown; list?: unknown; photos?: unknown };
  if (archive.app !== 'ampli' || archive.kind !== 'backup' || !Array.isArray(archive.list) || !archive.list.length || archive.list.some(p => !normProject(p, true))) throw new Error('invalid projects');
  if (archive.version !== undefined && archive.version !== 1 && archive.version !== 2) throw new Error('unsupported backup version');
  if (archive.schema !== undefined && (typeof archive.schema !== 'number' || archive.schema > SCHEMA)) throw new Error('unsupported project schema');
  const ids = archive.list.map(p => (p as Project).id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate project');
  const needed = referencedPhotoIds(archive.list as Project[]);
  if (archive.version !== 2) {
    if (needed.size) throw new Error('legacy backup has no photo data');
    return new Map();
  }
  const photos = archive.photos;
  if (!photos || typeof photos !== 'object' || Array.isArray(photos)) throw new Error('invalid photos');
  if (Object.keys(photos).length !== needed.size) throw new Error('photo count mismatch');
  const decoded = new Map<string, Blob>();
  for (const id of needed) {
    const value = (photos as Record<string, unknown>)[id];
    if (!value || typeof value !== 'object') throw new Error('invalid photo');
    const { type, data: encoded } = value as { type: unknown; data: unknown };
    if (typeof type !== 'string' || !type.startsWith('image/') || typeof encoded !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('invalid photo');
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    decoded.set(id, new Blob([bytes], { type }));
  }
  return decoded;
}

export async function restorePhotos(data: unknown): Promise<void> {
  await putPhotos(validateBackup(data));
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
