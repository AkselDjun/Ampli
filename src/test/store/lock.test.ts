import { describe, expect, it } from 'vitest';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { BOOT_KEY, KEY, PREMIGRATE_KEY, loadBoot, prepareLockedBoot, readProjects, resetProjectDb, saveBoot, saveStore, writeProjects } from '../../store/storage';
import { getPhoto, putPhoto, resetPhotoCache } from '../../store/photos';
import { LOCK_KEY, WrongPassword, checkPassword, forgetKey, lockEnabled, lockMeta, lockPresent, newRecoveryCode, normCode, recoverVault, resetVault, unlockVault, vaultOpen } from '../../store/vault';
import { disableLock, enableLock, finishPending } from '../../store/lock';

const project = (name: string) => ({ ...newProject({ ...sample(), sample: false }, name), client: 'Ковалёв', address: 'Могилёв, ул. Первомайская, 9' });
const photo = () => new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' });

const rawProjects = async (): Promise<unknown[]> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('ampli-projects', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const all = await new Promise<unknown[]>((resolve, reject) => {
    const g = db.transaction('p').objectStore('p').getAll();
    g.onsuccess = () => resolve(g.result as unknown[]);
    g.onerror = () => reject(g.error);
  });
  db.close();
  return all;
};

const restart = () => {
  resetVault();
  resetProjectDb();
  resetPhotoCache();
};

describe('recovery codes', () => {
  it('are five groups of four unambiguous characters', () => {
    const c = newRecoveryCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(newRecoveryCode()).not.toBe(c);
  });
  it('accept lower case, spaces and missing dashes', () => {
    expect(normCode(' abcd efgh-ijkl mnop qrst ')).toBe('ABCD-EFGH-IJKL-MNOP-QRST');
  });
});

describe('app lock', () => {
  it('encrypts projects, the current project and photos and opens them with the password', async () => {
    const a = project('Квартира Ковалёва');
    const b = project('Дача');
    await writeProjects([a], []);
    await putPhoto('ph1', photo());
    localStorage.setItem(KEY, JSON.stringify({ cur: a.id, list: [a] }));
    localStorage.setItem(PREMIGRATE_KEY, JSON.stringify({ list: [a] }));
    const code = newRecoveryCode();
    await enableLock('пароль', code, [a, b], a.id, [a.id, b.id]);
    expect(lockEnabled()).toBe(true);
    expect(lockMeta()?.pending).toBeFalsy();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(PREMIGRATE_KEY)).toBeNull();
    const stored = JSON.stringify(await rawProjects(), (_k, v: unknown) => (ArrayBuffer.isView(v) ? 'bytes' : v));
    expect(stored).not.toContain('Ковалёв');
    expect(stored).not.toContain('Могилёв');
    expect(localStorage.getItem(BOOT_KEY)).not.toContain('Ковалёв');
    expect(localStorage.getItem(LOCK_KEY)).not.toContain('Ковалёв');

    restart();
    expect(lockPresent()).toBe(true);
    expect(vaultOpen()).toBe(false);
    expect(await readProjects()).toEqual([]);
    expect(await getPhoto('ph1')).toBeNull();
    expect(loadBoot().source).toBe('empty');
    await expect(unlockVault('не тот')).rejects.toBeInstanceOf(WrongPassword);
    await unlockVault('пароль');
    await prepareLockedBoot();
    const boot = loadBoot();
    expect(boot.source).toBe('boot');
    expect(boot.list[0].id).toBe(a.id);
    expect((await readProjects()).map(p => p.name).sort()).toEqual(['Дача', 'Квартира Ковалёва']);
    expect(new Uint8Array(await (await getPhoto('ph1') as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('keeps writing encrypted while the lock is on and refuses plain fallbacks', async () => {
    const a = project('Объект');
    await enableLock('p', newRecoveryCode(), [a], a.id, [a.id]);
    const c = project('Новый объект');
    await writeProjects([c], []);
    await putPhoto('ph2', photo());
    expect(saveStore({ cur: a.id, list: [a] })).toBe(false);
    expect(saveBoot(c, [c.id])).toBe(true);
    const stored = JSON.stringify(await rawProjects(), (_k, v: unknown) => (ArrayBuffer.isView(v) ? 'bytes' : v));
    expect(stored).not.toContain('Новый объект');
    forgetKey();
    expect(saveBoot(c, [c.id])).toBe(false);
    await expect(writeProjects([c], [])).rejects.toThrow('vault locked');
    await expect(putPhoto('ph3', photo())).rejects.toThrow('vault locked');
  });

  it('sets a new password with the recovery code', async () => {
    const a = project('Объект');
    const code = newRecoveryCode();
    await enableLock('старый', code, [a], a.id, [a.id]);
    restart();
    await expect(recoverVault('AAAA-AAAA-AAAA-AAAA-AAAA', 'новый')).rejects.toBeInstanceOf(WrongPassword);
    await recoverVault(code.toLowerCase().replace(/-/g, ' '), 'новый');
    expect((await readProjects())[0].id).toBe(a.id);
    restart();
    expect(await checkPassword('старый')).toBe(false);
    expect(await checkPassword('новый')).toBe(true);
  });

  it('turns off with the password and leaves plain data behind', async () => {
    const a = project('Объект');
    await putPhoto('ph1', photo());
    await enableLock('p', newRecoveryCode(), [a], a.id, [a.id]);
    await expect(disableLock('x', [a], a.id, [a.id])).rejects.toBeInstanceOf(WrongPassword);
    expect(lockEnabled()).toBe(true);
    await disableLock('p', [a], a.id, [a.id]);
    expect(lockPresent()).toBe(false);
    expect(vaultOpen()).toBe(false);
    restart();
    expect((await readProjects())[0].id).toBe(a.id);
    expect(await getPhoto('ph1')).not.toBeNull();
    expect(loadBoot().list[0].id).toBe(a.id);
  });

  it('finishes an interrupted switch after unlocking', async () => {
    const a = project('Объект');
    await enableLock('p', newRecoveryCode(), [a], a.id, [a.id]);
    const meta = lockMeta();
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ...meta, off: true, pending: true }));
    restart();
    expect(lockEnabled()).toBe(false);
    expect(lockPresent()).toBe(true);
    await unlockVault('p');
    await finishPending();
    expect(lockPresent()).toBe(false);
    restart();
    expect((await readProjects())[0].id).toBe(a.id);
  });
});
