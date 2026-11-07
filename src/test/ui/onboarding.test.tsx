import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { ONBOARDING_KEY } from '../../ui/Onboarding';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';

describe('first-run onboarding', () => {
  it('opens every advanced area, remembers completion and can be opened again', async () => {
    localStorage.removeItem(ONBOARDING_KEY);
    const user = userEvent.setup();
    render(<App />);
    const dialog = await screen.findByRole('dialog', { name: 'Познакомимся с Ampli' });
    expect(dialog).toHaveTextContent('шаг 1 из 8');

    await user.click(within(dialog).getByRole('button', { name: 'Далее' }));
    await waitFor(() => expect(document.querySelector('[data-tour-view="network"]')).toBeVisible());
    const tour = screen.getByRole('dialog', { name: 'Сеть и специальные системы' });

    await user.click(within(tour).getByRole('button', { name: 'Далее' }));
    expect(screen.queryByRole('dialog', { name: 'Параметры сети' })).toBeNull();
    expect(screen.getByLabelText('Редактор группы')).toBeInTheDocument();
    expect(tour).toHaveAccessibleName('Подробности каждой линии');

    const scenes = [
      ['Комнаты и быстрый старт', 'rooms'],
      ['Сборка щитка и замеры', 'panel'],
      ['Монтаж и приёмка', 'work'],
      ['Схема, материалы и смета', 'report'],
      ['Проекты и обмен данными', 'projects']
    ] as const;
    for (const [title, target] of scenes) {
      await user.click(within(tour).getByRole('button', { name: 'Далее' }));
      await waitFor(() => expect(document.querySelector(`[data-tour-view="${target}"]`)).toBeVisible());
      expect(tour).toHaveAccessibleName(title);
    }
    await user.click(within(screen.getByRole('dialog', { name: 'Проекты и обмен данными' })).getByRole('button', { name: 'Готово' }));
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Открыть обучение' }));
    expect(screen.getByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: 'Познакомимся с Ampli' })).getByRole('button', { name: 'Пропустить' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not interrupt a returning user with stored projects', () => {
    localStorage.removeItem(ONBOARDING_KEY);
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeNull();
  });
});
