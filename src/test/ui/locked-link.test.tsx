import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { LOCKED_VERSION, OWNER_PREFIX, SHARE_PREFIX, lockProject, unlockProject } from '../../core/share';
import { KEY } from '../../store/storage';
import { click, dlg, isOpen, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

afterEach(() => {
  window.location.hash = '';
});

const project = (name: string) => ({ ...newProject({ ...sample(), sample: false }, name), client: 'Сидоров', address: 'Витебск, пр. Победы, 3' });
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const type = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

describe('project links protected with a password', () => {
  it('asks for the password and then offers to add the project', async () => {
    window.location.hash = SHARE_PREFIX + await lockProject(project('Объект с паролем'), 'верный');
    render(<App />);
    await waitFor(() => expect(isOpen('Ссылка защищена паролем')).toBe(true));
    const d = dlg('Ссылка защищена паролем');
    expect(d.textContent).not.toContain('Объект с паролем');
    const input = d.querySelector('#linkPass') as HTMLInputElement;
    type(input, 'неверный');
    click(d, 'Открыть');
    await waitFor(() => expect(d.textContent).toContain('Пароль не подходит'), { timeout: 10000 });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    type(input, 'верный');
    click(d, 'Открыть');
    await waitFor(() => expect(isOpen('Присланный проект')).toBe(true), { timeout: 10000 });
    expect(dlg('Присланный проект').textContent).toContain('Объект с паролем');
    expect(isOpen('Ссылка защищена паролем')).toBe(false);
  });

  it('opens the owner passport after the password', async () => {
    window.location.hash = OWNER_PREFIX + await lockProject(project('Паспорт с паролем'), 'p');
    render(<App />);
    await waitFor(() => expect(isOpen('Ссылка защищена паролем')).toBe(true));
    const d = dlg('Ссылка защищена паролем');
    expect(d.textContent).toContain('Паспорт щитка');
    type(d.querySelector('#linkPass') as HTMLInputElement, 'p');
    click(d, 'Открыть');
    await waitFor(() => expect(document.body.textContent).toContain('Паспорт с паролем'), { timeout: 10000 });
  });

  it('drops the link on cancel', async () => {
    window.location.hash = SHARE_PREFIX + await lockProject(project('Отмена'), 'p');
    render(<App />);
    await waitFor(() => expect(isOpen('Ссылка защищена паролем')).toBe(true));
    click(dlg('Ссылка защищена паролем'), 'Отмена');
    await settle();
    expect(isOpen('Ссылка защищена паролем')).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('reports a cut link after the password', async () => {
    window.location.hash = SHARE_PREFIX + LOCKED_VERSION + 'AAAA';
    render(<App />);
    await waitFor(() => expect(isOpen('Ссылка защищена паролем')).toBe(true));
    const d = dlg('Ссылка защищена паролем');
    type(d.querySelector('#linkPass') as HTMLInputElement, 'p');
    click(d, 'Открыть');
    await waitFor(() => expect(toastText()).toContain('Ссылка повреждена'), { timeout: 10000 });
    expect(window.location.hash).toBe('');
  });

  it('copies a protected link and a message without the address', async () => {
    const p = project('Квартира');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    const write = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    render(<App />);
    await settle();
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    const d = dlg('Проекты');
    click(d, 'Обмен и данные');
    expect(d.textContent).toContain('Без пароля ссылка и файлы открываются у любого');
    type(d.querySelector('#filePass') as HTMLInputElement, 'тайна');
    click(d, /Ссылка на проект с паролем$/);
    await waitFor(() => expect(toastText()).toContain('Ссылка с паролем скопирована'), { timeout: 10000 });
    const url = (write.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain(SHARE_PREFIX + LOCKED_VERSION);
    expect((await unlockProject(url.slice(url.indexOf(SHARE_PREFIX) + SHARE_PREFIX.length), 'тайна'))?.address).toBe(p.address);
    click(d, 'Отправить в Viber или Telegram');
    await waitFor(() => expect(d.querySelector('.send-text')).not.toBeNull(), { timeout: 10000 });
    const text = (d.querySelector('.send-text') as HTMLTextAreaElement).value;
    expect(text).toContain('защищён паролем');
    expect(text).not.toContain('Витебск');
  });
});
