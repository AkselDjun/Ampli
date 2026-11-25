import { SEAL_ITER, WrongPassword, openParts, sealParts } from '../core/crypto';

export { SEAL_ITER, WrongPassword };

export const SEAL_KIND = 'sealed';

export interface Sealed {
  app: 'ampli';
  kind: typeof SEAL_KIND;
  v: 1;
  of: 'backup' | 'project';
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iter: number; salt: string };
  alg: 'AES-GCM';
  iv: string;
  data: string;
}

const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('invalid sealed file');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function isSealed(o: unknown): o is Sealed {
  return !!o && typeof o === 'object' && (o as { app?: unknown }).app === 'ampli' && (o as { kind?: unknown }).kind === SEAL_KIND;
}

export async function seal(text: string, password: string, of: Sealed['of'], iter = SEAL_ITER): Promise<string> {
  const { salt, iv, data } = await sealParts(new TextEncoder().encode(text), password, iter);
  const out: Sealed = { app: 'ampli', kind: SEAL_KIND, v: 1, of, kdf: { name: 'PBKDF2', hash: 'SHA-256', iter, salt: toB64(salt) }, alg: 'AES-GCM', iv: toB64(iv), data: toB64(data) };
  return JSON.stringify(out);
}

export async function unseal(o: unknown, password: string): Promise<string> {
  if (!isSealed(o)) throw new Error('invalid sealed file');
  const { v, kdf, alg, iv, data } = o;
  if (v !== 1 || alg !== 'AES-GCM' || !kdf || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') throw new Error('unsupported sealed file');
  if (typeof kdf.salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') throw new Error('invalid sealed file');
  const plain = await openParts({ salt: fromB64(kdf.salt), iv: fromB64(iv), data: fromB64(data) }, password, kdf.iter).catch((e: unknown) => {
    if (e instanceof WrongPassword) return Promise.reject(e);
    return Promise.reject(new Error(e instanceof Error && e.message.startsWith('unsupported') ? 'unsupported sealed file' : 'invalid sealed file'));
  });
  return new TextDecoder('utf-8', { fatal: true }).decode(plain);
}
