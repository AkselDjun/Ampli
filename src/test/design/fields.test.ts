import { describe, expect, it } from 'vitest';
import tokens from '../../styles/tokens.css?raw';

const sheets = import.meta.glob<string>('../../styles/*.css', { query: '?raw', import: 'default', eager: true });
const app = Object.entries(sheets).filter(([f]) => !f.endsWith('/tokens.css')).map(([, css]) => css).join('\n');

const rules = (css: string): { sel: string; body: string }[] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));

const field = /(^|[\s>+~,])(input|select|textarea)\b/;
const special = /\.pm-in|\.pal-in/;
const sized = /^\s*(height|min-height|border-radius|font-size|padding(-[a-z]+)?|border(-width)?)\s*:/;

const media = (css: string, q: string): string => {
  const i = css.indexOf('@media ' + q + '{');
  expect(i, q).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}}', i) + 2);
};

describe('form fields', () => {
  it('defines one set of field tokens', () => {
    for (const t of ['--field-h:44px', '--field-h-s:36px', '--field-px:var(--s-3)', '--field-r:var(--r-s)', '--field-fs:var(--t-base)', '--field-bw:1px', '--check-s:20px', '--check-bw:1.5px', '--check-edge:var(--line-strong)']) expect(tokens).toContain(t);
    expect(media(tokens, '(--tablet)')).toContain('--field-h:48px;--field-h-s:44px');
    expect(media(tokens, '(--tablet),(pointer:coarse)')).toContain('--field-fs:16px');
  });

  it('styles inputs, selects and textareas from one base rule', () => {
    const base = rules(app).find(r => r.sel.startsWith('input:where('));
    expect(base?.sel).toBe('input:where(:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color])),select,textarea');
    for (const d of ['font-size:var(--field-fs)', 'border:var(--field-bw) solid var(--line-strong)', 'border-radius:var(--field-r)', 'padding:0 var(--field-px)', 'height:var(--field-h)', 'background:var(--field)']) expect(base?.body).toContain(d);
  });

  it('never sizes a field with raw pixels outside the panel keypad and the palette', () => {
    const bad: string[] = [];
    for (const r of rules(app)) {
      if (!field.test(r.sel) || special.test(r.sel)) continue;
      for (const d of r.body.split(';')) if (sized.test(d) && /\d+px/.test(d) && !/\b0px\b/.test(d)) bad.push(r.sel + ' { ' + d.trim() + ' }');
    }
    expect(bad).toEqual([]);
  });

  it('does not repaint field borders or radii per screen', () => {
    const bad = rules(app).filter(r => field.test(r.sel) && !special.test(r.sel) && !r.sel.startsWith('input:where(') && r.sel !== 'input[type=checkbox]' && r.sel !== 'input[type=radio]' && /(^|;)\s*border(-color)?\s*:\s*[^;]*var\(--line(-strong)?\)/.test(r.body)).map(r => r.sel);
    expect(bad).toEqual([]);
  });

  it('keeps the search box and the stepper the same height as a field', () => {
    const body = (s: string) => rules(app).find(r => r.sel === s)?.body ?? '';
    expect(body('.search')).toContain('height:var(--field-h)');
    expect(body('.step')).toContain('height:var(--field-h)');
    expect(body('.search input')).toContain('height:100%');
    expect(app).not.toMatch(/\.app \.step\{height:/);
  });

  it('draws every checkbox at one size', () => {
    const cb = rules(app).find(r => r.sel === 'input[type=checkbox]');
    expect(cb?.body).toContain('width:var(--check-s);height:var(--check-s)');
    const bad = rules(app).filter(r => /\binput\b/.test(r.sel) && r.sel !== 'input[type=checkbox]' && r.sel !== 'input[type=radio]' && /(^|;)\s*width:20px/.test(r.body)).map(r => r.sel);
    expect(bad).toEqual([]);
  });

  it('uses compact fields only through the compact token', () => {
    for (const s of ['.tcalc input', '.photo-list input', 'input.price-in']) {
      const r = rules(app).find(x => x.sel === s);
      expect(r?.body, s).toContain('height:var(--field-h-s)');
    }
  });
});
