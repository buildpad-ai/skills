// XAppHub sign-in at customers (spec xapphub-customer-sign-in, criteria 6.1 to 6.4): TS-N3 retired
// by TD-9, TS-N3m and TS-X1 in its place, and the Mode_Guide's own code run against host cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { TENANCY, tenancyFindings } from '../lib/tenancy.mjs';
import { fileBackend, stripBackendPassages } from '../lib/passages.mjs';
import { L, tempDir } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GUIDE = 'add-multitenancy/references/engine-customer-tenants.instructions.md';
const guide = readFileSync(path.join(root, GUIDE), 'utf8');

const ENG = '<!-- buildpad-backend: engine -->';
const END = '<!-- /buildpad-backend -->';
const REAL = (id) => TENANCY.statements.find((s) => s.id === id);

// ---- 6.1 and 6.2: the registry ------------------------------------------------------------

function file(p, text) {
  const kind = fileBackend(p, text);
  const views = {};
  for (const keep of ['engine', 'supabase']) views[keep] = kind !== null && kind !== keep ? null : stripBackendPassages(text, keep).text;
  return { path: p, text, views };
}
const copy = (p, ...texts) => file(p, L('# S', '', ENG, ...texts.flatMap((t, i) => (i ? ['', t] : [t])), END));
const CHECK = L('<!-- tenancy-check:begin v1 -->', 'Check.', '<!-- tenancy-check:end -->');
const CHECK_FILES = [
  file('g/SKILL.md', L('# G', '', ENG, CHECK.trimEnd(), END)),
  file('g/references/guide.md', L('<!-- buildpad-backend-file: engine -->', '# Guide', '', CHECK.trimEnd())),
];
const DATA = (met) => ({
  opening: TENANCY.opening,
  dependencies: { 'TD-9': 'nine' },
  met,
  anchors: [],
  tenancyCheck: { file: 'tools/repo-check/tenancy-check.md', in: ['g/SKILL.md', 'g/references/guide.md'] },
  // TS-N3's own files are the repository's; here it is checked only where a fixture copies it.
  statements: [{ ...REAL('TS-N3'), in: [] }, { ...REAL('TS-N3m') }, { ...REAL('TS-X1') }],
});
const run = (files, met) => tenancyFindings([...CHECK_FILES, ...files], DATA(met), CHECK).map((f) => `${f.path}:${f.line} ${f.code}`).sort();
const BOTH = ['add-external-oauth/SKILL.md', GUIDE];

test('TS-N3m and TS-X1 are registered with requires TD-9 in the two files; TS-N3 ends with TD-9, which is met', () => {
  assert.deepEqual(REAL('TS-N3').until, ['TD-9']);
  for (const id of ['TS-N3m', 'TS-X1']) {
    assert.deepEqual(REAL(id).requires, ['TD-9'], id);
    assert.deepEqual(REAL(id).until, [], id);
    assert.deepEqual([...REAL(id).in].sort(), [...BOTH].sort(), id);
  }
  assert.ok(TENANCY.met.includes('TD-9'));
});

test('with TD-9 met, TS-N3 anywhere fails ts-retired, and each file without TS-N3m or TS-X1 fails ts-required-missing', () => {
  const live = BOTH.map((p) => copy(p, REAL('TS-N3m').text, REAL('TS-X1').text));
  assert.deepEqual(run(live, ['TD-9']), []);
  assert.deepEqual(run([...live, copy('s/SKILL.md', REAL('TS-N3').text)], ['TD-9']), ['s/SKILL.md:4 ts-retired']);
  assert.deepEqual(run(BOTH.map((p) => copy(p, REAL('TS-N3m').text)), ['TD-9']), BOTH.map((p) => `${p}:1 ts-required-missing`).sort());
  assert.deepEqual(run([], ['TD-9']), BOTH.flatMap((p) => [`${p}:1 ts-required-missing`, `${p}:1 ts-required-missing`]).sort());
});

test('without TD-9, TS-N3 stands and TS-N3m or TS-X1 anywhere fails ts-held-back', () => {
  assert.deepEqual(run([copy('s/SKILL.md', REAL('TS-N3').text)], []), []);
  assert.deepEqual(run([copy('s/SKILL.md', REAL('TS-N3m').text)], []), ['s/SKILL.md:4 ts-held-back']);
  assert.deepEqual(run([copy('s/SKILL.md', REAL('TS-X1').text)], []), ['s/SKILL.md:4 ts-held-back']);
});

test('TS-N3m states the condition both ways: reached absent or false stops, reached true builds (section 15)', () => {
  const t = REAL('TS-N3m').text;
  assert.match(t, /`get_project_detail`/);
  assert.match(t, /`my-apps` connector's `externalSignIn\.customers\.reached`/);
  assert.match(t, /Where `externalSignIn\.customers` is absent or `reached` is false, XAppHub sign-in is not available/);
  assert.match(t, /Tell the developer so and stop/);
  assert.match(t, /Where `reached` is true, build it as .* section 15/);
  const x = REAL('TS-X1').text;
  assert.match(x, /answers 404 before any redirect to XAppHub/);
  assert.match(x, /never read from `state`, a query parameter or a cookie/);
  assert.match(REAL('TS-H1').text, /its only use without a session is the XAppHub sign-in of section 15/);
});

// ---- 6.3 and 6.4: the guide's own code ------------------------------------------------------

/** The fenced ts blocks of the guide whose first line starts with `head`. */
function blocks(head) {
  const out = [];
  const re = /^```ts\n([\s\S]*?)^```$/gm;
  for (let m; (m = re.exec(guide)); ) if (m[1].startsWith(head)) out.push(m[1]);
  return out;
}
function one(head) {
  const b = blocks(head);
  assert.equal(b.length, 1, `exactly one block starting "${head}"`);
  return b[0];
}

const MAP = L(
  'const CUSTOMER_HOST_SUFFIX = "lms.example.com";',
  'const CUSTOMER_HOSTS = { acme: { tenantId: "t-acme", name: "Acme" }, beta: { tenantId: "t-beta", name: "Beta" } };',
);
const IMPORT = 'import { CUSTOMER_HOST_SUFFIX, CUSTOMER_HOSTS } from "@/config/customer-hosts";';

async function loadGuideCode() {
  const matcher = one('// lib/customer-host.ts: Edge-safe');
  assert.ok(matcher.includes(IMPORT), 'section 14.1 imports the map');
  const helper = one('// lib/customer-host.ts: add beside');
  const source = stripTypeScriptTypes(L(matcher.replace(IMPORT, MAP), helper), { mode: 'strip' });
  const dir = tempDir('xapphub-guide-');
  const p = path.join(dir, 'customer-host.mjs');
  writeFileSync(p, source);
  try {
    return await import(pathToFileURL(p).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const headersOf = (h) => ({ get: (k) => h[k.toLowerCase()] ?? null });

test("the guide's signInTenantOf: one label of the customer domain names a customer; anything else is the Blueprint or unknown", async () => {
  const { signInTenantOf } = await loadGuideCode();
  const before = process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID;
  process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID = 't-blueprint';
  try {
    const at = (h) => signInTenantOf(headersOf(h));
    const customer = (tenantId, name) => ({ kind: 'customer', tenantId, name });
    const blueprint = { kind: 'blueprint', tenantId: 't-blueprint' };

    assert.deepEqual(at({ host: 'acme.lms.example.com' }), customer('t-acme', 'Acme'));
    assert.deepEqual(at({ host: 'ACME.LMS.Example.COM:443' }), customer('t-acme', 'Acme'), 'lower case, port dropped');
    assert.deepEqual(at({ 'x-forwarded-host': 'beta.lms.example.com, proxy.internal', host: 'acme.lms.example.com' }), customer('t-beta', 'Beta'), 'the first X-Forwarded-Host entry wins');
    assert.deepEqual(at({ host: 'zeta.lms.example.com' }), { kind: 'unknown' }, 'an unmapped label');
    assert.deepEqual(at({ host: 'constructor.lms.example.com' }), { kind: 'unknown' }, 'no inherited key');

    for (const host of ['a.acme.lms.example.com', 'evil-lms.example.com', 'acme.lms.example.com.evil.com', 'acme.lms.example.com.', 'lms.example.com', 'main.d1abc.amplifyapp.com', 'localhost:3000', '[::1]:3000']) {
      assert.deepEqual(at({ host }), blueprint, host);
    }
    assert.deepEqual(at({}), blueprint, 'no host header');
    assert.deepEqual(at({ host: 'acme.localhost:3000' }), customer('t-acme', 'Acme'), 'development host');
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID;
    else process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID = before;
  }
});

test("the guide's start route answers 404 for an unknown host before it redirects, and builds redirect_uri from publicOrigin", () => {
  const start = one('// app/api/auth/oauth/[provider]/route.ts');
  const resolve = start.indexOf('signInTenantOf(request.headers)');
  const refuse = start.indexOf('status: 404');
  const redirect = start.indexOf('NextResponse.redirect(');
  assert.ok(resolve >= 0 && refuse > resolve && redirect > refuse, 'resolve, then 404, then redirect');
  assert.match(start, /tenant\.kind === "unknown"/);
  assert.match(start, /const redirectUri = `\$\{publicOrigin\(request\)\}\/api\/auth\/callback`;/);
  assert.doesNotMatch(start, /NEXT_PUBLIC_HOST_ORIGIN/);
});

test("the guide's callback takes the tenant from the host only, never from the query, state or a cookie", () => {
  const callback = one('// app/api/auth/callback/route.ts: before');
  assert.match(callback, /const tenant = signInTenantOf\(request\.headers\);/);
  assert.ok(callback.indexOf('status: 404') > callback.indexOf('signInTenantOf'), 'unknown answers 404');
  assert.match(callback, /"X-Tenant-Id": tenant\.tenantId/);
  assert.match(callback, /const redirectUri = `\$\{publicOrigin\(request\)\}\/api\/auth\/callback`;/);
  for (const block of [callback, one('// app/api/auth/oauth/[provider]/route.ts'), one('// lib/customer-host.ts: add beside')]) {
    assert.doesNotMatch(block, /searchParams/);
    assert.doesNotMatch(block, /cookies?\(\)|\.cookies\./);
    assert.doesNotMatch(block, /state\.(tenant|tenantId)|tenant.*=.*state/i);
  }
  assert.doesNotMatch(callback, /NEXT_PUBLIC_BUILDPAD_TENANT_ID/, 'the helper names the Blueprint, not the callback');
});
