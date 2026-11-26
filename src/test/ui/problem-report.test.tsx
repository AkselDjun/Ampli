import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../../ui/App';
import { Boundary } from '../../ui/Boundary';
import { newProject } from '../../core/project';
import { sample } from '../../core/templates';
import { KEY } from '../../store/storage';
import { readErrors, recordError } from '../../store/errlog';
import { ERR_KEY } from '../../core/errlog';
import { click, dlg, toastText } from './util';

vi.setConfig({ testTimeout: 60000 });

const project = () => ({ ...newProject({ ...sample(), sample: false }, 'Квартира Петрова'), client: 'Петров П. П.', address: 'Гродно, ул. Советская, 5' });
const settle = (ms = 30) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const openShare = () => {
  click(document.querySelector('.appbar') as HTMLElement, 'Проекты');
  const d = dlg('Проекты');
  click(d, 'Обмен и данные');
  return d;
};
const blobs = async (spy: { mock: { calls: unknown[][] } }) => Promise.all(spy.mock.calls.map(c => (c[0] as Blob).text()));

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
});

describe('report a problem', () => {
  it('downloads a report with the logged errors and the note, without project data', async () => {
    const p = project();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    recordError('error', new TypeError('x is undefined'), { now: Date.UTC(2026, 10, 25, 12, 0) });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    render(<App />);
    await settle();
    const d = openShare();
    expect(d.textContent).toContain('Сообщить о проблеме');
    expect(d.textContent).toContain('записано: 1 ошибка');
    fireEvent.change(d.querySelector('#problemNote') as HTMLTextAreaElement, { target: { value: 'Смета не открывается' } });
    await waitFor(() => expect(d.querySelector('.problem-pre')?.textContent).toContain('Смета не открывается'));
    click(d, 'Скачать отчёт');
    await waitFor(() => expect(toastText()).toContain('Отчёт скачан'));
    const [text] = await blobs(create);
    expect(text).toContain('TypeError: x is undefined');
    expect(text).toContain('Смета не открывается');
    expect(text).not.toContain('Петров');
    expect(text).not.toContain('Советская');
    expect(text).not.toContain('Квартира Петрова');
  });
  it('says when nothing was logged and hides the clear button', async () => {
    render(<App />);
    await settle();
    const d = openShare();
    expect(d.textContent).toContain('Ошибок на этом устройстве не записано');
    expect(d.textContent).not.toContain('Очистить журнал');
    expect(d.querySelector('a[href*="issues/new"]')?.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('clears the journal after confirmation', async () => {
    recordError('rejection', 'lost', { now: 1 });
    render(<App />);
    await settle();
    const d = openShare();
    click(d, 'Очистить журнал');
    expect(localStorage.getItem(ERR_KEY)).not.toBeNull();
    click(d, 'Очистить? Нажмите ещё раз');
    expect(localStorage.getItem(ERR_KEY)).toBeNull();
    expect(d.textContent).toContain('Ошибок на этом устройстве не записано');
  });
  it('sends the report through the share menu where the phone supports files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    render(<App />);
    await settle();
    const d = openShare();
    click(d, 'Отправить отчёт');
    await waitFor(() => expect(toastText()).toContain('Отчёт отправлен'));
    const files = (share.mock.calls[0][0] as { files: File[] }).files;
    expect(files[0].name).toMatch(/^ampli-problem-\d{4}-\d{2}-\d{2}\.txt$/);
  });
  it('stays quiet when the person closes the share menu', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('no', 'AbortError')), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    render(<App />);
    await settle();
    const d = openShare();
    click(d, 'Отправить отчёт');
    await settle(50);
    expect(toastText()).not.toContain('Не удалось');
  });
});

function Crash(): never {
  throw new Error('render failed');
}

describe('crash screen', () => {
  it('records the crash and offers the report', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const view = render(<Boundary><Crash /></Boundary>);
    await waitFor(() => expect(readErrors()[0]?.kind).toBe('render'));
    expect(readErrors()[0].stack).toContain('Crash');
    fireEvent.click(view.getByRole('button', { name: 'Скачать отчёт об ошибке' }));
    await waitFor(() => expect(view.getByRole('status').textContent).toContain('Отчёт скачан'));
    const [text] = await blobs(create);
    expect(text).toContain('Сбой экрана');
    expect(text).toContain('Error: render failed');
  });
});
