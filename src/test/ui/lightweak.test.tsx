import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PrintDoc } from '../../ui/PrintDoc';
import { calcAll } from '../../core/calc';
import { newProject, sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { newLightRoom } from '../../core/light';
import { KEY } from '../../store/storage';
import { byLabel, change, click, dlg, toastText, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const box = () => document.querySelector('.proj-box') as HTMLElement;

describe('lighting sheet', () => {
  it('counts fixtures for a room and writes them into a group', () => {
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: 'Освещение: сколько светильников' }));
    const d = dlg('Освещение');
    expect(d.querySelector('.empty')).not.toBeNull();
    click(d, '+ Кухня');
    click(d, '+ Детская');
    const card = d.querySelectorAll<HTMLElement>('.lt-room')[0];
    expect(card.querySelector('.lt-wait')).not.toBeNull();
    change(byLabel(card, 'Название помещения'), 'Кухня');
    fireEvent.change(within(card).getByLabelText('Длина, м'), { target: { value: '4' } });
    fireEvent.change(within(card).getByLabelText('Ширина, м'), { target: { value: '3' } });
    const n = Number(card.querySelector('.lt-n b')?.textContent);
    expect(n).toBeGreaterThan(0);
    expect(card.textContent).toContain('150 лк');
    const target = within(card).getByLabelText('Записать в группу') as HTMLSelectElement;
    expect(target.value).toBe(stored().list[0].lines[1].id);
    fireEvent.click(within(card).getByRole('button', { name: 'Записать' }));
    expect(toastText()).toContain('Записано в Г2: ' + n + ' × Точечный светильник LED 7 Вт');
    const apps = stored().list[0].lines[1].apps;
    expect(apps[apps.length - 1]).toMatchObject({ name: 'Точечный светильник LED 7 Вт (Кухня)', n, w: 7 });
    fireEvent.change(within(card).getByLabelText('Светильник'), { target: { value: 'own' } });
    fireEvent.change(within(card).getByLabelText('Мощность, Вт'), { target: { value: '12' } });
    fireEvent.change(within(card).getByLabelText('Световой поток, лм'), { target: { value: '1100' } });
    fireEvent.change(within(card).getByLabelText('Назначение'), { target: { value: 'bath' } });
    expect(card.textContent).toContain('IP44');
    fireEvent.change(target, { target: { value: 'new' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Записать' }));
    expect(toastText()).toContain('Создана группа освещения');
    const ls = stored().list[0].lines;
    expect(ls[ls.length - 1]).toMatchObject({ name: 'Освещение: Кухня', type: 'light', zone: 'Кухня' });
    const kids = d.querySelectorAll<HTMLElement>('.lt-room')[1];
    fireEvent.change(within(kids).getByLabelText('Длина, м'), { target: { value: '3' } });
    fireEvent.change(within(kids).getByLabelText('Ширина, м'), { target: { value: '3' } });
    expect(d.querySelector('.lt-sum')?.textContent).toMatch(/Всего на освещение по расчёту: \d+ Вт/);
    fireEvent.change(within(kids).getByLabelText('Назначение'), { target: { value: 'study' } });
    expect(kids.querySelector('.ow-pr')?.textContent).toBe('практика');
    click(kids, 'Удалить');
    click(kids, 'Точно?');
    expect(stored().list[0].light).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(box()).getByRole('button', { name: /^Освещение: 1 помещение, \d+ Вт$/ })).toBeTruthy();
  });

  it('opens from the group actions menu of a lighting group and from the palette', () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[0]);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    click(ed, /Ещё действия/);
    click(ed, 'Рассчитать светильники по площади');
    expect(dlg('Освещение')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[2]);
    click(ed, /Ещё действия/);
    expect(ed.textContent).not.toContain('Рассчитать светильники');
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = document.querySelector('dialog.pal input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'роутер' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(dlg('Слаботочка')).toBeTruthy();
  });

  it('defaults the target to a new group when there are no lighting groups', () => {
    const p = { ...newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Розетки', 'socket', 5, 1, 1, [['Чайник', 2000, 1]])] }, 'Т'), light: [{ ...newLightRoom('hall'), a: 2, b: 2 }] };
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: /^Освещение/ }));
    const d = dlg('Освещение');
    expect((within(d).getByLabelText('Записать в группу') as HTMLSelectElement).value).toBe('new');
  });
});

describe('weak current sheet', () => {
  it('collects points, shows equipment and checks, and adds works', () => {
    wide(false);
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: 'Слаботочка: интернет, ТВ, камеры' }));
    const d = dlg('Слаботочка');
    expect(d.querySelector('.empty')).not.toBeNull();
    click(d, '+ Интернет');
    const rows = () => Array.from(d.querySelectorAll<HTMLElement>('.wk-row[role="listitem"]'));
    change(byLabel(rows()[0], 'Помещение'), 'Гостиная');
    change(byLabel(rows()[0], 'Количество'), '2');
    change(byLabel(rows()[0], 'Длина от щитка, м'), '15');
    click(d, '+ ТВ');
    expect(byLabel(rows()[1], 'Помещение').value).toBe('Гостиная');
    change(byLabel(rows()[1], 'Длина от щитка, м'), '15');
    click(d, '+ Камера');
    change(byLabel(rows()[2], 'Длина от щитка, м'), '100');
    fireEvent.change(byLabel(rows()[2], 'Что подключаем'), { target: { value: 'door' } });
    fireEvent.change(byLabel(rows()[2], 'Что подключаем'), { target: { value: 'cam' } });
    expect(d.querySelector('.wk-head .pill')).toHaveClass('bad');
    expect(d.querySelector('.ow-f.k-bad')?.textContent).toContain('длиннее 90 м');
    change(byLabel(rows()[2], 'Длина от щитка, м'), '');
    expect(d.querySelector('.wk-head .pill')).toHaveClass('warn');
    change(byLabel(rows()[2], 'Длина от щитка, м'), '20');
    expect(d.querySelector('.wk-head .pill')).toHaveClass('ok');
    expect(d.querySelector('.wk-head')?.textContent).toContain('4 точки');
    const spec = Array.from(d.querySelectorAll('.wk-spec li span')).map(s => s.textContent);
    expect(spec).toContain('Коммутатор 5 портов PoE');
    expect(spec).toContain('Розетка компьютерная RJ45 cat.5e');
    fireEvent.click(screen.getByLabelText('Оптический терминал провайдера в слаботочном щитке'));
    expect(stored().list[0].weak.ont).toBe(false);
    expect(d.querySelector('.wk-spec li small')?.textContent).not.toContain('оптический терминал');
    click(rows()[2], 'Удалить точку');
    expect(rows()).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(box()).getByRole('button', { name: 'Слаботочка: Интернет 2, ТВ 1, 50 м кабеля' })).toBeTruthy();
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    const rep = dlg('Отчёт и спецификация');
    fireEvent.click(within(rep).getByRole('tab', { name: 'Смета', hidden: true }));
    expect(byLabel(rep, 'Количество: Установка слаботочной розетки').placeholder).toBe('3');
    expect(byLabel(rep, 'Количество: Прокладка слаботочного кабеля').placeholder).toBe('50');
  });

  it('hides weak current works when there are no points', () => {
    render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    const rep = dlg('Отчёт и спецификация');
    fireEvent.click(within(rep).getByRole('tab', { name: 'Смета', hidden: true }));
    expect(rep.querySelector('[aria-label="Количество: Установка слаботочной розетки"]')).toBeNull();
    act(() => undefined);
  });
});

describe('report sections', () => {
  it('prints lighting rooms and weak current points', () => {
    const p = {
      ...sampleProject(),
      light: [{ ...newLightRoom('living', 'Зал'), a: 5, b: 4 }, { ...newLightRoom('study', ''), a: 3, b: 3 }, newLightRoom('hall')],
      weak: { ont: false, pts: [{ id: 'a', room: 'Зал', kind: 'lan' as const, n: 2, len: 10 }, { id: 'b', room: '', kind: 'tv' as const, n: 3, len: '' }] }
    };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p.weak)} />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).toContain('Освещение помещений');
    expect(t).toContain('Кабинет');
    expect(t).toContain('300*');
    expect(t).toContain('значение по практике');
    expect(t).toContain('Слаботочные сети');
    expect(t).toContain('в щитке роутер, делитель TV на 3 выхода');
    expect(t).toContain('Розетка компьютерная RJ45 cat.5e');
  });

  it('skips the sections without data and mentions the terminal and switch', () => {
    const p = { ...sampleProject(), weak: { ont: true, pts: [{ id: 'a', room: 'Зал', kind: 'cam' as const, n: 1, len: 10 }] } };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p.weak)} />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).not.toContain('Освещение помещений');
    expect(t).toContain('оптический терминал провайдера и роутер, коммутатор на 5 портов с PoE');
  });
});
