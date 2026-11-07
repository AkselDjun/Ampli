import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyEvent } from 'react';
import { Button } from './kit';
import { ONBOARDING_STEPS } from '../features/onboarding/model';
import type { TourScene } from '../features/onboarding/model';
import { markOnboardingDone } from '../features/onboarding/storage';

export { ONBOARDING_KEY, onboardingPending } from '../features/onboarding/storage';
export type { TourScene } from '../features/onboarding/model';

const visibleTarget = (selectors?: readonly string[]): HTMLElement | null => {
  for (const selector of selectors ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
};

export function Onboarding({ onScene, onClose }: { onScene: (scene: TourScene) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const current = ONBOARDING_STEPS[step];

  const close = () => {
    markOnboardingDone();
    onClose();
  };

  useEffect(() => {
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    primary.current?.focus();
    const keepFocus = (e: FocusEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) primary.current?.focus();
    };
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.documentElement.style.overflow = before;
      document.removeEventListener('focusin', keepFocus);
    };
  }, []);

  useEffect(() => {
    onScene(current.scene);
  }, [current.scene, onScene]);

  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = visibleTarget(current.targets)?.getBoundingClientRect() ?? null;
        setRect(prev => {
          if (!prev || !next) return next;
          return prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height ? prev : next;
        });
      });
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [current]);

  const spot = rect ? {
    left: Math.max(6, rect.left - 6),
    top: Math.max(6, rect.top - 6),
    width: Math.min(window.innerWidth - 12, rect.width + 12),
    height: Math.min(window.innerHeight - 12, rect.height + 12)
  } : undefined;
  const cardStyle: CSSProperties | undefined = rect
    ? (rect.top + rect.height / 2 > window.innerHeight / 2 ? { top: 16 } : { bottom: 16 })
    : undefined;
  const next = () => {
    if (step === ONBOARDING_STEPS.length - 1) close();
    else setStep(step + 1);
  };
  const trap = (e: ReactKeyEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    if (e.key !== 'Tab') return;
    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };

  return (
    <div ref={root} className={'tour' + (rect ? ' targeted' : ' intro')} onKeyDown={trap}>
      {spot ? <div className="tour-spot" style={spot} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
      <section className="tour-card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
        <div className="tour-count">Полное обучение · шаг {step + 1} из {ONBOARDING_STEPS.length}</div>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-text">{current.text}</p>
        <div className="tour-dots" aria-hidden="true">{ONBOARDING_STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          <button className="link" type="button" onClick={close}>{step === ONBOARDING_STEPS.length - 1 ? 'Закрыть' : 'Пропустить'}</button>
          <span />
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Назад</Button>}
          <Button ref={primary} variant="primary" onClick={next}>{step === ONBOARDING_STEPS.length - 1 ? 'Готово' : 'Далее'}</Button>
        </div>
      </section>
    </div>
  );
}
