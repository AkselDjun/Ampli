import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrors, readErrors, recordError, resetErrorBurst } from '../../store/errlog';
import { ERR_KEY } from '../../core/errlog';
import { catchError, flushErrors, installErrorCapture, resetErrorCapture } from '../../store/errcatch';
import { ERR_MAX } from '../../core/errlog';

beforeEach(() => {
  localStorage.clear();
  resetErrorCapture();
  resetErrorBurst();
  window.location.hash = '';
});

afterEach(() => resetErrorCapture());

describe('error journal on the device', () => {
  it('records an error with version, time and scrubbed text', () => {
    recordError('error', new TypeError('bad value for ivan@mail.by'), { now: 5000, ver: '0.3.1' });
    const [e] = readErrors();
    expect(e.kind).toBe('error');
    expect(e.msg).toBe('TypeError: bad value for …');
    expect(e.t).toBe(5000);
    expect(e.ver).toBe('0.3.1');
  });
  it('merges repeats and keeps the journal bounded', () => {
    for (let i = 0; i < 3; i++) recordError('rejection', 'same', { now: 100 + i * 10_000 });
    expect(readErrors()).toHaveLength(1);
    expect(readErrors()[0].n).toBe(3);
    for (let i = 0; i < ERR_MAX + 5; i++) recordError('error', 'e' + i, { now: 1_000_000 + i * 10_000 });
    expect(readErrors()).toHaveLength(ERR_MAX);
  });
  it('stops writing when an error repeats in a tight loop', () => {
    for (let i = 0; i < 500; i++) recordError('error', 'loop', { now: 1000 + i });
    expect(readErrors()[0].n).toBeLessThan(100);
  });
  it('notes the open section but never the project link', async () => {
    window.location.hash = '#report/estimate';
    catchError('error', 'x');
    window.location.hash = '#p=SECRETPAYLOAD';
    catchError('error', 'y');
    await flushErrors();
    const log = readErrors();
    expect(log.find(e => e.msg === 'x')?.where).toBe('#report/estimate');
    expect(log.find(e => e.msg === 'y')?.where).toBeUndefined();
    expect(log.every(e => e.ver)).toBe(true);
  });
  it('adds the component stack of a screen crash', () => {
    recordError('render', new Error('crash'), { now: 1, extra: '\n    at Editor\n    at App' });
    expect(readErrors()[0].stack).toContain('at Editor');
  });
  it('survives broken storage', () => {
    localStorage.setItem(ERR_KEY, '{oops');
    expect(readErrors()).toEqual([]);
    recordError('error', 'after', { now: 1 });
    expect(readErrors()[0].msg).toBe('after');
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      expect(() => recordError('error', 'full', { now: 2 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = set;
    }
  });
  it('clears the journal', () => {
    recordError('error', 'x', { now: 1 });
    clearErrors();
    expect(readErrors()).toEqual([]);
    expect(localStorage.getItem(ERR_KEY)).toBeNull();
  });
});

describe('error capture', () => {
  it('catches script errors and unhandled rejections once installed', async () => {
    installErrorCapture(window);
    installErrorCapture(window);
    window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught boom', filename: 'https://x.by/a.js', error: new Error('boom') }));
    const ev = new Event('unhandledrejection') as Event & { reason?: unknown };
    ev.reason = new Error('lost');
    window.dispatchEvent(ev);
    await flushErrors();
    const log = readErrors();
    expect(log.map(e => e.kind)).toEqual(['error', 'rejection']);
    expect(log[0].msg).toBe('Error: boom');
    expect(log[0].n).toBe(1);
    expect(log[1].msg).toBe('Error: lost');
  });
  it('records failed chunk loads separately', async () => {
    installErrorCapture(window);
    const ev = new Event('vite:preloadError') as Event & { payload?: unknown };
    ev.payload = new Error('Failed to fetch dynamically imported module');
    window.dispatchEvent(ev);
    await flushErrors();
    expect(readErrors()[0].kind).toBe('chunk');
  });
  it('ignores extension errors and browser noise', async () => {
    installErrorCapture(window);
    window.dispatchEvent(new ErrorEvent('error', { message: 'x', filename: 'chrome-extension://abc/c.js' }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop limit exceeded' }));
    await flushErrors();
    expect(readErrors()).toEqual([]);
  });
  it('stops listening after reset', async () => {
    installErrorCapture(window);
    resetErrorCapture();
    window.dispatchEvent(new ErrorEvent('error', { message: 'late', error: new Error('late') }));
    await flushErrors();
    expect(readErrors()).toEqual([]);
  });
});

describe('early errors', () => {
  it('keeps the section where the error happened, even if the journal loads later', async () => {
    window.location.hash = '#work/meas';
    catchError('error', new Error('early'));
    window.location.hash = '';
    await flushErrors();
    await vi.waitFor(() => expect(readErrors().find(e => e.msg === 'Error: early')?.where).toBe('#work/meas'));
  });
});
