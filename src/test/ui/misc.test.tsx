import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { App } from '../../ui/App';
import { KEY } from '../../store/storage';
import { LIB_KEY } from '../../store/lib';
import { byLabel, change, click, dlg, isOpen, wide } from './util';
import { fitSize, scaleLogo, LOGO_MAX_H, LOGO_MAX_W } from '../../ui/logo';
import { Brand, IconBack } from '../../ui/Icons';

vi.setConfig({ testTimeout: 60000 });

const list = () => document.querySelector('.col-list') as HTMLElement;
const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);
const lib = () => JSON.parse(localStorage.getItem(LIB_KEY) as string);

describe('WorkSheet', () => {
  it('toggles checklist, edits protocol and prints in three modes', () => {
    vi.useFakeTimers();
    render(<App />);
    click(nav(), /Приёмка/);
    const d = dlg('Монтаж и приёмка');
    const boxes = d.querySelectorAll<HTMLInputElement>('.ck input');
    expect(boxes.length).toBeGreaterThan(3);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(stored().list[0].checks).toBeTruthy();
    expect(d.querySelector('.wk-prog')?.textContent).toContain('2 из');
    fireEvent.click(boxes[1]);
    change(d.querySelector('#pDate') as HTMLElement, '2026-03-04');
    change(d.querySelector('#pBy') as HTMLElement, 'Иванов');
    change(d.querySelector('#pDev') as HTMLElement, 'MI-3152');
    expect(stored().list[0].proto.by).toBe('Иванов');
    click(d, 'Печать протокола');
    act(() => { vi.advanceTimersByTime(60); });
    expect(document.querySelector('.printdoc')?.textContent).toContain('MI-3152');
    expect(document.querySelector('.printdoc')?.textContent).toContain('☑');
    click(d, 'Наклейки щитка');
    expect(document.querySelectorAll('.stk-i').length).toBeGreaterThan(2);
    click(d, 'Бирки кабелей');
    expect(document.querySelectorAll('.tag').length).toBeGreaterThan(2);
    act(() => { vi.advanceTimersByTime(60); });
  });

  it('fills measurements and shows verdicts in table and print', () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[0]);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    change(byLabel(ed, 'Длина линии, м'), '10');
    change(byLabel(ed, 'Замер петли фаза-нуль, Ом'), '0.5');
    change(byLabel(ed, 'Замер сопротивления изоляции, МОм'), '200');
    change(byLabel(ed, 'Замер тока утечки, мА'), '1');
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[1]);
    change(byLabel(ed, 'Замер петли фаза-нуль, Ом'), '50');
    change(byLabel(ed, 'Замер сопротивления изоляции, МОм'), '0.1');
    change(byLabel(ed, 'Замер тока утечки, мА'), '30');
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[2]);
    change(byLabel(ed, 'Замер петли фаза-нуль, Ом'), '0.9');
    click(nav(), /Приёмка/);
    const d = dlg('Монтаж и приёмка');
    expect(d.querySelectorAll('.pill.ok').length).toBeGreaterThan(0);
    expect(d.querySelectorAll('.pill.bad, .pill.warn').length).toBeGreaterThan(0);
    expect(document.querySelector('.printdoc')?.textContent).toContain('Протокол замеров');
  });
});

describe('CompareSheet', () => {
  it('toggles exclusions and add-ons and resets', () => {
    render(<App />);
    click(nav(), /Отчёт/);
    click(dlg('Отчёт и спецификация'), 'Сравнить варианты');
    const d = dlg('Сравнение вариантов');
    const reset = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Сбросить') as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    const boxes = d.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[0]);
    expect(reset.disabled).toBe(false);
    expect(d.querySelector('.cmp.better, .cmp.worse')).toBeTruthy();
    fireEvent.click(boxes[boxes.length - 1]);
    fireEvent.click(boxes[boxes.length - 2]);
    fireEvent.click(boxes[boxes.length - 3]);
    fireEvent.click(boxes[boxes.length - 4]);
    fireEvent.click(boxes[boxes.length - 5]);
    expect(d.textContent).toContain('12 кВт');
    fireEvent.click(reset);
    expect(reset.disabled).toBe(true);
    expect(boxes[0].checked).toBe(false);
  });
});

describe('RoomsSheet', () => {
  it('adds rooms, edits apps and assembles groups', () => {
    render(<App />);
    click(list(), 'Из комнат');
    const d = dlg('Комнаты');
    const asm = () => Array.from(d.querySelectorAll('.copy-row .btn'))[0] as HTMLButtonElement;
    expect(asm().disabled).toBe(true);
    expect(d.textContent).toContain('Комнат пока нет');
    const presets = d.querySelectorAll<HTMLElement>('.room-add .chip');
    expect(presets.length).toBeGreaterThan(2);
    fireEvent.click(presets[0]);
    fireEvent.click(presets[1]);
    fireEvent.click(presets[presets.length - 1]);
    const rooms = d.querySelectorAll('.room');
    expect(rooms.length).toBe(3);
    const r = rooms[0] as HTMLElement;
    change(byLabel(r, 'Название комнаты'), 'Зал');
    const sel = r.querySelector('.room-tools select') as HTMLSelectElement;
    change(sel, '0');
    change(sel, '18');
    change(sel, '19');
    change(sel, '9');
    change(sel, '4');
    change(sel, '');
    fireEvent.click(Array.from(r.querySelectorAll('.room-tools button')).find(b => b.textContent === '+ Свой прибор') as HTMLElement);
    const apps = r.querySelectorAll('.room-app');
    expect(apps.length).toBeGreaterThan(3);
    const a = apps[apps.length - 1] as HTMLElement;
    change(byLabel(a, 'Название прибора'), 'Лампа');
    change(byLabel(a, 'Мощность, Вт'), '100');
    change(byLabel(a, 'Количество'), '2');
    change(byLabel(a, 'Тип нагрузки'), 'l');
    fireEvent.click(byLabel(apps[0] as HTMLElement, 'Удалить прибор'));
    expect(asm().disabled).toBe(false);
    click(d, 'Удалить');
    click(d, 'Точно?');
    expect(d.querySelectorAll('.room').length).toBe(2);
    click(d, /Собрать группы/);
    click(d, 'Заменить текущие группы?');
    expect(isOpen('Комнаты')).toBe(false);
    expect(stored().list[0].lines.length).toBeGreaterThan(0);
  });
});

describe('LibSheet', () => {
  const openLib = () => {
    click(list(), 'Проекты');
    click(dlg('Проекты'), 'Мои данные');
    return dlg('Мои данные');
  };

  it('shows empty states and edits brand, with price clearing disabled', () => {
    render(<App />);
    const d = openLib();
    expect(d.textContent).toContain('Логотип не загружен');
    const clear = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Очистить все цены') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    change(d.querySelector('#bCo') as HTMLElement, 'ООО Ампер');
    change(d.querySelector('#bCt') as HTMLElement, '+375');
    change(d.querySelector('#bSg') as HTMLElement, 'Сидоров');
    expect(lib().brand.company).toBe('ООО Ампер');
    expect(d.textContent).toContain('Пока пусто');
  });

  it('manages apps, templates and prices', () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[0]);
    click(document.querySelector('.col-edit') as HTMLElement, 'Сохранить приборы группы в мои');
    click(list(), 'Проекты');
    const pj = dlg('Проекты');
    click(pj, 'Сохранить как шаблон');
    click(pj, 'Мои данные');
    const d = dlg('Мои данные');
    const n = d.querySelectorAll('.lib-r').length;
    expect(n).toBeGreaterThan(1);
    fireEvent.click(d.querySelector('.lib-r .icon-btn') as HTMLElement);
    click(d, 'Удалить');
    click(d, 'Точно?');
    expect(lib().templates.length).toBe(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    click(nav(), /Отчёт/);
    change(dlg('Отчёт и спецификация').querySelector('.price-in') as HTMLElement, '5');
    fireEvent.keyDown(document, { key: 'Escape' });
    click(list(), 'Проекты');
    click(pj, 'Мои данные');
    expect(d.textContent).toContain('1 позиция');
    click(d, 'Очистить все цены');
    click(d, 'Точно очистить?');
    expect(lib().prices).toEqual({});
  });

  it('uploads, replaces and removes a logo', async () => {
    class FR {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result = 'data:image/png;base64,AAAA';
      readAsDataURL() { setTimeout(() => this.onload?.(), 0); }
    }
    class Img {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 480;
      naturalHeight = 100;
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
    }
    vi.stubGlobal('FileReader', FR);
    vi.stubGlobal('Image', Img);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBBB');
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    render(<App />);
    click(list(), 'Проекты');
    click(dlg('Проекты'), 'Мои данные');
    const d = dlg('Мои данные');
    click(d, 'Загрузить логотип');
    const input = d.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'l.png', { type: 'image/png' })] } });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(lib().brand.logo).toBe('data:image/png;base64,BBBB');
    expect(d.querySelector('img.logo-img')).toBeTruthy();
    expect(document.querySelector('.printdoc .pd-brand img')).toBeTruthy();
    click(d, 'Заменить логотип');
    fireEvent.change(input, { target: { files: [new File(['x'], 'l.txt', { type: 'text/plain' })] } });
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(d.querySelector('[role="status"]')?.textContent).toContain('Не удалось');
    fireEvent.change(input, { target: { files: [] } });
    click(d, 'Убрать');
    expect(lib().brand.logo).toBe('');
    vi.unstubAllGlobals();
  });
});

describe('logo', () => {
  it('fits sizes', () => {
    expect(fitSize(0, 5)).toEqual({ w: 0, h: 0 });
    expect(fitSize(5, -1)).toEqual({ w: 0, h: 0 });
    expect(fitSize(100, 50)).toEqual({ w: 100, h: 50 });
    expect(fitSize(480, 100)).toEqual({ w: LOGO_MAX_W, h: 50 });
    expect(fitSize(100, 600)).toEqual({ w: 20, h: LOGO_MAX_H });
    expect(fitSize(10000, 1)).toEqual({ w: LOGO_MAX_W, h: 1 });
  });

  const stub = (opts: { frErr?: boolean; imgErr?: boolean; ctx?: boolean }) => {
    class FR {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result = 'data:x';
      readAsDataURL() { setTimeout(() => (opts.frErr ? this.onerror?.() : this.onload?.()), 0); }
    }
    class Img {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 10;
      naturalHeight = 10;
      set src(_v: string) { setTimeout(() => (opts.imgErr ? this.onerror?.() : this.onload?.()), 0); }
    }
    vi.stubGlobal('FileReader', FR);
    vi.stubGlobal('Image', Img);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(opts.ctx === false ? null : ({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,Z');
  };
  const img = new File(['x'], 'a.png', { type: 'image/png' });

  it('scales, and rejects on each failure', async () => {
    stub({});
    await expect(scaleLogo(img)).resolves.toBe('data:image/png;base64,Z');
    await expect(scaleLogo(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('not an image');
    stub({ frErr: true });
    await expect(scaleLogo(img)).rejects.toThrow('read failed');
    stub({ imgErr: true });
    await expect(scaleLogo(img)).rejects.toThrow('decode failed');
    stub({ ctx: false });
    await expect(scaleLogo(img)).rejects.toThrow('no canvas');
    vi.unstubAllGlobals();
  });
});

describe('Icons', () => {
  it('renders brand and icons with and without class', () => {
    const { container } = render(<><Brand /><IconBack className="x" /></>);
    expect(container.querySelectorAll('svg').length).toBe(2);
    expect(container.querySelector('svg.x')).toBeTruthy();
  });
});
