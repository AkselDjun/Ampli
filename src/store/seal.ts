export const SEAL_KIND = 'sealed';
export const SEAL_ITER = 600000;
const MIN_ITER = 100000;
const MAX_ITER = 2000000;
const AAD = new TextEncoder().encode('ampli-sealed-v1');

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

export class WrongPassword extends Error {
  constructor() {
    super('wrong password');
  }
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

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function isSealed(o: unknown): o is Sealed {
  return !!o && typeof o === 'object' && (o as { app?: unknown }).app === 'ampli' && (o as { kind?: unknown }).kind === SEAL_KIND;
}

export async function seal(text: string, password: string, of: Sealed['of'], iter = SEAL_ITER): Promise<string> {
  if (!password) throw new Error('empty password');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iter);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(text)));
  const out: Sealed = { app: 'ampli', kind: SEAL_KIND, v: 1, of, kdf: { name: 'PBKDF2', hash: 'SHA-256', iter, salt: toB64(salt) }, alg: 'AES-GCM', iv: toB64(iv), data: toB64(data) };
  return JSON.stringify(out);
}

export async function unseal(o: unknown, password: string): Promise<string> {
  if (!isSealed(o)) throw new Error('invalid sealed file');
  const { v, kdf, alg, iv, data } = o;
  if (v !== 1 || alg !== 'AES-GCM' || !kdf || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') throw new Error('unsupported sealed file');
  if (!Number.isInteger(kdf.iter) || kdf.iter < MIN_ITER || kdf.iter > MAX_ITER) throw new Error('unsupported sealed file');
  if (typeof kdf.salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') throw new Error('invalid sealed file');
  const salt = fromB64(kdf.salt);
  const nonce = fromB64(iv);
  if (salt.length < 16 || nonce.length !== 12) throw new Error('invalid sealed file');
  const key = await deriveKey(password, salt, kdf.iter);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: AAD }, key, fromB64(data));
  } catch (e) {
    void e;
    throw new WrongPassword();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(plain);
}
