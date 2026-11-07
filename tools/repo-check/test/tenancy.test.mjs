// R15: Tenancy statements and the Tenancy check (customer-tenant-skills, design "Repository_Check:
// rule R15"). Fixture texts only; no SKILL.md is committed under tools/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TENANCY, TENANCY_CHECK_TEXT, paragraphs, sections, tenancyFindings } from '../lib/tenancy.mjs';
import { fileBackend, stripBackendPassages } from '../lib/passages.mjs';
import { TOKEN } from '../lib/contract.mjs';
import { L } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ENG = '<!-- buildpad-backend: engine -->';
const SUP = '<!-- buildpad-backend: supabase -->';
const END = '<!-- /buildpad-backend -->';
const FILE_ENG = '<!-- buildpad-backend-file: engine -->';
const FILE_SUP = '<!-- buildpad-backend-file: supabase -->';

const OPEN = 'On an Engine project with Customer_Tenants';
const A = `${OPEN} alpha is the Blueprint.`;
const B = `${OPEN} bravo signs in without a header.`;
const CN = `${OPEN} charlie is built in the Blueprint, no Releases yet.`;
const CM = `${OPEN} charlie is built in the Blueprint and released.`;
const N0 = `${OPEN} nothing is offered yet: stop.`;
const N7 = `${OPEN} moving is not available: stop.`;
const CHECK = L('<!-- tenancy-check:begin v1 -->', '**Establish the tenancy mode.** Read the file.', '', '1. Step one.', '<!-- tenancy-check:end -->');

const DATA = (met = [], extra = {}) => ({
  opening: OPEN,
  dependencies: { 'TD-1': 'one', 'TD-3': 'three' },
  met,
  anchors: [{ es: 'ES-9', text: 'the project is one tenant' }, { es: 'ES-4', text: 'The requests that take their tenant from the header' }],
  tenancyCheck: { file: 'tools/repo-check/tenancy-check.md', in: ['g/SKILL.md', 'g/references/guide.md'] },
  statements: [
    { id: 'TS-A', requires: [], until: [], text: A, in: [] },
    { id: 'TS-B', requires: ['TD-1'], until: [], text: B, in: [] },
    { id: 'TS-Cn', requires: ['TD-1'], until: ['TD-3'], text: CN, in: [] },
    { id: 'TS-Cm', requires: ['TD-3'], until: [], text: CM, in: [] },
    { id: 'TS-N0', requires: [], until: ['TD-1'], text: N0, in: [] },
    { id: 'TS-N7', requires: [], until: [], text: N7, in: [] },
  ],
  ...extra,
});

// The views check.mjs computes.
function file(p, text) {
  const kind = fileBackend(p, text);
  const views = {};
  for (const keep of ['engine', 'supabase']) views[keep] = kind !== null && kind !== keep ? null : stripBackendPassages(text, keep).text;
  return { path: p, text, views };
}
// The two Tenancy check files, present and correct, so a case sees only its own findings.
const CHECK_FILES = [
  file('g/SKILL.md', L('# G', '', ENG, CHECK.trimEnd(), END)),
  file('g/references/guide.md', L(FILE_ENG, '# Guide', '', CHECK.trimEnd())),
];
function run(files, data = DATA()) {
  return tenancyFindings([...CHECK_FILES, ...files], data, CHECK).map((f) => `${f.path}:${f.line} ${f.code}`);
}

test('paragraphs: fences skipped, blockquote markers removed, white space made one space', () => {
  const ps = paragraphs(L('one', 'two', '', '```', 'in fence', '```', '', '> quoted', '> line', '', '## Head', 'after'));
  assert.deepEqual(ps.map((p) => [p.line, p.text]), [[1, 'one two'], [8, 'quoted line'], [11, '## Head'], [12, 'after']]);
});

test('sections: a # or ## heading outside a fence starts one; ### does not', () => {
  const s = sections(L('intro', '# One', 'x', '```', '## not a heading', '```', '### three', '## Two', 'y'));
  assert.deepEqual(s.map((x) => [x.line, x.endLine]), [[1, 1], [2, 7], [8, 9]]);
});

test('ts-altered: one character changed, a sentence added; wrapped and blockquoted copies pass; fences are ignored', () => {
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, A.replace('alpha', 'alphA'), END))]), ['s/SKILL.md:4 ts-altered']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, `${A} And more.`, END))]), ['s/SKILL.md:4 ts-altered']);
  const wrapped = A.replace(' is the', '\nis the');
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, wrapped, '', `> ${A}`, END))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, '```', `${OPEN} anything`, '```', END))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, `- ${A}`, END))]), ['s/SKILL.md:4 ts-altered']);
});

test('ts-outside-engine: shared text, a supabase passage, a file marked supabase fail; engine text passes', () => {
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', A))]), ['s/SKILL.md:3 ts-outside-engine']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', SUP, A, END))]), ['s/SKILL.md:4 ts-outside-engine']);
  assert.deepEqual(run([file('s/references/x.md', L(FILE_SUP, '# X', '', A))]), ['s/references/x.md:4 ts-outside-engine']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, A, END))]), []);
  assert.deepEqual(run([file('s/references/x.md', L(FILE_ENG, '# X', '', A))]), []);
  assert.deepEqual(run([file('s/engine-only/x.md', L('# X', '', A))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', '<!-- tenancy-check:begin v1 -->'))]).sort(),
    ['s/SKILL.md:3 tenancy-check-misplaced', 's/SKILL.md:3 ts-outside-engine'].sort());
});

test('ts-a-missing: a section whose Engine view holds an anchor needs TS-A', () => {
  const es9 = 'On an Engine project the project is one tenant. Every scope begins below it.';
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, es9, END))]), ['s/SKILL.md:4 ts-a-missing']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', es9, '', ENG, A, END))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', es9, '', '## Next', '', ENG, A, END))]), ['s/SKILL.md:3 ts-a-missing']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', es9, '', 'The requests that take their', 'tenant from the header `X-Tenant-Id` are few.', '', ENG, A, END))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', 'Adapted: The requests that take their tenant from the header, in short.'))]), ['s/SKILL.md:3 ts-a-missing']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', SUP, es9, END))]), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', '> On an Engine project the project', '> is one tenant.', '', ENG, A, END))]), []);
});

test('ts-held-back, ts-retired, ts-required-missing follow met', () => {
  const where = (id, paths) => (d) => ({ ...d, statements: d.statements.map((s) => (s.id === id ? { ...s, in: paths } : s)) });
  const copy = (t) => file('s/SKILL.md', L('# S', '', ENG, t, END));
  assert.deepEqual(run([copy(B)]), ['s/SKILL.md:4 ts-held-back']);
  assert.deepEqual(run([copy(B)], DATA(['TD-1'])), []);
  assert.deepEqual(run([copy(CN)], DATA(['TD-1'])), []);
  assert.deepEqual(run([copy(CN)], DATA(['TD-1', 'TD-3'])), ['s/SKILL.md:4 ts-retired']);
  assert.deepEqual(run([copy(CM)], DATA(['TD-1'])), ['s/SKILL.md:4 ts-held-back']);
  assert.deepEqual(run([copy(N0)]), []);
  assert.deepEqual(run([copy(N0)], DATA(['TD-1'])), ['s/SKILL.md:4 ts-retired']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S'))], where('TS-N7', ['s/SKILL.md'])(DATA())), ['s/SKILL.md:1 ts-required-missing']);
  assert.deepEqual(run([copy(N7)], where('TS-N7', ['s/SKILL.md'])(DATA())), []);
  assert.deepEqual(run([], where('TS-N7', ['gone/SKILL.md'])(DATA())), ['gone/SKILL.md:1 ts-required-missing']);
  assert.deepEqual(run([file('s/SKILL.md', L('# S'))], where('TS-B', ['s/SKILL.md'])(DATA())), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S'))], where('TS-B', ['s/SKILL.md'])(DATA(['TD-1']))), ['s/SKILL.md:1 ts-required-missing']);
});

test('the Tenancy check: altered, missing, misplaced; a CRLF copy passes', () => {
  const altered = file('g/SKILL.md', L('# G', '', ENG, CHECK.replace('Step one', 'Step 1').trimEnd(), END));
  assert.deepEqual(tenancyFindings([altered, CHECK_FILES[1]], DATA(), CHECK).map((f) => `${f.path}:${f.line} ${f.code}`), ['g/SKILL.md:4 tenancy-check-altered']);
  assert.deepEqual(tenancyFindings([CHECK_FILES[1]], DATA(), CHECK).map((f) => `${f.path}:${f.line} ${f.code}`), ['g/SKILL.md:1 tenancy-check-missing']);
  const crlf = file('g/SKILL.md', L('# G', '', ENG, CHECK.trimEnd(), END).replace(/\n/g, '\r\n'));
  assert.deepEqual(tenancyFindings([crlf, CHECK_FILES[1]], DATA(), CHECK), []);
  assert.deepEqual(run([file('s/SKILL.md', L('# S', '', ENG, CHECK.trimEnd(), END))]), ['s/SKILL.md:4 tenancy-check-misplaced']);
});

test('the repository data file: openings, ids, dependencies, in paths and the Tenancy check text', () => {
  const ids = TENANCY.statements.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 12);
  for (const s of TENANCY.statements) {
    assert.ok(s.text.startsWith(TENANCY.opening), s.id);
    for (const d of [...s.requires, ...s.until]) assert.ok(Object.hasOwn(TENANCY.dependencies, d), `${s.id} ${d}`);
    for (const p of s.in) assert.ok(existsSync(path.join(root, p)), `${s.id} ${p}`);
    assert.ok(!s.text.includes(TOKEN), s.id);
  }
  for (const d of TENANCY.met) assert.ok(Object.hasOwn(TENANCY.dependencies, d), d);
  for (const p of TENANCY.tenancyCheck.in) assert.ok(existsSync(path.join(root, p)), p);
  assert.equal(readFileSync(path.join(root, TENANCY.tenancyCheck.file), 'utf8'), TENANCY_CHECK_TEXT);
  assert.ok(TENANCY_CHECK_TEXT.startsWith('<!-- tenancy-check:begin v1 -->\n'));
  assert.ok(TENANCY_CHECK_TEXT.endsWith('<!-- tenancy-check:end -->\n'));
  assert.ok(!TENANCY_CHECK_TEXT.includes(TOKEN));
  assert.ok(!TENANCY_CHECK_TEXT.includes(TENANCY.opening));
});
