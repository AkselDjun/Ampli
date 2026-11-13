import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { Palette, filterCmds } from '../../ui/Palette';
import type { Cmd } from '../../ui/Palette';
import { change, click, dlg, isOpen, wide } from './util';

const pal = () => document.querySelector('dialog.pal') as HTMLDialogElement;
const q = () => screen.getByRole('combobox', { name: 'Найти действие или группу' }) as HTMLInputElement;
const opts = () => within(pal()).queryAllByRole('option').map(o => o.textContent);
const ed = () => document.querySelector('.col-edit') as HTMLElement;

describe('filterCmds', () => {
  const cmds: Cmd[] = [
    { id: 'a', group: 'Г', label: 'Смета: работы', words: 'цены', run: () => undefined },
    { id: 'b', group: 'Г', label: 'Ёлка', hint: 'кухня', run: () => undefined }
  ];
  it('matches every word in label, words and hint, ignoring case and ё', () => {
    expect(filterCmds(cmds, '').length).toBe(2);
    expect(filterCmds(cmds, 'СМЕТА цены').map(c => c.id)).toEqual(['a']);
    expect(filterCmds(cmds, 'елка кух').map(c => c.id)).toEqual(['b']);
    expect(filterCmds(cmds, 'нет такого')).toEqual([]);
  });
  it('puts actions before groups while the query is empty', () => {
    const list: Cmd[] = [{ ...cmds[1], id: 'g', late: true }, cmds[0]];
    expect(filterCmds(list, '').map(c => c.id)).toEqual(['a', 'g']);
    expect(filterCmds(list, 'елка').map(c => c.id)).toEqual(['g']);
  });
});

describe('Header search', () => {
  it('opens the palette from the header button', () => {
    wide(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Найти действие или группу' }));
    expect(pal().open).toBe(true);
    expect(opts()[0]).not.toMatch(/^Г\d/);
  });
});

describe('Command palette', () => {
  it('ignores a late close event from the previous run once reopened', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Palette open cmds={[]} onClose={onClose} />);
    fireEvent(pal(), new Event('close'));
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Palette open={false} cmds={[]} onClose={onClose} />);
    expect(pal().open).toBe(false);
    fireEvent(pal(), new Event('close'));
    expect(onClose).toHaveBeenCalled();
  });
  it('opens with Ctrl+K, filters and runs the estimate command', () => {
    wide(true);
    render(<App />);
    expect(pal().open).toBe(false);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(pal().open).toBe(true);
    expect(opts().some(t => t?.startsWith('Г1'))).toBe(true);
    change(q(), 'смета');
    expect(opts()).toEqual(['Смета: работы и материалы']);
    fireEvent.keyDown(q(), { key: 'Enter' });
    expect(pal().open).toBe(false);
    expect(isOpen('Отчёт и спецификация')).toBe(true);
    const tab = within(dlg('Отчёт и спецификация')).getByRole('tab', { name: 'Смета', hidden: true });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(pal().open).toBe(true);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(pal().open).toBe(false);
  });

  it('opens with slash, navigates with arrows and picks a group', () => {
    wide(true);
    render(<App />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(pal().open).toBe(true);
    change(q(), 'Г3');
    fireEvent.keyDown(q(), { key: 'ArrowDown' });
    fireEvent.keyDown(q(), { key: 'ArrowUp' });
    expect(within(pal()).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(q(), { key: 'Enter' });
    expect((ed().querySelector('.ed-name') as HTMLInputElement).value).toBe('Розетки: гостиная');
  });

  it('ignores slash while typing and shows the empty state', () => {
    wide(true);
    render(<App />);
    const name = ed().querySelector('.ed-name') as HTMLInputElement;
    fireEvent.keyDown(name, { key: '/' });
    expect(pal().open).toBe(false);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    change(q(), 'абракадабра');
    expect(pal().textContent).toContain('Ничего не нашлось');
    fireEvent.keyDown(q(), { key: 'ArrowDown' });
    fireEvent.keyDown(q(), { key: 'Enter' });
    expect(pal().open).toBe(true);
    fireEvent.keyDown(q(), { key: 'x' });
    click(pal(), 'Закрыть');
    expect(pal().open).toBe(false);
  });

  it('runs commands by click and offers balance but no undo or redo', () => {
    wide(true);
    render(<App />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(opts()).not.toContain('Отменить');
    const o = within(pal()).getAllByRole('option').find(x => x.textContent === 'Параметры сети') as HTMLElement;
    fireEvent.mouseMove(o);
    expect(o).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(o);
    expect(isOpen('Параметры сети')).toBe(true);
    fireEvent.click(dlg('Параметры сети').querySelector('input[name="sup"][value="3"]') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    change(q(), 'выровнять');
    fireEvent.keyDown(q(), { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    change(q(), 'отменить');
    expect(opts()).not.toContain('ОтменитьCtrl+Z');
    change(q(), 'вернуть');
    expect(opts()).not.toContain('ВернутьCtrl+Shift+Z');
  });

  it('runs every action command without errors', () => {
    wide(true);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<App />);
    const labels = ['Добавить группу освещения', 'Добавить розеточную группу', 'Добавить мощный прибор', 'Собрать группы из комнат', 'Отчёт и спецификация', 'Однолинейная схема', 'Печать отчёта в PDF', 'Где купить', 'Сравнить варианты', 'Приёмка', 'Замеры на щитке', 'Печать протокола замеров', 'Печать паспорта для владельца', 'Проекты', 'Мои данные'];
    labels.forEach(l => {
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
      if (!pal().open) fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
      const o = within(pal()).getAllByRole('option').find(x => x.textContent === l) as HTMLElement;
      expect(o, l).toBeTruthy();
      act(() => { fireEvent.click(o); });
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    print.mockRestore();
  });

  it('uses the native modal dialog when available', () => {
    const show = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
    const proto = HTMLDialogElement.prototype as unknown as { showModal?: unknown; close?: unknown };
    const prev = { showModal: proto.showModal, close: proto.close };
    proto.showModal = show;
    proto.close = close;
    const { rerender } = render(<Palette open={false} onClose={() => undefined} cmds={[]} />);
    rerender(<Palette open onClose={() => undefined} cmds={[]} />);
    expect(show).toHaveBeenCalledTimes(1);
    rerender(<Palette open={false} onClose={() => undefined} cmds={[]} />);
    expect(close).toHaveBeenCalledTimes(1);
    proto.showModal = prev.showModal;
    proto.close = prev.close;
  });
});

describe('Editor folds', () => {
  it('summarise hidden settings and measurements', () => {
    wide(true);
    render(<App />);
    expect(within(ed()).queryByRole('button', { name: /Дополнительно/ })).toBeNull();
    fireEvent.click(Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.textContent?.includes('Варочная')) as HTMLElement);
    const more = within(ed()).getByRole('button', { name: /Дополнительно/ });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const meas = within(ed()).getByRole('button', { name: /Замеры и фото/ });
    fireEvent.click(meas);
    change(screen.getByLabelText('Замер петли фаза-нуль, Ом'), '0.3');
    expect(meas.textContent).toContain('1 замер');
  });
});
