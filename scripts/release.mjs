import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LIMIT = 2000;
const arg = process.argv[2] ?? 'minor';
if (!['patch', 'minor', 'major', 'auto'].includes(arg)) {
  console.error('Usage: node scripts/release.mjs patch|minor|major|auto');
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

let since = '';
try {
  since = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
} catch {
  since = existsSync('CHANGELOG.md') ? git('log', '-1', '--format=%H', '--', 'CHANGELOG.md') : '';
}

const changed = () =>
  git('diff', '--numstat', since || git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0], 'HEAD', '--', '.', ':(exclude)package-lock.json', ':(exclude)CHANGELOG.md')
    .split('\n')
    .filter(Boolean)
    .reduce((n, l) => {
      const [a, d] = l.split('\t');
      return n + (Number(a) || 0) + (Number(d) || 0);
    }, 0);

let bump = arg;
if (arg === 'auto') {
  if (since && git('rev-list', '--count', `${since}..HEAD`) === '0') {
    console.log('skip');
    process.exit(0);
  }
  const lines = changed();
  bump = lines > LIMIT ? 'minor' : 'patch';
  console.error(`Changed lines since ${since || 'start'}: ${lines}, bump: ${bump}`);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [ma, mi, pa] = pkg.version.split('.').map(Number);
const next = bump === 'major' ? `${ma + 1}.0.0` : bump === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;

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
