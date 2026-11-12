import { describe, expect, it } from 'vitest';

const css = import.meta.glob<string>('../../styles/*.css', { query: '?raw', import: 'default', eager: true });

describe('typography and links', () => {
  it('uses only the weights the font file has', () => {
    const all = Object.values(css).join('\n');
    expect(all.match(/font-weight:\s*(800|900|bolder)/g) ?? []).toEqual([]);
    expect(css['../../styles/base.css']).toContain('b,strong{font-weight:700}');
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
