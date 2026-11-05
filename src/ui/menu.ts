import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

const items = (list: HTMLElement | null): HTMLElement[] => (list ? Array.from(list.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')) : []);

export function useMenuKeys(open: boolean, close: () => void) {
  const listRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) items(listRef.current)[0]?.focus();
  }, [open]);
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
