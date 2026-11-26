import { describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { LockGate, lockNow, AUTO_LOCK_MS } from '../../ui/LockGate';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { BOOT_KEY, KEY, resetProjectDb } from '../../store/storage';
import { resetPhotoCache } from '../../store/photos';
import { LOCK_KEY, lockPresent, resetVault, vaultOpen } from '../../store/vault';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const project = (name: string) => ({ ...newProject({ ...sample(), sample: false }, name), client: 'Жуков', address: 'Пинск, ул. Ленина, 12' });
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const type = (el: Element | null, v: string) => fireEvent.change(el as HTMLInputElement, { target: { value: v } });
const mount = () => render(<LockGate><App /></LockGate>);
const lockScreen = () => document.querySelector('main.lock') as HTMLElement | null;

const restart = () => {
  cleanup();
  resetVault();
  resetProjectDb();
  resetPhotoCache();
};

const enable = async (pass: string): Promise<string> => {
  click(document.querySelector('.appbar') as HTMLElement, 'Проекты');
  const d = dlg('Проекты');
  click(d, 'Обмен и данные');
  click(d, 'Включить замок');
  type(d.querySelector('#lkPass'), pass);
  type(d.querySelector('#lkAgain'), pass + 'x');
  const code = (d.querySelector('.lock-code') as HTMLElement).textContent ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
  const submit = Array.from(d.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(b => b.textContent === 'Включить замок') as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.click(d.querySelector('.lock-ok input') as HTMLInputElement);
  fireEvent.click(submit);
  await waitFor(() => expect(d.textContent).toContain('Пароли не совпадают'));
  type(d.querySelector('#lkAgain'), pass);
  fireEvent.click(submit);
  await waitFor(() => expect(toastText()).toContain('Замок включён'), { timeout: 15000 });
  return code;
};

const seed = () => {
  const p = project('Квартира Жукова');
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  return p;
};

describe('app lock', () => {
  it('encrypts data, asks for the password on the next start and opens the projects', async () => {
    seed();
    mount();
    await settle();
    await enable('тайна');
    expect(lockPresent()).toBe(true);
    await settle();
    expect(localStorage.getItem(KEY)).toBeNull();
    await waitFor(() => expect(localStorage.getItem(BOOT_KEY)).toContain('"vault"'));
    expect(localStorage.getItem(BOOT_KEY)).not.toContain('Жуков');

    restart();
    mount();
    await waitFor(() => expect(lockScreen()).not.toBeNull());
    expect(document.body.textContent).not.toContain('Квартира Жукова');
    type(document.querySelector('#lockPass'), 'не та');
    fireEvent.click(Array.from(lockScreen()?.querySelectorAll('button') ?? []).find(b => b.textContent === 'Открыть') as HTMLElement);
    await waitFor(() => expect(lockScreen()?.textContent).toContain('Пароль не подходит'), { timeout: 15000 });
    type(document.querySelector('#lockPass'), 'тайна');
    fireEvent.click(Array.from(lockScreen()?.querySelectorAll('button') ?? []).find(b => b.textContent === 'Открыть') as HTMLElement);
    await waitFor(() => expect(lockScreen()).toBeNull(), { timeout: 15000 });
    await waitFor(() => expect(document.body.textContent).toContain('Квартира Жукова'));
  });

  it('locks on demand and after five minutes in the background without losing the open project', async () => {
    seed();
    mount();
    await settle();
    await enable('p');
    act(() => lockNow());
    await waitFor(() => expect(lockScreen()).not.toBeNull());
    expect((document.getElementById('root') ?? document.body.firstElementChild as HTMLElement).inert || Array.from(document.body.children).some(el => (el as HTMLElement).inert)).toBe(true);
    type(document.querySelector('#lockPass'), 'p');
    fireEvent.click(Array.from(lockScreen()?.querySelectorAll('button') ?? []).find(b => b.textContent === 'Открыть') as HTMLElement);
    await waitFor(() => expect(lockScreen()).toBeNull(), { timeout: 15000 });
    expect(vaultOpen()).toBe(true);
    expect(Array.from(document.body.children).some(el => (el as HTMLElement).inert)).toBe(false);

    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    clock.mockReturnValue(now + AUTO_LOCK_MS + 1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    clock.mockRestore();
    await waitFor(() => expect(lockScreen()).not.toBeNull());
  });

  it('sets a new password with the recovery code', async () => {
    seed();
    mount();
    await settle();
    const code = await enable('старый');
    restart();
    mount();
    await waitFor(() => expect(lockScreen()).not.toBeNull());
    click(lockScreen() as HTMLElement, 'Забыли пароль?');
    type(document.querySelector('#lockCode'), 'AAAA-AAAA-AAAA-AAAA-AAAA');
    type(document.querySelector('#lockNew'), 'новый');
    type(document.querySelector('#lockAgain'), 'новый');
    click(lockScreen() as HTMLElement, 'Сменить пароль и открыть');
    await waitFor(() => expect(lockScreen()?.textContent).toContain('Код не подходит'), { timeout: 15000 });
    type(document.querySelector('#lockCode'), code.toLowerCase());
    click(lockScreen() as HTMLElement, 'Сменить пароль и открыть');
    await waitFor(() => expect(lockScreen()).toBeNull(), { timeout: 15000 });
    await waitFor(() => expect(document.body.textContent).toContain('Квартира Жукова'));
  });

  it('turns the lock off with the password', async () => {
    seed();
    mount();
    await settle();
    await enable('p');
    const d = dlg('Проекты');
    click(d, 'Выключить замок');
    type(d.querySelector('#lkOff'), 'x');
    fireEvent.click(Array.from(d.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(b => b.textContent === 'Выключить замок') as HTMLElement);
    await waitFor(() => expect(d.textContent).toContain('Пароль не подходит'), { timeout: 15000 });
    type(d.querySelector('#lkOff'), 'p');
    fireEvent.click(Array.from(d.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(b => b.textContent === 'Выключить замок') as HTMLElement);
    await waitFor(() => expect(toastText()).toContain('Замок выключен'), { timeout: 15000 });
    expect(localStorage.getItem(LOCK_KEY)).toBeNull();
    restart();
    mount();
    await settle();
    expect(lockScreen()).toBeNull();
    await waitFor(() => expect(document.body.textContent).toContain('Квартира Жукова'));
  });
});
