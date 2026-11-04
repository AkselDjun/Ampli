import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

const items = (list: HTMLElement | null): HTMLElement[] => (list ? Array.from(list.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')) : []);

export function useMenuKeys(open: boolean, close: () => void) {
  const list = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) items(list.current)[0]?.focus();
  }, [open]);
  const back = () => {
    close();
    trigger.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const all = items(list.current);
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
  return { list, trigger, onKeyDown, back };
}
