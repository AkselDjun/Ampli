import { reducer } from './reducer';
import type { Action, State } from './reducer';

export interface Snap {
  list: State['list'];
  cur: string;
  sel: string | null;
}

export interface HState {
  now: State;
  past: Snap[];
  future: Snap[];
  key: string;
  at: number;
}

export type HAction = Action | { t: 'undo' } | { t: 'redo' };

const LIMIT = 60;
const MERGE_MS = 1200;

const snap = (s: State): Snap => ({ list: s.list, cur: s.cur, sel: s.sel });

const restore = (s: State, x: Snap): State => {
  const p = x.list.find(q => q.id === x.cur) ?? x.list[0];
  const sel = p.lines.some(l => l.id === x.sel) ? x.sel : (p.lines[0]?.id ?? null);
  return { ...s, list: x.list, cur: p.id, sel };
};

const keyOf = (a: Action): string => {
  const o = a as { t: string; field?: string; id?: string };
  return o.t + ':' + (o.field ?? '') + ':' + (o.id ?? '');
};

export function initH(now: State): HState {
  return { now, past: [], future: [], key: '', at: 0 };
}

export function hreducer(h: HState, a: HAction): HState {
  if (a.t === 'undo') {
    if (!h.past.length) return h;
    const prev = h.past[h.past.length - 1];
    return { now: restore(h.now, prev), past: h.past.slice(0, -1), future: [snap(h.now), ...h.future], key: '', at: 0 };
  }
  if (a.t === 'redo') {
    if (!h.future.length) return h;
    const next = h.future[0];
    return { now: restore(h.now, next), past: [...h.past, snap(h.now)], future: h.future.slice(1), key: '', at: 0 };
  }
  const now = reducer(h.now, a);
  if (now === h.now) return h;
  if (now.list === h.now.list) return { ...h, now };
  const k = keyOf(a);
  const t = Date.now();
  const merge = k === h.key && t - h.at < MERGE_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, snap(h.now)].slice(-LIMIT);
  return { now, past, future: [], key: k, at: t };
}
