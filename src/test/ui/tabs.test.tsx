import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { App } from '../../ui/App';
import { Sheet, TabPanel, Tabs } from '../../ui/common';
import { KEY } from '../../store/storage';
import { sampleProject } from '../../core/project';
import { click, dlg } from './util';

vi.setConfig({ testTimeout: 60000 });

const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const visible = (d: HTMLElement) => Array.from(d.querySelectorAll<HTMLElement>('[role="tabpanel"]')).filter(x => !x.hidden).map(x => x.id);

function Demo() {
  const [t, setT] = useState('a');
  return (
    <Tabs scope="x" label="Демо" cur={t} onChange={setT} items={[{ id: 'a', label: 'Первая' }, { id: 'b', label: 'Вторая' }, { id: 'c', label: 'Третья' }]} />
  );
}

describe('Tabs', () => {
  it('marks the current tab, links it to its panel and moves with arrow keys', () => {
    render(<Demo />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map(t => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0].getAttribute('aria-controls')).toBe('x-tp-a');
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.id).toBe('x-tab-b');
    fireEvent.keyDown(screen.getAllByRole('tab')[1], { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getAllByRole('tab')[0], { key: 'ArrowLeft' });
    expect(screen.getAllByRole('tab')[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getAllByRole('tab')[2], { key: 'Enter' });
    expect(screen.getAllByRole('tab')[2].getAttribute('aria-selected')).toBe('true');
  });
  it('keeps hidden panels mounted so entered values survive a tab switch', () => {
    render(
      <Sheet open onClose={() => undefined} title="Т" bar={<Demo />}>
        <TabPanel scope="x" id="a" cur="b"><input aria-label="поле" defaultValue="1" /></TabPanel>
        <TabPanel scope="x" id="b" cur="b">видно</TabPanel>
      </Sheet>
    );
    expect(visible(dlg('Т'))).toEqual(['x-tp-b']);
    expect(dlg('Т').querySelector('input')).toBeTruthy();
  });
  it('can show a compact sheet without a fixed height', () => {
    render(<Sheet open onClose={() => undefined} title="К" compact>x</Sheet>);
    expect(dlg('К').classList.contains('compact')).toBe(true);
  });
});

describe('sheets use tabs and one panel at a time', () => {
  const seed = () => {
    const p = sampleProject();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
  };
  const cases: [string, string, string[]][] = [
    ['Отчёт', 'Отчёт и спецификация', ['Группы', 'Схема', 'Смета', 'Допущения']],
    ['Приёмка', 'Монтаж и приёмка', ['Чек-лист 0/10', 'Замеры', 'Документы']]
  ];
  cases.forEach(([opener, title, labels]) => {
    it(title + ' has tabs and shows only one panel', () => {
      seed();
      render(<App />);
      click(nav(), new RegExp(opener));
      const d = dlg(title);
      const tabs = within(d).getAllByRole('tab');
      expect(tabs.map(t => t.textContent)).toEqual(labels);
      expect(visible(d)).toHaveLength(1);
      tabs.forEach(t => {
        fireEvent.click(t);
        expect(t.getAttribute('aria-selected')).toBe('true');
        expect(visible(d)).toHaveLength(1);
        expect(visible(d)[0]).toBe(t.getAttribute('aria-controls'));
      });
    });
  });
  it('report: estimate and notes hold the spec table and the assumptions', () => {
    seed();
    render(<App />);
    click(nav(), /Отчёт/);
    const d = dlg('Отчёт и спецификация');
    fireEvent.click(within(d).getByRole('tab', { name: 'Смета' }));
    expect(within(d).getByRole('button', { name: /Excel/ })).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Где купить' })).toBeTruthy();
    expect(d.querySelector('#rep-tp-estimate .est')).toBeTruthy();
    fireEvent.click(within(d).getByRole('tab', { name: 'Допущения' }));
    expect(d.querySelector('#rep-tp-notes .assum')).toBeTruthy();
    fireEvent.click(within(d).getByRole('tab', { name: 'Схема' }));
    expect(d.querySelector('#rep-tp-scheme svg')).toBeTruthy();
  });
  it('projects and data: two sections each and Мои данные has three', () => {
    seed();
    render(<App />);
    click(document.querySelector('.col-list') as HTMLElement, 'Проекты');
    const d = dlg('Проекты');
    expect(within(d).getAllByRole('tab').map(t => t.textContent)).toEqual(['Проекты', 'Обмен и данные']);
    click(d, 'Мои данные');
    const l = dlg('Мои данные');
    expect(within(l).getAllByRole('tab').map(t => t.textContent)).toEqual(['Реквизиты', 'Приборы', 'Шаблоны и цены']);
    fireEvent.click(within(l).getByRole('tab', { name: 'Шаблоны и цены' }));
    expect(visible(l)).toEqual(['lib-tp-tpl']);
  });
  it('where to buy switches to the list after a price list is loaded', () => {
    seed();
    render(<App />);
    click(nav(), /Отчёт/);
    click(dlg('Отчёт и спецификация'), 'Где купить');
    const d = dlg('Где купить');
    fireEvent.click(within(d).getByRole('tab', { name: 'Прайсы' }));
    expect(visible(d)).toEqual(['shop-tp-lists']);
    expect(within(d).getByRole('button', { name: 'Загрузить прайс' })).toBeTruthy();
  });
});
