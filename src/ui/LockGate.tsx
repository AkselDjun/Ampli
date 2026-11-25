import { Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockEnabled, lockPresent, vaultOpen } from '../store/vault';
import { prepareLockedBoot } from '../store/storage';

export const LOCK_EVENT = 'ampli-lock';
export const AUTO_LOCK_MS = 5 * 60 * 1000;

const LockScreen = lazy(() => import('./LockScreen').then(m => ({ default: m.LockScreen })));

export function lockNow(): void {
  window.dispatchEvent(new Event(LOCK_EVENT));
}

const setInert = (on: boolean): void => {
  for (const el of Array.from(document.body.children)) {
    if (el instanceof HTMLElement && !el.classList.contains('lock')) el.inert = on;
  }
};

export function LockGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => !lockPresent() || vaultOpen());
  const [shut, setShut] = useState(false);
  useEffect(() => {
    if (!open) return;
    let hiddenAt = 0;
    const lock = () => { if (lockEnabled()) setShut(true); };
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= AUTO_LOCK_MS) lock();
    };
    window.addEventListener(LOCK_EVENT, lock);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(LOCK_EVENT, lock);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [open]);
  useEffect(() => {
    setInert(shut);
    return () => setInert(false);
  }, [shut]);
  if (!open) {
    return (
      <Suspense fallback={null}>
        <LockScreen onOpen={async () => {
          await prepareLockedBoot();
          const { finishPending } = await import('../store/lock');
          await finishPending().catch(() => undefined);
          setOpen(true);
        }} />
      </Suspense>
    );
  }
  return (
    <>
      {children}
      {shut && createPortal(<Suspense fallback={null}><LockScreen keepKey onOpen={() => setShut(false)} /></Suspense>, document.body)}
    </>
  );
}
