import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readmeIssues, BASELINE_COMMAND } from '../lib/map.mjs';

const L = (...ls) => ls.join('\n') + '\n';
const show = (fs) => fs.map((f) => `${f.rule} ${f.path}:${f.line} ${f.code}`);
const README = (...rows) => L(
  '# Skills',
  '',
  '```bash',
  'npx skills add buildpad-ai/skills#v1.0.0',
  '```',
  '',
  '## Catalog',
  '',
  '| Skill | What it does |',
  '|---|---|',
  ...rows,
);

test('R11: every Skill folder listed once, and the baseline command present', () => {
  const readme = README('| [a](a) | Does a |', '| [b-skill](b-skill/) | Does b, see [a](a) |');
  assert.deepEqual(readmeIssues(readme, ['a', 'b-skill']), []);
  assert.equal(BASELINE_COMMAND, 'npx skills add buildpad-ai/skills#v1.0.0');
});

test('R11: a Skill missing from the catalogue', () => {
  assert.deepEqual(show(readmeIssues(README('| [a](a) | Does a |'), ['a', 'c'])), ['R11 README.md:1 readme-missing-skill']);
});

test('R11: a Skill listed twice', () => {
  const f = readmeIssues(README('| [a](a) | Does a |', '| [a](./a/SKILL.md) | Again |'), ['a']);
  assert.deepEqual(show(f), ['R11 README.md:12 readme-duplicate-skill']);
});

test('R11: agents and references rows are not Skills, and links outside the first cell do not count', () => {
  const readme = README('| [a](a) | Uses [b](b) |', '| [code-reviewer](agents/code-reviewer.md) | Persona |');
  assert.deepEqual(show(readmeIssues(readme, ['a', 'b'])), ['R11 README.md:1 readme-missing-skill']);
});

test('R11: the README lacking the baseline command', () => {
  const readme = README('| [a](a) | Does a |').replace('#v1.0.0', '');
  assert.deepEqual(show(readmeIssues(readme, ['a'])), ['R11 README.md:1 readme-missing-baseline-command']);
  assert.deepEqual(show(readmeIssues(null, ['a'])), ['R11 README.md:1 readme-missing']);
});

// This repository's README (task 3.1): all 64 Skills once, and the v1.0.0 command.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('R11 passes on this repository README', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const skills = readdirSync(root).filter((d) => existsSync(path.join(root, d, 'SKILL.md')));
  assert.equal(skills.length, 65);
  assert.deepEqual(readmeIssues(readFileSync(path.join(root, 'README.md'), 'utf8'), skills), []);
});
