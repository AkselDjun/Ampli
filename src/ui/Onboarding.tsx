import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent as ReactKeyEvent, TouchEvent as ReactTouchEvent } from 'react';
import '../styles/onboarding.css';
import { Button } from './kit';
import { plural } from '../core/format';
import { IconBolt, IconBulb, IconCheck, IconClose, IconDoc, IconDone, IconFolder, IconList, IconNet, IconPanel, IconRooms, IconSocket } from './Icons';
import { ONBOARDING_CHAPTERS, ONBOARDING_STEPS, TOUR_SCENE, chapterProgress, chapterStart, chapterSteps, clampStep, minutesFor, targetsFor } from '../features/onboarding/model';
import type { TourIcon, TourScene } from '../features/onboarding/model';
import { markOnboardingDone, saveStep, savedStep } from '../features/onboarding/storage';
import { EDGE, NARROW, needsScroll, placeCard, spotBox } from '../features/onboarding/placement';
import type { Box, CardPlace } from '../features/onboarding/placement';

export type TourFinish = 'create' | 'stay';
type Phase = 'welcome' | 'step' | 'finish';

const ICON: Record<TourIcon, () => JSX.Element> = {
  summary: () => <IconBolt />,
  group: () => <IconList />,
  editor: () => <IconSocket />,
  network: () => <IconNet />,
  rooms: () => <IconRooms />,
  panel: () => <IconPanel />,
  work: () => <IconCheck />,
  report: () => <IconDoc />,
  projects: () => <IconFolder />
};

const TOTAL = ONBOARDING_STEPS.length;

const visibleTarget = (selectors: readonly string[]): HTMLElement | null => {
  for (const selector of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
    }
  }
  return null;
};

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const sameBox = (a: Box | null, b: Box | null): boolean => a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);
const view = () => ({ width: window.innerWidth, height: window.innerHeight });

function Board() {
  const devs = [
    { x: 14, k: 'in', w: 34 },
    { x: 52, k: 'rcd', w: 34 },
    { x: 90, k: 'light', w: 17 },
    { x: 111, k: 'socket', w: 17 },
    { x: 132, k: 'socket', w: 17 },
    { x: 153, k: 'power', w: 17 },
    { x: 174, k: 'free', w: 17 },
    { x: 195, k: 'free', w: 17 }
  ];
  return (
    <svg className="tour-art" viewBox="0 0 226 92" aria-hidden="true" focusable="false">
      <rect className="ta-box" x="2" y="2" width="222" height="88" rx="12" />
      <rect className="ta-rail" x="8" y="40" width="210" height="12" rx="2" />
      {devs.map((d, i) => (
        <g key={i} className={'ta-dev ta-' + d.k} style={{ '--i': i } as CSSProperties}>
          <rect className="ta-body" x={d.x} y="16" width={d.w} height="60" rx="3" />
          {d.k !== 'free' && <rect className="ta-lever" x={d.x + d.w / 2 - 4} y="36" width="8" height="18" rx="2" />}
          {d.k !== 'free' && <rect className="ta-tag" x={d.x + 2} y="66" width={d.w - 4} height="5" rx="1" />}
        </g>
      ))}
    </svg>
  );
}

export function Onboarding({ onScene, onClose, onFinish }: { onScene: (scene: TourScene) => void; onClose: () => void; onFinish?: (choice: TourFinish) => void }) {
  const [resume] = useState(() => savedStep(TOTAL));
  const [phase, setPhase] = useState<Phase>('welcome');
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const [place, setPlace] = useState<CardPlace>({ mode: 'center' });
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);
  const current = ONBOARDING_STEPS[step];
  const scene: TourScene = phase === 'step' ? current.scene : TOUR_SCENE.HOME;
  const targets = phase === 'step' ? targetsFor(current, window.innerWidth < NARROW) : null;

  const close = useCallback((keepStep: boolean) => {
    markOnboardingDone();
    saveStep(keepStep ? step : null);
    onClose();
  }, [onClose, step]);

  const finish = (choice: TourFinish) => {
    markOnboardingDone();
    saveStep(null);
    onClose();
    onFinish?.(choice);
  };

  const go = (i: number) => {
    setPhase('step');
    setStep(clampStep(i));
  };
  const next = () => {
    if (phase === 'welcome') go(resume ?? 0);
    else if (phase === 'finish') finish('stay');
    else if (step === TOTAL - 1) setPhase('finish');
    else setStep(step + 1);
  };
  const back = () => {
    if (phase === 'finish') go(TOTAL - 1);
    else if (phase === 'step' && step > 0) setStep(step - 1);
    else if (phase === 'step') setPhase('welcome');
  };

  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    html.style.overflow = 'hidden';
    const keepFocus = (e: FocusEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) primary.current?.focus({ preventScroll: true });
    };
    document.addEventListener('focusin', keepFocus);
    return () => {
      html.style.overflow = before;
      document.removeEventListener('focusin', keepFocus);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    onScene(scene);
  }, [scene, onScene]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [phase, step]);

  useLayoutEffect(() => {
    if (!targets) return;
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const el = visibleTarget(targets);
        if (el && !scrolled) {
          scrolled = true;
          const v = view();
          const bar = el.closest('.sheet, .appbar') ? 0 : document.querySelector('.appbar')?.getBoundingClientRect().bottom ?? 0;
          const size = card.current ? { width: card.current.offsetWidth, height: card.current.offsetHeight } : { width: 0, height: 0 };
          if (needsScroll(toBox(el.getBoundingClientRect()), v, size, bar)) {
            el.style.scrollMarginTop = bar + EDGE + 'px';
            el.scrollIntoView?.({ block: 'start', behavior: 'instant' as ScrollBehavior });
            el.style.scrollMarginTop = '';
          }
        }
        const next = el ? toBox(el.getBoundingClientRect()) : null;
        setTarget(prev => (sameBox(prev, next) ? prev : next));
      });
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    document.addEventListener('animationend', measure, true);
    document.addEventListener('transitionend', measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
      document.removeEventListener('animationend', measure, true);
      document.removeEventListener('transitionend', measure, true);
    };
  }, [targets]);

  useLayoutEffect(() => {
    const el = card.current;
    const size = el ? { width: el.offsetWidth, height: el.offsetHeight } : { width: 0, height: 0 };
    const p = placeCard(phase === 'step' ? target : null, view(), size);
    setPlace(prev => (prev.mode === p.mode && prev.side === p.side && prev.left === p.left && prev.top === p.top && prev.arrow === p.arrow ? prev : p));
  }, [target, phase, step]);

  const onKey = (e: ReactKeyEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(phase === 'step');
      return;
    }
    if (e.key === 'ArrowRight' && tag !== 'INPUT') {
      e.preventDefault();
      next();
      return;
    }
    if (e.key === 'ArrowLeft' && tag !== 'INPUT') {
      e.preventDefault();
      back();
      return;
    }
    if (e.key !== 'Tab') return;
    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || !e.currentTarget.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const swipe = {
    onTouchStart: (e: ReactTouchEvent) => { touch.current = e.touches[0]?.clientX ?? null; },
    onTouchEnd: (e: ReactTouchEvent) => {
      const x0 = touch.current;
      touch.current = null;
      const x1 = e.changedTouches[0]?.clientX;
      if (x0 === null || x1 === undefined || phase !== 'step') return;
      if (x1 - x0 < -60) next();
      else if (x1 - x0 > 60) back();
    }
  };

  const spot = phase === 'step' ? spotBox(target, view()) : null;
  const cardStyle: CSSProperties | undefined = place.mode === 'float' ? { left: place.left, top: place.top, '--arrow': place.arrow + 'px' } as CSSProperties : undefined;
  const progress = chapterProgress(step);
  const chapter = ONBOARDING_CHAPTERS.find(c => c.id === current.chapter);

  return (
    <div ref={root} className={'tour tour-' + phase} data-place={place.mode} onKeyDown={onKey}>
      {spot ? <div className="tour-spot" style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}

      {phase === 'welcome' && (
        <section ref={card} key="welcome" className="tour-card tour-hero" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
          <button className="tour-x" type="button" aria-label="Закрыть обучение" onClick={() => close(false)}><IconClose /></button>
          <Board />
          <h2 id="tour-title">{resume ? 'С возвращением в обучение' : 'Добро пожаловать в Ampli'}</h2>
          <p id="tour-text">Ampli считает электропроводку квартиры по нормам РБ: кабели, автоматы, УЗО, щиток и документы для сдачи объекта.</p>
          <ol className="tour-chapters" aria-label="Что покажем">
            {ONBOARDING_CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <button type="button" className="tour-ch" onClick={() => go(chapterStart(c.id))}>
                  <span className="tour-ch-n" aria-hidden="true">{i + 1}</span>
                  <span className="tour-ch-t"><b><span className="vh">Начать с раздела </span>{c.title}</b><small>{c.text}</small></span>
                  <span className="tour-ch-c" aria-hidden="true">{chapterSteps(c.id)} {plural(chapterSteps(c.id), ['шаг', 'шага', 'шагов'])}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="tour-actions">
            <Button variant="ghost" onClick={() => close(false)}>Пропустить</Button>
            {resume && <Button onClick={() => go(0)}>Сначала</Button>}
            <Button ref={primary} variant="primary" onClick={next}>{resume ? 'Продолжить с шага ' + (resume + 1) : 'Начать · ' + minutesFor(TOTAL) + ' мин'}</Button>
          </div>
          <p className="tour-keys" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> листать · <kbd>Esc</kbd> закрыть</p>
        </section>
      )}

      {phase === 'step' && (
        <section ref={card} className={'tour-card tour-step' + (place.side ? ' side-' + place.side : '')} style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" {...swipe}>
          <div className="tour-top">
            <span className="tour-ico" aria-hidden="true">{ICON[current.icon]()}</span>
            <span className="tour-chap">{chapter?.title}</span>
            <span className="tour-num" aria-hidden="true">{step + 1} из {TOTAL}</span>
            <button className="tour-x" type="button" aria-label="Закрыть обучение" onClick={() => close(true)}><IconClose /></button>
          </div>
          <div key={step} className="tour-body">
            <h2 id="tour-title">{current.title}</h2>
            <p id="tour-text">{current.text}</p>
            {current.tip && <p className="tour-tip"><IconBulb /><span>{current.tip}</span></p>}
          </div>
          <div className="tour-prog" role="progressbar" aria-label="Прогресс обучения" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step + 1} aria-valuetext={'Шаг ' + (step + 1) + ' из ' + TOTAL}>
            {progress.map(c => (
              <span key={c.id} className={'tour-seg' + (c.current ? ' on' : '')} style={{ flexGrow: c.total }}>
                <i style={{ width: (c.done / c.total * 100) + '%' }} />
              </span>
            ))}
          </div>
          <div className="tour-actions">
            <button className="link tour-skip" type="button" onClick={() => close(true)}>Пропустить</button>
            <Button onClick={back} aria-label={step === 0 ? 'Назад к приветствию' : 'Назад'}>Назад</Button>
            <Button ref={primary} variant="primary" onClick={next}>{step === TOTAL - 1 ? 'Завершить' : 'Далее'}</Button>
          </div>
          <span className="vh" aria-live="polite">{'Шаг ' + (step + 1) + ' из ' + TOTAL + ': ' + current.title}</span>
        </section>
      )}

      {phase === 'finish' && (
        <section ref={card} key="finish" className="tour-card tour-hero tour-done" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
          <button className="tour-x" type="button" aria-label="Закрыть обучение" onClick={() => finish('stay')}><IconClose /></button>
          <span className="tour-badge" aria-hidden="true"><IconDone /></span>
          <h2 id="tour-title">Готово, основное вы знаете</h2>
          <p id="tour-text">Создайте свой объект: отметьте комнаты, и Ampli соберёт группы. Или ещё посмотрите пример двухкомнатной квартиры.</p>
          <ul className="tour-hints">
            <li><kbd>?</kbd><span>в шапке снова откроет обучение</span></li>
            <li><kbd>Ctrl</kbd><kbd>K</kbd><span>быстрый поиск любой команды</span></li>
          </ul>
          <div className="tour-actions">
            <Button variant="ghost" onClick={() => finish('stay')}>Остаться в примере</Button>
            <Button ref={primary} variant="primary" onClick={() => finish('create')}>Создать свой проект</Button>
          </div>
        </section>
      )}
    </div>
  );
}
