import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent as ReactKeyEvent, ReactNode } from 'react';
import { IconAlert, IconClose, IconDone, IconDown, IconInfo } from './Icons';
import { currentToast, dismissToast, subscribeToast, toastLife } from './toast';
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

const TIP_GAP = 6;
const TIP_EDGE = 8;

export function Tip({ children, label = 'Подсказка' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tt = useRef<HTMLSpanElement>(null);
  const place = useCallback(() => {
    const host = ref.current;
    const box = tt.current;
    if (!host || !box) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const b = host.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.max(TIP_EDGE, Math.min(b.left + b.width / 2 - w / 2, vw - w - TIP_EDGE));
    const below = b.bottom + TIP_GAP;
    const above = b.top - TIP_GAP - h;
    const top = below + h <= vh - TIP_EDGE || above < TIP_EDGE ? Math.max(TIP_EDGE, Math.min(below, vh - h - TIP_EDGE)) : above;
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }, []);
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
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, place]);
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);
  return (
    <span className={'tip' + (open ? ' on' : '')} ref={ref} onMouseEnter={place} onFocus={place}>
      <button type="button" className="tip-b" aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <IconInfo />
      </button>
      <span className="tip-t" role="tooltip" ref={tt}>{children}</span>
    </span>
  );
}

export interface TabDef {
  id: string;
  label: string;
}

export function Tabs({ scope, items, cur, onChange, label }: { scope: string; items: TabDef[]; cur: string; onChange: (id: string) => void; label: string }) {
  const move = (e: ReactKeyEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    onChange(next.id);
    document.getElementById(scope + '-tab-' + next.id)?.focus();
  };
  return (
    <div className="tabbar" role="tablist" aria-label={label}>
      {items.map((t, i) => (
        <button
          key={t.id}
          id={scope + '-tab-' + t.id}
          type="button"
          role="tab"
          className={'tabbar-b' + (cur === t.id ? ' on' : '')}
          aria-selected={cur === t.id}
          aria-controls={scope + '-tp-' + t.id}
          tabIndex={cur === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={e => move(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ scope, id, cur, children }: { scope: string; id: string; cur: string; children: ReactNode }) {
  return (
    <div className="tabpanel" role="tabpanel" id={scope + '-tp-' + id} aria-labelledby={scope + '-tab-' + id} hidden={cur !== id}>
      {children}
    </div>
  );
}

export function Sheet({
  open, onClose, title, compact, tip, bar, children
}: {
 
  compact?: boolean;
  bar?: ReactNode;
  open: boolean;
  onClose: () => void;
  title: string;
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
      <div className={'sheet-panel' + (compact ? ' compact' : '')} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          {tip && <Tip>{tip}</Tip>}
          <button ref={closeRef} className="sheet-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {bar}
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

export function Fold({
  title, badge, open, className, children
}: {
  title: string;
  badge?: ReactNode;
  open?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [on, setOn] = useState(!!open);
  return (
    <section className={'card fold ' + (className ?? '')}>
      <button className="fold-h" type="button" aria-expanded={on} onClick={() => setOn(v => !v)}>
        <h2>{title}</h2>
        {badge}
        <IconDown className="fold-chev" />
      </button>
      {on && <div className="fold-b">{children}</div>}
    </section>
  );
}

export function Toaster() {
  const t = useSyncExternalStore(subscribeToast, currentToast);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!t || hold) return;
    const id = t.id;
    const tm = window.setTimeout(() => dismissToast(id), toastLife(t));
    return () => window.clearTimeout(tm);
  }, [t, hold]);
  useEffect(() => {
    setHold(false);
  }, [t]);
  const card = t && (
    <div
      key={t.id}
      className={'toast ' + t.tone}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      {t.tone === 'ok' && <IconDone className="toast-i" />}
      {t.tone === 'bad' && <IconAlert className="toast-i" />}
      <span className="toast-t">{t.text}</span>
      {t.label && t.run && (
        <button type="button" className="toast-a" onClick={() => { const run = t.run as () => void; dismissToast(t.id); run(); }}>{t.label}</button>
      )}
      <button type="button" className="toast-x" aria-label="Закрыть уведомление" onClick={() => dismissToast(t.id)}><IconClose /></button>
    </div>
  );
  return (
    <>
      <div className="toast-zone" role="status" aria-live="polite">{t && t.tone !== 'bad' ? card : null}</div>
      <div className="toast-zone" role="alert">{t && t.tone === 'bad' ? card : null}</div>
    </>
  );
}

const canHover = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function HoverTips() {
  const [st, setSt] = useState<{ text: string; el: HTMLElement } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  shown.current = st !== null;
  useEffect(() => {
    let timer = 0;
    let keys = false;
    const find = (x: EventTarget | null): HTMLElement | null => (x instanceof Element ? x.closest<HTMLElement>('[data-tip]') : null);
    const hide = () => {
      window.clearTimeout(timer);
      setSt(null);
    };
    const press = () => {
      keys = false;
      hide();
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !canHover()) return;
      const el = find(e.target);
      if (!el) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSt({ text: el.dataset.tip ?? '', el }), 350);
    };
    const out = (e: PointerEvent) => {
      const el = find(e.target);
      if (!el) return;
      const to = e.relatedTarget;
      if (to instanceof Node && (el.contains(to) || box.current?.contains(to))) return;
      hide();
    };
    const focus = (e: FocusEvent) => {
      const el = find(e.target);
      if (el && keys) setSt({ text: el.dataset.tip ?? '', el });
    };
    const key = (e: KeyboardEvent) => {
      keys = true;
      if (e.key === 'Escape' && shown.current) {
        e.stopPropagation();
        hide();
      }
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('pointerdown', press);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', press);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);
  useLayoutEffect(() => {
    const b = box.current;
    if (!st || !b) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const r = st.el.getBoundingClientRect();
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const left = Math.max(TIP_EDGE, Math.min(r.left + r.width / 2 - w / 2, vw - w - TIP_EDGE));
    const below = r.bottom + TIP_GAP;
    const top = below + h <= vh - TIP_EDGE ? below : Math.max(TIP_EDGE, r.top - TIP_GAP - h);
    b.style.left = left + 'px';
    b.style.top = top + 'px';
  }, [st]);
  if (!st || !st.text) return null;
  return (
    <div className="hover-tip" role="tooltip" ref={box} onPointerLeave={() => setSt(null)}>{st.text}</div>
  );
}
