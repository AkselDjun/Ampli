export type Tone = 'info' | 'ok' | 'bad';

export interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  label?: string;
  run?: () => void;
}

let cur: ToastMsg | null = null;
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export function toast(text: string, o: { tone?: Tone; label?: string; run?: () => void } = {}): void {
  seq += 1;
  cur = { id: seq, text, tone: o.tone ?? 'info', label: o.label, run: o.run };
  emit();
}

export const toastOk = (text: string): void => toast(text, { tone: 'ok' });
export const toastBad = (text: string): void => toast(text, { tone: 'bad' });
export const toastUndo = (text: string, undo: () => void): void => toast(text, { label: 'Отменить', run: undo });

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
