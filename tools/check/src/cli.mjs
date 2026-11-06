// The check command: checks Chinese text in files, directories or stdin against STC.
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, parse, isAbsolute, sep } from 'node:path';
import { lintText, loadDictionary, PROFILES, STYLES, QUOTES, quoteStyle } from './core.mjs';
import { isCodeFile } from './extract.mjs';
import { formatReport } from './report.mjs';
import { reviewAntiEcho } from './anti-echo.mjs';

// Directories skipped when walking a directory: dependencies, build output, and names that start with ".".
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target']);
const isTextFile = (path) => /\.(md|mdx|markdown|txt)$/i.test(path) || isCodeFile(path);

export const checkHelp = (usage) => `用法：${usage} [选项] <文件或目录...>
  不给路径时读标准输入。
  给目录时，逐层检查其中的 Markdown、文本和代码文件，
  跳过以“.”开头的目录和 node_modules、dist、build 等目录。

选项：
  --profile <场景>   for-chat | for-document | for-web-dev | for-instruction-writing
                     不指定时按文件判断：AGENTS.md、CLAUDE.md、SKILL.md 用 for-instruction-writing，
                      代码文件用 for-web-dev（只查字符串和 JSX 文字），其余用 for-document
  --style <风格>     relax-go（默认弯引号）| tech-doc（直角引号与技术语境提示）
  --quotes <约定>    auto（按风格）| curly | corner | preserve（保留两类引号）
  --format <格式>    text（默认）或 markdown；Markdown 可保存为审查报告
  --json             输出 JSON，供程序或 agent 读取
  --max-errors <n>   错误超过 n 个时返回退出码 1，默认 0
  --no-warnings      只显示错误
  --anti-echo        有未复核的 G20 疑点时返回 1
  --review-decisions <文件>  读取 Anti-Echo 保留理由，与 --anti-echo 一起用
  --                 后续参数都作为路径；输入路径及父目录不得经过符号链接
  --help             显示本说明

跳过检查：在要跳过的那一行上方写一行含 stc-disable-next-line 的注释。
Markdown 里含“✗”的行（STC 文档里的反例）不检查。
只读，无安装或改写功能。词表匹配与句长仅供语境复核；代码提取不代表渲染覆盖。`;

function parseArgs(argv) {
  const opts = { paths: [], json: false, maxErrors: 0, warnings: true, format: 'text', style: 'relax-go', quotes: 'auto' };
  let pathsOnly = false;
  const value = (flag, index) => {
    const item = argv[index];
    if (!item || item.startsWith('--')) opts.error = `${flag} 后面必须写有效值。`;
    return item;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (pathsOnly) { opts.paths.push(a); continue; }
    if (a === '--') { pathsOnly = true; continue; }
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--no-warnings') opts.warnings = false;
    else if (a === '--anti-echo') opts.antiEcho = true;
    else if (a === '--review-decisions') {
      opts.reviewDecisions = value(a, ++i);
      if (!opts.reviewDecisions || opts.reviewDecisions.startsWith('--')) opts.error = '--review-decisions 后面必须写文件路径。';
    }
    else if (a === '--profile') {
      opts.profile = value(a, ++i);
      if (!opts.profile) opts.error = '--profile 后面必须写场景。';
    }
    else if (a === '--format') {
      opts.format = value(a, ++i);
      if (!['text', 'markdown'].includes(opts.format)) opts.error = '--format 必须为 text 或 markdown。';
    }
    else if (a === '--style') opts.style = value(a, ++i);
    else if (a === '--quotes') opts.quotes = value(a, ++i);
    else if (a === '--max-errors') {
      const raw = value(a, ++i);
      if (!/^\d+$/.test(raw ?? '')) opts.error = '--max-errors 必须为非负整数。';
      opts.maxErrors = Number(raw);
    }
    else if (a.startsWith('-')) opts.error = `未知选项：${a}`;
    else opts.paths.push(a);
  }
  if (!Number.isSafeInteger(opts.maxErrors) || opts.maxErrors < 0) opts.error = '--max-errors 必须为非负安全整数。';
  if (opts.reviewDecisions && !opts.antiEcho) opts.error = '--review-decisions 必须与 --anti-echo 一起使用。';
  if (!STYLES.includes(opts.style)) opts.error = `未知风格：${opts.style}。可选：${STYLES.join('、')}`;
  if (!QUOTES.includes(opts.quotes)) opts.error = `未知引号约定：${opts.quotes}。可选：${QUOTES.join('、')}`;
  return opts;
}

function selectedInfo(path) {
  // Check each original component before resolve() can erase a symlink via "..".
  const absolute = isAbsolute(path) ? path : `${process.cwd()}${sep}${path}`;
  const root = parse(absolute).root;
  const parts = absolute.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  let info = lstatSync(root);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`路径经过符号链接，未读取：${path}`);
    if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`父路径不是目录，未读取：${path}`);
  }
  return info;
}

function readSelectedFile(path) {
  if (!selectedInfo(path).isFile()) throw new Error(`不是普通文件，未读取：${path}`);
  return readFileSync(resolve(path), 'utf8');
}

function collectFiles(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const info = lstatSync(path);
    // A selected directory must not expand through a symlink into unrelated files.
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      if (!name.startsWith('.') && !SKIP_DIRS.has(name)) collectFiles(path, out);
    } else if (info.isFile() && isTextFile(name)) {
      out.push(path);
    }
  }
  return out;
}

// Returns the exit code: 0 passed, 1 more errors than --max-errors, 2 bad arguments or paths.
export function runCheck(argv, { usage = 'node <技能目录>/tools/check.mjs' } = {}) {
  const opts = parseArgs(argv);
  if (opts.error) {
    console.error(opts.error);
    return 2;
  }
  if (opts.profile && !PROFILES.includes(opts.profile)) {
    console.error(`未知场景：${opts.profile}。可选：${PROFILES.join('、')}`);
    return 2;
  }
  if (opts.help) {
    console.log(checkHelp(usage));
    return 0;
  }

  let inputs;
  let dictionary;
  let decisions;
  try {
    if (opts.paths.length) {
      const files = new Map();
      for (const path of opts.paths) {
        const info = selectedInfo(path);
        if (!info.isDirectory() && !info.isFile()) throw new Error(`不是普通文件或目录，未读取：${path}`);
        for (const file of info.isDirectory() ? collectFiles(resolve(path), []) : [resolve(path)]) files.set(resolve(file), resolve(file));
      }
      if (!files.size) throw new Error('所选目录没有可检查的文件；未完成内容检查。');
      inputs = [...files.values()].map((path) => ({ path, text: readSelectedFile(path) }));
    } else if (process.stdin.isTTY) {
      throw new Error(`请指定文件或目录，或通过标准输入传入文字。\n\n${checkHelp(usage)}`);
    } else {
      inputs = [{ path: 'stdin.md', text: readFileSync(0, 'utf8') }];
    }
    if (inputs.every(({ text }) => !text.trim())) throw new Error('输入为空；未完成内容检查。');
    dictionary = loadDictionary();
    if (opts.reviewDecisions) {
      decisions = JSON.parse(readSelectedFile(opts.reviewDecisions));
      reviewAntiEcho([], decisions);
    }
  } catch (error) {
    console.error(`无法检查输入或复核数据：${error.message}`);
    return 2;
  }
  let errors = 0;
  let warnings = 0;
  const report = [];
  for (const { path, text } of inputs) {
    const { profile, issues, extraction } = lintText(text, { path, profile: opts.profile, dictionary, style: opts.style, quotes: opts.quotes });
    const shown = opts.warnings ? issues : issues.filter((x) => x.level === 'error' || (opts.antiEcho && x.rule === 'G20'));
    errors += issues.filter((x) => x.level === 'error').length;
    warnings += issues.filter((x) => x.level === 'warning').length;
    report.push({ path, profile, style: opts.style, quotes: quoteStyle(opts.style, opts.quotes), extraction, issues: shown,
      ...(opts.antiEcho ? { contentHash: createHash('sha256').update(text).digest('hex') } : {}) });
  }

  const antiEcho = opts.antiEcho ? reviewAntiEcho(report, decisions) : undefined;
  const result = { style: opts.style, quotes: quoteStyle(opts.style, opts.quotes), errors, warnings, files: report, ...(antiEcho ? { antiEcho } : {}) };
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result, { format: opts.format, showWarnings: opts.warnings }));
  }
  return errors > opts.maxErrors || antiEcho?.pending.length ? 1 : 0;
}
