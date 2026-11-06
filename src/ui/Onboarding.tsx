import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyEvent } from 'react';
import { Button } from './kit';

export const ONBOARDING_KEY = 'ampli-onboarding-v1';

export function onboardingPending(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== 'done';
  } catch {
    return true;
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'done');
  } catch {
    // The tour still closes when storage is unavailable.
  }
}

interface Step {
  title: string;
  text: string;
  targets?: string[];
}

const STEPS: Step[] = [
  {
    title: 'Познакомимся с Ampli',
    text: 'За пару минут покажем путь от групп электропроводки до готовой схемы, сметы и приёмки.'
  },
  {
    title: 'Проект и параметры сети',
    text: 'Здесь находятся ваши проекты. Ниже задаются фазы, выделенная мощность, способ прокладки и защита — от них зависит весь расчёт.',
    targets: ['[data-tour="projects"]']
  },
  {
    title: 'Группы линий',
    text: 'Каждая строка — отдельная линия щитка. Откройте группу, чтобы изменить приборы, длину кабеля, помещение и увидеть подробный расчёт.',
    targets: ['[data-tour="group"]']
  },
  {
    title: 'Добавление групп',
    text: 'Добавляйте свет, розетки и мощные приборы вручную или соберите группы сразу из списка комнат.',
    targets: ['[data-tour="add"]']
  },
  {
    title: 'Итоги и проверки',
    text: 'Верхняя панель показывает общую мощность, ввод и замечания. Нажмите на показатель или проверку, чтобы увидеть причину и способ исправления.',
    targets: ['[data-tour="summary"]']
  },
  {
    title: 'Щиток, приёмка и отчёт',
    text: 'В нижнем меню открываются раскладка щитка, замеры, чек-лист, схема, спецификация и смета. Теперь можно начать с примера или создать свой проект.',
    targets: ['[data-tour="reports"]']
  }
];

const visibleTarget = (selectors?: string[]): HTMLElement | null => {
  for (const selector of selectors ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
};

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const current = STEPS[step];

  const close = () => {
    markOnboardingDone();
    setStep(0);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    primary.current?.focus();
    return () => {
      document.documentElement.style.overflow = before;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const target = visibleTarget(current.targets);
      setRect(target?.getBoundingClientRect() ?? null);
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [current, open]);

  if (!open) return null;

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
    if (step === STEPS.length - 1) close();
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
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className={'tour' + (rect ? ' targeted' : ' intro')} onKeyDown={trap}>
      {spot ? <div className="tour-spot" style={spot} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
      <section className="tour-card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
        <div className="tour-count">Шаг {step + 1} из {STEPS.length}</div>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-text">{current.text}</p>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          <button className="link" type="button" onClick={close}>{step === STEPS.length - 1 ? 'Закрыть' : 'Пропустить'}</button>
          <span />
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Назад</Button>}
          <Button ref={primary} variant="primary" onClick={next}>{step === STEPS.length - 1 ? 'Начать работу' : 'Далее'}</Button>
        </div>
      </section>
    </div>
  );
}
