import { BOOT_KEY, readProjects } from '../store/storage';
import type { Project } from '../core/types';

export const flushSaves = (): void => {
  window.dispatchEvent(new Event('pagehide'));
};

export const stored = () => {
  flushSaves();
  const b = JSON.parse(localStorage.getItem(BOOT_KEY) as string);
  return { cur: b.cur as string, order: b.order as string[], list: [b.project] };
};

export const storedProjects = async (): Promise<Project[]> => {
  flushSaves();
  await new Promise(r => setTimeout(r, 30));
  const all = await readProjects();
  const order = stored().order;
  return order.map(id => all.find(p => p.id === id)).filter((p): p is Project => !!p);
};
