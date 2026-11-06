import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workspace, report } from './helpers.mjs';

const data = (name) => JSON.parse(readFileSync(new URL(`../check/data/${name}.json`, import.meta.url), 'utf8'));

test('我们 is a dictionary candidate only in documents, not UI, chat or instructions', (t) => {
  const w = workspace(t);
  const entry = data('avoid').find((item) => item.avoid === '我们');
  assert.deepEqual(entry.profiles, ['for-document']);
  for (const profile of ['for-document', 'for-web-dev', 'for-chat', 'for-instruction-writing']) {
    const r = report(w.run(['--json', '--profile', profile], '我们保存草稿。'));
    assert.equal(r.files[0].extraction.segments, 1);
    const findings = r.files[0].issues.filter((i) => i.lexicon?.avoid === '我们');
    assert.equal(findings.length, profile === 'for-document' ? 1 : 0, profile);
    if (profile === 'for-document') {
      assert.equal(findings[0].rule, 'D1');
      assert.equal(findings[0].level, 'warning');
    }
  }
});

test('avoid advice and examples preserve known facts and the original public-function scope', (t) => {
  const w = workspace(t);
  const entries = data('avoid');
  const advice = [
    ['系统异常。', 'for-web-dev', '出错 / 异常（界面报错里）', '写清哪项操作失败；只补已有依据的原因、影响和恢复动作'],
    ['优化了页面性能。', 'for-document', '优化 / 提升 / 改善（不带对象和数字时）', '优先写已有依据的具体变化；只支持定性结论时保留定性，不编数字'],
  ];
  for (const [text, profile, avoid, use] of advice) {
    assert.equal(entries.find((e) => e.avoid === avoid).use, use);
    const r = report(w.run(['--json', '--profile', profile], text));
    const findings = r.files[0].issues.filter((i) => i.lexicon?.avoid === avoid);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'warning');
    assert.ok(findings[0].suggestion.includes(use), findings[0].suggestion);
  }
  assert.deepEqual(entries.find((e) => e.avoid === '出错 / 异常（界面报错里）').examples, [
    { before: '系统异常，请稍后再试。', after: '保存失败，原因尚未确定。' },
  ]);
  assert.deepEqual(entries.find((e) => e.avoid === '建议 / 最好 / 尽量').examples, [
    { before: '最好为每个公开函数写注释。', after: '宜为每个公开函数写注释。' },
  ]);
});

test('recommended meanings and examples keep recovery, data and timing conditions explicit', () => {
  const entries = data('recommended');
  const expected = [
    ['删除', '去掉目标对象；是否可恢复由产品实际行为决定', '删除这份报告。', ['for-web-dev', 'for-document']],
    ['取消', '停止一个还没有完成的操作；中间结果是否保留须另行确认', '取消这次上传。', ['for-web-dev']],
    ['关闭', '让窗口、面板、弹窗或文件不再显示；数据处理与后台状态须另行说明', '关闭“设置”窗口。', ['for-web-dev']],
    ['停用', '让一项功能或一个账号暂停生效；数据保留和重新启用条件以产品规则为准', '停用这个账号。', ['for-web-dev']],
    ['失败', '操作未达到预期结果；不表示没有部分完成或副作用', '保存失败，原因尚未确定。', ['for-web-dev']],
  ];
  for (const [word, meaning, example, profiles] of expected) {
    const entry = entries.find((e) => e.word === word);
    assert.ok(entry, word);
    assert.equal(entry.meaning, meaning, word);
    assert.equal(entry.example, example, word);
    assert.deepEqual(entry.profiles, profiles, word);
  }
  const examples = [
    ['提交', '提交这份申请。'], ['发布', '发布这篇文章。'], ['同步', '同步手机和电脑上的笔记。'],
    ['警告', '确认不可恢复时写“警告：删除后，数据不能恢复。”'],
    ['注意', '已确认文件上限为 20 MB 时写“注意：文件超过 20 MB 时上传会失败。”'],
    ['说明', '产品支持该快捷键时写“说明：按住 Shift 可以多选。”'],
  ];
  for (const [word, example] of examples) assert.equal(entries.find((e) => e.word === word).example, example, word);
  assert.deepEqual(entries.find((e) => e.word === '取消').not_same_as, {
    撤销: '把已经完成的操作恢复到操作前', 关闭: '让窗口或面板不再显示，不代表取消后台操作',
  });
});
