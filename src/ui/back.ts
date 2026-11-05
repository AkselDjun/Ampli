import { useEffect, useLayoutEffect, useRef } from 'react';

const LAYERS: { close: () => void }[] = [];
const HIST = { pushed: false, skip: false, ready: false };

const push = (): void => {
  if (HIST.pushed) return;
  HIST.pushed = true;
  try {
    window.history.pushState({ ampliLayer: true }, '');
  } catch (e) {
    void e;
  }
};

const onPop = (): void => {
  if (HIST.skip) {
    HIST.skip = false;
    return;
  }
  HIST.pushed = false;
  const top = LAYERS[LAYERS.length - 1];
  if (top) top.close();
  setTimeout(() => {
    if (LAYERS.length) push();
  }, 0);
};

export function useBackClose(open: boolean, onClose: () => void): void {
  const ref = useRef(onClose);
  useLayoutEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const me = { close: () => ref.current() };
    LAYERS.push(me);
    if (!HIST.ready) {
      HIST.ready = true;
      window.addEventListener('popstate', onPop);
    }
    push();
    return () => {
      const i = LAYERS.indexOf(me);
      if (i >= 0) LAYERS.splice(i, 1);
      setTimeout(() => {
        if (!LAYERS.length && HIST.pushed) {
          HIST.pushed = false;
          HIST.skip = true;
          try {
            window.history.back();
          } catch (e) {
            void e;
          }
        }
      }, 0);
    };
  }, [open]);
}
