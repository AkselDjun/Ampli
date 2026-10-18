import type { Project } from '../core/types';
import { normProject, sampleProject } from '../core/project';

export const KEY = 'ampli-v1';
export const OLDKEY = 'raschet-shchitka-v3';

export interface Store {
  cur: string;
  list: Project[];
}

export function loadStore(): Store {
  try {
    const r = localStorage.getItem(KEY);
    if (r) {
      const o = JSON.parse(r);
      if (o && Array.isArray(o.list)) {
        const list = (o.list as unknown[]).map(x => normProject(x, true)).filter((x): x is Project => !!x);
        if (list.length) return { list, cur: list.some(x => x.id === o.cur) ? o.cur : list[0].id };
      }
    }
    const old = localStorage.getItem(OLDKEY);
    if (old) {
      const q = JSON.parse(old);
      const pr = normProject({ ...q, name: 'Моя квартира' });
      if (pr) return { list: [pr], cur: pr.id };
    }
  } catch (e) {
    void e;
  }
  const pr = sampleProject();
  return { list: [pr], cur: pr.id };
}

export function saveStore(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    void e;
  }
}
