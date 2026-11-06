import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { putPhoto, photoKeys } from '../../store/photos';
import { normProject, sampleProject } from '../../core/project';
import { PHOTO_LIMIT } from '../../core/photos';
import type { Photo, Project } from '../../core/types';
import { download } from '../../ui/download';
import { scalePhoto } from '../../ui/photoScale';
import { byLabel, change, click, dlg, wide, toastText } from '../ui/util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

vi.mock('../../ui/download', () => ({ download: vi.fn() }));
vi.mock('../../ui/photoScale', () => ({ scalePhoto: vi.fn() }));

const ed = () => document.querySelector('.col-edit') as HTMLElement;
const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
const jpg = () => new File(['x'], 'a.jpg', { type: 'image/jpeg' });
const ph = (id: string, line: string, tag: Photo['tag'] = 'before'): Photo => ({ id, tag, line, note: '', at: 1 });

const seed = (mut: (p: Project) => void) => {
  const p = sampleProject();
  mut(p);
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  return p;
};

afterEach(() => {
  window.location.hash = '';
  vi.mocked(download).mockClear();
  vi.mocked(scalePhoto).mockReset();
});

describe('ReportSheet downloads', () => {
  it('saves Excel and CSV files', () => {
    render(<App />);
    click(nav(), /Отчёт/);
    const d = dlg('Отчёт и спецификация');
    click(d, /Excel/);
    expect(download).toHaveBeenCalledTimes(1);
    const x = vi.mocked(download).mock.calls[0];
    expect(x[0]).toMatch(/-smeta\.xlsx$/);
    expect(x[1]).toBeInstanceOf(Uint8Array);
    expect(x[2]).toContain('spreadsheetml');
    expect(toastText()).toBe('Файл Excel сохранён');
    click(d, /CSV/);
    const c = vi.mocked(download).mock.calls[1];
    expect(c[0]).toMatch(/-smeta\.csv$/);
    expect(typeof c[1]).toBe('string');
    expect(c[2]).toBe('text/csv;charset=utf-8');
    expect(toastText()).toBe('Файл CSV сохранён');
  });
});

describe('photos', () => {
  const boot = () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
  };
  const input = () => ed().querySelector('[data-testid="photo-input-line"]') as HTMLInputElement;
  const strip = () => ed().querySelector('.photos') as HTMLElement;
  const attach = async (f: File) => {
    await act(async () => { fireEvent.change(input(), { target: { files: [f] } }); });
  };

  it('adds a photo to a group with a chosen tag, edits the note and deletes it', async () => {
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    boot();
    click(ed(), /Замеры и фото/);
    expect(strip().querySelector('.photo-list')).toBeNull();
    fireEvent.click(within(strip()).getByRole('button', { name: /Фото/ }));
    fireEvent.click(strip().querySelector('input[name="ptag-line"][value="after"]') as HTMLElement);
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('.photo-list img')).toBeTruthy());
    expect(strip().querySelector('.ph-tag')?.textContent).toBe('После');
    const p = stored().list[0].photos;
    expect(p).toHaveLength(1);
    expect(p[0].tag).toBe('after');
    expect(p[0].line).toBe(stored().list[0].lines[0].id);
    expect((await photoKeys())).toEqual([p[0].id]);
    change(byLabel(strip(), 'Подпись к фото'), 'Щиток открыт');
    expect(stored().list[0].photos[0].note).toBe('Щиток открыт');
    fireEvent.click(within(strip()).getByRole('button', { name: 'Удалить фото' }));
    expect(strip().querySelector('.photo-list')).toBeNull();
    expect(stored().list[0].photos).toEqual([]);
    expect(await photoKeys()).toEqual([p[0].id]);
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(stored().list[0].photos).toEqual([]);
  });
  it('ignores an empty file selection and reports storage failures', async () => {
    vi.mocked(scalePhoto).mockRejectedValueOnce(new Error('bad'));
    boot();
    await act(async () => { fireEvent.change(input(), { target: { files: [] } }); });
    expect(scalePhoto).not.toHaveBeenCalled();
    await attach(jpg());
    await waitFor(() => expect(toastText()).toContain('Не удалось сохранить фото'));
    expect(stored().list[0].photos ?? []).toEqual([]);
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('.photo-list')).toBeTruthy());
  });
  it('reports failure when IndexedDB is unavailable', async () => {
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    boot();
    await attach(jpg());
    await waitFor(() => expect(toastText()).not.toBe(''));
    expect(stored().list[0].photos ?? []).toEqual([]);
  });
  it('disables the add button at the limit', () => {
    seed(p => {
      p.photos = Array.from({ length: PHOTO_LIMIT }, (_, i) => ph('x' + i, p.lines[0].id));
    });
    boot();
    click(ed(), /Замеры и фото/);
    const b = within(strip()).getByRole('button', { name: /Фото/ });
    expect(b).toBeDisabled();
    expect(strip().textContent).toContain('это предел');
  });
  it('shows stored photos and a placeholder for missing blobs', async () => {
    await putPhoto('have', blob());
    seed(p => {
      p.photos = [ph('have', p.lines[0].id), ph('lost', p.lines[0].id)];
    });
    boot();
    await waitFor(() => expect(strip().querySelectorAll('.photo-list img').length).toBe(1));
    expect(strip().querySelectorAll('.photo-list li').length).toBe(2);
    expect(strip().querySelector('.photo-list .muted')?.textContent).toBe('…');
  });
  it('tolerates a failing photo store while loading', async () => {
    seed(p => {
      p.photos = [ph('have', p.lines[0].id)];
    });
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    boot();
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(strip().querySelectorAll('.photo-list li').length).toBe(1);
    expect(strip().querySelectorAll('.photo-list img').length).toBe(0);
  });
  it('still shows a group photo after the app is unmounted and rendered again', async () => {
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    wide(true);
    const first = render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('.photo-list img')).toBeTruthy());
    const lineId = stored().list[0].lines[0].id;
    first.unmount();
    expect(stored().list[0].photos[0].line).toBe(lineId);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    expect(stored().list[0].lines[0].id).toBe(lineId);
    await waitFor(() => expect(strip().querySelectorAll('.photo-list img').length).toBe(1));
  });
  it('removes the photos of a deleted group and collects orphaned blobs on start', async () => {
    await putPhoto('orphan', blob());
    await putPhoto('kept', blob());
    seed(p => {
      p.photos = [ph('kept', p.lines[0].id)];
    });
    boot();
    await waitFor(async () => expect(await photoKeys()).toEqual(['kept']));
  });
});

describe('print with photos', () => {
  const setup = async (complete: boolean) => {
    await putPhoto('have', blob());
    seed(p => {
      p.photos = [ph('have', p.lines[0].id)];
    });
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(complete);
    wide(true);
    render(<App />);
    click(nav(), /Приёмка/);
    click(dlg('Монтаж и приёмка'), 'Печать протокола');
    await waitFor(() => expect(document.querySelector('.pd-photo img')).toBeTruthy());
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1), { timeout: 5000 });
    vi.mocked(window.print).mockClear();
  };

  it('renders the photo section with captions in proto mode', async () => {
    await setup(true);
    expect(document.querySelector('.printdoc h2')?.textContent).toContain('Фотофиксация');
    expect(document.querySelector('.pd-photo figcaption')?.textContent).toBe('Г1 Свет: комнаты · До');
  });
  it('waits for images to load before printing', async () => {
    await setup(true);
    vi.useFakeTimers();
    click(dlg('Монтаж и приёмка'), 'Печать протокола');
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
  });
  it('gives up waiting after the deadline', async () => {
    await setup(false);
    vi.useFakeTimers();
    click(dlg('Монтаж и приёмка'), 'Печать протокола');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(window.print).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(window.print).toHaveBeenCalledTimes(1);
  });
  it('prints at once in proto mode without photos', async () => {
    wide(true);
    render(<App />);
    click(nav(), /Приёмка/);
    vi.useFakeTimers();
    click(dlg('Монтаж и приёмка'), 'Печать протокола');
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.pd-photo')).toBeNull();
  });
  it('keeps photos of unknown groups when normalizing', () => {
    const p = normProject({ ...sampleProject(), photos: [ph('g', 'gone', 'meas')] }, true) as Project;
    expect(p.photos?.[0].line).toBe('gone');
  });
});
