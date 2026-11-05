export type Tone = 'info' | 'ok' | 'bad';

export interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  label?: string;
  run?: () => void;
  ver?: number;
}

let cur: ToastMsg | null = null;
let verOf: (() => number) | null = null;

export const setToastVersion = (f: () => number): void => {
  verOf = f;
};
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export function toast(text: string, o: { tone?: Tone; label?: string; run?: () => void; ver?: number } = {}): void {
  seq += 1;
  cur = { id: seq, text, tone: o.tone ?? 'info', label: o.label, run: o.run, ver: o.ver };
  emit();
}

export const toastOk = (text: string): void => toast(text, { tone: 'ok' });
export const toastBad = (text: string): void => toast(text, { tone: 'bad' });
export const toastUndo = (text: string, undo: () => void, history = true): void => {
  const vf = verOf;
  if (!history || !vf) {
    toast(text, { label: 'Отменить', run: undo });
    return;
  }
  const ver = vf();
  toast(text, { label: 'Отменить', ver, run: () => { if (vf() === ver + 1) undo(); } });
};

export function staleUndo(now: number): void {
  if (cur && cur.ver !== undefined && now > cur.ver + 1) dismissToast(cur.id);
}

export function dismissToast(id?: number): void {
  if (!cur || (id !== undefined && cur.id !== id)) return;
  cur = null;
  emit();
}

export function subscribeToast(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export const currentToast = (): ToastMsg | null => cur;

export const toastLife = (t: ToastMsg): number => (t.run ? 8000 : (t.tone === 'bad' ? 7000 : 4500));
