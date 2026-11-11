import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PanelMode } from '../../ui/PanelMode';
import { IncomingSheet } from '../../ui/IncomingSheet';
import { Sheet } from '../../ui/common';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { calcAll } from '../../core/calc';
import { defaultCfg, mkLine } from '../../core/templates';
import { newProject, sampleProject } from '../../core/project';
import { packProject, SHARE_PREFIX } from '../../core/share';
import type { Project } from '../../core/types';
import { byLabel, change, click, dlg, isOpen, wide, toastText } from '../ui/util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const lib = () => JSON.parse(localStorage.getItem(LIB_KEY) as string);
const ed = () => document.querySelector('.col-edit') as HTMLElement;
const list = () => document.querySelector('.col-list') as HTMLElement;
const nav = () => document.querySelector('nav.tabs') as HTMLElement;

const seed = (mut: (p: Project) => void) => {
  const p = sampleProject();
  mut(p);
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  return p;
};

afterEach(() => {
  window.location.hash = '';
});

describe('Sheet props', () => {
  it('renders full and tip only when asked', () => {
    const { rerender } = render(<Sheet open onClose={() => undefined} title="Т1">x</Sheet>);
    expect(dlg('Т1').querySelector('.tip')).toBeNull();
    rerender(<Sheet open onClose={() => undefined} title="Т1" tip="Подсказка!">x</Sheet>);
    expect(dlg('Т1').querySelector('.tip')).toBeTruthy();
    expect(within(dlg('Т1')).getByRole('tooltip', { hidden: true })).toHaveTextContent('Подсказка!');
  });
});

describe('PanelMode', () => {
  it('opens from the header and updates verdicts while typing', () => {
    render(<App />);
    expect(isOpen('На щитке')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Замеры на щитке' }));
    expect(isOpen('На щитке')).toBe(true);
    const d = dlg('На щитке');
    expect(d.querySelectorAll('button.pmb-dev').length).toBeGreaterThan(3);
    const first = d.querySelector('.pm') as HTMLElement;
    expect(first.querySelector('.no')?.textContent).toBe('Г1');
    expect(first.querySelector('.pill')?.textContent).toBe('Не измерено');
    expect(first.querySelector('.pm-note')?.textContent).toBe('');
    change(byLabel(d, 'Г1: Петля фаза-нуль, Ом'), '0.2');
    expect(first.querySelector('.pill')?.textContent).toBe('Соответствует');
    expect(first.querySelector('.pm-note')?.textContent).toContain('Ток КЗ');
    change(byLabel(d, 'Г1: Петля фаза-нуль, Ом'), '500');
    expect(first.querySelector('.pill')?.textContent).toBe('Не соответствует');
    expect(first).toHaveClass('bad');
    change(byLabel(d, 'Г1: Петля фаза-нуль, Ом'), '');
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
    expect(dlg('На щитке').querySelectorAll('.pmb-dev').length).toBe(0);
    expect(dlg('На щитке').querySelector('.pm')).toBeNull();
  });
  it('shows no cable name when the protection is missing', () => {
    const l = mkLine('Пустая', 'socket', 10, [['Чайник', 2200, 1]]);
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
    expect(dlg('Присланный проект').textContent).toContain('14 групп');
    rerender(<IncomingSheet project={{ ...p, address: '', lines: [p.lines[0]] }} onAccept={() => undefined} onDecline={() => undefined} />);
    expect(dlg('Присланный проект').textContent).toContain('1 группа');
    expect(dlg('Присланный проект').querySelector('p')?.textContent).toBe(p.name);
  });
});

describe('incoming project flow', () => {
  const hashFor = (name: string, address = '') => {
    const p = newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Кухня', 'socket', 10, [['Чайник', 2200, 1]])] }, name);
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
    expect(s.order).toHaveLength(2);
    expect(s.list[0].name).toBe('Пример: двухкомнатная квартира 2');
    expect(s.cur).toBe(s.order[1]);
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
    expect(toastText()).toBe('Ссылка скопирована');
    expect(d.querySelector('.share textarea')).toBeNull();
    act(() => { vi.advanceTimersByTime(4600); });
    expect(toastText()).toBe('');
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
    expect(toastText()).toContain('вручную');
    fail = false;
    await act(async () => { click(d, /Ссылка на проект/); });
    expect(d.querySelector('.share textarea')).toBeNull();
  });
  it('opens a message for Viber and Telegram that can be edited, copied and shared', async () => {
    const write = clip(() => Promise.resolve());
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<App />);
    const d = openProj();
    const btn = within(d).getByRole('button', { name: 'Отправить в Viber или Telegram' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const ta = within(d).getByLabelText('Текст сообщения') as HTMLTextAreaElement;
    expect(ta.value).toContain(SHARE_PREFIX + 'v1.');
    expect(ta.value).toContain('Откройте ссылку');
    const viber = d.querySelector('a.send-viber') as HTMLAnchorElement;
    expect(viber.getAttribute('href')).toMatch(/^viber:\/\/forward\?text=/);
    const tg = d.querySelector('a.send-tg') as HTMLAnchorElement;
    expect(tg.getAttribute('href')).toMatch(/^https:\/\/t\.me\/share\/url\?url=/);
    expect(tg.getAttribute('target')).toBe('_blank');
    fireEvent.change(ta, { target: { value: 'Привет' } });
    expect(decodeURIComponent(viber.getAttribute('href')!)).toBe('viber://forward?text=Привет');
    await act(async () => { click(d, 'Копировать текст'); });
    expect(write).toHaveBeenLastCalledWith('Привет');
    expect(toastText()).toBe('Текст скопирован');
    await act(async () => { click(d, 'Другое приложение'); });
    expect(share).toHaveBeenCalledWith({ text: 'Привет' });
    fireEvent.click(btn);
    expect(within(d).queryByLabelText('Текст сообщения')).toBeNull();
    delete (navigator as unknown as { share?: unknown }).share;
  });
  it('survives failed clipboard and share and hides the share button without support', async () => {
    clip(() => Promise.reject(new Error('no')));
    Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.reject(new Error('cancel'))), configurable: true });
    render(<App />);
    const d = openProj();
    fireEvent.click(within(d).getByRole('button', { name: 'Отправить в Viber или Telegram' }));
    await act(async () => { click(d, 'Копировать текст'); });
    expect(toastText()).toContain('вручную');
    await act(async () => { click(d, 'Другое приложение'); });
    delete (navigator as unknown as { share?: unknown }).share;
    fireEvent.click(within(d).getByRole('button', { name: 'Отправить в Viber или Telegram' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Отправить в Viber или Telegram' }));
    expect(within(d).queryByRole('button', { name: 'Другое приложение' })).toBeNull();
  });
  it('has no QR code button', () => {
    render(<App />);
    const d = openProj();
    expect(within(d).queryByRole('button', { name: 'QR-код' })).toBeNull();
    expect(d.querySelector('.qr')).toBeNull();
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
    fireEvent.click(within(ed().querySelector('.often') as HTMLElement).getByRole('button', { name: '+ LED-лента' }));
    fireEvent.click(chip('+ Люстра'));
    expect(chips()[0]).toBe('+ Светильник');
    expect(chips()).not.toContain('+ LED-лента');
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
  it('ignores appliances saved by older versions', () => {
    localStorage.setItem(LIB_KEY, JSON.stringify({ apps: [{ id: 'm1', name: 'Мой обогреватель', w: 25, tag: 'l' }] }));
    boot();
    change(search(), 'мой обогреватель');
    expect(ed().querySelector('.found')).toBeNull();
    expect(ed().querySelector('.chip-mine')).toBeNull();
  });
});

describe('Owner passport', () => {
  const clip = () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
    return (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> }).writeText;
  };

  it('stores the group room typed in the editor', () => {
    seed(() => undefined);
    render(<App />);
    change(ed().querySelector('input.ed-zone') as HTMLInputElement, 'Кухня и коридор');
    expect(stored().list[0].lines[0].zone).toBe('Кухня и коридор');
  });

  it('prints the passport with the location and no QR code', () => {
    seed(p => { p.lines[0].zone = 'Спальня'; });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<App />);
    click(nav(), /Приёмка/);
    click(dlg('Монтаж и приёмка'), 'Печать паспорта');
    const doc = document.querySelector('.printdoc') as HTMLElement;
    expect(doc.querySelector('h1')?.textContent).toBe('Паспорт электрощита');
    expect(doc.textContent).toContain('Спальня');
    expect(doc.querySelector('.pp-qr')).toBeNull();
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
    expect(within(d).queryByRole('button', { name: 'QR-код' })).toBeNull();
  });

  it('opens a read-only passport from an owner link and can hand the project over', () => {
    const p = sampleProject();
    p.lines[0].zone = 'Прихожая';
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

  it('sizes the breaker for all appliances at once and explains the test button for residual-current devices', () => {
    const p = sampleProject();
    p.lines = [mkLine('Кухня', 'socket', 10, [['Духовка', 3500, 1], ['Чайник', 2200, 1], ['Тостер', 900, 1]])];

    window.location.hash = '#o=' + packProject(p);
    render(<App />);
    const o = document.querySelector('.owner') as HTMLElement;
    expect(o.querySelector('.pp-warn')).toBeNull();
    expect(o.textContent).toContain('кнопка «Т»');
  });
});

describe('RCD trip time measurement', () => {
  it('is entered in panel mode and shows in the acceptance list', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Замеры на щитке' }));
    const d = dlg('На щитке');
    const first = d.querySelector('.pm') as HTMLElement;
    change(byLabel(d, 'Г1: Отключение УЗО, мс'), '28');
    expect(first.querySelector('.pill')?.textContent).toBe('Соответствует');
    expect(first.querySelector('.pm-note')?.textContent).toContain('УЗО до 500 мс');
    change(byLabel(d, 'Г1: Отключение УЗО, мс'), '700');
    expect(first.querySelector('.pill')?.textContent).toBe('Не соответствует');
    expect(stored().list[0].lines[0].meas.rcd).toBe('700');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: /Приёмка/ })[0]);
    const w = dlg('Монтаж и приёмка');
    fireEvent.click(within(w).getByRole('tab', { name: 'Замеры', hidden: true }));
    const row = w.querySelector('.ms-r') as HTMLElement;
    expect(row.querySelector('small')?.textContent).toBe('УЗО 700 / 500 мс');
    expect(row.querySelector('.pill')?.textContent).toBe('Не соответствует');
    fireEvent.click(within(w).getByRole('button', { name: 'Ввести на щитке', hidden: true }));
    expect(isOpen('На щитке')).toBe(true);
  });
});
