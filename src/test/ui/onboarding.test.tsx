import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { ONBOARDING_KEY } from '../../ui/Onboarding';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';

describe('first-run onboarding', () => {
  it('walks through the main areas, remembers completion and can be opened again', async () => {
    localStorage.removeItem(ONBOARDING_KEY);
    const user = userEvent.setup();
    render(<App />);
    const dialog = await screen.findByRole('dialog', { name: 'Познакомимся с Ampli' });
    expect(dialog).toHaveTextContent('Шаг 1 из 6');

    const titles = [
      'Проект и параметры сети',
      'Группы линий',
      'Добавление групп',
      'Итоги и проверки',
      'Щиток, приёмка и отчёт'
    ];
    for (const title of titles) {
      await user.click(screen.getByRole('button', { name: 'Далее' }));
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Начать работу' }));
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(screen.queryByRole('dialog', { name: /Ampli|Проект|Группы|Добавление|Итоги|Щиток/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Открыть обучение' }));
    expect(screen.getByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Пропустить' }));
    expect(screen.queryByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeNull();
  });

  it('does not interrupt a returning user with stored projects', () => {
    localStorage.removeItem(ONBOARDING_KEY);
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeNull();
  });
});
