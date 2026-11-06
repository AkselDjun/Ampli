import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyEvent } from 'react';
import { Button } from './kit';

export const ONBOARDING_KEY = 'ampli-onboarding-v1';

export function onboardingPending(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) !== 'done'; } catch { return true; }
}

export function markOnboardingDone(): void {
  try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch { /* The tour still closes. */ }
}

interface Step { title: string; text: string; targets?: string[] }

const BASICS: Step[] = [
  { title: 'Познакомимся с Ampli', text: 'За пару минут покажем путь от групп электропроводки до готовой схемы, сметы и приёмки.' },
  { title: 'Проект и параметры сети', text: 'Здесь находятся ваши проекты. Ниже задаются фазы, выделенная мощность, способ прокладки и защита — от них зависит весь расчёт.', targets: ['[data-tour="projects"]'] },
  { title: 'Группы линий', text: 'Каждая строка — отдельная линия щитка. Откройте группу, чтобы изменить приборы, длину кабеля, помещение и увидеть подробный расчёт.', targets: ['[data-tour="group"]'] },
  { title: 'Добавление групп', text: 'Добавляйте свет, розетки и мощные приборы вручную или соберите группы сразу из списка комнат.', targets: ['[data-tour="add"]'] },
  { title: 'Итоги и проверки', text: 'Верхняя панель показывает общую мощность, ввод и замечания. Нажмите на показатель или проверку, чтобы увидеть причину и способ исправления.', targets: ['[data-tour="summary"]'] },
  { title: 'Щиток, приёмка и отчёт', text: 'В навигации открываются раскладка щитка, замеры, чек-лист, схема, спецификация и смета. Этого достаточно, чтобы начать работу.', targets: ['[data-tour="reports"]'] }
];

const ADVANCED: Step[] = [
  { title: 'Сеть и специальные системы', text: 'Настройте ввод, защиту и способ прокладки. Рядом находятся расчёты старой проводки, тёплого пола и слаботочных сетей: интернета, ТВ и камер.', targets: ['[data-tour="network"]'] },
  { title: 'Подробности каждой линии', text: 'В карточке группы задаются приборы, кабель, длина, помещение и условия монтажа. Ampli пересчитает ток, сечение, автомат и падение напряжения.', targets: ['[data-tour="group"]'] },
  { title: 'Комнаты и быстрый старт', text: 'Создайте типовой набор линий по комнатам или добавляйте свет, розетки и отдельные приборы вручную. Список можно группировать по помещениям.', targets: ['[data-tour="add"]'] },
  { title: 'Сборка щитка', text: 'Проверьте раскладку по рядам и модулям, перетаскивайте аппараты и подготовьте понятную маркировку для сборки.', targets: ['.tabs [data-tour="panel"]', '.appbar [data-tour="panel"]'] },
  { title: 'Монтаж и приёмка', text: 'Ведите чек-лист работ, заносите измерения и формируйте документы приёмки. Здесь же собраны данные, которые нужны перед сдачей объекта.', targets: ['.tabs [data-tour="work"]', '.appbar [data-tour="work"]'] },
  { title: 'Схема, материалы и смета', text: 'Отчёт объединяет расчёт групп, однолинейную схему, спецификацию и смету. Цены можно уточнить, а документы — распечатать или сохранить в PDF.', targets: ['.tabs [data-tour="report"]', '.appbar [data-tour="report"]'] },
  { title: 'Проекты и обмен данными', text: 'Создавайте варианты, делайте резервные копии, переносите проекты файлами и делитесь расчётом по ссылке. Собственные марки и шаблоны сохраняются в «Моих данных».', targets: ['[data-tour="projects"]'] }
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

export type OnboardingStart = 'basics' | 'menu';

export function Onboarding({ start, onClose }: { start: OnboardingStart; onClose: () => void }) {
  const [track, setTrack] = useState<'menu' | 'basics' | 'advanced'>(start);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const steps = track === 'advanced' ? ADVANCED : BASICS;
  const current = steps[step];

  const close = () => { markOnboardingDone(); onClose(); };
  const choose = (next: 'basics' | 'advanced') => { setTrack(next); setStep(0); };

  useEffect(() => {
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    primary.current?.focus();
    return () => { document.documentElement.style.overflow = before; };
  }, []);

  useLayoutEffect(() => {
    if (track === 'menu') return;
    const place = () => setRect(visibleTarget(current.targets)?.getBoundingClientRect() ?? null);
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [current, track]);

  const spot = rect ? {
    left: Math.max(6, rect.left - 6), top: Math.max(6, rect.top - 6),
    width: Math.min(window.innerWidth - 12, rect.width + 12), height: Math.min(window.innerHeight - 12, rect.height + 12)
  } : undefined;
  const cardStyle: CSSProperties | undefined = rect
    ? (rect.top + rect.height / 2 > window.innerHeight / 2 ? { top: 16 } : { bottom: 16 }) : undefined;
  const next = () => { if (step === steps.length - 1) close(); else setStep(step + 1); };
  const trap = (e: ReactKeyEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') close();
    if (track !== 'menu' && e.key === 'ArrowRight') next();
    if (track !== 'menu' && e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    if (e.key !== 'Tab') return;
    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };

  if (track === 'menu') {
    return (
      <div className="tour intro" onKeyDown={trap}>
        <div className="tour-shade" aria-hidden="true" />
        <section className="tour-card tour-home" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
          <div className="tour-count">Справка по интерфейсу</div>
          <h2 id="tour-title">Обучение Ampli</h2>
          <p id="tour-text">Выберите маршрут. Прогресс проекта не изменится, а обучение можно закрыть в любой момент.</p>
          <div className="tour-menu">
            <button ref={primary} type="button" className="tour-choice" onClick={() => choose('basics')}><b>Быстрый старт</b><span>6 шагов · основной сценарий работы</span></button>
            <button type="button" className="tour-choice" onClick={() => choose('advanced')}><b>Все возможности</b><span>7 шагов · расширенные инструменты</span></button>
          </div>
          <div className="tour-actions"><span /><Button onClick={close}>Закрыть</Button></div>
        </section>
      </div>
    );
  }

  return (
    <div className={'tour' + (rect ? ' targeted' : ' intro')} onKeyDown={trap}>
      {spot ? <div className="tour-spot" style={spot} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
      <section className="tour-card" style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
        <div className="tour-count">{track === 'advanced' ? 'Все возможности' : 'Быстрый старт'} · шаг {step + 1} из {steps.length}</div>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-text">{current.text}</p>
        <div className="tour-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          <button className="link" type="button" onClick={close}>{step === steps.length - 1 ? 'Закрыть' : 'Пропустить'}</button>
          <span />
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Назад</Button>}
          {track === 'basics' && step === steps.length - 1 && <Button onClick={() => choose('advanced')}>Все возможности</Button>}
          <Button ref={primary} variant="primary" onClick={next}>{step === steps.length - 1 ? 'Готово' : 'Далее'}</Button>
        </div>
      </section>
    </div>
  );
}
