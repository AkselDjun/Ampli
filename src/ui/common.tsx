import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconInfo } from './Icons';
import type { CfgN } from '../core/types';
import { BASIS_LABEL, assumptions } from '../core/assumptions';

export function Seg<T extends string | number>({
  name, value, items, onChange, labelledBy
}: {
  name: string;
  value: T;
  items: [T, string][];
  onChange: (v: T) => void;
  labelledBy?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-labelledby={labelledBy}>
      {items.map(([v, label]) => (
        <label key={String(v)}>
          <input type="radio" name={name} value={String(v)} checked={String(value) === String(v)} onChange={() => onChange(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export function Stepper({
  value, onChange, onStep, label, min, max, step, less = 'Меньше', more = 'Больше', d
}: {
  value: string | number;
  onChange: (v: string) => void;
  onStep: (d: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number | string;
  less?: string;
  more?: string;
  d: number;
}) {
  return (
    <div className="step">
      <button type="button" onClick={() => onStep(-d)} aria-label={less}>−</button>
      <input type="number" inputMode="decimal" min={min} max={max} step={step} aria-label={label} value={String(value)} onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={() => onStep(d)} aria-label={more}>+</button>
    </div>
  );
}

export function ArmButton({
  className, label, armedLabel = 'Нажмите ещё раз', onRun, disabled
}: {
  className: string;
  label: string;
  armedLabel?: string;
  onRun: () => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const click = () => {
    if (armed) {
      window.clearTimeout(t.current);
      setArmed(false);
      onRun();
      return;
    }
    setArmed(true);
    t.current = window.setTimeout(() => setArmed(false), 3000);
  };
  return (
    <button className={className} type="button" onClick={click} disabled={disabled}>
      {armed ? armedLabel : label}
    </button>
  );
}

export function Tip({ children, label = 'Подсказка' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return (
    <span className={'tip' + (open ? ' on' : '')} ref={ref}>
      <button type="button" className="tip-b" aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <IconInfo />
      </button>
      <span className="tip-t" role="tooltip">{children}</span>
    </span>
  );
}

export function Sheet({
  open, onClose, title, small, full, tip, children
}: {
  full?: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  small?: boolean;
  tip?: ReactNode;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.documentElement.style.overflow = '';
      const o = opener.current;
      if (o instanceof HTMLElement && document.contains(o)) o.focus();
    };
  }, [open, onClose]);
  const id = 'ttl-' + title.length + title.charCodeAt(0);
  return (
    <div className="sheet" hidden={!open} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={'sheet-panel' + (small ? ' sm' : '') + (full ? ' full' : '')} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          {tip && <Tip>{tip}</Tip>}
          <button ref={closeRef} className="sheet-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Assumptions({ cfg }: { cfg: CfgN }) {
  return (
    <div className="tablewrap">
      <table className="t2 assum">
        <thead>
          <tr><th>Параметр</th><th>Значение</th><th>Основание</th></tr>
        </thead>
        <tbody>
          {assumptions(cfg).map(a => (
            <tr key={a.name}>
              <td>{a.name}</td>
              <td>{a.value}</td>
              <td><span className={'basis ' + a.basis}>{BASIS_LABEL[a.basis]}</span> {a.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
