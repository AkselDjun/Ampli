import type { Line, Photo, Trace } from './types';

export const TRACE_MAX = 12;
export const TRACE_PTS_MAX = 40;
export const TRACE_GRID = 1000;
export const TRACE_NOTE_MAX = 120;

const clampPt = (v: number): number => Math.max(0, Math.min(TRACE_GRID, Math.round(v)));

export function normTraces(x: unknown): Trace[] {
  if (!Array.isArray(x)) return [];
  const out: Trace[] = [];
  for (const t of x as Partial<Trace>[]) {
    if (!t || !Array.isArray(t.pts)) continue;
    const nums = t.pts.filter((v): v is number => typeof v === 'number' && isFinite(v)).slice(0, TRACE_PTS_MAX * 2);
    const pts = nums.slice(0, nums.length - (nums.length % 2)).map(clampPt);
    if (pts.length < 2) continue;
    out.push({ pts, note: String(t.note ?? '').slice(0, TRACE_NOTE_MAX) });
    if (out.length >= TRACE_MAX) break;
  }
  return out;
}

export function snapPoint(prev: [number, number] | null, x: number, y: number, square: boolean): [number, number] {
  const px = clampPt(x);
  const py = clampPt(y);
  if (!prev || !square) return [px, py];
  return Math.abs(px - prev[0]) >= Math.abs(py - prev[1]) ? [px, prev[1]] : [prev[0], py];
}

export function addPoint(t: Trace, x: number, y: number, square: boolean): Trace {
  if (t.pts.length >= TRACE_PTS_MAX * 2) return t;
  const n = t.pts.length;
  const prev: [number, number] | null = n >= 2 ? [t.pts[n - 2], t.pts[n - 1]] : null;
  const [sx, sy] = snapPoint(prev, x, y, square);
  if (prev && prev[0] === sx && prev[1] === sy) return t;
  return { ...t, pts: [...t.pts, sx, sy] };
}

export const dropPoint = (t: Trace): Trace => ({ ...t, pts: t.pts.slice(0, Math.max(0, t.pts.length - 2)) });

export const tracePath = (t: Trace): string => {
  const out: string[] = [];
  for (let i = 0; i + 1 < t.pts.length; i += 2) out.push((i ? 'L' : 'M') + t.pts[i] + ' ' + t.pts[i + 1]);
  return out.join(' ');
};

export const wallPhotos = (photos: Photo[] | undefined): Photo[] => (photos ?? []).filter(ph => ph.tag === 'wall');

export const tracedCount = (photos: Photo[] | undefined): number => wallPhotos(photos).reduce((s, ph) => s + (ph.traces?.length ?? 0), 0);

export function wallCaption(ph: Photo, lines: Line[]): string {
  const i = lines.findIndex(l => l.id === ph.line);
  return (i >= 0 ? 'Г' + (i + 1) + ' ' + lines[i].name : 'Группа удалена') + (ph.note ? ' · ' + ph.note : '');
}
