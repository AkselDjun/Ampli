import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { PanelPane, shortName } from '../../ui/Side';
import { Schematic } from '../../ui/Schematic';
import { PrintDoc } from '../../ui/PrintDoc';
import { PassportBody } from '../../ui/Passport';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Cfg, Line, Project } from '../../core/types';
import { byLabel, change, click, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const zl = (l: Line, zone: string, o: Partial<Line> = {}): Line => ({ ...l, zone, ...o });
const lines = (): Line[] => [
  zl(mkLine('Свет', 'light', 10, null, null, [['Люстра', 200, 1]]), 'Комнаты'),
  zl(mkLine('Розетки', 'socket', 10, null, null, [['ТВ', 1500, 1]]), 'Комнаты', { where: 'Гостиная' }),
  zl(mkLine('Стиралка', 'power', 8, null, null, [['Стиральная машина', 2200, 1]]), 'Ванная', { wet: true })
];
const proj = (ls: Line[], cfg: Partial<Cfg> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), ...cfg }, lines: ls, sample: false }, 'Тест'), lines: ls });
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));

describe('panel board in RCD mode', () => {
  it('captions every module and explains the devices', () => {
    const p = proj(lines(), { prot: 'rcd' });
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    const caps = Array.from(document.querySelectorAll('.rail .dev-cap')).map(e => e.textContent);
    expect(caps).toEqual(['Ввод', 'Комнаты', 'Свет', 'Розет.', 'Ванная', 'Стир.']);
    expect(document.querySelectorAll('.rail .dev-uzo').length).toBe(2);
    const legend = document.querySelector('.legend') as HTMLElement;
    expect(legend.textContent).toContain('УЗО');
    expect(legend.textContent).not.toContain('Дифавтомат');
    const ex = document.querySelector('.explain') as HTMLElement;
    expect(ex.textContent).toContain('своя нулевая шина');
    expect(ex.textContent).toContain('Комнаты');
    expect(ex.textContent).toContain('Группы Г1, Г2');
    expect(ex.textContent).toContain('Ванная');
  });
  it('lists RCDs in the schedule tab with their own neutral bus', () => {
    const p = proj(lines(), { prot: 'rcd' });
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Состав' }));
    const sc = document.querySelector('.sc') as HTMLElement;
    expect(sc.textContent).toContain('своя шина N');
    expect(sc.textContent).toContain('Ванная');
    expect(sc.textContent).toContain('автомат');
  });
  it('explains residual-current breakers in the default mode', () => {
    const p = proj(lines());
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    expect(document.querySelector('.legend')?.textContent).toContain('Дифавтомат');
    expect(document.querySelector('.explain')?.textContent).toContain('Защищает свою группу');
    expect(document.querySelector('.rail .dev-uzo')).toBeNull();
  });
});

describe('single-line diagram', () => {
  it('draws an RCD per room with its own bus and the input cable brand', () => {
    const p = proj([...lines(), mkLine('Пустая', 'socket', 8, null, null, [])], { prot: 'rcd', inCable: 'nym' });
    render(<Schematic a={calcAll(p.lines, p.cfg)} />);
    const svg = document.querySelector('.schem') as SVGElement;
    expect(svg.textContent).toContain('УЗО: Комнаты');
    expect(svg.textContent).toContain('своя шина N, групп: 2');
    expect(svg.textContent).toContain('NYM 3×');
    expect(svg.textContent).not.toContain('Пустая');
  });
  it('draws residual-current breakers per group by default', () => {
    const p = proj(lines(), { supply: 3 });
    render(<Schematic a={calcAll(p.lines, p.cfg)} />);
    const svg = document.querySelector('.schem') as SVGElement;
    expect(svg.textContent).not.toContain('УЗО:');
    expect(svg.textContent).toContain('30 мА');
    expect(svg.textContent).toContain('ВВГнг(А)-LS 5×');
  });
});

describe('printed stickers and tags', () => {
  it('lays stickers out by board rows with a legend and reserve', () => {
    const p = proj(lines(), { prot: 'rcd' });
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="stickers" />);
    const rowsEl = document.querySelectorAll('.stk-row');
    expect(rowsEl.length).toBe(1);
    expect(document.querySelector('.stk-rn')?.textContent).toBe('Ряд 1');
    const legend = Array.from(document.querySelectorAll('.stk-legend .stk-k')).map(e => e.textContent);
    expect(legend).toEqual(['Ввод', 'УЗО', 'Свет', 'Розетки', 'Силовая']);
    expect(document.querySelectorAll('.stk-i.k-uzo').length).toBe(2);
    expect(document.querySelector('.stk-i.k-in .stk-nm')?.textContent).toBe('Вся квартира');
    expect(document.querySelector('.stk-free')?.textContent).toBe('резерв');
    expect(document.querySelectorAll('.stk-i svg').length).toBeGreaterThan(3);
  });
  it('wraps stickers to the next row when a row is full', () => {
    const many = Array.from({ length: 12 }, (_, i) => mkLine('Г' + i, 'light', 5, null, null, [['x', 100, 1]]));
    const p = proj(many);
    const a = calcAll(p.lines, p.cfg);
    render(<PrintDoc p={p} a={a} mode="stickers" />);
    expect(document.querySelectorAll('.stk-row').length).toBeGreaterThan(1);
  });
  it('prints cable tags without the protection device', () => {
    const p = proj(lines());
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="tags" />);
    const tags = Array.from(document.querySelectorAll('.tag'));
    expect(tags.length).toBe(6);
    const t = tags.map(e => e.textContent).join(' ');
    expect(t).not.toMatch(/Дифавтомат|мА/);
    expect(t).toContain('Гостиная');
    expect(t).toContain('кабель 10 м');
  });
});

describe('editor fields from the electricians', () => {
  const boot = () => {
    wide(true);
    render(<App />);
  };
  it('counts sockets and their load in a socket group', () => {
    boot();
    const r = rows().find(x => x.textContent?.includes('Розетки: комнаты')) as HTMLElement;
    fireEvent.click(r);
    const n = byLabel(ed(), 'Розеток в группе, шт');
    expect(n.value).toBe('8');
    change(n, '10');
    change(byLabel(ed(), 'Нагрузка на розетку, Вт'), '100');
    const l = stored().list[0].lines.find((x: Line) => x.name === 'Розетки: комнаты');
    expect(l.sockets).toBe('10');
    expect(l.perSocket).toBe('100');
  });
  it('edits branch length to the junction box for an appliance', () => {
    boot();
    fireEvent.click(rows()[0]);
    const br = ed().querySelectorAll<HTMLInputElement>('[aria-label="Отвод от коробки, м"]');
    expect(br.length).toBeGreaterThan(0);
    change(br[0], '4');
    expect(stored().list[0].lines[0].apps[0].br).toBe('4');
    expect(ed().textContent).toContain('Длина до распредкоробки');
  });
  it('asks for strip length and watts per metre for an LED strip', () => {
    boot();
    fireEvent.click(rows()[0]);
    click(ed(), /LED-лента/);
    const len = byLabel(ed(), 'Длина ленты, м');
    expect(len.value).toBe('5');
    change(len, '8');
    const led = stored().list[0].lines[0].apps.find((x: { name: string }) => /лент/i.test(x.name));
    expect(led.m).toBe('8');
    expect(byLabel(ed(), 'Мощность, Вт на метр')).toBeTruthy();
  });
  it('asks for the room of each group when protecting rooms with RCDs', () => {
    boot();
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    const d = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(x => x.querySelector('h2')?.textContent === 'Параметры сети') as HTMLElement;
    fireEvent.click(d.querySelector('input[name="prot"][value="rcd"]') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(rows()[0]);
    const zone = byLabel(ed(), 'Помещение для УЗО');
    expect(zone.value).toBe('Комнаты');
    const dl = document.getElementById(zone.getAttribute('list') as string) as HTMLElement;
    const opts = Array.from(dl.querySelectorAll('option')).map(o => o.getAttribute('value'));
    expect(opts).toContain('Кухня');
    expect(opts).toContain('Ванная');
    change(zone, 'Спальня');
    expect(stored().list[0].lines[0].zone).toBe('Спальня');
  });
});

describe('owner passport body', () => {
  it('shows owner details and the simultaneous-use warning when the breaker is smaller than the load', () => {
    const p = { ...proj([mkLine('Кухня', 'socket', 10, null, null, [['Духовка', 3500, 1], ['Чайник', 2200, 1]])]), address: 'ул. Ленина, 1', client: 'Иванов', author: 'Петров' };
    const a = calcAll(p.lines, p.cfg);
    a.rows[0].r.In = 16;
    render(<PassportBody p={p} a={a} />);
    const t = (document.querySelector('.pp') as HTMLElement).textContent;
    expect(t).toContain('Тест, ул. Ленина, 1');
    expect(t).toContain('Владелец: Иванов');
    expect(t).toContain('Исполнитель: Петров');
    expect(document.querySelector('.pp-warn')?.textContent).toContain('Духовка и Чайник');
  });
  it('omits empty owner details', () => {
    const p = { ...proj([mkLine('Свет', 'light', 10, null, null, [['Лампа', 60, 1]])]), name: '', address: '', client: '', author: '' };
    render(<PassportBody p={p} a={calcAll(p.lines, p.cfg)} />);
    const t = (document.querySelector('.pp') as HTMLElement).textContent;
    expect(t).toContain('Без названия');
    expect(t).not.toContain('Владелец');
    expect(document.querySelector('.pp-warn')).toBeNull();
  });
});

describe('short captions for single-module breakers', () => {
  it('abbreviates long first words on a consonant', () => {
    expect(shortName('Освещение')).toBe('Освещ.');
    expect(shortName('Розетки: кухня')).toBe('Розет.');
    expect(shortName('Кондиционер')).toBe('Конд.');
    expect(shortName('Стиральная машина')).toBe('Стир.');
    expect(shortName('Бойлер')).toBe('Бойлер');
    expect(shortName('Плита и духовка')).toBe('Плита');
    expect(shortName('')).toBe('');
  });
});

describe('usability pass', () => {
  it('shows a few preset chips with a toggle for the rest', () => {
    wide(true);
    render(<App />);
    const r = rows().find(x => x.textContent?.includes('Розетки: кухня')) as HTMLElement;
    fireEvent.click(r);
    const chipsEl = ed().querySelector('.chips:not(.often)') as HTMLElement;
    const count = () => chipsEl.querySelectorAll('.chip:not(.custom):not(.more)').length;
    expect(count()).toBe(6);
    expect(chipsEl.querySelector('.chip.custom')).toBe(chipsEl.firstElementChild);
    const more = chipsEl.querySelector('.chip.more') as HTMLElement;
    expect(more.textContent).toMatch(/^Ещё \d+$/);
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(count()).toBeGreaterThan(6);
    expect(more.textContent).toBe('Свернуть');
  });
  it('marks the group type with an icon and hidden text in the list', () => {
    wide(true);
    render(<App />);
    const ty = rows()[0].querySelector('.row-ty') as HTMLElement;
    expect(ty.dataset.t).toBe('light');
    expect(ty.querySelector('svg')).not.toBeNull();
    expect(ty.querySelector('.vh')?.textContent).toBe('Свет');
  });
  it('shows the group load under the current', () => {
    wide(true);
    render(<App />);
    fireEvent.click(rows()[0]);
    expect(ed().querySelector('.ed-res .tile small')?.textContent).toMatch(/^нагрузка 490\sВт$/);
  });
});
