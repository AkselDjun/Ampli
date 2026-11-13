import type { Project } from '../core/types';
import { normProject, sampleProject } from '../core/project';
import { SCHEMA, needsMigration } from '../core/migrate';

export { SCHEMA };

export const KEY = 'ampli-v1';
export const OLDKEY = 'raschet-shchitka-v3';
export const BOOT_KEY = 'ampli-boot';
export const DB_NAME = 'ampli-projects';
const DB_VERSION = 1;
export const PREMIGRATE_KEY = 'ampli-premigrate-' + SCHEMA;
const STORE = 'p';

export interface Store {
  cur: string;
  list: Project[];
}

export type BootSource = 'legacy' | 'boot' | 'empty';

export interface Boot extends Store {
  source: BootSource;
  order: string[];
}

interface BootRecord {
  schema: number;
  cur: string;
  order: string[];
  project: unknown;
}

export function keepPremigration(raw: unknown[]): void {
  const old = raw.filter(needsMigration);
  if (!old.length) return;
  try {
    if (localStorage.getItem(PREMIGRATE_KEY)) return;
    localStorage.setItem(PREMIGRATE_KEY, JSON.stringify({ at: Date.now(), schema: SCHEMA, list: old }));
  } catch (e) {
    void e;
  }
}

const fromLegacy = (): Store | null => {
  const r = localStorage.getItem(KEY);
  if (r) {
    const o = JSON.parse(r);
    if (o && Array.isArray(o.list)) {
      keepPremigration(o.list as unknown[]);
      const list = (o.list as unknown[]).map(x => normProject(x, true)).filter((x): x is Project => !!x);
      if (list.length) return { list, cur: list.some(x => x.id === o.cur) ? o.cur : list[0].id };
    }
  }
  return null;
};

const fromOld = (): Store | null => {
  const old = localStorage.getItem(OLDKEY);
  if (old) {
    const pr = normProject({ ...JSON.parse(old), name: 'Моя квартира' });
    if (pr) return { list: [pr], cur: pr.id };
  }
  return null;
};

const fromBoot = (): Boot | null => {
  const r = localStorage.getItem(BOOT_KEY);
  if (!r) return null;
  const o = JSON.parse(r) as Partial<BootRecord> | null;
  if (o) keepPremigration([o.project]);
  const pr = o ? normProject(o.project, true) : null;
  if (!o || !pr) return null;
  const order = Array.isArray(o.order) ? o.order.filter((x): x is string => typeof x === 'string') : [];
  return { list: [pr], cur: pr.id, order: order.includes(pr.id) ? order : [...order, pr.id], source: 'boot' };
};

export function loadBoot(): Boot {
  try {
    const legacy = fromLegacy();
    if (legacy) return { ...legacy, order: legacy.list.map(x => x.id), source: 'legacy' };
  } catch (e) {
    void e;
  }
  try {
    const boot = fromBoot();
    if (boot) return boot;
  } catch (e) {
    void e;
  }
  try {
    const old = fromOld();
    if (old) return { ...old, order: old.list.map(x => x.id), source: 'legacy' };
  } catch (e) {
    void e;
  }
  const pr = sampleProject();
  return { list: [pr], cur: pr.id, order: [pr.id], source: 'empty' };
}

export function loadStore(): Store {
  const { list, cur } = loadBoot();
  return { list, cur };
}

export function saveStore(s: Store): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    void e;
    return false;
  }
}

export function saveBoot(cur: Project, order: string[]): boolean {
  try {
    const rec: BootRecord = { schema: SCHEMA, cur: cur.id, order, project: cur };
    localStorage.setItem(BOOT_KEY, JSON.stringify(rec));
    return true;
  } catch (e) {
    void e;
    return false;
  }
}

let dbp: Promise<IDBDatabase> | null = null;
let conn: IDBDatabase | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('no indexedDB'));
        return;
      }
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => {
        const d = r.result;
        conn = d;
        d.onclose = () => forget(d);
        d.onversionchange = () => {
          d.close();
          forget(d);
        };
        resolve(d);
      };
      r.onerror = () => reject(r.error);
    });
    dbp.catch(() => {
      dbp = null;
    });
  }
  return dbp;
}


function forget(d: IDBDatabase): void {
  if (conn === d) {
    conn = null;
    dbp = null;
  }
}

async function tx(mode: IDBTransactionMode): Promise<IDBTransaction> {
  const d = await db();
  try {
    return d.transaction(STORE, mode);
  } catch (e) {
    void e;
    forget(d);
    return (await db()).transaction(STORE, mode);
  }
}

export function resetProjectDb(): void {
  dbp = null;
  conn = null;
}

const done = (t: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
  });

export async function readProjects(): Promise<Project[]> {
  const t = await tx('readonly');
  const all = t.objectStore(STORE).getAll();
  await done(t);
  keepPremigration(all.result as unknown[]);
  return (all.result as unknown[]).map(x => normProject(x, true)).filter((x): x is Project => !!x);
}

export async function writeProjects(put: Project[], del: string[], clear = false): Promise<void> {
  if (!put.length && !del.length && !clear) return;
  const t = await tx('readwrite');
  const s = t.objectStore(STORE);
  if (clear) s.clear();
  put.forEach(p => s.put(p, p.id));
  del.forEach(id => s.delete(id));
  await done(t);
}

export class ProjectConflictError extends Error {
  constructor() { super('project changed in another tab'); }
}

export const REVISION_KEY = 'ampli-project-revision';
const TAB_KEY = 'ampli-tab-id';
export function tabId(): string {
  let id = sessionStorage.getItem(TAB_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(TAB_KEY, id);
  }
  return id;
}

export async function writeProjectsChecked(put: Project[], del: string[], expected: string | null, owner: string, clear = false): Promise<string | null> {
  const perform = async () => {
    const current = localStorage.getItem(REVISION_KEY);
    if (!clear && current !== expected && !current?.startsWith(owner + ':')) throw new ProjectConflictError();
    await writeProjects(put, del, clear);
    if (!put.length && !del.length && !clear) return expected;
    const revision = owner + ':' + crypto.randomUUID();
    localStorage.setItem(REVISION_KEY, revision);
    return revision;
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('ampli-project-write', perform);
  }
  return perform();
}

export async function clearProjects(): Promise<void> {
  const t = await tx('readwrite');
  t.objectStore(STORE).clear();
  await done(t);
}

export function dropLegacy(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLDKEY);
  } catch (e) {
    void e;
  }
}

export function mergeLists(mem: Project[], stored: Project[], order: string[]): Project[] {
  const byId = new Map<string, Project>();
  stored.forEach(p => byId.set(p.id, p));
  mem.forEach(p => byId.set(p.id, p));
  const ids = [...order.filter(id => byId.has(id)), ...mem.map(p => p.id), ...stored.map(p => p.id)];
  return [...new Set(ids)].map(id => byId.get(id) as Project);
}

export function changes(prev: Project[], next: Project[]): { put: Project[]; del: string[] } {
  const before = new Map(prev.map(p => [p.id, p]));
  const ids = new Set(next.map(p => p.id));
  return { put: next.filter(p => before.get(p.id) !== p), del: prev.filter(p => !ids.has(p.id)).map(p => p.id) };
}

export const DELETED_KEY = 'ampli-deleted';

export function deletedIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch (e) {
    void e;
    return [];
  }
}

const saveDeleted = (ids: string[]): void => {
  try {
    if (ids.length) localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
    else localStorage.removeItem(DELETED_KEY);
  } catch (e) {
    void e;
  }
};

export function markDeleted(ids: string[]): void {
  if (ids.length) saveDeleted([...new Set([...deletedIds(), ...ids])].slice(-200));
}

export function clearDeleted(ids: string[]): void {
  if (!ids.length) return;
  const done = new Set(ids);
  saveDeleted(deletedIds().filter(id => !done.has(id)));
}
