import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mapIssues, validateSkillMap, PLANS } from '../lib/map.mjs';
import { checkedSet, topFolders } from '../lib/checked-set.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const skillMap = JSON.parse(readFileSync(path.join(here, '..', 'skill-map.json'), 'utf8'));
const show = (fs) => fs.map((f) => `${f.rule} ${f.path}:${f.line} ${f.code}`);
const row = (folder, plan = 'BP', dependence = 'partial') => ({ folder, dependence, treatment: 'both paths, chosen by backend', size: 'small', plan });

test('skill-map.json: 67 rows with the marking plan counts', () => {
  assert.equal(skillMap.length, 67);
  const counts = {};
  for (const r of skillMap) counts[r.plan] = (counts[r.plan] ?? 0) + 1;
  assert.deepEqual(counts, { BP: 23, EF: 3, US: 1, NY: 2, RW: 16, 'RW+G': 2, UC: 20 });
  assert.deepEqual(validateSkillMap(skillMap), []);
  assert.deepEqual(Object.keys(skillMap[0]), ['folder', 'dependence', 'treatment', 'size', 'plan']);
});

test('skill-map.json covers the checked set of this repository both ways', () => {
  const folders = topFolders(checkedSet(repoRoot));
  assert.equal(folders.length, 67);
  assert.deepEqual(mapIssues(skillMap, folders, new Map()), []);
});

test('R4: a folder without a row and a row without a folder', () => {
  const f = mapIssues([row('a'), row('gone')], ['a', 'new-skill'], new Map());
  assert.deepEqual(show(f), [
    'R4 new-skill/SKILL.md:1 folder-without-row',
    'R4 tools/repo-check/skill-map.json:3 row-without-folder',
  ]);
  assert.match(f[1].message, /gone/);
});

test('R4 on the baseline tree: a row for a later Skill is not a finding, a folder without a row is', () => {
  const f = mapIssues([row('a'), row('later')], ['a', 'unmapped'], new Map(), { olderTree: true });
  assert.deepEqual(show(f), ['R4 unmapped/SKILL.md:1 folder-without-row']);
});

test('R4: agents and references need rows too', () => {
  const f = mapIssues([row('a')], ['a', 'agents', 'references'], new Map());
  assert.deepEqual(show(f), ['R4 agents:1 folder-without-row', 'R4 references:1 folder-without-row']);
});

test('R4: a marker in a wording-only folder', () => {
  const markers = new Map([['w', [{ path: 'w/SKILL.md', line: 12 }]], ['b', [{ path: 'b/SKILL.md', line: 3 }]]]);
  const f = mapIssues([row('w', 'RW', 'wording only'), row('b')], ['w', 'b'], markers);
  assert.deepEqual(show(f), ['R4 w/SKILL.md:12 marker-in-wording-only']);
});

test('R4: a malformed or duplicate row', () => {
  const bad = [row('a'), row('a'), { folder: 'b', dependence: 'some', treatment: 't', size: 'huge', plan: 'XX' }];
  const codes = validateSkillMap(bad).map((f) => f.code);
  assert.deepEqual(codes, ['map-duplicate-row', 'map-invalid-row']);
  assert.deepEqual(PLANS, ['BP', 'EF', 'US', 'NY', 'RW', 'RW+G', 'UC']);
});

// R13 (release rule, lib/release.mjs): on a tag push, every non-UC row must be converted.
import { unconverted, convertedFindings } from '../lib/release.mjs';

test('R13: a release fails with one non-UC row unconverted', () => {
  const rows = [row('a', 'BP'), row('b', 'RW', 'wording only'), row('u', 'UC', 'none')];
  assert.deepEqual(unconverted(rows, new Set(['a', 'b'])), []);
  assert.deepEqual(unconverted(rows, new Set(['a'])), ['b']);
  assert.deepEqual(show(convertedFindings(rows, new Set(['a']))), ['R13 tools/repo-check/converted/b:1 folder-not-converted']);
});

test('R13: UC rows never need a converted file, and this repository has none converted yet', () => {
  const rows = [row('u', 'UC', 'none')];
  assert.deepEqual(convertedFindings(rows, new Set()), []);
  assert.equal(unconverted(skillMap, new Set()).length, 47);
});
