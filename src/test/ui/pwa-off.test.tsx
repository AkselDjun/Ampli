import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PWA_ENABLED } from '../../core/flags';
import { InstallBlock } from '../../ui/sheets';
import { initPwa, retirePwa, resetPwa } from '../../ui/pwa';

const setSw = (v: unknown) => Object.defineProperty(navigator, 'serviceWorker', { value: v, configurable: true });
const setCaches = (v: unknown) => Object.defineProperty(globalThis, 'caches', { value: v, configurable: true, writable: true });

afterEach(() => {
  setSw(undefined);
  setCaches(undefined);
  resetPwa();
});

describe('PWA switched off', () => {
  it('is off by default and hides the install block even when install is possible', () => {
    expect(PWA_ENABLED).toBe(false);
    const stop = initPwa();
    const e = new Event('beforeinstallprompt', { cancelable: true });
    window.dispatchEvent(e);
    const { container } = render(<InstallBlock />);
    expect(container).toBeEmptyDOMElement();
    stop();
  });
  it('unregisters service workers and removes only workbox caches', async () => {
    const unregister = vi.fn(() => Promise.resolve(true));
    const broken = vi.fn(() => Promise.reject(new Error('x')));
    setSw({ getRegistrations: () => Promise.resolve([{ unregister }, { unregister: broken }]) });
    const del = vi.fn(() => Promise.resolve(true));
    setCaches({ keys: () => Promise.resolve(['workbox-precache-v2-x', 'other']), delete: del });
    await retirePwa();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('workbox-precache-v2-x');
  });
  it('copes with failing or missing service worker and cache APIs', async () => {
    setSw({ getRegistrations: () => Promise.reject(new Error('x')) });
    setCaches({ keys: () => Promise.reject(new Error('x')), delete: vi.fn() });
    await expect(retirePwa()).resolves.toBeUndefined();
    setSw({});
    setCaches(undefined);
    await expect(retirePwa()).resolves.toBeUndefined();
  });
});
