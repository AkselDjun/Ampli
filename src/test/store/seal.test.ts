import { describe, expect, it } from 'vitest';
import { SEAL_ITER, WrongPassword, isSealed, seal, unseal } from '../../store/seal';

const FAST = 100000;

describe('password-sealed files', () => {
  it('opens with the same password and hides the text', async () => {
    const text = JSON.stringify({ client: 'Иванов И. И.', address: 'Минск, ул. Ленина, 1' });
    const out = await seal(text, 'щиток-2026', 'project', FAST);
    expect(out).not.toContain('Иванов');
    expect(out).not.toContain('Минск');
    const o = JSON.parse(out) as unknown;
    expect(isSealed(o)).toBe(true);
    expect(await unseal(o, 'щиток-2026')).toBe(text);
  });

  it('uses a fresh salt and nonce every time', async () => {
    const a = JSON.parse(await seal('x', 'p', 'backup', FAST)) as { iv: string; kdf: { salt: string }; data: string };
    const b = JSON.parse(await seal('x', 'p', 'backup', FAST)) as { iv: string; kdf: { salt: string }; data: string };
    expect(a.iv).not.toBe(b.iv);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.data).not.toBe(b.data);
  });

  it('defaults to the recommended iteration count', async () => {
    const o = JSON.parse(await seal('x', 'p', 'backup')) as { kdf: { iter: number } };
    expect(o.kdf.iter).toBe(SEAL_ITER);
    expect(SEAL_ITER).toBeGreaterThanOrEqual(600000);
  });

  it('rejects a wrong password', async () => {
    const o = JSON.parse(await seal('x', 'right', 'backup', FAST)) as unknown;
    await expect(unseal(o, 'wrong')).rejects.toBeInstanceOf(WrongPassword);
  });

  it('rejects tampered data', async () => {
    const o = JSON.parse(await seal('секрет', 'p', 'backup', FAST)) as { data: string };
    const bytes = atob(o.data).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 1);
    await expect(unseal({ ...o, data: btoa(bytes.join('')) }, 'p')).rejects.toBeInstanceOf(WrongPassword);
  });

  it('refuses an empty password', async () => {
    await expect(seal('x', '', 'backup', FAST)).rejects.toThrow();
  });

  it('refuses hostile headers before deriving a key', async () => {
    const o = JSON.parse(await seal('x', 'p', 'backup', FAST)) as { kdf: Record<string, unknown>; iv: string };
    await expect(unseal({ ...o, kdf: { ...o.kdf, iter: 1e9 } }, 'p')).rejects.toThrow('unsupported');
    await expect(unseal({ ...o, kdf: { ...o.kdf, iter: 10 } }, 'p')).rejects.toThrow('unsupported');
    await expect(unseal({ ...o, kdf: { ...o.kdf, hash: 'SHA-1' } }, 'p')).rejects.toThrow('unsupported');
    await expect(unseal({ ...o, v: 2 }, 'p')).rejects.toThrow('unsupported');
    await expect(unseal({ ...o, iv: '!!' }, 'p')).rejects.toThrow('invalid');
    await expect(unseal({ ...o, iv: btoa('short') }, 'p')).rejects.toThrow('invalid');
    await expect(unseal({ app: 'ampli', kind: 'backup' }, 'p')).rejects.toThrow('invalid');
  });

  it('does not treat plain projects and backups as sealed', () => {
    expect(isSealed({ app: 'ampli', kind: 'backup', list: [] })).toBe(false);
    expect(isSealed({ app: 'ampli', version: 1 })).toBe(false);
    expect(isSealed(null)).toBe(false);
  });
});
