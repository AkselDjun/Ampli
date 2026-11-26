import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { isOpen } from './util';

vi.setConfig({ testTimeout: 60000 });

const switcher = () => screen.getByRole('button', { name: /^Проект: .*Сменить проект$/ });
const gear = () => screen.getByRole('button', { name: 'Настройки и обучение' });
const tools = () => within(document.querySelector('.ab-main') as HTMLElement).getByRole('button', { name: 'Инструменты' });

const addProject = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(switcher());
  await user.click(screen.getByRole('menuitem', { name: /^Новый проект/ }));
  await user.click(screen.getByRole('button', { name: /^Пустой проект/ }));
  await user.keyboard('{Escape}');
};

describe('навигация в шапке', () => {
  it('переключатель показывает текущий проект и меняет его', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(switcher()).toHaveTextContent('Пример: двухкомнатная квартира');
    await addProject(user);
    expect(switcher()).toHaveTextContent('Проект 2');
    await user.click(switcher());
    const menu = screen.getByRole('menu', { name: /^Проект:/ });
    const items = within(menu).getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Проект 2');
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveTextContent(/Пример: двухкомнатная квартира14 групп · сегодня/);
    await user.click(items[1]);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(switcher()).toHaveTextContent('Пример: двухкомнатная квартира');
    expect(switcher()).toHaveFocus();
  });

  it('«Новый проект» открывает шаблоны, «Все проекты» список', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(switcher());
    await user.click(screen.getByRole('menuitem', { name: /^Новый проект/ }));
    expect(isOpen('Проекты')).toBe(true);
    expect(document.getElementById('tpl')).not.toHaveAttribute('hidden');
    await user.keyboard('{Escape}');
    await user.click(switcher());
    await user.click(screen.getByRole('menuitem', { name: /^Все проекты/ }));
    expect(isOpen('Проекты')).toBe(true);
    expect(document.getElementById('tpl')).toHaveAttribute('hidden');
    expect(screen.getByRole('tab', { name: 'Проекты' })).toHaveAttribute('aria-selected', 'true');
  });

  it('шестерёнка ведёт в мои данные и обмен', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(gear());
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map(x => x.querySelector('.dd-l')?.textContent)).toEqual(['Мои данные', 'Обмен и резервные копии', 'Обучение', 'Горячие клавиши']);
    await user.click(screen.getByRole('menuitem', { name: /^Обмен и резервные копии/ }));
    expect(isOpen('Проекты')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Обмен и данные' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    await user.click(gear());
    await user.click(screen.getByRole('menuitem', { name: /^Мои данные/ }));
    expect(isOpen('Мои данные')).toBe(true);
  });

  it('«Инструменты» открывают окна по группам', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(tools());
    const menu = screen.getByRole('menu', { name: 'Инструменты' });
    expect(within(menu).getAllByRole('group').map(g => g.getAttribute('aria-label'))).toEqual(['Собрать', 'Сравнить', 'Посчитать', 'Закупка']);
    const cases: [RegExp, string][] = [
      [/^Комнаты/, 'Комнаты'],
      [/^Старая проводка/, 'Старая проводка'],
      [/^Сравнение вариантов/, 'Сравнение вариантов'],
      [/^Тёплый пол/, 'Тёплый пол'],
      [/^Слаботочка/, 'Слаботочка'],
      [/^Где купить/, 'Где купить']
    ];
    for (const [item, title] of cases) {
      if (!screen.queryByRole('menu')) await user.click(tools());
      await user.click(screen.getByRole('menuitem', { name: item }));
      expect(isOpen(title)).toBe(true);
      await user.keyboard('{Escape}');
      expect(isOpen(title)).toBe(false);
    }
  });

  it('меню работает с клавиатуры', async () => {
    const user = userEvent.setup();
    render(<App />);
    gear().focus();
    await user.keyboard('{ArrowDown}');
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(items[items.length - 1]).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(gear()).toHaveFocus();
    expect(gear()).toHaveAttribute('aria-expanded', 'false');
  });

  it('щелчок мимо меню закрывает его', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(tools());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.querySelector('.col-list h2') as HTMLElement);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('на телефоне инструменты в пятой вкладке «Ещё»', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    await user.click(within(nav).getByRole('button', { name: 'Ещё' }));
    expect(within(nav).getAllByRole('group').map(g => g.getAttribute('aria-label'))).toEqual(['Собрать', 'Сравнить', 'Посчитать', 'Закупка']);
    await user.click(within(nav).getByRole('menuitem', { name: /^Комнаты/ }));
    expect(isOpen('Комнаты')).toBe(true);
  });
});
