import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { App } from '../../ui/App';
import { LIB_KEY } from '../../store/lib';
import { btn, byLabel, change, click, wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const ed = () => document.querySelector('.col-edit') as HTMLElement;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const radio = (name: string, value: string) =>
  ed().querySelector<HTMLInputElement>('input[name^="' + name + '-"][value="' + value + '"]') as HTMLInputElement;

const boot = () => {
  wide(true);
  render(<App />);
  fireEvent.click(rows()[0]);
};

describe('Editor', () => {
  it('shows empty hint when there is no selection', () => {
    wide(true);
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Начать с нуля');
    click(document.querySelector('.col-list') as HTMLElement, 'Нажмите ещё раз');
    fireEvent.click(rows()[0]);
    click(ed(), 'Удалить группу');
    click(ed(), 'Нажмите ещё раз, чтобы удалить');
    expect(ed().textContent).toContain('Выберите группу');
  });

  it('edits name, length with stepper, kc, cos', () => {
    boot();
    change(byLabel(ed(), 'Название группы'), 'Кухня 2');
    expect(rows()[0].textContent).toContain('Кухня 2');
    const len = byLabel(ed(), 'Длина линии, м');
    change(len, '12');
    expect(len.value).toBe('12');
    click(ed(), 'Длиннее');
    expect(len.value).toBe('13');
    click(ed(), 'Короче');
    click(ed(), 'Короче');
    expect(len.value).toBe('11');
    change(len, '0');
    click(ed(), 'Короче');
    expect(len.value).toBe('0');
    change(len, '499.5');
    click(ed(), 'Длиннее');
    click(ed(), 'Длиннее');
    expect(len.value).toBe('500');
    const nums = ed().querySelectorAll<HTMLInputElement>('.grid3 > label.f input');
    change(nums[0], '0.5');
    change(nums[1], '0.9');
    expect(nums[0].value).toBe('0.5');
    expect(nums[1].value).toBe('0.9');
  });

  it('changes type, wet and phase', () => {
    boot();
    fireEvent.click(radio('t', 'light'));
    expect(ed().textContent).not.toContain('Помещение');
    fireEvent.click(radio('t', 'power'));
    expect(ed().textContent).toContain('Помещение');
    fireEvent.click(radio('w', 'wet'));
    expect(radio('w', 'wet').checked).toBe(true);
    fireEvent.click(radio('w', 'dry'));
    expect(ed().textContent).not.toContain('Фаза');
    click(document.querySelector('.col-list') as HTMLElement, 'Параметры сети');
    fireEvent.click(document.querySelector('input[name="sup"][value="3"]') as HTMLElement);
    expect(ed().textContent).toContain('Фаза');
    fireEvent.click(radio('p', '3'));
    expect(radio('p', '3').checked).toBe(true);
    fireEvent.click(radio('p', 'L2'));
    fireEvent.click(radio('t', 'socket'));
    expect(radio('p', 'L2').checked).toBe(true);
    expect(radio('p', '3')).toBeNull();
  });

  it('toggles the why block and measurement block and edits measurements', () => {
    boot();
    const why = btn(ed(), 'Как посчитано');
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(ed().querySelector('.why-b')).not.toHaveAttribute('hidden');
    fireEvent.click(why);
    const meas = btn(ed(), 'Замеры после монтажа');
    fireEvent.click(meas);
    const zs = byLabel(ed(), 'Замер петли фаза-нуль, Ом');
    change(zs, '0.4');
    change(byLabel(ed(), 'Замер сопротивления изоляции, МОм'), '100');
    change(byLabel(ed(), 'Замер тока утечки, мА'), '3');
    expect(zs.value).toBe('0.4');
    fireEvent.click(meas);
  });

  it('edits and removes appliances, adds presets and custom ones', () => {
    boot();
    const n0 = ed().querySelectorAll('.app:not(.app-h)').length;
    expect(n0).toBeGreaterThan(0);
    const name = ed().querySelector('.a-name') as HTMLInputElement;
    change(name, 'Тостер');
    change(byLabel(ed(), 'Мощность, Вт'), '900');
    const cnt = byLabel(ed(), 'Количество');
    change(cnt, '3');
    fireEvent.click(btn(ed(), 'Больше'));
    expect(cnt.value).toBe('4');
    fireEvent.click(btn(ed(), 'Меньше'));
    fireEvent.click(btn(ed(), 'Меньше'));
    expect(cnt.value).toBe('2');
    change(cnt, '1');
    fireEvent.click(btn(ed(), 'Меньше'));
    expect(cnt.value).toBe('1');
    change(cnt, '99');
    fireEvent.click(btn(ed(), 'Больше'));
    expect(cnt.value).toBe('99');
    const chip = ed().querySelector('.chips .chip:not(.custom)') as HTMLElement;
    fireEvent.click(chip);
    fireEvent.click(chip);
    fireEvent.click(btn(ed(), '+ Свой прибор'));
    expect(ed().querySelectorAll('.app:not(.app-h)').length).toBeGreaterThanOrEqual(n0 + 1);
    const last = Array.from(ed().querySelectorAll<HTMLInputElement>('.a-name')).pop() as HTMLInputElement;
    expect(document.activeElement).toBe(last);
    fireEvent.click(btn(ed(), 'Удалить прибор'));
    ed().querySelectorAll('.a-del').forEach(b => fireEvent.click(b));
    expect(ed().querySelectorAll('.app:not(.app-h)').length).toBe(0);
    expect(ed().textContent).toContain('Добавьте приборы');
  });

  it('saves group appliances to the library and removes them via chip', () => {
    boot();
    click(ed(), 'Сохранить приборы группы в мои');
    expect(JSON.parse(localStorage.getItem(LIB_KEY) as string).apps.length).toBeGreaterThan(0);
    const mine = ed().querySelector('.chip-mine') as HTMLElement;
    expect(mine).toBeTruthy();
    fireEvent.click(mine.querySelector('.chip') as HTMLElement);
    const before = ed().querySelectorAll('.chip-mine').length;
    fireEvent.click(mine.querySelector('.chip-x') as HTMLElement);
    expect(ed().querySelectorAll('.chip-mine').length).toBe(before - 1);
  });

  it('hides the save link when no valid appliances', () => {
    boot();
    ed().querySelectorAll('.a-del').forEach(b => fireEvent.click(b));
    expect(ed().textContent).not.toContain('Сохранить приборы группы');
  });

  it('quick paste adds appliances and reports skipped lines', () => {
    boot();
    const n0 = ed().querySelectorAll('.app:not(.app-h)').length;
    const toggle = btn(ed(), 'Вставить список текстом');
    fireEvent.click(toggle);
    const ta = ed().querySelector('textarea') as HTMLTextAreaElement;
    change(ta, 'чайник 2200, духовка 2,5 кВт, лампы 60 x5');
    fireEvent.click(btn(ed(), 'Добавить'));
    expect(ed().querySelector('[role="status"]')?.textContent).toContain('Добавлено: 3');
    expect(ta.value).toBe('');
    expect(ed().querySelectorAll('.app:not(.app-h)').length).toBe(n0 + 3);
    change(ta, 'чайник 2200, абракадабра');
    fireEvent.click(btn(ed(), 'Добавить'));
    expect(ed().querySelector('[role="status"]')?.textContent).toContain('Не разобрано');
    expect(ta.value).not.toBe('');
    change(ta, 'абракадабра');
    fireEvent.click(btn(ed(), 'Добавить'));
    expect(ed().querySelector('[role="status"]')?.textContent).toContain('Ничего не добавлено');
    fireEvent.click(toggle);
    expect(ed().querySelector('textarea')).toBeNull();
  });

  it('shows no-selection-able states: empty group notes and unfit group', () => {
    boot();
    change(byLabel(ed(), 'Мощность, Вт'), '50000');
    expect(ed().textContent).toContain('Подбор невозможен');
    ed().querySelectorAll('.a-del').forEach(b => fireEvent.click(b));
    expect(ed().querySelector('.ed-res')?.textContent).toContain('Добавьте приборы');
  });

  it('duplicates a group', () => {
    boot();
    const n = rows().length;
    click(ed(), 'Копия группы');
    expect(rows().length).toBe(n + 1);
  });

  it('shows demand-factor annotation when kc is below 1', () => {
    boot();
    const nums = ed().querySelectorAll<HTMLInputElement>('.grid3 > label.f input');
    change(nums[0], '0.6');
    expect(ed().querySelector('.ed-load')?.textContent).toContain('Кс');
  });
});
