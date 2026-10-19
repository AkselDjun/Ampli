import { describe, expect, it, vi } from 'vitest';
import { delPhoto, forgetPhotoUrl, gcPhotos, getPhoto, photoKeys, photoUrl, putPhoto, resetPhotoCache } from '../../store/photos';

const blob = (t = 'image/jpeg') => new Blob([new Uint8Array([1, 2, 3, 4])], { type: t });

describe('photo store', () => {
  it('stores and reads a photo with its type', async () => {
    await putPhoto('a', blob('image/png'));
    const b = await getPhoto('a');
    expect(b).not.toBeNull();
    expect(b!.type).toBe('image/png');
    expect(b!.size).toBe(4);
  });
  it('defaults the type to jpeg', async () => {
    await putPhoto('a', new Blob([new Uint8Array([9])]));
    expect((await getPhoto('a'))!.type).toBe('image/jpeg');
  });
  it('returns null for unknown ids', async () => {
    expect(await getPhoto('none')).toBeNull();
  });
  it('lists keys and deletes', async () => {
    await putPhoto('a', blob());
    await putPhoto('b', blob());
    expect((await photoKeys()).sort()).toEqual(['a', 'b']);
    await delPhoto('a');
    expect(await photoKeys()).toEqual(['b']);
  });
  it('collects garbage not referenced', async () => {
    await putPhoto('a', blob());
    await putPhoto('b', blob());
    await putPhoto('c', blob());
    expect(await gcPhotos(new Set(['b']))).toBe(2);
    expect(await photoKeys()).toEqual(['b']);
    expect(await gcPhotos(new Set(['b']))).toBe(0);
  });
});

describe('photo urls', () => {
  it('caches the object url per id', async () => {
    await putPhoto('a', blob());
    const u1 = await photoUrl('a');
    const u2 = await photoUrl('a');
    expect(u1).toMatch(/^blob:/);
    expect(u2).toBe(u1);
  });
  it('returns null when the photo is missing', async () => {
    expect(await photoUrl('missing')).toBeNull();
  });
  it('forgets and revokes', async () => {
    await putPhoto('a', blob());
    const u1 = await photoUrl('a');
    forgetPhotoUrl('a');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(u1);
    const u2 = await photoUrl('a');
    expect(u2).not.toBe(u1);
    forgetPhotoUrl('nothing');
  });
  it('reset clears cache', async () => {
    await putPhoto('a', blob());
    await photoUrl('a');
    resetPhotoCache();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('without indexedDB', () => {
  it('rejects and recovers after the factory returns', async () => {
    const saved = globalThis.indexedDB;
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = undefined;
    resetPhotoCache();
    await expect(putPhoto('a', blob())).rejects.toThrow();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = saved;
    await putPhoto('a', blob());
    expect(await photoKeys()).toEqual(['a']);
  });
  it('rejects when open fails', async () => {
    const saved = globalThis.indexedDB;
    const fake = {
      open: () => {
        const r: { onerror?: () => void; error?: Error } = { error: new Error('boom') };
        setTimeout(() => r.onerror && r.onerror(), 0);
        return r;
      }
    };
    (globalThis as { indexedDB: unknown }).indexedDB = fake;
    resetPhotoCache();
    await expect(getPhoto('a')).rejects.toThrow('boom');
    (globalThis as { indexedDB: IDBFactory }).indexedDB = saved;
    vi.restoreAllMocks();
  });
});
