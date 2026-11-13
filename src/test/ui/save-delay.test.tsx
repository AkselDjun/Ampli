import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { BOOT_KEY, deletedIds, markDeleted, readProjects, saveBoot, writeProjects } from '../../store/storage';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { SAVE_DELAY_MS } from '../../app/useProjectPersistence';
import { byLabel, change } from './util';

const wait = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const bootWrites = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(c => c[0] === BOOT_KEY).length;
const savedName = () => JSON.parse(localStorage.getItem(BOOT_KEY) as string).project.lines[0].name as string;

describe('saving the project while typing', () => {
  it('writes once after a pause instead of on every key', async () => {
    render(<App />);
    await wait(SAVE_DELAY_MS + 100);
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const own = vi.spyOn(localStorage, 'setItem');
    for (const v of ['К', 'Ку', 'Кух', 'Кухня']) change(byLabel(document, 'Название группы'), v);
    expect(bootWrites(own) + bootWrites(set)).toBe(0);
    expect(document.querySelector('.save-indicator')).toHaveTextContent('Сохранено');
    await wait(SAVE_DELAY_MS + 100);
    expect(bootWrites(own) + bootWrites(set)).toBe(1);
    expect(savedName()).toBe('Кухня');
    set.mockRestore();
    own.mockRestore();
  });

  it('writes at once when the page is hidden or closed', async () => {
    render(<App />);
    await wait(SAVE_DELAY_MS + 100);
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    change(byLabel(document, 'Название группы'), 'Спальня');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(savedName()).toBe('Спальня');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    change(byLabel(document, 'Название группы'), 'Детская');
    window.dispatchEvent(new Event('pagehide'));
    expect(savedName()).toBe('Детская');
  });

  it('writes the last change when the app goes away', async () => {
    const { unmount } = render(<App />);
    await wait(SAVE_DELAY_MS + 100);
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    change(byLabel(document, 'Название группы'), 'Прихожая');
    unmount();
    expect(savedName()).toBe('Прихожая');
  });
});

describe('deleted projects after a cut write', () => {
  it('does not bring back a project whose deletion did not reach IndexedDB', async () => {
    const keep = newProject({ ...sample(), sample: false }, 'Остался');
    const gone = newProject({ ...sample(), sample: false }, 'Удалён');
    await writeProjects([keep, gone], []);
    saveBoot(keep, [keep.id]);
    markDeleted([gone.id]);
    render(<App />);
    await waitFor(async () => expect((await readProjects()).map(x => x.name)).toEqual(['Остался']));
    expect(deletedIds()).toEqual([]);
  });
});
