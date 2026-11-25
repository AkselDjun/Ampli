import { isSealedRecord, lockEnabled, openRecord, sealRecord, vaultOpen } from './vault';
import type { SealedRecord } from './vault';

const DB_NAME = 'ampli-photos';
const STORE = 'p';

interface Rec {
  type: string;
  data?: ArrayBuffer;
  sealed?: SealedRecord;
}

export async function toRec(id: string, type: string, data: ArrayBuffer): Promise<Rec> {
  if (!lockEnabled()) return { type, data };
  if (!vaultOpen()) throw new Error('vault locked');
  return { type, sealed: await sealRecord(new Uint8Array(data), 'f:' + id) };
}

export async function fromRec(id: string, rec: Rec): Promise<Blob | null> {
  if (rec.data) return new Blob([rec.data], { type: rec.type });
  if (!isSealedRecord(rec.sealed) || !vaultOpen()) return null;
  try {
    return new Blob([await openRecord(rec.sealed, 'f:' + id)], { type: rec.type });
  } catch (e) {
    void e;
    return null;
  }
}

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('no indexedDB'));
        return;
      }
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    dbp.catch(() => {
      dbp = null;
    });
  }
  return dbp;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  const rec = await toRec(id, blob.type || 'image/jpeg', await blob.arrayBuffer());
  await run('readwrite', s => s.put(rec, id));
}

export async function putPhotos(items: Map<string, Blob>): Promise<void> {
  if (!items.size) return;
  const records = await Promise.all([...items].map(async ([id, blob]) => [id, await toRec(id, blob.type || 'image/jpeg', await blob.arrayBuffer())] as const));
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    records.forEach(([id, rec]) => store.put(rec, id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('photo restore aborted'));
  });
}

export async function getPhoto(id: string): Promise<Blob | null> {
  const rec = await run<Rec | undefined>('readonly', s => s.get(id));
  return rec ? fromRec(id, rec) : null;
}

export async function resealPhotos(): Promise<number> {
  const ids = await photoKeys();
  let n = 0;
  for (const id of ids) {
    const rec = await run<Rec | undefined>('readonly', s => s.get(id));
    if (!rec) continue;
    const blob = await fromRec(id, rec);
    if (!blob) continue;
    const next = await toRec(id, rec.type, await blob.arrayBuffer());
    await run('readwrite', s => s.put(next, id));
    n++;
  }
  return n;
}

export async function delPhoto(id: string): Promise<void> {
  await run('readwrite', s => s.delete(id));
}

export async function photoKeys(): Promise<string[]> {
  const k = await run<IDBValidKey[]>('readonly', s => s.getAllKeys());
  return k.map(String);
}

export async function gcPhotos(keep: Set<string>, from?: Promise<string[]>): Promise<number> {
  const keys = await (from ?? photoKeys());
  const drop = keys.filter(k => !keep.has(k));
  await Promise.all(drop.map(delPhoto));
  return drop.length;
}

const urls = new Map<string, string>();

export async function photoUrl(id: string): Promise<string | null> {
  const have = urls.get(id);
  if (have) return have;
  const b = await getPhoto(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urls.set(id, u);
  return u;
}

export function forgetPhotoUrl(id: string): void {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
}

export function resetPhotoCache(): void {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls.clear();
  dbp = null;
}
