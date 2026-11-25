import type { ErrKind } from '../core/errlog';
import { ignoredError } from '../core/errnoise';
import { APP_VERSION } from '../core/version';

const QUEUE_MAX = 50;

interface Pending {
  kind: ErrKind;
  reason: unknown;
  extra?: string;
  now: number;
  where: string | null;
}

let queue: Pending[] = [];
let sink: ((p: Pending) => void) | null = null;
let loading: Promise<void> | null = null;
let detach: (() => void) | null = null;

export function errSection(): string | null {
  try {
    const h = window.location.hash;
    return /^#[a-z]+(\/[a-z]+)?$/.test(h) ? h : null;
  } catch (e) {
    void e;
    return null;
  }
}

function drain(): Promise<void> {
  loading ??= import('./errlog').then(
    m => {
      sink = p => m.recordError(p.kind, p.reason, { now: p.now, extra: p.extra, where: p.where, ver: APP_VERSION });
      const q = queue;
      queue = [];
      q.forEach(sink);
    },
    () => {
      loading = null;
    }
  );
  return loading;
}

export function catchError(kind: ErrKind, reason: unknown, extra?: string): void {
  const p: Pending = { kind, reason, extra, now: Date.now(), where: errSection() };
  if (sink) {
    sink(p);
    return;
  }
  if (queue.length < QUEUE_MAX) queue.push(p);
  void drain();
}

export const flushErrors = (): Promise<void> => (sink ? Promise.resolve() : drain());

export function installErrorCapture(win: Window): void {
  if (detach) return;
  const onError = (ev: Event) => {
    const e = ev as ErrorEvent;
    const msg = typeof e.message === 'string' ? e.message : '';
    if (ignoredError(msg, typeof e.filename === 'string' ? e.filename : '')) return;
    catchError('error', e.error ?? msg);
  };
  const onReject = (ev: Event) => catchError('rejection', (ev as PromiseRejectionEvent).reason);
  const onChunk = (ev: Event) => catchError('chunk', (ev as Event & { payload?: unknown }).payload);
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onReject);
  win.addEventListener('vite:preloadError', onChunk);
  detach = () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onReject);
    win.removeEventListener('vite:preloadError', onChunk);
  };
}

export function resetErrorCapture(): void {
  detach?.();
  detach = null;
  queue = [];
}
