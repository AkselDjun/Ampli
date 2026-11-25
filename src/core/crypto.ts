export const SEAL_ITER = 600000;
export const MIN_ITER = 100000;
export const MAX_ITER = 2000000;
const SALT = 16;
const IV = 12;
const AAD = new TextEncoder().encode('ampli-sealed-v1');

export class WrongPassword extends Error {
  constructor() {
    super('wrong password');
  }
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export interface SealedParts {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

export async function sealParts(plain: Uint8Array<ArrayBuffer>, password: string, iter = SEAL_ITER): Promise<SealedParts> {
  if (!password) throw new Error('empty password');
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const key = await deriveKey(password, salt, iter);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plain));
  return { salt, iv, data };
}

export async function openParts({ salt, iv, data }: SealedParts, password: string, iter = SEAL_ITER): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(iter) || iter < MIN_ITER || iter > MAX_ITER) throw new Error('unsupported sealed data');
  if (salt.length < SALT || iv.length !== IV) throw new Error('invalid sealed data');
  const key = await deriveKey(password, salt, iter);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, data));
  } catch (e) {
    void e;
    throw new WrongPassword();
  }
}

export async function sealBytes(plain: Uint8Array<ArrayBuffer>, password: string, iter = SEAL_ITER): Promise<Uint8Array<ArrayBuffer>> {
  const { salt, iv, data } = await sealParts(plain, password, iter);
  const out = new Uint8Array(SALT + IV + data.length);
  out.set(salt, 0);
  out.set(iv, SALT);
  out.set(data, SALT + IV);
  return out;
}

export async function openBytes(packed: Uint8Array<ArrayBuffer>, password: string, iter = SEAL_ITER): Promise<Uint8Array<ArrayBuffer>> {
  if (packed.length < SALT + IV + 16) throw new Error('invalid sealed data');
  return openParts({ salt: packed.slice(0, SALT), iv: packed.slice(SALT, SALT + IV), data: packed.slice(SALT + IV) }, password, iter);
}
