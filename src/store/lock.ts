import type { Project } from '../core/types';
import { PREMIGRATE_KEY, KEY, OLDKEY, mergeLists, readProjects, saveBoot, sealBoot, writeProjects } from './storage';
import { resealPhotos } from './photos';
import { createVault, forgetKey, lockMeta, saveLockMeta, unlockVault, vaultOpen } from './vault';
import { SCHEMA } from '../core/migrate';

const dropPlainCopies = (): void => {
  for (const k of [KEY, OLDKEY, PREMIGRATE_KEY]) localStorage.removeItem(k);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith('ampli-premigrate-')) localStorage.removeItem(k);
  }
};

async function rewriteAll(list: Project[]): Promise<Project[]> {
  const all = mergeLists(list, await readProjects(), list.map(p => p.id));
  await writeProjects(all, []);
  await resealPhotos();
  return all;
}

export async function enableLock(password: string, code: string, list: Project[], cur: string, order: string[]): Promise<void> {
  const meta = await createVault(password, code);
  saveLockMeta({ ...meta, pending: true });
  dropPlainCopies();
  await rewriteAll(list);
  const p = list.find(x => x.id === cur) ?? list[0];
  if (p) await sealBoot({ schema: SCHEMA, cur: p.id, order, project: p });
  saveLockMeta(meta);
}

export async function disableLock(password: string, list: Project[], cur: string, order: string[]): Promise<void> {
  const meta = lockMeta();
  if (!meta) return;
  await unlockVault(password);
  saveLockMeta({ ...meta, off: true, pending: true });
  await rewriteAll(list);
  const p = list.find(x => x.id === cur) ?? list[0];
  if (p) saveBoot(p, order);
  saveLockMeta(null);
  forgetKey();
}

export async function finishPending(): Promise<void> {
  const meta = lockMeta();
  if (!meta?.pending || !vaultOpen()) return;
  await rewriteAll([]);
  if (meta.off) {
    saveLockMeta(null);
    forgetKey();
  } else {
    dropPlainCopies();
    saveLockMeta({ ...meta, pending: false });
  }
}
