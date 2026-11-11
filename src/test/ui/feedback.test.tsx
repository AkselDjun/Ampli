import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { PanelPane, shortName } from '../../ui/Side';
import { Schematic } from '../../ui/Schematic';
import { PrintDoc } from '../../ui/PrintDoc';
import { PassportBody } from '../../ui/Passport';
import { PanelMode } from '../../ui/PanelMode';
import { Totals, allocState } from '../../ui/Totals';
import { WorkSheet } from '../../ui/WorkSheet';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Cfg, Line, Project } from '../../core/types';
import { byLabel, change, click, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const zl = (l: Line, zone: string, o: Partial<Line> = {}): Line => ({ ...l, zone, ...o });
const lines = (): Line[] => [
  zl(mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), 'Комнаты'),
  zl(mkLine('Розетки', 'socket', 10, [['ТВ', 1500, 1]]), 'Комнаты'),
  zl(mkLine('Стиралка', 'power', 8, [['Стиральная машина', 2200, 1]]), 'Ванная', { wet: true })
];
const proj = (ls: Line[], cfg: Partial<Cfg> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), prot: 'rcbo', ...cfg }, lines: ls, sample: false }, 'Тест'), lines: ls });
const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));

describe('panel board in RCD mode', () => {
  it('captions every module and has no device glossary', () => {
    const p = proj(lines(), { prot: 'rcd' });
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    const caps = Array.from(document.querySelectorAll('.rail .dev-cap')).map(e => e.textContent);
    expect(caps).toEqual(['Ввод', 'Комнаты', 'Свет', 'Розет.', 'Ванная', 'Стир.']);
    expect(document.querySelectorAll('.rail .dev-uzo').length).toBe(2);
    const legend = document.querySelector('.legend') as HTMLElement;
    expect(legend.textContent).toContain('УЗО');
    expect(legend.textContent).not.toContain('Дифавтомат');
    expect(document.querySelector('.explain')).toBeNull();
    const list = document.querySelector('.bd-list') as HTMLElement;
    expect(list.textContent).toContain('УЗО: Комнаты');
    expect(list.textContent).toContain('Г1, Г2');
  });
  it('lists RCDs with their own neutral bus and indents their breakers', () => {
    const p = proj(lines(), { prot: 'rcd' });
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    const sc = document.querySelector('.bd-list') as HTMLElement;
    expect(sc.textContent).toContain('своя шина N');
    expect(sc.textContent).toContain('УЗО: Ванная');
    expect(sc.querySelectorAll('.bd-r.sub').length).toBe(3);
    expect(sc.querySelector('.bd-r.sub .bd-sub')?.textContent).toBe('автомат, 1,5 мм²');
  });
  it('shows group types in the legend in the default mode', () => {
    const p = proj(lines());
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    expect(document.querySelector('.legend')?.textContent).toContain('Свет');
    expect(document.querySelector('.legend')?.textContent).not.toContain('Дифавтомат');
    expect(document.querySelector('.rail .dev-uzo')).toBeNull();
  });
});

describe('single-line diagram', () => {
  it('draws an RCD per room with its own bus and the input cable brand', () => {
    const p = proj([...lines(), mkLine('Пустая', 'socket', 8, [])], { prot: 'rcd', inCable: 'nym' });
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
    expect(rowsEl.length).toBe(2);
    expect(Array.from(document.querySelectorAll('.stk-rn')).map(e => e.textContent)).toEqual(['Ряд 1, часть 1 из 2', 'Ряд 1, часть 2 из 2']);
    rowsEl.forEach(r => expect(parseFloat((r as HTMLElement).style.width)).toBeLessThanOrEqual(175));
    const legend = Array.from(document.querySelectorAll('.stk-legend .stk-k')).map(e => e.textContent);
    expect(legend).toEqual(['Ввод', 'УЗО', 'Свет', 'Розетки', 'Силовая']);
    expect(document.querySelectorAll('.stk-i.k-uzo').length).toBe(2);
    expect(document.querySelector('.stk-i.k-in .stk-nm')?.textContent).toBe('Вся квартира');
    expect(document.querySelector('.stk-free')?.textContent).toBe('резерв');
    expect(document.querySelectorAll('.stk-i svg').length).toBeGreaterThan(3);
  });
  it('wraps stickers to the next row when a row is full', () => {
    const many = Array.from({ length: 12 }, (_, i) => mkLine('Г' + i, 'light', 5, [['x', 100, 1]]));
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
    expect(t).toContain('Комнаты');
    expect(t).toContain('до дальней точки 10 м');
  });
});

describe('editor fields from the electricians', () => {
  const boot = () => {
    wide(true);
    render(<App />);
  };
  it('counts sockets and their load in a socket group', () => {
    boot();
    const r = rows().find(x => x.textContent?.includes('Розетки: гостиная')) as HTMLElement;
    fireEvent.click(r);
    const n = byLabel(ed(), 'Розеток в группе, шт');
    expect(n.value).toBe('8');
    change(n, '10');
    change(byLabel(ed(), 'Нагрузка на розетку, Вт'), '100');
    const l = stored().list[0].lines.find((x: Line) => x.name === 'Розетки: гостиная');
    expect(l.sockets).toBe('10');
    expect(l.perSocket).toBe('100');
  });
  it('edits branch length to the junction box for an appliance', () => {
    boot();
    fireEvent.click(rows()[2]);
    expect(ed().querySelectorAll('[aria-label="Отвод от коробки, м"]').length).toBe(0);
    click(ed(), /Ещё действия/);
    click(ed(), 'Указать отводы к точкам');
    const br = ed().querySelectorAll<HTMLInputElement>('[aria-label="Отвод от коробки, м"]');
    expect(br.length).toBeGreaterThan(0);
    change(br[0], '4');
    expect(stored().list[0].lines[2].apps[0].br).toBe('4');
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
    expect(d.querySelector('input[name="box"]')?.closest('.seg')?.getAttribute('data-n')).toBe('4');
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
    const p = { ...proj([mkLine('Кухня', 'socket', 10, [['Духовка', 3500, 1], ['Чайник', 2200, 1]])]), address: 'ул. Ленина, 1', client: 'Иванов', author: 'Петров' };
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
    const p = { ...proj([mkLine('Свет', 'light', 10, [['Лампа', 60, 1]])]), name: '', address: '', client: '', author: '' };
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
    expect(ed().querySelector('.ed-res .tile small')?.textContent).toMatch(/^нагрузка 203\sВт$/);
  });
});

describe('panel mode as a real board', () => {
  const mk = (cfg: Partial<Cfg> = {}) => {
    const ls = lines();
    ls[0].meas = { zs: '0.2' };
    const p = proj(ls, cfg);
    const dispatch = vi.fn();
    render(<PanelMode open onClose={() => undefined} a={calcAll(p.lines, p.cfg)} dispatch={dispatch} />);
    return { ls, dispatch, d: document.querySelector('.sheet-panel') as HTMLElement };
  };
  it('draws breakers on rails with verdict levers and opens the first unmeasured group', () => {
    const { d } = mk();
    const devs = Array.from(d.querySelectorAll<HTMLElement>('button.pmb-dev'));
    expect(devs.length).toBe(3);
    expect(devs[0].querySelector('.pmb-lever')).toHaveClass('v-ok');
    expect(devs[1].querySelector('.pmb-lever')).toHaveClass('v-none');
    expect(devs[1]).toHaveAttribute('aria-pressed', 'true');
    expect(devs[0].querySelector('.pmb-strip')?.textContent).toContain('Г1');
    expect(d.querySelector('.pmb-dev.k-in')?.textContent).toContain('Ввод');
    expect(d.querySelectorAll('.pmb-free').length).toBeGreaterThan(0);
    expect(d.querySelector('.pmb-top')?.textContent).toContain('1 из 3 групп измерено');
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г2');
    expect(d.querySelector('.pm-prot')?.textContent).toContain('Комнаты');
    expect(byLabel(d, 'Г2: Изоляция, МОм').placeholder).toBe('от 0,5');
    expect(byLabel(d, 'Г2: Отключение УЗО, мс').placeholder).toBe('до 500');
    expect(byLabel(d, 'Г2: Петля фаза-нуль, Ом').placeholder).toMatch(/^до \d+,\d{2}$/);
    expect(byLabel(d, 'Г2: Утечка, мА').placeholder).toBe('до 10,0');
  });
  it('switches groups by tapping a breaker and with the next and back buttons', () => {
    const { d, ls, dispatch } = mk();
    fireEvent.click(d.querySelectorAll<HTMLElement>('button.pmb-dev')[0]);
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г1');
    const back = screen.getByRole('button', { name: /Назад/ });
    expect(back).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Дальше: Г2/ }));
    fireEvent.click(screen.getByRole('button', { name: /Дальше: Г3/ }));
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г3');
    expect(screen.getByRole('button', { name: /Последняя группа/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /← Г2/ }));
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г2');
    change(byLabel(d, 'Г2: Изоляция, МОм'), '5');
    expect(dispatch).toHaveBeenCalledWith({ t: 'lineMeasAt', id: ls[1].id, field: 'ins', value: '5' });
  });
  it('shows RCDs per room as fixed modules', () => {
    const { d } = mk({ prot: 'rcd' });
    const uzo = Array.from(d.querySelectorAll('.pmb-dev.k-uzo'));
    expect(uzo.length).toBe(2);
    expect(uzo[0].tagName).toBe('DIV');
    expect(uzo[0].textContent).toContain('Комнаты');
    expect(d.querySelectorAll('button.pmb-dev.k-mcb').length).toBe(3);
  });
  it('wraps a long board onto several rails with blank plates', () => {
    const many = Array.from({ length: 14 }, (_, i) => mkLine('Группа ' + i, 'light', 5, [['x', 100, 1]]));
    const p = proj(many);
    render(<PanelMode open onClose={() => undefined} a={calcAll(p.lines, p.cfg)} dispatch={vi.fn()} />);
    expect(document.querySelectorAll('button.pmb-dev').length).toBe(14);
    expect(document.querySelectorAll('.pmb-free').length).toBeGreaterThan(0);
  });
});

describe('apartment totals in the header', () => {
  it('shows load against the allocation and opens the details', () => {
    wide(true);
    render(<App />);
    const b = screen.getByRole('button', { name: /^Итого по квартире/ });
    expect(b).toHaveClass('st-ok');
    expect(b.textContent).toContain('/12');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(b);
    const pop = document.getElementById('tot-pop') as HTMLElement;
    expect(pop.textContent).toContain('Укладывается');
    expect(pop.textContent).toContain('Установлено');
    expect(pop.textContent).toContain('2P C50');
    expect(pop.textContent).toContain('ВВГнг(А)-LS 3×');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('tot-pop')).toBeNull();
    fireEvent.click(b);
    fireEvent.pointerDown(document.body);
    expect(document.getElementById('tot-pop')).toBeNull();
    fireEvent.click(b);
    fireEvent.pointerDown(document.getElementById('tot-pop') as HTMLElement);
    expect(document.getElementById('tot-pop')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить выделенную мощность' }));
    expect(document.getElementById('tot-pop')).toBeNull();
    const net = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(x => x.querySelector('h2')?.textContent === 'Параметры сети') as HTMLElement;
    expect((net.parentElement as HTMLElement).hidden).toBe(false);
  });
  it('rates the allocation for empty, normal, high and exceeded loads', () => {
    const mk = (w: number, alloc = 15, supply = 1) => calcAll(w ? [mkLine('A', 'power', 5, [['x', w, 1]])] : [], { ...defaultCfg(), alloc, supply });
    expect(allocState(mk(0))).toEqual({ pct: 0, k: 'ok', text: 'Нет нагрузки' });
    expect(allocState(mk(2000)).k).toBe('ok');
    expect(allocState(mk(2000)).text).toBe('Укладывается');
    expect(allocState(mk(13000, 10, 3)).k).toBe('warn');
    const bad = allocState(mk(20000, 10, 3));
    expect(bad.k).toBe('bad');
    expect(bad.text).toMatch(/^Превышение на \d+,\d кВт$/);
  });
  it('labels the phase current and dashes for an empty project', () => {
    const a = calcAll([], { ...defaultCfg(), supply: 3 });
    render(<Totals a={a} onNet={() => undefined} />);
    const b = screen.getByRole('button', { name: /^Итого по квартире/ });
    expect(b.textContent).toContain('Фаза');
    expect(b.textContent).toContain('—');
    fireEvent.click(b);
    expect(document.getElementById('tot-pop')?.textContent).toContain('Макс. фаза');
    expect(document.getElementById('tot-pop')?.textContent).toContain('Нет нагрузки');
  });
});

describe('norm checks in the header', () => {
  it('shows the sample as compliant and opens the list, with no checks block in the side column', () => {
    wide(true);
    render(<App />);
    const b = screen.getByRole('button', { name: /^Проверки по нормам/ });
    expect(b).toHaveClass('st-ok');
    expect(b.querySelector('.chk-n')).toBeNull();
    expect(document.querySelector('.c-checks')).toBeNull();
    fireEvent.click(b);
    expect(document.getElementById('chk-pop')?.textContent).toContain('Тип ввода соответствует нагрузке');
    fireEvent.pointerDown(document.body);
    expect(document.getElementById('chk-pop')).toBeNull();
  });
});

describe('compact estimate and measurements', () => {
  it('lists measured values per group and summarises protocol data', () => {
    const ls = lines();
    ls[0].meas = { zs: '0.2', ins: '50', leak: '1' };
    const p = { ...proj(ls), proto: { date: '', by: 'Иванов', device: '' } };
    const board = vi.fn();
    render(<WorkSheet open onClose={() => undefined} p={p} a={calcAll(p.lines, p.cfg)} dispatch={vi.fn()} onPrint={vi.fn()} onBoard={board} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Замеры' }));
    const rowsEl = document.querySelectorAll('.ms-r');
    expect(rowsEl.length).toBe(3);
    expect(rowsEl[0].querySelector('small')?.textContent).toMatch(/^петля 0,20 Ом, ток КЗ [\d\s]+ А из нужных \d+ А · изоляция 50,00 МОм · утечка 1,0 \/ 10,0 мА$/);
    expect(rowsEl[1].querySelector('small')?.textContent).toBe('Розетки');
    expect(document.querySelector('.proto-d summary')?.textContent).toBe('Данные протокола: Иванов');
    fireEvent.click(screen.getByRole('button', { name: 'Ввести на щитке' }));
    expect(board).toHaveBeenCalled();
  });
  it('gives price fields a placeholder and keeps the totals in the estimate tab', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Отчёт/ })[0]);
    fireEvent.click(screen.getByRole('tab', { name: 'Смета' }));
    const inp = document.querySelector('.spec-t .price-in') as HTMLInputElement;
    expect(inp.placeholder).toBe('цена');
    expect(document.querySelector('#rep-tp-estimate .tot')).toBeTruthy();
  });
});

describe('keyboard', () => {
  it('copies with Ctrl+D and deletes with Delete on a focused group row, row buttons stay out of Tab', () => {
    wide(true);
    render(<App />);
    const n = rows().length;
    expect(rows()[0].getAttribute('aria-keyshortcuts')).toBe('Control+D Delete');
    document.querySelectorAll('.ra-b').forEach(b => expect(b.getAttribute('tabindex')).toBe('-1'));
    fireEvent.keyDown(rows()[1], { key: 'd', ctrlKey: true });
    expect(rows().length).toBe(n + 1);
    fireEvent.keyDown(rows()[1], { key: 'в', metaKey: true });
    expect(rows().length).toBe(n + 2);
    fireEvent.keyDown(rows()[1], { key: 'Delete' });
    expect(rows().length).toBe(n + 1);
    fireEvent.keyDown(rows()[1], { key: 'x' });
    expect(rows().length).toBe(n + 1);
  });
  it('offers skip links to the list and the editor', () => {
    wide(true);
    render(<App />);
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('nav.skip a'));
    expect(links.map(a => a.getAttribute('href'))).toEqual(['#groups', '#editor']);
    expect(document.getElementById('groups')?.getAttribute('tabindex')).toBe('-1');
    expect(document.getElementById('editor')?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('small window fixes', () => {
  it('splits the exchange tab into explained sections', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Проекты:/ }));
    const d = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(x => x.querySelector('h2')?.textContent === 'Проекты') as HTMLElement;
    const share = d.querySelector('#pj-tp-share') as HTMLElement;
    expect(Array.from(share.querySelectorAll('h3')).map(h => h.textContent)).toEqual(['Перенести на другое устройство', 'Резервная копия', 'Шаблон', 'Мои данные']);
    expect(share.querySelectorAll('p.muted').length).toBeGreaterThanOrEqual(3);
  });
  it('keeps one primary action on the documents tab of acceptance', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Приёмка/ })[0]);
    const d = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(x => x.querySelector('h2')?.textContent === 'Монтаж и приёмка') as HTMLElement;
    expect(d.querySelectorAll('#wk-tp-docs .btn.primary').length).toBe(1);
  });
});
