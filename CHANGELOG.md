# Changelog

Every release of the skills is a git tag, and every tag has a section here. The GitHub Release of
a tag carries the same section. Install a release with `npx skills add buildpad-ai/skills#<tag>`
(see the [README](README.md#install)).

Versions follow these rules:

- **MAJOR** when what a Supabase project's agent reads changes in any file, when a skill is removed
  or renamed, or when the version of the "Establish the backend first" procedure changes.
- **MINOR** when a skill is added, or when text for Engine projects only changes.
- **PATCH** for anything else, such as a typo.

From `v2.0.0` on, each section has a subsection **Supabase projects** that lists every change to
what a Supabase project's agent reads, with its reason.

## v2.0.0

The skills now serve **Engine projects** (backend: the Buildpad Engine) as well as **Supabase
projects**. Install it with `npx skills add buildpad-ai/skills#v2.0.0`.

- Each file whose steps differ by backend opens with the procedure "Establish the backend first"
  (version 1). The agent reads `.buildpad/project.json`, then `.buildpad/backend-answer.json`,
  then looks for a `supabase/` project folder, and otherwise asks the developer once. Then it
  follows only the parts for that backend.
- All 44 skills, personas and reference folders that mention the backend are converted. Where the
  Engine has no counterpart yet (external OAuth sign-in, database migrations, the micro-frontend
  skills), the skill says so and stops.
- New Engine-only reference files: `create-api-route/references/engine-api-routes.instructions.md`,
  `hooks-extensions/references/engine-hooks.instructions.md`,
  `hooks-extensions/references/engine-services-api.instructions.md`,
  `hooks-extensions/references/engine-utilities-api.instructions.md`,
  `manage-scope/references/engine-scope-management.instructions.md` and
  `manage-scope/references/engine-scope-permissions.instructions.md`.
- New repository check (`tools/repo-check/`, see [CONTRIBUTING](CONTRIBUTING.md)). It runs in CI
  on every pull request and on every tag push.
- `add-microfrontend` and `add-microfrontend-zones` now install with the skills CLI. Their
  front matter did not parse as YAML, so the CLI skipped them.

No skill is added, removed or renamed.

### Supabase projects

Supabase projects get the same steps as in `v1.0.0`, with two kinds of change. First, the
"Establish the backend first" procedure is added at the top of 75 files. On a Supabase project it
finds the backend and then follows the Supabase parts, which are the `v1.0.0` text. Second, the
changes below, each with its reason:

- `add-external-oauth/SKILL.md` (description): The description names the kind of project: it says the Skill is for Supabase projects only and stops on an Engine project, where OAuth sign-in is not available.
- `add-microfrontend-zones/SKILL.md` (description): The description now says the skill is for Supabase projects only for now and not yet available on an Engine project.
- `add-microfrontend-zones/SKILL.md` (text): The front-matter description and argument-hint are now quoted, so the front matter parses as YAML; the values are unchanged. At v1.0.0 the unquoted argument-hint did not parse, and the skills CLI skipped the skill on install.
- `add-microfrontend/SKILL.md` (description): The description now says the skill is for Supabase projects only for now and not yet available on an Engine project.
- `add-multitenancy/SKILL.md` (text): Engine-project sentences added: the project is one tenant with every scope below its tenant node (ES-9), and the scope column's foreign key to daas_scope_items(uri_path); the delegation to manage-scope is unchanged.
- `add-multitenancy/references/multitenancy.instructions.md` (text): The same Engine-project sentences added, and the listed manage-scope references named as a Supabase project's, since manage-scope's SKILL.md names the references for each kind of project.
- `add-users/SKILL.md` (text): Reworded so every statement is true for both kinds of project: the cross-origin setup is qualified as a Supabase-project step, and Engine-project sentences on static tokens, cross-origin and creating users with a role in the tenant are added; the Supabase steps are unchanged.
- `agents/security-auditor.md` (description): The description now names access rules in a way true for both kinds of project (RLS on a Supabase project) and says the persona serves either kind.
- `authentication-proxy/SKILL.md` (text): Reworded so every statement is true for both kinds of project: the OAuth routes and the external OAuth section are qualified as Supabase-project only, and the Engine-project address, sign-in, tenant, token and multi-factor sentences (ES-1, ES-2, ES-4, ES-5, ES-6) are added; the Supabase steps are unchanged.
- `authentication-proxy/references/authentication-proxy.instructions.md` (text): Reworded so every statement is true for both kinds of project: the diagram and the environment block are named as a Supabase project's, and the Engine-project address, cross-origin, sign-in and environment sentences (ES-1, ES-3, ES-5) are added with an Engine environment block; the Supabase steps are unchanged.
- `buildpad-reference/SKILL.md` (text): Sentences added so the file is true for both kinds of project: where an Engine project serves file content and how a browser shows a file there (ES-11), and that the Engine answers a delete with 204 and no body; the Supabase guidance is unchanged.
- `buildpad-reference/references/react-components.instructions.md` (text): The DaaSProvider examples take the address from NEXT_PUBLIC_BUILDPAD_DAAS_URL instead of a sample host, and the token rule is stated for both kinds of project (a static token on a Supabase project, a signed-in user's access token on an Engine project, ES-2).
- `buildpad-steering-custom/SKILL.md` (text): The skill carries the Gate and now records in custom steering the backend the Gate established, never inferred from dependency or variable names; the templates and rules are unchanged.
- `buildpad-steering/SKILL.md` (text): The skill carries the Gate, and bootstrap's tech analysis now records the backend the Gate established, never inferred from dependency or variable names; the templates and rules are unchanged.
- `context-engineering/SKILL.md` (text): Qualified so each line is true for both kinds of project: the architecture, the MCP server (the Engine's has no extensions tool) and the environment file name the Engine project's one address for data and sign-in; the Supabase guidance is unchanged.
- `create-api-route/SKILL.md` (description): The description names both kinds of project: on an Engine project the Skill writes routes that forward the signed-in user's session to the Engine, and on a Supabase project the Supabase auth routes it wrote before.
- `create-collection/SKILL.md` (description): The description says "with its schema" instead of "with database migration", so it is true for both kinds of project.
- `create-feature/SKILL.md` (text): Qualified sentences added so the planning guidance is true for both kinds of project: scopes sit below the project's tenant on an Engine project (ES-9), the server-side module-access check goes through /api/permissions/me there (ES-16), and a cron job's body and schedule there follow the Engine's runtime (ES-10, ES-13n); the Supabase guidance is unchanged.
- `create-feature/references/vform-usage.instructions.md` (text): Names where the collection schema is stored on each kind of project (the DaaS, or the Engine).
- `create-form-builder/SKILL.md` (text): Qualified so each statement is true for both kinds of project: the cross-origin setup is a Supabase-project step (an Engine project needs none, ES-15), create-migration is named for Supabase projects only, and the Engine's list cap of 1000 and 204 delete answer are stated; the Supabase steps are unchanged.
- `create-form-builder/references/form-builder.instructions.md` (text): Scope wording: per-scope overrides instead of per-tenant, and on an Engine project permission presets are not applied, so the scope comes from the create-time default.
- `create-migration/SKILL.md` (description): The description names the kind of project: it says the Skill is for Supabase projects only, and that on an Engine project it writes no file, stops, and names the skills that change structure and access there.
- `create-project/SKILL.md` (description): The description now says the skill initializes a Buildpad application on the Buildpad Engine or on Supabase, instead of naming Supabase only.
- `create-tests/SKILL.md` (description): The description now names RLS tests as a Supabase-project case, so it holds for Engine and Supabase projects alike.
- `daas-platform/SKILL.md` (description): The front-matter description now names both kinds of project (Engine projects and Supabase projects) instead of describing a Supabase integration only.
- `idea-refine/SKILL.md` (text): The stack is named as Next.js and the project's Buildpad backend (DaaS and Supabase, or the Buildpad Engine), and the cron and scope rows say how they differ on an Engine project.
- `incremental-implementation/SKILL.md` (text): The first data slice defines the collection through create-collection, which writes a migration on a Supabase project and calls the Engine on an Engine project, instead of naming a migration.
- `performance-optimization/SKILL.md` (text): Engine-project sentences added: a field is indexed through schema.add_index when it is created, deep is ignored, and limit is capped at 1000; the Supabase guidance is unchanged.
- `planning-and-task-breakdown/SKILL.md` (text): The data tasks define the collection through create-collection (a migration on a Supabase project, the Engine's API on an Engine project) instead of naming a migration file path, and the access criterion names RLS for Supabase projects and roles, policies and permissions for Engine projects.
- `relational-permissions/SKILL.md` (removed-link): The link to RELATIONAL_PERMISSIONS.md under References pointed outside this repository and resolved in no install, so it is removed.
- `review-code/SKILL.md` (text): Qualified so each check holds for both kinds of project: on an Engine project any service-role key reference and any Supabase client call other than sign-in are findings, and the proxy and backend-first checks name the Engine's counterparts; the Supabase checks are unchanged.
- `spec-driven-development/SKILL.md` (text): The scope item says that on an Engine project the hierarchy begins beneath the project's tenant node; the Supabase guidance is unchanged.
- `subagent-delegation/SKILL.md` (text): Qualified for both kinds of project: RLS is named as a Supabase project's access rule, OAuth review as a Supabase-project check (OAuth sign-in is not available on an Engine project), and strict ordering covers collection definitions as well as migrations.

Read through by Rudy on 17 October 2026, on the candidate commit `a8ce84d`.

## v1.0.0

The Baseline_Revision: the last revision of `main` before the skills learned to serve Engine
projects (commit `7ed910f`). It is the skills exactly as Supabase projects used them until then.
Stay on it with `npx skills add buildpad-ai/skills#v1.0.0`.
