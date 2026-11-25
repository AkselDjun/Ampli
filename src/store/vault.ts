import { MIN_ITER, SEAL_ITER, WrongPassword, openParts, sealParts } from '../core/crypto';

export { WrongPassword };

export const LOCK_KEY = 'ampli-lock';
const RECOVERY_ITER = MIN_ITER;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AAD_PREFIX = 'ampli-vault-v1:';

interface Wrapped {
  salt: string;
  iv: string;
  data: string;
}

export interface LockMeta {
  v: 1;
  iter: number;
  pass: Wrapped;
  rec: Wrapped;
  off?: boolean;
  pending?: boolean;
}

export interface SealedRecord {
  vault: 1;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

let key: CryptoKey | null = null;

const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const isWrapped = (o: unknown): o is Wrapped => !!o && typeof o === 'object' && ['salt', 'iv', 'data'].every(k => typeof (o as Record<string, unknown>)[k] === 'string');

export function lockMeta(): LockMeta | null {
  try {
    const o = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null') as Partial<LockMeta> | null;
    if (!o || o.v !== 1 || typeof o.iter !== 'number' || !isWrapped(o.pass) || !isWrapped(o.rec)) return null;
    return o as LockMeta;
  } catch (e) {
    void e;
    return null;
  }
}

export const lockEnabled = (): boolean => {
  const m = lockMeta();
  return m !== null && !m.off;
};
export const lockPresent = (): boolean => lockMeta() !== null;
export const vaultOpen = (): boolean => key !== null;

export function resetVault(): void {
  key = null;
}

export function forgetKey(): void {
  key = null;
}

const importKey = (raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

const wrap = async (raw: Uint8Array<ArrayBuffer>, secret: string, iter: number): Promise<Wrapped> => {
  const { salt, iv, data } = await sealParts(raw, secret, iter);
  return { salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
};

const unwrap = (w: Wrapped, secret: string, iter: number): Promise<Uint8Array<ArrayBuffer>> => openParts({ salt: fromB64(w.salt), iv: fromB64(w.iv), data: fromB64(w.data) }, secret, iter);

export function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, b => CODE_ABC[b % CODE_ABC.length]).join('');
  return chars.match(/.{4}/g)?.join('-') ?? chars;
}

export const normCode = (code: string): string => {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.match(/.{1,4}/g)?.join('-') ?? c;
};

export async function createVault(password: string, code: string): Promise<LockMeta> {
  if (!password) throw new Error('empty password');
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const meta: LockMeta = { v: 1, iter: SEAL_ITER, pass: await wrap(raw, password, SEAL_ITER), rec: await wrap(raw, normCode(code), RECOVERY_ITER) };
  key = await importKey(raw);
  raw.fill(0);
  return meta;
}

export function saveLockMeta(meta: LockMeta | null): void {
  if (meta) localStorage.setItem(LOCK_KEY, JSON.stringify(meta));
  else localStorage.removeItem(LOCK_KEY);
}

export async function unlockVault(password: string): Promise<void> {
  const meta = lockMeta();
  if (!meta) throw new Error('no lock');
  const raw = await unwrap(meta.pass, password, meta.iter);
  key = await importKey(raw);
  raw.fill(0);
}

export async function checkPassword(password: string): Promise<boolean> {
  const meta = lockMeta();
  if (!meta) return false;
  try {
    (await unwrap(meta.pass, password, meta.iter)).fill(0);
    return true;
  } catch (e) {
    if (e instanceof WrongPassword) return false;
    throw e;
  }
}

export async function recoverVault(code: string, password: string): Promise<void> {
  const meta = lockMeta();
  if (!meta) throw new Error('no lock');
  if (!password) throw new Error('empty password');
  const raw = await unwrap(meta.rec, normCode(code), RECOVERY_ITER);
  saveLockMeta({ ...meta, iter: SEAL_ITER, pass: await wrap(raw, password, SEAL_ITER) });
  key = await importKey(raw);
  raw.fill(0);
}

export function isSealedRecord(o: unknown): o is SealedRecord {
  return !!o && typeof o === 'object' && (o as { vault?: unknown }).vault === 1 && ArrayBuffer.isView((o as { iv?: unknown }).iv) && ArrayBuffer.isView((o as { data?: unknown }).data);
}

const aad = (id: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(AAD_PREFIX + id);

const need = (): CryptoKey => {
  if (!key) throw new Error('vault locked');
  return key;
};

export async function sealRecord(bytes: Uint8Array<ArrayBuffer>, id: string): Promise<SealedRecord> {
  const k = need();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(id) }, k, bytes));
  return { vault: 1, iv, data };
}

export async function openRecord(rec: SealedRecord, id: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: aad(id) }, need(), rec.data));
}

export const sealJson = (o: unknown, id: string): Promise<SealedRecord> => sealRecord(new TextEncoder().encode(JSON.stringify(o)), id);

export async function openJson(rec: SealedRecord, id: string): Promise<unknown> {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await openRecord(rec, id)));
}

export async function sealText(o: unknown, id: string): Promise<string> {
  const r = await sealJson(o, id);
  return JSON.stringify({ vault: 1, iv: toB64(r.iv), data: toB64(r.data) });
}

export async function openText(text: string, id: string): Promise<unknown> {
  const o = JSON.parse(text) as { vault?: unknown; iv?: unknown; data?: unknown };
  if (o.vault !== 1 || typeof o.iv !== 'string' || typeof o.data !== 'string') throw new Error('invalid sealed text');
  return openJson({ vault: 1, iv: fromB64(o.iv), data: fromB64(o.data) }, id);
}
