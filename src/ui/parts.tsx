import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { toast } from './toast';

const all: (() => Promise<unknown>)[] = [];

export const PART_FAIL_TEXT = 'Не удалось загрузить раздел. Проверьте интернет и откройте его ещё раз. Если приложение обновилось, перезагрузите страницу.';

function PartFailed({ onGone }: { onGone: () => void }) {
  useEffect(() => {
    toast(PART_FAIL_TEXT, { tone: 'bad', label: 'Перезагрузить', run: () => window.location.reload() });
    return onGone;
  }, [onGone]);
  return null;
}

export function part<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> & { preload: () => Promise<ComponentType<P>> } {
  let C: ComponentType<P> | undefined;
  let wait: Promise<ComponentType<P>> | undefined;
  let pending: Promise<void> | undefined;
  let failed = false;
  const preload = () => {
    if (!wait) {
      wait = load().then(x => (C = x));
      wait.catch(() => { wait = undefined; });
    }
    return wait;
  };
  const attempt = (): Promise<void> => {
    if (!pending) {
      pending = preload().then(
        () => { pending = undefined; },
        () => { pending = undefined; failed = true; }
      );
    }
    return pending;
  };
  const retry = () => { failed = false; };
  function Part(props: P) {
    if (!C && failed) return <PartFailed onGone={retry} />;
    if (!C) throw attempt();
    const X = C;
    return <X {...props} />;
  }
  all.push(preload);
  return Object.assign(Part, { preload });
}

export function preloadable<T>(load: () => Promise<T>): { get: () => T | undefined; load: () => Promise<T> } {
  let v: T | undefined;
  let w: Promise<T> | undefined;
  const pre = () => {
    if (!w) {
      w = load().then(x => (v = x));
      w.catch(() => { w = undefined; });
    }
    return w;
  };
  all.push(pre);
  return { get: () => v, load: pre };
}

export const preloadParts = (): Promise<unknown> => Promise.all(all.map(f => f()));

export const ShortcutsSheet = part(() => import('./ShortcutsSheet').then(m => m.ShortcutsSheet));
export const RowPeek = part(() => import('./RowPeek').then(m => m.RowPeek));
export const BulkBar = part(() => import('./BulkBar').then(m => m.BulkBar));
export const StageBar = part(() => import('./StageBar').then(m => m.StageBar));
export const PanelPane = part(() => import('./Side').then(m => m.PanelPane));
export const Summary = part(() => import('./Side').then(m => m.Summary));
export const Editor = part(() => import('./Editor').then(m => m.Editor));
export const FloorSheet = part(() => import('./FloorSheet').then(m => m.FloorSheet));
export const WeakSheet = part(() => import('./WeakSheet').then(m => m.WeakSheet));
export const OldSheet = part(() => import('./OldWiring').then(m => m.OldSheet));
export const ShopSheet = part(() => import('./ShopSheet').then(m => m.ShopSheet));
export const WorkSheet = part(() => import('./WorkSheet').then(m => m.WorkSheet));
export const PrintDoc = part(() => import('./PrintDoc').then(m => m.PrintDoc));
export const DrawingA3 = part(() => import('./DrawingA3').then(m => m.DrawingA3));
export const NetSheet = part(() => import('./sheets').then(m => m.NetSheet));
export const ProjectsSheet = part(() => import('./sheets').then(m => m.ProjectsSheet));
export const ReportSheet = part(() => import('./sheets').then(m => m.ReportSheet));
export const LibSheet = part(() => import('./LibSheet').then(m => m.LibSheet));
export const CompareSheet = part(() => import('./CompareSheet').then(m => m.CompareSheet));
export const RoomsSheet = part(() => import('./RoomsSheet').then(m => m.RoomsSheet));
export const EstimateView = part(() => import('./EstimateView').then(m => m.EstimateView));
export const OwnerView = part(() => import('./Passport').then(m => m.OwnerView));
export const Onboarding = part(() => import('./Onboarding').then(m => m.Onboarding));
export const TraceSheet = part(() => import('./Traces').then(m => m.TraceSheet));
export const Palette = part(() => import('./Palette').then(m => m.Palette));
export const Qr = part(() => import('./Qr').then(m => m.Qr));
