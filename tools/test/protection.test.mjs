import test from 'node:test';
import assert from 'node:assert/strict';
import { workspace, report, issuesFor } from './helpers.mjs';

test('both styles retain all four quote modes and expose real quote failures', (t) => {
  const w = workspace(t);
  for (const style of ['relax-go', 'tech-doc']) {
    for (const quotes of ['auto', 'curly', 'corner', 'preserve']) {
      const chosen = quotes === 'auto' ? (style === 'tech-doc' ? 'corner' : 'curly') : quotes;
      const r = report(w.run(['--json', '--style', style, '--quotes', quotes], '点击“保存”和「取消」。'), chosen === 'preserve' ? 0 : 1);
      assert.equal(r.style, style);
      assert.equal(r.quotes, chosen);
      assert.equal(r.files[0].extraction.segments, 1);
      assert.equal(issuesFor(r, 'G17').length, chosen === 'preserve' ? 0 : 2);
      const straight = report(w.run(['--json', '--style', style, '--quotes', quotes], '点击"保存"。'));
      assert.equal(issuesFor(straight, 'G17').length, 1);
      assert.equal(issuesFor(straight, 'G17')[0].level, 'warning');
    }
    const r = report(w.run(['--json', '--style', style], '进行检查。'));
    assert.equal(issuesFor(r, 'G4').length, 1);
    assert.equal(issuesFor(r, 'G4')[0].level, 'warning');
    assert.match(issuesFor(r, 'G4')[0].reason, /关键词匹配不能证明/);
  }
});

test('quoted mentions are protected but the same unquoted phrase is still a candidate', (t) => {
  const w = workspace(t);
  const r = report(w.run(['--json', '--quotes', 'preserve'], '“进行检查”「进行检查」‘进行检查’『进行检查』\n进行检查。'));
  assert.equal(r.files[0].extraction.segments, 2);
  assert.equal(issuesFor(r, 'G4').length, 1);
  assert.equal(issuesFor(r, 'G4')[0].line, 2);
});

test('JSON keys and values stay protected even when directly selected or malformed', (t) => {
  const w = workspace(t);
  for (const text of ['{"进行":"赋能「保存」"}', '{"进行": broken']) {
    w.write('data.json', text);
    const r = report(w.run(['--json', 'data.json']));
    assert.deepEqual(r.files[0].extraction, { kind: 'protected-json', segments: 0, rendered: false });
    assert.equal(r.files[0].issues.length, 0);
    assert.match(w.run(['data.json']).stdout, /键和值未做中文筛查/);
    assert.match(w.run(['data.json']).stdout, /空提取不证明内容正确/);
  }
  const prose = report(w.run(['--json'], '进行检查。'));
  assert.equal(issuesFor(prose, 'G4').length, 1);
});

test('Markdown protects literal regions without losing later editable text or its position', (t) => {
  const w = workspace(t);
  const text = [
    '---', 'title: "进行检查"', '---',
    '```md', '进行检查。', '```',
    '    进行检查。', '> 进行检查。', '`进行检查`',
    '[保存](https://example.test/进行检查)', '[ref]: /进行检查',
    'https://example.test/进行检查', '/进行检查 {进行检查}',
    '<!-- 进行检查 -->', '<!--', '进行检查。', '-->',
    '<!-- stc-disable-next-line -->', '进行检查。', '✗ 进行检查。',
    '正文：进行检查。',
  ];
  const r = report(w.run(['--json'], text.join('\r\n')));
  assert.ok(r.files[0].extraction.segments > 0);
  const candidates = issuesFor(r, 'G4');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].line, text.length);
  assert.equal(candidates[0].col, 4);
  assert.equal(candidates[0].context, '正文：进行检查。');
  assert.equal(issuesFor(r, 'G17').length, 0);
});

test('code comments, paths, URLs, interpolation and escapes are masked while prose/JSX survive', (t) => {
  const w = workspace(t);
  w.write('view.tsx', [
    '// 进行检查。', '/* 进行检查。 */',
    'const path = "/进行检查";', 'const url = "https://example.test/进行检查";',
    'const tmpl = `保存${进行检查}。`;', 'const escape = "\\u8fdb\\u884c";',
    '// stc-disable-next-line', 'const ignored = "进行检查";',
    'const visible = "进行检查";', 'const view = <p>进行检查。</p>;',
  ].join('\n'));
  const r = report(w.run(['--json', 'view.tsx']));
  assert.equal(r.files[0].extraction.kind, 'code-strings');
  assert.equal(r.files[0].extraction.rendered, false);
  assert.deepEqual(issuesFor(r, 'G4').map((i) => [i.line, i.col]), [[9, 18], [10, 17]]);
  assert.equal(issuesFor(r, 'G17').length, 0);
});

test('profile-scoped dictionary findings do not become global semantic errors', (t) => {
  const w = workspace(t);
  const ui = report(w.run(['--json', '--profile', 'for-web-dev'], '系统异常。'));
  assert.ok(issuesFor(ui, 'G5').some((i) => i.match === '异常' && i.level === 'warning'));
  const doc = report(w.run(['--json', '--profile', 'for-document'], '系统异常。'));
  assert.equal(doc.files[0].extraction.segments, 1);
  assert.equal(issuesFor(doc, 'G5').length, 0);
});

test('HTML attribute delimiters are syntax, but attribute prose and real quotation marks are checked', (t) => {
  const w = workspace(t);
  const text = [
    '<img alt="进行检查" title="保存">',
    '<span title=\'先比较 > 后保存\' data-label="进行检查">保存</span>',
    '<img alt="保存"',
    ' title="进行检查">',
    '<img alt="第一行',
    '进行检查">',
    '<img alt=\'点击"保存"\'>',
    '<img alt="点击「保存」">',
    '正文说"保存"。',
  ];
  const r = report(w.run(['--json'], text.join('\n')), 1);
  assert.ok(r.files[0].extraction.segments > 0);
  assert.deepEqual(issuesFor(r, 'G4').map((i) => [i.line, i.col]), [[1, 11], [2, 37], [4, 9], [6, 1]]);
  assert.deepEqual(issuesFor(r, 'G17').map((i) => [i.line, i.match, i.level]), [
    [7, '"保存"', 'warning'], [8, '「', 'error'], [8, '」', 'error'], [9, '"保存"', 'warning'],
  ]);
  // Neither a broken tag nor prose resembling an assignment grants quote protection.
  for (const input of ['<img alt="进行检查"', '正文 alt="进行检查"。']) {
    const bad = report(w.run(['--json'], input));
    assert.equal(issuesFor(bad, 'G17').length, 1);
    assert.equal(issuesFor(bad, 'G4').length, 1);
  }
});

test('frontmatter end markers protect metadata without swallowing the following prose', (t) => {
  const w = workspace(t);
  for (const end of ['---', '...']) {
    const text = `\ufeff---\r\ntitle: "进行检查「保存」"\r\n${end}\r\n进行检查。\r\n`;
    const r = report(w.run(['--json'], text));
    assert.equal(r.files[0].extraction.segments, 1, end);
    assert.deepEqual(issuesFor(r, 'G4').map((i) => [i.line, i.col]), [[4, 1]], end);
    assert.equal(issuesFor(r, 'G17').length, 0, end);
  }
});

test('long malformed HTML remains bounded and does not suppress prose candidates', (t) => {
  const w = workspace(t);
  for (const prefix of ['a '.repeat(1500), ' '.repeat(2000), 'a= '.repeat(1500)]) {
    const r = report(w.run(['--json'], `<img ${prefix}title="进行检查"`));
    assert.equal(r.files[0].extraction.segments, 1);
    assert.equal(issuesFor(r, 'G4').length, 1);
    assert.equal(issuesFor(r, 'G17').length, 1);
  }
});
