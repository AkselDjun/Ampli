import { describe, expect, it } from 'vitest';
import { HOTKEYS, hotkeyOf, stepIn } from '../../core/hotkeys';

const k = (code: string, key = '', o: Partial<{ ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }> = {}) => ({ code, key, ctrl: false, meta: false, alt: false, shift: false, ...o });

describe('горячие клавиши', () => {
  it('узнаёт клавиши по месту на клавиатуре, в любой раскладке', () => {
    expect(hotkeyOf(k('KeyJ', 'о'))).toBe('next');
    expect(hotkeyOf(k('KeyK', 'k'))).toBe('prev');
    expect(hotkeyOf(k('KeyN', 'т'))).toBe('add');
    expect(hotkeyOf(k('KeyS', 'ы'))).toBe('pick');
    expect(hotkeyOf(k('KeyE', 'у'))).toBe('edit');
    expect(hotkeyOf(k('Slash', '?', { shift: true }))).toBe('help');
    expect(hotkeyOf(k('Comma', 'б', { shift: true }))).toBe('help');
    expect(hotkeyOf(k('Digit7', '?', { shift: true }))).toBe('help');
    expect(hotkeyOf(k('KeyJ', 'J', { shift: true }))).toBeNull();
  });

  it('не перехватывает сочетания с Ctrl, Cmd и Alt', () => {
    expect(hotkeyOf(k('KeyJ', 'j', { ctrl: true }))).toBeNull();
    expect(hotkeyOf(k('KeyN', 'n', { meta: true }))).toBeNull();
    expect(hotkeyOf(k('KeyK', 'k', { alt: true }))).toBeNull();
    expect(hotkeyOf(k('KeyQ', 'q'))).toBeNull();
  });

  it('список для справки называет каждую клавишу', () => {
    expect(HOTKEYS.map(h => h.keys.join(' '))).toContain('J');
    expect(HOTKEYS.every(h => h.keys.length && h.label)).toBe(true);
  });

  it('шагает по списку без выхода за края', () => {
    const ids = ['a', 'b', 'c'];
    expect(stepIn(ids, 'a', 1)).toBe('b');
    expect(stepIn(ids, 'c', 1)).toBe('c');
    expect(stepIn(ids, 'a', -1)).toBe('a');
    expect(stepIn(ids, null, 1)).toBe('a');
    expect(stepIn(ids, 'x', -1)).toBe('c');
    expect(stepIn([], null, 1)).toBeNull();
  });
});
