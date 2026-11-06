// Turns a file into text segments to check. Each segment keeps its position in the file.

const CJK = /[一-鿿]/;
const DISABLE = 'stc-disable-next-line';

const mask = (s) => s.replace(/[^\r\n]/g, ' ');
const protectLiterals = (text) => text
  .replace(/(`+)[\s\S]*?\1/g, mask)
  .replace(/https?:\/\/\S+/g, mask)
  .replace(/\]\([^)]*\)/g, (s) => ']' + mask(s.slice(1)))
  .replace(/<!--.*?-->/g, mask)
  .replace(/\{[^{}]*\}/g, mask)
  .replace(/(?:\.{0,2}\/|~\/|\/)[A-Za-z0-9_\u4e00-\u9fff./%?=&#+\-]+/g, mask);

// Adapted from STC's syntax-quote masking; metadata remains fully protected here.
function markdownQuotationLines(text) {
  const chars = text.split('');
  const tags = /<[A-Za-z][\w:-]*(?:\s+(?:[^\s<>"'=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?))*\s*\/?>/g;
  const attributes = /(\s+[^\s<>"'=]+\s*=\s*)(["'])([\s\S]*?)\2/g;
  for (const tag of text.matchAll(tags)) {
    for (const attribute of tag[0].matchAll(attributes)) {
      const first = tag.index + attribute.index + attribute[1].length;
      chars[first] = ' ';
      chars[first + attribute[3].length + 1] = ' ';
    }
  }
  return chars.join('').split(/\r?\n/);
}

/** Markdown and plain text: skip code, URLs, comments, and STC's own bad examples (lines with ✗). */
export function segmentsFromMarkdown(text) {
  const segments = [];
  const quotationLines = markdownQuotationLines(text);
  let fence = null;
  let inComment = false;
  let skipNext = false;
  let frontmatter = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    const trimmed = raw.trim();
    if (i === 0 && trimmed === '---') { frontmatter = true; return; }
    if (frontmatter) { if (trimmed === '---' || trimmed === '...') frontmatter = false; return; }
    if (fence) {
      const close = trimmed.match(/^(`+|~+)\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return;
    }
    const open = trimmed.replace(/^(?:[-+*]|\d+[.)])\s+/, '').match(/^(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      return;
    }
    if (inComment) {
      if (raw.includes('-->')) inComment = false;
      return;
    }
    if (/^\s*<!--.*stc-disable-next-line.*-->\s*$/.test(raw)) {
      skipNext = true;
      return;
    }
    if (skipNext) {
      skipNext = false;
      return;
    }
    if (trimmed.startsWith('<!--')) {
      if (!raw.includes('-->')) inComment = true;
      return;
    }
    if (raw.includes('✗')) return;
    if (/^\s*\[[^\]]+\]:\s*\S+/.test(raw)) return;
    if (/^\s*(?:>| {4}|\t)/.test(raw)) return;
    const line = protectLiterals(raw);
    if (CJK.test(line)) {
      const segment = { line: i + 1, col: 1, text: line };
      const quotationText = line.split('').map((ch, col) => quotationLines[i][col] !== raw[col] ? ' ' : ch).join('');
      if (quotationText !== line) segment.quotationText = quotationText;
      segments.push(segment);
    }
  });
  return segments;
}

/** Code files: keep string literals and JSX text that contain Chinese; skip comments. */
export function segmentsFromCode(text) {
  const segments = [];
  let line = 1;
  let col = 1;
  let disabledLine = -1;
  let i = 0;

  const advance = (ch) => {
    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  };
  const push = (startLine, startCol, value) => {
    if (CJK.test(value) && startLine !== disabledLine) segments.push({ line: startLine, col: startCol, text: protectLiterals(value) });
  };

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const comment = text.slice(i, end === -1 ? text.length : end);
      if (comment.includes(DISABLE)) disabledLine = line + 1;
      for (const c of comment) advance(c);
      i += comment.length;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const comment = text.slice(i, end === -1 ? text.length : end + 2);
      if (comment.includes(DISABLE)) disabledLine = line + comment.split('\n').length;
      for (const c of comment) advance(c);
      i += comment.length;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const startLine = line;
      const startCol = col;
      let value = '';
      advance(ch);
      i += 1;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') {
          value += mask(text.slice(i, i + 2));
          advance(text[i]);
          advance(text[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (ch === '`' && text[i] === '$' && text[i + 1] === '{') {
          const start = i;
          advance(text[i++]);
          advance(text[i++]);
          let depth = 1;
          while (i < text.length) {
            if (text[i] === '{') depth += 1;
            if (text[i] === '}') depth -= 1;
            advance(text[i]);
            i += 1;
            if (depth === 0) break;
          }
          value += mask(text.slice(start, i));
          continue;
        }
        if (ch !== '`' && text[i] === '\n') break;
        value += text[i];
        advance(text[i]);
        i += 1;
      }
      advance(ch);
      i += 1;
      push(startLine, startCol + 1, value);
      continue;
    }
    if (ch === '>') {
      const startLine = line;
      const startCol = col + 1;
      let j = i + 1;
      while (j < text.length && !'<{};'.includes(text[j])) j += 1;
      const value = text.slice(i + 1, j);
      if (CJK.test(value) && text[j] === '<') {
        push(startLine, startCol, value);
      }
    }
    advance(ch);
    i += 1;
  }
  return segments;
}

export function isCodeFile(path) {
  return /\.(tsx?|jsx?|mjs|cjs|vue|svelte|astro|html?)$/i.test(path);
}
