export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type CardSide = 'top' | 'bottom' | 'left' | 'right';
export type CardMode = 'center' | 'dock-top' | 'dock-bottom' | 'float';

export interface CardPlace {
  mode: CardMode;
  side?: CardSide;
  left?: number;
  top?: number;
  arrow?: number;
}

export const NARROW = 640;
export const GAP = 14;
export const EDGE = 12;
export const SPOT_PAD = 8;
const ARROW_EDGE = 24;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function spotBox(target: Box | null, view: Size): Box | null {
  if (!target || target.width <= 0 || target.height <= 0) return null;
  const left = clamp(target.left - SPOT_PAD, 4, view.width - 4);
  const top = clamp(target.top - SPOT_PAD, 4, view.height - 4);
  const right = clamp(target.left + target.width + SPOT_PAD, 4, view.width - 4);
  const bottom = clamp(target.top + target.height + SPOT_PAD, 4, view.height - 4);
  if (right - left < 1 || bottom - top < 1) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export function placeCard(target: Box | null, view: Size, card: Size): CardPlace {
  if (!target) return { mode: 'center' };
  const cy = target.top + target.height / 2;
  if (view.width < NARROW) {
    const below = view.height - (target.top + target.height);
    const above = target.top;
    if (below >= card.height + EDGE * 2) return { mode: 'dock-bottom' };
    if (above >= card.height + EDGE * 2) return { mode: 'dock-top' };
    return { mode: below >= above ? 'dock-bottom' : 'dock-top' };
  }
  const cx = target.left + target.width / 2;
  const below = view.height - (target.top + target.height) - GAP - EDGE;
  const above = target.top - GAP - EDGE;
  const right = view.width - (target.left + target.width) - GAP - EDGE;
  const left = target.left - GAP - EDGE;
  const horizontal = (side: 'top' | 'bottom'): CardPlace => {
    const x = clamp(cx - card.width / 2, EDGE, view.width - card.width - EDGE);
    const y = side === 'bottom' ? target.top + target.height + GAP : target.top - GAP - card.height;
    return { mode: 'float', side, left: x, top: y, arrow: clamp(cx - x, ARROW_EDGE, card.width - ARROW_EDGE) };
  };
  const vertical = (side: 'left' | 'right'): CardPlace => {
    const y = clamp(cy - card.height / 2, EDGE, view.height - card.height - EDGE);
    const x = side === 'right' ? target.left + target.width + GAP : target.left - GAP - card.width;
    return { mode: 'float', side, left: x, top: y, arrow: clamp(cy - y, ARROW_EDGE, card.height - ARROW_EDGE) };
  };
  if (below >= card.height) return horizontal('bottom');
  if (above >= card.height) return horizontal('top');
  if (right >= card.width) return vertical('right');
  if (left >= card.width) return vertical('left');
  return { mode: cy > view.height / 2 ? 'dock-top' : 'dock-bottom' };
}

export function needsScroll(target: Box, view: Size, card: Size, safeTop: number): boolean {
  const bottom = target.top + target.height;
  if (target.top < safeTop || bottom > view.height - EDGE) return true;
  if (placeCard(target, view, card).mode === 'float') return false;
  const room = view.height - card.height - EDGE * 2 - (view.width < NARROW ? 0 : GAP);
  return bottom > room && target.top > safeTop + EDGE && target.height <= room - safeTop;
}
