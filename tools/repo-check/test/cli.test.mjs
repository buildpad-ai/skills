// The CLI (check.mjs) on fixture repositories built in a temporary directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeRepo, change, git, tempDir, L } from './helpers.mjs';
import { GATE_TEXT } from '../lib/gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(here, '..');
const CHECK = path.join(TOOL, 'check.mjs');

function run(cwd, args, { env = {}, check = CHECK } = {}) {
  const base = { ...process.env };
  delete base.GITHUB_ACTIONS;
  delete base.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [check, ...args], { cwd, env: { ...base, ...env }, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const findingLines = (out) => out.split('\n').filter((l) => /^R\d+[a-z]? /.test(l));

const FM = (name) => ['---', `name: ${name}`, `description: The ${name} skill.`, '---'];
const ENG = '<!-- buildpad-backend: engine -->';
const SUP = '<!-- buildpad-backend: supabase -->';
const END = '<!-- /buildpad-backend -->';
const row = (folder, plan, dependence = 'partial') => ({ folder, dependence, treatment: 't', size: 'small', plan });
const MAP = [
  row('skill-a', 'BP'),
  row('skill-b', 'RW', 'wording only'),
  row('tpl-skill', 'BP'),
  row('agents', 'BP'),
  row('references', 'BP'),
  row('uc-skill', 'UC', 'none'),
];
const FIXTURE = {
  'skill-a/SKILL.md': L(...FM('skill-a'), '', '# A', '', 'Shared.'),
  'skill-b/SKILL.md': L(...FM('skill-b'), '', '# B', '', 'See [a](../skill-a/SKILL.md).'),
  'tpl-skill/SKILL.md': L(...FM('tpl-skill'), '', '# T'),
  'tpl-skill/settings-templates/specs/x.md': L('# Template', '', 'Neutral.'),
  'uc-skill/SKILL.md': L(...FM('uc-skill'), '', '# U'),
  'agents/security-auditor.md': L(...FM('security-auditor'), '', '# Auditor', '', 'Check secrets.'),
  'references/security-checklist.md': L('# Checklist', '', '- item'),
  'README.md': L(
    '# Skills', '', '```bash', 'npx skills add buildpad-ai/skills#v1.0.0', '```', '',
    '| Skill | What it does |', '|---|---|',
    '| [skill-a](skill-a) | A |', '| [skill-b](skill-b) | B |', '| [tpl-skill](tpl-skill) | T |', '| [uc-skill](uc-skill) | U |',
  ),
  'tools/repo-check/skill-map.json': `[\n${MAP.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`,
  // R15's data, minimal: statements with empty `in` lists and no file that carries the check.
  'tools/repo-check/tenancy-statements.json': JSON.stringify({
    opening: 'On an Engine project with Customer_Tenants',
    dependencies: { 'TD-1': 'one' },
    met: [],
    anchors: [{ es: 'ES-9', text: 'the project is one tenant' }],
    tenancyCheck: { file: 'tools/repo-check/tenancy-check.md', in: [] },
    statements: [{ id: 'TS-A', requires: [], until: [], text: 'On an Engine project with Customer_Tenants alpha.', in: [] }],
  }, null, 2),
  'tools/repo-check/tenancy-check.md': L('<!-- tenancy-check:begin v1 -->', 'Check.', '<!-- tenancy-check:end -->'),
};
const converted = (...folders) => Object.fromEntries(folders.map((f) => [`tools/repo-check/converted/${f}`, '']));

test('a clean fixture passes every rule', () => {
  const root = makeRepo(FIXTURE);
  const r = run(root, []);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(findingLines(r.stdout), []);
});

test('usage errors exit 2: an unknown rule, an unknown option', () => {
  const root = makeRepo(FIXTURE);
  assert.equal(run(root, ['--only', 'R99']).code, 2);
  assert.equal(run(root, ['--only', 'R1,R99']).code, 2);
  assert.equal(run(root, ['--bogus']).code, 2);
  assert.equal(run(root, ['--root']).code, 2);
});

test('a missing baseline tag exits 2 with the Error Handling message', () => {
  const root = makeRepo(FIXTURE, { tag: null });
  const r = run(root, []);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /baseline ref v1\.0\.0 not found: fetch tags \(fetch-depth: 0\) or create the tag \(S9\)/);
});

const VIOLATIONS = {
  'agents/security-auditor.md': L(...FM('security-auditor'), '', '# Auditor', '', 'Check secrets.', ENG, 'Never use SUPABASE_SERVICE_ROLE_KEY.', END),
  'references/security-checklist.md': L('# Checklist', '', '<!-- buildpad-backend: engine extra -->', '- item'),
  'tpl-skill/settings-templates/specs/x.md': L('# Template', '', 'Neutral.', ENG, 'await db.rpc("f");', END),
};

test('R1, R2 and R3 on a persona, a top-level reference and a settings-templates file', () => {
  const root = makeRepo(FIXTURE);
  change(root, { ...VIOLATIONS, ...converted('agents', 'references', 'tpl-skill') });
  const r = run(root, ['--only', 'R1,R2,R3']);
  assert.equal(r.code, 1);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), [
    'R1 agents/security-auditor.md:10 service-role',
    'R1 tpl-skill/settings-templates/specs/x.md:5 rpc',
    'R2 references/security-checklist.md:3 malformed-marker',
    'R3 agents/security-auditor.md:1 gate-missing',
    'R3 tpl-skill/SKILL.md:1 gate-missing',
    'R3 tpl-skill/settings-templates/specs/x.md:1 gate-missing',
  ]);
});

test('the converted-folder switch: R1 and R3 skip unconverted folders; R2 does not', () => {
  const root = makeRepo(FIXTURE);
  change(root, VIOLATIONS);
  assert.equal(run(root, ['--only', 'R1,R3']).code, 0);
  const r = run(root, ['--only', 'R2']);
  assert.equal(r.code, 1);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), ['R2 references/security-checklist.md:3 malformed-marker']);
});

test('a converted folder that follows every rule passes', () => {
  const root = makeRepo(FIXTURE);
  change(root, {
    'skill-a/SKILL.md': L(...FM('skill-a'), '', '# A', '', GATE_TEXT, '', SUP, 'Shared.', END, ENG, 'Engine text.', END),
    ...converted('skill-a'),
  });
  const r = run(root, []);
  assert.equal(r.code, 0, r.stdout + r.stderr);
});

test('finding lines and GitHub annotations', () => {
  const root = makeRepo(FIXTURE);
  change(root, VIOLATIONS);
  const r = run(root, ['--only', 'R2'], { env: { GITHUB_ACTIONS: 'true' } });
  assert.match(r.stdout, /^R2 references\/security-checklist\.md:3 malformed-marker .+$/m);
  assert.match(r.stdout, /^::error file=references\/security-checklist\.md,line=3::R2 malformed-marker .+$/m);
});

test('R6a: a Skill-to-Skill link that does not resolve fails in every folder; R6b only in converted ones', () => {
  const root = makeRepo(FIXTURE);
  change(root, {
    'skill-b/SKILL.md': L(...FM('skill-b'), '', '# B', '', 'See [a](../skill-a/NOPE.md).'),
    'skill-a/SKILL.md': L(...FM('skill-a'), '', '# A', '', 'See [ref](./references/missing.md).'),
  });
  const r = run(root, ['--only', 'R6a,R6b']);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), ['R6a skill-b/SKILL.md:8 link-unresolved'], r.stdout + r.stderr);
  change(root, converted('skill-a'));
  const r2 = run(root, ['--only', 'R6a,R6b']);
  assert.deepEqual(findingLines(r2.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), [
    'R6a skill-b/SKILL.md:8 link-unresolved',
    'R6b skill-a/SKILL.md:8 link-unresolved',
  ]);
});

test('R7 and R11 run on the fixture: a UC byte change, a Skill missing from the README', () => {
  const root = makeRepo(FIXTURE);
  change(root, {
    'uc-skill/SKILL.md': L(...FM('uc-skill'), '', '# U!'),
    'README.md': FIXTURE['README.md'].replace('| [uc-skill](uc-skill) | U |\n', ''),
  });
  const r = run(root, ['--only', 'R7,R11']);
  assert.equal(r.code, 1);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), [
    'R7 uc-skill/SKILL.md:6 unchanged-folder-differs',
    'R11 README.md:1 readme-missing-skill',
  ]);
});

test('--tag turns on R13 and the tag checks of R10', () => {
  const root = makeRepo(FIXTURE);
  const r = run(root, ['--only', 'R10,R13', '--tag', 'v2.0.0']);
  assert.equal(r.code, 1);
  const lines = findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' '));
  assert.ok(lines.includes('R10 CHANGELOG.md:1 changelog-missing-tag-section'));
  assert.ok(lines.includes('R13 tools/repo-check/converted/skill-a:1 folder-not-converted'));
  assert.equal(lines.filter((l) => l.startsWith('R13 ')).length, 5);
  assert.equal(run(root, ['--only', 'R10,R13']).code, 0);
});

test('--render writes both views and the Supabase-against-baseline diff', () => {
  const root = makeRepo(FIXTURE);
  change(root, {
    'skill-a/SKILL.md': L(...FM('skill-a'), '', '# A', '', GATE_TEXT, '', SUP, 'Shared.', END, ENG, 'Engine text.', END),
    'skill-a/references/engine.md': L('<!-- buildpad-backend-file: engine -->', GATE_TEXT, '', '# Engine ref'),
    ...converted('skill-a'),
  });
  const out = tempDir();
  const r = run(root, ['--render', out]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const engine = readFileSync(path.join(out, 'engine', 'skill-a', 'SKILL.md'), 'utf8');
  const supabase = readFileSync(path.join(out, 'supabase', 'skill-a', 'SKILL.md'), 'utf8');
  assert.match(engine, /Engine text\./);
  assert.doesNotMatch(engine, /^Shared\.$/m);
  assert.match(supabase, /^Shared\.$/m);
  assert.ok(existsSync(path.join(out, 'engine', 'skill-a', 'references', 'engine.md')));
  assert.ok(!existsSync(path.join(out, 'supabase', 'skill-a', 'references', 'engine.md')));
  assert.ok(existsSync(path.join(out, 'engine', 'agents', 'security-auditor.md')));
  const diff = readFileSync(path.join(out, 'supabase-vs-baseline.diff'), 'utf8');
  assert.match(diff, /^diff --git a\/skill-a\/SKILL\.md b\/skill-a\/SKILL\.md$/m);
  assert.match(diff, /^\+<!-- backend-gate:begin v1 -->$/m);
  assert.doesNotMatch(diff, /uc-skill/);
  assert.ok(!existsSync(path.join(out, '.baseline')));
});

test('R14: front matter that is not YAML fails; R5 alone does not see it', () => {
  const root = makeRepo(FIXTURE);
  change(root, { 'skill-a/SKILL.md': L('---', 'name: skill-a', 'description: The skill-a skill.', 'argument-hint: [name] [prefix, e.g. /iam]', '---', '', '# A', '', 'Shared.') });
  const r = run(root, []);
  assert.equal(r.code, 1);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), ['R14 skill-a/SKILL.md:4 front-matter-not-yaml']);
  assert.equal(run(root, ['--only', 'R5']).code, 0);
});

test('the baseline job: a git archive of v1.0.0 checked with R4, R5 and R6a', () => {
  const root = makeRepo(FIXTURE);
  const archive = tempDir();
  const tar = path.join(tempDir(), 'b.tar');
  git(root, 'archive', '--format=tar', '-o', tar, 'v1.0.0');
  execFileSync('tar', ['-xf', tar, '-C', archive]);
  const args = ['--root', archive, '--baseline-ref', 'v1.0.0', '--only', 'R4,R5,R6a', '--skill-map', 'tools/repo-check/skill-map.json'];
  const r = run(root, args);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  // A Skill added to the current map after the baseline has no folder there: not a finding.
  const mapPath = path.join(root, 'tools/repo-check/skill-map.json');
  writeFileSync(mapPath, JSON.stringify([...MAP, row('later-skill', 'BP')]));
  const later = run(root, args);
  assert.equal(later.code, 0, later.stdout + later.stderr);
  // A baseline folder without a row still is.
  writeFileSync(mapPath, JSON.stringify([...MAP.slice(1), row('later-skill', 'BP')]));
  const missing = run(root, args);
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /folder-without-row/);
});

test('R12: the contract test and every shared case, exit 0; one changed expectation, exit 1', () => {
  const copy = tempDir();
  cpSync(TOOL, path.join(copy, 'tools', 'repo-check'), { recursive: true });
  const check = path.join(copy, 'tools', 'repo-check', 'check.mjs');
  assert.equal(run(copy, ['--only', 'R12'], { check }).code, 0);
  const casesPath = path.join(copy, 'tools', 'repo-check', 'contract', 'cases.json');
  const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
  cases.guardCases[0].ids = ['rest'];
  writeFileSync(casesPath, JSON.stringify(cases, null, 2));
  const r = run(copy, ['--only', 'R12'], { check });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^R12 tools\/repo-check\/test\/contract\.test\.mjs:\d+ contract-test-failed .*rpc positive/m);
});

test('R15: accepted by --only, R16 is not; an altered statement fails with file and line', () => {
  const root = makeRepo(FIXTURE);
  assert.equal(run(root, ['--only', 'R15']).code, 0);
  assert.equal(run(root, ['--only', 'R16']).code, 2);
  change(root, { 'skill-a/SKILL.md': L(...FM('skill-a'), '', '# A', '', ENG, 'On an Engine project with Customer_Tenants alphA.', END) });
  const r = run(root, ['--only', 'R15']);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.deepEqual(findingLines(r.stdout).map((l) => l.split(' ').slice(0, 3).join(' ')), ['R15 skill-a/SKILL.md:9 ts-altered']);
});

test('R15: a missing or non-JSON data file exits 2 and names it', () => {
  const root = makeRepo(FIXTURE);
  change(root, { 'tools/repo-check/tenancy-statements.json': null });
  const r = run(root, ['--only', 'R15']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /tenancy-statements\.json/);
  change(root, { 'tools/repo-check/tenancy-statements.json': '{ not json' });
  assert.equal(run(root, ['--only', 'R15']).code, 2);
  assert.equal(run(root, ['--only', 'R2']).code, 0);
});
