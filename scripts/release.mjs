import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const bump = process.argv[2] ?? 'minor';
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/release.mjs patch|minor|major');
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [ma, mi, pa] = pkg.version.split('.').map(Number);
const next = bump === 'major' ? `${ma + 1}.0.0` : bump === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;

let since = '';
try {
  since = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
} catch {
  since = existsSync('CHANGELOG.md') ? git('log', '-1', '--format=%H', '--', 'CHANGELOG.md') : '';
}
const range = since ? [`${since}..HEAD`] : [];
const merges = git('log', ...range, '--merges', '--first-parent', '--format=%s%x1f%b%x1e')
  .split('\x1e')
  .map(x => x.trim())
  .filter(Boolean)
  .map(x => {
    const [subject, body] = x.split('\x1f');
    const no = (subject.match(/#(\d+)/) ?? [])[1];
    const branch = (subject.match(/ from \S+?\/(\S+)$/) ?? [])[1];
    const title = (body ?? '').split('\n').map(s => s.trim()).find(Boolean) ?? branch ?? subject;
    return { no, title };
  })
  .filter(x => x.no && !/^Bump /.test(x.title));
const deps = git('log', ...range, '--merges', '--first-parent', '--format=%b').split('\n').filter(s => /^Bump /.test(s.trim())).length;

const date = new Date().toISOString().slice(0, 10);
const lines = merges.map(x => `- ${x.title} (#${x.no})`);
if (deps) lines.push(`- Обновления зависимостей: ${deps}`);
if (!lines.length) lines.push('- Мелкие исправления');
const notes = lines.join('\n') + '\n';

const head = '# Журнал изменений\n\n';
const old = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8').replace(head, '') : '';
writeFileSync('CHANGELOG.md', `${head}## ${next} (${date})\n\n${notes}\n${old}`);
writeFileSync('release-notes.md', notes);
execFileSync('npm', ['version', next, '--no-git-tag-version'], { stdio: 'inherit' });
console.log(next);
