import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { dlg, wide } from './util';

const open = (name: string): HTMLElement => {
  const row = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.textContent?.includes(name));
  fireEvent.click(row as HTMLElement);
  return document.querySelector('[aria-label="Редактор группы"]') as HTMLElement;
};

const label = (ed: HTMLElement, text: string): Element => {
  const el = Array.from(ed.querySelectorAll('.lbl')).find(x => x.textContent === text);
  if (!el) throw new Error('no label ' + text);
  return el;
};

const fold = (ed: HTMLElement, text: string): HTMLButtonElement => {
  const el = Array.from(ed.querySelectorAll<HTMLButtonElement>('.fold-in > .why-t')).find(x => x.firstElementChild?.textContent === text);
  if (!el) throw new Error('no fold ' + text);
  return el;
};

const before = (a: Element, b: Element): boolean => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('group editor order', () => {
  it('puts frequent fields first and rare sections last', () => {
    wide(true);
    render(<App />);
    const ed = open('Варочная');
    const res = ed.querySelector('.ed-res') as Element;
    const type = label(ed, 'Тип группы');
    const len = label(ed, 'Длина до распредкоробки, м');
    const room = label(ed, 'Помещение');
    const apps = ed.querySelector('.apps') as Element;
    const more = fold(ed, 'Дополнительно');
    const meas = fold(ed, 'Замеры и фото');
    const why = fold(ed, 'Как посчитано');
    const end = ed.querySelector('.ed-end') as Element;
    const chain = [res, type, len, room, apps, more, meas, why, end];
    chain.slice(1).forEach((el, i) => expect(before(chain[i], el)).toBe(true));
  });

  it('keeps the calculation details folded in one compact row', () => {
    wide(true);
    render(<App />);
    const ed = open('Варочная');
    const why = fold(ed, 'Как посчитано');
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(why.textContent).toContain('формулы и пункты норм');
    const body = ed.querySelector('.why-b') as HTMLElement;
    expect(body.hidden).toBe(true);
    expect(body.previousElementSibling).toBe(why);
    fireEvent.click(why);
    expect(body.hidden).toBe(false);
    expect(body.querySelectorAll('dt').length).toBeGreaterThan(2);
    fireEvent.click(why);
    expect(body.hidden).toBe(true);
  });

  it('remembers the open calculation details when switching groups', () => {
    wide(true);
    render(<App />);
    let ed = open('Варочная');
    fireEvent.click(fold(ed, 'Как посчитано'));
    ed = open('Свет');
    expect(fold(ed, 'Как посчитано')).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the calculation details for a group without appliances', () => {
    wide(true);
    render(<App />);
    const ed = open('Варочная');
    ed.querySelectorAll('.a-del').forEach(b => fireEvent.click(b));
    expect(ed.querySelector('.why-b')).toBeNull();
    expect(Array.from(ed.querySelectorAll('.fold-in > .why-t')).map(x => x.firstElementChild?.textContent)).toEqual(['Дополнительно', 'Замеры и фото']);
  });

  it('places the phase next to the line length on a three-phase supply', () => {
    wide(true);
    render(<App />);
    fireEvent.click(Array.from(document.querySelectorAll<HTMLElement>('.col-list button')).find(x => x.textContent?.includes('Параметры сети')) as HTMLElement);
    fireEvent.click(document.querySelector('input[name="sup"][value="3"]') as HTMLElement);
    fireEvent.click(dlg('Параметры сети').querySelector('.sheet-close') as HTMLElement);
    const ed = open('Варочная');
    const core = ed.querySelector('.ed-core') as HTMLElement;
    expect(core.querySelector('.len-f')?.nextElementSibling).toHaveClass('ph-f');
    expect(before(core, ed.querySelector('.apps') as Element)).toBe(true);
  });
});

describe('appliance chips by screen width', () => {
  const presets = (ed: HTMLElement) => ed.querySelectorAll('.chips:not(.often) .chip:not(.custom):not(.more)').length;

  it('shows three suggestions on a phone and the rest on demand', () => {
    wide(false);
    render(<App />);
    const ed = open('Варочная');
    expect(presets(ed)).toBe(3);
    const more = ed.querySelector('.chip.more') as HTMLElement;
    const rest = Number(/\d+/.exec(more.textContent ?? '')?.[0]);
    expect(rest).toBeGreaterThan(0);
    fireEvent.click(more);
    expect(presets(ed)).toBe(3 + rest);
    expect(more.textContent).toBe('Свернуть');
  });

  it('shows six suggestions on a wide screen', () => {
    wide(true);
    render(<App />);
    expect(presets(open('Варочная'))).toBe(6);
  });
});

describe('one room field', () => {
  it('has no separate location field and explains where the room is printed', () => {
    wide(true);
    render(<App />);
    const ed = open('Варочная');
    expect(ed.textContent).not.toContain('Где находится');
    expect(ed.querySelector('[aria-label="Где находится группа"]')).toBeNull();
    expect(ed.querySelectorAll('input.ed-zone').length).toBe(1);
  });
});
