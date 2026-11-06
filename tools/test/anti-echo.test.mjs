import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workspace, report, issuesFor } from './helpers.mjs';

const source = '报价 100 元（不含税）。\n';
const reason = '报价不含税，删去范围会让客户按含税总价安排预算。';

test('Anti-Echo pending cannot be bypassed by warning hiding or error thresholds', (t) => {
  const w = workspace(t);
  const plain = report(w.run(['--json'], source));
  assert.equal(issuesFor(plain, 'G20').length, 1);
  assert.equal(plain.antiEcho, undefined);
  const r = report(w.run(['--json', '--anti-echo', '--no-warnings', '--max-errors', '999'], source), 1);
  assert.equal(r.antiEcho.pending.length, 1);
  assert.equal(r.antiEcho.accepted.length, 0);
  assert.equal(issuesFor(r, 'G20').length, 1);
  assert.match(r.antiEcho.pending[0].id, /^[a-f0-9]{64}$/);
  const clean = report(w.run(['--json', '--anti-echo'], '报价 100 元。'));
  assert.equal(clean.files[0].extraction.segments, 1);
  assert.equal(clean.antiEcho.pending.length, 0);
});

test('keep needs a reason and exact current content/path binding, with unchanged input bytes', (t) => {
  const w = workspace(t);
  const path = w.write('doc.md', source);
  const pending = report(w.run(['--json', '--anti-echo', 'doc.md']), 1).antiEcho.pending;
  assert.equal(pending.length, 1);
  const decision = { version: 1, decisions: [{ id: pending[0].id, decision: 'keep', reason }] };
  const review = w.write('review.json', JSON.stringify(decision));
  const before = [readFileSync(path), readFileSync(review)];
  const args = ['--json', '--anti-echo', '--review-decisions', 'review.json'];
  const accepted = report(w.run([...args, 'doc.md']));
  assert.equal(accepted.antiEcho.pending.length, 0);
  assert.equal(accepted.antiEcho.accepted.length, 1);
  assert.equal(accepted.antiEcho.accepted[0].reason, reason);
  assert.deepEqual([readFileSync(path), readFileSync(review)], before);
  // Unrelated edits leave the excerpt unchanged but must invalidate the decision.
  w.write('doc.md', source + '联系人：张三。\n');
  const changed = report(w.run([...args, 'doc.md']), 1);
  assert.equal(changed.antiEcho.pending.length, 1);
  assert.equal(changed.antiEcho.accepted.length, 0);
  assert.notEqual(changed.antiEcho.pending[0].id, pending[0].id);
  w.write('moved.md', source);
  const moved = report(w.run([...args, 'moved.md']), 1);
  assert.equal(moved.antiEcho.pending.length, 1);
  assert.notEqual(moved.antiEcho.pending[0].id, pending[0].id);
  // A valid but unknown id is stale data, not a malformed id or a global allowlist.
  w.write('review.json', JSON.stringify({ version: 1, decisions: [{ id: '0'.repeat(64), decision: 'keep', reason }] }));
  assert.equal(report(w.run([...args, 'moved.md']), 1).antiEcho.accepted.length, 0);
});

test('review records reject malformed JSON, invalid versions, missing reasons and duplicate ids', (t) => {
  const w = workspace(t);
  w.write('doc.md', source);
  const item = { id: 'a'.repeat(64), decision: 'keep', reason };
  const invalid = [
    null, {}, { version: 2, decisions: [] }, { version: '1', decisions: [] }, { version: 1, decisions: {} },
    ...[null, {}, { ...item, id: 'example' }, { ...item, decision: 'drop' },
      { ...item, reason: '' }, { ...item, reason: ' \n' }, { ...item, reason: 1 },
    ].map((entry) => ({ version: 1, decisions: [entry] })),
    { version: 1, decisions: [item, item] },
  ];
  for (const data of invalid) {
    w.write('review.json', JSON.stringify(data));
    const r = w.run(['--json', '--anti-echo', '--review-decisions', 'review.json', 'doc.md']);
    assert.equal(r.status, 2, JSON.stringify(data));
    assert.notEqual(r.stderr.trim(), '');
  }
  w.write('review.json', '{ broken');
  assert.equal(w.run(['--anti-echo', '--review-decisions', 'review.json', 'doc.md']).status, 2);
});

test('review ids must be strings, not arrays coercible to a valid hash', (t) => {
  const w = workspace(t);
  w.write('doc.md', source);
  w.write('review.json', JSON.stringify({ version: 1, decisions: [
    { id: ['a'.repeat(64)], decision: 'keep', reason },
  ] }));
  const r = w.run(['--json', '--anti-echo', '--review-decisions', 'review.json', 'doc.md']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /有效的 id/);
});
