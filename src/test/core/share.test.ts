import { describe, expect, it } from 'vitest';
import { deflateSync, strToU8 } from 'fflate';
import { QR_MAX_BYTES, SHARE_PREFIX, SHARE_VERSION, packProject, qrSvg, readShareHash, shareUrl, unpackProject } from '../../core/share';
import { sampleProject } from '../../core/project';
import { calcAll } from '../../core/calc';

describe('project packing', () => {
  const p = sampleProject();
  it('round-trips lines, config and metadata', () => {
    const q = unpackProject(packProject(p));
    expect(q).not.toBeNull();
    expect(q!.name).toBe(p.name);
    expect(q!.lines.length).toBe(p.lines.length);
    expect(q!.cfg).toEqual(p.cfg);
    expect(q!.lines.map(l => l.apps.map(a => [a.name, a.w, a.n]))).toEqual(p.lines.map(l => l.apps.map(a => [a.name, a.w, a.n])));
  });
  it('gives the same calculation after the round trip', () => {
    const q = unpackProject(packProject(p))!;
    const a1 = calcAll(p.lines, p.cfg);
    const a2 = calcAll(q.lines, q.cfg);
    expect(a2.rows.map(r => [r.r.In, r.r.S])).toEqual(a1.rows.map(r => [r.r.In, r.r.S]));
    expect(a2.P).toBeCloseTo(a1.P, 6);
  });
  it('creates new ids for the receiver', () => {
    const q = unpackProject(packProject(p))!;
    expect(q.id).not.toBe(p.id);
    expect(q.lines[0].id).not.toBe(p.lines[0].id);
  });
  it('is url safe', () => {
    expect(packProject(p)).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  });
  it('rejects wrong prefix, garbage, bad json and non-projects', () => {
    expect(unpackProject('x')).toBeNull();
    expect(unpackProject('v2.abc')).toBeNull();
    expect(unpackProject(SHARE_VERSION + '!!!')).toBeNull();
    const bad = SHARE_VERSION + btoa(String.fromCharCode(...deflateSync(strToU8('{oops')))).replace(/=+$/, '');
    expect(unpackProject(bad)).toBeNull();
    const notProject = SHARE_VERSION + btoa(String.fromCharCode(...deflateSync(strToU8('{"a":1}')))).replace(/=+$/, '');
    expect(unpackProject(notProject)).toBeNull();
  });
  it('trims whitespace', () => {
    expect(unpackProject('  ' + packProject(p) + '\n')).not.toBeNull();
  });
});

describe('urls and hash', () => {
  const p = sampleProject();
  it('builds a link replacing an old hash', () => {
    const u = shareUrl(p, 'https://example.com/ampli/#old');
    expect(u.startsWith('https://example.com/ampli/' + SHARE_PREFIX + SHARE_VERSION)).toBe(true);
    expect(u.split('#').length).toBe(2);
  });
  it('reads the hash', () => {
    expect(readShareHash('#p=abc')).toBe('abc');
    expect(readShareHash('#p=')).toBeNull();
    expect(readShareHash('#x=1')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });
});

describe('qr', () => {
  it('renders svg for a short text', () => {
    const s = qrSvg('https://example.com/#p=abc');
    expect(s).toMatch(/^<svg/);
  });
  it('returns null when the text is too long', () => {
    expect(qrSvg('a'.repeat(QR_MAX_BYTES + 1))).toBeNull();
  });
  it('fits a sample project link', () => {
    const u = shareUrl(sampleProject(), 'https://akseldjun.github.io/Ampli/');
    expect(u.length).toBeLessThan(QR_MAX_BYTES);
    expect(qrSvg(u)).not.toBeNull();
  });
  it('counts bytes, not characters', () => {
    expect(qrSvg('я'.repeat(1200))).toBeNull();
  });
});
