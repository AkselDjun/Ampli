import { describe, expect, it } from 'vitest';
import { ERR_MAX, ERR_MSG_MAX, ERR_STACK_MAX, addEntry, errorOf, parseLog, scrub } from '../../core/errlog';
import { ignoredError } from '../../core/errnoise';
import { problemReport } from '../../core/problem';
import type { ErrEntry } from '../../core/errlog';

const entry = (o: Partial<ErrEntry> = {}): ErrEntry => ({ kind: 'error', msg: 'boom', t: 1000, first: 1000, n: 1, ...o });

describe('scrub', () => {
  it('drops project links and their payload', () => {
    expect(scrub('open https://akseldjun.github.io/Ampli/#p=eJzLSM3JyVcozy_KSQEAGgQEXQ failed')).toBe('open https://akseldjun.github.io/Ampli/#… failed');
    expect(scrub('bad #e=abc.def and #o=s1.QUJDREVGR0g')).toBe('bad #… and #…');
  });
  it('hides emails, phone numbers and long tokens', () => {
    expect(scrub('mail ivan.petrov@mail.by now')).toBe('mail … now');
    expect(scrub('call +375 (29) 123-45-67 or 8 029 1234567')).toBe('call … or …');
    expect(scrub('key QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0123 end')).toBe('key … end');
  });
  it('strips query strings from urls', () => {
    expect(scrub('at https://x.by/a.js?name=Ivanov:1:2')).toBe('at https://x.by/a.js:1:2');
  });
  it('hides text in quotes, where messages echo user data', () => {
    expect(scrub('Unexpected token \'К\', "Кухня Иванова" is not valid JSON')).toBe('Unexpected token \'…\', "…" is not valid JSON');
  });
  it('keeps technical messages readable', () => {
    expect(scrub('TypeError: Cannot read properties of undefined (reading lines)')).toBe('TypeError: Cannot read properties of undefined (reading lines)');
    expect(scrub('at calcAll (https://akseldjun.github.io/Ampli/assets/index-B1x2.js:1:2345)')).toBe('at calcAll (https://akseldjun.github.io/Ampli/assets/index-B1x2.js:1:2345)');
  });
});

describe('errorOf', () => {
  it('reads Error objects with name, message and stack', () => {
    const e = new RangeError('too far');
    const r = errorOf(e);
    expect(r.msg).toBe('RangeError: too far');
    expect(r.stack).toContain('too far');
  });
  it('reads strings, nulls and plain objects', () => {
    expect(errorOf('nope').msg).toBe('nope');
    expect(errorOf(null).msg).toBe('null');
    expect(errorOf(undefined).msg).toBe('undefined');
    expect(errorOf({ message: 'odd' }).msg).toBe('odd');
    expect(errorOf({ a: 1 }).msg).toBe('[object Object]');
  });
  it('does not throw on hostile values', () => {
    const evil = { get message(): string { throw new Error('x'); } };
    expect(errorOf(evil).msg).toBe('Unknown error');
  });
  it('limits message and stack length and scrubs them', () => {
    const e = new Error('x'.repeat(5000) + ' a@b.by');
    e.stack = 'y'.repeat(20000);
    const r = errorOf(e);
    expect(r.msg.length).toBeLessThanOrEqual(ERR_MSG_MAX);
    expect(r.stack?.length).toBeLessThanOrEqual(ERR_STACK_MAX);
    expect(errorOf(new Error('to a@b.by')).msg).toBe('Error: to …');
  });
});

describe('ignoredError', () => {
  it('ignores browser noise and extensions', () => {
    expect(ignoredError('ResizeObserver loop completed with undelivered notifications.', '')).toBe(true);
    expect(ignoredError('Script error.', '')).toBe(true);
    expect(ignoredError('boom', 'chrome-extension://abc/content.js')).toBe(true);
    expect(ignoredError('boom', 'moz-extension://abc/content.js')).toBe(true);
    expect(ignoredError('boom', 'https://akseldjun.github.io/Ampli/assets/index.js')).toBe(false);
  });
});

describe('addEntry', () => {
  it('adds new entries to the end', () => {
    const log = addEntry([], entry());
    expect(log).toHaveLength(1);
    expect(log[0].n).toBe(1);
  });
  it('merges repeats of the same error into a counter', () => {
    const a = addEntry([], entry({ t: 1000 }));
    const b = addEntry(a, entry({ t: 5000, first: 5000 }));
    expect(b).toHaveLength(1);
    expect(b[0].n).toBe(2);
    expect(b[0].t).toBe(5000);
    expect(b[0].first).toBe(1000);
    expect(a[0].n).toBe(1);
  });
  it('treats the same message from another kind or place as a new error', () => {
    const a = addEntry([], entry());
    expect(addEntry(a, entry({ kind: 'rejection' }))).toHaveLength(2);
    expect(addEntry(a, entry({ stack: 'at other (x.js:1:1)' }))).toHaveLength(2);
  });
  it('moves a repeated error to the end', () => {
    let log = addEntry([], entry({ msg: 'a' }));
    log = addEntry(log, entry({ msg: 'b' }));
    log = addEntry(log, entry({ msg: 'a', t: 9000 }));
    expect(log.map(x => x.msg)).toEqual(['b', 'a']);
  });
  it('keeps only the newest entries', () => {
    let log: ErrEntry[] = [];
    for (let i = 0; i < ERR_MAX + 7; i++) log = addEntry(log, entry({ msg: 'e' + i, t: i }));
    expect(log).toHaveLength(ERR_MAX);
    expect(log[0].msg).toBe('e7');
  });
});

describe('parseLog', () => {
  it('reads a stored log', () => {
    const log = [entry(), entry({ msg: 'b', kind: 'render', stack: 's', where: 'w', ver: '0.3.1' })];
    expect(parseLog(JSON.stringify(log))).toEqual(log);
  });
  it('returns an empty log for broken or hostile data', () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog('')).toEqual([]);
    expect(parseLog('{')).toEqual([]);
    expect(parseLog('{"a":1}')).toEqual([]);
    expect(parseLog('[1, "x", null, {"kind":"hack","msg":"x","t":1,"first":1,"n":1}]')).toEqual([]);
  });
  it('fixes counters and trims oversize fields', () => {
    const raw = JSON.stringify([{ kind: 'error', msg: 'm'.repeat(9000), t: 5, first: 'x', n: -4, stack: 3 }]);
    const [e] = parseLog(raw);
    expect(e.msg.length).toBeLessThanOrEqual(ERR_MSG_MAX);
    expect(e.n).toBe(1);
    expect(e.first).toBe(5);
    expect(e.stack).toBeUndefined();
  });
  it('keeps at most the limit', () => {
    const raw = JSON.stringify(Array.from({ length: ERR_MAX * 3 }, (_, i) => entry({ msg: 'e' + i })));
    expect(parseLog(raw)).toHaveLength(ERR_MAX);
  });
});

describe('problemReport', () => {
  const env = { app: '0.3.1', norms: 'ТКП 339-2022', agent: 'Mozilla/5.0 Test', lang: 'ru-BY', screen: '412×915, ×2.6', online: true, lock: false, storage: 'сохраняется постоянно' };
  it('describes the device and every error without project data', () => {
    const log = [entry({ msg: 'TypeError: x is undefined', stack: 'at calcAll (index.js:1:2)', n: 3, where: 'Отчёт' })];
    const text = problemReport(log, env, Date.UTC(2026, 10, 25, 12, 0), '');
    expect(text).toContain('Ampli 0.3.1');
    expect(text).toContain('Mozilla/5.0 Test');
    expect(text).toContain('412×915');
    expect(text).toContain('TypeError: x is undefined');
    expect(text).toContain('×3');
    expect(text).toContain('at calcAll (index.js:1:2)');
    expect(text).toContain('Отчёт');
    expect(text).toContain('Ошибок: 1');
  });
  it('lists the newest errors first', () => {
    const text = problemReport([entry({ msg: 'old', t: 1 }), entry({ msg: 'new', t: 2 })], env, 3, '');
    expect(text.indexOf('new')).toBeLessThan(text.indexOf('old'));
  });
  it('says when there were no errors and adds the user note', () => {
    const text = problemReport([], env, 0, 'Не открывается смета');
    expect(text).toContain('Ошибок не записано');
    expect(text).toContain('Не открывается смета');
  });
  it('scrubs the user note from contacts and links', () => {
    const text = problemReport([], env, 0, 'пишите на ivan@mail.by, проект #p=AAAA');
    expect(text).not.toContain('ivan@mail.by');
    expect(text).not.toContain('#p=AAAA');
  });
});
