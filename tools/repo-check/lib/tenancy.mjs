// R15: the Tenancy statements and the Tenancy check (customer-tenant-skills, design
// "Repository_Check: rule R15"). Pure apart from reading its two data files once.
import { readFileSync } from 'node:fs';
import { fencedBlocks, isMarkdownPath } from './markdown.mjs';
import { viewLines } from './passages.mjs';

export const TENANCY = JSON.parse(readFileSync(new URL('../tenancy-statements.json', import.meta.url), 'utf8'));
export const TENANCY_CHECK_TEXT = readFileSync(new URL('../tenancy-check.md', import.meta.url), 'utf8');

const BEGIN = '<!-- tenancy-check:begin';
const END = '<!-- tenancy-check:end -->';

const MESSAGES = {
  'ts-altered': 'a paragraph holds the reserved opening but is not a Tenancy statement word for word',
  'ts-outside-engine': 'a Tenancy statement or the Tenancy check outside Engine-only text',
  'ts-a-missing': 'a section whose Engine view holds an ES-3, ES-4, ES-5, ES-7 or ES-9 anchor without TS-A',
  'ts-held-back': 'a Tenancy statement copied before its dependency is met',
  'ts-retired': 'a Tenancy statement copied after it was retired',
  'ts-required-missing': 'a live Tenancy statement missing from a file its `in` list names',
  'tenancy-check-altered': 'a copy of the Tenancy check that differs from tools/repo-check/tenancy-check.md',
  'tenancy-check-missing': 'the Tenancy check is missing from a file that must carry it',
  'tenancy-check-misplaced': 'a copy of the Tenancy check in a file that must not carry it',
};

const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const unquote = (s) => s.replace(/^\s*(?:>\s?)+/, '');

// Numbered lines of a text, without the empty segment after a final newline.
function numbered(text) {
  const segs = text.split('\n');
  if (segs.length > 1 && segs.at(-1) === '') segs.pop();
  return segs.map((seg, i) => ({ line: i + 1, seg }));
}

// Paragraphs of numbered lines: fences skipped, blockquote markers removed, white space made
// one space; a heading is a paragraph of its own.
function paragraphsOf(entries) {
  const ls = entries.map((e) => e.seg.replace(/\r$/, ''));
  const { inside } = fencedBlocks(ls);
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur) out.push({ line: cur.line, text: collapse(cur.parts.join(' ')) });
    cur = null;
  };
  ls.forEach((raw, i) => {
    if (inside[i]) return flush();
    const t = unquote(raw);
    if (t.trim() === '') return flush();
    if (/^#{1,6}\s/.test(t.trim())) {
      flush();
      out.push({ line: entries[i].line, text: collapse(t) });
      return;
    }
    if (!cur) cur = { line: entries[i].line, parts: [] };
    cur.parts.push(t);
  });
  flush();
  return out;
}

// Sections of numbered lines: from a `# ` or `## ` heading outside a fence to the next.
function sectionsOf(entries) {
  const ls = entries.map((e) => e.seg.replace(/\r$/, ''));
  const { inside } = fencedBlocks(ls);
  const starts = [];
  ls.forEach((l, i) => {
    if (!inside[i] && /^#{1,2} /.test(l) && i > 0) starts.push(i);
  });
  const bounds = [0, ...starts, ls.length];
  const out = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    if (bounds[k] === bounds[k + 1]) continue;
    out.push({ from: bounds[k], to: bounds[k + 1] });
  }
  return out;
}

/** Paragraphs of a text: `{line, text}[]`. */
export function paragraphs(text) {
  return paragraphsOf(numbered(text));
}

/** Sections of a text: `{line, endLine}[]` (1-based, inclusive). */
export function sections(text) {
  const entries = numbered(text);
  return sectionsOf(entries).map((s) => ({ line: entries[s.from].line, endLine: entries[s.to - 1].line }));
}

// The numbered lines of one view, mapped to the raw file's lines; null when the view is absent.
function viewEntries(f, keep) {
  if (f.views[keep] === null) return null;
  if (f.views[keep] === f.text) return numbered(f.text);
  const { kept } = viewLines(f.text, keep);
  if (kept.length && kept.at(-1).seg === '' && f.text.endsWith('\n')) kept.pop();
  return kept;
}

const isLive = (s, met) => s.requires.every((d) => met.includes(d)) && !s.until.some((d) => met.includes(d));

/**
 * R15 findings for `files` (`[{path, text, views: {engine, supabase}}]`), against `data` (the
 * shape of tenancy-statements.json) and `checkText` (tenancy-check.md).
 */
export function tenancyFindings(files, data = TENANCY, checkText = TENANCY_CHECK_TEXT) {
  const findings = [];
  const add = (p, line, code) => findings.push({ rule: 'R15', path: p, line, code, message: MESSAGES[code] });
  const byText = new Map(data.statements.map((s) => [s.text, s]));
  const met = data.met ?? [];
  const canonical = checkText.replace(/\r\n/g, '\n');
  const checkIn = new Set(data.tenancyCheck.in);
  const copies = new Map(); // path -> Set of statement ids in its Engine view
  const md = files.filter((f) => f.text !== null && isMarkdownPath(f.path));
  const byPath = new Map(md.map((f) => [f.path, f]));

  for (const f of md) {
    const eng = viewEntries(f, 'engine');
    const sup = viewEntries(f, 'supabase');
    const ids = new Set();
    copies.set(f.path, ids);

    // The reserved opening in the Supabase view (shared text included) is outside Engine-only
    // text; a paragraph reported so is not read again from the Engine view.
    const outside = new Set();
    for (const p of sup ? paragraphsOf(sup) : []) {
      if (!p.text.includes(data.opening)) continue;
      outside.add(p.line);
      add(f.path, p.line, 'ts-outside-engine');
    }
    for (const p of eng ? paragraphsOf(eng) : []) {
      if (!p.text.includes(data.opening) || outside.has(p.line)) continue;
      const s = byText.get(p.text);
      if (!s) {
        add(f.path, p.line, 'ts-altered');
        continue;
      }
      ids.add(s.id);
      if (s.requires.some((d) => !met.includes(d))) add(f.path, p.line, 'ts-held-back');
      else if (s.until.some((d) => met.includes(d))) add(f.path, p.line, 'ts-retired');
    }

    // TS-A next to every anchor of ES-3, ES-4, ES-5, ES-7 and ES-9.
    const tsA = data.statements.find((s) => s.id === 'TS-A');
    if (eng && tsA) {
      for (const sec of sectionsOf(eng)) {
        const part = eng.slice(sec.from, sec.to);
        let acc = '';
        let anchorLine = null;
        for (const e of part) {
          acc = collapse(`${acc} ${unquote(e.seg.replace(/\r$/, ''))}`);
          if (data.anchors.some((a) => acc.includes(a.text))) {
            anchorLine = e.line;
            break;
          }
        }
        if (anchorLine === null) continue;
        if (!paragraphsOf(part).some((p) => p.text === tsA.text)) add(f.path, anchorLine, 'ts-a-missing');
      }
    }

    // The Tenancy check: copies outside fences of the raw file.
    const raw = numbered(f.text);
    const ls = raw.map((e) => e.seg.replace(/\r$/, ''));
    const { inside } = fencedBlocks(ls);
    const supLines = new Set((sup ?? []).map((e) => e.line));
    let found = 0;
    for (let i = 0; i < ls.length; i++) {
      if (inside[i] || !ls[i].trim().startsWith(BEGIN)) continue;
      found++;
      const line = raw[i].line;
      if (supLines.has(line)) add(f.path, line, 'ts-outside-engine');
      if (!checkIn.has(f.path)) {
        add(f.path, line, 'tenancy-check-misplaced');
        continue;
      }
      let j = i;
      while (j < ls.length && ls[j].trim() !== END) j++;
      const copy = `${ls.slice(i, j + 1).join('\n')}\n`;
      if (copy !== canonical) add(f.path, line, 'tenancy-check-altered');
    }
    if (checkIn.has(f.path) && found === 0) add(f.path, 1, 'tenancy-check-missing');
  }

  for (const p of checkIn) if (!byPath.has(p)) add(p, 1, 'tenancy-check-missing');

  for (const s of data.statements) {
    if (!isLive(s, met)) continue;
    for (const p of s.in) {
      if (!copies.get(p)?.has(s.id)) add(p, 1, 'ts-required-missing');
    }
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  return findings.sort((a, b) => cmp(a.path, b.path) || a.line - b.line || cmp(a.code, b.code));
}
