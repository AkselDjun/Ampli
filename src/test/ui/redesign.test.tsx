import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { AddMenu } from '../../ui/AddMenu';
import { FixBar } from '../../ui/FixBar';
import { Fold, Toast } from '../../ui/common';
import { GroupList } from '../../ui/GroupList';
import { PanelPane, Summary } from '../../ui/Side';
import { SWIPE_MAX, SWIPE_TRIGGER, useSwipe } from '../../ui/swipe';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Cfg, Line, Project } from '../../core/types';
import { wide } from './util';

vi.setConfig({ testTimeout: 60000 });

const rowsOf = () => Array.from(document.querySelectorAll<HTMLElement>('.rows .row'));
const proj = (lines: Line[], cfg: Partial<Cfg> = {}, o: Partial<Project> = {}): Project => ({
  ...newProject({ cfg: { ...defaultCfg(), ...cfg }, lines, sample: false }, 'Тест'),
  ...o
});
const seed = (p: Project) => localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
const longLine = () => mkLine('Длинная', 'power', 400, 1, 1, [['Печь', 3500, 1]]);
const overload = () => mkLine('Перегруз', 'power', 10, 1, 1, [['Первый', 10000, 1], ['Второй', 10000, 1]]);
const heavySockets = () => mkLine('Розетки', 'socket', 10, 1, 1, [['Чайник', 1000, 1], ['Духовка', 3500, 1]]);

const pt = (type: string, x: number, y = 0, extra: object = {}) => ({ pointerType: type, clientX: x, clientY: y, pointerId: 1, ...extra });
const down = (el: Element, x: number, y = 0, type = 'touch') => fireEvent.pointerDown(el, pt(type, x, y));
const move = (el: Element, x: number, y = 0, type = 'touch') => fireEvent.pointerMove(el, pt(type, x, y));
const up = (el: Element, x = 0, type = 'touch') => fireEvent.pointerUp(el, pt(type, x));
const swipe = (el: Element, from: number, to: number) => {
  down(el, from);
  move(el, to);
  up(el, to);
};

function Harness({ onLeft, onRight, onClick }: { onLeft: () => void; onRight: () => void; onClick: () => void }) {
  const { dx, handlers } = useSwipe(onLeft, onRight);
  return (
    <div>
      <button type="button" data-testid="t" onClick={onClick} {...handlers}>x</button>
      <output data-testid="dx">{dx}</output>
    </div>
  );
}

const harness = () => {
  const onLeft = vi.fn();
  const onRight = vi.fn();
  const onClick = vi.fn();
  render(<Harness onLeft={onLeft} onRight={onRight} onClick={onClick} />);
  return { onLeft, onRight, onClick, t: screen.getByTestId('t'), dx: () => screen.getByTestId('dx').textContent };
};

describe('useSwipe', () => {
  it('exports thresholds', () => {
    expect(SWIPE_TRIGGER).toBe(80);
    expect(SWIPE_MAX).toBe(120);
  });
  it('left swipe past the trigger fires onLeft and suppresses the next click once', () => {
    const h = harness();
    down(h.t, 200);
    move(h.t, 120);
    expect(h.dx()).toBe('-80');
    up(h.t, 120);
    expect(h.onLeft).toHaveBeenCalledTimes(1);
    expect(h.onRight).not.toHaveBeenCalled();
    expect(h.dx()).toBe('0');
    fireEvent.click(h.t);
    expect(h.onClick).not.toHaveBeenCalled();
    fireEvent.click(h.t);
    expect(h.onClick).toHaveBeenCalledTimes(1);
  });
  it('right swipe past the trigger fires onRight', () => {
    const h = harness();
    swipe(h.t, 50, 150);
    expect(h.onRight).toHaveBeenCalledTimes(1);
    expect(h.onLeft).not.toHaveBeenCalled();
  });
  it('a swipe below the trigger fires nothing but still suppresses the click', () => {
    const h = harness();
    down(h.t, 200);
    move(h.t, 150);
    expect(h.dx()).toBe('-50');
    up(h.t, 150);
    expect(h.onLeft).not.toHaveBeenCalled();
    expect(h.onRight).not.toHaveBeenCalled();
    expect(h.dx()).toBe('0');
    fireEvent.click(h.t);
    expect(h.onClick).not.toHaveBeenCalled();
  });
  it('mouse pointers are ignored', () => {
    const h = harness();
    down(h.t, 200, 0, 'mouse');
    move(h.t, 50, 0, 'mouse');
    expect(h.dx()).toBe('0');
    up(h.t, 50, 'mouse');
    expect(h.onLeft).not.toHaveBeenCalled();
    fireEvent.click(h.t);
    expect(h.onClick).toHaveBeenCalledTimes(1);
  });
  it('pen pointers work like touch', () => {
    const h = harness();
    down(h.t, 200, 0, 'pen');
    move(h.t, 60, 0, 'pen');
    up(h.t, 60, 'pen');
    expect(h.onLeft).toHaveBeenCalledTimes(1);
  });
  it('a vertical move cancels the gesture', () => {
    const h = harness();
    down(h.t, 200, 0);
    move(h.t, 195, 30);
    move(h.t, 50, 30);
    expect(h.dx()).toBe('0');
    up(h.t, 50);
    expect(h.onLeft).not.toHaveBeenCalled();
    fireEvent.click(h.t);
    expect(h.onClick).toHaveBeenCalledTimes(1);
  });
  it('tiny moves keep waiting and releasing does nothing', () => {
    const h = harness();
    down(h.t, 200, 0);
    move(h.t, 195, 4);
    expect(h.dx()).toBe('0');
    up(h.t, 195);
    expect(h.onLeft).not.toHaveBeenCalled();
    expect(h.onRight).not.toHaveBeenCalled();
    fireEvent.click(h.t);
    expect(h.onClick).toHaveBeenCalledTimes(1);
  });
  it('clamps the displacement at the maximum', () => {
    const h = harness();
    down(h.t, 400);
    move(h.t, 20);
    expect(h.dx()).toBe('-120');
    move(h.t, 900);
    expect(h.dx()).toBe('120');
    up(h.t, 900);
    expect(h.onRight).toHaveBeenCalledTimes(1);
  });
  it('pointercancel resets', () => {
    const h = harness();
    down(h.t, 200);
    move(h.t, 100);
    expect(h.dx()).toBe('-100');
    fireEvent.pointerCancel(h.t, pt('touch', 100));
    expect(h.dx()).toBe('0');
    up(h.t, 100);
    expect(h.onLeft).not.toHaveBeenCalled();
  });
  it('move and up without a down are ignored', () => {
    const h = harness();
    move(h.t, 10);
    up(h.t, 10);
    expect(h.dx()).toBe('0');
    expect(h.onLeft).not.toHaveBeenCalled();
  });
  it('captures the pointer when supported and survives when it throws', () => {
    const h = harness();
    const cap = vi.fn();
    (h.t as unknown as { setPointerCapture: unknown }).setPointerCapture = cap;
    down(h.t, 200);
    move(h.t, 150);
    expect(cap).toHaveBeenCalledWith(1);
    up(h.t, 150);
    (h.t as unknown as { setPointerCapture: unknown }).setPointerCapture = () => {
      throw new Error('no');
    };
    swipe(h.t, 200, 100);
    expect(h.onLeft).toHaveBeenCalledTimes(1);
  });
});

describe('AddMenu', () => {
  const setup = (props: { fab?: boolean; down?: boolean } = {}) => {
    const onAdd = vi.fn();
    const onRooms = vi.fn();
    render(<AddMenu onAdd={onAdd} onRooms={onRooms} {...props} />);
    return { onAdd, onRooms };
  };
  const toggle = () => screen.getByRole('button', { name: /Добавить группу/ });

  it('opens, closes on the toggle and lists the four items', async () => {
    const user = userEvent.setup();
    setup({ down: true });
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map(x => x.textContent)).toEqual(['Освещение', 'Розетки', 'Мощный прибор', 'Из комнат']);
    await user.click(toggle());
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.querySelector('.addmenu')).toHaveClass('down');
  });
  it.each([['Освещение', 'light'], ['Розетки', 'socket'], ['Мощный прибор', 'power']])('picking %s adds %s and closes', async (label, type) => {
    const user = userEvent.setup();
    const { onAdd } = setup();
    await user.click(toggle());
    await user.click(screen.getByRole('menuitem', { name: label }));
    expect(onAdd).toHaveBeenCalledWith(type);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('Из комнат calls onRooms and closes', async () => {
    const user = userEvent.setup();
    const { onRooms, onAdd } = setup();
    await user.click(toggle());
    await user.click(screen.getByRole('menuitem', { name: 'Из комнат' }));
    expect(onRooms).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('closes on an outside pointerdown but not on an inside one', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(toggle());
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('closes on Escape and ignores other keys', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(toggle());
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('fab variant renders the round button with an aria-label', async () => {
    const user = userEvent.setup();
    const { onAdd } = setup({ fab: true });
    const b = screen.getByRole('button', { name: 'Добавить группу' });
    expect(b).toHaveClass('fab-b');
    expect(b.textContent).toBe('+');
    expect(document.querySelector('.addmenu')).toHaveClass('fab');
    await user.click(b);
    await user.click(screen.getByRole('menuitem', { name: 'Розетки' }));
    expect(onAdd).toHaveBeenCalledWith('socket');
  });
});

describe('Fold', () => {
  it('toggles its body and mirrors aria-expanded', async () => {
    const user = userEvent.setup();
    render(<Fold title="Секция" badge={<span>бейдж</span>} className="extra"><p>тело</p></Fold>);
    const b = screen.getByRole('button', { name: /Секция/ });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('тело')).toBeNull();
    expect(screen.getByText('бейдж')).toBeInTheDocument();
    expect(document.querySelector('section')).toHaveClass('fold', 'extra');
    await user.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('тело')).toBeInTheDocument();
    await user.click(b);
    expect(screen.queryByText('тело')).toBeNull();
  });
  it('starts open when asked and works without className', () => {
    render(<Fold title="Секция" open><p>тело</p></Fold>);
    expect(screen.getByText('тело')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Секция/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Toast', () => {
  it('runs the action then closes', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<Toast text="Готово" label="Отменить" onAction={onAction} onClose={onClose} />);
    expect(screen.getByRole('status')).toHaveTextContent('Готово');
    await user.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('has no button without a label or an action', () => {
    const { rerender } = render(<Toast text="Т" onClose={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<Toast text="Т" label="Ок" onClose={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('closes by itself after 6 seconds and restarts on a new text', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<Toast text="Один" onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(5900); });
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Toast text="Два" onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(5900); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('clears the timer on unmount', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(<Toast text="Один" onClose={onClose} />);
    unmount();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('FixBar', () => {
  it('shows the text and an apply button when actionable', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FixBar fix={{ text: 'Сделайте так', label: 'Сделать', act: { k: 'half' } }} onApply={onApply} />);
    expect(screen.getByRole('note')).toHaveTextContent('Сделайте так');
    await user.click(screen.getByRole('button', { name: 'Сделать' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
  it('shows no button without action or label', () => {
    const { rerender } = render(<FixBar fix={{ text: 'Т', label: null, act: null }} onApply={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<FixBar fix={{ text: 'Т', label: 'Х', act: null }} onApply={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<FixBar fix={{ text: 'Т', label: null, act: { k: 'largest' } }} onApply={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('GroupList', () => {
  const props = (p: Project) => {
    const h = {
      onSelect: vi.fn(), onAdd: vi.fn(), onOpenProj: vi.fn(), onOpenNet: vi.fn(), onRooms: vi.fn(), onBlank: vi.fn(),
      onUndo: vi.fn(), onRedo: vi.fn(), onCopy: vi.fn(), onDelete: vi.fn(), onFix: vi.fn()
    };
    return { h, el: <GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={p.lines[0]?.id ?? null} canUndo canRedo {...h} /> };
  };

  it('folds the network parameters and opens the sheet via Изменить', async () => {
    const user = userEvent.setup();
    const { h, el } = props(proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]));
    render(el);
    const fold = screen.getByRole('button', { name: 'Параметры сети' });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(fold).toHaveTextContent('1 фаза, 230 В');
    expect(screen.queryByRole('button', { name: 'Изменить' })).toBeNull();
    await user.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    const body = document.querySelector('.nf-body') as HTMLElement;
    expect(body).toHaveTextContent('Скрытая');
    expect(body).toHaveTextContent('по СН: 3 / 5 %');
    await user.click(screen.getByRole('button', { name: 'Изменить' }));
    expect(h.onOpenNet).toHaveBeenCalledTimes(1);
    await user.click(fold);
    expect(document.querySelector('.nf-body')).toBeNull();
  });
  it('describes an open three-phase network with a voltage-drop limit', async () => {
    const user = userEvent.setup();
    const { el } = props(proj([mkLine('A', 'power', 5, 1, 1, [['x', 100, 1]], '3')], { supply: 3, method: 'open', drop: 4 }));
    render(el);
    await user.click(screen.getByRole('button', { name: 'Параметры сети' }));
    const body = document.querySelector('.nf-body') as HTMLElement;
    expect(body).toHaveTextContent('3 фазы, 400 В');
    expect(body).toHaveTextContent('Открытая');
    expect(body).toHaveTextContent('до 4 %');
    expect(document.querySelector('.row-sub')).toHaveTextContent('3Ф');
  });
  it('shows the empty text and hides the count', () => {
    const { el } = props(proj([]));
    render(el);
    expect(screen.getByText('Групп пока нет. Добавьте первую кнопкой «+».')).toBeInTheDocument();
    expect(document.querySelector('.count')?.textContent).toBe('');
    expect(document.querySelector('.pb-sub')?.textContent).toBe('0 групп');
  });
  it('shows project info, row details, flags, and routes the buttons', async () => {
    const user = userEvent.setup();
    const bad = longLine();
    const p = proj([bad, mkLine('', 'light', 5, 1, 1, []), mkLine('Свет', 'light', 5, 1, 1, [['x', 100, 1]])], {}, { name: '', address: 'ул. Тестовая' });
    const { h, el } = props(p);
    render(el);
    expect(document.querySelector('.pb-name')?.textContent).toBe('Без названия');
    expect(document.querySelector('.pb-sub')?.textContent).toBe('ул. Тестовая · 3 группы');
    expect(document.querySelector('.count')?.textContent).toBe('3 шт.');
    const rows = rowsOf();
    expect(rows[0].querySelector('.flag')).toHaveTextContent('!');
    expect(rows[1].querySelector('.flag')).toBeNull();
    expect(rows[1]).toHaveTextContent('Без названия');
    expect(rows[1]).toHaveTextContent('нет приборов');
    expect(rows[2].querySelector('.flag')).toBeNull();
    await user.click(rows[2]);
    expect(h.onSelect).toHaveBeenCalledWith(p.lines[2].id);
    await user.click(screen.getByRole('button', { name: 'Проекты' }));
    expect(h.onOpenProj).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Отменить' }));
    await user.click(screen.getByRole('button', { name: 'Вернуть' }));
    expect(h.onUndo).toHaveBeenCalled();
    expect(h.onRedo).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '+ Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Из комнат' }));
    expect(h.onRooms).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Мощный прибор' }));
    expect(h.onAdd).toHaveBeenCalledWith('power');
  });
  it('applies a row fix through onFix with the line id', async () => {
    const user = userEvent.setup();
    const p = proj([longLine(), overload()]);
    const { h, el } = props(p);
    render(el);
    const notes = screen.getAllByRole('note');
    expect(notes).toHaveLength(2);
    await user.click(within(notes[0]).getByRole('button', { name: /Сократить до \d+ м/ }));
    expect(h.onFix).toHaveBeenCalledWith(p.lines[0].id, expect.objectContaining({ k: 'len' }));
    await user.click(within(notes[1]).getByRole('button', { name: 'Разделить' }));
    expect(h.onFix).toHaveBeenLastCalledWith(p.lines[1].id, { k: 'half' });
  });
  it('shows a fix note without a button when nothing can be applied', () => {
    const { el } = props(proj([mkLine('Огромная', 'power', 10, 1, 1, [['x', 30000, 1]])]));
    render(el);
    expect(screen.getByRole('note')).toHaveTextContent('уменьшите мощность');
    expect(within(screen.getByRole('note')).queryByRole('button')).toBeNull();
  });
  it('shows the sample hint and starts blank after two clicks', async () => {
    const user = userEvent.setup();
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])], {}, { sample: true });
    const { h, el } = props(p);
    render(el);
    await user.click(screen.getByRole('button', { name: 'Начать с нуля' }));
    await user.click(screen.getByRole('button', { name: 'Нажмите ещё раз' }));
    expect(h.onBlank).toHaveBeenCalledTimes(1);
  });
  it('scrolls the selected row into view when the count changes and tolerates a missing API', () => {
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]);
    const { el } = props(p);
    const { rerender } = render(el);
    const p2 = proj([p.lines[0], mkLine('B', 'light', 5, 1, 1, [['x', 100, 1]])]);
    const { el: el2 } = props({ ...p2, lines: [p.lines[0], p2.lines[1]] });
    expect(() => rerender(el2)).not.toThrow();
    const fn = vi.fn();
    Element.prototype.scrollIntoView = fn;
    const p3 = proj([p.lines[0]]);
    rerender(props({ ...p3, lines: [p.lines[0]] }).el);
    expect(fn).toHaveBeenCalledWith({ block: 'nearest' });
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  it('does not scroll when nothing is selected', () => {
    const fn = vi.fn();
    Element.prototype.scrollIntoView = fn;
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]);
    const { h } = props(p);
    render(<GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={null} canUndo={false} canRedo={false} {...h} />);
    expect(fn).not.toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  it('disables undo and redo when unavailable', () => {
    const p = proj([]);
    const { h } = props(p);
    render(<GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={null} canUndo={false} canRedo={false} {...h} />);
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Вернуть' })).toBeDisabled();
  });
});

describe('Side folds', () => {
  const foldBtn = (title: string) => screen.getByRole('heading', { name: title }).closest('button') as HTMLElement;
  const sumOf = (p: Project, solo = false) => {
    const onBalance = vi.fn();
    render(<Summary a={calcAll(p.lines, p.cfg)} solo={solo} onBalance={onBalance} />);
    return onBalance;
  };

  it('opens checks with a singular badge when there is one problem', () => {
    sumOf(proj([longLine()]));
    const b = foldBtn('Проверки по нормам');
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(b.querySelector('.pill')).toHaveTextContent(/^\d+ замечани/);
    expect(document.querySelector('.chk')).toBeInTheDocument();
  });
  it('shows the plural forms of the problem badge', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => mkLine('П' + i, 'power', 400, 1, 1, [['x', 3500, 1]]));
    sumOf(proj(heavy));
    const t = foldBtn('Проверки по нормам').querySelector('.pill')?.textContent as string;
    expect(t).toMatch(/^\d+ замечани(е|я|й)$/);
  });
  it('keeps checks closed with an "all fine" badge when nothing is wrong', () => {
    sumOf(proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('B', 'socket', 5, 1, 1, [['x', 100, 1]])]));
    const b = foldBtn('Проверки по нормам');
    expect(b.querySelector('.pill')).toHaveTextContent('Всё в норме');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.chk')).toBeNull();
  });
  it('solo opens every fold in the summary and the panel', () => {
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('B', 'socket', 5, 1, 1, [['x', 100, 1]])], { supply: 3 });
    const a = calcAll(p.lines, p.cfg);
    render(<><Summary a={a} solo onBalance={() => undefined} /><PanelPane a={a} solo /></>);
    ['Проверки по нормам', 'Нагрузка по фазам', 'Запас автоматов', 'Щиток', 'Состав щитка'].forEach(t => {
      expect(foldBtn(t)).toHaveAttribute('aria-expanded', 'true');
    });
  });
  it('without solo the reserve and panel folds are closed', () => {
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]);
    const a = calcAll(p.lines, p.cfg);
    render(<><Summary a={a} onBalance={() => undefined} /><PanelPane a={a} /></>);
    ['Запас автоматов', 'Состав щитка'].forEach(t => {
      expect(foldBtn(t)).toHaveAttribute('aria-expanded', 'false');
    });
    expect(foldBtn('Щиток')).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.rail')).not.toBeNull();
    expect(document.querySelector('.sc')).toBeNull();
  });
  it('phase fold opens on imbalance with a badge and balance button', async () => {
    const user = userEvent.setup();
    const lines = [
      mkLine('A', 'socket', 5, 1, 1, [['x', 3000, 1]], 'L1'),
      mkLine('B', 'socket', 5, 1, 1, [['x', 3000, 1]], 'L1')
    ];
    const onBalance = sumOf(proj(lines, { supply: 3 }));
    const b = foldBtn('Нагрузка по фазам');
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(b.querySelector('.pill')).toHaveTextContent(/^Перекос \d+ %$/);
    await user.click(screen.getByRole('button', { name: 'Выровнять' }));
    expect(onBalance).toHaveBeenCalledTimes(1);
  });
  it('phase fold stays closed and says "Ровно" when balanced', () => {
    const lines = [
      mkLine('A', 'socket', 5, 1, 1, [['x', 3000, 1]], 'L1'),
      mkLine('B', 'socket', 5, 1, 1, [['x', 3000, 1]], 'L2'),
      mkLine('C', 'socket', 5, 1, 1, [['x', 3000, 1]], 'L3')
    ];
    sumOf(proj(lines, { supply: 3 }));
    const b = foldBtn('Нагрузка по фазам');
    expect(b.querySelector('.pill')).toHaveTextContent('Ровно');
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });
  it('shows no check, phase or reserve folds for an empty project', () => {
    sumOf(proj([]));
    expect(screen.queryByRole('heading', { name: 'Проверки по нормам' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Нагрузка по фазам' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Запас автоматов' })).toBeNull();
  });
  it('expands a closed fold on click', async () => {
    const user = userEvent.setup();
    sumOf(proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]));
    await user.click(foldBtn('Запас автоматов'));
    expect(document.querySelector('.gl')).toBeInTheDocument();
  });
});

describe('App flows', () => {
  it('adding through the menu on a narrow screen keeps the list and offers a toast', async () => {
    wide(false);
    const user = userEvent.setup();
    render(<App />);
    const n0 = rowsOf().length;
    await user.click(screen.getByRole('button', { name: '+ Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Мощный прибор' }));
    expect(rowsOf().length).toBe(n0 + 1);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
    expect(screen.getByRole('status')).toHaveTextContent('Добавлена группа: Мощный прибор');
    await user.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'edit');
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('adding on a wide screen shows a toast without the open action', async () => {
    wide(true);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Добавить группу' }));
    await user.click(screen.getByRole('menuitem', { name: 'Освещение' }));
    expect(screen.getByRole('status')).toHaveTextContent('Добавлена группа: Освещение');
    expect(screen.queryByRole('button', { name: 'Открыть' })).toBeNull();
  });
  it('the toast disappears after six seconds', () => {
    vi.useFakeTimers();
    wide(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Освещение' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6100); });
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('swipe left deletes a group and the toast restores it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const n0 = rowsOf().length;
    const name = rowsOf()[1].querySelector('.row-name')?.textContent;
    swipe(rowsOf()[1], 300, 150);
    expect(rowsOf().length).toBe(n0 - 1);
    expect(screen.getByRole('status')).toHaveTextContent('Группа удалена');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Отменить' }));
    expect(rowsOf().length).toBe(n0);
    expect(rowsOf()[1].querySelector('.row-name')?.textContent).toBe(name);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('swipe right copies a group and the toast undoes it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const n0 = rowsOf().length;
    swipe(rowsOf()[0], 50, 200);
    expect(rowsOf().length).toBe(n0 + 1);
    expect(rowsOf()[1].querySelector('.row-name')?.textContent).toContain('(копия)');
    expect(screen.getByRole('status')).toHaveTextContent('Создана копия группы');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Отменить' }));
    expect(rowsOf().length).toBe(n0);
  });
  it('a short drag does not change anything and does not select the row', () => {
    wide(false);
    render(<App />);
    const n0 = rowsOf().length;
    const r = rowsOf()[2];
    down(r, 200);
    move(r, 160);
    expect(r.style.transform).toBe('translateX(-40px)');
    up(r, 160);
    fireEvent.click(r);
    expect(rowsOf().length).toBe(n0);
    expect(document.getElementById('app')).toHaveAttribute('data-view', 'groups');
    expect(r.style.transform).toBe('');
  });
  it('swipe marks the wrapper with the direction while dragging', () => {
    render(<App />);
    const r = rowsOf()[0];
    down(r, 200);
    move(r, 150);
    expect(r.closest('.row-wrap')).toHaveClass('sw-l');
    move(r, 250);
    expect(r.closest('.row-wrap')).toHaveClass('sw-r');
    fireEvent.pointerCancel(r, pt('touch', 250));
    expect(r.closest('.row-wrap')).not.toHaveClass('sw-l');
    expect(r.closest('.row-wrap')).not.toHaveClass('sw-r');
  });
  it('the row fix button shortens the line and the toast undoes it', async () => {
    const user = userEvent.setup();
    const p = proj([longLine()]);
    seed(p);
    render(<App />);
    const wrap = document.querySelector('.row-wrap') as HTMLElement;
    const b = within(wrap).getByRole('button', { name: /Сократить до \d+ м/ });
    const L = Number(/(\d+) м/.exec(b.textContent as string)?.[1]);
    await user.click(b);
    expect(screen.getByRole('status')).toHaveTextContent('Исправлено');
    const stored = JSON.parse(localStorage.getItem(KEY) as string).list[0].lines[0];
    expect(Number(stored.len)).toBe(L);
    expect(document.querySelector('.row-wrap .fixbar')).toBeNull();
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Отменить' }));
    expect(Number(JSON.parse(localStorage.getItem(KEY) as string).list[0].lines[0].len)).toBe(400);
    expect(document.querySelector('.row-wrap .fixbar')).not.toBeNull();
  });
  it('the row fix button splits an overloaded line', async () => {
    const user = userEvent.setup();
    seed(proj([overload()]));
    render(<App />);
    await user.click(within(document.querySelector('.row-wrap') as HTMLElement).getByRole('button', { name: 'Разделить' }));
    expect(rowsOf().length).toBe(2);
    expect(rowsOf()[1].querySelector('.row-name')?.textContent).toBe('Перегруз (2)');
  });
  it('the editor fix bar shortens the selected line', async () => {
    wide(true);
    const user = userEvent.setup();
    seed(proj([longLine()]));
    render(<App />);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    const b = within(ed).getByRole('button', { name: /Сократить до \d+ м/ });
    const L = Number(/(\d+) м/.exec(b.textContent as string)?.[1]);
    await user.click(b);
    expect((within(ed).getByRole('spinbutton', { name: 'Длина линии, м' }) as HTMLInputElement).value).toBe(String(L));
    expect(within(ed).queryByRole('button', { name: /Сократить до/ })).toBeNull();
  });
  it('the editor fix bar splits an overloaded line', async () => {
    wide(true);
    const user = userEvent.setup();
    seed(proj([overload()]));
    render(<App />);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    await user.click(within(ed).getByRole('button', { name: 'Разделить' }));
    expect(rowsOf().length).toBe(2);
  });
  it('the editor fix bar moves the biggest appliance out of a socket line', async () => {
    wide(true);
    const user = userEvent.setup();
    seed(proj([heavySockets()]));
    render(<App />);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    expect(within(ed).getByRole('note')).toHaveTextContent('Вынесите «Духовка»');
    await user.click(within(ed).getByRole('button', { name: 'Вынести' }));
    expect(rowsOf().length).toBe(2);
    expect(rowsOf()[1].querySelector('.row-name')?.textContent).toBe('Духовка');
  });
  it('the editor shows a fix note without a button when no action exists', () => {
    wide(true);
    seed(proj([mkLine('Огромная', 'power', 10, 1, 1, [['x', 30000, 1]])]));
    render(<App />);
    const ed = document.querySelector('.col-edit') as HTMLElement;
    expect(within(ed).getByRole('note')).toBeInTheDocument();
    expect(within(ed).getByRole('note').querySelector('button')).toBeNull();
  });
});

describe('row action buttons', () => {
  it('copy and delete buttons act on the chosen group and show an undo toast', async () => {
    const user = userEvent.setup();
    wide(true);
    seed(proj([mkLine('Первая', 'socket', 10, 1, 1, [['Чайник', 1000, 1]]), mkLine('Вторая', 'light', 10, 1, 1, [['Лампа', 60, 1]])]));
    render(<App />);
    expect(rowsOf()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Копировать группу Г2' }));
    expect(rowsOf()).toHaveLength(3);
    expect(screen.getByText('Создана копия группы')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Удалить группу Г1' }));
    expect(rowsOf()).toHaveLength(2);
    expect(rowsOf()[0].textContent).not.toContain('Первая');
    expect(screen.getByText('Группа удалена')).toBeTruthy();
    await user.click(within(document.querySelector('.toast') as HTMLElement).getByRole('button', { name: 'Отменить' }));
    expect(rowsOf()).toHaveLength(3);
  });
  it('gives every row its own labelled buttons', () => {
    wide(true);
    seed(proj([mkLine('А', 'socket', 10, 1, 1, [['Чайник', 1000, 1]]), mkLine('Б', 'light', 10, 1, 1, [['Лампа', 60, 1]])]));
    render(<App />);
    ['Г1', 'Г2'].forEach(g => {
      expect(screen.getByRole('button', { name: 'Копировать группу ' + g })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Удалить группу ' + g })).toBeTruthy();
    });
  });
});
