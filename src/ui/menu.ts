import { useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

const items = (list: HTMLElement | null): HTMLElement[] => (list ? Array.from(list.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')) : []);

export function useMenuKeys(open: boolean, close: () => void, ready = true) {
  const listRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open && ready) items(listRef.current)[0]?.focus();
  }, [open, ready]);
  const back = () => {
    close();
    triggerRef.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const all = items(listRef.current);
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (k: number) => {
      e.preventDefault();
      all[(k + all.length) % all.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(all.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      back();
    } else if (e.key === 'Tab') close();
  };
  return { listRef, triggerRef, onKeyDown, back };
}

export interface PopSide {
  up?: boolean;
  end?: boolean;
}

export interface PopBox {
  left: number;
  top: number;
  maxHeight: number;
  up: boolean;
}

const POP_EDGE = 8;
const POP_GAP = 6;
const POP_MIN = 160;

export function popPosition(a: { left: number; right: number; top: number; bottom: number }, size: { w: number; h: number }, view: { w: number; h: number }, side: PopSide = {}): PopBox {
  const below = view.h - a.bottom - POP_GAP - POP_EDGE;
  const above = a.top - POP_GAP - POP_EDGE;
  const up = side.up ? size.h <= above || above >= below : size.h > below && above > below;
  const room = Math.max(Math.min(POP_MIN, view.h - 2 * POP_EDGE), up ? above : below);
  const h = Math.min(size.h, room);
  const top = up ? Math.max(POP_EDGE, a.top - POP_GAP - h) : Math.min(a.bottom + POP_GAP, view.h - POP_EDGE - h);
  const want = side.end ? a.right - size.w : a.left;
  const left = Math.max(POP_EDGE, Math.min(want, view.w - size.w - POP_EDGE));
  return { left: Math.round(left), top: Math.round(top), maxHeight: Math.floor(room), up };
}

const openPop = (el: HTMLElement) => {
  if (typeof el.showPopover !== 'function' || !el.hasAttribute('popover')) return;
  try {
    if (!el.matches(':popover-open')) el.showPopover();
  } catch {
    return;
  }
};

const placeLayer = (el: HTMLElement, a: HTMLElement | null, side: PopSide) => {
  if (!a) return;
  const s = el.style;
  if (getComputedStyle(el).getPropertyValue('--pop').trim() === 'sheet') {
    for (const k of ['position', 'inset', 'left', 'top', 'max-height']) s.removeProperty(k);
    delete el.dataset.side;
    return;
  }
  s.removeProperty('max-height');
  const p = popPosition(a.getBoundingClientRect(), { w: el.offsetWidth, h: el.offsetHeight }, { w: document.documentElement.clientWidth, h: window.innerHeight }, side);
  s.position = 'fixed';
  s.inset = 'auto';
  s.left = p.left + 'px';
  s.top = p.top + 'px';
  s.maxHeight = p.maxHeight + 'px';
  el.dataset.side = p.up ? 'up' : 'down';
};

export function usePopLayer(open: boolean, anchor: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, side: PopSide = {}) {
  const { up, end } = side;
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    openPop(el);
    const place = () => placeLayer(el, anchor.current, { up, end });
    place();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    ro?.observe(el);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, pop, up, end]);
}
