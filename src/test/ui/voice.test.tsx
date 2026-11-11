import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { Mic } from '../../ui/Mic';
import { VOICE_NOTE_KEY, listen, speechSupported } from '../../ui/voice';
import type { Rec } from '../../ui/voice';
import { stored } from '../stored';
import { byLabel, change, click, dlg, toastText } from './util';

const made: FakeRec[] = [];
const rec = (): FakeRec | undefined => made[made.length - 1];

class FakeRec implements Rec {
  lang = '';
  interimResults = true;
  continuous = false;
  onresult: Rec['onresult'] = null;
  onerror: Rec['onerror'] = null;
  onend: Rec['onend'] = null;
  started = false;
  constructor() {
    made.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  say(...parts: [string, boolean][]) {
    this.onresult?.({ resultIndex: 0, results: parts.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) as never });
  }
  fail(error: string) {
    this.onerror?.({ error });
    this.onend?.();
  }
}

const setSpeech = (v: unknown) => Object.defineProperty(window, 'webkitSpeechRecognition', { value: v, configurable: true, writable: true });

beforeEach(() => {
  made.length = 0;
  setSpeech(FakeRec);
});

afterEach(() => {
  setSpeech(undefined);
});

describe('speech recognition wrapper', () => {
  it('reports support and passes only final phrases', () => {
    expect(speechSupported()).toBe(true);
    const got: string[] = [];
    const end = vi.fn();
    const stop = listen(t => got.push(t), end);
    expect(rec()?.lang).toBe('ru-RU');
    expect(rec()?.interimResults).toBe(false);
    rec()?.say(['чайник', false], ['  ', true], ['плита', true]);
    expect(got).toEqual(['плита']);
    stop();
    expect(end).toHaveBeenCalledWith(null);
  });

  it('explains errors and ignores an abort', () => {
    const end = vi.fn();
    listen(() => undefined, end);
    rec()?.fail('not-allowed');
    expect(end).toHaveBeenLastCalledWith(expect.stringContaining('Нет доступа к микрофону'));
    listen(() => undefined, end);
    rec()?.fail('strange');
    expect(end).toHaveBeenLastCalledWith('Не удалось распознать речь.');
    listen(() => undefined, end);
    rec()?.fail('aborted');
    expect(end).toHaveBeenLastCalledWith(null);
  });

  it('handles a browser without recognition or a failing start', () => {
    setSpeech(undefined);
    expect(speechSupported()).toBe(false);
    const end = vi.fn();
    listen(() => undefined, end)();
    expect(end).toHaveBeenCalledWith(expect.stringContaining('не умеет распознавать'));
    class Broken extends FakeRec {
      start() {
        throw new Error('busy');
      }
    }
    setSpeech(Broken);
    listen(() => undefined, end);
    expect(end).toHaveBeenLastCalledWith('Не удалось включить микрофон.');
  });
});

describe('Mic button', () => {
  it('is hidden without speech support', () => {
    setSpeech(undefined);
    const { container } = render(<Mic label="Диктовать" onText={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('dictates, normalises numbers, warns once about the cloud and stops', () => {
    const onText = vi.fn();
    render(<Mic label="Диктовать" onText={onText} />);
    const b = screen.getByRole('button', { name: 'Диктовать' });
    fireEvent.click(b);
    expect(toastText()).toContain('серверы Google');
    expect(localStorage.getItem(VOICE_NOTE_KEY)).toBe('1');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    act(() => { rec()?.say(['духовка три с половиной киловатта', true]); });
    expect(onText).toHaveBeenCalledWith('духовка 3,5 кВт');
    fireEvent.click(screen.getByRole('button', { name: 'Остановить диктовку' }));
    expect(screen.getByRole('button', { name: 'Диктовать' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the recognition error and survives blocked storage', () => {
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<Mic rooms label="Диктовать комнаты" onText={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Диктовать комнаты' }));
    get.mockRestore();
    act(() => { rec()?.fail('network'); });
    expect(toastText()).toContain('без интернета');
  });
});

describe('Rooms from a message or by voice', () => {
  it('adds rooms from pasted text and keeps what it could not read', () => {
    render(<App />);
    const lst = document.querySelector('.col-list') as HTMLElement;
    click(lst, '+ Добавить группу');
    click(lst, 'Из комнат');
    const d = dlg('Комнаты');
    click(d, 'Из сообщения клиента или голосом');
    const ta = byLabel(d, 'Комнаты и приборы текстом');
    change(ta, 'Кухня: плита 7 кВт, чайник 2200\nВанная: бойлер 2 кВт\nнепонятно');
    click(d, 'Добавить комнаты');
    expect(within(d).getByRole('status').textContent).toContain('Добавлено: 2 комнаты, 3 прибора');
    expect(within(d).getByRole('status').textContent).toContain('непонятно');
    expect(byLabel(d, 'Комнаты и приборы текстом').value).toBe('непонятно');
    expect(stored().list[0].rooms?.map((r: { name: string }) => r.name)).toEqual(['Кухня', 'Ванная']);
    change(byLabel(d, 'Комнаты и приборы текстом'), 'ничего');
    click(d, 'Добавить комнаты');
    expect(within(d).getByRole('status').textContent).toContain('Ничего не добавлено');
    fireEvent.click(within(d).getByRole('button', { name: 'Диктовать комнаты и приборы' }));
    act(() => { rec()?.say(['спальня люстра сто восемьдесят ватт', true]); });
    expect(byLabel(d, 'Комнаты и приборы текстом').value).toBe('ничего\nспальня: люстра 180 Вт');
    click(d, 'Скрыть ввод текстом');
    expect(d.querySelector('textarea')).toBeNull();
  });

  it('dictates appliances into the group list', () => {
    render(<App />);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    click(ed, 'Ещё действия');
    click(ed, 'Вставить список текстом');
    fireEvent.click(within(ed).getByRole('button', { name: 'Диктовать список приборов' }));
    act(() => { rec()?.say(['чайник две тысячи двести ватт', true]); });
    expect(byLabel(ed, 'Список приборов').value).toBe('чайник 2200 Вт');
    act(() => { rec()?.say(['фен тысяча восемьсот ватт', true]); });
    expect(byLabel(ed, 'Список приборов').value).toBe('чайник 2200 Вт, фен 1800 Вт');
  });
});
