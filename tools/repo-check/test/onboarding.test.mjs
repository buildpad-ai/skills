// R16: the onboarding key stays on the server (customer-self-onboarding, design O5; task 2.1).
// Fixture texts only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingKeyFindings } from '../lib/onboarding-key.mjs';
import { L } from './helpers.mjs';

const PUBLIC = ['NEXT', 'PUBLIC', 'BUILDPAD', 'ONBOARDING', 'KEY'].join('_');
const file = (text, p = 'g/references/guide.md') => ({ path: p, text });
const codes = (fs) => fs.map((f) => f.code);

test('the public name fails in prose and in a fenced block', () => {
  const prose = onboardingKeyFindings([file(L('# Guide', '', `Set ${PUBLIC} in the app.`))]);
  assert.deepEqual(codes(prose), ['onboarding-key-public']);
  assert.equal(prose[0].line, 3);

  const fenced = onboardingKeyFindings([file(L('# Guide', '', '```bash', `echo "${PUBLIC}"`, '```'))]);
  assert.deepEqual(codes(fenced), ['onboarding-key-public']);
  assert.equal(fenced[0].line, 4);

  const notMarkdown = onboardingKeyFindings([file(`${PUBLIC}=x\n`, 'g/templates/env.example')]);
  assert.deepEqual(codes(notMarkdown), ['onboarding-key-public'], 'any text file of the checked set');
});

test("a 'use client' block reading the key fails, with each spelling and after a comment line", () => {
  for (const mark of ["'use client'", '"use client"', "'use client';", '"use client";']) {
    const f = onboardingKeyFindings([file(L('```tsx', mark, '', 'const k = process.env.BUILDPAD_ONBOARDING_KEY;', '```'))]);
    assert.deepEqual(codes(f), ['onboarding-key-client'], mark);
    assert.equal(f[0].line, 1, 'the block opening');
  }
  const commented = onboardingKeyFindings([
    file(L('```tsx', '// app/signup/page.tsx', '', "'use client';", 'fetch(x, { headers: { k: process.env.BUILDPAD_ONBOARDING_KEY } });', '```')),
  ]);
  assert.deepEqual(codes(commented), ['onboarding-key-client']);
  const blockComment = onboardingKeyFindings([file(L('```tsx', '/* the page */', '"use client"', 'const k = process.env.BUILDPAD_ONBOARDING_KEY', '```'))]);
  assert.deepEqual(codes(blockComment), ['onboarding-key-client']);
});

test("a 'use client' block importing lib/onboarding/engine fails", () => {
  for (const spec of ["'@/lib/onboarding/engine'", '"../../lib/onboarding/engine"', "'@/lib/onboarding/engine.ts'"]) {
    const f = onboardingKeyFindings([file(L('```tsx', "'use client';", `import { signUp } from ${spec};`, '```'))]);
    assert.deepEqual(codes(f), ['onboarding-key-client'], spec);
  }
});

test('a server block reading the key passes, and a client block without it passes', () => {
  const server = L('```ts', '// lib/onboarding/engine.ts', "import 'server-only';", 'const key = process.env.BUILDPAD_ONBOARDING_KEY;', '```');
  const client = L('```tsx', "'use client';", "import { messages } from '@/lib/onboarding/messages';", '```');
  const laterMark = L('```tsx', 'const a = 1;', "'use client';", 'const k = process.env.BUILDPAD_ONBOARDING_KEY;', '```');
  assert.deepEqual(onboardingKeyFindings([file(L(server, '', client, '', laterMark))]), [], "'use client' only counts as the first statement");
});

test('each finding names R16, the path and the line', () => {
  const [f] = onboardingKeyFindings([file(L('a', PUBLIC), 'x/SKILL.md')]);
  assert.equal(f.rule, 'R16');
  assert.equal(f.path, 'x/SKILL.md');
  assert.equal(f.line, 2);
  assert.ok(f.message && !f.message.includes(PUBLIC), 'the message never spells the forbidden name');
});

test('a file with no text (binary) is skipped', () => {
  assert.deepEqual(onboardingKeyFindings([{ path: 'g/x.png', text: null }]), []);
});
