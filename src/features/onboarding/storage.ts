export const ONBOARDING_KEY = 'ampli-onboarding-v1';
export const ONBOARDING_STEP_KEY = 'ampli-onboarding-step';
export const ONBOARDING_FRESH_KEY = 'ampli-onboarding-fresh';
export const ONBOARDING_REVISION = '2';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return;
  }
};

export function onboardingPending(): boolean {
  return read(ONBOARDING_KEY) !== 'done';
}

export function markOnboardingDone(): void {
  write(ONBOARDING_KEY, 'done');
  markFreshSeen();
}

export function freshPending(): boolean {
  return read(ONBOARDING_KEY) === 'done' && read(ONBOARDING_FRESH_KEY) !== ONBOARDING_REVISION;
}

export function markFreshSeen(): void {
  write(ONBOARDING_FRESH_KEY, ONBOARDING_REVISION);
}

export function savedStep(total: number): number | null {
  const raw = read(ONBOARDING_STEP_KEY);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n < total ? n : null;
}

export function saveStep(step: number | null): void {
  write(ONBOARDING_STEP_KEY, step && step > 0 ? String(step) : null);
}

const HINT_KEY = 'ampli-chapter-hint-';

export function chapterHintPending(chapter: string): boolean {
  return read(HINT_KEY + chapter) === null;
}

export function markChapterHint(chapter: string): void {
  write(HINT_KEY + chapter, 'shown');
}

const SAMPLE_HINT_KEY = 'ampli-sample-hint';

export function sampleHintPending(): boolean {
  return read(SAMPLE_HINT_KEY) === null;
}

export function markSampleHint(): void {
  write(SAMPLE_HINT_KEY, 'shown');
}
