---
name: Multitenancy
description: Multi-tenancy reference for DaaS applications — see manage-scope skill and its references for the complete guide.
applyTo: "**/*.{ts,tsx,sql}"
---

# Multitenancy

Multi-tenancy in DaaS is implemented using the native scope system.

See the `/manage-scope` skill and its references:
- `manage-scope/references/scope-management.instructions.md` — MCP setup, scope types, items, collection config
- `manage-scope/references/scope-permissions.instructions.md` — permission inheritance, enforcement internals
- `manage-scope/references/scope-client.instructions.md` — ScopeProvider, API requests, 400/403 handling, onboarding flow