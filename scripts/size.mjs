import { readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = 'dist/assets';
const budget = { js: 100 * 1024, css: 25 * 1024, initial: 195 * 1024, total: 340 * 1024 };

const html = readFileSync('dist/index.html', 'utf8');
const initialFiles = new Set(
  [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)="\.\/assets\/([^"]+\.(?:js|css))"/g)].map(m => m[1])
);

const kb = n => `${(n / 1024).toFixed(1)} kB`;
const rows = readdirSync(dir)
  .filter(f => /\.(js|css)$/.test(f))
  .map(f => {
    const buf = readFileSync(join(dir, f));
    return { f, ext: f.endsWith('.css') ? 'css' : 'js', raw: buf.length, gz: gzipSync(buf, { level: 9 }).length, initial: initialFiles.has(f) };
  })
  .sort((a, b) => Number(b.initial) - Number(a.initial) || b.gz - a.gz);

const sum = list => list.reduce((s, r) => s + r.gz, 0);
const initial = sum(rows.filter(r => r.initial));
const lazy = sum(rows.filter(r => !r.initial));
const total = initial + lazy;

const fails = [];
if (!initialFiles.size) fails.push('no entry assets found in dist/index.html');
for (const r of rows) if (r.gz > budget[r.ext]) fails.push(`${r.f}: ${kb(r.gz)} > ${kb(budget[r.ext])}`);
if (initial > budget.initial) fails.push(`first screen: ${kb(initial)} > ${kb(budget.initial)}`);
if (total > budget.total) fails.push(`total: ${kb(total)} > ${kb(budget.total)}`);

const lines = [
  '| File | Load | Size | Gzip |',
  '| --- | --- | ---: | ---: |',
  ...rows.map(r => `| ${r.f} | ${r.initial ? 'first screen' : 'lazy'} | ${kb(r.raw)} | ${kb(r.gz)} |`),
  `| **First screen** | | | **${kb(initial)} / ${kb(budget.initial)}** |`,
  `| **Lazy** | | | **${kb(lazy)}** |`,
  `| **Total** | | | **${kb(total)} / ${kb(budget.total)}** |`
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Bundle size\n\n${lines.join('\n')}\n`);

if (fails.length) {
  console.error(`\nBundle size budget exceeded:\n${fails.join('\n')}`);
  process.exit(1);
}
