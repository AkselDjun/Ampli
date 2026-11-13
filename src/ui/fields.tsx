import { useId } from 'react';
import type { ReactNode } from 'react';
import { Err, Seg, Stepper, Tip } from './common';
import { cx } from './kit';
import type { FieldErr } from '../core/limits';

export function FieldLabel({ id, label, tip, tipLabel }: { id?: string; label: ReactNode; tip?: ReactNode; tipLabel?: string }) {
  if (!tip) return <span className="lbl" id={id}>{label}</span>;
  return (
    <span className="lbl-row">
      <span className="lbl" id={id}>{label}</span>
      <Tip label={tipLabel}>{tip}</Tip>
    </span>
  );
}

export function ChoiceField<T extends string | number>({
  name, label, tip, tipLabel, value, items, onChange, note, className, tour
}: {
  name: string;
  label: ReactNode;
  tip?: ReactNode;
  tipLabel?: string;
  value: T;
  items: [T, string][];
  onChange: (v: T) => void;
  note?: ReactNode;
  className?: string;
  tour?: string;
}) {
  const id = useId();
  return (
    <div className={cx('f', className)} data-tour={tour}>
      <FieldLabel id={id} label={label} tip={tip} tipLabel={tipLabel} />
      <Seg<T> name={name} labelledBy={id} value={value} items={items} onChange={onChange} />
      {note && <small className="muted">{note}</small>}
    </div>
  );
}

export function StepField({
  label, aria, tip, tipLabel, value, d, min, max, step, less, more, onChange, onStep, err, className, tour
}: {
  label: ReactNode;
  aria: string;
  tip?: ReactNode;
  tipLabel?: string;
  value: string | number;
  d: number;
  min?: number;
  max?: number;
  step?: number | string;
  less?: string;
  more?: string;
  onChange: (v: string) => void;
  onStep: (d: number) => void;
  err?: FieldErr | null;
  className?: string;
  tour?: string;
}) {
  const errId = useId();
  return (
    <div className={cx('f', className)} data-tour={tour}>
      <FieldLabel label={label} tip={tip} tipLabel={tipLabel} />
      <Stepper value={value} d={d} min={min} max={max} step={step} label={aria} less={less} more={more} onChange={onChange} onStep={onStep} err={err} errId={errId} />
      <Err e={err} id={errId} />
    </div>
  );
}

export function Empty({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('empty', className)}>
      <p className="empty-t">{children}</p>
      {action && <div className="empty-a">{action}</div>}
    </div>
  );
}

export function AddChips<K extends string>({ label, items, onAdd }: { label: string; items: [K, string][]; onAdd: (k: K) => void }) {
  return (
    <div className="chips room-add" role="group" aria-label={label}>
      {items.map(([k, text]) => (
        <button key={k} className="chip" type="button" onClick={() => onAdd(k)}>+ {text}</button>
      ))}
    </div>
  );
}
