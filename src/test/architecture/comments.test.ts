import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['../../**/*.{ts,tsx,css}', '../../../e2e/**/*.ts', '../../../scripts/**/*.mjs'], { query: '?raw', import: 'default', eager: true });

const comment = /(^|[\s;{}(),])\/\/\s|\/\*(\s|\*\s)/;

describe('source code', () => {
  it('has no comments', () => {
    const found = Object.entries(sources).flatMap(([file, text]) =>
      text.split('\n').map((line, i) => ({ file, line: i + 1, text: line })).filter(x => comment.test(x.text))
    );
    expect(found.map(x => x.file + ':' + x.line + ' ' + x.text.trim())).toEqual([]);
  });
});
