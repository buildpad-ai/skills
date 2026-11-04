import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scanView, scanLine, GUARD_PATTERNS, LOCAL_PATTERNS } from "../lib/guard.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(path.join(here, "..", "contract", "cases.json"), "utf8"));
const ids = (findings) => findings.map((f) => `${f.line}:${f.id}`);

// The texts the design prints for Engine views and shared text (S3 Gate, S5 Pointer, S7-A,
// S7-B, ES-1 to ES-16 and the ES-10 runtime table), held here as printed. None may match.
// ES-13n is retired (25 October 2026): no file carries it, so it is not held here.
const DESIGN_TEXTS = {
  "Gate (S3)": "<!-- backend-gate:begin v1 -->\n**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or\nSupabase, and some parts of this file hold for one of them only. Before you act on anything in\nthis file, find the backend with these steps, in order, and stop at the first step that answers:\n\n1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is\n   `\"engine\"` or `\"supabase\"`, that is the backend. If `.buildpad/backend-answer.json` names the\n   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.\n2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is\n   `\"engine\"` or `\"supabase\"`, that is the backend.\n3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a\n   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.\n4. Otherwise ask the developer once: \"Is this project's backend the Buildpad Engine or\n   Supabase?\" Write the answer to `.buildpad/backend-answer.json` as\n   `{\"buildpadBackendAnswer\": 1, \"backend\": \"engine\"}` or\n   `{\"buildpadBackendAnswer\": 1, \"backend\": \"supabase\"}`, and ask the developer to commit that\n   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.\n\nTo find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration\nfile, and do not call a tool that returns project credentials.\n\nThen follow only the parts for that backend. A part starts at a line that holds only a comment\nwhose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the\nnext line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely\nmentions a backend is not a part. A file whose first line, after any front matter, holds only a\ncomment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend\nonly, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other\nbackend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that\nsomething is not available, tell the developer so and stop: do not build a substitute.\n<!-- backend-gate:end -->",
  "S7-A": "<!-- buildpad-backend: engine -->\n## On an Engine project: not available\n\nExternal OAuth sign-in is not available on an Engine project. The Engine signs users in with an\nemail and a password only: it has no OAuth or one-time-code exchange, no route that turns an outside\nidentity into a session, and no administration API for accounts. Write no file for this request.\nTell the developer that OAuth sign-in is not available on an Engine project and stop. The Platform's\npassword-less handoff is for opening the Studio and is not a way for an application to sign a user\nin. Users of an Engine project are created by an administrator: see the `add-users` skill.\n<!-- /buildpad-backend -->",
  "S7-B": "<!-- buildpad-backend: engine -->\n## On an Engine project: there are no migrations\n\nAn Engine project has no database migrations, and nothing reads a migration file there. Write no\nfile. Tell the developer that structure and access are changed through the Engine, and stop here:\n- a table, a column, a relation or an index: the `create-collection` skill;\n- who may read or change it: the `create-rbac` skill, and `relational-permissions` for nested writes;\n- a workflow column: the `create-workflow` skill; multi-level data separation: `manage-scope`.\n<!-- /buildpad-backend -->",
  "Pointer (S5)": "// Backend: before using this file, establish the backend as \"Establish the backend first\" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.",
  "ES-1": "On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.",
  "ES-2": "On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.",
  "ES-3": "On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none.",
  "ES-4": "On an Engine project the data API serves no request without a session; only the sign-in, `GET /api/server/info` and the Engine's password routes (which ES-5 says not to use) are served without one. The requests that take their tenant from the header `X-Tenant-Id` are the password sign-in, XAppHub sign-in and anonymous reads of public files. A browser can send `X-Tenant-Id` to the Engine from another origin, without cookies or credentials: the Engine allows that header from any origin and allows no credentialed cross-origin request. Even so, the request that names the tenant is the sign-in made through the application's own server route, which sends `X-Tenant-Id` with the value of `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A public file shown in a browser is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read. A request without a session that names no tenant is served from the Engine's host plane, not from the project. A request with a session takes its tenant from the session.",
  "ES-5": "On an Engine project the Supabase client is kept for sign-in only. Password sign-in, session refresh, reading the signed-in user and sign-out work through it, and its default sign-out ends the user's sessions on every device. An account that holds no role in the project's tenant is refused at password sign-in. XAppHub sign-in also works through it while the project's XAppHub connector is connected: the application's server gives the ID token from XAppHub to `signInWithIdToken` with the provider `my-apps`, and ends the session of an account that holds no role yet (the `add-external-oauth` skill). Not available on an Engine project: sign-up; OAuth sign-in with any provider other than XAppHub; magic link and one-time code; password recovery; changing a password, an email or a profile through the Supabase client; the Supabase client's code exchange; and the Supabase administration API. The Platform's password-less handoff opens the Studio; it is not a way for an application to sign a user in.",
  "ES-6": "On an Engine project multi-factor enrolment, challenge and verification are not served through the Supabase client. The Engine's own routes, each called with the user's session, are `POST /api/auth/mfa/enroll`, `GET /api/auth/mfa/factors`, `POST /api/auth/mfa/verify` and `POST /api/auth/mfa/unenroll`; a session that still needs its second factor is accepted elsewhere only after `POST /api/auth/mfa/verify`.",
  "ES-7": "On an Engine project an administrator creates every user who signs in with a password, through the Engine's user API (`POST /api/users` with an administrator's session) or the Studio's Users module, and gives the user a role in the project's tenant (`POST /api/users/:id/roles` with `role_id`, or the Users module). A user's first XAppHub sign-in creates that user's account, which holds no role until an administrator gives it one in the same way. An administrator resets a user's password, in the Studio's Users module.",
  "ES-8": "On an Engine project collections, fields, relations, roles, policies and permissions are created through the Engine's API (`/api/collections`, `/api/fields/:collection`, `/api/relations`, `/api/roles`, `/api/policies`, `/api/access`, `/api/permissions`) or its MCP tools `collections`, `fields`, `relations`, `roles`, `policies`, `access` and `permissions`. Access is roles, policies and permissions: a permission belongs to a policy, and a policy is attached to a role or a user. The MCP `collections` and `fields` tools keep a field's name, type and `meta` but not its `schema` block (default, not-null, length): set those through `POST /api/fields/:collection` with an administrator's session.",
  "ES-9": "On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.",
  "ES-10": "On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the table [Engine runtime](#engine-runtime-es-10) lists; for each interface it lacks, the table says what replaces it.",
  "ES-11": "On an Engine project files are stored and served by the Engine: `/api/files`, `/api/folders`, `/api/files/signed-url`, and file content at `/api/files/assets/:id` (with a session or a signed token). A file shown in a browser, a public one included, is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read: an `<img>` element or a link sends no `X-Tenant-Id` (ES-4). Set no storage bucket option: the Engine stores files on its own disk or in S3.",
  "ES-12": "On an Engine project tests create their users and roles as ES-7 says, sign in as ES-5 says, and use the environment of ES-3. The only secrets a pipeline needs are the test administrator's email and password; it needs no Supabase secret.",
  "ES-13m": "(replaced ES-13n, retired 25 October 2026, when Decision P's scheduler was met) On an Engine project an active cron job fires at its scheduled time.",
  "ES-14n": "(while PP-30 is unmet) On an Engine project a worker reaches the data API at `DAAS_URL`, the Engine_URL, and presents its own worker token, read from `DAAS_TOKEN`, as `Authorization: Bearer`; never the project's MCP token. The worker may create, read, update and delete the items of every collection a member creates, and may change no collection, field, relation, role, policy, permission, account or setting. Until the Engine accepts the worker token on its data API, a worker cannot reach the data API of an Engine project: tell the developer so and stop.",
  "ES-14m": "(after PP-30, and PP-16 for collections created later) ES-14n without its last sentence.",
  "ES-15": "On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.",
  "ES-16": "On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes of the `external-oauth` module, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`. For XAppHub sign-in the CLI installs the `external-oauth-engine` module in place of `external-oauth`; its routes are used as the `add-external-oauth` skill says.",
  "ES-10 Engine runtime table": "| Interface taught on a Supabase_Project | On the Engine | Replacement |\n|---|---|---|\n| The Supabase service in stored code (`services.supabase`) | Refused permanently, 501 `RUNTIME_SUPABASE_UNAVAILABLE` (§2.4) | `services.items(collection)`, with `{ elevated: true }` where the job must act as an administrator |\n| SQL functions and raw SQL from stored code | No path (§2) | `services.items` calls, or a custom service |\n| `services.items(c)` methods | Nine: `readByQuery`, `readOne`, `readMany`, `createOne`, `createMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`; `readByQuery` returns the array itself (§2) | Read `result`, not `result.data` |\n| Query keys | `fields`, `filter`, `sort`, `limit`, `page`, `offset`, `search`; any other key is refused | Drop the key |\n| Schema services | Read only: `readAll`, `readOne` | Change structure through ES-8 |\n| `services.files` | Metadata only: `readByQuery`, `readOne` | Bytes through the application and `/api/files` |\n| `services.mail` | Options `to`, `subject`, `html`, `text`, `replyTo`; returns `{ success, ... }`, does not throw (§6) | Check `success` |\n| `services.env` | Empty unless the operator names keys (`RUNTIME_ENV_WHITELIST_<SCOPE>`, `RUNTIME_ENV_WHITELIST_GLOBAL`) (§7) | Ask the operator to name the key; never assume one |\n| `services.fetch` | Only hosts in `EXTENSION_ALLOWED_DOMAINS`; empty list allows loopback only | Ask the operator to allow the host |\n| `fetch`, `process`, `require`, `import`, `setTimeout`, `setInterval`, `eval`, `Function` | Do not exist (§1) | `services.fetch`; no timers |\n| `Intl`, as in `create-service` lines 97-101 | Not found in the runtime's globals (`context`, `services`, `console`, `JSON`, `Date`, `Math`) | Format numbers by hand |\n| `console` in a custom service body | Not in scope (§3); in hooks, cron jobs and service tests it is | Return what should be recorded |\n| `console.table`, `console.trace` | Do not exist; `log`, `info`, `debug`, `warn`, `error` only (§4) | `console.log` |\n| Update and delete hook payloads | `meta.keys` (array); `meta.key` only on create (§5) | Use `meta.keys` |\n| Throwing from a filter hook | `new HookError(message, status, code)` is in scope | Unchanged |\n| Filesystem extensions, `/api/ext/*` endpoints | None | Stored hooks, cron jobs, custom services |"
};

test('the guard uses the 13 contract patterns, in contract order', () => {
  assert.deepEqual(GUARD_PATTERNS.map((p) => p.id), [
    'rpc', 'rest', 'service-role', 'auth-admin', 'client-auth', 'stored-supabase', 'sql-policy',
    'migration', 'storage', 'service-token-data', 'cors-mcp', 'missing-mcp', 'platform-supabase',
  ]);
});

test('every guardCases entry of cases.json gives its expected ids (contract patterns only)', () => {
  for (const c of cases.guardCases) {
    assert.deepEqual(scanLine(c.line, { local: false }), c.ids, c.name);
  }
});

const positives = {
  rpc: "const { data } = await supabase.rpc('fn', {});",
  rest: 'GET /rest/v1/articles?select=*',
  'service-role': 'const key = process.env.SUPABASE_SERVICE_ROLE_KEY;',
  'auth-admin': 'await admin.auth.admin.deleteUser(id);',
  'client-auth': 'await supabase.auth.verifyOtp({ token_hash, type });',
  'stored-supabase': 'const db = createClient(process.env.SUPABASE_URL, anon);',
  'sql-policy': 'alter table x enable row level security; CREATE POLICY p ON x;',
  migration: 'supabase migration new add_articles',
  storage: "supabase.storage.createBucket('avatars');",
  'service-token-data': 'Authorization: Bearer $SERVICE_TOKEN',
  'cors-mcp': 'Call mcp_daas_cors-settings to allow the origin.',
  'missing-mcp': 'mcp_daas_module_access_keys({ action: "create" })',
  'platform-supabase': '{{project.supabaseAnonKey}}',
};
const negatives = {
  rpc: 'Remote procedures are not available on an Engine project.',
  rest: 'GET <Engine_URL>/api/items/articles',
  'service-role': 'There is no service-role key on an Engine project.',
  'auth-admin': 'The administration API is not available on an Engine project.',
  'client-auth': 'await supabase.auth.signOut();',
  'stored-supabase': 'const items = services.items("articles");',
  'sql-policy': 'create a policy through the policies API',
  migration: 'An Engine project has no database migrations.',
  storage: 'const s = services.files;',
  'service-token-data': 'Authorization: Bearer ${DAAS_TOKEN}',
  'cors-mcp': 'Change no cross-origin setting.',
  'missing-mcp': '"module_access_keys": ["workflow:approve", "workflow:reject"]',
  'platform-supabase': 'const url = project.engineUrl;',
};

test('a positive and a negative for each §C20 pattern', () => {
  for (const p of GUARD_PATTERNS) {
    assert.ok(scanLine(positives[p.id]).includes(p.id), `positive ${p.id}`);
    assert.deepEqual(scanLine(negatives[p.id]), [], `negative ${p.id}`);
  }
});

test('patterns are case-sensitive and applied per line, with the line number', () => {
  assert.deepEqual(scanLine('create policy p on x'), []);
  const text = 'line one\nconst r = await supabase.rpc("f");\nline three\nauth.users and auth.uid()\n';
  assert.deepEqual(ids(scanView('x/SKILL.md', text)), ['2:rpc', '4:sql-policy']);
});

test('PP-29 met: the cron, services and extensions MCP tools are no longer refused', () => {
  assert.deepEqual(LOCAL_PATTERNS, []);
  assert.deepEqual(scanLine('mcp_daas_cron({ action: "list" })'), []);
  assert.deepEqual(scanLine('mcp_daas_services'), []);
  assert.deepEqual(scanLine('{"name": "mcp_daas_extensions", "arguments": {}}'), []);
  assert.deepEqual(scanLine('{"name": "cron"}'), []);
  // The shared contract still refuses these three by name (cors-mcp, missing-mcp).
  assert.deepEqual(scanLine('{"name": "cors-settings"}'), ['cors-mcp']);
  assert.deepEqual(scanLine('mcp_daas_smtp-settings'), ['missing-mcp']);
});

test('the path rule: a Supabase migration path or a .sql file under a skill', () => {
  assert.deepEqual(ids(scanView('create-migration/assets/supabase/migrations/001.md', '# x\n')), ['1:path']);
  assert.deepEqual(ids(scanView('supabase/migrations/001.txt', 'x\n')), ['1:path']);
  assert.deepEqual(ids(scanView('create-migration/assets/schema.sql', 'select 1;\n')), ['1:path']);
  assert.deepEqual(scanView('create-migration/assets/schema.sql.md', 'x\n'), []);
  assert.deepEqual(scanView('create-migration/SKILL.md', 'x\n'), []);
});

test('the fenced-block rule: credentials include with a data-API address in one block', () => {
  const both = ['# T', '```ts', "await fetch(`${DAAS_URL}/items/articles`, {", "  credentials: 'include',", '});', '```', ''].join('\n');
  assert.deepEqual(ids(scanView('x/SKILL.md', both)), ['2:fenced-credentials']);
  const items = ['```ts', "fetch('/items/a', { credentials: \"include\" })", '```', ''].join('\n');
  assert.deepEqual(ids(scanView('x/SKILL.md', items)), ['1:fenced-credentials']);
});

test('same-origin credentials include is not a finding', () => {
  const sameOrigin = ['```ts', "await fetch('/api/auth/session', { credentials: 'include' });", '```', ''].join('\n');
  assert.deepEqual(scanView('authentication-proxy/SKILL.md', sameOrigin), []);
  const split = ['```ts', "fetch('/api/x', { credentials: 'include' })", '```', '', '```ts', 'const u = DAAS_URL;', '```', ''].join('\n');
  assert.deepEqual(scanView('x/SKILL.md', split), []);
  const outside = "fetch('/api/x', { credentials: 'include' }) then DAAS_URL\n";
  assert.deepEqual(scanView('x/SKILL.md', outside), []);
});

test('the fenced-block rule applies to Markdown fences only', () => {
  const ts = "const r = await fetch(`${DAAS_URL}/items/a`, { credentials: 'include' });\n";
  assert.deepEqual(scanView('x/assets/a.ts', ts), []);
});

test('a workflow command field and plain-words prose are not findings', () => {
  assert.deepEqual(scanView('add-workflows/SKILL.md', '  "module_access_keys": ["workflow:approve"],\n'), []);
  assert.deepEqual(scanView('x/SKILL.md', 'Password recovery and OAuth sign-in are not available on an Engine project.\n'), []);
});

test('the Gate, the Pointer, S7-A, S7-B and every ES text give no finding', () => {
  assert.equal(Object.keys(DESIGN_TEXTS).filter((k) => k.startsWith('ES-')).length, 18);
  for (const [name, text] of Object.entries(DESIGN_TEXTS)) {
    assert.deepEqual(scanView('x/SKILL.md', `${text}\n`), [], name);
    assert.deepEqual(scanView('x/SKILL.md', ['```md', text, '```', ''].join('\n')), [], `${name} fenced`);
  }
});
