export const ONBOARDING_KEY = 'ampli-onboarding-v1';

export function onboardingPending(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) !== 'done'; } catch { return true; }
}

export function markOnboardingDone(): void {
  try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch { /* The tour still closes. */ }
}
