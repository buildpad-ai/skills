---
name: Multitenancy
description: Multi-tenancy reference for DaaS applications — see manage-scope skill and its references for the complete guide.
applyTo: "**/*.{ts,tsx,sql}"
---

# Multitenancy

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

Multi-tenancy in DaaS is implemented using the native scope system.

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest. On an Engine project a scoped collection's scope column is a many-to-one field to `daas_scope_items` (`meta.options.related_collection: daas_scope_items`, `meta.options.related_field: uri_path`), which gives it a foreign key to `daas_scope_items(uri_path)`.

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

To choose between scopes, Customer_Tenants and a project per customer, see the skill's [`SKILL.md`](../SKILL.md).
<!-- /buildpad-backend -->

See the `/manage-scope` skill; its `SKILL.md` names the references for each kind of project. On a Supabase project they are:
- `manage-scope/references/scope-management.instructions.md` — MCP setup, scope types, items, collection config
- `manage-scope/references/scope-permissions.instructions.md` — permission inheritance, enforcement internals
- `manage-scope/references/scope-client.instructions.md` — ScopeProvider, API requests, 400/403 handling, onboarding flow