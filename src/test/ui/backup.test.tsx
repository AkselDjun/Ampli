import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { BACKUP_AT, BACKUP_SNOOZE, DAY } from '../../store/backup';
import { KEY } from '../../store/storage';
import { storedProjects } from '../stored';
import { click, dlg, toastText } from './util';
import { currentToast } from '../../ui/toast';

vi.setConfig({ testTimeout: 60000 });

const project = (name: string, age = 0) => {
  const p = newProject({ ...sample(), sample: false }, name);
  return { ...p, created: p.created - age, updated: p.updated - age };
};
const seed = (...list: ReturnType<typeof project>[]) => localStorage.setItem(KEY, JSON.stringify({ cur: list[0].id, list }));
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
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
const setStorage = (v: unknown) => Object.defineProperty(navigator, 'storage', { value: v, configurable: true });

describe('backup of all projects', () => {
  it('saves own projects to one file and remembers the date', async () => {
    const a = project('Квартира');
    seed(a);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    render(<App />);
    await settle();
    const d = openShare();
    expect(d.textContent).toContain('Копия ещё не сохранялась');
    click(d, 'Сохранить резервную копию');
    expect(toastText()).toContain('Резервная копия сохранена');
    expect(Number(localStorage.getItem(BACKUP_AT))).toBeGreaterThan(0);
    expect(d.textContent).toContain('Последняя копия');
    const data = JSON.parse(await (create.mock.calls[0][0] as Blob).text());
    expect(data.kind).toBe('backup');
    expect(data.list.map((x: { id: string }) => x.id)).toEqual([a.id]);
    create.mockRestore();
  });

  it('reports a device that cannot save files', async () => {
    seed(project('Квартира'));
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('x'); });
    render(<App />);
    await settle();
    click(openShare(), 'Сохранить резервную копию');
    expect(toastText()).toContain('Не удалось сохранить');
    expect(localStorage.getItem(BACKUP_AT)).toBeNull();
    create.mockRestore();
  });

  it('restores projects from a backup and skips those already here', async () => {
    const a = project('Квартира');
    const b = project('Дача');
    seed(a);
    render(<App />);
    await settle();
    const d = openShare();
    await importFile(d, JSON.stringify({ app: 'ampli', kind: 'backup', list: [a] }));
    expect(toastText()).toContain('уже есть');
    await importFile(d, JSON.stringify({ app: 'ampli', kind: 'backup', list: [a, b] }));
    expect(toastText()).toContain('Восстановлено проектов: 1');
    await settle();
    expect((await storedProjects()).map(x => x.id)).toContain(b.id);
  });
});

describe('weekly reminder and persistent storage', () => {
  it('offers a backup when the last one is older than a week', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    seed(project('Квартира', 8 * DAY));
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(6000); });
    vi.useRealTimers();
    expect(toastText()).toContain('не сохранялась больше недели');
    expect(Number(localStorage.getItem(BACKUP_SNOOZE))).toBeGreaterThan(Date.now());
    act(() => currentToast()?.run?.());
    expect(toastText()).toContain('Резервная копия сохранена');
    create.mockRestore();
  });

  it('stays quiet for fresh projects', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    seed(project('Квартира'));
    render(<App />);
    await act(async () => { vi.advanceTimersByTime(6000); });
    vi.useRealTimers();
    expect(toastText()).not.toContain('больше недели');
  });

  it('asks the browser once to keep data when there are own projects', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    seed(project('Квартира'));
    render(<App />);
    await settle();
    expect(persist).toHaveBeenCalledTimes(1);
    setStorage(undefined);
  });

  it('does not ask while only the sample is open', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setStorage({ persist });
    render(<App />);
    await settle();
    expect(persist).not.toHaveBeenCalled();
    setStorage(undefined);
  });
});
