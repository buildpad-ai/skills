# Buildpad Agent Skills

Agent skills for building **Buildpad DaaS (Data-as-a-Service)** applications with AI coding agents. Each skill is a folder with a [`SKILL.md`](https://agentskills.io) following the open Agent Skills standard, so they work in Claude Code, GitHub Copilot, Kiro, Antigravity, Cursor, and any other agent that supports the format.

This repository is the **source of truth** for the skills bundled in Buildpad project starters. Starters ship with the skills pre-installed; use the CLI below to update them or to add them to an existing project.

## Install

```bash
# Install skills (interactive picker)
npx skills add buildpad-ai/skills

# Install everything
npx skills add buildpad-ai/skills --all

# Install a single skill
npx skills add https://github.com/buildpad-ai/skills/tree/main/create-project
```

The [skills CLI](https://github.com/vercel-labs/skills) detects your agents and writes each skill to the right location (`.claude/skills/`, `.kiro/skills/`, `.agents/skills/`, …).

## Update

```bash
npx skills check    # see what's outdated
npx skills update   # update installed skills
```

## Catalog

### Scaffolding

| Skill | What it does |
|---|---|
| [create-project](create-project) | Initialize a new DaaS application (Next.js + Supabase + Buildpad UI) |
| [create-collection](create-collection) | Generate a collection: migration, API routes, list/form pages, types, tests |
| [create-migration](create-migration) | Generate a Supabase PostgreSQL migration with RLS, indexes, triggers |
| [create-api-route](create-api-route) | Generate server-side Next.js auth API routes (login, logout, callback, session) |
| [create-component](create-component) | Generate a React component with the mandatory Buildpad-first check |
| [create-service](create-service) | Create DaaS custom services shared between extensions and cron jobs |
| [create-cron](create-cron) | Create scheduled DaaS cron jobs with sandboxed JS and timezone support |
| [create-workflow](create-workflow) | Workflow state machines, content versioning, multi-stage approvals |
| [create-rbac](create-rbac) | Role-based access control: roles, policies, permissions, dynamic filters |
| [create-tests](create-tests) | Playwright E2E and Vitest unit tests for features, APIs, RLS, permissions |
| [create-feature](create-feature) | Plan and implement a complete feature with phased development |
| [create-form-builder](create-form-builder) | Visual drag-and-drop form authoring plus runtime renderer |
| [start-phase](start-phase) | Begin or continue a development phase (0–5) with phase gates |

### Add-on modules

| Skill | What it does |
|---|---|
| [add-buildpad](add-buildpad) | Install Buildpad UI Copy & Own components via CLI |
| [add-files](add-files) | Scaffold the Files module: library, detail view, drag-and-drop upload |
| [add-microservice](add-microservice) | Microservice architecture: Main App + micro-apps on one DaaS backend |
| [add-microfrontend](add-microfrontend) | Micro-frontend architecture via client-side iframe composition |
| [add-multitenancy](add-multitenancy) | Multi-tenancy (delegates to manage-scope) |
| [add-external-oauth](add-external-oauth) | External OAuth/OIDC identity provider integration with PKCE proxy flow |

### DaaS platform reference

| Skill | What it does |
|---|---|
| [daas-platform](daas-platform) | Core DaaS architecture, REST API, Supabase integration, App Router patterns |
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
| [spec-driven-development](spec-driven-development) | Write specifications before code |
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
