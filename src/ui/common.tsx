import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBackClose } from './back';
import type { KeyboardEvent as ReactKeyEvent, ReactNode } from 'react';
import { IconAlert, IconBack, IconClose, IconDone, IconDown, IconInfo } from './Icons';
import { useSheetNav } from './sheetnav';
import { currentToast, dismissToast, subscribeToast, toastLife } from './toast';
import { haptic } from './haptic';
import { buttonClass } from './kit';
import type { ButtonSize, ButtonVariant } from './kit';
import type { FieldErr } from '../core/limits';

export function segStacks(labels: string[]): boolean {
  if (labels.length > 3) return false;
  const word = Math.max(...labels.flatMap(l => l.split(/\s+/).map(w => w.length)));
  const full = Math.max(...labels.map(l => l.length));
  return word * labels.length > 30 || full > 24;
}

export function Seg<T extends string | number>({
  name, value, items, onChange, labelledBy
}: {
  name: string;
  value: T;
  items: [T, string][];
  onChange: (v: T) => void;
  labelledBy?: string;
}) {
  const stack = segStacks(items.map(i => i[1]));
  return (
    <div className={stack ? 'rlist' : 'seg'} role="radiogroup" aria-labelledby={labelledBy} data-n={items.length} data-stack={stack ? '' : undefined}>
      {items.map(([v, label]) => (
        <label key={String(v)}>
          <input type="radio" name={name} value={String(v)} checked={String(value) === String(v)} onChange={() => onChange(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export const errAttrs = (e: FieldErr | null | undefined, id: string) => (e ? { 'aria-invalid': true, 'aria-describedby': id, 'data-err': e.hard ? 'hard' : 'soft' } as const : {});

export function Err({ e, id }: { e: FieldErr | null | undefined; id: string }) {
  return e ? <small id={id} className={'f-err' + (e.hard ? '' : ' soft')} role={e.hard ? 'alert' : undefined}>{e.msg}</small> : null;
}

export function Stepper({
  value, onChange, onStep, label, min, max, step, less = 'Меньше', more = 'Больше', d, err, errId
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
  err?: FieldErr | null;
  errId?: string;
}) {
  return (
    <div className="step">
      <button type="button" onClick={() => onStep(-d)} aria-label={less}>−</button>
      <input type="text" inputMode="decimal" min={min} max={max} step={step} aria-label={label} {...errAttrs(err, errId ?? '')} value={String(value)} onChange={e => onChange(e.target.value)} onBlur={() => {
        const raw = String(value).trim().replace(',', '.');
        const v = Number(raw);
        if (!raw || !Number.isFinite(v)) return;
        const lo = min === undefined ? -Infinity : Number(min);
        const hi = max === undefined ? Infinity : Number(max);
        const cl = Math.min(hi, Math.max(lo, v));
        if (cl !== v) onChange(String(cl));
      }} />
      <button type="button" onClick={() => onStep(d)} aria-label={more}>+</button>
    </div>
  );
}

export function ArmButton({
  className, variant, size, link, label, armedLabel = 'Нажмите ещё раз', onRun, disabled
}: {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  link?: boolean;
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
      haptic(20);
      onRun();
      return;
    }
    setArmed(true);
    t.current = window.setTimeout(() => setArmed(false), 3000);
  };
  return (
    <button className={link ? ['link', className].filter(Boolean).join(' ') : buttonClass(variant, size, className)} type="button" onClick={click} disabled={disabled}>
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
  const pick = (id: string, el: HTMLElement) => {
    onChange(id);
    const body = el.closest('.sheet-panel')?.querySelector('.sheet-body');
    if (body) body.scrollTop = 0;
  };
  const move = (e: ReactKeyEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    pick(next.id, e.currentTarget);
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
          onClick={e => pick(t.id, e.currentTarget)}
          onKeyDown={e => move(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ scope, id, cur, lazy = false, children }: { scope: string; id: string; cur: string; lazy?: boolean; children: ReactNode }) {
  const on = cur === id;
  return (
    <div className="tabpanel" role="tabpanel" id={scope + '-tp-' + id} aria-labelledby={scope + '-tab-' + id} hidden={!on}>
      {on || !lazy ? children : null}
    </div>
  );
}

const STACK: object[] = [];
const SCROLL = new Map<string, number>();
const BACK = { on: false };
const OUT_MS = 150;

const calm = (): boolean => typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const quiet = (panel: HTMLElement): (() => void) => {
  const root = panel.closest('#app');
  if (!root) return () => undefined;
  const done: Element[] = [];
  for (const el of Array.from(root.children)) {
    if (el.contains(panel) || el.matches('.toast-zone, .tour, .sheet:not([hidden])') || el.hasAttribute('inert')) continue;
    el.setAttribute('inert', '');
    done.push(el);
  }
  return () => done.forEach(el => el.removeAttribute('inert'));
};

export function Sheet({
  open, onClose, title, compact, tip, bar, historyLayer = true, tourId, children
}: {
  compact?: boolean;
  bar?: ReactNode;
  open: boolean;
  onClose: () => void;
  title: string;
  tip?: ReactNode;
  historyLayer?: boolean;
  tourId?: string;
  children: ReactNode;
}) {
  const headRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useBackClose(open && historyLayer, onClose);
  const bodyRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const nav = useSheetNav();
  const y0 = useRef<number | null>(null);
  const dy = useRef(0);
  const titleRef = useRef(title);
  const id = useId();
  const [leaving, setLeaving] = useState(false);
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    setLeaving(!open && !calm());
  }
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(false), OUT_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useLayoutEffect(() => {
    titleRef.current = title;
  });
  const trap = (e: ReactKeyEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0 && !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked));
    const first = all[0];
    const end = all[all.length - 1];
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || !e.currentTarget.contains(document.activeElement))) {
      e.preventDefault();
      end.focus();
    } else if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault();
      first.focus();
    }
  };
  const move = (v: number) => {
    dy.current = v;
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = v ? 'translateY(' + v + 'px)' : '';
    el.style.transition = v ? 'none' : '';
  };
  const drag = {
    onTouchStart: (e: React.TouchEvent) => { y0.current = e.touches[0].clientY; },
    onTouchMove: (e: React.TouchEvent) => { if (y0.current !== null) move(Math.max(0, e.touches[0].clientY - y0.current)); },
    onTouchEnd: () => {
      const d = dy.current;
      const h = panelRef.current?.getBoundingClientRect().height ?? 0;
      y0.current = null;
      move(0);
      if (d > Math.max(90, h * 0.3)) onClose();
    }
  };
  useEffect(() => {
    if (!open) return;
    const me = {};
    const ttl = titleRef.current;
    STACK.push(me);
    opener.current = document.activeElement;
    const body = bodyRef.current;
    if (body) body.scrollTop = BACK.on ? SCROLL.get(ttl) ?? 0 : 0;
    BACK.on = false;
    document.documentElement.style.overflow = 'hidden';
    const unquiet = panelRef.current ? quiet(panelRef.current) : () => undefined;
    headRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && STACK[STACK.length - 1] === me) onClose();
    };
    document.addEventListener('keydown', key);
    return () => {
      if (body) SCROLL.set(ttl, body.scrollTop);
      const i = STACK.indexOf(me);
      if (i >= 0) STACK.splice(i, 1);
      document.removeEventListener('keydown', key);
      unquiet();
      if (!STACK.length) document.documentElement.style.overflow = '';
      const o = opener.current;
      if (o instanceof HTMLElement && document.contains(o)) o.focus();
    };
  }, [open, onClose]);
  return (
    <div className={'sheet' + (leaving ? ' out' : '')} hidden={!open} inert={leaving || undefined} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className={'sheet-panel' + (compact ? ' compact' : '') + (bar ? '' : ' fit')} role="dialog" aria-modal="true" aria-labelledby={id} data-tour-view={tourId} onKeyDown={trap}>
        <div className="sheet-head" {...drag}>
          {nav.back && <button className="sheet-back" type="button" onClick={() => { BACK.on = true; nav.back?.(); }} aria-label={'Назад: ' + nav.to} data-tip={'Назад: ' + nav.to}><IconBack /></button>}
          <h2 id={id} ref={headRef} tabIndex={-1}>{title}</h2>
          {tip && <Tip>{tip}</Tip>}
          <button className="sheet-close" type="button" onClick={onClose} aria-label="Закрыть"><IconClose /></button>
        </div>
        {bar}
        {nav.hint && (
          <div className="sheet-hint" role="status">
            <span>{nav.hint.text}</span>
            <button type="button" className="sheet-hint-a" onClick={nav.hint.run}>{nav.hint.label}</button>
            <button type="button" className="sheet-hint-x" aria-label="Скрыть подсказку" onClick={nav.hint.close}><IconClose /></button>
          </div>
        )}
        <div className="sheet-body" ref={bodyRef}>{children}</div>
      </div>
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
  const [holdId, setHoldId] = useState<number | null>(null);
  const hold = !!t && holdId === t.id;
  const setHold = (v: boolean) => setHoldId(v && t ? t.id : null);
  useEffect(() => {
    if (!t || hold) return;
    const id = t.id;
    const tm = window.setTimeout(() => dismissToast(id), toastLife(t));
    return () => window.clearTimeout(tm);
  }, [t, hold]);
  const card = t && (
    <div
      key={t.id}
      className={'toast ' + t.tone}
      onPointerEnter={e => { if (e.pointerType === 'mouse') setHold(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setHold(false); }}
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
  useEffect(() => {
    shown.current = st !== null;
  }, [st]);
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
