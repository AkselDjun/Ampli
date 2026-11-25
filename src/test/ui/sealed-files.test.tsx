import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { KEY } from '../../store/storage';
import { seal } from '../../store/seal';
import { storedProjects } from '../stored';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const project = (name: string) => ({ ...newProject({ ...sample(), sample: false }, name), client: 'Петров П. П.', address: 'Гродно, ул. Советская, 5' });
const seed = (...list: ReturnType<typeof project>[]) => localStorage.setItem(KEY, JSON.stringify({ cur: list[0].id, list }));
const settle = (ms = 30) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const openShare = () => {
  click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
  const d = dlg('Проекты');
  click(d, 'Обмен и данные');
  return d;
};
const importFile = async (d: HTMLElement, text: string) => {
  const f = new File([text], 'b.json', { type: 'application/json' });
  fireEvent.change(d.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [f] } });
  await settle();
};
const type = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

describe('files protected with a password', () => {
  it('saves the backup and the project file encrypted when a password is set', async () => {
    seed(project('Квартира'));
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    render(<App />);
    await settle();
    const d = openShare();
    expect(d.textContent).toContain('Без пароля файлы сохраняются открытыми');
    type(d.querySelector('#filePass') as HTMLInputElement, 'секрет');
    expect(d.textContent).toContain('Запишите пароль');
    click(d, 'Сохранить резервную копию');
    await waitFor(() => expect(toastText()).toContain('Резервная копия с паролем подготовлена'), { timeout: 10000 });
    click(d, 'Сохранить в файл');
    await waitFor(() => expect(toastText()).toContain('Файл сохранён с паролем'), { timeout: 10000 });
    for (const call of create.mock.calls) {
      const text = await (call[0] as Blob).text();
      const o = JSON.parse(text) as { kind: string };
      expect(o.kind).toBe('sealed');
      expect(text).not.toContain('Петров');
      expect(text).not.toContain('Гродно');
    }
    expect(create).toHaveBeenCalledTimes(2);
    create.mockRestore();
  });

  it('asks for the password when opening a protected backup', async () => {
    const a = project('Квартира');
    const b = project('Дача');
    seed(a);
    render(<App />);
    await settle();
    const d = openShare();
    const file = await seal(JSON.stringify({ app: 'ampli', kind: 'backup', list: [a, b] }), 'верный', 'backup', 100000);
    await importFile(d, file);
    const input = d.querySelector('#unlockPass') as HTMLInputElement;
    expect(input).toBeTruthy();
    type(input, 'неверный');
    click(d, 'Открыть');
    await waitFor(() => expect(d.textContent).toContain('Пароль не подходит'), { timeout: 10000 });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    type(input, 'верный');
    click(d, 'Открыть');
    await waitFor(() => expect(toastText()).toContain('Восстановлено проектов: 1'), { timeout: 10000 });
    expect(d.querySelector('#unlockPass')).toBeNull();
    await settle();
    expect((await storedProjects()).map(x => x.id)).toContain(b.id);
  });

  it('closes the password prompt on cancel without importing', async () => {
    const a = project('Квартира');
    seed(a);
    render(<App />);
    await settle();
    const d = openShare();
    await importFile(d, await seal(JSON.stringify(project('Дача')), 'p', 'project', 100000));
    click(d, 'Отмена');
    expect(d.querySelector('#unlockPass')).toBeNull();
    expect((await storedProjects()).length).toBe(1);
  });

  it('reports a damaged protected file', async () => {
    seed(project('Квартира'));
    render(<App />);
    await settle();
    const d = openShare();
    const o = JSON.parse(await seal('x', 'p', 'project', 100000)) as Record<string, unknown>;
    await importFile(d, JSON.stringify({ ...o, v: 9 }));
    type(d.querySelector('#unlockPass') as HTMLInputElement, 'p');
    click(d, 'Открыть');
    await waitFor(() => expect(toastText()).toContain('Файл повреждён'), { timeout: 10000 });
  });
});
