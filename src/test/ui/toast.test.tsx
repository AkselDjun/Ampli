import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HoverTips, Toaster } from '../../ui/common';
import { currentToast, dismissToast, toast, toastBad, toastLife, toastOk, toastUndo } from '../../ui/toast';

describe('toast store', () => {
  it('keeps one message, replaces it and dismisses by id', () => {
    toast('Один');
    const first = currentToast();
    expect(first?.tone).toBe('info');
    toastOk('Два');
    expect(currentToast()?.text).toBe('Два');
    expect(currentToast()?.tone).toBe('ok');
    dismissToast(first?.id);
    expect(currentToast()?.text).toBe('Два');
    dismissToast();
    expect(currentToast()).toBeNull();
    dismissToast();
    expect(currentToast()).toBeNull();
  });
  it('gives longer life to errors and undo', () => {
    toastOk('a');
    expect(toastLife(currentToast()!)).toBe(4500);
    toastBad('b');
    expect(toastLife(currentToast()!)).toBe(7000);
    toastUndo('c', () => undefined);
    expect(toastLife(currentToast()!)).toBe(8000);
  });
});

describe('Toaster', () => {
  it('shows polite messages in status and errors in alert', () => {
    render(<Toaster />);
    act(() => toastOk('Сохранено'));
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    act(() => toastBad('Ошибка'));
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('runs the action once and closes', () => {
    const run = vi.fn();
    render(<Toaster />);
    act(() => toastUndo('Группа удалена', run));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(currentToast()).toBeNull();
  });
  it('closes with the close button', () => {
    render(<Toaster />);
    act(() => toast('Текст'));
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(currentToast()).toBeNull();
  });
  it('closes by itself and waits while hovered or focused', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toastOk('Готово'));
    const card = document.querySelector('.toast') as HTMLElement;
    fireEvent.mouseEnter(card);
    act(() => { vi.advanceTimersByTime(9000); });
    expect(currentToast()?.text).toBe('Готово');
    fireEvent.mouseLeave(card);
    fireEvent.focus(card);
    act(() => { vi.advanceTimersByTime(9000); });
    expect(currentToast()?.text).toBe('Готово');
    fireEvent.blur(card);
    act(() => { vi.advanceTimersByTime(4400); });
    expect(currentToast()?.text).toBe('Готово');
    act(() => { vi.advanceTimersByTime(200); });
    expect(currentToast()).toBeNull();
  });
});

describe('HoverTips', () => {
  const setup = () => {
    render(<><HoverTips /><button type="button" data-tip="Копировать"><span>иконка</span></button><button type="button" data-tip="">пусто</button><button type="button">без</button></>);
    return screen.getByRole('button', { name: 'иконка' });
  };
  it('shows a tooltip after a short mouse hover and hides it on leave', () => {
    vi.useFakeTimers();
    const b = setup();
    fireEvent.pointerOver(b.firstChild as Element, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Копировать');
    fireEvent.pointerOut(b.firstChild as Element, { pointerType: 'mouse', relatedTarget: b });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerOut(b, { pointerType: 'mouse', relatedTarget: screen.getByRole('tooltip') });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByRole('tooltip'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerOver(b, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.pointerOut(b, { pointerType: 'mouse', relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('ignores touch, plain elements and empty tips', () => {
    vi.useFakeTimers();
    const b = setup();
    fireEvent.pointerOver(b, { pointerType: 'touch' });
    fireEvent.pointerOver(screen.getByRole('button', { name: 'без' }), { pointerType: 'mouse' });
    fireEvent.pointerOut(screen.getByRole('button', { name: 'без' }), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerOver(screen.getByRole('button', { name: 'пусто' }), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('shows on keyboard focus and closes on Escape, scroll and blur', () => {
    const b = setup();
    act(() => b.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => b.blur());
    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => b.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Копировать');
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).not.toHaveBeenCalled();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', outer);
    act(() => { b.blur(); b.focus(); });
    fireEvent.scroll(document);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { b.blur(); b.focus(); });
    act(() => b.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('places the tooltip above when there is no room below', () => {
    const b = setup();
    vi.spyOn(b, 'getBoundingClientRect').mockReturnValue({ left: 10, right: 50, top: window.innerHeight - 20, bottom: window.innerHeight - 4, width: 40, height: 16, x: 10, y: 0, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
    fireEvent.keyDown(document, { key: 'Tab' });
    act(() => b.focus());
    const t = screen.getByRole('tooltip');
    expect(parseFloat(t.style.top)).toBeLessThan(window.innerHeight - 20);
  });
  it('uses hover media for non-mouse pointers that can hover', () => {
    vi.useFakeTimers();
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
    const b = setup();
    fireEvent.pointerOver(b, { pointerType: 'pen' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => b.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
