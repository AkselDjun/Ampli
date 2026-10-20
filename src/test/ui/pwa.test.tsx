import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HINT_KEY, VISITS_KEY, initPwa, install, isIos, isStandalone, resetPwa } from '../../ui/pwa';
import { InstallBlock } from '../../ui/sheets';
import { currentToast, dismissToast } from '../../ui/toast';

const nav = (o: Partial<Navigator>) => ({ userAgent: '', platform: '', maxTouchPoints: 0, ...o }) as Navigator;
const media = (standalone: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: standalone && q.includes('standalone'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
};
const promptEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  e.prompt = vi.fn(() => Promise.resolve());
  e.userChoice = Promise.resolve({ outcome });
  return e;
};
let stop: (() => void) | null = null;
const start = (...a: Parameters<typeof initPwa>) => {
  stop = initPwa(...a);
};
const ua = (v: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(v);

afterEach(() => {
  stop?.();
  stop = null;
  resetPwa();
  delete (navigator as { standalone?: boolean }).standalone;
});

describe('platform detection', () => {
  it('recognises iOS devices including iPadOS', () => {
    expect(isIos(nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }))).toBe(true);
    expect(isIos(nav({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
    expect(isIos(nav({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
    expect(isIos(nav({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }))).toBe(false);
  });
  it('detects standalone mode from display-mode or the iOS flag', () => {
    media(false);
    expect(isStandalone()).toBe(false);
    media(true);
    expect(isStandalone()).toBe(true);
    media(false);
    (navigator as { standalone?: boolean }).standalone = true;
    expect(isStandalone()).toBe(true);
  });
});

describe('initPwa', () => {
  it('counts visits and offers install once on the second visit', async () => {
    start();
    expect(localStorage.getItem(VISITS_KEY)).toBe('1');
    const first = promptEvent();
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(currentToast()).toBeNull();
    stop?.();
    start();
    const e = promptEvent();
    window.dispatchEvent(e);
    expect(currentToast()?.label).toBe('Установить');
    expect(localStorage.getItem(HINT_KEY)).toBe('1');
    await act(async () => { currentToast()?.run?.(); await Promise.resolve(); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
    window.dispatchEvent(promptEvent());
    expect(currentToast()?.label).toBe('Установить');
  });
  it('install resolves with the user choice and does nothing without a prompt', async () => {
    expect(await install()).toBe(false);
    start();
    window.dispatchEvent(promptEvent('dismissed'));
    expect(await install()).toBe(false);
    window.dispatchEvent(promptEvent('accepted'));
    expect(await install()).toBe(true);
  });
  it('reacts to installation, connectivity and keeps storage when standalone', () => {
    const persist = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    media(true);
    start();
    expect(persist).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('appinstalled'));
    expect(currentToast()?.text).toBe('Ampli установлен');
    expect(persist).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('offline'));
    expect(currentToast()?.text).toContain('Нет интернета');
    window.dispatchEvent(new Event('online'));
    expect(currentToast()?.text).toBe('Интернет снова есть');
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    window.dispatchEvent(new Event('appinstalled'));
    expect(currentToast()?.text).toBe('Ampli установлен');
  });
  it('shows the iOS hint once from the second visit when not installed', () => {
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
    start();
    expect(currentToast()).toBeNull();
    stop?.();
    start();
    expect(currentToast()?.text).toContain('«Поделиться»');
    currentToast()?.run?.();
    expect(localStorage.getItem(HINT_KEY)).toBe('1');
    dismissToast();
    stop?.();
    start();
    expect(currentToast()).toBeNull();
  });
  it('wires service worker updates and offline readiness to toasts', async () => {
    const update = vi.fn(() => Promise.resolve());
    let hooks: { onNeedRefresh: () => void; onOfflineReady: () => void } | null = null;
    start(o => {
      hooks = o;
      return update;
    });
    hooks!.onOfflineReady();
    expect(currentToast()?.text).toBe('Ampli готов к работе без интернета');
    hooks!.onNeedRefresh();
    expect(currentToast()?.label).toBe('Обновить');
    currentToast()?.run?.();
    expect(update).toHaveBeenCalledWith(true);
  });
  it('survives a browser that blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => start()).not.toThrow();
    window.dispatchEvent(promptEvent());
    expect(currentToast()).toBeNull();
  });
});

describe('InstallBlock', () => {
  it('renders nothing when install is not possible', () => {
    start();
    const { container } = render(<InstallBlock />);
    expect(container).toBeEmptyDOMElement();
  });
  it('offers the install button when the browser allows it', async () => {
    start();
    render(<InstallBlock />);
    const e = promptEvent();
    act(() => { window.dispatchEvent(e); });
    expect(screen.getByRole('heading', { name: 'Приложение' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Установить приложение/ })); await Promise.resolve(); });
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Установить приложение/ })).toBeNull();
  });
  it('explains the iOS steps and the installed state', () => {
    ua('Mozilla/5.0 (iPad; CPU OS 17_0)');
    start();
    const { unmount } = render(<InstallBlock />);
    expect(screen.getByText(/экран «Домой»/)).toBeInTheDocument();
    unmount();
    stop?.();
    media(true);
    start();
    render(<InstallBlock />);
    expect(screen.getByText(/установлен на это устройство/)).toBeInTheDocument();
  });
});
