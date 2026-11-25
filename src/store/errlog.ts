import { addEntry, errorOf, parseLog, scrub, ERR_STACK_MAX } from '../core/errlog';
import type { ErrEntry, ErrKind } from '../core/errlog';
import { ERR_KEY } from '../core/errlog';

const BURST_MS = 5000;
const BURST_MAX = 20;

let burst: number[] = [];

export function readErrors(): ErrEntry[] {
  try {
    return parseLog(localStorage.getItem(ERR_KEY));
  } catch (e) {
    void e;
    return [];
  }
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(ERR_KEY);
  } catch (e) {
    void e;
  }
}

export function resetErrorBurst(): void {
  burst = [];
}

export function recordError(kind: ErrKind, reason: unknown, o: { now?: number; extra?: string; where?: string | null; ver?: string } = {}): void {
  try {
    const now = o.now ?? Date.now();
    burst = burst.filter(t => now - t < BURST_MS);
    if (burst.length >= BURST_MAX) return;
    burst.push(now);
    const { msg, stack } = errorOf(reason);
    const full = (stack ?? '') + (o.extra ? scrub(o.extra) : '');
    const e: ErrEntry = { kind, msg, t: now, first: now, n: 1 };
    if (o.ver) e.ver = o.ver;
    if (full.trim()) e.stack = full.length > ERR_STACK_MAX ? full.slice(0, ERR_STACK_MAX) : full;
    if (o.where) e.where = o.where;
    localStorage.setItem(ERR_KEY, JSON.stringify(addEntry(readErrors(), e)));
  } catch (err) {
    void err;
  }
}
