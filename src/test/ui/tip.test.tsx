import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tip } from '../../ui/common';

describe('Tip', () => {
  it('toggles on click and exposes the text as tooltip', () => {
    const { container } = render(<Tip>Пояснение</Tip>);
    const b = screen.getByRole('button', { name: 'Подсказка' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.tip')).toHaveClass('on');
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Пояснение');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on outside pointer down and keeps open on inside', () => {
    render(<div><Tip>Текст</Tip><span>вне</span></div>);
    const b = screen.getByRole('button', { name: 'Подсказка' });
    fireEvent.click(b);
    fireEvent.pointerDown(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByText('вне'));
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape without reaching other listeners', () => {
    render(<Tip label="Справка">Текст</Tip>);
    const b = screen.getByRole('button', { name: 'Справка' });
    fireEvent.click(b);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(b).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  describe('placement', () => {
    const setup = (rect: Partial<DOMRect>, size: { w: number; h: number }, view: { w: number; h: number }) => {
      Object.defineProperty(document.documentElement, 'clientWidth', { value: view.w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: view.h, configurable: true });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(size.w);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(size.h);
      const full = { left: 0, top: 0, right: 0, bottom: 0, width: 24, height: 24, x: 0, y: 0, toJSON: () => ({}), ...rect } as DOMRect;
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
      render(<Tip>Текст</Tip>);
      fireEvent.click(screen.getByRole('button', { name: 'Подсказка' }));
      return screen.getByRole('tooltip', { hidden: true }) as HTMLElement;
    };
    afterEach(() => vi.restoreAllMocks());

    it('keeps the text inside the left edge', () => {
      const t = setup({ left: 4, right: 28, top: 50, bottom: 74 }, { w: 300, h: 80 }, { w: 390, h: 800 });
      expect(t.style.left).toBe('8px');
      expect(t.style.top).toBe('80px');
    });
    it('keeps the text inside the right edge', () => {
      const t = setup({ left: 360, right: 384, top: 50, bottom: 74 }, { w: 300, h: 80 }, { w: 390, h: 800 });
      expect(t.style.left).toBe('82px');
    });
    it('centres under the button when there is room', () => {
      const t = setup({ left: 400, right: 424, top: 50, bottom: 74 }, { w: 200, h: 60 }, { w: 1000, h: 800 });
      expect(t.style.left).toBe('312px');
    });
    it('opens above the button when there is no room below', () => {
      const t = setup({ left: 100, right: 124, top: 740, bottom: 764 }, { w: 200, h: 80 }, { w: 390, h: 800 });
      expect(t.style.top).toBe('654px');
    });
    it('stays on screen when it fits neither above nor below', () => {
      const t = setup({ left: 100, right: 124, top: 20, bottom: 44 }, { w: 200, h: 90 }, { w: 390, h: 100 });
      expect(Number.parseInt(t.style.top, 10)).toBeGreaterThanOrEqual(8);
    });
    it('re-places on resize and scroll while open and on hover', () => {
      const t = setup({ left: 100, right: 124, top: 50, bottom: 74 }, { w: 200, h: 60 }, { w: 390, h: 800 });
      t.style.left = '0px';
      fireEvent(window, new Event('resize'));
      expect(t.style.left).not.toBe('0px');
      t.style.left = '0px';
      fireEvent.scroll(document);
      expect(t.style.left).not.toBe('0px');
      t.style.left = '0px';
      fireEvent.mouseEnter(t.parentElement as HTMLElement);
      expect(t.style.left).not.toBe('0px');
    });
  });
});
