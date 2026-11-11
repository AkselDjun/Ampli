import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { deflateSync, strToU8, zipSync } from 'fflate';
import { normProject, sampleProject } from '../../core/project';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import { fixFor, maxLenFor } from '../../core/fixes';
import { assemble } from '../../core/rooms';
import { SHARE_VERSION, unpackEstimate, unpackProject } from '../../core/share';
import { MAX_UNZIP, parseXlsx } from '../../core/pricelist';
import { APP_MAX, LINE_MAX, MAX_APPS, MAX_LINES, MAX_ROOMS, ROOM_SPLIT_MAX } from '../../core/limits';
import { CLIMITS } from '../../core/norms';
import { pn } from '../../core/format';
import { defaultCfg, mkLine } from '../../core/templates';
import type { Line, Project } from '../../core/types';

const obj = { x: 1 };
const raw = (): Record<string, unknown> => JSON.parse(JSON.stringify(sampleProject()));
const lines = (p: Record<string, unknown>) => p.lines as Record<string, unknown>[];
const apps = (p: Record<string, unknown>) => lines(p).flatMap(l => l.apps as Record<string, unknown>[]);
const link = (o: unknown): string => {
  let s = '';
  deflateSync(strToU8(JSON.stringify(o))).forEach(c => { s += String.fromCharCode(c); });
  return SHARE_VERSION + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const within = (v: unknown, max: number) => {
  const n = pn(v, 0);
  return Number.isFinite(n) && n >= 0 && n <= max;
};
const timed = <T>(fn: () => T): [T, number] => {
  const t = performance.now();
  const r = fn();
  return [r, performance.now() - t];
};

describe('hostile project numbers', () => {
  it.each([1e308, '1e308', Infinity, -1e9, '-99999', '9'.repeat(400)])('clamps the group length %s to the interface limit', len => {
    const p = raw();
    lines(p).forEach(l => { l.len = len; });
    const q = normProject(p) as Project;
    q.lines.forEach(l => expect(within(l.len, LINE_MAX.len)).toBe(true));
  });

  it('keeps fix suggestions fast for a project that came with absurd lengths', () => {
    const p = raw();
    lines(p).forEach(l => { l.len = 1e308; });
    const q = normProject(p) as Project;
    const a = calcAll(q.lines, q.cfg);
    const c = cfgN(q.cfg);
    const [, ms] = timed(() => a.rows.map(x => fixFor(x.l, x.r, c)));
    expect(ms).toBeLessThan(2000);
  });

  it('clamps appliance numbers like the editor does', () => {
    const p = raw();
    apps(p).forEach(a => Object.assign(a, { w: 1e308, n: '1e400', m: -5, br: Infinity, cos: 7 }));
    const q = normProject(p) as Project;
    for (const a of q.lines.flatMap(l => l.apps)) {
      expect(within(a.w, APP_MAX.w)).toBe(true);
      expect(within(a.n, APP_MAX.n)).toBe(true);
      expect(within(a.m, APP_MAX.m)).toBe(true);
      expect(within(a.br, APP_MAX.br)).toBe(true);
      expect(within(a.cos, APP_MAX.cos)).toBe(true);
    }
    const a = calcAll(q.lines, q.cfg);
    expect(Number.isFinite(a.Itot)).toBe(true);
  });

  it('clamps network parameters and drops unknown keys', () => {
    const q = normProject({ cfg: { supply: '3', ko: 1e308, alloc: -4, zs: 'abc', margin: obj, method: obj, prot: 'rcd'.repeat(50), evil: 1, __proto__: { polluted: true } }, lines: [] }) as Project;
    expect(q.cfg.supply).toBe(3);
    expect(q.cfg.ko).toBe(CLIMITS.ko[1]);
    expect(q.cfg.alloc).toBe(CLIMITS.alloc[0]);
    expect(q.cfg.zs).toBe(defaultCfg().zs);
    expect(q.cfg.margin).toBeUndefined();
    expect(q.cfg.method).toBe(defaultCfg().method);
    expect(String(q.cfg.prot).length).toBeLessThanOrEqual(16);
    expect('evil' in q.cfg).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('hostile project shapes', () => {
  it('turns objects in text fields into empty strings and drops unknown fields', () => {
    const p = raw();
    Object.assign(p, { name: obj, address: [1], client: obj, author: 5, proto: { date: obj, device: obj, by: obj }, checks: { a: obj, b: 'x', c: true }, created: 'x', updated: 1e308 });
    lines(p).forEach(l => Object.assign(l, { phase: obj, wet: 'yes', out: 1, zone: obj, meas: { zs: obj, ins: '1e308', leak: -1, rcd: 'x' }, sockets: obj, perSocket: 1e308, evil: obj }));
    apps(p).forEach(a => Object.assign(a, { name: obj, alt: 'yes', extra: obj }));
    const q = normProject(p) as Project;
    expect(q.name).toBe('Без названия');
    expect([q.address, q.client, q.author]).toEqual(['', '', '5']);
    expect(q.proto).toEqual({ date: '', device: '', by: '' });
    expect(q.checks).toEqual({ c: true });
    expect(q.created).toBeLessThanOrEqual(Date.now());
    expect(q.updated).toBeLessThanOrEqual(Date.now());
    for (const l of q.lines) {
      expect(l.phase).toBe('L1');
      expect(l.wet).toBeUndefined();
      expect(l.out).toBeUndefined();
      expect(l.zone).toBeUndefined();
      expect(l.sockets).toBeUndefined();
      expect(within(l.perSocket, LINE_MAX.perSocket)).toBe(true);
      expect(Object.values(l.meas ?? {}).every(v => typeof v === 'string' || typeof v === 'number')).toBe(true);
      expect('evil' in l).toBe(false);
      for (const a of l.apps) {
        expect(a.name).toBe('');
        expect(a.alt).toBeUndefined();
        expect('extra' in a).toBe(false);
      }
    }
  });

  it('rejects groups whose type is a prototype key', () => {
    expect(normProject({ cfg: {}, lines: [{ type: 'constructor', apps: [] }] })).toBeNull();
    expect(normProject({ cfg: {}, lines: [{ type: '__proto__', apps: [] }] })).toBeNull();
  });

  it('cleans rooms with broken appliances', () => {
    const q = normProject({ cfg: {}, lines: [], rooms: [{ name: obj, kitchen: 'yes', apps: [null, 5, { name: obj, w: 1e308, n: 1e9, tag: 'p' }, { tag: obj }] }, { apps: obj }] }) as Project;
    expect(q.rooms).toHaveLength(1);
    expect(q.rooms?.[0].name).toBe('');
    expect(q.rooms?.[0].kitchen).toBeUndefined();
    expect(q.rooms?.[0].apps).toHaveLength(1);
    expect(within(q.rooms?.[0].apps[0].n, APP_MAX.n)).toBe(true);
  });

  it('caps the number of groups, appliances and rooms', () => {
    const line = { ...mkLine('Г', 'socket', 10, []), apps: Array.from({ length: MAX_APPS + 50 }, () => ({ name: 'a', w: 100, n: 1 })) };
    const [q, ms] = timed(() => normProject({ cfg: {}, lines: Array.from({ length: MAX_LINES + 500 }, () => line), rooms: Array.from({ length: MAX_ROOMS + 10 }, () => ({ name: 'к', apps: [] })) }) as Project);
    expect(q.lines).toHaveLength(MAX_LINES);
    expect(q.lines[0].apps).toHaveLength(MAX_APPS);
    expect(q.rooms).toHaveLength(MAX_ROOMS);
    expect(ms).toBeLessThan(5000);
  });

  it('gives duplicated group ids from a backup fresh ids', () => {
    const l = mkLine('А', 'light', 5, []);
    const q = normProject({ cfg: {}, lines: [{ ...l, id: 'i1' }, { ...l, id: 'i1' }, { ...l, id: 'x'.repeat(1000) }] }, true) as Project;
    expect(new Set(q.lines.map(x => x.id)).size).toBe(3);
    expect(q.lines[2].id.length).toBeLessThanOrEqual(64);
  });

  it('keeps any random junk from crashing normalisation and calculation', () => {
    fc.assert(fc.property(fc.anything(), fc.array(fc.record({ type: fc.constantFrom('light', 'socket', 'power'), apps: fc.array(fc.dictionary(fc.constantFrom('name', 'w', 'n', 'm', 'br', 'cos', 'alt'), fc.anything())), len: fc.anything(), phase: fc.anything(), meas: fc.anything(), zone: fc.anything() }), { maxLength: 8 }), (cfg, ls) => {
      const q = normProject({ cfg: typeof cfg === 'object' && cfg && !Array.isArray(cfg) ? cfg : {}, lines: ls });
      if (!q) return;
      const a = calcAll(q.lines, q.cfg);
      const c = cfgN(q.cfg);
      a.rows.forEach(x => fixFor(x.l, x.r, c));
      q.lines.forEach(l => {
        expect(typeof l.name).toBe('string');
        expect(within(l.len, LINE_MAX.len)).toBe(true);
      });
    }), { numRuns: 200 });
  });
});

describe('hostile links', () => {
  it('normalises a project link with an absurd length instead of hanging', () => {
    const p = raw();
    lines(p).forEach(l => { l.len = 1e308; });
    const q = unpackProject(link(p)) as Project;
    expect(q.lines.every(l => within(l.len, LINE_MAX.len))).toBe(true);
  });
  it('normalises the project inside an estimate link', () => {
    const p = raw();
    lines(p).forEach(l => { l.len = '1e308'; });
    const e = unpackEstimate(link({ p, prices: { a: 1e308, b: -1, c: obj }, company: obj, contacts: 'c'.repeat(1000) }));
    expect(e?.p.lines.every(l => within(l.len, LINE_MAX.len))).toBe(true);
    expect(e?.contacts).toHaveLength(160);
    expect(e?.prices).toEqual({ a: 1e308 });
  });
});

describe('fix suggestion search', () => {
  const c = cfgN(defaultCfg());
  const linear = (l: Line): number | null => {
    for (let L = Math.floor(pn(l.len, 0)) - 1; L >= 1; L--) {
      const r = calcLine({ ...l, len: L }, c);
      if (r.status !== 'bad' && r.In) return L;
    }
    return null;
  };
  it('finds the same length as a step-by-step search', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 100, max: 9000 }), fc.constantFrom('light', 'socket', 'power'), (len, w, type) => {
      const l = mkLine('Г', type as Line['type'], len, [['П', w, 1]]);
      expect(maxLenFor(l, c)).toBe(linear(l));
    }), { numRuns: 150 });
  });
  it('stays bounded for lengths past the interface limit', () => {
    const l = mkLine('Г', 'power', 1e9, [['П', 9000, 1]]);
    const [r, ms] = timed(() => maxLenFor(l, c));
    expect(r === null || r <= LINE_MAX.len).toBe(true);
    expect(ms).toBeLessThan(200);
  });
});

describe('room assembly', () => {
  it('splits a power appliance into a bounded number of groups', () => {
    const out = assemble([{ id: 'r', name: 'Цех', apps: [{ id: 'a', name: 'Станок', w: 2000, n: 1e9, tag: 'p' }] }]);
    expect(out).toHaveLength(ROOM_SPLIT_MAX);
  });
});

describe('price list archives', () => {
  const sheet = (rows: string) => strToU8('<worksheet><sheetData>' + rows + '</sheetData></worksheet>');
  const good = '<row><c t="inlineStr"><is><t>Наименование</t></is></c><c t="inlineStr"><is><t>Цена</t></is></c></row><row><c t="inlineStr"><is><t>Автомат</t></is></c><c><v>6</v></c></row>';
  it('refuses to inflate a workbook beyond the unpack budget', () => {
    const filler = new Uint8Array(Math.ceil(MAX_UNZIP / 2) + 1).fill(32);
    const files: Record<string, Uint8Array> = { 'xl/worksheets/sheet1.xml': sheet(good) };
    for (let i = 2; i <= 12; i++) files['xl/worksheets/sheet' + i + '.xml'] = filler;
    const zip = zipSync(files, { level: 9 });
    expect(zip.length).toBeLessThan(MAX_UNZIP / 10);
    const [grid, ms] = timed(() => parseXlsx(zip.buffer.slice(0) as ArrayBuffer));
    expect(grid).toEqual([['Наименование', 'Цена'], ['Автомат', '6']]);
    expect(ms).toBeLessThan(5000);
  });
  it('skips a single sheet that declares more than the budget', () => {
    const zip = zipSync({ 'xl/worksheets/sheet1.xml': new Uint8Array(MAX_UNZIP + 1).fill(32) }, { level: 9 });
    expect(parseXlsx(zip.buffer.slice(0) as ArrayBuffer)).toBeNull();
  });
});
