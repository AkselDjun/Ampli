import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { Onboarding } from '../../ui/Onboarding';
import { ONBOARDING_FRESH_KEY, ONBOARDING_KEY, ONBOARDING_REVISION, ONBOARDING_STEP_KEY } from '../../features/onboarding/storage';
import { TOUR_SCENE } from '../../features/onboarding/model';
import { ONBOARDING_STEPS } from '../../features/onboarding/steps';
import type { TourScene } from '../../features/onboarding/model';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { shareUrl } from '../../core/share';
import { toastText } from './util';
import { currentToast } from '../../ui/toast';

const TOTAL = ONBOARDING_STEPS.length;
const VIEW: Partial<Record<TourScene, string>> = { [TOUR_SCENE.ESTIMATE]: 'report' };
const WELCOME = 'Добро пожаловать в Ampli';
const tour = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.tour [role="dialog"]');
  if (!el) throw new Error('tour is closed');
  return el;
};
const title = () => tour().querySelector('h2')?.textContent;
const firstRun = () => localStorage.removeItem(ONBOARDING_KEY);

const start = async (user: ReturnType<typeof userEvent.setup>) => {
  const hello = await screen.findByRole('dialog', { name: WELCOME });
  await user.click(within(hello).getByRole('button', { name: /^Начать ·/ }));
  expect(title()).toBe(ONBOARDING_STEPS[0].title);
};

describe('first-run onboarding in the app', () => {
  it('greets a new user with the plan of the tour', async () => {
    firstRun();
    render(<App />);
    const hello = await screen.findByRole('dialog', { name: WELCOME });
    expect(hello).toHaveAttribute('aria-modal', 'true');
    expect(hello).toHaveAccessibleDescription(/по нормам РБ/);
    const plan = within(hello).getByRole('list', { name: 'Что покажем' });
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3);
    expect(plan).toHaveTextContent('Расчёт');
    expect(plan).toHaveTextContent('Монтаж');
    expect(plan).toHaveTextContent('Документы');
    expect(within(hello).getByRole('button', { name: /^Начать · \d мин$/ })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('walks through every real screen and ends with a choice', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await start(user);
    expect(screen.getByRole('progressbar', { name: 'Прогресс обучения' })).toHaveAttribute('aria-valuenow', '1');

    for (let i = 0; i < TOTAL; i++) {
      const s = ONBOARDING_STEPS[i];
      expect(title()).toBe(s.title);
      expect(tour()).toHaveTextContent((i + 1) + ' из ' + TOTAL);
      expect(screen.getByRole('progressbar', { name: 'Прогресс обучения' })).toHaveAttribute('aria-valuenow', String(i + 1));
      expect(tour().querySelector('[aria-live="polite"]')).toHaveTextContent('Шаг ' + (i + 1) + ' из ' + TOTAL + ': ' + s.title);
      if (s.scene === TOUR_SCENE.EDITOR || s.scene === TOUR_SCENE.WIRING) expect(screen.getByLabelText('Редактор группы')).toBeInTheDocument();
      else if (s.scene !== TOUR_SCENE.HOME) await waitFor(() => expect(document.querySelector(`[data-tour-view="${VIEW[s.scene] ?? s.scene}"]`)).toBeVisible());
      if (s.scene === TOUR_SCENE.ESTIMATE) await waitFor(() => expect(screen.getByRole('tab', { name: 'Смета' })).toHaveAttribute('aria-selected', 'true'));
      if (s.scene === TOUR_SCENE.REPORT) await waitFor(() => expect(screen.getByRole('tab', { name: 'Группы' })).toHaveAttribute('aria-selected', 'true'));
      if (s.tip) expect(tour()).toHaveTextContent(s.tip);
      expect(within(tour()).getByRole('button', { name: i === TOTAL - 1 ? 'Завершить' : 'Далее' })).toHaveFocus();
      await user.click(within(tour()).getByRole('button', { name: i === TOTAL - 1 ? 'Завершить' : 'Далее' }));
    }

    const done = screen.getByRole('dialog', { name: 'Готово, основное вы знаете' });
    expect(within(done).getByRole('button', { name: 'Создать свой проект' })).toHaveFocus();
    expect(document.querySelector('.sheet:not([hidden])')).toBeNull();
    await user.click(within(done).getByRole('button', { name: 'Остаться в примере' }));
    expect(screen.queryByRole('dialog', { name: 'Готово, основное вы знаете' })).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.querySelector('.pb-name')).toHaveTextContent('Пример: двухкомнатная квартира');
  });

  it('creates the first own project and opens the room quick start', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await start(user);
    for (let i = 0; i < TOTAL; i++) fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    await user.click(screen.getByRole('button', { name: 'Создать свой проект' }));
    expect(screen.queryByRole('dialog', { name: 'Готово, основное вы знаете' })).toBeNull();
    await waitFor(() => expect(document.querySelector('[data-tour-view="rooms"]')).toBeVisible());
    expect(toastText()).toBe('Создан проект: Мой объект');
    expect(document.querySelector('.pb-name')).toHaveTextContent('Мой объект');
  });

  it('jumps straight into a chapter from the welcome screen', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    const hello = await screen.findByRole('dialog', { name: WELCOME });
    await user.click(within(hello).getByRole('button', { name: /^Начать с раздела Монтаж/ }));
    expect(title()).toBe(ONBOARDING_STEPS.find(s => s.chapter === 'build')?.title);
    await waitFor(() => expect(document.querySelector('[data-tour-view="panel"]')).toBeVisible());
    await user.click(within(tour()).getByRole('button', { name: 'Назад' }));
    expect(title()).toBe(ONBOARDING_STEPS.find(s => s.id === 'rooms')?.title);
  });

  it('goes back from the first step to the welcome screen', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await start(user);
    await user.click(within(tour()).getByRole('button', { name: 'Назад к приветствию' }));
    expect(screen.getByRole('dialog', { name: WELCOME })).toBeInTheDocument();
  });

  it('works from the keyboard and remembers where the user stopped', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog', { name: WELCOME });
    await user.keyboard('{ArrowRight}');
    expect(title()).toBe(ONBOARDING_STEPS[0].title);
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(title()).toBe(ONBOARDING_STEPS[3].title);
    await waitFor(() => expect(document.querySelector('[data-tour-view="network"]')).toBeVisible());
    await user.keyboard('{ArrowLeft}');
    expect(title()).toBe(ONBOARDING_STEPS[2].title);
    await user.keyboard('{Escape}');
    expect(document.querySelector('.tour')).toBeNull();
    expect(document.querySelector('.sheet:not([hidden])')).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBe('2');

    const help = screen.getByRole('button', { name: 'Открыть обучение' });
    await user.click(help);
    await screen.findByRole('dialog', { name: 'С возвращением в обучение' });
    const back = screen.getByRole('dialog', { name: 'С возвращением в обучение' });
    expect(within(back).getByRole('button', { name: 'Продолжить с шага 3' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(title()).toBe(ONBOARDING_STEPS[2].title);
    await user.click(within(tour()).getByRole('button', { name: 'Закрыть обучение' }));
    expect(help).toHaveFocus();

    await user.click(help);
    await user.click(await screen.findByRole('button', { name: 'Сначала' }));
    expect(title()).toBe(ONBOARDING_STEPS[0].title);
  });

  it('keeps focus inside the tour', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await start(user);
    const buttons = within(tour()).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    expect(last).toHaveFocus();
    await user.tab();
    expect(buttons[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    act(() => screen.getByRole('button', { name: 'Открыть обучение' }).focus());
    expect(last).toHaveFocus();
  });

  it('skips the tour for good from the welcome screen', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog', { name: WELCOME });
    await user.click(screen.getByRole('button', { name: 'Пропустить' }));
    expect(document.querySelector('.tour')).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
  });

  it('does not interrupt a returning user with stored projects', () => {
    firstRun();
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(document.querySelector('.tour')).toBeNull();
  });

  it('does not interrupt someone who opened a shared project link', () => {
    firstRun();
    window.location.hash = new URL(shareUrl(sampleProject(), 'https://ampli.test/')).hash;
    render(<App />);
    expect(document.querySelector('.tour')).toBeNull();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('does not show the tour again after it was finished', () => {
    render(<App />);
    expect(document.querySelector('.tour')).toBeNull();
  });
});

describe('onboarding component', () => {
  const mount = () => {
    const onScene = vi.fn<(s: TourScene) => void>();
    const onClose = vi.fn();
    const onFinish = vi.fn();
    render(<Onboarding onScene={onScene} onClose={onClose} onFinish={onFinish} />);
    return { onScene, onClose, onFinish };
  };

  it('asks the app to show the right scene for each step', () => {
    const { onScene } = mount();
    expect(onScene).toHaveBeenLastCalledWith(TOUR_SCENE.HOME);
    for (const s of ONBOARDING_STEPS) {
      fireEvent.keyDown(tour(), { key: 'ArrowRight' });
      expect(onScene).toHaveBeenLastCalledWith(s.scene);
    }
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    expect(onScene).toHaveBeenLastCalledWith(TOUR_SCENE.HOME);
  });

  it('reports the final choice after closing', () => {
    const { onClose, onFinish } = mount();
    for (let i = 0; i <= TOTAL; i++) fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Создать свой проект' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith('create');
  });

  it('closes with the default choice from the finish screen by keyboard', () => {
    const { onClose, onFinish } = mount();
    for (let i = 0; i <= TOTAL; i++) fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    fireEvent.keyDown(tour(), { key: 'ArrowLeft' });
    expect(title()).toBe(ONBOARDING_STEPS[TOTAL - 1].title);
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith('stay');
  });

  it('pages with horizontal swipes on touch screens', () => {
    mount();
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(tour(), { touches: [{ clientX: from, clientY: 300 }] });
      fireEvent.touchEnd(tour(), { changedTouches: [{ clientX: to, clientY: 300 }] });
    };
    swipe(300, 120);
    expect(title()).toBe(ONBOARDING_STEPS[1].title);
    swipe(300, 280);
    expect(title()).toBe(ONBOARDING_STEPS[1].title);
    swipe(100, 300);
    expect(title()).toBe(ONBOARDING_STEPS[0].title);
  });

  it('ignores arrows typed into a field', () => {
    mount();
    const input = document.createElement('input');
    tour().appendChild(input);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: WELCOME })).toBeInTheDocument();
  });

  it('highlights the target and places the card next to it', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-tour', 'summary');
    document.body.appendChild(host);
    Object.defineProperty(window, 'innerWidth', { value: 1366, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 860, configurable: true });
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return (this === host ? new DOMRect(500, 4, 360, 52) : new DOMRect(0, 0, 0, 0));
    });
    mount();
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    const spot = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.tour-spot');
      if (!el) throw new Error('no spot');
      return el;
    });
    expect(spot.style.left).toBe('492px');
    expect(spot.style.top).toBe('4px');
    expect(spot.style.width).toBe('376px');
    expect(spot).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => expect(document.querySelector('.tour')).toHaveAttribute('data-place', 'float'));
    expect(tour()).toHaveClass('side-bottom');
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    await waitFor(() => expect(document.querySelector('.tour-spot')).toBeNull());
    expect(document.querySelector('.tour')).toHaveAttribute('data-place', 'center');
    rect.mockRestore();
    host.remove();
  });
});

describe('what is new for those who already know Ampli', () => {
  const FRESH = ONBOARDING_STEPS.filter(s => s.fresh);
  const veteran = () => {
    localStorage.setItem(ONBOARDING_KEY, 'done');
    localStorage.removeItem(ONBOARDING_FRESH_KEY);
  };

  it('offers a short tour of the new features once', async () => {
    veteran();
    localStorage.setItem(ONBOARDING_STEP_KEY, '4');
    const user = userEvent.setup();
    render(<App />);
    expect(document.querySelector('.tour')).toBeNull();
    await waitFor(() => expect(toastText()).toContain('В Ampli новое'), { timeout: 3000 });
    expect(toastText()).toMatch(/частный дом.*мощность.*карта проводки.*трёх вариантах/);
    expect(localStorage.getItem(ONBOARDING_FRESH_KEY)).toBe(ONBOARDING_REVISION);
    expect(currentToast()?.label).toBe('Показать');
    act(() => currentToast()?.run?.());

    for (let i = 0; i < FRESH.length; i++) {
      const s = FRESH[i];
      expect(title()).toBe(s.title);
      expect(tour()).toHaveTextContent((i + 1) + ' из ' + FRESH.length);
      expect(tour().querySelector('.tour-chap')).toHaveTextContent(/^Новое · /);
      expect(within(tour()).queryByRole('button', { name: 'Назад к приветствию' })).toBeNull();
      expect(tour().querySelectorAll('.tour-seg')).toHaveLength(3);
      await user.click(within(tour()).getByRole('button', { name: i === FRESH.length - 1 ? 'Завершить' : 'Далее' }));
    }

    const done = screen.getByRole('dialog', { name: 'Теперь вы знаете всё новое' });
    expect(within(done).queryByRole('button', { name: 'Создать свой проект' })).toBeNull();
    await user.click(within(done).getByRole('button', { name: 'Понятно' }));
    expect(document.querySelector('.tour')).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBe('4');
    expect(document.querySelector('.pb-name')).toHaveTextContent('Пример: двухкомнатная квартира');

    await user.click(screen.getByRole('button', { name: 'Открыть обучение' }));
    const back = await screen.findByRole('dialog', { name: 'С возвращением в обучение' });
    expect(within(back).getByRole('button', { name: 'Продолжить с шага 5' })).toBeInTheDocument();
  });

  it('keeps the place in the full tour when the short one is closed early', async () => {
    veteran();
    localStorage.setItem(ONBOARDING_STEP_KEY, '6');
    render(<App />);
    await waitFor(() => expect(toastText()).toContain('В Ampli новое'), { timeout: 3000 });
    act(() => currentToast()?.run?.());
    fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    expect(title()).toBe(FRESH[1].title);
    fireEvent.keyDown(tour(), { key: 'ArrowLeft' });
    fireEvent.keyDown(tour(), { key: 'ArrowLeft' });
    expect(title()).toBe(FRESH[0].title);
    fireEvent.keyDown(tour(), { key: 'Escape' });
    expect(document.querySelector('.tour')).toBeNull();
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBe('6');
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
  });

  it('stays quiet for new users, after the offer and for shared links', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const quiet = () => {
      const { unmount } = render(<App />);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(toastText() ?? '').not.toContain('В Ampli новое');
      unmount();
    };
    try {
      firstRun();
      localStorage.removeItem(ONBOARDING_FRESH_KEY);
      quiet();
      veteran();
      localStorage.setItem(ONBOARDING_FRESH_KEY, ONBOARDING_REVISION);
      quiet();
      veteran();
      window.location.hash = new URL(shareUrl(sampleProject(), 'https://ampli.test/')).hash;
      quiet();
      expect(localStorage.getItem(ONBOARDING_FRESH_KEY)).toBeNull();
    } finally {
      window.history.replaceState(null, '', window.location.pathname);
      vi.useRealTimers();
    }
  });

  it('points the new steps at the real controls of the app', async () => {
    firstRun();
    const user = userEvent.setup();
    render(<App />);
    await start(user);
    for (const s of ONBOARDING_STEPS) {
      while (title() !== s.title) fireEvent.keyDown(tour(), { key: 'ArrowRight' });
      if (s.fresh) {
        const real = s.targets.slice(0, -1);
        await waitFor(() => expect(real.some(t => document.querySelector(t)), s.id).toBe(true));
      }
    }
    await waitFor(() => expect(document.querySelector('[data-tour="object"]')).toHaveTextContent('Частный дом'));
    expect(document.querySelector('[data-tour="alloc"]')).toHaveTextContent('Выделенная мощность');
  });
});

describe('welcome and finish texts', () => {
  it('names the private house and explains the info buttons', () => {
    render(<Onboarding onScene={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: WELCOME })).toHaveAccessibleDescription(/квартиры или частного дома/);
    for (let i = 0; i <= TOTAL; i++) fireEvent.keyDown(tour(), { key: 'ArrowRight' });
    const done = screen.getByRole('dialog', { name: 'Готово, основное вы знаете' });
    expect(done).toHaveTextContent('у поля объяснит, откуда значение');
    expect(done.querySelector('.tour-kb')).toHaveTextContent('Ctrl');
  });

  it('opens the short tour straight on the first new step', () => {
    const onScene = vi.fn<(s: TourScene) => void>();
    render(<Onboarding mode="fresh" onScene={onScene} onClose={() => undefined} />);
    expect(title()).toBe(ONBOARDING_STEPS.find(s => s.fresh)?.title);
    expect(onScene).toHaveBeenLastCalledWith(TOUR_SCENE.EDITOR);
    expect(screen.getByRole('progressbar', { name: 'Прогресс обучения' })).toHaveAttribute('aria-valuemax', String(ONBOARDING_STEPS.filter(s => s.fresh).length));
  });
});
