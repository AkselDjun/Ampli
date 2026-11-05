import type { ComponentType } from 'react';

const all: (() => Promise<unknown>)[] = [];

export function part<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> & { preload: () => Promise<ComponentType<P>> } {
  let C: ComponentType<P> | undefined;
  let wait: Promise<ComponentType<P>> | undefined;
  const preload = () => {
    if (!wait) {
      wait = load().then(x => (C = x));
      wait.catch(() => { wait = undefined; });
    }
    return wait;
  };
  function Part(props: P) {
    if (!C) throw preload();
    const X = C;
    return <X {...props} />;
  }
  all.push(preload);
  return Object.assign(Part, { preload });
}

export const preloadParts = (): Promise<unknown> => Promise.all(all.map(f => f()));

export const FloorSheet = part(() => import('./FloorSheet').then(m => m.FloorSheet));
export const WeakSheet = part(() => import('./WeakSheet').then(m => m.WeakSheet));
export const OldSheet = part(() => import('./OldWiring').then(m => m.OldSheet));
export const ShopSheet = part(() => import('./ShopSheet').then(m => m.ShopSheet));
export const WorkSheet = part(() => import('./WorkSheet').then(m => m.WorkSheet));
export const PrintDoc = part(() => import('./PrintDoc').then(m => m.PrintDoc));
export const DrawingA3 = part(() => import('./DrawingA3').then(m => m.DrawingA3));
