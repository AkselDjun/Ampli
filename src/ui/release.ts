import { APP_VERSION } from '../core/version';

export const SEEN_KEY = 'ampli-version';
export const CHANGELOG_URL = 'https://github.com/AkselDjun/Ampli/blob/main/CHANGELOG.md';

export function updatedFrom(): string | null {
  try {
    const prev = localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, APP_VERSION);
    return prev && prev !== APP_VERSION ? prev : null;
  } catch (e) {
    void e;
    return null;
  }
}
