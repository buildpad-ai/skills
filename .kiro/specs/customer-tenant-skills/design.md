# Design Document: Customer-Tenant Skills (skills repository part)

> **Status.** Not approved. Phase 2 of a gated spec, written 2026-11-07 against the **approved**
> requirements of this folder (9 requirements, 39 criteria; Decisions TS-1 to TS-7 settled as
> recommended; the companions' Decisions settled: Platform 1–21, Engine entry 192 1–16). No skill
> folder, `CONTRIBUTING.md`, test or tool is changed by this document; tasks.md follows approval.
>
> **Revisions read (read, not run).**
> - This repository: worktree branch `spec/customer-tenant-skills`, cut from `origin/main` `3cb4a00`
>   (the v9.0.0 release merge). Every line number below is that tree's.
> - The Platform's companion: `buildpad-platform` `.kiro/specs/project-tenants/requirements.md` at
>   `spec/project-tenants` `f155ebce` (Decisions settled, requirements not yet approved).
> - The Engine's companion: `buildpad-daas-go` `.kiro/specs/tenant-schema-fan-out/requirements.md` at
>   `spec/tenant-schema-fan-out` `ad76ce05` (Decisions settled, requirements not yet approved).
> - The Engine's identity routes at `buildpad-daas-go` `origin/main` `9bf9d457` (read with
>   `git show`): `src/domain/auth/routes/auth_routes.go:176-183`,
>   `src/domain/auth/feature/token/application/tenant_handler.go`,
>   `src/domain/auth/feature/token/service/tenant_switch.go:33-262`,
>   `src/domain/auth/feature/token/service/tenant_binding.go:30-133`,
>   `src/domain/auth/feature/token/service/auth_service.go:195-245`,
>   `src/middleware/tenant_binder.go:197-275`, `src/constant/constant_error.go:87-152`,
>   `src/domain/auth/feature/gotrue/application/gotrue_handler.go:47-73`,
>   `database/migration/tenant/20261102100000_project_roles.up.sql:1-13` and
>   `20260909000006_seed_reference_data.up.sql:24-28`. Nothing under `src/domain/auth` or
>   `src/middleware/tenant_binder.go` changed between `cf2da226` (the requirements' read) and `9bf9d457`.
>
> No request was sent to any Engine, no agent was run against a skill, and the companions' designs
> (being written in parallel) were not read. What this design assumes of them is listed once, in
> [Companion contract assumed](#companion-contract-assumed), for reconciliation.

## Overview

**Purpose.** The skills learn a second Tenancy_Mode, `customer-tenants`, in which each customer of an
Engine_Project's application is an Engine tenant of its own, copied from the project's tenant (the
Blueprint). A Skill establishes the mode by a fixed procedure (the **Tenancy check**, T2) before it
directs anything that differs; `add-multitenancy` becomes the place where the developer chooses
between scopes, Customer_Tenants and a project per customer; everything the mode directs lives in
one **Mode_Guide**; and the Engine passages that would otherwise direct one-tenant code carry a few
**Tenancy_Statements**, worded once and checked by a new Repository_Check rule, R15.

**Users.** Agents in Engine_Projects (Kits and Raw_Installs) and the developers who direct them; the
maintainers of this repository.

**Impact.** 34 folders change (the requirements' Skill map, less `add-mobile-app`, plus `create-cron`
and `create-service`: [Skill map confirmed](#skill-map-confirmed)). 9 of them move from plan `RW` to
`BP` and gain the Gate, because every Tenancy_Statement must stand in an Engine passage. New files:
the Mode_Guide, `tools/repo-check/tenancy-check.md`, `tools/repo-check/tenancy-statements.json`,
`tools/repo-check/lib/tenancy.mjs`, `tools/repo-check/test/tenancy.test.mjs`. No Supabase view
changes (R7), so every stage is a MINOR release (9.4).

### Goals
- Every criterion realised or scheduled behind a named dependency, traced in
  [Requirements Traceability](#requirements-traceability).
- The Tenancy check and the Tenancy_Statements worded once, copied verbatim, and checked (R15).
- In `scope` mode, and on every Supabase project, the skills read exactly as today (1.4, R7).
- Nothing in the skills offers a substitute for what the mode does not have (Requirement 7).

### Non-Goals
- Every Engine and Platform change (the companions); the SDK and the CLI templates (TD-6).
- Moving a `scope`-mode app's customers into Customer_Tenants; a Supabase project.
- Rewording ES-1 to ES-16 (9.3 keeps ES-3, ES-4, ES-5, ES-7 and ES-9 verbatim).
- Checking that copies of ES-1 to ES-16 match their register (they are not checked today; Issue 1).
- Steps for the features Requirement 7 lists as not available: each needs its own spec once its
  dependency is met.

## Boundary Commitments

### This Spec Owns
- The Tenancy check (T2), the record file `.buildpad/tenancy-answer.json` and its format (T1).
- The Mode_Guide `add-multitenancy/references/engine-customer-tenants.instructions.md` and the
  chooser in `add-multitenancy/SKILL.md`.
- The Tenancy_Statements TS-A, TS-B, TS-Cn, TS-Cm and TS-N0 to TS-N7 (T4), their register in
  `CONTRIBUTING.md`, their machine copy `tools/repo-check/tenancy-statements.json`, and every copy.
- Rule R15 of the Repository_Check and its tests; the 9 rows of `skill-map.json` that change.
- The stages and their releases (T3, [Release plan](#release-plan)).

### Out of Boundary
- `.buildpad/project.json` and its member `tenancy`: the Platform writes it (its Decision 19 (b));
  this repository only reads it, as for `backend` (§C12).
- The backend Gate, ES-1 to ES-16, the marker grammar and the shared contract
  (`backend-aware-skills`), which stay as they are.
- The Customers page, Releases, Rollouts, the flag, the quota, every account the Platform makes
  (Platform); every tenant rule, Release and Rollout behaviour (Engine).
- What the Buildpad CLI generates and what the SDK sends (`buildpad-ui`, TD-6).

### Allowed Dependencies
- The Engine identity routes and answers verified at `9bf9d457` (contract rows X-1 to X-12).
- The companions' requirements as settled (contract rows P-1 to P-18, E-1 to E-14).
- The Repository_Check's existing libraries (`passages.mjs` for views, `markdown.mjs` for fences
  and front matter), Node 22 standard library only.
- Direction: skill text depends on the contract rows; R15 depends on `tenancy-statements.json`
  and `tenancy-check.md`; nothing in a skill depends on the check.

### Revalidation Triggers
Each forces a re-read of the files named here and, where text changes, a release:
- **A companion design** that names a route, field, option, state or code otherwise than the
  [Companion contract assumed](#companion-contract-assumed) row it matches.
- **A dependency becoming met** (TD-1, TD-3, TD-6 to TD-10, TD-12, TD-13): the stage it opens
  (T3) is written and released; `met` in `tenancy-statements.json` changes in the same pull request.
- **The Engine's identity routes** (`/api/auth/tenants`, `/api/auth/tenant`,
  `/api/auth/tenants/:id`), the sign-in binding rules, or the tenant binder's answers.
- **ES-3, ES-4, ES-5, ES-7 or ES-9 reworded**: the anchors of `tenancy-statements.json` (T6).
- **The Tenancy check's text**: its version in the sentinel changes (`v1` to `v2`), both copies
  change in one pull request.
- **A new Skill that builds structure or signs people in**: it carries TS-A from its first release.

## Contracts used and names fixed here

### T1 The Tenancy_Signal and the record file (TS-1 (c))

| Source | File | Member | Values | Read when |
|---|---|---|---|---|
| Signal | `.buildpad/project.json` (the Platform writes it, Decision 19 (b)) | `tenancy` | `"scope"`, `"customer-tenants"` | always first |
| Record | `.buildpad/tenancy-answer.json` (the agent writes it) | `tenancy` | as above | when the signal has no valid `tenancy` |

- **Record content**, written by the agent: exactly
  `{"buildpadTenancyAnswer": 1, "tenancy": "customer-tenants"}` or the same with `"scope"`; UTF-8,
  LF, a trailing newline. `buildpadTenancyAnswer` is the format version. Separate from
  `.buildpad/backend-answer.json`, so neither procedure rewrites the other's file.
- **Reading rule:** parse as JSON, read `tenancy`; a missing file, text that is not JSON, a missing
  member or any other value is no answer. A `.buildpad/project.json` holding only `backend` (every
  Kit written before Decision 19 ships) has no `tenancy` and so gives no answer.
- **Version control:** the developer commits the record; it is never added to `.gitignore`. The
  agent never writes `.buildpad/project.json` (§C12).
- **Disagreement:** the signal wins, and the developer is told how a Kit downloaded before the
  flag changed is brought up to date (the Platform's Decision 19: download the Kit again, or set
  the member).
- **Never read for the mode:** an environment file (so not `BUILDPAD_TENANCY`, TS-1 (b)), an MCP
  configuration file, `get_project_detail` (it returns credentials), `GET /api/tenants` (1.3).

### T2 The Tenancy check (Requirement 1)

The canonical text is the new file `tools/repo-check/tenancy-check.md`. It is copied byte for byte
into exactly two files, both Engine-only text: `add-multitenancy/SKILL.md` (inside the chooser's
Engine passage) and the Mode_Guide (after its title). Every other Skill reaches it through TS-A,
which names the two files itself, so a single-skill install still finds the mode. The sentinels
are HTML comments that hold no marker token.

```markdown
<!-- tenancy-check:begin v1 -->
**Establish the tenancy mode.** An Engine project's application separates its customers in one of
two modes: `scope`, where customers share the project's one tenant and are separated by scope
nodes (the default), or `customer-tenants`, where each customer is a tenant of its own, copied from
the project's tenant (the Blueprint). Before you act on anything that differs between the two, find
the mode with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `tenancy` is
   `"scope"` or `"customer-tenants"`, that is the mode. If `.buildpad/tenancy-answer.json` names
   the other mode, tell the developer the two files disagree and follow `.buildpad/project.json`:
   when Customer_Tenants were turned on or off after the starter kit was downloaded, the developer
   sets `tenancy` in `.buildpad/project.json` or downloads the kit again.
2. Otherwise read `.buildpad/tenancy-answer.json` in the same way; if its `tenancy` is `"scope"`
   or `"customer-tenants"`, that is the mode.
3. Otherwise, if the request is for customers that each have their own data, people or
   administrators, ask the developer once: "Does each customer of this application have a tenant
   of its own on the Engine (Customer_Tenants, turned on for the project on the Buildpad
   platform), or do all customers share the project's one tenant, separated by scopes?" Write the
   answer to `.buildpad/tenancy-answer.json` as
   `{"buildpadTenancyAnswer": 1, "tenancy": "customer-tenants"}` or
   `{"buildpadTenancyAnswer": 1, "tenancy": "scope"}`, and ask the developer to commit that file.
   Do not add it to `.gitignore`. Never write `.buildpad/project.json`.
4. Otherwise the mode is `scope`.

To find the mode, do not open an environment file (`.env`, `.env.*`) or an MCP configuration file,
do not call a tool that returns project credentials, and do not call `GET /api/tenants`. In the
mode `scope` the rest of the skills hold as written. In the mode `customer-tenants` follow the
guide `engine-customer-tenants` of the `add-multitenancy` skill wherever it differs from them.
<!-- tenancy-check:end -->
```

| Property | How the text meets it |
|---|---|
| After the backend gate (1.1) | Both copies stand in Engine-only text, which an agent reaches only after the Gate found an Engine_Project; the first sentence says "An Engine project's" |
| Absent signal (1.2) | Step 4 is `scope`; step 3 asks only when the request names separate customers with their own data, people or administrators, and records the answer so it is asked once |
| No secret, no tenant routes (1.3) | Two committed JSON files; env files, MCP configuration, credential tools and `GET /api/tenants` forbidden |
| `scope` unchanged (1.4) | Last paragraph; every `customer-tenants` text is additional Engine text (T5) |
| Stale Kit (TS-1 (a) caveat) | Step 1's disagreement sentence, from the Platform's Decision 19 |

### T3 Stages: what lands when (TS-3 (b))

| Stage | Opens when | Lands |
|---|---|---|
| **S1, now** | This feature's first release | Requirement 1 (T2, TS-A in every changed folder), Requirement 2 (the chooser), Requirement 7 (TS-N0 to TS-N7, 7.2, 7.3), Requirement 9 (register, R15). The Mode_Guide holds §1 to §4 and §9 only. Every Skill that reaches the mode meets TS-N0 and stops |
| **S2** | TD-1 met: the Platform's `project-tenants` approved and its Wave 1 shipped (flag, Customers page, creation) | TS-N0 retired; TS-B and TS-Cn copied; Requirements 3, 4, 6, 8 and 5.1, 5.4 (creation half), 5.5, 5.6. Mode_Guide §5 to §8, §10 to §12 |
| **S3** | TD-3 met: Engine entry 192 applied, and the Platform's Requirement 9 (Releases on the Customers page) shipped | TS-Cn retired, TS-Cm copied in its place; 5.2, 5.3, 5.4 (Rollout half); Mode_Guide §7.4 and §7.5; the "not yet released" debugging row restated |
| Later, one per row | TD-6, TD-7, TD-8, TD-9, TD-10, TD-12, TD-13 | Each retires its not-available statement (TD-6 has none: it replaces hand-written route code with SDK calls) and needs a spec of its own for the steps it opens |

TD-2 opens no stage: the Tenancy check already reads `tenancy`, and the record file covers a Kit
without it. TD-4 and TD-5 are settled facts the S2 and S3 texts state. TD-11 is met in code and the
S2 text relies on it (contract row X-9).

Two dependencies are named here because Requirement 7.1 lists their features without a row:
**TD-12** (Platform, Wave 3, its Decision 14 (a)): a backup and a restore of one customer;
**TD-13** (Platform, Wave 2, its Requirement 10): opening the Studio in a customer.

### T4 The Tenancy_Statements (Requirement 9)

Worded once here, registered in `CONTRIBUTING.md` (T6) and copied verbatim, each as a paragraph of
its own, only in Engine-only text. Each opens "On an Engine project with Customer_Tenants"; that
opening is **reserved**: no other text in the checked set may contain it (R15 `ts-altered`), so
mode-specific prose elsewhere says "In the mode `customer-tenants`". None holds a §C20 pattern or
the marker token (guard test, Testing Strategy). The **When** column follows ES-14n/ES-14m: a
statement is live from its `requires` until its `until`; a statement that is not live is copied
into no file.

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

Draft texts TS-A to TS-C of the requirements are kept in substance. Changed in design: TS-A names
the two files (a single-skill install may lack `add-multitenancy`); TS-B says how the switched pair
is used (3.3); TS-C is split into TS-Cn and TS-Cm because Platform Wave 1 may ship before entry 192
(its Delivery waves), and TS-Cm forbids a customer's schema routes (5.2).

### T5 How a held-back passage says so

- **Statements** say it in the register's **When** column, and R15 enforces it: a statement whose
  dependency is unmet is copied nowhere (`ts-held-back`); one whose `until` is met is copied
  nowhere (`ts-retired`); a live one is in every file `tenancy-statements.json` requires it in
  (`ts-required-missing`). Moving a stage is one edit of `met` plus the text that edit forces.
- **Other passages** behind a dependency are **not written** until their stage (TS-3 (b)), as
  `backend-aware-skills` held back Engine steps behind unmet dependencies. Until then the Mode_Guide's
  §1 (Status) names, in plain words, what is not yet available, and TS-N0 stops the agent.
- **Within the Mode_Guide**, a section that waits on a later stage is absent, never present with a
  warning: §1 (Status) is the one place that says what the current stage does not yet offer.
- **TD-6 (the SDK)** is the one dependency whose passages land before it is met: the guidance names
  the Engine routes directly and says, in one sentence, that the CLI's generated sign-in route and
  the SDK do not know this mode yet ([App code](#app-code-sign-in-switch-and-current-tenant-requirement-3)).

### T6 Register and machine copy

`CONTRIBUTING.md` gains, after the "Engine runtime (ES-10)" table, a section **Tenancy statements**:
what the mode is (one paragraph), the reserved opening, the T4 table (Id, When, Text), the Tenancy
check (where its canonical copy is and the two files that carry it), the TS-A placement rule (T7),
and a row R15 in "What the check runs". `CONTRIBUTING.md` is outside the checked set, so the
register may hold the reserved opening.

`tools/repo-check/tenancy-statements.json` is the machine copy (Data Models). `docs.test.mjs`
asserts that every statement's text in the JSON equals its register row in `CONTRIBUTING.md`,
character for character, so the two cannot drift.

### T7 Where TS-A goes (9.3)

- **Anchors.** A copy of ES-3, ES-4, ES-5, ES-7 or ES-9 is found by a fragment each copy keeps,
  verbatim or adapted (most copies of ES-4 are adapted, and no copy of it is verbatim):

  | ES | Anchor |
  |---|---|
  | ES-3 | `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>` |
  | ES-4 | `The requests that take their tenant from the header` |
  | ES-5 | `An account that holds no role in the project's tenant` |
  | ES-7 | `gives the user a role in the project's tenant` |
  | ES-9 | `the project is one tenant` |

- **Rule.** Every **section** (from a `# ` or `## ` heading outside a fenced block to the next, or
  the text before the first) whose Engine view holds an anchor holds TS-A in its Engine view. One
  copy serves every anchor of the section. This makes "an agent reading ES-9 reads next to it"
  checkable, and is stricter than the criterion's "each folder".
- **Insertion point** (named **I-A(n)** below): directly after the paragraph, list, blockquote or
  table that holds the anchor at line *n*; inside the Engine passage that holds it when there is
  one, else in a new Engine passage directly after it.
- **I-G**: in a new Engine passage directly after the Gate of a `SKILL.md` that holds no anchor
  (every changed folder carries TS-A in its `SKILL.md` from S1, so every changed Skill establishes
  the mode before it directs anything that differs, 1.1).
- **I-P(a–b)**: at the end of the existing Engine passage at lines *a*–*b*. **I-F**: plain text
  at the named place of a whole-file Engine reference.

At `3cb4a00` there are 41 such sections in 32 files (listed per folder in the
[per-folder plan](#per-folder-plan)).

## The Mode_Guide (TS-2 (b))

**File:** `add-multitenancy/references/engine-customer-tenants.instructions.md` (new). First line
`<!-- buildpad-backend-file: engine -->`, then the Gate (S4 of `backend-aware-skills`), then the title
`# Customer_Tenants on an Engine project`, then the Tenancy check (T2). Whole-file Engine, so a
Supabase Kit never carries it and R7 sees no new Supabase file. Links out of it go to other Skills'
`SKILL.md` only (S6 rule).

| § | Heading | Stage | Holds (criteria) |
|---|---|---|---|
| 1 | Status | S1, restated at S2 and S3 | S1: TS-N0. S2: "Available: sign-in, scopes, structure built in the Blueprint, people. Not yet: Releases (TS-Cn)." S3: "Available: all of the above and Releases." Always: a pointer to §4 |
| 2 | What the mode is | S1 | TS-A. Each customer is a tenant (its own schema, people, roles and administrators; ADR-008); the Blueprint is the project's tenant (Platform Decision 4 (a)); the project's MCP token and every worker token are bound to the Blueprint (Engine `static_token_resolver.go:65-70`), so an agent builds there and reaches no customer; a Platform member creates customers on the Customers page |
| 3 | Never | S1 | 2.4: never the host administrator's credential, a host session or `/api/tenants` in an application, a worker, a test or a tool call; never a customer created from code; never a tenant id taken from user input outside the switch (8.2) |
| 4 | Not available | S1 | TS-N1 to TS-N7, each followed by one line naming who could offer it later (7.1) |
| 5 | Signing in and the current customer | S2 | TS-B and the [App code](#app-code-sign-in-switch-and-current-tenant-requirement-3) design: 5.1 sign-in, 5.2 unbound session (TS-4), 5.3 switch, 5.4 current customer (TS-5) and its name and switch menu (3.5), 5.5 answers and their causes (3.6), 5.6 `NEXT_PUBLIC_BUILDPAD_TENANT_ID` is the Blueprint's (3.7) with TS-N2, 5.7 XAppHub (3.8) with TS-N3, 5.8 caches after a switch (8.2) |
| 6 | Scopes inside a customer | S2 | [Requirement 4 text](#scopes-inside-a-customer-requirement-4) |
| 7 | Structure is built in the Blueprint | S2 (7.1 to 7.3), S3 (7.4, 7.5) | 7.1 TS-Cn, at S3 TS-Cm (5.1, 5.2); 7.2 roles by identifier (5.5); 7.3 cron jobs (5.4); 7.4 Releases and Rollouts (5.2); 7.5 expand, release, contract and Drift (5.3) |
| 8 | People | S2 | [Requirement 6 text](#people-requirement-6) |
| 9 | Workers and tests | S1 | TS-N4 (7.2); tests (7.3) |
| 10 | Planning | S2 | 5.6 |
| 11 | When something goes wrong | S2, restated at S3 | 8.1 table |
| 12 | Review checks | S2 | 8.2 list |

### The chooser in `add-multitenancy/SKILL.md` (Requirement 2)

The folder's `SKILL.md` gains the Gate directly after `# Add Multitenancy` (line 7). Its blockquote
(lines 9–15, which holds ES-9) and its last line ("See `/manage-scope` …", line 16) stay as they
are. Between them, a new Engine passage:

```markdown
<!-- buildpad-backend: engine -->
<TS-A>

## Choose how customers are separated

<the Tenancy check, T2>

An application that serves many customers separates them in one of three ways. Choose with the
developer before you build anything:

| Separation | When it fits | Who sets it up |
|---|---|---|
| Scope nodes inside the project's one tenant | Customers share one structure, reports cross customers, and no customer has administrators of its own in the data service | You, with the `manage-scope` skill |
| Customer_Tenants on one project | The database must keep each customer's data apart (a schema each); each customer has its own people, roles and administrators; every customer runs the same structure, kept in step by Releases | Customer_Tenants are turned on for the project on the Buildpad platform, and a Platform member creates each customer on the project's Customers page |
| One project per customer | A customer needs its own region, Engine version, backups and restores, SSO issuer or capacity, or there are more customers than the project's quota allows | A Platform member creates each project |

Customer_Tenants have limits: about 1,000 to 2,000 tenants share one database; every customer
shares one Engine, one connection pool and one upgrade window; a project backup restores every
customer at once; and they exist on Engine projects only.

- In the mode `scope`, continue with `/manage-scope` as above.
- If the developer chooses Customer_Tenants and the mode is not `customer-tenants`, tell the
  developer that Customer_Tenants are turned on for the project on the Buildpad platform, after
  which they set `"tenancy": "customer-tenants"` in `.buildpad/project.json` or download the kit
  again, and stop.
- In the mode `customer-tenants`, follow [the guide](references/engine-customer-tenants.instructions.md).

Never put the Engine's host administrator credential, a session bound to the Engine's host, or a
call to `/api/tenants` into an application, a worker, a test or a tool call of yours, and never
create a customer from code.

<TS-N0>

<TS-N1>
<!-- /buildpad-backend -->
```

The front-matter `description` ("delegates to /manage-scope, the standard approach") stays: it is
true in both modes, and changing it would be a Supabase-view change (R7, MAJOR).

## App code: sign-in, switch and current tenant (Requirement 3)

Lands at S2 in Mode_Guide §5, and in the sign-in folders' passages (per-folder plan). The guidance
names the Engine's routes directly. **SDK dependency (TD-6), said once in §5:** "The Buildpad CLI's
generated sign-in route and the SDK do not know this mode yet: the generated login route sends
`X-Tenant-Id` and has no switch. In the mode `customer-tenants`, replace the login route with the
one below and add the three routes after it; a later release of the skills names the SDK's
functions instead."

**Routes the application holds** (Next.js App Router, server only, each with the session cookies of
`@supabase/ssr`, as `create-api-route` writes them today):

| App route | Engine call | Answer to the browser |
|---|---|---|
| `POST /api/auth/login` | Supabase client `signInWithPassword` against the Engine_URL **with no `X-Tenant-Id` header** (3.1); then `settleTenant` | `{data: {tenant}}`, `{data: {choose: [...]}}`, or 403 with "Your account does not belong to any customer of this application" |
| `GET /api/auth/tenants` | `GET <Engine_URL>/api/auth/tenants`, `Authorization: Bearer <access token>` | the entries of `kind: "tenant"`, each with `blueprint: id === NEXT_PUBLIC_BUILDPAD_TENANT_ID` |
| `POST /api/auth/tenant` | `POST <Engine_URL>/api/auth/tenant`, body `{"tenant": "<id>"}`, `Authorization: Bearer <access token>`; then `supabase.auth.setSession` with the answered pair (3.3) | `{data: {tenant}}`; the browser then reloads the page (`window.location.assign("/")`) |
| `DELETE /api/auth/tenants/[id]` | `DELETE <Engine_URL>/api/auth/tenants/:id` (decline an invitation not yet entered) | 204, or the Engine's 409 or 404 |

**`settleTenant` (TS-4 (a)).** After every sign-in, and in the layout when a signed-in request
finds no current customer (a refresh of an unbound session stays unbound, 3.2):

```ts
// lib/auth/tenants.ts — server only. In the mode customer-tenants.
const ENGINE = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // the Engine_URL (ES-1)

export type MyTenant = {
  id: string; name: string; uri_path: string | null; current: boolean;
  kind: "host" | "tenant"; accepted: boolean; state: string;
};

export async function listTenants(accessToken: string): Promise<MyTenant[]> {
  const r = await fetch(`${ENGINE}/api/auth/tenants`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!r.ok) throw await engineError(r);
  // The Engine lists the host too when the person has a place there: never offer it.
  return ((await r.json()).data as MyTenant[]).filter((t) => t.kind === "tenant");
}

export async function switchTenant(accessToken: string, tenant: string) {
  const r = await fetch(`${ENGINE}/api/auth/tenant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tenant }),
  });
  if (!r.ok) throw await engineError(r);
  // { access_token, refresh_token, expires }: expires is the remaining lifetime in milliseconds.
  return (await r.json()).data as { access_token: string; refresh_token: string; expires: number };
}

export async function settleTenant(supabase: ServerClient, accessToken: string) {
  const tenants = await listTenants(accessToken);
  const current = tenants.find((t) => t.current);
  if (current) return { tenant: current };                        // bound to a customer already
  if (tenants.length === 0) {                                     // belongs to no customer
    await supabase.auth.signOut();
    return { error: "NO_CUSTOMER" as const };
  }
  if (tenants.length === 1) {                                     // one: switch without asking
    const pair = await switchTenant(accessToken, tenants[0].id);  // this also enters an invitation
    await supabase.auth.setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    return { tenant: tenants[0] };
  }
  return { choose: tenants };                                     // several: the person chooses
}
```

Rules the guide states with it:
- **Unbound or host-bound sessions** (3.2). A session with no `current` entry of `kind: "tenant"`
  is not used for anything but these four routes: one bound to the host (a person with a host role
  is bound there by the sign-in rules, X-4) is treated as unbound, and its access token is sent to
  no data route.
- **The chooser** (TS-4 (a), 3.5) lists each tenant's `name`; marks the one whose `id` equals
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID` as the application's own tenant (only its developers hold it);
  shows `accepted: false` entries as invitations with "Join" (the switch, which enters it) and
  "Decline"; shows an entry whose `state` is not `ready` as unavailable, with the cause of the
  table below. It may preselect the last choice, kept in the browser as a preference only (TS-5).
- **The switch** (3.3) runs only in the app's server route, with the current session. After
  `setSession` the old access token is never sent again; the old pair is not signed out (the
  Supabase client's default sign-out ends every session of the person, the new one included). The
  browser reloads the whole page, so every client cache, `DaaSProvider` and any `ScopeProvider`
  start in the new customer (8.2).
- **The current customer** (3.4, TS-5) is the `current` entry of `GET /api/auth/tenants`, read once
  per request on the server (React `cache`); the access token's `tnt` claim names the same tenant
  and may be read instead. The app never stores a tenant id of its own for requests and sends no
  tenant id on a request that carries a session. The layout shows the current customer's `name`,
  and a "Switch customer" menu when the person holds more than one tenant of `kind: "tenant"` (3.5).
- **`NEXT_PUBLIC_BUILDPAD_TENANT_ID`** stays the Blueprint's id (3.7): it labels the application's
  own tenant in the chooser, and names the tenant of a request without a session; TS-N2 follows.
- **XAppHub** (3.8): TS-N3.

**Answers and their causes** (3.6; the forwarder of `create-api-route` maps them, and only the 503
is retried):

| Engine answer | Cause | What the app shows | Retry |
|---|---|---|---|
| 401 `TENANT_SUSPENDED` | A Platform member suspended this customer | "Access to <customer> is suspended. Ask your administrator." Then sign out | No |
| 401 `TOKEN_INVALID` | The session ended, or this customer was deleted | "Your session has ended. Sign in again." Then the sign-in page | No |
| 503 `SERVICE_UNAVAILABLE` | The customer is being updated (a Rollout or an Engine upgrade), or the Engine's session store is unavailable | "<customer> is being updated. Try again in a minute." | Yes: up to 3 times, after 2, 5 and 10 seconds |
| 403 `FORBIDDEN`, "This token is not bound to a tenant. Switch to a tenant first." | The session was never switched | The chooser (`settleTenant`) | After the switch |
| 403 `TENANT_SUSPENDED` from the switch | The chosen customer is suspended | As 401 `TENANT_SUSPENDED`, staying on the chooser | No |
| 403 `FORBIDDEN` from the switch | The person holds no place in that tenant | "You are not a member of that customer." | No |
| 401 `USER_SUSPENDED` from the switch | The person's account is not active | "Your account is not active. Ask your administrator." Then sign out | No |

## Scopes inside a customer (Requirement 4)

Mode_Guide §6, S2, and the `manage-scope`, `create-collection`, `create-rbac`, `create-feature`
passages that point to it:
- Every scope URI begins with the current customer's node: the `uri_path` of the `current` entry of
  `GET /api/auth/tenants`, never the Blueprint's and never one built from
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID` (4.1). A `ScopeProvider`'s root is that node.
- A scope type's id differs in every customer (a creation copies the Blueprint's scope types under
  new ids, Engine entry 135): look scope types up by name in the current customer. Roles are the
  opposite (7.2 below).
- No Release carries a scope type (Engine entry 192 Decision 2, criterion 1.6). A creation copies
  the Blueprint's own scope types as they are at that moment, beside the latest Release (entry 192
  design, "What a revision carries"), so a scope type made in the Blueprint reaches every customer
  created after it, and no customer created before it (4.2). The application's setup screen for a
  customer's administrator therefore creates a scope type it needs when it finds it missing,
  beneath their own tenant node.
- A customer's administrator may create scope types and nodes beneath their own tenant node. Direct
  no root type and no first-level node: a first-level node is a tenant, which only the host creates
  (4.3).
- A role's `scope_config` made in the Blueprint may name the Blueprint's node and its own scope
  types: a Rollout rewrites them to each customer's node and same-named types, as a creation does
  (entry 192 design, `template.RewriteScopeConfig`). A pattern naming a scope type a customer lacks
  is a Conflict (`scope_type_unmapped`) and that customer is skipped, so create the type in the
  customer first (Issue 7).

## Structure is built in the Blueprint (Requirement 5)

Mode_Guide §7. **7.1** (S2): TS-Cn; at S3 TS-Cm. The project's MCP token is bound to the Blueprint,
so every MCP tool builds there; an administrator's session used for `POST /api/fields/:collection`
(ES-8) is the developer's, bound to the Blueprint. Rows are not structure: a `languages` row, a form
definition, a folder or a setting is data, which no creation copies and no Release carries.

**7.2 Roles by identifier** (S2, 5.5, TS-7 (a)): a role or policy made in the Blueprint keeps its id
in every customer created from it (entry 135's copy) and every Release (entry 192 Decision 9); a
customer may rename it. Application code names such a role by its id, never by its name. The four
seeded roles have fixed ids in every tenant: Administrator `00000000-0000-0000-0000-000000000001`,
User `…0002`, Project Developer `…0003`, Project Viewer `…0004`; no Release removes or renames them
(entry 192 Decision 15 (c)).

**7.3 Cron jobs** (5.4). S2: "A customer created from the Blueprint receives its cron jobs
inactive, whatever their status in the Blueprint (Engine entry 135). Until Releases are available,
each customer's administrator switches a job on in their own customer." S3 adds: "A Release leaves
a job's status as the customer holds it, and a job a Release adds arrives inactive, unless the
member rolls the Release out with the option that starts jobs as in the Blueprint
(`cron_status: "as_template"`), which gives every job the Release manages the Blueprint's status.
For a job meant to run in every customer, ask the member to roll out first without it, and with it
once the canary customers pass."

**7.4 Releases and Rollouts** (S3, 5.2): a Platform member with the project's
`manage_project_tenants` right publishes a Release on the Customers page, runs a dry run that shows,
per customer, what is added, changed and removed, the Drift and the Conflicts, and rolls it out,
canary customers first. A Release carries collections, fields, relations, indexes and unique
constraints, roles, policies, permissions, unscoped grants, module access keys, scope collection
settings, workflows and their bindings, extensions, custom services and cron jobs; never rows,
people, role assignments, grants that name a person or a scope node, settings, scope nodes or scope
types. What a customer made itself is never touched. An agent never calls a customer's
`/api/schema/diff` or `/api/schema/apply`, and has no session to do so.

**7.5 Expand, release, contract** (S3, 5.3), for removing or renaming a field: (1) add the new
field in the Blueprint; (2) release and roll out; (3) move the application and the data to the new
field (a migration of each customer's rows is the customer's data: run it as stored code that each
customer receives, or as a step the customer's administrator runs); (4) release and roll out; (5)
remove the old field in the Blueprint; (6) release and roll out with destructive changes allowed,
which the member confirms by typing the Blueprint's path. A rename is seen by a Rollout as one field
removed and another added (entry 192 Decision 16 (a)), so it is always done this way. A customer
whose managed structure differs from its Release (Drift) is skipped, and one with a Conflict is
skipped, unless the member overrides it (entry 192 Decisions 4 and 6).

**5.6 Planning** (S2, Mode_Guide §10 and the three planning Skills): "In the mode
`customer-tenants` a plan says, for each thing it adds, whether it is per customer (rows, people,
role assignments, settings, files, scope nodes and scope types) or shared through the Blueprint
(collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks, custom
services, module access keys), and plans each shared change as a Release."

## People (Requirement 6)

Mode_Guide §8, S2, with `add-users` and `create-rbac`:
- ES-7's "a role in the project's tenant" reads, in this mode, "a role in the customer's tenant"
  (6.1). A customer's administrator, signed in to that customer, adds a person with
  `POST /api/users` and gives a role with `POST /api/users/:id/roles`, or in the application's
  people screens.
- A person who already has an account anywhere on the Engine is attached, not duplicated: their
  password is unchanged, and the new profile is not entered until they switch to the customer,
  which the application's chooser does on their next sign-in (TS-4) (6.2). Until then they see it
  as an invitation (`accepted: false`), which they may decline.
- Each customer's user list holds the Platform's own accounts: the account the Platform's server
  uses, `admin@example.com`, named "BuildPad (platform access)" (Platform criterion 3.8), and, once
  members open the Studio in a customer, members' own accounts, whose `provider` is `platform`
  (Platform Decision 17 (a)). An application tells them apart by those two marks, shows them as the
  Platform's, and does not offer to remove or suspend them (6.3; Issue 17).
- The application's people screens (`add-users`, `create-rbac`) act in the current customer only:
  they call the Engine with the session, which is bound to it, and never name another tenant (6.4).

## Workers and tests (Requirement 7.2, 7.3)

S1. `worker-messaging`: TS-N4 directly after ES-14n (7.2). `create-tests` and the `test-engineer`
persona: "In the mode `customer-tenants` tests sign in to the Blueprint, as ES-12 says. A test of a
customer's path needs a customer made for testing on the Platform's Customers page; the pipeline
holds that customer's test administrator's email and password as secrets, beside the test
administrator's. A test never creates, suspends or deletes a customer." (7.3)

## Debugging and review (Requirement 8)

S2. **8.1**, added to `debugging-and-error-recovery`'s tree (the fence in its Engine passage at lines
180–196) and Mode_Guide §11, each row as "symptom → cause → fix":
- 403 FORBIDDEN "This token is not bound to a tenant" → an unbound session that was never switched → switch (`settleTenant`) before any data call;
- signs in but shows nothing → the profile is not yet entered, or the session is bound to the Blueprint → switch to the customer; the chooser does it;
- 401 TENANT_SUSPENDED → a Platform member suspended the customer → nothing in the app; the member resumes it;
- 503 SERVICE_UNAVAILABLE during a Rollout or an Engine upgrade → the customer is being updated → retry after a few seconds;
- a field in the Blueprint and not in a customer → S2: made after the customer was created, and Releases are not available yet; S3: not yet released, or the customer was skipped (Drift, a Conflict or a destructive change) → ask the Platform member which Release the customer is at (the Customers page shows it).

**8.2**, added to `security-and-hardening` (§Always Do, engine@60-62; §Red Flags, engine@263-265),
`references/security-checklist.md` (§DaaS-Specific Security, engine@185-192), `agents/security-auditor.md`
(§5. DaaS-Specific, engine@77-85) and `agents/test-engineer.md` (§DaaS-Specific Testing,
engine@99-103), and Mode_Guide §12: in the mode `customer-tenants`, no tenant id is taken from user
input except the one the switch route receives, and the Engine checks it; no host credential or host
session is present anywhere; no request reaches two customers with one token, and no server code
holds two customers' sessions at once; no cache in the application (server or browser) is keyed
without the current customer, and a switch reloads the page.

## Skill map confirmed

The requirements' Skill map, confirmed folder by folder against `3cb4a00`:
- **Dropped: `add-mobile-app`.** Listed because "the Platform's mobile environment carries the
  tenant id"; no file of the folder names a tenant, an environment variable or a sign-in. The
  native shell loads the deployed web application (server-URL mode), which carries the mode. It
  stays unchanged.
- **Added: `create-cron` and `create-service`.** They create cron jobs and custom services through
  the Engine's API and MCP tools, which TS-C names; `add-cron` (listed) is only the cron screen.
  Each gets TS-A (S1) and TS-C (S2, S3). Not added: `add-workflows` (a screen; `create-workflow`
  builds the workflow) and `relational-permissions` (its rules are built through `create-rbac`).
- **Plan changes** (Requirement 9.2 puts every Tenancy_Statement in an Engine passage; a
  `wording only` folder may hold no marker, R4; a folder whose files hold a passage needs the Gate,
  R3). `skill-map.json` rows change to `dependence: "partial"`, `plan: "BP"`, `treatment: "both
  paths, chosen by backend; Engine passages for Customer_Tenants (customer-tenant-skills)"`:

  | Folder | Dependence before | Plan before |
  |---|---|---|
  | `add-multitenancy` | wording only | RW |
  | `create-form-builder` | wording only | RW |
  | `idea-refine` | wording only | RW |
  | `spec-driven-development` | wording only | RW |
  | `add-comments` | none | RW |
  | `add-users` | partial | RW |
  | `authentication-proxy` | partial | RW |
  | `buildpad-reference` | partial | RW |
  | `create-feature` | partial | RW |

  Plan counts become `BP: 33, EF: 3, US: 1, NY: 2, RW: 8, RW+G: 2, UC: 20` (69 rows). The same rows
  of the Skill map at the end of `.kiro/specs/backend-aware-skills/requirements.md` are amended in
  the same pull request, with a dated note (CONTRIBUTING "Add a skill" keeps the two equal).

## Per-folder plan

Notation: I-A(n), I-G, I-P(a–b), I-F as in T7. "Gate" means the backend Gate added where S4 of
`backend-aware-skills` places it (first content after front matter, or directly after a first `# `
heading). Every new passage is an `engine` passage that replaces nothing. Line numbers are
`3cb4a00`'s.

### Mode_Guide and chooser

| Folder | File | S1 (now) | S2 (TD-1) | S3 (TD-3) |
|---|---|---|---|---|
| `add-multitenancy` | `SKILL.md` | Gate after line 7; I-A(9–15): the chooser passage (above), with TS-A, the Tenancy check, TS-N0, TS-N1 | TS-N0 removed (retired) | none |
| | `references/multitenancy.instructions.md` | Gate; I-A(11): TS-A and "To choose between scopes, Customer_Tenants and a project per customer, see the skill's `SKILL.md`." | none | none |
| | `references/engine-customer-tenants.instructions.md` (new) | File marker, Gate, title, Tenancy check; §1 (TS-N0), §2, §3, §4 (TS-N1 to TS-N7), §9 (TS-N4, tests) | §1 restated; TS-B; §5, §6, §7.1 to §7.3 (TS-Cn), §8, §10, §11, §12 | §1 restated; TS-Cm replaces TS-Cn; §7.4, §7.5; §11's last row restated |
| `manage-scope` | `SKILL.md` | I-A(797) in §"Using `mcp_daas_items` with Scope" (engine@794-1433): TS-A, TS-N0; I-A(1092) in §Steps: TS-A | At 797: "In the mode `customer-tenants`, scopes live inside each customer:" and the §6 bullets, linking `../add-multitenancy/SKILL.md` | none |
| | `references/engine-scope-management.instructions.md` | I-F after the ES-9 paragraph (line 41): TS-A | After TS-A: the URI rule (4.1) and no root type or first-level node (4.3) | none |
| | `references/scope-client.instructions.md` | none | I-P(56-69) §How Scope Context Is Sent: the root is the current customer's `uri_path`, never a configured id | none |

### Sign-in and session

| Folder | File | S1 | S2 | S3 |
|---|---|---|---|---|
| `authentication-proxy` | `SKILL.md` | Gate; I-A(18) §CRITICAL RULE: TS-A; I-A(32) §Auth Routes: TS-A | After the TS-A at 32: TS-B; "In the mode `customer-tenants` the auth routes are the four of the guide: sign-in without the header, tenants, switch, decline" (link `../add-multitenancy/SKILL.md`) | none |
| | `references/authentication-proxy.instructions.md` | Gate; I-A(57) §Auth Routes: TS-A; I-A(310–318) §Environment Variables: TS-A | At 57: TS-B and the route table of the guide's §5; at 310: `NEXT_PUBLIC_BUILDPAD_TENANT_ID` is the Blueprint's (3.7), TS-N2 | none |
| `create-api-route` | `SKILL.md` | I-G: TS-A | none | none |
| | `references/engine-api-routes.instructions.md` | I-F after line 127 (§Sign-in Routes): TS-A, TS-N2 | After the Login route (before "### Logout and current user"): "### In the mode `customer-tenants`", TS-B, the login route without the header, `lib/auth/tenants.ts`, the three routes, the TD-6 sentence; in the forwarder section (lines 60–120): the answers table (3.6) | none |
| `create-project` | `SKILL.md` | I-A(401–413) §Critical Rules: TS-A; I-A(427–434) §Required Environment Variables: TS-A | At 401–413: TS-B; at 427–434: 3.7 | none |
| | `references/environment.instructions.md` | I-A(101): TS-A; I-A(109–116): TS-A | At 101: TS-B; at 109–116: 3.7 | none |
| `add-buildpad` | `SKILL.md` | I-G: TS-A | I-P(73-89) §CRITICAL (after ES-16): TS-B and "In the mode `customer-tenants` the CLI's generated sign-in route sends `X-Tenant-Id` and has no switch: replace it as the `authentication-proxy` skill says" | none |
| | `references/buildpad.instructions.md` | none | I-P(824-932) §DaaSProvider: after a switch the page reloads, so `DaaSProvider` and every cache start in the new customer (8.2) | none |
| `buildpad-reference` | `SKILL.md` | Gate; I-G: TS-A | Next to TS-A: TS-B and the reload rule (8.2) | none |
| `add-microapp` | `SKILL.md` | I-A(345) §Implementation Steps (engine@331-409): TS-A; I-A(1057) §Deployment Automation (engine@1022-1060): TS-A | At 345: TS-B and "every app of the workspace reads the current customer from the session; only the main app offers the switch, and the switch reloads the page"; at 1057: 3.7 | none |
| | `references/app-urls-config.instructions.md` | I-A(248): TS-A | none | none |
| | `references/deployment-topology.instructions.md` | I-A(274): TS-A | none | none |
| `add-mcp-server` | `SKILL.md` | I-G: TS-A | I-P(339-349) §The endpoints: TS-B and "In the mode `customer-tenants` the consent step signs in without `X-Tenant-Id`; when the session is unbound it asks the person to choose a customer and switches before it stores the session, so one connection acts in one customer" | none |

### Structure

| Folder | File | S1 | S2 | S3 |
|---|---|---|---|---|
| `create-collection` | `SKILL.md` | I-A(162) §Standard Field Groups (engine@155-166): TS-A; I-A(403) §Scope (engine@400-442): TS-A | I-P(43-45) intro: TS-Cn; at 403: the URI rule (4.1) | TS-Cm replaces TS-Cn; "To remove or rename a field, use expand, release, contract (the `add-multitenancy` skill)" |
| | `references/standard-fields.instructions.md` | I-A(392): TS-A | At 392: the URI rule (4.1) | none |
| `create-rbac` | `SKILL.md` | I-G: TS-A | I-P(61-71) §Step 1: TS-Cn and 7.2 (roles by id, 5.5); I-P(117-149) §Scope-Restricted Roles: the `scope_config` pattern rule; I-P(207-223) §Scoped Role Assignments: people screens act in the current customer (6.4) | TS-Cm replaces TS-Cn |
| `create-workflow` | `SKILL.md` | I-G: TS-A | I-P(69-84): TS-Cn | TS-Cm |
| `add-cron` | `SKILL.md` | I-G: TS-A | I-P(52-54): TS-Cn and 7.3's S2 text (5.4) | TS-Cm; 7.3's S3 text |
| `create-cron` (added) | `SKILL.md` | I-G: TS-A | Next to TS-A: TS-Cn and 7.3's S2 text | TS-Cm; 7.3's S3 text |
| `hooks-extensions` | `SKILL.md` | I-G: TS-A | I-P(259-484) §References, first paragraph: TS-Cn | TS-Cm |
| `create-service` (added) | `SKILL.md` | I-G: TS-A | Next to TS-A: TS-Cn | TS-Cm |
| `add-i18n` | `SKILL.md` | I-A(203–209) §Step 7: TS-A | I-P(73-75) §Prerequisites: TS-Cn and "the `languages` rows are data: no creation copies them and no Release carries them; each customer's administrator, or the application's first-run setup with that administrator's session, adds them" | TS-Cm |
| | `references/content-translations.instructions.md` | I-A(834): TS-A | At 834: the URI rule (4.1) | none |
| `add-comments` | `SKILL.md` | Gate; I-G: TS-A | New passage at the end of §3. Permissions and hooks: TS-Cn | TS-Cm |
| `add-files` | `SKILL.md` | I-G: TS-A | I-P(62-68) §Prerequisites: TS-Cn; "folders are rows, per customer" | TS-Cm |
| `create-form-builder` | `SKILL.md` | Gate; I-G: TS-A | Next to TS-A: TS-Cn; "a form definition is a row: a form every customer needs is created in each customer" | TS-Cm |
| | `references/form-builder.instructions.md` | Gate; I-A(95–97) §Multi-Tenancy / Scopes: TS-A | At 95–97: the URI rule (4.1) | none |
| `grant-module-access` | `SKILL.md` | I-G: TS-A | I-P(97-138) §Create leaf key(s): TS-Cn (module access keys are released with the structure) | TS-Cm |
| `daas-platform` | `SKILL.md` | I-A(92–105) §Environment Variables (engine@69-108): TS-A | I-P(377-397) §Backend-First Rule: TS-Cn; at 92–105: 3.7 | TS-Cm |
| | `references/builtin-features.instructions.md` | I-A(341): TS-A | At 341: the URI rule (4.1) | none |
| | `references/daas-api.instructions.md` | I-A(151–155) §Authentication: TS-A | At 151–155: TS-B | none |
| | `references/daas-mcp-tools.instructions.md` | I-A(1799) §Tool: `scope`: TS-A | I-P(220-335) §System Tools: "the project's MCP token is bound to the Blueprint: no tool reaches a customer" | none |

### People, planning, workers and tests, debugging and review

| Folder | File | S1 | S2 | S3 |
|---|---|---|---|---|
| `add-users` | `SKILL.md` | Gate; I-A(142) §The Data Layer: TS-A, TS-N1 | Next to TS-A: the §8 bullets (6.1 to 6.4) | none |
| `spec-driven-development` | `SKILL.md` | Gate; I-A(47–54) §DaaS-Specific Considerations: TS-A | Next to TS-A: 5.6 | "plans each shared change as a Release" already in 5.6; none |
| `create-feature` | `SKILL.md` | Gate; I-A(39–45) §Planning Process: TS-A; I-A(110) §Scope-Aware Context Pattern: TS-A | At 39–45: 5.6; at 110: the `ScopeProvider` root is the current customer's `uri_path` (4.1) | none |
| `idea-refine` | `SKILL.md` | Gate; I-A(75–84, the table) §DaaS Platform Check: TS-A and "Customers with their own data, people and administrators: the `add-multitenancy` skill chooses between scopes, Customer_Tenants and a project per customer." | Next to TS-A: 5.6 | none |
| `worker-messaging` | `SKILL.md` | I-G: TS-A; I-P(213-218), after ES-14n: TS-N4 (7.2) | none | none |
| `create-tests` | `SKILL.md` | I-A(159) §Authentication Setup (engine@154-208): TS-A and the 7.3 text | At 180 (signing in from a script): TS-B, and "a script that signs in as a customer's person sends no `X-Tenant-Id` and switches" | none |
| `agents` | `test-engineer.md` | I-A(92–103) §DaaS-Specific Testing: TS-A and the 7.3 text | 8.2 checks | none |
| | `security-auditor.md` | I-P(77-85) §5. DaaS-Specific: TS-A | 8.2 checks | none |
| `debugging-and-error-recovery` | `SKILL.md` | I-G: TS-A | 8.1 rows in the fence at 180–196 | The last row's S3 cause |
| `security-and-hardening` | `SKILL.md` | I-A(154–166) §DaaS-Specific Security (engine@141-171): TS-A | 8.2 in I-P(60-62) and I-P(263-265) | none |
| `references` | `security-checklist.md` | I-A(55–62) §Authentication (engine@52-62): TS-A | 8.2 in I-P(185-192) | none |

### Not available only

| Folder | File | S1 | S2 | S3 |
|---|---|---|---|---|
| `add-external-oauth` | `SKILL.md` | In §On an Engine project: XAppHub sign-in only (engine@40-231), directly after its first paragraph (line 48), before Step 1: TS-A, TS-N3. One TS-A serves the anchor at 77, which is in the same section | none | none |
| `migrate-to-engine` | `SKILL.md` | I-P(55-257), directly after the paragraph at lines 56–63: TS-A, TS-N7; I-A(176) §Part B: TS-A | none | none |
| | `references/app-code.instructions.md` | I-F: I-A(47–53) §1. Environment: TS-A; I-A(103–106) §2. Sign-in: TS-A | none | none |

**Unchanged:** every other folder, `agents/code-reviewer.md`, the other files of `references/`, and
every Supabase passage.

## Repository_Check: rule R15 (Requirement 9.2)

### Rule

| Code | Fails, named with file and line |
|---|---|
| `ts-altered` | A paragraph (outside fenced code; a blockquote's `>` and line breaks removed, runs of white space made one space) that contains the reserved opening and is not exactly the text of a statement in `tenancy-statements.json` |
| `ts-outside-engine` | The reserved opening, or a Tenancy check sentinel, in the Supabase view of a file (that is, outside an `engine` passage, a file marked `engine`, or an `engine-only` folder) |
| `ts-a-missing` | A section (T7) whose Engine view holds an anchor and does not hold TS-A |
| `ts-held-back` | A copy of a statement one of whose `requires` is not in `met` |
| `ts-retired` | A copy of a statement one of whose `until` is in `met` |
| `ts-required-missing` | A live statement absent from a file its `in` list names |
| `tenancy-check-altered` | A copy of the Tenancy check that is not byte-identical to `tenancy-check.md` (line endings normalised) |
| `tenancy-check-missing` | One of the two files of `tenancyCheck.in` without a copy |
| `tenancy-check-misplaced` | A copy in any other file |

Applies to every Markdown file of the checked set (skills, `agents/`, `references/`), converted or
not; `CONTRIBUTING.md`, `.kiro/` and `tools/` are outside the checked set. It is run by default and
by `--only R15`; the `baseline` CI job does not run it. ES-1 to ES-16 stay unchecked against their
register (Issue 1).

### Data Models

`tools/repo-check/tenancy-statements.json` (written whole at S1; each stage edits `met`, and the
texts if a statement retires):

```json
{
  "register": "CONTRIBUTING.md, section Tenancy statements",
  "opening": "On an Engine project with Customer_Tenants",
  "dependencies": {
    "TD-1": "Platform project-tenants Wave 1 shipped: the flag, the Customers page, creating customers",
    "TD-3": "Engine entry 192 applied, and the Platform's Releases (project-tenants Requirement 9) shipped",
    "TD-7": "Customers that sign themselves up (Platform Decision 20 (b), a later spec)",
    "TD-8": "A host name mapped to a customer (Platform Decision 11 (b), Wave 2)",
    "TD-9": "XAppHub sign-in in a customer (Platform Decision 21 (b), Wave 2)",
    "TD-10": "Workers per customer (Platform Decision 13, Wave 3)",
    "TD-12": "Backup and restore of one customer (Platform Decision 14, Wave 3)",
    "TD-13": "Open Studio into a customer (Platform Requirement 10, Wave 2)"
  },
  "met": [],
  "anchors": [
    {"es": "ES-3", "text": "NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>"},
    {"es": "ES-4", "text": "The requests that take their tenant from the header"},
    {"es": "ES-5", "text": "An account that holds no role in the project's tenant"},
    {"es": "ES-7", "text": "gives the user a role in the project's tenant"},
    {"es": "ES-9", "text": "the project is one tenant"}
  ],
  "tenancyCheck": {
    "file": "tools/repo-check/tenancy-check.md",
    "in": ["add-multitenancy/SKILL.md", "add-multitenancy/references/engine-customer-tenants.instructions.md"]
  },
  "statements": [
    {"id": "TS-A", "requires": [], "until": [], "text": "<T4>", "in": ["<every changed SKILL.md>", "agents/test-engineer.md", "agents/security-auditor.md", "references/security-checklist.md", "add-multitenancy/references/engine-customer-tenants.instructions.md"]},
    {"id": "TS-B", "requires": ["TD-1"], "until": [], "text": "<T4>", "in": ["authentication-proxy/SKILL.md", "authentication-proxy/references/authentication-proxy.instructions.md", "create-api-route/references/engine-api-routes.instructions.md", "create-project/SKILL.md", "create-project/references/environment.instructions.md", "add-buildpad/SKILL.md", "buildpad-reference/SKILL.md", "add-microapp/SKILL.md", "add-mcp-server/SKILL.md", "daas-platform/references/daas-api.instructions.md", "create-tests/SKILL.md", "add-multitenancy/references/engine-customer-tenants.instructions.md"]},
    {"id": "TS-Cn", "requires": ["TD-1"], "until": ["TD-3"], "text": "<T4>", "in": ["<the 13 structure SKILL.md files>", "add-multitenancy/references/engine-customer-tenants.instructions.md"]},
    {"id": "TS-Cm", "requires": ["TD-3"], "until": [], "text": "<T4>", "in": ["<as TS-Cn>"]},
    {"id": "TS-N0", "requires": [], "until": ["TD-1"], "text": "<T4>", "in": ["add-multitenancy/SKILL.md", "manage-scope/SKILL.md", "add-multitenancy/references/engine-customer-tenants.instructions.md"]},
    {"id": "TS-N1", "requires": [], "until": ["TD-7"], "text": "<T4>", "in": ["add-multitenancy/SKILL.md", "add-users/SKILL.md", "<guide>"]},
    {"id": "TS-N2", "requires": [], "until": ["TD-8"], "text": "<T4>", "in": ["create-api-route/references/engine-api-routes.instructions.md", "<guide>"]},
    {"id": "TS-N3", "requires": [], "until": ["TD-9"], "text": "<T4>", "in": ["add-external-oauth/SKILL.md", "<guide>"]},
    {"id": "TS-N4", "requires": [], "until": ["TD-10"], "text": "<T4>", "in": ["worker-messaging/SKILL.md", "<guide>"]},
    {"id": "TS-N5", "requires": [], "until": ["TD-12"], "text": "<T4>", "in": ["<guide>"]},
    {"id": "TS-N6", "requires": [], "until": ["TD-13"], "text": "<T4>", "in": ["<guide>"]},
    {"id": "TS-N7", "requires": [], "until": [], "text": "<T4>", "in": ["migrate-to-engine/SKILL.md", "<guide>"]}
  ]
}
```

(`<T4>` stands for the statement's text in T4; `<guide>` for the Mode_Guide's path; the file holds
every path written out. The 13 structure files are the `SKILL.md` of `create-collection`,
`create-rbac`, `create-workflow`, `add-cron`, `create-cron`, `hooks-extensions`, `create-service`,
`add-i18n`, `add-comments`, `add-files`, `create-form-builder`, `grant-module-access` and
`daas-platform`.)

### Components

| Component | File | Interface |
|---|---|---|
| Tenancy | `tools/repo-check/lib/tenancy.mjs` (new, pure apart from reading its two data files once) | `TENANCY` (the parsed JSON), `TENANCY_CHECK_TEXT`; `paragraphs(text) → {line, text}[]` (fences skipped, blockquote markers removed, white space collapsed); `sections(text) → {line, endLine}[]`; `tenancyFindings(files) → finding[]`, where `files` is `[{path, text, views: {engine, supabase}}]` from the views `check.mjs` already computes |
| CLI | `tools/repo-check/check.mjs` | `RULES` gains `R15`; `if (want('R15')) add(tenancyFindings(textFiles))`; the usage line unchanged |

Line numbers in findings are the raw file's (through the existing `rawLineOf`).

## Companion contract assumed

Every route, field, file member, state and error code the skills text will name, with what it is
assumed to be and where that comes from. Rows P- and E- cite the companions' requirements as read
(Platform `f155ebce`, Engine `ad76ce05`); rows X- are verified in the Engine's code at `9bf9d457`.
A companion design that differs from a row is a Revalidation Trigger.

**Platform `project-tenants`**

| Id | Named in the skills | Assumed | Source | Used in |
|---|---|---|---|---|
| P-1 | `.buildpad/project.json` member `tenancy`, values `"scope"` and `"customer-tenants"` | Written by the kit assembler beside `backend` in every Engine Kit; `"scope"` when the flag is off; absent from Supabase Kits. The Platform never writes `.buildpad/tenancy-answer.json` | Decision 19 (b); criterion 11.1 | T1, T2 |
| P-2 | "download the kit again or set `tenancy`" | A Kit is not rewritten when the flag changes; the member downloads it again or sets the member | Decision 19, rationale | T2 step 1 |
| P-3 | Customer_Tenants "turned on for the project on the Buildpad platform" | A project feature flag `customer_tenants`, set only by a host user with `manage_feature_flags`; Engine projects only; cannot be turned off while customers exist (409) | Decision 9 (a); criteria 1.1 to 1.4 | Chooser, T2 step 3 |
| P-4 | "the project's Customers page" | Offered only with the flag on; lists customers (name, slug, state, Release, creation) and shows the Blueprint apart | Decision 1 (a); criteria 1.1, 2.1, 2.4 | Chooser, TS-N1, TS-Cm, §7.4, §11 |
| P-5 | "a Platform member creates each customer" | A member holding the project action `manage_project_tenants` (lowest role project Admin) creates, suspends, resumes and deletes customers | Decision 8 (c); criteria 3.1, 4.1, 4.2, 5.1 | Chooser, TS-N1, §7.4 |
| P-6 | A customer's first administrator; an existing address "accepts at the next sign-in" | `admin@example.com` is the tenant's first administrator; the Customer_Administrator is added as a second Administrator with a random password shown once, or a reset mail; an address with an Engine identity sees an invitation | Decisions 6 (b), 7 (c); criteria 3.2 to 3.4, 3.7 | §8, TS-4 chooser |
| P-7 | "BuildPad (platform access)", `admin@example.com` | The Project_Administrator's profile in every customer is named so, and no other Platform account is made at creation | Criterion 3.8 | §8 (6.3) |
| P-8 | `provider` `platform` | A member's Person_Account in a customer carries `provider = 'platform'` and `external_identifier`; made only on Open Studio into the customer (Wave 2) | Decisions 16 (b), 17 (a); criterion 3.9 | §8 (6.3) |
| P-9 | What happens when a customer's administrator removes a Platform account | Not settled ("for design"); the skills tell apps not to offer it | Decision 17, last sentence | §8; Issue 17 |
| P-10 | The Blueprint is the project's tenant | `NEXT_PUBLIC_BUILDPAD_TENANT_ID` stays its id in every Kit | Decision 4 (a); criterion 11.2 | TS-A, 3.7, TS-N2 |
| P-11 | Publishing a Release; dry run; canaries; roll out; destructive confirm by typing the Blueprint's path; pause, resume, cancel | As listed; the member chooses canaries and "options" | Decision 12 (a); criteria 9.1 to 9.5 | TS-Cm, §7.4, §7.5 |
| P-12 | Rollout options "start cron jobs as in the Blueprint" (`cron_status: "as_template"`) and "override Drift" (`overwrite_drift`) | Offered among the options of criterion 9.3, which does not name them | Criterion 9.3; Engine E-2 | §7.3, §7.5; Issue 8 |
| P-13 | No host credential in any app, Kit, worker, MCP tool or agent | As stated | Criterion 6.3 | §3, TS-N1 |
| P-14 | The worker and the MCP token stay in the Blueprint | As stated; per-customer workers are Wave 3 | Decision 13 (a) | §2, TS-N4 |
| P-15 | Backups restore every customer | Project backups stay whole; per-customer restore is Wave 3 | Decision 14 (a) | Chooser, TS-N5 |
| P-16 | When a separate project fits | Own region, Engine version, backups and restores, SSO issuer, dedicated capacity, more customers than the quota (`max_tenants_per_project`, default 25) | Decision 15 (b), 9 (a); criteria 7.1, 7.3 | Chooser (2.1) |
| P-17 | Not available: self sign-up, XAppHub in a customer, public page per customer, Open Studio into a customer | Decisions 20 (a), 21 (a), 11 (c), Requirement 10 (Wave 2) | As cited | TS-N1, TS-N3, TS-N2, TS-N6 |
| P-18 | `get_project_detail` | Reports tenancy and customers; **the skills never call it** for the mode (it returns credentials) | Criterion 11.3 | T1 (not used) |

**Engine entry 192 `tenant-schema-fan-out`**

| Id | Named in the skills | Assumed | Source | Used in |
|---|---|---|---|---|
| E-1 | "Release" | A numbered, immutable Template_Revision of the Blueprint, published by the host administrator only (so by the Platform) | Decisions 3 (b), 12 (a); criteria 1.1, 2.9 | TS-Cm, §7.4 |
| E-2 | `cron_status: "as_template"`, `overwrite_drift`, `allow_destructive` | Rollout parameters, beside `dry_run`, `canary`, `concurrency`, `max_failures`, `confirm` | Criterion 2.1 | §7.3, §7.5 (named as the Platform's options) |
| E-3 | What a Release carries | Decision 2 (c): structure (with indexes and unique constraints), the access model, workflows and bindings, extensions, custom services, cron jobs | Decision 2 (c); criteria 2.6, 3.14 | §7.4 |
| E-4 | What a Release never carries | Rows, people, role assignments, grants naming a person or a scope node, the settings record, scope nodes, scope types | Criterion 1.6 | §6 (4.2), §7.1, §7.4 |
| E-5 | Outcomes `skipped_drift`, `skipped_conflict`, `skipped_destructive`, `skipped_not_serving`, `failed`, `applied`, `unchanged` | As listed | Criterion 2.7 | §11 (named in words) |
| E-6 | Drift and Conflict skip a customer unless overridden; what a customer made itself is never touched | As stated | Decision 4 (b); criteria 3.5, 3.6, 3.8 | §7.4, §7.5 (5.3) |
| E-7 | Destructive changes only when allowed and confirmed with the Blueprint's `uri_path`; a rename is a removal and an addition | As stated | Decisions 6 (b), 16 (a); criteria 2.4, 3.4 | §7.5 |
| E-8 | Roles and policies matched by id across customers | Configuration rows by `id`, collections, fields and relations by name | Decision 9 (a); criterion 3.2 | §7.2 (5.5) |
| E-9 | The four seeded roles never removed, renamed or moved | As stated | Decision 15 (c); criteria 1.9, 3.13 | §7.2 |
| E-10 | Cron jobs at creation and on a Rollout | Creation copies jobs inactive (entry 135 criterion 6.4, not amended); a Rollout keeps a held job's status and adds new ones inactive unless `cron_status: "as_template"` | Decision 14 (d); criterion 3.7 | §7.3 (5.4) |
| E-11 | A customer created after the first Release starts at the latest Release | Creation copies the latest revision's document, plus the Blueprint's own scope types as they are then | Decision 10 (b); criterion 6.1; entry 192 design | §7.4; Issue 6 |
| E-12 | Canary customers first; a failed canary pauses | As stated | Decision 8 (b); criteria 5.4, 5.5 | §7.3, §7.4 |
| E-13 | 503 during a Rollout | A customer being applied may answer 503 `SERVICE_UNAVAILABLE` (lock timeout 5 s, statement timeout 60 s) | Criterion 5.6; the binder's not-serving answer (X-6) | 3.6 table, §11 |
| E-14 | A role's `scope_config` in a Release | A Rollout rewrites a pattern naming the Blueprint's node and own scope types per customer, as a creation does; a type the customer lacks is a Conflict `scope_type_unmapped` | Entry 192 design (`RewriteScopeConfig`) | §6 last bullet; Issue 7 |

**Engine, already served** (verified at `9bf9d457`)

| Id | Named in the skills | Verified shape | Source |
|---|---|---|---|
| X-1 | `GET /api/auth/tenants` | `RequireAuth`, any binding including an unbound token. 200 `{"data": [{"id", "name", "uri_path" (string or null), "current" (bool), "kind" ("host" or "tenant"), "accepted" (bool), "state" ("ready", "suspended", "migrating" or "failed")}]}`. The host is listed first when the person has a place there; the others sorted by name; a tenant being deleted or deleted is not listed | `auth_routes.go:178`; `tenant_handler.go` `ListTenants`; `tenant_switch.go:44-160` |
| X-2 | `POST /api/auth/tenant` | Body `{"tenant": "<id>"}`. 200 `{"data": {"access_token", "refresh_token", "expires"}}`, `expires` the remaining lifetime in **milliseconds**. 403 `FORBIDDEN` (no place there, an unknown tenant, or an id that is not a UUID: one answer); 403 `TENANT_SUSPENDED`; 401 `USER_SUSPENDED` (account not active); 503 `SERVICE_UNAVAILABLE` (tenant not serving, or the session store). The switch enters a profile not yet entered | `auth_routes.go:179`; `tenant_handler.go` `SwitchTenant`; `tenant_switch.go:186-262`; `auth_service.go:225-245` |
| X-3 | `DELETE /api/auth/tenants/:id` | 204; 409 `CONFLICT` (already entered, or the tenant's records refer to the profile); 404 `NOT_FOUND` | `auth_routes.go:183`; `tenant_handler.go` `DeclineTenant` |
| X-4 | Sign-in with no `X-Tenant-Id` | Binds the host if the person holds a role there; else their one entered tenant; with two or more entered tenants, no tenant (unbound); else an entered host profile; else unbound. Only entered memberships count; suspended or retired tenants are skipped | `tenant_binding.go:30-133` |
| X-5 | 403 `FORBIDDEN` "This token is not bound to a tenant. Switch to a tenant first." | An unbound token on any route but the identity routes | `swagger.yaml` (e.g. line 11169) |
| X-6 | 401 `TENANT_SUSPENDED`, 401 `TOKEN_INVALID`, 503 `SERVICE_UNAVAILABLE` | Suspended; deleted or unknown; not serving (migrating, failed, behind the Engine's version). Messages "This tenant has been suspended by the platform operator." and "This tenant is being migrated or is unavailable. Please retry shortly." The identity routes stay served for a tenant that does not serve | `tenant_binder.go:197-275`; `constant_error.go:87-152` |
| X-7 | Seeded role ids | `00000000-0000-0000-0000-000000000001` Administrator, `…0002` User, `…0003` Project Developer, `…0004` Project Viewer | `20260909000006_seed_reference_data.up.sql:24-28`; `20261102100000_project_roles.up.sql:12-13` |
| X-8 | The Supabase client's password sign-in | `POST /auth/v1/token` reads `X-Tenant-Id` and binds through the same rules (X-4) | `gotrue_handler.go:47-73`; `auth_service.go:850` |
| X-9 | A switched session refreshes in its tenant (TD-11) | Met in code, untested by a route test | Requirements TD-11; `tenant_switch.go:223` |
| X-10 | `tnt` | The access token's tenant claim | `constant_auth.go:155` |
| X-11 | A refresh of an unbound session | Must not send the access token with the refresh | `swagger.yaml:11698` |
| X-12 | `POST /api/users` attaches an existing identity, not entered | As the requirements read it | Requirements, What the Engine already does (`identity_credentials.go:188-277`, not re-read) |

## Release plan

| Release | Contents | Version | Gate to tag |
|---|---|---|---|
| S1 | R15 and its data, the Tenancy check, the register, the chooser, the Mode_Guide §1 to §4 and §9, TS-A in 41 anchor sections and in the `SKILL.md` of 32 Skills (with `agents/` and `references/`), TS-N0 to TS-N7, 7.2, 7.3, the 9 `skill-map.json` rows | The next MINOR after `v9.0.0` (`v9.1.0` unless another release comes first) | Read-through (Testing Strategy); `check.mjs` passes, R13 included |
| S2 | `met: ["TD-1"]`; TS-B, TS-Cn; Requirements 3, 4, 6, 8, 5.1, 5.4 (first half), 5.5, 5.6; Mode_Guide §1 restated, §5 to §8, §10 to §12 | MINOR | TD-1 met (the Platform's `project-tenants` approved and Wave 1 on production) |
| S3 | `met` adds `"TD-3"`; TS-Cm replaces TS-Cn; 5.2, 5.3, 5.4 (second half); Mode_Guide §7.4, §7.5, §11 restated | MINOR | TD-3 met (entry 192 applied) and the Platform's Requirement 9 on production |
| Later | One per TD-6, TD-7, TD-8, TD-9, TD-10, TD-12, TD-13 | MINOR each | Its own spec |

- **Why MINOR (9.4).** Every new text is Engine-only (`ts-outside-engine` guarantees it for the
  statements; the per-folder plan places everything else in Engine passages), so R7 finds no
  Supabase-view change and no `supabase-view-changes/*.json` entry is written. No Skill is added,
  removed or renamed; the Gate stays at `v1`. The Gate is added to 12 existing files in 9 folders;
  R7 removes the Gate before it compares, and the CHANGELOG says so (Issue 3).
- **CHANGELOG** (9.4): one section per release, one bullet per changed folder, and a **Supabase
  projects** subsection: "Nothing a Supabase project's agent follows changes. The 'Establish the
  backend first' procedure is added at the top of 12 files of 9 skills, which now hold text for
  Engine projects."
- **Platform sync** (9.4; `backend-aware-skills` Requirement 6): the Platform vendors each tag with
  `pnpm sync:skills --ref <tag>`; its KitAssembler strips the new Engine passages and the Mode_Guide
  from Supabase Kits as it strips every Engine passage. Nothing else is asked of it beyond Decision
  19 (P-1), which S1 does not need.

## Requirements Traceability

| Id | Summary | Realised by | Stage | Checked by |
|---|---|---|---|---|
| 1.1 | Establish the mode before directing what differs, after the backend gate | T2 (two copies, Engine-only); TS-A in every changed `SKILL.md` and every anchor section (T7) | S1 | R15 `ts-a-missing`, `ts-required-missing`, `tenancy-check-*`, `ts-outside-engine` |
| 1.2 | Absent signal: `scope` unless the request names separate customers; then ask once | T2 steps 3, 4; T1 record | S1 | R15 (text fixed); read-through |
| 1.3 | No env file, no credential tool, no `GET /api/tenants` | T2 last paragraph; T1 | S1 | R15 (text fixed) |
| 1.4 | `scope` mode unchanged | T2 last paragraph; TS-A "in the mode `scope` they hold as written"; all new text additional | S1 | R15; read-through of the Engine view |
| 2.1 | Three separations and when each fits | Chooser table | S1 | Read-through |
| 2.2 | The limits of Customer_Tenants | Chooser paragraph | S1 | Read-through |
| 2.3 | Chosen but not on: turned on on the platform, stop | Chooser second bullet; TS-N0 while TD-1 is unmet | S1 | R15 `ts-required-missing` (TS-N0) |
| 2.4 | Never a host credential, host session, `/api/tenants`; never create a customer from code | Chooser "Never" paragraph; Mode_Guide §3; TS-N1 | S1 | R15 (TS-N1); read-through |
| 2.5 | `scope` mode keeps delegating to `manage-scope` | Chooser first bullet; the blockquote and line 16 unchanged | S1 | R7 (Supabase view), read-through |
| 3.1 | No `X-Tenant-Id` at sign-in; the guide replaces ES-4, ES-5 | TS-B; App code login route; TS-A | S2 | R15 |
| 3.2 | Unbound sign-in or refresh: list, act as TS-4 | `settleTenant`; layout rule | S2 | Read-through |
| 3.3 | Switch from the server route; replace both tokens; no old token after | Switch route, `setSession`, reload | S2 | R15 (TS-B); read-through |
| 3.4 | Current tenant from the session; no tenant id on a session request | Current-customer rule; TS-B | S2 | R15 |
| 3.5 | Show the name; offer a switch | Layout rule | S2 | Read-through |
| 3.6 | Causes for 401 `TENANT_SUSPENDED`, 401 `TOKEN_INVALID`, 503; retry the 503 only | Answers table | S2 | Read-through |
| 3.7 | `NEXT_PUBLIC_BUILDPAD_TENANT_ID` stays the Blueprint's; no per-customer public page until TD-8 | App code rule; TS-N2 | S1 (TS-N2), S2 | R15 |
| 3.8 | XAppHub not available until TD-9 | TS-N3 | S1 | R15 |
| 4.1 | Scope URIs begin with the current customer's `uri_path` | §6; per-folder URI rule | S2 | Read-through |
| 4.2 | Blueprint scope types and Releases | §6 (192 Decision 2 settled; Issue 6) | S2 | Read-through |
| 4.3 | Customer administrators make types and nodes beneath their tenant; no root type or first-level node | §6 | S2 | Read-through |
| 5.1 | Structure built in the Blueprint, in the eleven named Skills | TS-Cn, then TS-Cm, in their `SKILL.md` (plus `create-cron`, `create-service`) | S2, S3 | R15 `ts-required-missing` |
| 5.2 | Reaches customers only by Release; never a customer's schema routes | TS-Cn (no Release yet), TS-Cm; §7.4 | S2, S3 | R15 |
| 5.3 | Expand, release, contract; Drift | §7.5 | S3 | Read-through |
| 5.4 | Cron jobs inactive at creation; `cron_status: "as_template"` | §7.3 in `add-cron`, `create-cron` | S2, S3 | Read-through |
| 5.5 | Roles by identifier | §7.2 in `create-rbac` | S2 | Read-through |
| 5.6 | Plans say per customer or shared | 5.6 text in the three planning Skills | S2 | Read-through |
| 6.1 | ES-7 reads "in the customer's tenant"; `POST /api/users` in that tenant | §8; TS-A replaces ES-7 | S1 (TS-A), S2 | R15; read-through |
| 6.2 | Existing account attached; entered on switch | §8 | S2 | Read-through |
| 6.3 | The Platform's accounts and how to tell them apart | §8 (P-7, P-8) | S2 | Read-through |
| 6.4 | People screens act in the current tenant | `add-users`, `create-rbac` passages | S2 | Read-through |
| 7.1 | Not available, and stop: seven items | TS-N1 to TS-N7 (TS-N0 for the whole mode until TD-1) | S1 | R15 (`ts-required-missing`, `ts-retired`) |
| 7.2 | `worker-messaging`: Blueprint only; per-customer work as stored code | TS-N4 | S1 | R15 |
| 7.3 | `create-tests`: Blueprint sign-in; a customer for tests from the Customers page | 7.3 text in `create-tests` and `test-engineer` | S1 | Read-through |
| 8.1 | Debugging symptoms | §11; `debugging-and-error-recovery` rows | S2, S3 | Read-through |
| 8.2 | Review checks | §12; four files | S2 | Read-through |
| 9.1 | Register next to ES, each opening "On an Engine project with Customer_Tenants", each with When | T4, T6 | S1 | `docs.test.mjs`, `tenancy.test.mjs` |
| 9.2 | Copies verbatim; none outside an Engine passage | R15 `ts-altered`, `ts-outside-engine`; the 9 plan changes | S1 | R15 |
| 9.3 | ES-3, 4, 5, 7, 9 verbatim; TS-A next to each copy | T7; ES texts untouched | S1 | R15 `ts-a-missing`; `guard.test.mjs` keeps the ES texts |
| 9.4 | MINOR release, CHANGELOG per folder, Platform sync | Release plan | S1, S2, S3 | R10, R13; read-through |

## Testing Strategy

### Repository_Check tests (`node --test "tools/repo-check/test/*.test.mjs"`)

- **New `tenancy.test.mjs`**, on fixture texts (no `SKILL.md` committed under `tools/`):
  - `ts-altered`: a statement with one character changed; a paragraph holding the reserved opening
    and a sentence after the statement; a statement wrapped over lines and inside a blockquote
    (passes); a statement inside a fenced block (ignored).
  - `ts-outside-engine`: a statement in shared text, in a `supabase` passage, and in a file marked
    `supabase`; the same in an `engine` passage, a file marked `engine` and an `engine-only`
    folder (pass).
  - `ts-a-missing`: an anchor in an Engine passage without TS-A; an anchor in shared text with TS-A
    in an Engine passage of the same section (passes); TS-A in the next `## ` section (fails); two
    anchors in one section with one TS-A (passes); an adapted ES-4 copy (detected); an anchor in a
    `supabase` passage (ignored).
  - `ts-held-back`, `ts-retired`, `ts-required-missing`: with `met` empty, `["TD-1"]` and
    `["TD-1", "TD-3"]`; TS-Cn copied after TD-3; TS-N0 copied after TD-1.
  - `tenancy-check-altered`, `-missing`, `-misplaced`: one byte changed; a CRLF copy (passes); a
    third copy.
  - The data file: every statement opens with `opening`; ids unique; every `requires` and `until`
    names a key of `dependencies`; every `in` path exists in the repository; `tenancy-check.md`
    holds the two sentinels and no marker token.
- **`guard.test.mjs`**: `DESIGN_TEXTS` gains TS-A, TS-B, TS-Cn, TS-Cm, TS-N0 to TS-N7 and the
  Tenancy check; the count assertion keeps 18 `ES-` keys and adds 12 `TS-` keys; none matches a
  guard pattern, bare or fenced.
- **`docs.test.mjs`**: `CONTRIBUTING.md` holds `## Tenancy statements`, a row `| TS-… |` for every
  statement of the JSON whose text equals the JSON's, `tools/repo-check/tenancy-check.md`, and a
  row `| R15 |` in "What the check runs".
- **`map.test.mjs`**: the plan counts become `{ BP: 33, EF: 3, US: 1, NY: 2, RW: 8, 'RW+G': 2, UC: 20 }`.
- **`cli.test.mjs`**: `--only R15` accepted; `--only R16` exits 2; a fixture repository with one
  altered statement exits 1 with `R15 <path>:<line> ts-altered`.
- **On the repository itself:** `check.mjs` passes at each stage's release candidate.

### Manual read-through per stage (no agent is run)

As `CONTRIBUTING.md` "Convert a folder" step 4 and the `backend-aware-skills` read-through: render
the views, read `engine/<folder>` for every changed folder (each statement next to its anchor, each
not-available ends in stopping, no step names what the stage does not offer), confirm
`supabase-vs-baseline.diff` shows only Gate hunks for the 9 replanned folders, and record reader,
date and commit in the CHANGELOG section.

## Error Handling

| Situation | Behaviour |
|---|---|
| `tenancy-statements.json` or `tenancy-check.md` missing or not valid JSON | Exit 2 with the path, as for the other data files |
| A statement id in `in` naming a missing file | `tenancy.test.mjs` fails; R15 reports `ts-required-missing` on the path, line 1 |
| An agent finds both files naming different modes | T2 step 1: tell the developer, follow the signal |

## Security Considerations

- The Tenancy check reads two committed JSON files and forbids environment files, MCP
  configuration, credential tools and the host's tenant routes (1.3).
- The guidance never puts a host credential or host session in an application, a worker, a test or
  an agent's call (2.4, P-13), and makes the switch route the only place a tenant id comes from the
  user, checked by the Engine (8.2).
- A reload after every switch keeps one customer's data out of another's caches (8.2).

## Design choices

Each fixes what the requirements left to design; none reopens a settled decision.
1. The record file `.buildpad/tenancy-answer.json` with `buildpadTenancyAnswer: 1`, separate from the backend's (T1).
2. A canonical Tenancy check copied into two files and named by TS-A, instead of copying it into every folder like the Gate (T2): the mode matters only after the backend is known, and TS-A carries the two file names for a single-skill install.
3. Stages S1, S2, S3, driven by `met` in the data file (T3, T5).
4. TS-C split into TS-Cn and TS-Cm (T4), because Platform Wave 1 may ship before entry 192.
5. Not-available texts made Tenancy_Statements (TS-N0 to TS-N7), so R15 holds their wording and their retirement.
6. The reserved opening, so an altered copy cannot pass as other prose (R15 `ts-altered`).
7. TS-A per section, by anchors that also find adapted ES copies (T7).
8. Nine folders replanned `RW` to `BP` rather than letting statements stand in shared text (9.2).
9. `add-mobile-app` dropped; `create-cron` and `create-service` added ([Skill map confirmed](#skill-map-confirmed)).
10. App code calls the Engine's identity routes from the app's server routes, and a full reload follows a switch.
11. Scope types looked up by name per customer, roles named by id (§6, §7.2).

## Issues found

Each is resolved here without reopening a decision; those marked **(ask)** need a word from the
maintainer or a companion.

1. **Requirement 9.2's premise.** It says the Repository_Check checks copies "as it does for ES-1 to
   ES-16". It does not: no rule compares an ES copy with its register; `guard.test.mjs` only holds
   the design's texts against the guard patterns. Most ES-4 copies are adapted and ES-4, ES-10,
   ES-11 and ES-12 have no verbatim copy at `3cb4a00`. R15 checks the Tenancy_Statements as 9.2
   asks; checking ES copies would fail today's tree and is left out (Non-Goals). **(ask)** whether a
   later change should bring ES copies to verbatim.
2. **Statements in Engine passages versus `wording only` folders.** Nine folders of the Skill map hold
   no marker today, four of them may hold none (R4). Resolved by replanning them `BP` with the Gate
   (Skill map confirmed); the same rows of `backend-aware-skills`' Skill map are amended. **(ask)**
   that amending that approved spec's table is acceptable.
3. **MINOR and the Gate.** The CHANGELOG's rule makes any change to what a Supabase agent reads
   MAJOR; adding the Gate to 12 files changes what it reads, though R7 removes the Gate before
   comparing. The design follows 9.4 and R7 (MINOR) and names the Gate additions in the
   Supabase-projects subsection. **(ask)** if the maintainer counts it as MAJOR.
4. **`add-mobile-app`** names no tenant; dropped. **`create-cron`, `create-service`** build what
   TS-C names; added. Requirement 5.1's list is met and extended.
5. **Who turns the feature on.** Requirement 2.3 says "a Platform member"; the Platform's criterion
   1.2 lets only a host user with `manage_feature_flags`. The skills say "turned on for the project
   on the Buildpad platform" and name no role.
6. **Scope types after the first Release.** Entry 192 carries no scope type in a Release (1.6), and a
   creation after the first Release copies the Release (6.1), so it is unclear whether such a
   customer receives the Blueprint's scope types at all. **Resolved by the Engine design**: a
   creation copies the latest revision plus the Blueprint's own scope types as they are then. §6
   says so.
7. **`scope_config` patterns.** A creation rewrites a role's scope settings to the new tenant
   (`template/rewrite.go:161-183`); entry 192 does not say a Rollout does. **Resolved by the Engine
   design**: a Rollout rewrites them per tenant the same way, and an unmapped scope type is a
   Conflict `scope_type_unmapped`. §6 says so (E-14).
8. **Rollout options in the Platform.** Requirement 5.4 has the member roll out with
   `cron_status: "as_template"`; the Platform's criterion 9.3 says "options the member chose" and
   names neither it nor `overwrite_drift`. **Resolved by the Platform design**: its `RolloutDialog`
   offers "overwrite drift" and "Start cron jobs as they are in the Blueprint" (P-12).
9. **The switch's answers.** The requirements list 403 `FORBIDDEN`, 403 `TENANT_SUSPENDED` and 503;
   the code also answers 401 `USER_SUSPENDED` and a 503 from the session store, inside the
   `data` envelope, with `expires` in milliseconds. The guide follows the code (X-2).
10. **The host in the tenant list.** `GET /api/auth/tenants` lists the host (`kind: "host"`) to a
    person with a place there, and the sign-in binds a person with a host role to the host. TS-4's
    counts are taken over `kind: "tenant"` only, and a host-bound session is handled as unbound
    (2.4).
11. **TS-4 with one tenant that does not serve.** A switch into a suspended or migrating customer
    answers 403 `TENANT_SUSPENDED` or 503; the app shows the cause instead of switching.
12. **Two items of 7.1 without a dependency row**: named TD-12 and TD-13 here (T3).
13. **7.3 at S1.** It names the Customers page, which exists only at TD-1; it lands at S1 as TS-3 (b)
    says, harmlessly, since TS-N0 stops the mode until then.
14. **TD-6 has no spec.** The guide writes the routes by hand and says the CLI's login route and the
    SDK do not know the mode; a later release names the SDK's functions.
15. **Draft TS-A pointed only to `add-multitenancy`.** A single-skill install may lack it; final TS-A
    names the two files.
16. **ES-5 is false in this mode** ("refused at password sign-in": the person gets an unbound session
    instead). TS-A says the guide replaces ES-5 in this mode; ES-5 stays verbatim (9.3).
17. **Removing a Platform account in a customer** is left to the Platform's design (its Decision 17).
    The skills tell apps not to offer it (P-9). **(ask, Platform design)**.
18. **TD-11 is untested.** The switch-and-refresh path the guide relies on has no route test in the
    Engine; a regression would bind a refreshed session elsewhere. **(ask, Engine)** for a test; entry 192's design lists it among its open items.

## Supporting References

- `.kiro/specs/customer-tenant-skills/requirements.md` (approved 2026-11-07).
- `.kiro/specs/backend-aware-skills/design.md` (S1 to S9, the marking rules, R1 to R14);
  `CONTRIBUTING.md`; `tools/repo-check/` at `3cb4a00`.
- `buildpad-platform` `.kiro/specs/project-tenants/requirements.md` at `f155ebce`.
- `buildpad-daas-go` `.kiro/specs/tenant-schema-fan-out/requirements.md` at `ad76ce05`.
- `buildpad-daas-go` `origin/main` `9bf9d457`, the files named in the header.
