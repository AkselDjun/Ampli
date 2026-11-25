export type ErrKind = 'error' | 'rejection' | 'render' | 'chunk';

export interface ErrEntry {
  kind: ErrKind;
  msg: string;
  stack?: string;
  where?: string;
  ver?: string;
  t: number;
  first: number;
  n: number;
}

export const ERR_KEY = 'ampli-errors';
export const ERR_MAX = 50;
export const ERR_MSG_MAX = 300;
export const ERR_STACK_MAX = 2000;
const WHERE_MAX = 80;
const VER_MAX = 20;

const KINDS: readonly ErrKind[] = ['error', 'rejection', 'render', 'chunk'];

const IDENT = /^[A-Za-z_$][\w$.]*$/;

export function scrub(text: string): string {
  return text
    .replace(/#[a-z]=[^\s)'"]*/gi, '#…')
    .replace(/(https?:\/\/[^\s?#)]+)\?[^\s#):]*/g, '$1')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '…')
    .replace(/\+?\d[\d\s()-]{8,}\d/g, '…')
    .replace(/[A-Za-z0-9_+=-]{32,}/g, m => (/\d/.test(m) ? '…' : m))
    .replace(/"([^"\n]*)"/g, (m, s: string) => (IDENT.test(s) ? m : '"…"'))
    .replace(/'([^'\n]*)'/g, (m, s: string) => (IDENT.test(s) ? m : '\'…\''));
}

export const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export function errorOf(reason: unknown): { msg: string; stack?: string } {
  try {
    let msg: string;
    let stack: string | undefined;
    if (reason instanceof Error) {
      msg = reason.message ? reason.name + ': ' + reason.message : reason.name;
      stack = typeof reason.stack === 'string' ? reason.stack : undefined;
    } else if (reason && typeof reason === 'object' && typeof (reason as { message?: unknown }).message === 'string') {
      msg = (reason as { message: string }).message;
    } else {
      msg = String(reason);
    }
    const out: { msg: string; stack?: string } = { msg: clip(scrub(msg), ERR_MSG_MAX) };
    if (stack) out.stack = clip(scrub(stack), ERR_STACK_MAX);
    return out;
  } catch (e) {
    void e;
    return { msg: 'Unknown error' };
  }
}

const frame = (stack?: string): string => (stack ?? '').split('\n').map(s => s.trim()).find(s => /:\d+:\d+/.test(s)) ?? '';

const sig = (e: ErrEntry): string => e.kind + '\n' + e.msg + '\n' + frame(e.stack);

export function addEntry(log: readonly ErrEntry[], e: ErrEntry): ErrEntry[] {
  const key = sig(e);
  const i = log.findIndex(x => sig(x) === key);
  if (i < 0) return [...log, { ...e }].slice(-ERR_MAX);
  const old = log[i];
  const merged: ErrEntry = { ...old, t: e.t, n: old.n + e.n, ver: e.ver ?? old.ver, where: e.where ?? old.where };
  return [...log.slice(0, i), ...log.slice(i + 1), merged].slice(-ERR_MAX);
}

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readEntry(o: unknown): ErrEntry | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (!KINDS.includes(r.kind as ErrKind) || typeof r.msg !== 'string' || !fin(r.t)) return null;
  const e: ErrEntry = {
    kind: r.kind as ErrKind,
    msg: clip(r.msg, ERR_MSG_MAX),
    t: r.t,
    first: fin(r.first) ? r.first : r.t,
    n: fin(r.n) && r.n >= 1 ? Math.floor(r.n) : 1,
  };
  if (typeof r.stack === 'string') e.stack = clip(r.stack, ERR_STACK_MAX);
  if (typeof r.where === 'string') e.where = clip(r.where, WHERE_MAX);
  if (typeof r.ver === 'string') e.ver = clip(r.ver, VER_MAX);
  return e;
}

export function parseLog(raw: string | null): ErrEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(readEntry).filter((e): e is ErrEntry => e !== null).slice(-ERR_MAX);
  } catch (e) {
    void e;
    return [];
  }
}
