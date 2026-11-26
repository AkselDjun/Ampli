export interface Note {
  id: string;
  t: string;
  at: number;
  done?: boolean;
}

export const NOTE_MAX = 500;
export const NOTES_MAX = 50;

export function normNotes(v: unknown): Note[] {
  if (!Array.isArray(v)) return [];
  const out: Note[] = [];
  for (const x of v) {
    if (out.length >= NOTES_MAX) break;
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const t = typeof o.t === 'string' ? o.t.trim().slice(0, NOTE_MAX) : '';
    if (!t) continue;
    const at = typeof o.at === 'number' && Number.isFinite(o.at) && o.at > 0 ? o.at : 0;
    const id = typeof o.id === 'string' && o.id ? o.id.slice(0, 64) : `n${out.length}`;
    out.push({ id, t, at, ...(o.done === true ? { done: true } : {}) });
  }
  return out;
}

export const openNotes = (n: readonly Note[] | undefined): number => (n ? n.filter(x => !x.done).length : 0);
