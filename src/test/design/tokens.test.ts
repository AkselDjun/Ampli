import { describe, expect, it } from 'vitest';

const files = import.meta.glob<string>(['../../**/*.{ts,tsx,css}', '!../../test/**'], { query: '?raw', import: 'default', eager: true });
const tokens = files['../../styles/tokens.css'];
const app = files['../../styles/app.css'];
const runtime = new Set(['--rc', '--i', '--cols']);

const decls = (css: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) out.set(m[1], m[2].trim());
  return out;
};

const blockAfter = (css: string, start: string): string => {
  const i = css.indexOf(start);
  expect(i).toBeGreaterThanOrEqual(0);
  const from = css.indexOf('{', i + start.length - 1) + 1;
  let depth = 1;
  let j = from;
  while (depth > 0 && j < css.length) {
    if (css[j] === '{') depth++;
    if (css[j] === '}') depth--;
    j++;
  }
  return css.slice(from, j - 1);
};

describe('design tokens', () => {
  const light = decls(blockAfter(tokens, ':root{'));
  const darkMedia = decls(blockAfter(tokens, ':root:not([data-theme="light"]){'));
  const darkAttr = decls(blockAfter(tokens, ':root[data-theme="dark"]{'));

  it('keeps the system dark theme and the forced dark theme identical', () => {
    expect([...darkMedia.entries()]).toEqual([...darkAttr.entries()]);
    expect(darkMedia.size).toBeGreaterThan(20);
  });

  it('only overrides tokens that exist in the light theme', () => {
    for (const k of darkMedia.keys()) expect(light.has(k), k).toBe(true);
  });

  it('defines every custom property the app uses', () => {
    const defined = new Set([...light.keys(), ...decls(app).keys(), ...runtime]);
    const missing = new Set<string>();
    for (const [f, text] of Object.entries(files)) {
      for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} in ${f}`);
    }
    expect(Object.keys(files).length).toBeGreaterThan(50);
    expect([...missing]).toEqual([]);
  });

  it('keeps raw colors out of component styles', () => {
    expect(app.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it('declares no token in component styles', () => {
    expect([...decls(app).keys()].filter(k => !runtime.has(k))).toEqual([]);
  });
});
