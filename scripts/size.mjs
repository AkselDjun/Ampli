import { readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = 'dist/assets';
const budget = { js: 100 * 1024, css: 25 * 1024, total: 280 * 1024 };

const kb = n => `${(n / 1024).toFixed(1)} kB`;
const rows = readdirSync(dir)
  .filter(f => /\.(js|css)$/.test(f))
  .map(f => {
    const buf = readFileSync(join(dir, f));
    return { f, ext: f.endsWith('.css') ? 'css' : 'js', raw: buf.length, gz: gzipSync(buf, { level: 9 }).length };
  })
  .sort((a, b) => b.gz - a.gz);

const total = rows.reduce((s, r) => s + r.gz, 0);
const fails = [];
for (const r of rows) if (r.gz > budget[r.ext]) fails.push(`${r.f}: ${kb(r.gz)} > ${kb(budget[r.ext])}`);
if (total > budget.total) fails.push(`total: ${kb(total)} > ${kb(budget.total)}`);

const lines = ['| File | Size | Gzip |', '| --- | ---: | ---: |', ...rows.map(r => `| ${r.f} | ${kb(r.raw)} | ${kb(r.gz)} |`), `| **Total** | | **${kb(total)}** |`];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Bundle size\n\n${lines.join('\n')}\n`);

if (fails.length) {
  console.error(`\nBundle size budget exceeded:\n${fails.join('\n')}`);
  process.exit(1);
}
