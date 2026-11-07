# Contributing

The skills in this repository serve two kinds of Buildpad project: **Engine projects** (the
backend is the Buildpad Engine) and **Supabase projects** (the backend is a per-project
Supabase). This guide tells you how to write a skill that holds for both, and how to make the
repository's check pass.

This file is not copied into any project, so it can show the marker comments in full. Never write
the marker token in prose in a skill, a persona or a reference: a line that holds the token and is
not a marker is an error (`malformed-marker`).

## Run the check

The check needs Node.js 22 or later and nothing else: no `npm install`, no `package.json`.

```bash
node --test "tools/repo-check/test/*.test.mjs"   # the check's own tests
node tools/repo-check/check.mjs                  # the check, on this repository
node tools/repo-check/check.mjs --only R2,R3     # some rules only
node tools/repo-check/check.mjs --render /tmp/views
```

Exit code 0 means no finding, 1 means findings, and 2 means a usage or git error. Each finding is
one line: `<rule> <path>:<line> <code> <message>`. The check needs the tag `v1.0.0`; in a shallow
clone, run `git fetch --tags` first.

`--render` writes the two views of every file: `engine/**` (what an Engine project's agent reads),
`supabase/**` (what a Supabase project's agent reads) and `supabase-vs-baseline.diff` (the
Supabase view against `v1.0.0`). Read them before you open a pull request that changes a skill.

CI runs two jobs on every pull request: `check` (the tests, then `check.mjs`) and `baseline`
(`check.mjs --only R4,R5,R6a` on the tree of `v1.0.0`).

## Text for one backend only

Most text holds for both kinds of project and needs nothing. Text that holds for one backend only
is marked in place. A Buildpad starter has the other backend's text removed when the Platform
assembles it; a project that installs the skills with `npx skills add` gets both, and the agent
reads only its own backend's parts.

### Marker forms

| Use | Form |
|---|---|
| Markdown passage | `<!-- buildpad-backend: engine -->` … `<!-- /buildpad-backend -->`, or `<!-- buildpad-backend: supabase -->` … `<!-- /buildpad-backend -->` |
| TypeScript passage | `// buildpad-backend: supabase` … `// /buildpad-backend` (or `engine`) |
| Whole Markdown file | `<!-- buildpad-backend-file: engine -->` (or `supabase`) on the first non-blank line after the front matter, or on line 1 |
| Whole TypeScript file | `// buildpad-backend-file: supabase` (or `engine`) on line 1 |
| Whole folder | A folder named `engine-only` or `supabase-only`. Use it only for files that cannot hold a comment, such as JSON |

The grammar is the one in `tools/repo-check/contract/backend-contract.json` (`markerRegex`). A
marker is a whole line. Any comment opener is accepted (`<!--`, `//`, `#`, `--`, `/*`). The only
kinds are `engine` and `supabase`.

The check reports these marker errors (rule R2), each with its file and line:

| Code | Meaning |
|---|---|
| `malformed-marker` | A line holds the marker token but is not a marker |
| `unknown-kind` | A kind other than `engine` or `supabase` |
| `nested` | A passage inside a passage |
| `unpaired-open`, `unpaired-close` | An opener without its closer, or a closer without an opener |
| `straddles-steering` | A passage holds a `kiro-steering:` marker |
| `misplaced-file-marker` | A file marker off its one allowed line, or inside an `engine-only`/`supabase-only` folder |
| `conflicting-scope` | Two file markers, or a passage inside a whole-file-marked file |
| `marker-in-front-matter` | A marker inside the YAML front matter |
| `straddles-fence` | A marker line inside a fenced code block |
| `marker-in-table` | A marker line inside a Markdown table |
| `gap-between-passages` | A blank line between a closer and the opener of the passage that replaces it |

### Authoring rules

- **Supabase text is the old text moved, never rewritten.** When you wrap existing text in a
  `supabase` passage, do not change a byte of it. The check compares the Supabase view with
  `v1.0.0` (rule R7).
- **A replaced pair is adjacent, `supabase` first.** Put the `supabase` passage first and the
  `engine` passage directly after it, with no blank line between the closer and the opener. A
  reader of the raw file then sees the old text first, and both views keep the old blank lines.
- **A fenced code block or a table is wholly inside or wholly outside a passage.** If a range
  starts or ends inside a fence or a table, widen it to the whole fence or table.
- **A passage closes before a heading of a higher level** than the one it opened under.
- **An Engine passage that points into another skill links that skill's `SKILL.md`**, never one
  of its reference files.
- **Move a link before you file-mark its target.** If another skill links a file that becomes
  whole-file `supabase`, move that link into `supabase` text in the same pull request or an
  earlier one.
- **Front matter takes no marker.** Never change a skill's `name`. If its `description` is true
  for one backend only, reword it so that it is true for both, or so that it names its kind
  ("Supabase projects only", "stops on an Engine project"), and list the change in the folder's
  change file.
- **Name an unavailable feature in plain words.** Text that an Engine project keeps must not name
  a feature the Engine lacks by an identifier the guard matches (the `guardPatterns` of
  `backend-contract.json`). Write "a magic link is not available", not the API call. The Engine's
  MCP tools `cors-settings`, `smtp-settings` and `module_access_keys` are served, but the contract
  still refuses their `mcp_daas_` names: in Engine text, name them without that prefix.
- **Name Platform fields otherwise in Engine text.** The names `supabaseUrl`, `supabaseAnonKey`
  and `supabaseServiceRoleKey` are Platform project fields and match the guard. In Engine text,
  call a local variable something else, for example `authUrl` or `publicKey`.

## The Gate

Every file that holds text for one backend only carries a fixed procedure, "Establish the backend
first", that tells the agent how to find its backend. The canonical text is
`tools/repo-check/gate.md`. Copy the whole file, byte for byte, from its first line
(`<!-- backend-gate:begin v1 -->`) to its last (`<!-- backend-gate:end -->`), and follow it with
one blank line. Never edit a copy: the check compares every copy with `gate.md` (rule R3).

### Where the Gate goes

| File | What it carries | Where |
|---|---|---|
| `SKILL.md` of a skill in which any file holds a passage, a file marker or an `engine-only`/`supabase-only` folder | The Gate | The first content after the front matter, or directly after the first `# ` heading when that heading is the first content |
| Any other Markdown file that holds a passage | The Gate | The same place, before its first passage |
| A Markdown file with a file marker | The file marker, then the Gate | The marker on the first non-blank line after the front matter; the Gate on the next non-blank line |
| A `.ts` or `.tsx` asset with a passage or a file marker | The Pointer line | Line 1, or the line after the file marker |
| A comment-less file in an `engine-only`/`supabase-only` folder | Nothing | Only links from the same skill, from text of the same kind, may point to it |
| A persona (`agents/`), a checklist (`references/`) or a template that holds a passage | The Gate | The same rule as any Markdown file |
| `buildpad-steering` and `buildpad-steering-custom` `SKILL.md` | The Gate | The same rule; they record the backend into steering |

No link from another skill may point to a file under `assets/`.

### The Pointer

A code asset is copied into an application, so it carries one line instead of the whole Gate:

```ts
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
```

## Engine statements

These texts are worded once and copied verbatim into the `engine` passages that need them. A skill
may add specifics around them, but never contradicts them. Each may also stand in shared text,
because it opens with "On an Engine project".

| Id | When | Text |
|---|---|---|
| ES-1 | Always | On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it. |
| ES-2 | Always | On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API. |
| ES-3 | Always | On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none. |
| ES-4 | Always | On an Engine project the data API serves no request without a session; only the sign-in, `GET /api/server/info` and the Engine's password routes (which ES-5 says not to use) are served without one. The requests that take their tenant from the header `X-Tenant-Id` are the password sign-in, XAppHub sign-in and anonymous reads of public files. A browser can send `X-Tenant-Id` to the Engine from another origin, without cookies or credentials: the Engine allows that header from any origin and allows no credentialed cross-origin request. Even so, the request that names the tenant is the sign-in made through the application's own server route, which sends `X-Tenant-Id` with the value of `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A public file shown in a browser is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read. A request without a session that names no tenant is served from the Engine's host plane, not from the project. A request with a session takes its tenant from the session. |
| ES-5 | Always | On an Engine project the Supabase client is kept for sign-in only. Password sign-in, session refresh, reading the signed-in user and sign-out work through it, and its default sign-out ends the user's sessions on every device. An account that holds no role in the project's tenant is refused at password sign-in. XAppHub sign-in also works through it while the project's XAppHub connector is connected: the application's server gives the ID token from XAppHub to `signInWithIdToken` with the provider `my-apps`, and ends the session of an account that holds no role yet (the `add-external-oauth` skill). Not available on an Engine project: sign-up; OAuth sign-in with any provider other than XAppHub; magic link and one-time code; password recovery; changing a password, an email or a profile through the Supabase client; the Supabase client's code exchange; and the Supabase administration API. The Platform's password-less handoff opens the Studio; it is not a way for an application to sign a user in. |
| ES-6 | Always | On an Engine project multi-factor enrolment, challenge and verification are not served through the Supabase client. The Engine's own routes, each called with the user's session, are `POST /api/auth/mfa/enroll`, `GET /api/auth/mfa/factors`, `POST /api/auth/mfa/verify` and `POST /api/auth/mfa/unenroll`; a session that still needs its second factor is accepted elsewhere only after `POST /api/auth/mfa/verify`. |
| ES-7 | Always | On an Engine project an administrator creates every user who signs in with a password, through the Engine's user API (`POST /api/users` with an administrator's session) or the Studio's Users module, and gives the user a role in the project's tenant (`POST /api/users/:id/roles` with `role_id`, or the Users module). A user's first XAppHub sign-in creates that user's account, which holds no role until an administrator gives it one in the same way. An administrator resets a user's password, in the Studio's Users module. |
| ES-8 | Always | On an Engine project collections, fields, relations, roles, policies and permissions are created through the Engine's API (`/api/collections`, `/api/fields/:collection`, `/api/relations`, `/api/roles`, `/api/policies`, `/api/access`, `/api/permissions`) or its MCP tools `collections`, `fields`, `relations`, `roles`, `policies`, `access` and `permissions`. Access is roles, policies and permissions: a permission belongs to a policy, and a policy is attached to a role or a user. The MCP `collections` and `fields` tools keep a field's name, type and `meta` but not its `schema` block (default, not-null, length): set those through `POST /api/fields/:collection` with an administrator's session. |
| ES-9 | Always | On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest. |
| ES-10 | Always | On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the table [Engine runtime](#engine-runtime-es-10) lists; for each interface it lacks, the table says what replaces it. |
| ES-11 | Always | On an Engine project files are stored and served by the Engine: `/api/files`, `/api/folders`, `/api/files/signed-url`, and file content at `/api/files/assets/:id` (with a session or a signed token). A file shown in a browser, a public one included, is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read: an `<img>` element or a link sends no `X-Tenant-Id` (ES-4). Set no storage bucket option: the Engine stores files on its own disk or in S3. |
| ES-12 | Always | On an Engine project tests create their users and roles as ES-7 says, sign in as ES-5 says, and use the environment of ES-3. The only secrets a pipeline needs are the test administrator's email and password; it needs no Supabase secret. |
| ES-13n | Retired 25 October 2026 | Replaced by ES-13m, because every Engine project runs the Engine's scheduler. Copy it into no file. |
| ES-13m | Always (replaced ES-13n on 25 October 2026) | On an Engine project an active cron job fires at its scheduled time. |
| ES-14n | Until the Engine accepts the worker token on its data API | On an Engine project a worker reaches the data API at `DAAS_URL`, the Engine_URL, and presents its own worker token, read from `DAAS_TOKEN`, as `Authorization: Bearer`; never the project's MCP token. The worker may create, read, update and delete the items of every collection a member creates, and may change no collection, field, relation, role, policy, permission, account or setting. Until the Engine accepts the worker token on its data API, a worker cannot reach the data API of an Engine project: tell the developer so and stop. |
| ES-14m | Replaces ES-14n once the Engine accepts the worker token on its data API (for every collection, including those created later) | ES-14n without its last sentence. |
| ES-15 | Always | On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere. |
| ES-16 | Always | On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes of the `external-oauth` module, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`. For XAppHub sign-in the CLI installs the `external-oauth-engine` module in place of `external-oauth`; its routes are used as the `add-external-oauth` skill says. |

### Engine runtime (ES-10)

What stored code (hooks, cron jobs, custom services) has on the Engine, from the Engine's automation runtime documentation (its sections in brackets).

| Interface taught on a Supabase_Project | On the Engine | Replacement |
|---|---|---|
| The Supabase service in stored code (`services.supabase`) | Refused permanently, 501 `RUNTIME_SUPABASE_UNAVAILABLE` (§2.4) | `services.items(collection)`, with `{ elevated: true }` where the job must act as an administrator |
| SQL functions and raw SQL from stored code | No path (§2) | `services.items` calls, or a custom service |
| `services.items(c)` methods | Nine: `readByQuery`, `readOne`, `readMany`, `createOne`, `createMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`; `readByQuery` returns the array itself (§2) | Read `result`, not `result.data` |
| Query keys | `fields`, `filter`, `sort`, `limit`, `page`, `offset`, `search`; any other key is refused | Drop the key |
| Schema services | Read only: `readAll`, `readOne` | Change structure through ES-8 |
| `services.files` | Metadata only: `readByQuery`, `readOne` | Bytes through the application and `/api/files` |
| `services.mail` | Options `to`, `subject`, `html`, `text`, `replyTo`; returns `{ success, ... }`, does not throw (§6) | Check `success` |
| `services.env` | Empty unless the operator names keys (`RUNTIME_ENV_WHITELIST_<SCOPE>`, `RUNTIME_ENV_WHITELIST_GLOBAL`) (§7) | Ask the operator to name the key; never assume one |
| `services.fetch` | Only hosts in `EXTENSION_ALLOWED_DOMAINS`; empty list allows loopback only | Ask the operator to allow the host |
| `fetch`, `process`, `require`, `import`, `setTimeout`, `setInterval`, `eval`, `Function` | Do not exist (§1) | `services.fetch`; no timers |
| `Intl`, as in `create-service` lines 97-101 | Not found in the runtime's globals (`context`, `services`, `console`, `JSON`, `Date`, `Math`) | Format numbers by hand |
| `console` in a custom service body | Not in scope (§3); in hooks, cron jobs and service tests it is | Return what should be recorded |
| `console.table`, `console.trace` | Do not exist; `log`, `info`, `debug`, `warn`, `error` only (§4) | `console.log` |
| Update and delete hook payloads | `meta.keys` (array); `meta.key` only on create (§5) | Use `meta.keys` |
| Throwing from a filter hook | `new HookError(message, status, code)` is in scope | Unchanged |
| Filesystem extensions, `/api/ext/*` endpoints | None | Stored hooks, cron jobs, custom services |

## Tenancy statements

On an Engine project an application separates its customers in one of two modes. In the mode
`scope` every customer shares the project's one tenant and is separated by scope nodes, as ES-9
says; this is the default. In the mode `customer-tenants` each customer is a tenant of its own on
the Engine, copied from the project's tenant (the Blueprint), and the Platform creates the
customers. The texts below are worded once and copied verbatim, each as a paragraph of its own,
into Engine-only text only: an `engine` passage, a file marked `engine`, or an `engine-only`
folder. Unlike ES-1 to ES-16, a Tenancy statement never stands in shared text (R15
`ts-outside-engine`).

Each opens with "On an Engine project with Customer_Tenants". That opening is reserved: no other
text in the checked set may contain it (R15 `ts-altered`), so mode-specific prose elsewhere says
"In the mode `customer-tenants`". The machine copy is `tools/repo-check/tenancy-statements.json`;
`test/docs.test.mjs` keeps it equal to this table, and its `met` list says which dependencies are
met. A statement is live from its *When* start until its end; one that is not live is copied into
no file (R15 `ts-held-back`, `ts-retired`), and a live one is in every file its `in` list names
(`ts-required-missing`).

| Id | When | Text |
|---|---|---|
| TS-A | Always (from S1) | On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written. |
| TS-B | From S2 (TD-1 met) | On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session. |
| TS-Cn | From S2 (TD-1 met) until S3 (TD-3 met) | On an Engine project with Customer_Tenants collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks and custom services are built in the Blueprint, through the project's MCP token or an administrator's session bound there, never in a customer's tenant. A customer receives them once, when it is created from the Blueprint. Releases are not available yet, so a change made in the Blueprint later reaches no customer that already exists: tell the developer so before changing anything a customer already holds. |
| TS-Cm | From S3 (replaces TS-Cn) | On an Engine project with Customer_Tenants collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks and custom services are built in the Blueprint, through the project's MCP token or an administrator's session bound there, never in a customer's tenant. A customer receives a change only when a Platform member publishes a Release of the Blueprint and rolls it out from the Platform's Customers page; never change a customer's structure through its own schema routes. |
| TS-N0 | Until TD-1 is met | On an Engine project with Customer_Tenants each customer would be a tenant of its own, which the Buildpad platform does not offer yet: no project can have Customer_Tenants until it does. Tell the developer so and stop. Build no substitute: no tenant column, no project made by hand for each customer, and no host credential in the application. Scopes inside the project's one tenant are available now, with the `manage-scope` skill. |
| TS-N1 | Until TD-7 is met | On an Engine project with Customer_Tenants customers that sign themselves up are not available: only a Platform member creates a customer, on the Platform's Customers page, and no credential an application may hold can create one. Tell the developer so and stop: never put the host administrator's credential or a call to the Engine's tenant routes in the application. |
| TS-N2 | Until TD-8 is met | On an Engine project with Customer_Tenants a public page of one customer is not available: a request without a session acts in the tenant `X-Tenant-Id` names, and nothing maps a host name to a customer yet. A page without a session reads the Blueprint only, through `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. Tell the developer so and stop: do not put a customer's tenant id in the application or let a visitor choose it. |
| TS-N3 | Until TD-9 is met | On an Engine project with Customer_Tenants XAppHub sign-in is not available: its first sign-in would create the person's account in the Blueprint, outside every customer. Tell the developer so and stop: people sign in with a password, as the `add-multitenancy` skill's guide says. |
| TS-N4 | Until TD-10 is met | On an Engine project with Customer_Tenants a worker acts in the Blueprint only, with the project's own worker token; a worker that acts in a customer's tenant is not available. Work that must run in every customer runs as stored code (cron jobs, hooks) built in the Blueprint, which each customer receives as it receives the structure. Tell the developer so and stop: never give a worker a customer's credential or a host credential. |
| TS-N5 | Until TD-12 is met | On an Engine project with Customer_Tenants a backup or a restore of one customer is not available: a project backup holds every customer, and restoring it rolls every customer back. Tell the developer so and stop: build no export or restore of a customer's tenant in the application. |
| TS-N6 | Until TD-13 is met | On an Engine project with Customer_Tenants opening the Studio in a customer's tenant is not available from the Platform yet: it opens the Studio in the Blueprint. Tell the developer so and stop. |
| TS-N7 | Always | On an Engine project with Customer_Tenants moving an application built on scopes into Customer_Tenants is not available: nothing moves a customer's rows, people or files out of the project's tenant into a tenant of its own. Tell the developer so and stop. |

### The Tenancy check

The procedure that establishes the mode is worded once in `tools/repo-check/tenancy-check.md`,
between its sentinels `<!-- tenancy-check:begin v1 -->` and `<!-- tenancy-check:end -->`, and
copied byte for byte into exactly two files: `add-multitenancy/SKILL.md` (inside the chooser's
Engine passage) and `add-multitenancy/references/engine-customer-tenants.instructions.md` (after
its title). R15 reports an altered copy (`tenancy-check-altered`), a missing one
(`tenancy-check-missing`) and one in any other file (`tenancy-check-misplaced`). Every other skill
reaches the mode through TS-A, which names the two files itself.

### Where TS-A goes

A copy of ES-3, ES-4, ES-5, ES-7 or ES-9 is found by a fragment each copy keeps, verbatim or
adapted:

| ES | Anchor |
|---|---|
| ES-3 | `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>` |
| ES-4 | `The requests that take their tenant from the header` |
| ES-5 | `An account that holds no role in the project's tenant` |
| ES-7 | `gives the user a role in the project's tenant` |
| ES-9 | `the project is one tenant` |

Every section (from a `# ` or `## ` heading outside a fenced block to the next, or the text before
the first) whose Engine view holds an anchor holds TS-A in its Engine view; one copy serves every
anchor of the section (R15 `ts-a-missing`). Put it directly after the paragraph, list, blockquote
or table that holds the anchor, inside the Engine passage that holds it, else in a new Engine
passage directly after it. Every skill that holds a Tenancy statement also holds TS-A in its
`SKILL.md`; where that file has no anchor, TS-A goes in a new Engine passage directly after the
Gate.

## Convert a folder

A folder is held to every rule from the pull request that converts it. Until then, it keeps its
old Supabase text and the strict rules skip it.

1. Mark the folder's text, add the Gate and the Pointer where they belong, and write the Engine
   text.
2. Add the empty file `tools/repo-check/converted/<folder>`. From then on, rules R1 (guard),
   R3 (Gate), R6b (every link in both views) and R7 (Supabase view) apply to the folder.
3. Write `tools/repo-check/supabase-view-changes/<folder>.json`: one entry for each file whose
   Supabase view is not the old text moved (a reworded file, a reworded `description`, a new
   file that a Supabase project reads, a removed link), or `[]` if there is none:

   ```json
   [
     {
       "path": "add-users/SKILL.md",
       "kind": "text",
       "reason": "One sentence for the CHANGELOG.",
       "release": "unreleased"
     }
   ]
   ```

   `kind` is `text`, `description`, `new-file` or `removed-link`. Leave `release` as
   `"unreleased"`; the release pull request sets it to the tag and lists the entry in
   `CHANGELOG.md` (rule R10).
4. Run `node tools/repo-check/check.mjs --render <dir>` and read `<dir>/engine/<folder>`,
   `<dir>/supabase/<folder>` and that folder's hunks of `<dir>/supabase-vs-baseline.diff`. Record
   who read them, the date and the commit in the pull request description.

A folder's pull request edits only that folder and its two files above. It does not edit
`README.md`, `CHANGELOG.md` or `tools/repo-check/skill-map.json`.

The folders marked `UC` in `tools/repo-check/skill-map.json` stay byte-identical to `v1.0.0`;
the check refuses any change to them.

## Add a skill

1. Add a row for the new folder to `tools/repo-check/skill-map.json`: `folder`, `dependence`
   (`core`, `partial`, `wording only` or `none`), `treatment`, `size` and `plan` (`BP`, `EF`,
   `US`, `NY`, `RW`, `RW+G` or `UC`). Add the same row to the Skill map at the end of
   `.kiro/specs/backend-aware-skills/requirements.md`.
2. Make the skill meet Requirements 1 to 4 of that document: it establishes the backend before
   anything that differs (the Gate), it keeps what a Supabase project's agent reads, it gives an
   Engine project only what the Engine serves (the Engine statements above), and where the Engine
   has no counterpart it says so and stops.
3. Add the skill to the README catalogue, with a description that is true for both kinds of
   project or names its kind.
4. Add `tools/repo-check/converted/<folder>` and a change file whose entries list the new files
   (`"kind": "new-file"`). A new skill is a MINOR release.

The check fails a folder that has no row, a row that names no folder, and a marker in a folder
whose dependence is `wording only` (rule R4).

## Releases

Every release is an annotated tag `vMAJOR.MINOR.PATCH`; a tag is never moved. `v1.0.0` is the
skills as they were before Engine support. The version rules are at the top of
[`CHANGELOG.md`](CHANGELOG.md).

On the push of a tag, the check also fails when `CHANGELOG.md` has no section for the tag, when
any change-file entry is still `unreleased` (rule R10), or when a folder whose plan is not `UC`
has no `converted/<folder>` file (rule R13).

## What the check runs

| Rule | Fails |
|---|---|
| R1 | In a converted folder, a guard pattern in the Engine view (with file and line) |
| R2 | A marker error (the codes above), in any folder |
| R3 | In a converted folder, a missing, misplaced or altered Gate or Pointer; a link from another skill into `assets/`; a link to a comment-less `*-only` file from another skill or from text of another kind |
| R4 | A folder without a row in `skill-map.json`, a row without a folder (not on the `v1.0.0` tree of the `baseline` job, where a Skill added later has none), a marker in a `wording only` folder |
| R5 | A `SKILL.md` or persona without `name` or `description` in the raw file or either view; a `name` that differs from `v1.0.0` |
| R6a | A link from one skill to another that does not resolve in a view that holds it |
| R6b | In a converted folder, any relative link that does not resolve in a view that holds it, apart from the recorded breaks in `backend-contract.json` |
| R7 | A `UC` folder that differs from `v1.0.0`; in a converted folder, a Supabase view that differs from `v1.0.0` without a change-file entry |
| R8 | A Supabase statement or a guard pattern in a `settings-templates` folder or in the `rules` of the spec and steering skills |
| R9 | A subfolder under the top-level `references/` |
| R10 | A released change-file entry that its tag's `CHANGELOG.md` section does not name; on a tag push, the checks above |
| R11 | A skill missing from the README catalogue or listed twice; the README without `npx skills add buildpad-ai/skills#v1.0.0` |
| R12 | `backend-contract.json` or `cases.json` that no longer agree with their pinned copy (`test/contract.test.mjs`) |
| R13 | On a tag push, a folder whose plan is not `UC` and that has no `converted/<folder>` |
| R14 | A `SKILL.md` or persona whose front matter is not valid YAML, in the raw file or either view: `npx skills add` skips such a file without a word. Quote a value that holds `: ` or ` #`, or that starts with `[`, `{` or another YAML indicator |
| R15 | A paragraph that holds the reserved opening and is not a Tenancy statement word for word (`ts-altered`); the opening or a Tenancy check sentinel outside Engine-only text (`ts-outside-engine`); a section whose Engine view holds an anchor without TS-A (`ts-a-missing`); a statement copied before its dependency is met or after it is retired (`ts-held-back`, `ts-retired`); a live statement missing from a file its `in` list names (`ts-required-missing`); a Tenancy check copy altered, missing or in another file (`tenancy-check-altered`, `tenancy-check-missing`, `tenancy-check-misplaced`) |

`tools/repo-check/contract/backend-contract.json` and `cases.json` are shared with the Buildpad
Platform, which runs its own tests against them. A change to either needs the same change on the
Platform side, released in a tag.
