import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { Boundary } from '../../ui/Boundary';
import { newProject, sampleProject } from '../../core/project';
import { IDBObjectStore } from 'fake-indexeddb';
import { sample } from '../../core/templates';
import { KEY, readProjects, saveBoot, writeProjects } from '../../store/storage';
import { init, reducer } from '../../store/reducer';
import { flushSaves, stored, storedProjects } from '../stored';
import { byLabel, change } from './util';

vi.setConfig({ testTimeout: 60000 });

const project = (name: string) => newProject({ ...sample(), sample: false }, name);
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });

describe('projects in IndexedDB', () => {
  it('moves the old localStorage store into IndexedDB and removes it', async () => {
    const a = project('Первый');
    const b = project('Второй');
    localStorage.setItem(KEY, JSON.stringify({ cur: b.id, list: [a, b] }));
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
    expect((await storedProjects()).map(x => x.name)).toEqual(['Первый', 'Второй']);
    expect(stored().cur).toBe(b.id);
  });

  it('opens the current project at once and loads the others in the stored order', async () => {
    const a = project('Первый');
    const b = project('Второй');
    const c = project('Третий');
    await writeProjects([a, b, c], []);
    saveBoot(b, [c.id, a.id, b.id]);
    render(<App />);
    expect(document.body.textContent).toContain('Второй');
    await settle();
    expect(stored().cur).toBe(b.id);
    expect(stored().order).toEqual([c.id, a.id, b.id]);
  });

  it('replaces the sample with projects found only in IndexedDB', async () => {
    const a = project('Сохранённый');
    await writeProjects([a], []);
    render(<App />);
    await waitFor(() => expect(stored().cur).toBe(a.id));
    expect(stored().list[0].name).toBe('Сохранённый');
  });

  it('keeps a newer copy from IndexedDB over a stale boot record', async () => {
    const a = project('Старое имя');
    const fresh = { ...a, name: 'Новое имя', updated: a.updated + 1000 };
    await writeProjects([fresh], []);
    saveBoot(a, [a.id]);
    render(<App />);
    await waitFor(() => expect(stored().list[0].name).toBe('Новое имя'));
  });

  it('writes only the edited project', async () => {
    const a = project('Первый');
    const b = project('Второй');
    await writeProjects([a, b], []);
    saveBoot(a, [a.id, b.id]);
    render(<App />);
    await settle();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    fireEvent.click(document.querySelector('.col-list .row') as HTMLElement);
    change(byLabel(document, 'Название группы'), 'Кухня');
    flushSaves();
    await settle();
    expect(put).toHaveBeenCalled();
    expect(put.mock.calls.every(c => c[1] === a.id)).toBe(true);
    put.mockRestore();
    const saved = await readProjects();
    expect(saved).toHaveLength(2);
    expect(saved.find(x => x.id === a.id)?.lines[0].name).toBe('Кухня');
  });

  it('downloads a backup with IndexedDB projects from the crash screen', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    await writeProjects([sampleProject()], []);
    const Bad = () => { throw new Error('x'); };
    render(<Boundary><Bad /></Boundary>);
    fireEvent.click(dlgless('Скачать резервную копию'));
    await waitFor(() => expect(create).toHaveBeenCalled());
    const blob = create.mock.calls[0][0] as Blob;
    const data = JSON.parse(await blob.text());
    expect(data.projects).toHaveLength(1);
    create.mockRestore();
    err.mockRestore();
  });
});

const dlgless = (name: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent === name) as HTMLElement;

describe('hydrate action', () => {
  it('merges stored projects and keeps the open project and selection', () => {
    const a = project('Первый');
    const b = sampleProject();
    const s = init({ cur: b.id, list: [b] });
    const next = reducer({ ...s, sel: 'x' }, { t: 'hydrate', projects: [a], order: [a.id, b.id], replace: false });
    expect(next.list.map(x => x.id)).toEqual([a.id, b.id]);
    expect(next.cur).toBe(b.id);
    expect(next.sel).toBe('x');
    expect(reducer(s, { t: 'hydrate', projects: [], order: [], replace: true })).toBe(s);
  });
  it('swaps an untouched sample for stored projects', () => {
    const a = project('Первый');
    const s = init({ cur: 'x', list: [{ ...sampleProject(), id: 'x' }] });
    const next = reducer(s, { t: 'hydrate', projects: [a], order: ['x'], replace: true });
    expect(next.list.map(x => x.id)).toEqual([a.id]);
    expect(next.cur).toBe(a.id);
  });
});
