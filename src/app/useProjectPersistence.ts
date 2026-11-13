import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Project } from '../core/types';
import { referencedPhotoIds } from '../core/photos';
import type { Action, State } from '../store/reducer';
import { BOOT_KEY, REVISION_KEY, clearDeleted, deletedIds, markDeleted, changes, dropLegacy, mergeLists, ProjectConflictError, readProjects, saveBoot, saveStore, tabId, writeProjectsChecked } from '../store/storage';
import type { Boot } from '../store/storage';
import { gcPhotos, photoKeys } from '../store/photos';
import { backupDue, keepData, snoozeBackup } from '../store/backup';
import { toast, toastBad, toastOk } from '../ui/toast';
import { exportBackup } from '../ui/download';
import type { SaveStatus } from './types';
import { useStable } from '../ui/hold';

export const SAVE_DELAY_MS = 400;
export const SAVING_SHOWN_AFTER_MS = 300;

const FULL_TEXT = 'Не удалось сохранить изменения: в браузере закончилось место. Удалите лишние проекты или фото и сохраните проект в файл.';

export interface Persistence {
  saveStatus: SaveStatus;
  onSaved: (ok: boolean) => void;
}

export function useProjectPersistence({ boot, state, dispatch, viewOnly }: { boot: Boot; state: State; dispatch: Dispatch<Action>; viewOnly: boolean }): Persistence {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveFail = useRef(false);
  const mounted = useRef(true);
  const disk = useRef({ full: boot.source === 'legacy', idb: true, clear: boot.source === 'legacy', order: boot.order, prev: boot.source === 'boot' ? boot.list : ([] as Project[]) });
  const conflict = useRef(false);
  const revision = useRef<string | null>(null);
  const tabOwner = useRef('');
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ cur: state.cur, list: state.list });
  const dirty = useRef(false);
  const seq = useRef(0);
  const removed = useRef<Set<string> | null>(null);
  const removedIds = (): Set<string> => (removed.current ??= new Set(deletedIds()));

  const onSaved = useStable((ok: boolean) => {
    if (!ok && !saveFail.current) toastBad(FULL_TEXT);
    saveFail.current = !ok;
  });

  useEffect(() => {
    mounted.current = true;
    try { revision.current = localStorage.getItem(REVISION_KEY); } catch (e) { void e; }
    tabOwner.current = tabId();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    latest.current = { cur: state.cur, list: state.list };
  }, [state.cur, state.list]);

  useEffect(() => {
    const d = disk.current;
    if (boot.source === 'legacy') {
      gcPhotos(referencedPhotoIds(boot.list)).catch(() => undefined);
      return;
    }
    const before = photoKeys();
    before.catch(() => undefined);
    readProjects()
      .then(found => {
        const stale = found.filter(x => removedIds().has(x.id)).map(x => x.id);
        const stored = found.filter(x => !removedIds().has(x.id));
        d.full = true;
        d.prev = mergeLists(d.prev, stored, []);
        if (stale.length) {
          pendingWrite.current = pendingWrite.current
            .then(() => (conflict.current ? undefined : writeProjectsChecked([], stale, revision.current, tabOwner.current).then(next => { revision.current = next; clearDeleted(stale); })))
            .catch(() => undefined);
        }
        gcPhotos(referencedPhotoIds(mergeLists(latest.current.list, stored, [])), before).catch(() => undefined);
        dispatch({ t: 'hydrate', projects: stored, order: d.order, replace: boot.source === 'empty' });
      })
      .catch(() => {
        d.idb = false;
      });
  }, [boot, dispatch]);

  const asked = useRef(false);
  useEffect(() => {
    if (viewOnly || asked.current || !state.list.some(x => !x.sample)) return;
    asked.current = true;
    keepData().catch(() => undefined);
  }, [state.list, viewOnly]);

  useEffect(() => {
    if (viewOnly) return;
    const t = setTimeout(() => {
      if (!backupDue(latest.current.list)) return;
      snoozeBackup();
      toast('Резервная копия проектов не сохранялась больше недели', {
        label: 'Сохранить',
        run: () => { void exportBackup(latest.current.list).then(ok => ok ? toastOk('Резервная копия подготовлена') : toastBad('Не удалось подготовить резервную копию')); }
      });
    }, 6000);
    return () => clearTimeout(t);
  }, [viewOnly]);

  const flush = useStable(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const d = disk.current;
    if (conflict.current) return;
    const { cur: curId, list } = latest.current;
    const n = ++seq.current;
    const slow = setTimeout(() => {
      if (mounted.current && n === seq.current) setSaveStatus('saving');
    }, SAVING_SHOWN_AFTER_MS);
    const finish = (status: SaveStatus) => {
      clearTimeout(slow);
      if (mounted.current && n === seq.current) setSaveStatus(status);
    };
    const ids = list.map(x => x.id);
    const gone = new Set(d.prev.map(x => x.id).filter(id => !ids.includes(id)));
    d.order = d.full ? ids : [...d.order.filter(id => !gone.has(id)), ...ids.filter(id => !d.order.includes(id))];
    const bootOk = saveBoot(list.find(x => x.id === curId) as Project, d.order);
    const fallback = () => {
      const ok = d.full ? saveStore({ cur: curId, list }) : bootOk;
      onSaved(ok);
      finish(ok ? 'saved' : 'error');
    };
    if (!d.idb) {
      fallback();
      return;
    }
    const { put, del } = changes(d.prev, list);
    put.forEach(x => removedIds().delete(x.id));
    clearDeleted(put.map(x => x.id));
    del.forEach(id => removedIds().add(id));
    markDeleted(del);
    const clear = d.clear;
    d.prev = list;
    d.clear = false;
    const write = pendingWrite.current.then(() => {
      if (conflict.current) return;
      return writeProjectsChecked(put, del, revision.current, tabOwner.current, clear).then(next => { revision.current = next; });
    });
    pendingWrite.current = write.catch(() => undefined);
    write
      .then(() => {
        if (clear) dropLegacy();
        clearDeleted(del);
        onSaved(true);
        finish('saved');
      })
      .catch((error: unknown) => {
        if (error instanceof ProjectConflictError) {
          conflict.current = true;
          clearTimeout(slow);
          if (mounted.current) setSaveStatus('conflict');
          try { localStorage.removeItem(BOOT_KEY); } catch (e) { void e; }
          toastBad('Проект изменён в другой вкладке. Обновите страницу перед продолжением работы.');
          return;
        }
        d.prev = [];
        d.clear = clear;
        fallback();
      });
  });

  const shape = useRef('');
  useEffect(() => {
    if (viewOnly) return;
    dirty.current = true;
    const next = state.cur + '|' + state.list.map(x => x.id).join(',');
    if (next !== shape.current) {
      shape.current = next;
      flush();
      return;
    }
    const t = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.cur, state.list, viewOnly, flush]);

  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [flush]);

  return { saveStatus, onSaved };
}
