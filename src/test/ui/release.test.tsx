import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { CHANGELOG_URL, SEEN_KEY, updatedFrom } from '../../ui/release';
import { APP_VERSION } from '../../core/version';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

afterEach(() => vi.restoreAllMocks());

describe('release notice', () => {
  it('says nothing on the first visit and reports an update once', () => {
    localStorage.removeItem(SEEN_KEY);
    expect(updatedFrom()).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBe(APP_VERSION);
    expect(updatedFrom()).toBeNull();
    localStorage.setItem(SEEN_KEY, '1.9.0');
    expect(updatedFrom()).toBe('1.9.0');
    expect(updatedFrom()).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(updatedFrom()).toBeNull();
  });

  it('shows the update toast and the version with release notes in my data', () => {
    localStorage.setItem(SEEN_KEY, '1.9.0');
    render(<App />);
    expect(toastText()).toContain('обновлён до версии ' + APP_VERSION);
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    click(dlg('Проекты'), 'Открыть мои данные');
    fireEvent.click(screen.getByRole('tab', { name: 'Оформление' }));
    expect(dlg('Мои данные').textContent).toContain('Ampli ' + APP_VERSION);
    expect(screen.getByRole('link', { name: 'Что нового' })).toHaveAttribute('href', CHANGELOG_URL);
  });
});
