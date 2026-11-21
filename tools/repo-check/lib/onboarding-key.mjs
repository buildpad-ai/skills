// R16: the onboarding key stays on the server (customer-self-onboarding, design O5; K-7 (a)).
//
// The Onboarding_Key admits an app's server to the Engine's sign-up routes; in a browser it would let
// anyone sign people up on the project's quota. So no skill text may name it with the public prefix,
// and no client component in a skill's code may read it or import the module that sends it.
//
//   onboarding-key-public  a text file holding the key's name with the NEXT_PUBLIC_ prefix, anywhere
//   onboarding-key-client  a fenced block whose first statement is 'use client' (any of four spellings)
//                          and that reads the key or imports lib/onboarding/engine
//
// It reads the raw file, which holds both backends' views, so a finding in either view is found.
import { fencedBlocks, isMarkdownPath, lines } from './markdown.mjs';

/** The key's name, and its forbidden public spelling, built so this file never holds the latter. */
const KEY = 'BUILDPAD_ONBOARDING_KEY';
const PUBLIC_NAME = `NEXT_PUBLIC_${KEY}`;

const USE_CLIENT = /^(['"])use client\1;?$/;
const ENGINE_IMPORT = /\bfrom\s+['"][^'"]*lib\/onboarding\/engine(\.[jt]sx?)?['"]|\bimport\s*\(\s*['"][^'"]*lib\/onboarding\/engine(\.[jt]sx?)?['"]\s*\)/;

const MESSAGES = {
  'onboarding-key-public': 'The onboarding key is named with the public prefix: it must never reach the browser. Name it BUILDPAD_ONBOARDING_KEY, server-side only.',
  'onboarding-key-client': "A 'use client' block reads the onboarding key or imports lib/onboarding/engine: only server code may hold the key.",
};

/** Whether a line is blank or only a comment, which may come before 'use client'. */
function skippable(line, state) {
  const t = line.trim();
  if (state.inBlockComment) {
    if (t.includes('*/')) state.inBlockComment = false;
    return true;
  }
  if (t === '' || t.startsWith('//')) return true;
  if (t.startsWith('/*')) {
    if (!t.includes('*/')) state.inBlockComment = true;
    return true;
  }
  return false;
}

/** R16's findings over the checked set's text files ({path, text}; text null for binary). */
export function onboardingKeyFindings(files) {
  const findings = [];
  const add = (p, line, code) => findings.push({ rule: 'R16', path: p, line, code, message: MESSAGES[code] });

  for (const f of files) {
    if (f.text === null || f.text === undefined) continue;
    const ls = lines(f.text);

    ls.forEach((line, i) => {
      if (line.includes(PUBLIC_NAME)) add(f.path, i + 1, 'onboarding-key-public');
    });

    if (!isMarkdownPath(f.path)) continue;
    for (const { start, end } of fencedBlocks(ls).fences) {
      const body = ls.slice(start + 1, end);
      const state = { inBlockComment: false };
      const first = body.find((l) => !skippable(l, state));
      if (!first || !USE_CLIENT.test(first.trim())) continue;
      const text = body.join('\n');
      if (text.includes(KEY) || ENGINE_IMPORT.test(text)) add(f.path, start + 1, 'onboarding-key-client');
    }
  }
  return findings;
}
