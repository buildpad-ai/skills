---
name: spec-driven-development
description: Writes specifications before code. Use when starting a new project, feature, or significant change. Use when requirements are unclear or a PRD is needed before implementation begins.
---

# Spec-Driven Development

## Overview

Write a specification covering objectives, structure, code style, testing, and boundaries before any code. A spec is a contract between intent and implementation — it prevents scope creep, aligns expectations, and gives reviewers something to verify against.

## When to Use

- Starting a new project or feature
- Requirements are complex or ambiguous
- Multiple people (or agents) will work on the implementation
- The change is significant enough that "just build it" risks wasted effort

**When NOT to use:** Single-file bug fixes, small refactors, or changes where the spec would be longer than the code.

## Spec Template

```markdown
# Feature: [Name]

## Objective
What problem does this solve? Who benefits? What does success look like?

## Requirements
### Must Have
- [ ] Requirement 1
- [ ] Requirement 2

### Nice to Have
- [ ] Optional requirement

### Out of Scope
- Explicitly excluded items (prevents scope creep)

## Data Model
- Collections, fields, types, relationships
- Standard fields (audit, workflow, scope) per decision tree

## API Design
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/items/[collection] | List items |
| POST | /api/items/[collection] | Create item |

## UI Design
- Pages, components, user flows
- Which Buildpad components to use (Buildpad-First rule)

## Testing Strategy
- API tests: [what to test]
- Page tests: [what to test]
- E2E tests: [critical user flows]

## Implementation Plan
Phased approach (aligned with DaaS phases):
1. Data Foundation (migration, API, types)
2. Core UI (pages, forms, navigation)
3. Business Logic (validation, permissions)
4. Relations and integration
5. Polish (error handling, a11y, docs)

## Boundaries
### Always
- Run tests after every change
- Use Buildpad components for all form/input UI
- Follow proxy pattern for all API calls

### Ask First
- Schema changes, new dependencies, permission changes

### Never
- Skip tests, commit secrets, bypass auth
```

## Process

1. **Gather requirements** — What does the user want? What constraints exist?
2. **Check DaaS built-in features** — Does the platform already provide this? (audit trail, workflow, versioning, RBAC, scoping, cron, import/export)
3. **Write the spec** using the template above
4. **Review the spec** — Confirm with the user before implementing
5. **Implement against the spec** — The spec is the reference for "is this done?"
6. **Verify against the spec** — Every requirement checkbox should be verifiable

## DaaS-Specific Considerations

When writing specs for DaaS applications:

- **Data model**: Use DaaS collection/field schema, not raw SQL design
- **API**: DaaS provides CRUD automatically — spec only custom endpoints
- **Permissions**: Spec the RBAC model (roles, policies, access entries)
- **Workflow**: If content lifecycle needed, spec workflow states and transitions
- **Scope**: If multi-tenant, spec the scope hierarchy

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The feature is simple, no spec needed" | Simple features with unclear requirements become complex features with bugs. |
| "I'll figure it out as I go" | You'll figure out the wrong thing and refactor twice. |
| "The spec will slow us down" | The spec prevents the rework that actually slows you down. |
| "Requirements will change anyway" | Specs can change too. The value is in the thinking process, not the document. |

## Red Flags

- Starting implementation without clear requirements
- Spec that only covers happy path (no error cases, edge cases)
- Spec that doesn't mention testing strategy
- "Out of Scope" section is empty (everything is in scope = nothing is)
- No data model or API design in the spec

## Verification

Before moving from spec to implementation:

- [ ] Objective is clear and measurable
- [ ] Requirements are specific and testable
- [ ] Out of scope is explicitly defined
- [ ] DaaS built-in features are leveraged (not rebuilt)
- [ ] Data model accounts for permissions, workflow, scope if applicable
- [ ] Testing strategy covers all requirement categories
- [ ] The user/stakeholder has reviewed and approved the spec
