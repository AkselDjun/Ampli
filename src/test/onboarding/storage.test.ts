import { afterEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_KEY, ONBOARDING_STEP_KEY, markOnboardingDone, onboardingPending, saveStep, savedStep } from '../../features/onboarding/storage';

describe('onboarding storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is pending until finished once', () => {
    localStorage.removeItem(ONBOARDING_KEY);
    expect(onboardingPending()).toBe(true);
    markOnboardingDone();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(onboardingPending()).toBe(false);
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem(ONBOARDING_KEY, 'yes');
    expect(onboardingPending()).toBe(true);
  });

  it('remembers where the user stopped', () => {
    saveStep(4);
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBe('4');
    expect(savedStep(9)).toBe(4);
    saveStep(null);
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
    expect(savedStep(9)).toBeNull();
  });

  it('does not resume from the first step or from broken values', () => {
    saveStep(0);
    expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
    for (const bad of ['abc', '-1', '2.5', '9', '99', '', ' 3']) {
      localStorage.setItem(ONBOARDING_STEP_KEY, bad);
      expect(savedStep(9), bad).toBeNull();
    }
    localStorage.setItem(ONBOARDING_STEP_KEY, '8');
    expect(savedStep(9)).toBe(8);
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); }
    };
    Object.defineProperty(window, 'localStorage', { value: blocked, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: blocked, configurable: true, writable: true });
    expect(onboardingPending()).toBe(true);
    expect(() => markOnboardingDone()).not.toThrow();
    expect(() => saveStep(3)).not.toThrow();
    expect(() => saveStep(null)).not.toThrow();
    expect(savedStep(9)).toBeNull();
  });
});
