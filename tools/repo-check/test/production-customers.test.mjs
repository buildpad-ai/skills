// Customers in Production (spec production-customers, criteria 7.1 to 7.5): the customer host map
// comes from the Platform's branch variable, an onboarding key of `off` is no key, and the variables
// the Platform manages are named. The guides' own code is run with its types stripped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { TENANCY } from '../lib/tenancy.mjs';
import { stripBackendPassages } from '../lib/passages.mjs';
import { tempDir } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const GUIDE = 'add-multitenancy/references/engine-customer-tenants.instructions.md';
const ONBOARDING = 'add-customer-onboarding/references/engine-customer-onboarding.instructions.md';
const VAR = 'BUILDPAD_CUSTOMER_HOSTS';

/** The fenced blocks of `text` in `lang` whose first line starts with `head`. */
function blocks(text, head, lang = 'ts') {
  const out = [];
  const re = new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```$', 'gm');
  for (let m; (m = re.exec(text)); ) if (m[1].startsWith(head)) out.push(m[1]);
  return out;
}
function one(text, head, lang) {
  const b = blocks(text, head, lang);
  assert.equal(b.length, 1, `exactly one block starting "${head}"`);
  return b[0];
}

/** Imports `source` (TypeScript, types stripped) as a module, with `env` set while it loads. */
async function load(source, env = {}) {
  const dir = tempDir('production-customers-');
  const p = path.join(dir, 'm.mjs');
  writeFileSync(p, stripTypeScriptTypes(source, { mode: 'strip' }));
  const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try {
    return await import(pathToFileURL(p).href);
  } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs `fn` with console.warn captured; returns what was logged. */
function captureWarn(fn) {
  const logged = [];
  const original = console.warn;
  console.warn = (...args) => logged.push(args.join(' '));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return logged;
}

// ---- 7.1: the guide's map, from the variable ---------------------------------------------------

const guide = read(GUIDE);
const MAP_HEAD = '// config/customer-hosts.ts: Edge-safe';

test("the guide's map block reads the variable, keeps one-label slugs with string ids, and drops the rest", async () => {
  const map = one(guide, MAP_HEAD);
  assert.match(map, /parseCustomerHosts\(process\.env\.BUILDPAD_CUSTOMER_HOSTS\)/, 'a literal process.env read');
  assert.doesNotMatch(map, /NEXT_PUBLIC_/);

  const value = JSON.stringify({ acme: 't-acme', beta: 't-beta', 'Bad.Key': 't-x', '-x': 't-y', num: 7, empty: '', obj: {} });
  const m = await load(map, { [VAR]: value });
  assert.deepEqual(
    { ...m.CUSTOMER_HOSTS },
    { acme: { tenantId: 't-acme', name: 'acme' }, beta: { tenantId: 't-beta', name: 'beta' } },
    'the slug is the name without a display-name table',
  );
  assert.equal(Object.hasOwn(m.CUSTOMER_HOSTS, 'constructor'), false);

  const kept = m.parseCustomerHosts(JSON.stringify({ constructor: 't-c' }));
  assert.deepEqual(kept, { constructor: 't-c' }, 'a label is a label, even one Object.prototype names');
});

test("the guide's parser gives the empty map for a missing, empty, unparsable or non-object value, and never logs the value", async () => {
  const m = await load(one(guide, MAP_HEAD), { [VAR]: undefined });
  assert.deepEqual({ ...m.CUSTOMER_HOSTS }, {});
  const secretish = '{"acme": "t-acme"'; // not JSON
  for (const raw of [undefined, '', secretish, '[]', '"acme"', 'null', '42']) {
    let out;
    const logged = captureWarn(() => {
      out = m.parseCustomerHosts(raw);
    });
    assert.deepEqual(out, {}, String(raw));
    for (const line of logged) {
      assert.match(line, /customer_hosts\.empty/);
      assert.ok(!line.includes('t-acme'), 'the value is never logged');
    }
  }
});

test("section 14.1's matcher still imports the map from config/customer-hosts (the XAppHub test runs it)", () => {
  const matcher = one(guide, '// lib/customer-host.ts: Edge-safe');
  assert.ok(matcher.includes('import { CUSTOMER_HOST_SUFFIX, CUSTOMER_HOSTS } from "@/config/customer-hosts";'));
});

// ---- 7.2: no committed map; both Environments --------------------------------------------------

test('no ts block of the guide holds a literal slug-to-tenant entry, and the guide says where the map comes from', () => {
  for (const b of blocks(guide, '')) {
    assert.doesNotMatch(b, /tenantId:\s*["'`]/, 'a committed entry');
  }
  assert.doesNotMatch(guide, /\/\/ config\/customer-hosts\.ts: committed/);
  const engine = stripBackendPassages(guide, 'engine').text;
  assert.match(engine, /One piece of code serves both Environments/);
  assert.match(engine, /`productionCustomers`/);
  assert.match(engine, /\*\*Update and redeploy\*\*/);
  assert.match(engine, /never set, change or remove it with `amplify_set_env_vars`/i);
  const yaml = one(guide, '        # Customer hosts:', 'yaml');
  assert.match(yaml, /echo "BUILDPAD_CUSTOMER_HOSTS=\$BUILDPAD_CUSTOMER_HOSTS" >> \.env\.production/);
});

test('TS-H1 names the variable and no longer a committed map copied from customers[]', () => {
  const h1 = TENANCY.statements.find((s) => s.id === 'TS-H1');
  assert.match(h1.text, /the server variable `BUILDPAD_CUSTOMER_HOSTS`, one value per Environment/);
  assert.match(h1.text, /never commits/);
  assert.doesNotMatch(h1.text, /committed map|customers\[\]/);
});

// ---- 7.3: an onboarding key of `off` is no key --------------------------------------------------

const onboarding = read(ONBOARDING);

test("the onboarding module's key reader treats unset, empty and `off` in any case as no key", async () => {
  const engine = one(onboarding, '// lib/onboarding/engine.ts');
  const start = engine.indexOf('export function onboardingKey(');
  assert.ok(start >= 0, 'onboardingKey is in the module');
  const end = engine.indexOf('\n}\n', start);
  const fn = engine.slice(start, end + 3);
  const offered = engine.match(/^export const signUpOffered = .*$/m)?.[0];
  assert.ok(offered, 'signUpOffered is in the module');
  const m = await load(`${fn}\n${offered}\n`);

  const at = (v) => {
    const before = process.env.BUILDPAD_ONBOARDING_KEY;
    if (v === undefined) delete process.env.BUILDPAD_ONBOARDING_KEY; else process.env.BUILDPAD_ONBOARDING_KEY = v;
    try {
      return [m.onboardingKey(), m.signUpOffered()];
    } finally {
      if (before === undefined) delete process.env.BUILDPAD_ONBOARDING_KEY; else process.env.BUILDPAD_ONBOARDING_KEY = before;
    }
  };
  for (const v of [undefined, '', '   ', 'off', 'OFF', ' Off ', 'oFf']) assert.deepEqual(at(v), [null, false], JSON.stringify(v));
  assert.deepEqual(at('bpo_abc123'), ['bpo_abc123', true]);
  assert.deepEqual(at('offline-key'), ['offline-key', true], 'only the whole value off');

  assert.match(engine, /function key\(\): string \{\n  const k = onboardingKey\(\);/, 'the Engine calls use the same reader');
});

test('with no key the pages are not found, the routes answer 404 first, and the link and the create step are gated', () => {
  for (const head of ['// app/(auth)/sign-up/page.tsx', '// app/(auth)/verify-email/page.tsx', '// app/(auth)/create-company/page.tsx']) {
    assert.match(one(onboarding, head, 'tsx'), /if \(!signUpOffered\(\)\) notFound\(\);/, head);
  }
  const routes = blocks(onboarding, '// app/api/onboarding/');
  assert.equal(routes.length, 4);
  for (const r of routes) {
    assert.match(r, /export async function POST\(request: NextRequest\) \{\n  const off = notOffered\(\);\n  if \(off\) return off;/, r.split('\n')[0]);
  }
  const messages = one(onboarding, '// lib/onboarding/messages.ts');
  assert.match(messages, /err\.kind === "not_configured" \? 404/);
  assert.match(onboarding, /\{signUpOffered && <p>New here\? <Link href="\/sign-up">/);
  assert.match(onboarding, /if \(SELF_ONBOARDING && signUpOffered\(\)\) return \{ create: true as const \};/);
  const skill = stripBackendPassages(read('add-customer-onboarding/SKILL.md'), 'engine').text;
  assert.match(skill, /Self-onboarding is Development's only/);
  assert.match(skill, /The value `off`, in any case, means no key/);
});

// ---- 7.4 and 7.5: the variable stays on the server; the pointers and the register ---------------

test('no tracked text file names the host map with the NEXT_PUBLIC_ prefix', () => {
  const PUBLIC = `NEXT_PUBLIC_${VAR}`;
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const hits = files.filter((f) => /\.(md|mjs|json|ts|tsx|ya?ml)$/.test(f)).filter((f) => {
    try {
      return read(f).includes(PUBLIC);
    } catch {
      return false; // listed but deleted in the working tree
    }
  });
  assert.deepEqual(hits, []);
});

test("add-external-oauth's pointer says the map comes from the variable, and CONTRIBUTING names the managed variables", () => {
  const oauth = stripBackendPassages(read('add-external-oauth/SKILL.md'), 'engine').text;
  const row = oauth.split('\n').find((l) => l.startsWith('| 404 "There is no customer at this address."'));
  assert.ok(row, 'the troubleshooting row');
  assert.match(row, /`BUILDPAD_CUSTOMER_HOSTS`/);
  assert.match(row, /Update and redeploy/);

  const contributing = read('CONTRIBUTING.md');
  const section = contributing.slice(contributing.indexOf('## Variables the Platform manages'), contributing.indexOf('## Convert a folder'));
  for (const v of ['BUILDPAD_ONBOARDING_KEY', 'BUILDPAD_SIGNUP_MAIL', VAR]) {
    assert.match(section, new RegExp(`^\\| \`${v}\` \\|`, 'm'), v);
  }
  assert.match(section, /`amplify_set_env_vars`/);
});
