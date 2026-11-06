import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(dialog).toHaveTextContent('шаг 1 из 6');

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
    await user.click(screen.getByRole('button', { name: 'Все возможности' }));
    expect(screen.getByRole('dialog', { name: 'Сеть и специальные системы' })).toHaveTextContent('шаг 1 из 7');
    const advanced = ['Подробности каждой линии', 'Комнаты и быстрый старт', 'Сборка щитка', 'Монтаж и приёмка', 'Схема, материалы и смета', 'Проекты и обмен данными'];
    for (const title of advanced) {
      await user.click(screen.getByRole('button', { name: 'Далее' }));
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    }
    await user.click(within(screen.getByRole('dialog', { name: 'Проекты и обмен данными' })).getByRole('button', { name: 'Готово' }));
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Открыть обучение' }));
    expect(screen.getByRole('dialog', { name: 'Обучение Ampli' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Быстрый старт/ }));
    expect(screen.getByRole('dialog', { name: 'Познакомимся с Ampli' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Пропустить' }));
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
