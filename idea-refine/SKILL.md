---
name: idea-refine
description: Refines vague ideas into concrete proposals. Use when you have a rough concept that needs exploration, or when requirements are vague and need structured thinking before specification.
---

# Idea Refinement

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

Structured divergent/convergent thinking to turn vague ideas into concrete proposals. Before writing specs or code, ensure the idea is well-formed: the problem is clear, the audience is defined, the scope is bounded, and alternatives have been considered.

## When to Use

- You have a rough concept that needs exploration
- Requirements are vague ("I want a dashboard")
- Multiple approaches exist and you need to choose
- Stakeholders have different visions of the solution

**When NOT to use:** When requirements are already clear and specific — go straight to `spec-driven-development`.

## The Refinement Process

### Phase 1: Diverge (Explore)

Ask expansive questions to understand the full problem space:

```
PROBLEM SPACE:
1. What problem are we solving?
2. Who has this problem? (specific users/roles)
3. How is it solved today? (current workarounds)
4. What happens if we don't solve it?
5. What does "good enough" look like?

SOLUTION SPACE:
6. What are 3 different approaches?
7. What does each approach trade off?
8. What similar solutions exist? (prior art)
9. What constraints exist? (technical, budget, timeline)
10. What would make this fail?
```

### Phase 2: Converge (Focus)

Narrow down to a specific, actionable proposal:

```
PROPOSAL:
- Problem statement: [one sentence]
- Target users: [specific roles]
- Core solution: [chosen approach]
- Key features: [3-5 must-haves]
- Out of scope: [explicit exclusions]
- Success metric: [how to measure]
```

### Phase 3: Validate

Before proceeding to specification:

```
VALIDATION:
- [ ] Problem is real (users actually have this pain)
- [ ] Solution addresses the core problem (not a symptom)
- [ ] Scope is bounded (clear what's included and excluded)
- [ ] Approach is feasible with current stack (Next.js and the project's Buildpad backend: DaaS + Supabase, or the Buildpad Engine)
- [ ] DaaS built-in features are leveraged (not rebuilt)
- [ ] One or more alternatives were considered and rejected with reasons
```

## DaaS Platform Check

Before refining any data-centric idea, check what DaaS provides out of the box:

| If the idea involves... | DaaS already has... |
|------------------------|---------------------|
| Tracking changes | Automatic activity/audit logging |
| Approval processes | Workflow state machines |
| Content drafts | Versioning API |
| File management | Files API |
| Scheduled tasks | Cron jobs |
| Access control | RBAC (roles, policies, permissions) |
| Data partitioning | Scope system (multi-tenancy; on an Engine project the project is one tenant and its scopes sit below it) |
| Data import/export | Utils API |

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

Customers with their own data, people and administrators: the [`add-multitenancy`](../add-multitenancy/SKILL.md) skill chooses between scopes, Customer_Tenants and a project per customer.

In the mode `customer-tenants` a plan says, for each thing it adds, whether it is per customer (rows, people, role assignments, settings, files, scope nodes and scope types) or shared through the Blueprint (collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks, custom services, module access keys), and plans each shared change as a Release.

<!-- /buildpad-backend -->
**If DaaS provides it, the idea refinement should focus on how to configure and present it — not whether to build it.**

## Output Format

```markdown
## Idea: [Name]

### Problem
[Clear statement of the problem and who has it]

### Proposed Solution
[Chosen approach with rationale]

### Key Features
1. [Must-have feature]
2. [Must-have feature]
3. [Must-have feature]

### Out of Scope
- [Explicit exclusion]

### DaaS Features to Leverage
- [Built-in feature and how it applies]

### Alternatives Considered
| Approach | Pros | Cons | Why not |
|----------|------|------|---------|

### Next Steps
- [ ] Write spec (use `spec-driven-development`)
- [ ] Break into tasks (use `planning-and-task-breakdown`)
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I already know what to build" | You know what you think you want. Refinement catches wrong assumptions. |
| "We need to move fast" | Building the wrong thing fast is the slowest path. |
| "Let's just prototype it" | Prototypes without problem clarity become production code. |
| "The user will tell us what's wrong" | Users can identify problems but rarely articulate solutions. |

## Verification

After refinement:

- [ ] Problem statement is clear and specific
- [ ] Target users are identified
- [ ] At least 2 alternatives were considered
- [ ] DaaS built-in features checked for overlap
- [ ] Scope boundaries are explicit
- [ ] Ready to proceed to specification
