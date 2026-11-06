// Derived from Daimonia STC (MIT); style findings are review evidence, never rewrite instructions.
import { readFileSync } from 'node:fs';
import { issueAdvice } from './advice.mjs';
import { segmentsFromCode, segmentsFromMarkdown, isCodeFile } from './extract.mjs';
import { antiEchoCandidates } from './anti-echo.mjs';

export const PROFILES = ['for-chat', 'for-document', 'for-web-dev', 'for-instruction-writing'];
export const STYLES = ['relax-go', 'tech-doc'];
export const QUOTES = ['auto', 'curly', 'corner', 'preserve'];

const TYPE_RULE = {
  虚动词: 'G4',
  程度词: 'G5',
  模糊量词: 'G5',
  含糊动词: 'G5',
  营销词: 'G6',
  行话: 'G6',
  套话: 'G6',
  口号句式: 'G7',
  翻译腔: 'G3',
  冗余: 'G3',
  强度词: 'I1',
};

const MAX_SENTENCE = 40;
const CJK = '\\u4e00-\\u9fff';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function loadDictionary() {
  const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
  return { avoid: read('avoid'), recommended: read('recommended') };
}

function compileEntry(entry) {
  const patterns = [];
  for (let alt of entry.avoid.split(' / ')) {
    alt = alt.replace(/（[^）]*）/g, '').trim();
    alt = alt.split(' + ')[0].trim();
    if (alt.startsWith('不是 X')) {
      patterns.push(/不是[^。！？\n]{1,30}?而是/g);
    } else if (alt.includes('……')) {
      const [head, tail] = alt.split('……');
      patterns.push(new RegExp(`${escape(head)}[^。！？\\n]{0,30}?${escape(tail)}`, 'g'));
    } else if (alt === '进行') {
      patterns.push(/进行(?!中)/g);
    } else if (alt === '应') {
      // Modal 应 only: skip 应用、对应、响应、应对 and the like, and 不应 (its own entry).
      patterns.push(/(?<![不对相响适回供答呼反])应(?![用对答急聘该当变])/g);
    } else if (alt === '务必') {
      // Nouns ending in 务 followed by 必须 are standard requirements.
      patterns.push(/务必(?!须)/g);
    } else {
      patterns.push(new RegExp(escape(alt), 'g'));
    }
  }
  return patterns;
}

export function detectProfile(path) {
  const base = path.split(/[\\/]/).pop() ?? '';
  if (/^(AGENTS|CLAUDE|SKILL)\.md$/i.test(base)) return 'for-instruction-writing';
  if (isCodeFile(base)) return 'for-web-dev';
  return 'for-document';
}

export function segmentsFor(path, text) {
  if (/\.json$/i.test(path)) return [];
  return isCodeFile(path) ? segmentsFromCode(text) : segmentsFromMarkdown(text);
}

export function quoteStyle(style = 'relax-go', quotes = 'auto') {
  return quotes === 'auto' ? (style === 'tech-doc' ? 'corner' : 'curly') : quotes;
}

function contextAdvice(rule, entry, style) {
  const lead = style === 'tech-doc' ? '技术语境提示：' : '语境提示：';
  let suggestion = rule === 'G4'
    ? '确属虚动词结构时，直接写动作，保留对象和主体。'
    : `先核对本句含义；确有所述问题时，参考：${entry.use}。`;
  suggestion += '项目／官方术语、实际技术含义、固定引用和原有强度优先；不得盲替换。';
  if (rule === 'G5' || rule === 'G6' || rule === 'G7' || rule === 'G4') {
    suggestion += '不从例句补造数字、原因、结果、不可逆性或范围；缺事实时说明未知，草稿可标“【待补：具体事实】”。';
  }
  return {
    title: style === 'tech-doc' ? '技术语境中的用词待确认' : '用词或主体需结合语境确认',
    reason: `${lead}${entry.why}。关键词匹配不能证明本句含义或错误。`,
    suggestion,
  };
}

function locate(segment, index) {
  const before = segment.text.slice(0, index);
  const newlines = before.split('\n').length - 1;
  if (newlines === 0) return { line: segment.line, col: segment.col + index };
  return { line: segment.line + newlines, col: index - before.lastIndexOf('\n') };
}

function sentenceLength(sentence) {
  const cjk = (sentence.match(new RegExp(`[${CJK}]`, 'g')) || []).length;
  const words = (sentence.match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + words;
}

/** Returns a sorted list of issues: { line, col, rule, level, message, match }. */
export function lintSegments(segments, profile, dictionary, { style = 'relax-go', quotes = 'auto' } = {}) {
  const issues = [];
  const entries = dictionary.avoid
    .filter((e) => !e.profiles?.length || e.profiles.includes(profile))
    .map((e) => ({ entry: e, patterns: compileEntry(e) }));
  const chosenQuotes = quoteStyle(style, quotes);

  const add = (segment, index, rule, level, message, match, entry, advice) => {
    issues.push({ ...locate(segment, index), rule, level, message, match,
      ...issueAdvice(rule, message, entry, match), ...(advice ?? {}),
      ...(entry ? { lexicon: { avoid: entry.avoid, type: entry.type } } : {}),
    });
  };
  const scan = (segment, regex, fn, text = segment.text) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text))) fn(m);
  };

  let usesNi = false;
  let usesNin = false;

  for (const original of segments) {
    // Both Chinese quote families protect mentions; selected typography is checked separately.
    const segment = { ...original, text: original.text.replace(/“[^”\n]*”|‘[^’\n]*’|「[^」\n]*」|『[^』\n]*』/g, (s) => ' '.repeat(s.length)) };
    for (const { entry, patterns } of entries) {
      const rule = entry.type === '人称代词' ? (profile === 'for-web-dev' ? 'W1' : 'D1') : TYPE_RULE[entry.type] ?? 'G3';
      for (const pattern of patterns) {
        scan(segment, pattern, (m) =>
          add(segment, m.index, rule, 'warning', `${entry.type}：${entry.why}。请核对语境，参考写法：${entry.use}`,
            m[0], entry, contextAdvice(rule, entry, style)),
        );
      }
    }

    if (profile === 'for-web-dev') {
      scan(segment, /他们|她们|它们|咱们|(?<!其)[他她它](?!们)/g, (m) =>
        add(segment, m.index, 'W1', 'warning', '界面代词可能指代不清；核对对象、固定文本和项目称呼后决定是否写名称', m[0]),
      );
      if (/您/.test(segment.text)) usesNin = true;
      if (/你(?!们)/.test(segment.text)) usesNi = true;
    }
    if (profile === 'for-document') {
      scan(segment, /(?<!其)[他她它]们?/g, (m) =>
        add(segment, m.index, 'D1', 'warning', '文档代词可能指代不清；核对上下文与固定引用后决定是否写名称', m[0]),
      );
    }
    if (profile === 'for-instruction-writing') {
      scan(segment, /必须(?:尽量|尽可能|考虑|避免)/g, (m) =>
        add(segment, m.index, 'I2', 'warning', '可能混用要求与推荐；先确认原强度，不擅自升级或改变权限', m[0]),
      );
    }
    if (profile === 'for-chat') {
      scan(segment, /[！!]/g, (m) => add(segment, m.index, 'C3', 'error', '对话里不得使用感叹号', m[0]));
    }

    for (const candidate of antiEchoCandidates(segment.text, profile)) {
      add(segment, candidate.index, 'G20', 'warning', candidate.message, candidate.match);
    }

    const wrongQuotes = chosenQuotes === 'curly' ? /[「」『』]/g : /[“”‘’]/g;
    const quoteSuggestion = chosenQuotes === 'corner' ? '可编辑中文按当前约定使用「」和嵌套『』。' : '可编辑中文按当前约定使用“”和嵌套‘’。';
    if (chosenQuotes !== 'preserve') scan(original, wrongQuotes, (m) =>
      add(original, m.index, 'G17', 'error', `与本次 ${chosenQuotes} 引号约定不同；固定引用或项目约定使用 --quotes 覆盖`, m[0], undefined,
        { title: '引号与选定约定不一致', reason: '这是显式选择的排版约定，不是普遍语言错误。', suggestion: quoteSuggestion + '固定引文保持原样，可用 --quotes preserve 单独复核。' }),
    );
    scan(original, new RegExp(`"[^"\\n]*[${CJK}][^"\\n]*"`, 'g'), (m) =>
      add(original, m.index, 'G17', 'warning', '可编辑中文中的直引号需按项目／引用约定确认', m[0], undefined,
        { title: '中文直引号待确认', reason: '可能是固定文本或机器字面量，不自动替换。', suggestion: chosenQuotes === 'preserve' ? '保持既有引文约定；先确认是否可编辑。' : quoteSuggestion }),
      original.quotationText ?? original.text,
    );
    scan(original, new RegExp(`[${CJK}][A-Za-z0-9]|[A-Za-z0-9][${CJK}]`, 'g'), (m) =>
      add(segment, m.index, 'G19', 'warning', '中文与英文、数字之间宜空一格', m[0]),
    );

    let start = 0;
    for (const part of original.text.split(/[。！？；|\n]/)) {
      const length = sentenceLength(part);
      if (length > MAX_SENTENCE) {
        add(original, start, 'G12', 'warning', `这一句 ${length} 个字，宜不超过 ${MAX_SENTENCE} 个字；这不是截断上限`, part.trim().slice(0, 12) + '……');
      }
      start += part.length + 1;
    }
  }

  if (usesNi && usesNin) {
    issues.push({ line: segments[0]?.line ?? 1, col: 1, rule: 'W2', level: 'warning', message: '所查文字混用“你”和“您”；核对项目称呼，未验证全站一致性', match: '你 / 您' });
  }

  return issues.sort((a, b) => a.line - b.line || a.col - b.col);
}

export function lintText(text, { path = 'stdin.md', profile, dictionary = loadDictionary(), style = 'relax-go', quotes = 'auto' } = {}) {
  const chosen = profile ?? detectProfile(path);
  if (!PROFILES.includes(chosen)) throw new Error(`未知场景：${chosen}`);
  if (!STYLES.includes(style)) throw new Error(`未知风格：${style}`);
  if (!QUOTES.includes(quotes)) throw new Error(`未知引号约定：${quotes}`);
  const lines = text.split(/\r?\n/);
  const segments = segmentsFor(path, text);
  const issues = lintSegments(segments, chosen, dictionary, { style, quotes }).map((issue) => ({
    ...issueAdvice(issue.rule, issue.message, undefined, issue.match), ...issue, context: lines[issue.line - 1] ?? '',
  }));
  return { profile: chosen, style, quotes: quoteStyle(style, quotes), issues,
    extraction: { kind: /\.json$/i.test(path) ? 'protected-json' : isCodeFile(path) ? 'code-strings' : 'markdown-visible', segments: segments.length, rendered: false },
  };
}
