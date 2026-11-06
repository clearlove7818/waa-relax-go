import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { workspace, report, issuesFor } from './helpers.mjs';

test('CLI accepts documented options and rejects malformed arguments before reading', (t) => {
  const w = workspace(t);
  assert.equal(w.run(['--help']).status, 0);
  for (const profile of ['for-chat', 'for-document', 'for-web-dev', 'for-instruction-writing']) {
    const r = report(w.run(['--json', '--profile', profile], '保存。'));
    assert.equal(r.files[0].profile, profile);
    assert.equal(r.files[0].extraction.segments, 1);
  }
  for (const format of ['text', 'markdown']) {
    const r = w.run(['--format', format], '保存。');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /waa-relax-go 中文审阅/);
    assert.equal(r.stdout.startsWith('# '), format === 'markdown');
  }
  report(w.run(['--json', '--format', 'markdown'], '保存。'));
  for (const args of [
    ['--unknown'], ['--profile', 'other'], ['--style', 'other'], ['--quotes', 'other'],
    ['--format', 'json'], ['--review-decisions', 'missing.json'],
    ...['--profile', '--style', '--quotes', '--format', '--max-errors', '--review-decisions'].map((x) => [x]),
    ...['-1', '1.5', 'NaN', 'Infinity', '1e2', '9007199254740992', ''].map((x) => ['--max-errors', x]),
    ['--max-errors', '--json'], ['--help', '--unknown'],
  ]) {
    const r = w.run(args, '保存。');
    assert.equal(r.status, 2, JSON.stringify(args));
    assert.notEqual(r.stderr.trim(), '', JSON.stringify(args));
    assert.equal(r.stdout, '', JSON.stringify(args));
  }
  const bad = '点击「保存」。';
  report(w.run(['--json', '--max-errors', '1'], bad), 1);
  report(w.run(['--json', '--max-errors', '2'], bad));
  report(w.run(['--json', '--max-errors', '9007199254740991'], bad));
  const warnings = report(w.run(['--json', '--no-warnings'], '进行检查。'));
  assert.equal(warnings.errors, 0);
  assert.ok(warnings.warnings > 0);
  assert.equal(warnings.files[0].issues.length, 0);
  const chat = report(w.run(['--json', '--profile', 'for-chat'], '保存！'), 1);
  assert.equal(issuesFor(chat, 'C3').length, 1);
  assert.equal(issuesFor(report(w.run(['--json', '--profile', 'for-document'], '保存！')), 'C3').length, 0);
  const long = report(w.run(['--json'], '说明'.repeat(25) + '。'));
  assert.equal(issuesFor(long, 'G12').length, 1);
  assert.equal(issuesFor(long, 'G12')[0].level, 'warning');
});

test('empty stdin, empty file and empty/JSON-only directories are not passing checks', (t) => {
  const w = workspace(t);
  for (const input of ['', ' \n\t']) assert.equal(w.run(['--json'], input).status, 2);
  w.write('empty.md', '');
  mkdirSync(join(w.root, 'empty'));
  w.write('json-only/data.json', '{"值":"进行检查"}');
  for (const path of ['empty.md', 'empty', 'json-only', 'missing.md']) {
    const r = w.run(['--json', path]);
    assert.equal(r.status, 2, path);
    assert.notEqual(r.stderr.trim(), '');
  }
  const r = report(w.run(['--json'], '进行检查。'));
  assert.equal(r.files[0].extraction.segments, 1);
  assert.equal(issuesFor(r, 'G4').length, 1);
});

test('selected paths are deduplicated and directory walk stays within documented file types', (t) => {
  const w = workspace(t);
  const input = w.write('docs/a.md', '进行检查。');
  w.write('docs/b.txt', '保存。');
  w.write('docs/view.tsx', 'const view = <p>进行检查。</p>;');
  w.write('docs/data.json', '{"值":"进行检查"}');
  w.write('docs/image.bin', '进行检查。');
  for (const name of ['.hidden', 'node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target']) {
    w.write(`docs/${name}/excluded.md`, '点击「保存」。');
  }
  const r = report(w.run(['--json', 'docs', 'docs/a.md', input, './docs/../docs/a.md']));
  assert.equal(r.files.length, 3);
  assert.equal(new Set(r.files.map((f) => f.path)).size, 3);
  assert.equal(issuesFor(r, 'G4').length, 2);
  assert.equal(r.files.find((f) => f.path.endsWith('view.tsx')).profile, 'for-web-dev');
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'SKILL.md']) {
    w.write(name, '保存。');
    assert.equal(report(w.run(['--json', name])).files[0].profile, 'for-instruction-writing');
  }
  w.write('-draft.md', '进行检查。');
  assert.equal(w.run(['--json', '-draft.md']).status, 2);
  assert.equal(issuesFor(report(w.run(['--json', '--', '-draft.md'])), 'G4').length, 1);
});

test('file links and linked parent directories are rejected; recursive links are not followed', (t) => {
  const w = workspace(t);
  const input = w.write('real/doc.md', '进行检查。');
  symlinkSync(input, join(w.root, 'file.md'));
  symlinkSync(join(w.root, 'real'), join(w.root, 'parent'));
  symlinkSync(join(w.root, 'missing'), join(w.root, 'broken.md'));
  for (const path of ['file.md', 'parent', 'parent/doc.md', 'broken.md']) {
    const r = w.run(['--json', path]);
    assert.equal(r.status, 2, path);
    assert.match(r.stderr, /符号链接/);
  }
  symlinkSync(w.root, join(w.root, 'real/loop'));
  symlinkSync(input, join(w.root, 'real/alias.md'));
  const r = report(w.run(['--json', 'real']));
  assert.equal(r.files.length, 1);
  assert.equal(issuesFor(r, 'G4').length, 1);
});

test('checker leaves all selected file bytes and directory entries unchanged on success and failure', (t) => {
  const w = workspace(t);
  const inputs = [
    w.write('doc.md', Buffer.from('\ufeff进行检查。\r\n点击「保存」。\r\n')),
    w.write('view.js', 'const title = "进行检查";\n'),
    w.write('data.json', '{"进行":"赋能"}\n'),
    w.write('review.json', '{"version":1,"decisions":[]}\n'),
  ];
  const before = inputs.map((path) => readFileSync(path));
  const names = readdirSync(w.root).sort();
  report(w.run(['--json', ...inputs, '--quotes', 'preserve']));
  report(w.run(['--json', ...inputs]), 1);
  assert.equal(w.run(['--quotes', 'bad', ...inputs]).status, 2);
  assert.deepEqual(inputs.map((path) => readFileSync(path)), before);
  assert.deepEqual(readdirSync(w.root).sort(), names);
});

test('a symlink followed by dot-dot is still rejected before path normalization', (t) => {
  const w = workspace(t);
  w.write('real/doc.md', '进行检查。');
  symlinkSync(join(w.root, 'real'), join(w.root, 'parent'));
  for (const path of ['parent/../real/doc.md', join(w.root, 'parent') + '/../real/doc.md']) {
    const r = w.run(['--json', path]);
    assert.equal(r.status, 2, path);
    assert.match(r.stderr, /符号链接/);
  }
  assert.equal(issuesFor(report(w.run(['--json', 'real/../real/doc.md'])), 'G4').length, 1);
  const invalidParent = w.run(['--json', 'real/doc.md/../doc.md']);
  assert.equal(invalidParent.status, 2);
  assert.match(invalidParent.stderr, /不是目录/);
});

test('review file paths use the same symlink checks as input files', (t) => {
  const w = workspace(t);
  const review = w.write('real/review.json', '{"version":1,"decisions":[]}');
  symlinkSync(review, join(w.root, 'review.json'));
  symlinkSync(join(w.root, 'real'), join(w.root, 'parent'));
  for (const path of ['review.json', 'parent/review.json', 'parent/../real/review.json']) {
    const r = w.run(['--json', '--anti-echo', '--review-decisions', path], '保存。');
    assert.equal(r.status, 2, path);
    assert.match(r.stderr, /符号链接/);
  }
  report(w.run(['--json', '--anti-echo', '--review-decisions', 'real/review.json'], '保存。'));
});

test('FIFO input is rejected without blocking, and is skipped during directory walks', { skip: process.platform === 'win32' }, (t) => {
  const w = workspace(t);
  const fifo = join(w.root, 'pipe.md');
  const created = spawnSync('mkfifo', [fifo], { encoding: 'utf8', timeout: 10000 });
  assert.ifError(created.error);
  assert.equal(created.status, 0, created.stderr);
  const r = w.run(['--json', fifo]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /不是普通文件/);
  w.write('visible.md', '进行检查。');
  const walked = report(w.run(['--json', w.root]));
  assert.equal(walked.files.length, 1);
  assert.equal(issuesFor(walked, 'G4').length, 1);
});
