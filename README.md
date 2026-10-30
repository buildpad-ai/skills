# Buildpad Agent Skills

Agent skills for building **Buildpad Apps** with AI coding agents. Each skill is a folder with a [`SKILL.md`](https://agentskills.io) following the open Agent Skills standard, so they work in Claude Code, GitHub Copilot, Kiro, Antigravity, and any other agent that supports the format.

This repository is the **source of truth** for the skills bundled in Buildpad project starters. Starters ship with the skills pre-installed; use the CLI below to update them or to add them to an existing project.

Every release is a git tag. What changed in each release, and why, is in [`CHANGELOG.md`](CHANGELOG.md) and on the [GitHub Releases](https://github.com/buildpad-ai/skills/releases) page.

## Two kinds of project

The skills serve two kinds of Buildpad project: **Engine projects**, whose backend is the Buildpad Engine, and **Supabase projects**, whose backend is a per-project Supabase. Most skills hold for both. A skill whose steps differ by backend carries a short procedure, **"Establish the backend first"**, at the top of each file that needs it. The agent follows it before anything else:

1. It reads `.buildpad/project.json`, which the Platform writes into every starter.
2. Otherwise it reads `.buildpad/backend-answer.json`, the answer recorded the last time it asked.
3. Otherwise it looks for a Supabase project folder (`supabase/config.toml`, or SQL files in `supabase/migrations/`).
4. Otherwise it asks the developer once, and records the answer in `.buildpad/backend-answer.json` (commit that file).

Then it follows only the parts for that backend. Where the Engine has no counterpart (for example database migrations, or external sign-in with a provider other than XAppHub), the skill says so and stops.

Starters downloaded from the Platform carry only their project's text: the other backend's parts are removed when the starter is assembled.

## Install

```bash
# Install skills from a release (interactive picker)
npx skills add buildpad-ai/skills#v6.2.0

# Install everything from a release
npx skills add buildpad-ai/skills#v6.2.0 --all

# Install a single skill from a release
npx skills add buildpad-ai/skills#v6.2.0@create-project
npx skills add https://github.com/buildpad-ai/skills/tree/v6.2.0/create-project
```

The [skills CLI](https://github.com/vercel-labs/skills) detects your agents and writes each skill to the right location (`.claude/skills/`, `.kiro/skills/`, `.agents/skills/`, …). A tag never moves, so installing `#v6.2.0` always gives the same files. Replace `v6.2.0` with any tag from the [releases](https://github.com/buildpad-ai/skills/releases).

## Stay on the skills as they were before Engine support

Supabase projects can keep the skills exactly as they were before Engine support was added. `v1.0.0` is that revision:

```bash
npx skills add buildpad-ai/skills#v1.0.0
npx skills add buildpad-ai/skills#v1.0.0 --all
```

The CLI's lock file records the tag, so `npx skills update` keeps you on `v1.0.0`.

## Update

```bash
npx skills check    # see what's outdated
npx skills update   # update installed skills
```

**In a project made from a Buildpad starter**, the starter ships no `skills-lock.json`, so `npx skills check` and `npx skills update` report nothing to update until you run `npx skills add` once (see [Install](#install)). After that, `check` and `update` work as usual.

- `npx skills add` replaces the starter's copy of each skill you choose with this repository's text. That text holds the parts for both backends, and the "Establish the backend first" procedure picks the right one.
- In a VS Code starter, the starter's skills are in `.github/skills/`; `npx skills add` writes a second copy under `.agents/skills/` beside them.
- The agent personas (`agents/`) and the checklists (`references/`) ship with starters; the CLI does not install them.

## Repository Layout

- **Skill folders (root)** — one folder per skill (`<name>/SKILL.md`), installable via the skills CLI.
- **`agents/`** — subagent personas (flat `.md` files with `name`/`description` frontmatter). Buildpad starters mirror them to `.kiro/agents/` (Kiro) and `.claude/agents/` (Claude Code), where they run as subagents in isolated context. The skills CLI does not install these — they ship with starters and starter agent-file downloads.
- **`references/`** — checklists that skills and personas link to (flat, no subfolders). They ship with starters.
- **`tools/repo-check/`** — the repository's own check, run in CI on every pull request. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to write a skill that holds for both kinds of project.

## Agents

| Agent | Role |
|---|---|
| [code-reviewer](agents/code-reviewer.md) | Five-axis code review (correctness, readability, architecture, security, performance) + DaaS/Buildpad compliance |
| [test-engineer](agents/test-engineer.md) | Test strategy, coverage-gap analysis, Playwright/Vitest authoring |
| [security-auditor](agents/security-auditor.md) | Auth, CORS, access rules (RLS on a Supabase project), input handling, and secret review, for both kinds of project |

## Catalog

### Spec-driven development

The core methodology: every feature is specified as `requirements.md` (EARS) → `design.md` → `tasks.md` in `.kiro/specs/<feature>/`, then implemented task by task. The artifact format is compatible with Kiro IDE's native specs — **Kiro users should use native specs instead of these skills**; all other agents (Claude Code, Copilot, Antigravity, Cursor, …) use them as slash commands. Adapted from [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) v3.0.2 (MIT), renamed under the `buildpad-` prefix.

| Skill | What it does |
|---|---|
| [spec-driven-development](spec-driven-development) | Methodology overview: when to spec, DaaS-specific spec rules, review gates |
| [buildpad-discovery](buildpad-discovery) | Entry point: decide whether work is one spec, many specs, or no spec |
| [buildpad-spec-init](buildpad-spec-init) | Initialize a new specification structure |
| [buildpad-spec-requirements](buildpad-spec-requirements) | Generate EARS-format requirements (review gate) |
| [buildpad-spec-design](buildpad-spec-design) | Generate technical design from requirements (review gate) |
| [buildpad-spec-tasks](buildpad-spec-tasks) | Generate implementation tasks with dependencies (review gate) |
| [buildpad-impl](buildpad-impl) | Implement approved tasks with TDD and per-task review |
| [buildpad-spec-quick](buildpad-spec-quick) | Fast path for a single small spec |
| [buildpad-spec-batch](buildpad-spec-batch) | Create specs for a whole roadmap in parallel |
| [buildpad-spec-status](buildpad-spec-status) | Show spec status and progress |
| [buildpad-steering](buildpad-steering) | Maintain `.kiro/steering/` as persistent project memory |
| [buildpad-steering-custom](buildpad-steering-custom) | Create domain-specific steering documents |
| [buildpad-validate-design](buildpad-validate-design) | Design quality review before implementation |
| [buildpad-validate-gap](buildpad-validate-gap) | Gap analysis between requirements and existing code |
| [buildpad-validate-impl](buildpad-validate-impl) | Feature-level integration validation after all tasks |
| [buildpad-review](buildpad-review) | Review a task implementation against the approved spec |
| [buildpad-debug](buildpad-debug) | Root-cause-first debugging when implementation is blocked |
| [buildpad-verify-completion](buildpad-verify-completion) | Verify completion claims with fresh evidence |

### Scaffolding

| Skill | What it does |
|---|---|
| [create-project](create-project) | Initialize a new Buildpad application (Next.js + Buildpad UI) on the Buildpad Engine or on Supabase |
| [create-collection](create-collection) | Generate a collection with its schema, API routes, list/form pages, types, and tests |
| [create-migration](create-migration) | Supabase projects only: generate a PostgreSQL migration with RLS, indexes, triggers; stops on an Engine project |
| [create-api-route](create-api-route) | Generate server-side Next.js API routes: on an Engine project, routes that forward the user's session to the Engine; on a Supabase project, auth routes (login, logout, callback, session) |
| [create-component](create-component) | Generate a React component with the mandatory Buildpad-first check |
| [create-service](create-service) | Create DaaS custom services shared between extensions and cron jobs |
| [create-cron](create-cron) | Create DaaS cron jobs with sandboxed JS and timezone support |
| [create-workflow](create-workflow) | Workflow state machines, content versioning, multi-stage approvals |
| [create-rbac](create-rbac) | Role-based access control: roles, policies, permissions, dynamic filters |
| [create-tests](create-tests) | Playwright E2E and Vitest unit tests for features, APIs, and permissions (and RLS on a Supabase project) |
| [create-feature](create-feature) | Plan and implement a complete feature via the spec workflow |
| [create-form-builder](create-form-builder) | Visual drag-and-drop form authoring plus runtime renderer |

### Add-on modules

| Skill | What it does |
|---|---|
| [add-buildpad](add-buildpad) | Install Buildpad UI Copy & Own components via CLI |
| [add-files](add-files) | Scaffold the Files module: library, detail view, drag-and-drop upload |
| [add-users](add-users) | Scaffold the Users module: /users, /roles, /policies admin pages with permissions matrix |
| [add-workflows](add-workflows) | Scaffold the Workflows module: /workflows (state-diagram editor), /workflow-assignments, /workflow-instances admin pages |
| [add-cron](add-cron) | Scaffold the Cron Jobs module: /cron (jobs list + run history) and /cron/[id] (job editor with a code editor slot) admin pages |
| [add-microapp](add-microapp) | Domain boundaries and repo bootstrap: Main App + micro-apps on one DaaS backend (load first) |
| [add-microfrontend](add-microfrontend) | The composition mechanism: iframe host, postMessage bridge, auth/URL/scope syncing, CSP (load second). Supabase projects only for now: not yet available on an Engine project |
| [add-microfrontend-zones](add-microfrontend-zones) | Path-based composition with Next.js Multi-Zones: one origin, one shared session, no iframes. Supabase projects only for now: not yet available on an Engine project |
| [add-multitenancy](add-multitenancy) | Multi-tenancy (delegates to manage-scope) |
| [add-external-oauth](add-external-oauth) | External OAuth/OIDC identity provider sign-in with a PKCE proxy flow on a Supabase project; on an Engine project, XAppHub sign-in only, through `signInWithIdToken`, and it stops for any other provider |
| [add-i18n](add-i18n) | Internationalization: `app/[lang]` routing, middleware locale negotiation, dictionaries + I18nProvider, LanguageSwitcher, DaaS content translations |
| [add-mobile-app](add-mobile-app) | Wrap the web app as iOS/Android with Capacitor (server-URL mode), plus when to use platform-managed mobile builds / Expo mobile microapps; SSO, push, geofencing, emulator gotchas |
| [add-mcp-server](add-mcp-server) | Expose the app's own data and actions as an MCP server: one stateless `/api/mcp` route whose tools forward the caller's own token to the data API |
| [worker-messaging](worker-messaging) | Offload long-running work to a Buildpad runtime worker over RabbitMQ (topic-exchange job convention; Next.js producer + worker consumer/chaining; connection via Platform MCP) |
| [migrate-to-engine](migrate-to-engine) | Engine projects only: finish moving a project from Supabase to the Buildpad Engine — rewrite the hooks, cron jobs and custom services the Engine could not run, and port the app's code (environment, sign-in, data calls, files, administrator code, access rules); on a Supabase project it explains the move and stops |

### DaaS platform reference

| Skill | What it does |
|---|---|
| [daas-platform](daas-platform) | Core DaaS architecture, REST API, authentication, files, and App Router patterns, for Engine projects and Supabase projects |
| [buildpad-reference](buildpad-reference) | Buildpad UI component catalog and the Buildpad-First rule |
| [authentication-proxy](authentication-proxy) | Auth proxy pattern: all browser-to-backend calls go through Next.js API routes |
| [manage-scope](manage-scope) | Multi-tenancy and data partitioning with the DaaS scope system |
| [relational-permissions](relational-permissions) | Permissions on junction/child collections for nested relational writes |
| [grant-module-access](grant-module-access) | Application-level capability flags via Module-Level Access Keys |
| [hooks-extensions](hooks-extensions) | DaaS runtime extensions: filter hooks, action hooks, utilities API |
| [amplify-env-vars](amplify-env-vars) | Manage AWS Amplify environment variables via Buildpad MCP tools |

### Engineering practices

| Skill | What it does |
|---|---|
| [idea-refine](idea-refine) | Refine vague ideas into concrete proposals |
| [planning-and-task-breakdown](planning-and-task-breakdown) | Decompose specs into small, verifiable tasks |
| [incremental-implementation](incremental-implementation) | Deliver multi-file changes incrementally |
| [context-engineering](context-engineering) | Feed agents the right information at the right time |
| [subagent-delegation](subagent-delegation) | Delegate focused work to subagents in isolated context |
| [debugging-and-error-recovery](debugging-and-error-recovery) | Systematic root-cause debugging |
| [git-workflow-and-versioning](git-workflow-and-versioning) | Git workflow, branching, commits, conflict resolution |
| [review-code](review-code) | Code review for quality, security, performance, DaaS/Buildpad compliance |
| [code-simplification](code-simplification) | Simplify working code while preserving behavior |
| [performance-optimization](performance-optimization) | Application performance and Core Web Vitals |
| [security-and-hardening](security-and-hardening) | Harden code handling input, auth, storage, integrations |
| [generate-docs](generate-docs) | Generate API references, component docs, schemas, changelogs |

## License

[MIT](LICENSE)
