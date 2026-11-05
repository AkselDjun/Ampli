import { useEffect, useState } from 'react';
import type { Device } from '../core/types';
import { layout } from '../core/calc';

export function fitCols(rl: number, avail: number, cell: number, gap: number): number {
  if (!(avail > 0)) return rl;
  let best = rl;
  for (let n = 1; n <= rl; n++) {
    if (rl % n) continue;
    const c = rl / n;
    best = c;
    if (c * cell + (c - 1) * gap <= avail) return c;
  }
  return best;
}

const flow = (devs: Device[], cols: number): { row: number; col: number }[] => {
  let row = 0;
  let col = 0;
  return devs.map(d => {
    if (col > 0 && col + d.mod > cols) {
      row++;
      col = 0;
    }
    const at = { row, col };
    col += d.mod;
    return at;
  });
};

export function railCells(devs: Device[], cols: number, rl: number, size: number): { gapBefore: number[]; free: number } {
  const slots = cols < rl ? flow(devs, cols) : layout(devs, cols);
  const gapBefore = slots.map((sl, i) => (i > 0 && sl.row > slots[i - 1].row ? sl.row * cols - (slots[i - 1].row * cols + slots[i - 1].col + devs[i - 1].mod) : 0));
  const last = slots[slots.length - 1];
  const used = last ? last.row * cols + last.col + devs[devs.length - 1].mod : 0;
  const free = Math.max(0, Math.max(size, Math.ceil(used / cols) * cols) - used);
  return { gapBefore, free };
}

export function useFitCols<T extends HTMLElement>(rl: number, cell: number, gap: number): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cs = window.getComputedStyle(el);
      setAvail(el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, fitCols(rl, avail, cell, gap)];
}
