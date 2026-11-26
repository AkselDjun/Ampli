import type { Row } from './types';
import { fs } from './format';
import { MAX_LINES } from './limits';

export interface SentLine {
  id: string;
  name: string;
  zone: string;
  pd: number;
  In: number | null;
  curve: string;
  S: number | null;
  len: number;
}

export interface Sent {
  at: number;
  lines: SentLine[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const sentOf = (x: Row): SentLine => ({
  id: x.l.id,
  name: x.l.name,
  zone: (x.l.zone ?? '').trim(),
  pd: Math.round(num(x.r.pd)),
  In: x.r.In,
  curve: x.r.curve,
  S: x.r.S,
  len: num(x.l.len)
});

export const snapshot = (rows: readonly Row[], at: number): Sent => ({ at, lines: rows.map(sentOf) });

const ab = (In: number | null, curve: string): string => (In === null ? 'не подобран' : `${curve}${In}`);
const sec = (S: number | null): string => (S === null ? '—' : fs(S));

export function lineChanges(was: SentLine | undefined, row: Row): string[] {
  if (!was) return ['Группа добавлена после отправки'];
  const now = sentOf(row);
  const out: string[] = [];
  if (was.In !== now.In || was.curve !== now.curve) out.push(`Автомат ${ab(was.In, was.curve)} → ${ab(now.In, now.curve)}`);
  if (was.S !== now.S) out.push(`Сечение ${sec(was.S)} → ${sec(now.S)} мм²`);
  if (was.len !== now.len) out.push(`Длина ${fs(was.len)} → ${fs(now.len)} м`);
  if (was.pd !== now.pd) out.push(`Мощность ${was.pd} → ${now.pd} Вт`);
  if (was.zone.toLowerCase() !== now.zone.toLowerCase()) out.push(`Помещение ${was.zone || 'не указано'} → ${now.zone || 'не указано'}`);
  return out;
}

export function changedIds(sent: Sent | undefined, rows: readonly Row[]): Set<string> {
  const out = new Set<string>();
  if (!sent) return out;
  const by = new Map(sent.lines.map(x => [x.id, x]));
  for (const x of rows) if (lineChanges(by.get(x.l.id), x).length) out.add(x.l.id);
  return out;
}

export function removedSince(sent: Sent | undefined, rows: readonly Row[]): string[] {
  if (!sent) return [];
  const ids = new Set(rows.map(x => x.l.id));
  return sent.lines.filter(x => !ids.has(x.id)).map(x => x.name);
}

export function normSent(v: unknown): Sent | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.lines)) return undefined;
  const at = typeof o.at === 'number' && Number.isFinite(o.at) && o.at > 0 ? o.at : 0;
  const lines: SentLine[] = [];
  for (const x of o.lines.slice(0, MAX_LINES)) {
    if (!x || typeof x !== 'object') continue;
    const l = x as Record<string, unknown>;
    if (typeof l.id !== 'string' || !l.id) continue;
    lines.push({
      id: l.id.slice(0, 64),
      name: typeof l.name === 'string' ? l.name.slice(0, 80) : '',
      zone: typeof l.zone === 'string' ? l.zone.slice(0, 60) : '',
      pd: Math.round(num(l.pd)),
      In: numOrNull(l.In),
      curve: typeof l.curve === 'string' ? l.curve.slice(0, 4) : '',
      S: numOrNull(l.S),
      len: num(l.len)
    });
  }
  return { at, lines };
}
