---
name: spec-driven-development
description: Spec-driven development (SDD) methodology for Buildpad DaaS apps. Use when starting a new project, feature, or significant change, or when requirements are unclear. Routes work through the spec workflow — requirements.md (EARS) → design.md → tasks.md in .kiro/specs/ — via the buildpad-spec-* skills, or Kiro's native specs when working in Kiro.
---

# Spec-Driven Development

<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

## Overview

All non-trivial work follows spec-driven development: specifications are written and approved **before** code. A spec is a contract between intent and implementation — it prevents scope creep, aligns expectations, and gives reviewers something to verify against.

Every feature lives in `.kiro/specs/<feature-name>/` as three artifacts:

| Artifact | Contents | Produced by |
|---|---|---|
| `requirements.md` | User stories + acceptance criteria in EARS format | `/buildpad-spec-requirements` |
| `design.md` | Architecture, data model, file structure plan, diagrams | `/buildpad-spec-design` |
| `tasks.md` | Small, verifiable implementation tasks with dependencies | `/buildpad-spec-tasks` |

The same artifact format works in every IDE:

- **Kiro IDE** — use Kiro's **native specs** feature (the Specs panel / `requirements.md`, `design.md`, `tasks.md` workflow). Do not use the `buildpad-spec-*` skills in Kiro; they are the same workflow for agents without native spec support.
- **Claude Code, GitHub Copilot, Antigravity, and other agents** — use the bundled spec skills:
  1. `/buildpad-discovery <idea>` — when unsure whether the work is one spec, many specs, or no spec at all
  2. `/buildpad-spec-init <description>` — initialize the spec structure
  3. `/buildpad-spec-requirements <feature>` — generate requirements (review gate)
  4. `/buildpad-spec-design <feature>` — generate design (review gate)
  5. `/buildpad-spec-tasks <feature>` — generate tasks (review gate)
  6. `/buildpad-impl <feature>` — implement task-by-task with TDD and review
  7. `/buildpad-spec-status <feature>` — check progress at any time

Each stage has a **human review gate**: requirements are approved before design, design before tasks, tasks before implementation. Fast path for a single small spec: `/buildpad-spec-quick <description>`.

## When to Use

- Starting a new project or feature
- Requirements are complex or ambiguous
- Multiple people (or agents) will work on the implementation
- The change is significant enough that "just build it" risks wasted effort

**When NOT to use:** Single-file bug fixes, small refactors, or changes where the spec would be longer than the code.

## DaaS-Specific Considerations

When writing specs for DaaS applications:

- **Data model** (design.md): Use DaaS collection/field schema, not raw SQL design; include standard fields (audit, workflow, scope) per decision tree
- **Check DaaS built-in features first**: Does the platform already provide this? (audit trail, workflow, versioning, RBAC, scoping, cron, import/export) — never spec a rebuild of a built-in
- **API** (design.md): DaaS provides CRUD automatically — spec only custom endpoints
- **UI** (design.md): Name the Buildpad components to use (Buildpad-First rule)
- **Permissions**: Spec the RBAC model (roles, policies, access entries)
- **Workflow**: If content lifecycle needed, spec workflow states and transitions
- **Scope**: If multi-tenant, spec the scope hierarchy (on an Engine project the project is one tenant, and the hierarchy begins beneath its tenant node: no scope type or item without a parent)
- **Testing** (tasks.md): API tests, page tests, and E2E tests are tasks, not afterthoughts

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

In the mode `customer-tenants` a plan says, for each thing it adds, whether it is per customer (rows, people, role assignments, settings, files, scope nodes and scope types) or shared through the Blueprint (collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks, custom services, module access keys), and plans each shared change as a Release.

<!-- /buildpad-backend -->
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The feature is simple, no spec needed" | Simple features with unclear requirements become complex features with bugs. |
| "I'll figure it out as I go" | You'll figure out the wrong thing and refactor twice. |
| "The spec will slow us down" | The spec prevents the rework that actually slows you down. |
| "Requirements will change anyway" | Specs can change too — update the artifacts, then the code. The value is in the thinking process, not the document. |

## Red Flags

- Starting implementation without an approved requirements.md and design.md
- Requirements that only cover the happy path (no error cases, edge cases)
- tasks.md with no testing tasks
- No explicit out-of-scope statement in requirements (everything in scope = nothing is)
- Code that drifts from design.md without the design being updated

## Verification

Before moving from spec to implementation:

- [ ] requirements.md: objectives clear, acceptance criteria in EARS format, out of scope explicit
- [ ] design.md: data model, API surface, file structure plan, Buildpad components named
- [ ] DaaS built-in features are leveraged (not rebuilt)
- [ ] tasks.md: small verifiable tasks, dependencies annotated, tests included
- [ ] The user/stakeholder has approved each artifact at its review gate
