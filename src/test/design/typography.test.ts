import { describe, expect, it } from 'vitest';

const css = import.meta.glob<string>('../../styles/*.css', { query: '?raw', import: 'default', eager: true });

describe('typography and links', () => {
  it('uses only the weights the font file has', () => {
    const all = Object.values(css).join('\n');
    expect(all.match(/font-weight:\s*(800|900|bolder)/g) ?? []).toEqual([]);
    expect(css['../../styles/base.css']).toContain('b,strong{font-weight:700}');
  });

  it('sets font sizes only from the type scale and keeps text below 11 px for panel labels', () => {
    const screens = Object.entries(css).filter(([f]) => !/\/(tokens|print)\.css$/.test(f));
    const raw = screens.flatMap(([f, s]) => (s.match(/font-size:\s*\d[\d.]*(px|rem|em)\b/g) ?? []).map(m => f + ' ' + m));
    expect(raw).toEqual([]);
    const small = screens.flatMap(([f, s]) => (s.match(/[^{}]+\{[^{}]*font-size:var\(--t-hw[^{}]*\}/g) ?? []).filter(r => !/\.(pmb|dev-cap)/.test(r)).map(r => f + ' ' + r.trim().slice(0, 60)));
    expect(small).toEqual([]);
  });

  it('takes every corner radius from the radius scale', () => {
    const raw = Object.entries(css).filter(([f]) => !/\/(tokens|print)\.css$/.test(f)).flatMap(([f, s]) => (s.match(/radius:[^;}]*/g) ?? []).filter(d => /(?<![\w-])(\d*\.?\d+px|\d+%)/.test(d.replace(/var\([^)]*\)/g, ''))).map(d => f + ' ' + d));
    expect(raw).toEqual([]);
  });

  it('colors links from the palette and keeps link chips like other chips', () => {
    expect(css['../../styles/base.css']).toContain('a{color:var(--accent)}');
    expect(css['../../styles/kit.css']).toContain('a.chip{color:var(--ink);text-decoration:none}');
  });

  it('keeps interface text at 11 px or larger, print excluded', () => {
    const screen = Object.entries(css).filter(([f]) => !f.endsWith('/print.css')).map(([, c]) => c).join('\n');
    const small = [...screen.matchAll(/font(?:-size)?:[^;}]*?\b([0-9]+(?:\.[0-9]+)?)px/g)].map(m => Number(m[1])).filter(n => n < 11);
    expect(small).toEqual([]);
  });
});
