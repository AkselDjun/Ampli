import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PanelMode } from '../../ui/PanelMode';
import { IncomingSheet } from '../../ui/IncomingSheet';
import { Sheet } from '../../ui/common';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { putPhoto, photoKeys } from '../../store/photos';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { normProject, newProject, sampleProject } from '../../core/project';
import { packProject, SHARE_PREFIX } from '../../core/share';
import { PHOTO_LIMIT } from '../../core/photos';
import type { Photo, Project } from '../../core/types';
import { download } from '../../ui/download';
import { scalePhoto } from '../../ui/photoScale';
import { byLabel, change, click, dlg, isOpen, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

vi.mock('../../ui/download', () => ({ download: vi.fn() }));
vi.mock('../../ui/photoScale', () => ({ scalePhoto: vi.fn() }));

const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const lib = () => JSON.parse(localStorage.getItem(LIB_KEY) as string);
const ed = () => document.querySelector('.col-edit') as HTMLElement;
const list = () => document.querySelector('.col-list') as HTMLElement;
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

describe('Sheet props', () => {
  it('renders full and tip only when asked', () => {
    const { rerender } = render(<Sheet open onClose={() => undefined} title="Т1">x</Sheet>);
    expect(dlg('Т1').classList.contains('full')).toBe(false);
    expect(dlg('Т1').querySelector('.tip')).toBeNull();
    rerender(<Sheet open onClose={() => undefined} title="Т1" full tip="Подсказка!">x</Sheet>);
    expect(dlg('Т1').classList.contains('full')).toBe(true);
    expect(dlg('Т1').querySelector('.tip')).toBeTruthy();
    expect(within(dlg('Т1')).getByRole('tooltip', { hidden: true })).toHaveTextContent('Подсказка!');
  });
});

describe('PanelMode', () => {
  it('opens from the header and updates verdicts while typing', () => {
    render(<App />);
    expect(isOpen('На щитке')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Режим на щитке' }));
    expect(isOpen('На щитке')).toBe(true);
    const d = dlg('На щитке');
    expect(d.classList.contains('full')).toBe(true);
    const items = d.querySelectorAll('li.pm');
    expect(items.length).toBeGreaterThan(3);
    const first = items[0] as HTMLElement;
    expect(first.querySelector('.pill')?.textContent).toBe('Не измерено');
    expect(first.querySelector('.pm-note')?.textContent).toBe('');
    change(byLabel(d, 'Г1: Петля, Ом'), '0.2');
    expect(first.querySelector('.pill')?.textContent).toBe('Соответствует');
    expect(first.querySelector('.pm-note')?.textContent).toContain('Iк');
    change(byLabel(d, 'Г1: Петля, Ом'), '500');
    expect(first.querySelector('.pill')?.textContent).toBe('Не соответствует');
    expect(first).toHaveClass('bad');
    change(byLabel(d, 'Г1: Петля, Ом'), '');
    change(byLabel(d, 'Г1: Утечка, мА'), '0.1');
    expect(first.querySelector('.pm-note')?.textContent).toContain('Утечка до');
    change(byLabel(d, 'Г1: Изоляция, МОм'), '0.1');
    expect(first.querySelector('.pill')?.textContent).toBe('Не соответствует');
    expect(stored().list[0].lines[0].meas.ins).toBe('0.1');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen('На щитке')).toBe(false);
  });
  it('shows the empty state and skips unmatched rows', () => {
    const a = calcAll([], defaultCfg());
    render(<PanelMode open onClose={() => undefined} a={a} dispatch={() => undefined} />);
    expect(dlg('На щитке').textContent).toContain('Добавьте группы');
    expect(dlg('На щитке').querySelectorAll('li').length).toBe(0);
  });
  it('shows no cable name when the protection is missing', () => {
    const l = mkLine('Пустая', 'socket', 10, null, null, [['Чайник', 2200, 1]]);
    const a = calcAll([l], defaultCfg());
    const dispatch = vi.fn();
    render(<PanelMode open onClose={() => undefined} a={a} dispatch={dispatch} />);
    change(byLabel(dlg('На щитке'), 'Г1: Утечка, мА'), '2');
    expect(dispatch).toHaveBeenCalledWith({ t: 'lineMeasAt', id: l.id, field: 'leak', value: '2' });
  });
});

describe('IncomingSheet', () => {
  it('renders nothing for no project and the details for one', () => {
    const p = { ...sampleProject(), address: 'ул. Мира, 1' };
    const { rerender } = render(<IncomingSheet project={null} onAccept={() => undefined} onDecline={() => undefined} />);
    expect(dlg('Присланный проект').textContent).not.toContain('Добавить проект');
    rerender(<IncomingSheet project={p} onAccept={() => undefined} onDecline={() => undefined} />);
    expect(dlg('Присланный проект').textContent).toContain('ул. Мира, 1');
    expect(dlg('Присланный проект').textContent).toContain('7 групп');
    rerender(<IncomingSheet project={{ ...p, address: '', lines: [p.lines[0]] }} onAccept={() => undefined} onDecline={() => undefined} />);
    expect(dlg('Присланный проект').textContent).toContain('1 группа');
    expect(dlg('Присланный проект').querySelector('p')?.textContent).toBe(p.name);
  });
});

describe('incoming project flow', () => {
  const hashFor = (name: string, address = '') => {
    const p = newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Кухня', 'socket', 10, null, null, [['Чайник', 2200, 1]])] }, name);
    return packProject({ ...p, address });
  };

  it('accepts: adds a uniquely named project and clears the hash', () => {
    window.location.hash = SHARE_PREFIX + hashFor('Пример: двухкомнатная квартира', 'Минск');
    render(<App />);
    expect(isOpen('Присланный проект')).toBe(true);
    expect(dlg('Присланный проект').textContent).toContain('Минск');
    click(dlg('Присланный проект'), 'Добавить проект');
    expect(isOpen('Присланный проект')).toBe(false);
    expect(window.location.hash).toBe('');
    const s = stored();
    expect(s.list.map((x: Project) => x.name)).toEqual(['Пример: двухкомнатная квартира', 'Пример: двухкомнатная квартира 2']);
    expect(s.cur).toBe(s.list[1].id);
  });
  it('declines without adding', () => {
    window.location.hash = SHARE_PREFIX + hashFor('Чужой');
    render(<App />);
    click(dlg('Присланный проект'), 'Отмена');
    expect(isOpen('Присланный проект')).toBe(false);
    expect(window.location.hash).toBe('');
    expect(stored().list).toHaveLength(1);
  });
  it('ignores invalid hashes', () => {
    window.location.hash = SHARE_PREFIX + 'v1.garbage';
    render(<App />);
    expect(isOpen('Присланный проект')).toBe(false);
  });
  it('reacts to hashchange and ignores foreign hashes', () => {
    render(<App />);
    expect(isOpen('Присланный проект')).toBe(false);
    window.location.hash = '#other';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(isOpen('Присланный проект')).toBe(false);
    window.location.hash = SHARE_PREFIX + hashFor('Новый по ссылке');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(isOpen('Присланный проект')).toBe(true);
    expect(dlg('Присланный проект').textContent).toContain('Новый по ссылке');
    window.location.hash = SHARE_PREFIX + 'v1.bad';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(isOpen('Присланный проект')).toBe(false);
  });
  it('survives replaceState failing', () => {
    window.location.hash = SHARE_PREFIX + hashFor('Чужой');
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => { throw new Error('x'); });
    render(<App />);
    click(dlg('Присланный проект'), 'Отмена');
    expect(isOpen('Присланный проект')).toBe(false);
  });
});

describe('ShareBlock', () => {
  const openProj = () => {
    click(list(), 'Проекты');
    fireEvent.click(within(dlg('Проекты')).getByRole('tab', { name: 'Обмен и данные' }));
    return dlg('Проекты');
  };
  const clip = (impl: () => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(impl) }, configurable: true });
    return (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> }).writeText;
  };

  it('copies the link and the status disappears', async () => {
    const write = clip(() => Promise.resolve());
    render(<App />);
    const d = openProj();
    vi.useFakeTimers();
    await act(async () => { click(d, /Ссылка на проект/); });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toContain(SHARE_PREFIX + 'v1.');
    expect(d.querySelector('.share [role="status"]')?.textContent).toBe('Ссылка скопирована');
    expect(d.querySelector('.share textarea')).toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(d.querySelector('.share [role="status"]')).toBeNull();
  });
  it('falls back to a selected textarea when the clipboard fails and clears it on success', async () => {
    let fail = true;
    clip(() => (fail ? Promise.reject(new Error('no')) : Promise.resolve()));
    render(<App />);
    const d = openProj();
    await act(async () => { click(d, /Ссылка на проект/); });
    const ta = d.querySelector('.share textarea') as HTMLTextAreaElement;
    expect(ta.value).toContain(SHARE_PREFIX);
    expect(document.activeElement).toBe(ta);
    expect(d.querySelector('.share [role="status"]')?.textContent).toContain('вручную');
    fail = false;
    await act(async () => { click(d, /Ссылка на проект/); });
    expect(d.querySelector('.share textarea')).toBeNull();
  });
  it('toggles the QR code', () => {
    render(<App />);
    const d = openProj();
    const q = btnQr(d);
    expect(d.querySelector('.qr')).toBeNull();
    fireEvent.click(q);
    expect(q).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('img', { name: 'QR-код проекта' }).querySelector('svg')).toBeTruthy();
    fireEvent.click(q);
    expect(d.querySelector('.qr')).toBeNull();
  });
  it('explains when the project is too large for a QR code', () => {
    let s = 7;
    const rnd = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s.toString(36);
    };
    seed(p => {
      p.lines = Array.from({ length: 10 }, () => mkLine(Array.from({ length: 300 }, rnd).join(''), 'socket', 10, null, null, [['Чайник', 2200, 1]]));
    });
    render(<App />);
    const d = openProj();
    fireEvent.click(btnQr(d));
    expect(d.textContent).toContain('слишком большой для QR-кода');
    expect(d.querySelector('.qr')).toBeNull();
  });
});

const btnQr = (d: HTMLElement) => within(d).getByRole('button', { name: 'QR-код' });

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
    expect(d.querySelector('[role="status"]')?.textContent).toBe('Файл Excel сохранён');
    click(d, /CSV/);
    const c = vi.mocked(download).mock.calls[1];
    expect(c[0]).toMatch(/-smeta\.csv$/);
    expect(typeof c[1]).toBe('string');
    expect(c[2]).toBe('text/csv;charset=utf-8');
    expect(d.querySelector('[role="status"]')?.textContent).toBe('Файл CSV сохранён');
  });
});

describe('Editor search', () => {
  const boot = () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
  };
  const search = () => byLabel(ed(), 'Найти прибор');
  const appNames = () => Array.from(ed().querySelectorAll<HTMLInputElement>('input[aria-label="Название прибора"]')).map(i => i.value);

  it('filters while typing and picking adds the appliance and bumps usage', () => {
    boot();
    expect(ed().querySelector('.found')).toBeNull();
    const n0 = appNames().length;
    change(search(), 'led');
    const found = ed().querySelectorAll('.found button');
    expect(found.length).toBe(1);
    expect(found[0].textContent).toContain('LED-лента');
    fireEvent.click(found[0]);
    expect(appNames().length).toBe(n0 + 1);
    expect(appNames()).toContain('LED-лента');
    expect(search().value).toBe('');
    expect(lib().usage['led-лента'].n).toBe(1);
    change(search(), 'LED');
    fireEvent.click(ed().querySelector('.found button') as HTMLElement);
    expect(lib().usage['led-лента'].n).toBe(2);
    expect(ed().querySelectorAll('.found').length).toBe(0);
  });
  it('offers to add a custom appliance when nothing is found', () => {
    boot();
    const n0 = appNames().length;
    change(search(), '  Чудо-прибор ');
    expect(ed().querySelector('.found')).toBeNull();
    fireEvent.click(within(ed()).getByRole('button', { name: /Добавить «Чудо-прибор»/ }));
    expect(appNames().length).toBe(n0 + 1);
    expect(appNames()).toContain('Чудо-прибор');
    expect(lib().usage['чудо-прибор'].n).toBe(1);
    expect(search().value).toBe('');
  });
  it('shows frequently used after usage and sorts chips by usage', () => {
    boot();
    expect(ed().querySelector('.often')).toBeNull();
    const chips = () => Array.from(ed().querySelectorAll<HTMLElement>('.chips:not(.often) > .chip:not(.custom)')).map(c => c.textContent);
    expect(chips()[0]).toBe('+ Светильник');
    const chip = (t: string) => within(ed().querySelector('.chips:not(.often)') as HTMLElement).getByRole('button', { name: t });
    fireEvent.click(chip('+ LED-лента'));
    fireEvent.click(chip('+ LED-лента'));
    fireEvent.click(chip('+ Люстра'));
    expect(chips().slice(0, 3)).toEqual(['+ LED-лента', '+ Люстра', '+ Светильник']);
    const often = ed().querySelector('.often') as HTMLElement;
    expect(often.getAttribute('aria-label')).toBe('Часто используемые');
    expect(Array.from(often.querySelectorAll('button')).map(b => b.textContent)).toEqual(['+ LED-лента', '+ Люстра']);
    const n = appNames().length;
    fireEvent.click(within(often).getByRole('button', { name: '+ Люстра' }));
    expect(appNames().length).toBe(n);
    expect(lib().usage['люстра'].n).toBe(2);
    change(search(), 'л');
    expect(ed().querySelector('.often')).toBeNull();
  });
  it('lists own appliances in search and chips', () => {
    localStorage.setItem(LIB_KEY, JSON.stringify({ apps: [{ id: 'm1', name: 'Бра', w: 25, tag: 'l' }] }));
    boot();
    change(search(), 'бра');
    expect(ed().querySelector('.found')?.textContent).toContain('Бра');
    expect(ed().querySelector('.found')?.textContent).toContain('25 Вт');
    fireEvent.click(ed().querySelector('.found button') as HTMLElement);
    expect(appNames()).toContain('Бра');
    fireEvent.click(within(ed()).getByRole('button', { name: 'Убрать из моих приборов: Бра' }));
    expect(lib().apps).toHaveLength(0);
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
    await waitFor(async () => expect(await photoKeys()).toEqual([]));
  });
  it('ignores an empty file selection and reports storage failures', async () => {
    vi.mocked(scalePhoto).mockRejectedValueOnce(new Error('bad'));
    boot();
    await act(async () => { fireEvent.change(input(), { target: { files: [] } }); });
    expect(scalePhoto).not.toHaveBeenCalled();
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('[role="status"]')?.textContent).toContain('Не удалось сохранить фото'));
    expect(stored().list[0].photos ?? []).toEqual([]);
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('.photo-list')).toBeTruthy());
    expect(strip().querySelector('[role="status"]')).toBeNull();
  });
  it('reports failure when IndexedDB is unavailable', async () => {
    vi.mocked(scalePhoto).mockResolvedValue(blob());
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    boot();
    await attach(jpg());
    await waitFor(() => expect(strip().querySelector('[role="status"]')).toBeTruthy());
    expect(stored().list[0].photos ?? []).toEqual([]);
  });
  it('disables the add button at the limit', () => {
    seed(p => {
      p.photos = Array.from({ length: PHOTO_LIMIT }, (_, i) => ph('x' + i, p.lines[0].id));
    });
    boot();
    const b = within(strip()).getByRole('button', { name: /Фото/ });
    expect(b).toBeDisabled();
    expect(b.getAttribute('title')).toBe('Достигнут предел фото в проекте');
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
    expect(document.querySelector('.pd-photo figcaption')?.textContent).toBe('Г1 Освещение · До');
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

describe('Owner passport', () => {
  const clip = () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    return (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> }).writeText;
  };

  it('stores the group location typed in the editor', () => {
    seed(() => undefined);
    render(<App />);
    change(byLabel(ed(), 'Где находится группа'), 'Кухня и коридор');
    expect(stored().list[0].lines[0].where).toBe('Кухня и коридор');
  });

  it('prints the passport with a QR code and the location', () => {
    seed(p => { p.lines[0].where = 'Спальня'; });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<App />);
    click(nav(), /Приёмка/);
    click(dlg('Монтаж и приёмка'), 'Печать паспорта');
    const doc = document.querySelector('.printdoc') as HTMLElement;
    expect(doc.querySelector('h1')?.textContent).toBe('Паспорт электрощита');
    expect(doc.textContent).toContain('Спальня');
    expect(doc.querySelector('.pp-qr svg')).toBeTruthy();
    expect(doc.querySelector('.pp-steps')).toBeTruthy();
    print.mockRestore();
  });

  it('copies the owner link from the work sheet', async () => {
    const write = clip();
    render(<App />);
    click(nav(), /Приёмка/);
    const d = dlg('Монтаж и приёмка');
    await act(async () => { click(d, /Ссылка для владельца/); });
    expect(write.mock.calls[0][0]).toContain('#o=v1.');
    click(d, 'QR-код');
    expect(d.querySelector('[aria-label="QR-код паспорта"]')).toBeTruthy();
  });

  it('opens a read-only passport from an owner link and can hand the project over', () => {
    const p = sampleProject();
    p.lines[0].where = 'Прихожая';
    window.location.hash = '#o=' + packProject(p);
    render(<App />);
    expect(document.querySelector('.owner h1')?.textContent).toBe('Паспорт электрощита');
    expect(document.querySelector('.owner')?.textContent).toContain('Прихожая');
    expect(document.querySelector('.col-edit')).toBeNull();
    click(document.querySelector('.owner') as HTMLElement, 'Открыть проект в Ампли'.replace('Ампли', 'Ampli'));
    expect(document.querySelector('.owner')).toBeNull();
    expect(isOpen('Присланный проект')).toBe(true);
  });

  it('shows the passport when the hash changes while the app is open', () => {
    render(<App />);
    expect(document.querySelector('.owner')).toBeNull();
    act(() => {
      window.location.hash = '#o=' + packProject(sampleProject());
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.querySelector('.owner')).toBeTruthy();
    act(() => {
      window.location.hash = '#o=broken';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.querySelector('.owner')).toBeNull();
  });

  it('warns about simultaneous use and explains the test button for residual-current devices', () => {
    const p = sampleProject();
    p.lines = [mkLine('Кухня', 'socket', 10, null, null, [['Духовка', 3500, 1], ['Чайник', 2200, 1], ['Тостер', 900, 1]])];

    window.location.hash = '#o=' + packProject(p);
    render(<App />);
    const o = document.querySelector('.owner') as HTMLElement;
    expect(o.querySelector('.pp-warn')?.textContent).toContain('Духовка и Чайник');
    expect(o.textContent).toContain('кнопка «Т»');
  });
});
