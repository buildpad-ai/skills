#!/usr/bin/env node
// Repository_Check (design, Requirement 7): runs R1 to R15 over the checked set.
//
//   node tools/repo-check/check.mjs [--root DIR] [--baseline-ref v1.0.0] [--skill-map FILE]
//                                   [--tag TAG] [--only R1,R2,...] [--render OUT_DIR]
//
// Exit 0: no finding; 1: findings; 2: usage or git error (e.g. the baseline tag is missing).
// Node.js standard library only.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_DIR } from './lib/contract.mjs';
import { decodeUtf8, isMarkdownPath } from './lib/markdown.mjs';
import {
  validateMarkers, validateMarkerPlacement, authoringIssues, fileBackend, stripBackendPassages,
  viewLines, parseMarker,
} from './lib/passages.mjs';
import { scanView } from './lib/guard.mjs';
import { extractLinks, resolveTarget, makeView, isRecordedBreak } from './lib/links.mjs';
import { gateFindings } from './lib/gate.mjs';
import { checkedSet, checkedSetAtRef, topFolders, isWorkTreeRoot, GitError } from './lib/checked-set.mjs';
import { BaselineError, assertRef, readAtRef, supabaseViewFindings, nameFindings } from './lib/baseline.mjs';
import { frontMatterIssues, frontMatterYamlIssues } from './lib/frontmatter.mjs';
import { mapIssues, validateSkillMap, templateIssues, readmeIssues, SKILL_MAP_PATH } from './lib/map.mjs';
import { parseChangeFile, releaseIssues, convertedFindings, CHANGE_DIR, CONVERTED_DIR } from './lib/release.mjs';
import { tenancyFindings } from './lib/tenancy.mjs';

export const RULES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6a', 'R6b', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'];
const USAGE = 'usage: node tools/repo-check/check.mjs [--root DIR] [--baseline-ref v1.0.0] [--skill-map FILE] [--tag TAG] [--only R1,R2,...] [--render OUT_DIR]';

class UsageError extends Error {}

const R2_MESSAGES = {
  'malformed-marker': 'a line holds the marker token but is not a marker (§C13)',
  'unpaired-open': 'a passage opener without its closer',
  'unpaired-close': 'a closer without an open passage',
  nested: 'passages do not nest',
  'unknown-kind': 'a kind other than engine or supabase',
  'straddles-steering': 'a passage holds a kiro-steering marker',
  'misplaced-file-marker': 'a file marker off its one allowed line, or inside an *-only folder',
  'conflicting-scope': 'two file markers, or a passage inside a whole-file-marked file',
  'marker-in-front-matter': 'a marker inside YAML front matter',
  'straddles-fence': 'a marker line inside a fenced code block: a passage holds a fence wholly or not at all (S6)',
  'marker-in-table': 'a marker line inside a Markdown table (S6)',
  'gap-between-passages': 'a blank line between a closer and the opener of the passage that replaces it (S6)',
};

export function parseArgs(argv) {
  const opts = { root: null, baselineRef: 'v1.0.0', skillMap: null, tag: null, only: null, render: null };
  const names = { '--root': 'root', '--baseline-ref': 'baselineRef', '--skill-map': 'skillMap', '--tag': 'tag', '--only': 'only', '--render': 'render' };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let value;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq > 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const key = names[arg];
    if (!key) throw new UsageError(`unknown option ${argv[i]}`);
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
    }
    opts[key] = value;
  }
  if (opts.only !== null) {
    const list = opts.only.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = list.filter((r) => !RULES.includes(r));
    if (unknown.length || list.length === 0) throw new UsageError(`unknown rule ${unknown.join(', ') || '(none)'}: rules are ${RULES.join(', ')}`);
    opts.only = new Set(list);
  } else {
    opts.only = new Set(RULES);
  }
  return opts;
}

// Maps a line of a view back to the raw file's line.
function rawLineOf(text, keep, viewLine) {
  const { kept } = viewLines(text, keep);
  return kept[viewLine - 1]?.line ?? viewLine;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function runContractTest() {
  const testFile = path.join(TOOL_DIR, 'test', 'contract.test.mjs');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', testFile], { encoding: 'utf8', env, maxBuffer: 1 << 26 });
  const rel = 'tools/repo-check/test/contract.test.mjs';
  if (r.status === 0) return [];
  const findings = [];
  const out = r.stdout ?? '';
  const re = /^\s*not ok \d+ - (.+)$/gm;
  let m;
  while ((m = re.exec(out)) !== null) {
    const name = m[1].trim();
    if (name.endsWith('contract.test.mjs')) continue;
    const rest = out.slice(m.index, m.index + 4000);
    const loc = /location: '.*?contract\.test\.mjs:(\d+):\d+'/.exec(rest);
    findings.push({ rule: 'R12', path: rel, line: loc ? Number(loc[1]) : 1, code: 'contract-test-failed', message: name });
  }
  if (findings.length === 0) {
    findings.push({ rule: 'R12', path: rel, line: 1, code: 'contract-test-failed', message: (r.stderr || out).trim().split('\n').slice(-3).join(' ') });
  }
  return findings;
}

function writeFile(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
}

function render(outDir, files, baseline) {
  const out = path.resolve(outDir);
  rmSync(path.join(out, 'engine'), { recursive: true, force: true });
  rmSync(path.join(out, 'supabase'), { recursive: true, force: true });
  const baseDir = path.join(out, '.baseline');
  rmSync(baseDir, { recursive: true, force: true });
  mkdirSync(path.join(out, 'engine'), { recursive: true });
  mkdirSync(path.join(out, 'supabase'), { recursive: true });
  mkdirSync(baseDir, { recursive: true });
  for (const f of files.values()) {
    for (const keep of ['engine', 'supabase']) {
      const view = f.views[keep];
      if (view !== null) writeFile(path.join(out, keep, f.path), view);
    }
  }
  for (const [p, buf] of baseline) if (buf) writeFile(path.join(baseDir, p), buf);
  const r = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '--', '.baseline', 'supabase'], { cwd: out, encoding: 'utf8', maxBuffer: 1 << 28 });
  rmSync(baseDir, { recursive: true, force: true });
  if (r.status !== 0 && r.status !== 1) throw new GitError(`git diff --no-index failed: ${r.stderr}`);
  const diff = r.stdout
    .replace(/^diff --git a\/\.baseline\/(\S+) b\/supabase\/(\S+)$/gm, 'diff --git a/$1 b/$2')
    .replace(/^diff --git a\/\.baseline\/(\S+) b\/\.baseline\/(\S+)$/gm, 'diff --git a/$1 b/$2')
    .replace(/^diff --git a\/supabase\/(\S+) b\/supabase\/(\S+)$/gm, 'diff --git a/$1 b/$2')
    .replace(/^--- a\/\.baseline\//gm, '--- a/')
    .replace(/^\+\+\+ b\/supabase\//gm, '+++ b/');
  writeFileSync(path.join(out, 'supabase-vs-baseline.diff'), diff);
}

/** Runs the check. Returns the exit code; writes findings to `stdout`, errors to `stderr`. */
export function main(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    stderr.write(`${e.message}\n${USAGE}\n`);
    return 2;
  }
  try {
    return runCheck(opts, { stdout, env });
  } catch (e) {
    if (e instanceof BaselineError || e instanceof GitError || e instanceof UsageError) {
      stderr.write(`${e.message}\n`);
      return 2;
    }
    throw e;
  }
}

function runCheck(opts, { stdout, env }) {
  const want = (r) => opts.only.has(r);
  const root = path.resolve(opts.root ?? process.cwd());
  if (!existsSync(root)) throw new UsageError(`--root ${root} does not exist`);
  const workTree = isWorkTreeRoot(root);
  const repo = workTree ? root : process.cwd();
  const dataDir = path.join(root, 'tools', 'repo-check');
  const needsFiles = RULES.filter((r) => r !== 'R12' && r !== 'R10' && r !== 'R13').some(want) || opts.render;
  const needsBaseline = want('R5') || want('R7') || opts.render || (!workTree && needsFiles);

  if (needsBaseline) assertRef(opts.baselineRef, repo);

  // Data files.
  const skillMapPath = opts.skillMap ? path.resolve(opts.skillMap) : path.join(dataDir, 'skill-map.json');
  const needsMap = want('R3') || want('R4') || want('R7') || want('R13');
  let skillMap = [];
  if (needsMap) {
    if (!existsSync(skillMapPath)) throw new UsageError(`skill map ${skillMapPath} not found (--skill-map)`);
    try {
      skillMap = readJson(skillMapPath);
    } catch (e) {
      throw new UsageError(`skill map ${skillMapPath} is not JSON: ${e.message}`);
    }
  }
  // R15's data (customer-tenant-skills): the checked root's own copies, as for the Skill map.
  let tenancy = null;
  if (want('R15')) {
    const statementsPath = path.join(dataDir, 'tenancy-statements.json');
    const checkPath = path.join(dataDir, 'tenancy-check.md');
    if (!existsSync(statementsPath)) throw new UsageError(`tenancy statements ${statementsPath} not found`);
    let data;
    try {
      data = readJson(statementsPath);
    } catch (e) {
      throw new UsageError(`tenancy statements ${statementsPath} is not JSON: ${e.message}`);
    }
    if (!existsSync(checkPath)) throw new UsageError(`tenancy check ${checkPath} not found`);
    tenancy = { data, checkText: readFileSync(checkPath, 'utf8') };
  }
  const convertedDir = path.join(dataDir, 'converted');
  const converted = new Set(existsSync(convertedDir) ? readdirSync(convertedDir).filter((n) => !n.startsWith('.')) : []);
  const changeDir = path.join(dataDir, 'supabase-view-changes');
  const changeFiles = existsSync(changeDir)
    ? readdirSync(changeDir).filter((n) => n.endsWith('.json')).sort()
      .map((n) => parseChangeFile(`${CHANGE_DIR}/${n}`, readFileSync(path.join(changeDir, n), 'utf8')))
    : [];

  const findings = [];
  const add = (fs) => findings.push(...fs);

  // The checked set and its views.
  const files = new Map();
  let baseline = new Map();
  if (needsFiles) {
    const paths = checkedSet(root, { ref: opts.baselineRef, repo });
    for (const p of paths) {
      const buf = readFileSync(path.join(root, p));
      const text = decodeUtf8(buf);
      const kind = fileBackend(p, text);
      const views = {};
      for (const keep of ['engine', 'supabase']) {
        if (kind !== null && kind !== keep) views[keep] = null;
        else views[keep] = text === null ? buf : stripBackendPassages(text, keep).text;
      }
      files.set(p, { path: p, buf, text, kind, views, top: p.split('/')[0] });
    }
    if (needsBaseline) baseline = readAtRef(opts.baselineRef, checkedSetAtRef(opts.baselineRef, { repo }), { repo });
  }
  const paths = [...files.keys()];
  const folders = topFolders(paths);
  const skillFolders = folders.filter((f) => files.has(`${f}/SKILL.md`));
  const textFiles = [...files.values()].filter((f) => f.text !== null);
  const rows = new Map(skillMap.map((r) => [r.folder, r]));

  if (want('R1')) {
    for (const f of textFiles) {
      if (!converted.has(f.top) || f.views.engine === null) continue;
      for (const hit of scanView(f.path, f.views.engine)) {
        const line = hit.id === 'path' ? 1 : rawLineOf(f.text, 'engine', hit.line);
        findings.push({ rule: 'R1', path: f.path, line, code: hit.id, message: 'an Invalid_Instruction in the Engine view (§C20)' });
      }
    }
  }

  if (want('R2')) {
    for (const f of textFiles) {
      const issues = [...validateMarkers(f.text), ...validateMarkerPlacement(f.path, f.text), ...authoringIssues(f.text, f.path)];
      for (const i of issues) findings.push({ rule: 'R2', path: f.path, line: i.line, code: i.code, message: R2_MESSAGES[i.code] });
    }
  }

  if (want('R3')) {
    const texts = new Map([...files.values()].map((f) => [f.path, f.text]));
    const gateRequired = new Set(skillMap.filter((r) => r.plan === 'RW+G').map((r) => r.folder));
    add(gateFindings(texts, { converted, gateRequired }));
  }

  if (want('R4')) {
    add(validateSkillMap(skillMap));
    const markers = new Map();
    for (const f of textFiles) {
      f.text.split('\n').forEach((l, i) => {
        if (!parseMarker(l)) return;
        if (!markers.has(f.top)) markers.set(f.top, []);
        markers.get(f.top).push({ path: f.path, line: i + 1 });
      });
    }
    // Not a work tree: the checked set is the baseline's (the `baseline` job), older than the map.
    add(mapIssues(skillMap, folders, markers, { olderTree: !workTree }));
    for (const c of converted) {
      if (!rows.has(c)) findings.push({ rule: 'R4', path: `${CONVERTED_DIR}/${c}`, line: 1, code: 'converted-without-row', message: `${c} has a converted file but no row in ${SKILL_MAP_PATH}` });
    }
  }

  if (want('R5')) {
    for (const f of textFiles) add(frontMatterIssues(f.path, f.text));
    add(nameFindings({ current: new Map(paths.map((p) => [p, files.get(p).buf])), baseline }));
  }

  if (want('R14')) {
    for (const f of textFiles) add(frontMatterYamlIssues(f.path, f.text));
  }

  // R6a: Skill to another Skill, every folder. R6b: every relative link, converted folders.
  if (want('R6a') || want('R6b')) {
    const viewSets = {};
    for (const keep of ['engine', 'supabase']) viewSets[keep] = makeView(paths.filter((p) => files.get(p).views[keep] !== null));
    const skillSet = new Set(skillFolders);
    for (const f of textFiles) {
      if (!isMarkdownPath(f.path)) continue;
      const reported = new Set();
      for (const keep of ['engine', 'supabase']) {
        const view = f.views[keep];
        if (view === null) continue;
        for (const link of extractLinks(view)) {
          const resolved = resolveTarget(f.path, link.target);
          if (resolved !== null && viewSets[keep].has(resolved)) continue;
          if (resolved === '.') continue;
          const line = rawLineOf(f.text, keep, link.line);
          const key = `${line} ${link.target}`;
          if (reported.has(key)) continue;
          const tTop = resolved?.split('/')[0];
          const skillToSkill = resolved !== null && tTop !== f.top && skillSet.has(tTop);
          if (want('R6a') && skillToSkill) {
            reported.add(key);
            findings.push({ rule: 'R6a', path: f.path, line, code: 'link-unresolved', message: `${link.target} does not resolve in the ${keep} view (Skill to Skill)` });
          } else if (want('R6b') && converted.has(f.top) && !isRecordedBreak(f.path, link.target, 'repository')) {
            reported.add(key);
            findings.push({ rule: 'R6b', path: f.path, line, code: 'link-unresolved', message: `${link.target} does not resolve in the ${keep} view` });
          }
        }
      }
    }
  }

  if (want('R7')) {
    const uc = new Set(skillMap.filter((r) => r.plan === 'UC').map((r) => r.folder));
    const listed = new Set(changeFiles.flatMap((c) => c.entries.map((e) => e.path)));
    add(supabaseViewFindings({ current: new Map(paths.map((p) => [p, files.get(p).buf])), baseline, uc, converted, listed }));
  }

  if (want('R8') || want('R9')) {
    const texts = new Map(textFiles.map((f) => [f.path, f.text]));
    add(templateIssues(paths, texts).filter((f) => want(f.rule)));
  }

  if (want('R10')) {
    for (const c of changeFiles) add(c.issues);
    const changelogPath = path.join(root, 'CHANGELOG.md');
    const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : null;
    add(releaseIssues(changeFiles, changelog, opts.tag));
  }

  if (want('R11')) {
    const readmePath = path.join(root, 'README.md');
    add(readmeIssues(existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null, skillFolders));
  }

  if (want('R12')) add(runContractTest());

  if (want('R15')) add(tenancyFindings(textFiles, tenancy.data, tenancy.checkText));

  if (want('R13') && opts.tag) add(convertedFindings(skillMap, converted));

  if (opts.render) render(opts.render, files, baseline);

  const order = (r) => RULES.indexOf(r);
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  findings.sort((a, b) => order(a.rule) - order(b.rule) || cmp(a.path, b.path) || a.line - b.line || cmp(a.code, b.code));
  const annotate = env.GITHUB_ACTIONS === 'true';
  for (const f of findings) {
    stdout.write(`${f.rule} ${f.path}:${f.line} ${f.code} ${f.message}\n`);
    if (annotate) stdout.write(`::error file=${f.path},line=${f.line}::${f.rule} ${f.code} ${f.message}\n`);
  }
  const ran = RULES.filter(want).filter((r) => r !== 'R13' || opts.tag).join(',');
  stdout.write(findings.length
    ? `repo-check: ${findings.length} finding${findings.length === 1 ? '' : 's'} (${ran})\n`
    : `repo-check: no finding (${ran})\n`);
  return findings.length ? 1 : 0;
}

// Run when invoked as a script (argv[1] may name the file through a symbolic link).
const invokedAsScript = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedAsScript) process.exitCode = main(process.argv.slice(2));
