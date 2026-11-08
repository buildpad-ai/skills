---
name: add-multitenancy
description: Multi-tenancy for DaaS applications — delegates to /manage-scope, the standard approach.
argument-hint: "[levels: e.g. tenant / region/branch] [use-case]"
---

# Add Multitenancy

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

> **This skill delegates to `/manage-scope`.**
>
> DaaS implements multi-tenancy through its native scope system — no junction tables, no custom FK columns, built-in hierarchical permission enforcement. Load the `/manage-scope` skill to proceed.
>
> On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.
>
> On an Engine project a scoped collection's scope column is a many-to-one field to `daas_scope_items` (`meta.options.related_collection: daas_scope_items`, `meta.options.related_field: uri_path`), which gives it a foreign key to `daas_scope_items(uri_path)`.

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

## Choose how customers are separated

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

On an Engine project with Customer_Tenants each customer would be a tenant of its own, which the Buildpad platform does not offer yet: no project can have Customer_Tenants until it does. Tell the developer so and stop. Build no substitute: no tenant column, no project made by hand for each customer, and no host credential in the application. Scopes inside the project's one tenant are available now, with the `manage-scope` skill.

On an Engine project with Customer_Tenants customers that sign themselves up are not available: only a Platform member creates a customer, on the Platform's Customers page, and no credential an application may hold can create one. Tell the developer so and stop: never put the host administrator's credential or a call to the Engine's tenant routes in the application.
<!-- /buildpad-backend -->

See `/manage-scope` for the complete setup guide.