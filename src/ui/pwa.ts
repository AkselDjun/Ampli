import { useSyncExternalStore } from 'react';
import { toast, toastOk } from './toast';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  can: boolean;
  ios: boolean;
  standalone: boolean;
}

export const VISITS_KEY = 'ampli-visits';
export const HINT_KEY = 'ampli-install-hint';
export const IOS_STEPS = 'В Safari нажмите «Поделиться», затем «На экран „Домой“».';

let deferred: InstallEvent | null = null;
let state: PwaState = { can: false, ios: false, standalone: false };
const subs = new Set<() => void>();

const set = (next: Partial<PwaState>) => {
  state = { ...state, ...next };
  subs.forEach(f => f());
};

export const isIos = (nav: Navigator = navigator): boolean =>
  /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

export const isStandalone = (): boolean =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const write = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    return;
  }
};

export const hintDone = (): void => write(HINT_KEY, '1');

const hintDue = (): boolean => read(HINT_KEY) !== '1' && Number(read(VISITS_KEY) ?? 0) >= 2;

export async function install(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  set({ can: false });
  await ev.prompt();
  const r = await ev.userChoice;
  hintDone();
  return r.outcome === 'accepted';
}

const persist = (): void => {
  const st = navigator.storage;
  if (st && typeof st.persist === 'function') st.persist().catch(() => undefined);
};

export function initPwa(register?: (o: { onNeedRefresh: () => void; onOfflineReady: () => void }) => (reload?: boolean) => Promise<void>): () => void {
  write(VISITS_KEY, String(Number(read(VISITS_KEY) ?? 0) + 1));
  const standalone = isStandalone();
  set({ ios: isIos(), standalone });
  if (standalone) persist();
  const onPrompt = (e: Event) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    set({ can: true });
    if (hintDue()) {
      toast('Установите Ampli: откроется с экрана и будет работать без интернета', { label: 'Установить', run: () => { void install(); } });
      hintDone();
    }
  };
  const onInstalled = () => {
    deferred = null;
    set({ can: false });
    hintDone();
    persist();
    toastOk('Ampli установлен');
  };
  const onOffline = () => toast('Нет интернета. Расчёты работают, поиск в магазинах недоступен');
  const onOnline = () => toastOk('Интернет снова есть');
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);
  if (state.ios && !standalone && hintDue()) {
    toast('Ampli можно добавить на экран «Домой». ' + IOS_STEPS, { label: 'Понятно', run: hintDone });
    hintDone();
  }
  if (register) {
    const update = register({
      onNeedRefresh: () => toast('Вышла новая версия Ampli', { label: 'Обновить', run: () => { void update(true); } }),
      onOfflineReady: () => toastOk('Ampli готов к работе без интернета')
    });
  }
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
  };
}

export const usePwa = (): PwaState =>
  useSyncExternalStore(
    f => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => state
  );

export async function retirePwa(): Promise<void> {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (sw && typeof sw.getRegistrations === 'function') {
    const regs = await sw.getRegistrations().catch(() => [] as readonly ServiceWorkerRegistration[]);
    await Promise.all(regs.map(r => r.unregister().catch(() => false)));
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys().catch(() => [] as string[]);
    await Promise.all(keys.filter(k => k.startsWith('workbox-')).map(k => caches.delete(k)));
  }
}

export function resetPwa(): void {
  deferred = null;
  state = { can: false, ios: false, standalone: false };
  subs.forEach(f => f());
}
