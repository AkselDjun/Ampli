import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../ui/App';
import { AddMenu } from '../../ui/AddMenu';
import { FixBar } from '../../ui/FixBar';
import { Fold } from '../../ui/common';
import { GroupList } from '../../ui/GroupList';
import { PanelPane, Summary } from '../../ui/Side';
import { Checks, checksState } from '../../ui/Checks';
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
  ...newProject({ cfg: { ...defaultCfg(), prot: 'rcbo', ...cfg }, lines, sample: false }, 'Тест'),
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
    expect(screen.getAllByRole('menuitem').map(x => x.getAttribute('aria-label'))).toEqual(['Освещение', 'Розетки', 'Мощный прибор', 'Из комнат']);
    expect(screen.getByRole('menuitem', { name: 'Освещение' }).textContent).toContain('B10, 1,5 мм²');
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
      onSelect: vi.fn(), onAdd: vi.fn(), onOpenProj: vi.fn(), onOpenNet: vi.fn(), onOpenOld: vi.fn(), oldLabel: '', onRooms: vi.fn(), onBlank: vi.fn(),
      onCopy: vi.fn(), onDelete: vi.fn(), onFix: vi.fn()
    };
    return { h, el: <GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={p.lines[0]?.id ?? null} {...h} /> };
  };

  it('summarises the network and opens the settings in one tap', async () => {
    const user = userEvent.setup();
    const { h, el } = props(proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]));
    render(el);
    const b = screen.getByRole('button', { name: /^Параметры сети ?:/ });
    expect(b).toHaveTextContent('1 фаза, 230 В');
    expect(b).toHaveTextContent('Скрытая');
    expect(b).toHaveTextContent('дифавтоматы');
    await user.click(b);
    expect(h.onOpenNet).toHaveBeenCalledTimes(1);
  });
  it('describes an open three-phase network with residual-current devices per room', () => {
    const { el } = props(proj([mkLine('A', 'power', 5, 1, 1, [['x', 100, 1]], '3')], { supply: 3, method: 'open', prot: 'rcd' }));
    render(el);
    const b = screen.getByRole('button', { name: /^Параметры сети ?:/ });
    expect(b).toHaveTextContent('3 фазы, 400 В');
    expect(b).toHaveTextContent('Открытая');
    expect(b).toHaveTextContent('УЗО на помещение');
    expect(document.querySelector('.row-sub')).toHaveTextContent('3Ф');
  });
  it('shows the start screen and hides the count', () => {
    const { h, el } = props(proj([]));
    render(el);
    expect(screen.getByRole('heading', { name: 'С чего начать' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Собрать по комнатам/ }));
    expect(h.onRooms).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Силовая|Мощный/ }));
    expect(h.onAdd).toHaveBeenCalledWith('power');
    expect(screen.queryByRole('button', { name: /на примере/ })).toBeNull();
    expect(document.querySelector('.list-head .count')).toBeNull();
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
    expect(document.querySelector('.list-head .count')).toBeNull();
    const rows = rowsOf();
    expect(rows[0].querySelector('.flag')).toHaveTextContent('!');
    expect(rows[1].querySelector('.flag')).toBeNull();
    expect(rows[1]).toHaveTextContent('Без названия');
    expect(rows[1]).toHaveTextContent('нет приборов');
    expect(rows[2].querySelector('.flag')).toBeNull();
    await user.click(rows[2]);
    expect(h.onSelect).toHaveBeenCalledWith(p.lines[2].id);
    await user.click(screen.getByRole('button', { name: /^Проекты:/ }));
    expect(h.onOpenProj).toHaveBeenCalled();
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
    render(<GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={null} {...h} />);
    expect(fn).not.toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
  it('has no undo and redo arrows in the list header', () => {
    const p = proj([]);
    const { h } = props(p);
    render(<GroupList p={p} a={calcAll(p.lines, p.cfg)} sel={null} {...h} />);
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Вернуть' })).toBeNull();
  });
});

describe('Side folds', () => {
  const foldBtn = (title: string) => screen.getByRole('heading', { name: title }).closest('button') as HTMLElement;
  const sumOf = (p: Project, solo = false) => {
    const onBalance = vi.fn();
    render(<Summary a={calcAll(p.lines, p.cfg)} solo={solo} onBalance={onBalance} />);
    return onBalance;
  };

  const chkOf = (p: Project) => {
    render(<Checks a={calcAll(p.lines, p.cfg)} onGroup={() => undefined} onFix={() => undefined} />);
    return screen.getByRole('button', { name: /^Проверки по нормам/ });
  };
  it('shows a warning button with a count and opens the list of checks', async () => {
    const user = userEvent.setup();
    const b = chkOf(proj([longLine()]));
    expect(b).toHaveClass('st-bad');
    expect(b.querySelector('.chk-n')?.textContent).toMatch(/^\d+$/);
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.chk')).toBeNull();
    await user.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    const pop = document.getElementById('chk-pop') as HTMLElement;
    expect(pop.querySelector('.pill')).toHaveTextContent(/^\d+ замечани/);
    expect(pop.querySelectorAll('.chk li').length).toBeGreaterThan(1);
    await user.keyboard('{Escape}');
    expect(document.getElementById('chk-pop')).toBeNull();
  });
  it('uses the plural forms in the label', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => mkLine('П' + i, 'power', 400, 1, 1, [['x', 3500, 1]]));
    const b = chkOf(proj(heavy));
    expect(b.querySelector('.vh')?.textContent).toMatch(/^Проверки по нормам: \d+ замечани(е|я|й)\. $/);
    expect(checksState([{ k: 'warn', t: 'a' }]).text).toBe('1 замечание');
    expect(checksState([{ k: 'warn', t: 'a' }, { k: 'warn', t: 'b' }]).text).toBe('2 замечания');
    expect(checksState(Array.from({ length: 5 }, () => ({ k: 'warn' as const, t: 'x' }))).text).toBe('5 замечаний');
  });
  it('shows a quiet green button when everything is fine and nothing without load', () => {
    const b = chkOf(proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('B', 'socket', 5, 1, 1, [['x', 100, 1]])]));
    expect(b).toHaveClass('st-ok');
    expect(b.querySelector('.vh')?.textContent).toBe('Проверки по нормам: Всё в норме. ');
    expect(b.querySelector('.chk-n')).toBeNull();
    const w = checksState([{ k: 'warn', t: 'a' }]);
    expect(w.k).toBe('warn');
  });
  it('renders nothing for an empty project', () => {
    render(<Checks a={calcAll([], defaultCfg())} onGroup={() => undefined} onFix={() => undefined} />);
    expect(screen.queryByRole('button', { name: /^Проверки по нормам/ })).toBeNull();
  });
  it('solo opens the summary folds and the panel is one tabbed block', () => {
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('B', 'socket', 5, 1, 1, [['x', 100, 1]])], { supply: 3 });
    const a = calcAll(p.lines, p.cfg);
    render(<><Summary a={a} solo onBalance={() => undefined} /><PanelPane a={a} /></>);
    expect(screen.queryByRole('heading', { name: 'Проверки по нормам' })).toBeNull();
    ['Нагрузка по фазам', 'Щиток'].forEach(t => {
      expect(foldBtn(t)).toHaveAttribute('aria-expanded', 'true');
    });
    expect(screen.queryByRole('heading', { name: 'Запас автоматов' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Состав щитка' })).toBeNull();
  });
  it('the panel block shows the rail and one list with load bars, no tabs', async () => {
    const user = userEvent.setup();
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]]), mkLine('B', 'power', 5, 1, 1, [['x', 2200, 1]])]);
    const a = calcAll(p.lines, p.cfg);
    const pick = vi.fn();
    render(<PanelPane a={a} onPick={pick} />);
    expect(screen.queryAllByRole('tab')).toEqual([]);
    expect(document.querySelector('.rail')).not.toBeNull();
    const items = Array.from(document.querySelectorAll<HTMLElement>('.bd-r'));
    expect(items.length).toBe(3);
    expect(items[0].querySelector('.bd-name')?.textContent).toBe('Вводной автомат');
    expect(items[0].querySelector('.bd-load small')?.textContent).toMatch(/\/ \d+ А$/);
    expect(items[1].querySelector('.bd-sub')?.textContent).toBe('дифавтомат 30 мА, 1,5 мм²');
    expect(items[2].querySelector('.gl-bar i')).toHaveClass('warn');
    await user.click(items[1].querySelector('button.bd-b') as HTMLElement);
    expect(pick).toHaveBeenCalledWith(p.lines[0].id);
    expect(document.querySelector('.bd-help')).toBeNull();
  });
  it('shows a static list without a pick handler and an empty board', () => {
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]])]);
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    expect(document.querySelector('button.bd-b')).toBeNull();
    expect(document.querySelectorAll('div.bd-b').length).toBe(2);
  });
  it('lists nothing for an empty project', () => {
    render(<PanelPane a={calcAll([], defaultCfg())} />);
    expect(document.querySelectorAll('.bd-r').length).toBe(0);
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
    const p = proj([mkLine('A', 'light', 5, 1, 1, [['x', 100, 1]], 'L1'), mkLine('B', 'light', 5, 1, 1, [['x', 100, 1]], 'L2'), mkLine('C', 'light', 5, 1, 1, [['x', 100, 1]], 'L3')], { supply: 3 });
    render(<Summary a={calcAll(p.lines, p.cfg)} onBalance={() => undefined} />);
    const b = foldBtn('Нагрузка по фазам');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    await user.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
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
    expect(document.querySelector('.toast')).toBeNull();
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
  it('the toast disappears by itself', () => {
    vi.useFakeTimers();
    wide(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Освещение' }));
    expect(document.querySelector('.toast')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4600); });
    expect(document.querySelector('.toast')).toBeNull();
  });
  it('swipe left deletes a group without an undo offer', () => {
    render(<App />);
    const n0 = rowsOf().length;
    swipe(rowsOf()[1], 300, 150);
    expect(rowsOf().length).toBe(n0 - 1);
    expect(screen.getByRole('status')).toHaveTextContent('Группа удалена');
    expect(within(screen.getByRole('status')).queryByRole('button', { name: 'Отменить' })).toBeNull();
  });
  it('swipe right copies a group', () => {
    render(<App />);
    const n0 = rowsOf().length;
    swipe(rowsOf()[0], 50, 200);
    expect(rowsOf().length).toBe(n0 + 1);
    expect(rowsOf()[1].querySelector('.row-name')?.textContent).toContain('(копия)');
    expect(screen.getByRole('status')).toHaveTextContent('Создана копия группы');
    expect(within(screen.getByRole('status')).queryByRole('button', { name: 'Отменить' })).toBeNull();
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
  it('the row fix button shortens the line', async () => {
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
    expect(within(screen.getByRole('status')).queryByRole('button', { name: 'Отменить' })).toBeNull();
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
    expect((within(ed).getByRole('textbox', { name: 'Длина линии, м' }) as HTMLInputElement).value).toBe(String(L));
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
  it('copy and delete buttons act on the chosen group', async () => {
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
    expect(within(document.querySelector('.toast') as HTMLElement).queryByRole('button', { name: 'Отменить' })).toBeNull();
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
