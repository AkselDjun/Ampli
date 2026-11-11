import { pn } from './format';

export const LINE_MAX: Record<string, number> = { len: 500, sockets: 99, perSocket: 10000 };
export const APP_MAX: Record<string, number> = { w: 100000, n: 999, m: 100, br: 200, cos: 1 };
export const MEAS_MAX = 100000;
export const MAX_LINES = 500;
export const MAX_APPS = 200;
export const MAX_ROOMS = 100;
export const MAX_CHECKS = 500;
export const MAX_PROJECTS = 500;
export const ROOM_SPLIT_MAX = 20;

export function numIn<T>(v: T, max: number): T | string | number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
  if (typeof v !== 'string') return v;
  const t = v.replace(/[^\d.,]/g, '').replace(/^([^.,]*[.,][^.,]*)[.,].*$/, '$1');
  const x = pn(t, NaN);
  return Number.isFinite(x) && x > max ? String(max) : t;
}

export function numField(v: unknown, max: number, d: number | string = ''): number | string {
  if (typeof v === 'number' || typeof v === 'string') return numIn(typeof v === 'string' ? v.slice(0, 12) : v, max) as number | string;
  return d;
}
