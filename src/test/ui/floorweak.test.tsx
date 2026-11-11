import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PrintDoc } from '../../ui/PrintDoc';
import { calcAll } from '../../core/calc';
import { newProject, sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { newFloorRoom } from '../../core/floor';
import { KEY } from '../../store/storage';
import { byLabel, change, click, dlg, toastText, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const box = () => document.querySelector('.proj-box') as HTMLElement;

describe('floor heating sheet', () => {
  it('picks a product, checks it and writes it into a group', () => {
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: /^Тёплый пол ?: мат, кабель, плёнка$/ }));
    const d = dlg('Тёплый пол');
    expect(d.querySelector('.empty')).not.toBeNull();
    click(d, '+ Ванная');
    click(d, '+ Комната');
    const card = d.querySelectorAll<HTMLElement>('.fl-room')[0];
    expect(card.querySelector('.fl-wait')?.textContent).toContain('Введите свободную площадь');
    expect((within(card).getByLabelText('Мощность, Вт/м²') as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(within(card).getByLabelText('Свободная площадь, м²'), { target: { value: '0.3' } });
    expect(card.querySelector('.fl-wait')?.textContent).toContain('меньше самого маленького мата');
    fireEvent.change(within(card).getByLabelText('Свободная площадь, м²'), { target: { value: '3.2' } });
    expect(card.querySelector('.fl-prod')?.textContent).toBe('Нагревательный мат 150 Вт/м²3 м²');
    expect(card.textContent).toContain('ГОСТ 30331.11');
    expect(card.textContent).toContain('СН 4.04.01-2019 п.16.3.3');
    const target = within(card).getByLabelText('Записать в группу') as HTMLSelectElement;
    expect(target.value).toBe('new');
    fireEvent.click(within(card).getByRole('button', { name: 'Записать' }));
    expect(toastText()).toContain('Создана группа тёплого пола: 450 Вт');
    const ls = stored().list[0].lines;
    const nl = ls[ls.length - 1];
    expect(nl).toMatchObject({ name: 'Тёплый пол: Ванная', wet: true });
    expect((within(card).getByLabelText('Записать в группу') as HTMLSelectElement).value).toBe(nl.id);
    fireEvent.change(within(card).getByLabelText('Система'), { target: { value: 'cable' } });
    expect(card.textContent).toContain('Шаг укладки');
    fireEvent.click(within(card).getByRole('button', { name: 'Записать' }));
    expect(toastText()).toMatch(/^Записано в Г\d+: \d+ Вт/);
    fireEvent.change(within(card).getByLabelText('Система'), { target: { value: 'film' } });
    expect(card.querySelector('.ow-f.k-bad')?.textContent).toContain('Плёнку в ванной не применяют');
    const room = d.querySelectorAll<HTMLElement>('.fl-room')[1];
    change(byLabel(room, 'Название помещения'), 'Спальня');
    fireEvent.change(within(room).getByLabelText('Свободная площадь, м²'), { target: { value: '30' } });
    fireEvent.change(within(room).getByLabelText('Мощность, Вт/м²'), { target: { value: '220' } });
    expect(room.querySelector('.ow-f.k-warn')?.textContent).toContain('через контактор');
    fireEvent.change(within(room).getByLabelText('Записать в группу'), { target: { value: nl.id } });
    click(room, 'Удалить');
    click(room, 'Точно?');
    expect(stored().list[0].floor).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(box()).getByRole('button', { name: /^Тёплый пол ?: 1 помещение, \d+ Вт$/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = document.querySelector('dialog.pal input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'терморегулятор' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(dlg('Тёплый пол')).toBeTruthy();
  });

  it('adds the floor work to the estimate only when there is heating', () => {
    const p = { ...newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Розетки', 'socket', 5, [['Чайник', 2000, 1]])] }, 'Т'), floor: [{ ...newFloorRoom('kitchen'), area: 4 }] };
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    const rep = dlg('Отчёт и спецификация');
    fireEvent.click(within(rep).getByRole('tab', { name: 'Смета', hidden: true }));
    expect(byLabel(rep, 'Количество: Монтаж тёплого пола с терморегулятором').placeholder).toBe('4');
  });
});

describe('weak current sheet', () => {
  it('collects points, shows equipment and checks, and adds works', () => {
    wide(false);
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: /^Слаботочка ?: интернет, ТВ, камеры$/ }));
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
    expect(within(box()).getByRole('button', { name: /^Слаботочка ?: Интернет 2, ТВ 1, 50 м кабеля$/ })).toBeTruthy();
    click(document.querySelector('nav.tabs') as HTMLElement, /Отчёт/);
    const rep = dlg('Отчёт и спецификация');
    fireEvent.click(within(rep).getByRole('tab', { name: 'Смета', hidden: true }));
    expect(byLabel(rep, 'Количество: Установка слаботочной розетки').placeholder).toBe('3');
    expect(byLabel(rep, 'Количество: Прокладка слаботочного кабеля').placeholder).toBe('45');
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
  it('prints floor heating and weak current points', () => {
    const p = {
      ...sampleProject(),
      floor: [{ ...newFloorRoom('bath'), area: 3 }, { ...newFloorRoom('room', ''), area: 10 }, newFloorRoom('kitchen')],
      weak: { ont: false, pts: [{ id: 'a', room: 'Зал', kind: 'lan' as const, n: 2, len: 10 }, { id: 'b', room: '', kind: 'tv' as const, n: 3, len: '' }] }
    };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p)} />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).toContain('Тёплый пол');
    expect(t).toContain('Комната');
    expect(t).toContain('Инфракрасная плёнка 150 Вт/м², ширина 0,5 м, 20 м');
    expect(t).toContain('экраном, присоединённым к PE');
    expect(t).toContain('Терморегулятор с датчиком температуры пола, 16 А');
    expect(t).toContain('Теплоотражающая подложка под плёнку');
    expect(t).toContain('Слаботочные сети');
    expect(t).toContain('в щитке роутер, делитель TV на 3 выхода');
    expect(t).toContain('Розетка компьютерная RJ45 cat.5e');
  });

  it('skips the sections without data and mentions the terminal and switch', () => {
    const p = { ...sampleProject(), weak: { ont: true, pts: [{ id: 'a', room: 'Зал', kind: 'cam' as const, n: 1, len: 10 }] } };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p)} />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).not.toContain('Каждое помещение с отдельным терморегулятором');
    expect(t).toContain('оптический терминал провайдера и роутер, коммутатор на 5 портов с PoE');
  });
});

describe('arc fault devices in the interface', () => {
  it('turns on from the network sheet and shows on the board, list and report', () => {
    wide(true);
    render(<App />);
    fireEvent.click(within(box()).getByRole('button', { name: /^Параметры сети ?:/ }));
    const d = dlg('Параметры сети');
    fireEvent.click(d.querySelector('input[name="afdd"][value="sock"]') as HTMLInputElement);
    expect(stored().list[0].cfg.afdd).toBe('sock');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(box()).getByRole('button', { name: /^Параметры сети ?:/ }).textContent).toContain('УЗДП на розетки');
    const arcs = document.querySelectorAll('.rail .dev.arc');
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs[0].querySelector('.dev-arc')?.textContent).toBe('ДП');
    expect(Array.from(document.querySelectorAll('.legend > span')).map(s => s.textContent)).toContain('УЗДП');
    expect(document.querySelector('.bd-list')?.textContent).toContain('УЗДП с автоматом');
    fireEvent.click(within(box()).getByRole('button', { name: /^Параметры сети ?:/ }));
    fireEvent.click(dlg('Параметры сети').querySelector('input[name="afdd"][value="all"]') as HTMLInputElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(box()).getByRole('button', { name: /^Параметры сети ?:/ }).textContent).toContain('УЗДП на группы');
  });

  it('prints the arc fault protection in the report', () => {
    const p = { ...sampleProject(), cfg: { ...sampleProject().cfg, afdd: 'all' } };
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} />);
    const t = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(t).toContain('УЗДП на однофазные группы');
    const q = { ...sampleProject(), cfg: { ...sampleProject().cfg, afdd: 'sock' } };
    render(<PrintDoc p={q} a={calcAll(q.lines, q.cfg)} />);
    expect(document.querySelectorAll('.printdoc')[1].textContent).toContain('УЗДП на розеточные группы');
  });
});
