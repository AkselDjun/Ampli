const DB_NAME = 'ampli-photos';
const STORE = 'p';

interface Rec {
  type: string;
  data: ArrayBuffer;
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
  const rec: Rec = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() };
  await run('readwrite', s => s.put(rec, id));
}

export async function getPhoto(id: string): Promise<Blob | null> {
  const rec = await run<Rec | undefined>('readonly', s => s.get(id));
  return rec ? new Blob([rec.data], { type: rec.type }) : null;
}

export async function delPhoto(id: string): Promise<void> {
  await run('readwrite', s => s.delete(id));
}

export async function photoKeys(): Promise<string[]> {
  const k = await run<IDBValidKey[]>('readonly', s => s.getAllKeys());
  return k.map(String);
}

export async function gcPhotos(keep: Set<string>): Promise<number> {
  const keys = await photoKeys();
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
