import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export const SWIPE_TRIGGER = 80;
export const SWIPE_MAX = 120;
const LOCK = 10;

export function useSwipe(onLeft: () => void, onRight: () => void) {
  const [dx, setDx] = useState(0);
  const st = useRef<{ x: number; y: number; id: number; lock: 'h' | 'v' | null } | null>(null);
  const moved = useRef(false);
  const reset = () => {
    st.current = null;
    setDx(0);
  };
  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, lock: null };
      moved.current = false;
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s) return;
      const ddx = e.clientX - s.x;
      const ddy = e.clientY - s.y;
      if (!s.lock) {
        if (Math.abs(ddy) > LOCK && Math.abs(ddy) >= Math.abs(ddx)) {
          st.current = null;
          return;
        }
        if (Math.abs(ddx) > LOCK) {
          s.lock = 'h';
          moved.current = true;
          try {
            e.currentTarget.setPointerCapture(s.id);
          } catch (err) {
            void err;
          }
        } else return;
      }
      setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, ddx)));
    },
    onPointerUp: () => {
      const s = st.current;
      if (!s) return;
      const v = dx;
      reset();
      if (s.lock !== 'h') return;
      if (v <= -SWIPE_TRIGGER) onLeft();
      else if (v >= SWIPE_TRIGGER) onRight();
    },
    onPointerCancel: reset,
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (moved.current) {
        moved.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  return { dx, handlers };
}
