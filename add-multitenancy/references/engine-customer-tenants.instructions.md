<!-- buildpad-backend-file: engine -->
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

# Customer_Tenants on an Engine project

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

## 1. Status

On an Engine project with Customer_Tenants each customer would be a tenant of its own, which the Buildpad platform does not offer yet: no project can have Customer_Tenants until it does. Tell the developer so and stop. Build no substitute: no tenant column, no project made by hand for each customer, and no host credential in the application. Scopes inside the project's one tenant are available now, with the `manage-scope` skill.

What the mode will not offer even then is listed in section 4.

## 2. What the mode is

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

Each customer is a tenant of the Engine: a schema of its own, with its own people, roles and
administrators. The Blueprint is the project's own tenant, the one `NEXT_PUBLIC_BUILDPAD_TENANT_ID`
names. The project's MCP token and every worker token are bound to the Blueprint, so an agent
builds there and reaches no customer. A Platform member creates each customer on the project's
Customers page.

## 3. Never

Never put the Engine's host administrator credential, a session bound to the Engine's host, or a
call to `/api/tenants` into an application, a worker, a test or a tool call of yours. Never create a
customer from code. Never take a tenant id from user input, except the one the application's
tenant switch receives, which the Engine checks.

## 4. Not available

On an Engine project with Customer_Tenants customers that sign themselves up are not available: only a Platform member creates a customer, on the Platform's Customers page, and no credential an application may hold can create one. Tell the developer so and stop: never put the host administrator's credential or a call to the Engine's tenant routes in the application.

Who could offer it later: the Buildpad platform, through an API an application's server may call to create a customer, which no plan includes yet.

On an Engine project with Customer_Tenants a public page of one customer is not available: a request without a session acts in the tenant `X-Tenant-Id` names, and nothing maps a host name to a customer yet. A page without a session reads the Blueprint only, through `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. Tell the developer so and stop: do not put a customer's tenant id in the application or let a visitor choose it.

Who could offer it later: the Buildpad platform with the Engine, by mapping a host name to a customer (the Platform's second wave).

On an Engine project with Customer_Tenants XAppHub sign-in is not available: its first sign-in would create the person's account in the Blueprint, outside every customer. Tell the developer so and stop: people sign in with a password, as the `add-multitenancy` skill's guide says.

Who could offer it later: the Buildpad platform, by trusting the XAppHub client in every customer once host names map to customers (the Platform's second wave).

On an Engine project with Customer_Tenants a worker acts in the Blueprint only, with the project's own worker token; a worker that acts in a customer's tenant is not available. Work that must run in every customer runs as stored code (cron jobs, hooks) built in the Blueprint, which each customer receives as it receives the structure. Tell the developer so and stop: never give a worker a customer's credential or a host credential.

Who could offer it later: the Buildpad platform, with a worker per customer (the Platform's third wave).

On an Engine project with Customer_Tenants a backup or a restore of one customer is not available: a project backup holds every customer, and restoring it rolls every customer back. Tell the developer so and stop: build no export or restore of a customer's tenant in the application.

Who could offer it later: the Buildpad platform, with a backup and a restore per customer (the Platform's third wave).

On an Engine project with Customer_Tenants opening the Studio in a customer's tenant is not available from the Platform yet: it opens the Studio in the Blueprint. Tell the developer so and stop.

Who could offer it later: the Buildpad platform, by opening the Studio in a customer's tenant (the Platform's second wave).

On an Engine project with Customer_Tenants moving an application built on scopes into Customer_Tenants is not available: nothing moves a customer's rows, people or files out of the project's tenant into a tenant of its own. Tell the developer so and stop.

Who could offer it later: no plan includes it.

## 9. Workers and tests

On an Engine project with Customer_Tenants a worker acts in the Blueprint only, with the project's own worker token; a worker that acts in a customer's tenant is not available. Work that must run in every customer runs as stored code (cron jobs, hooks) built in the Blueprint, which each customer receives as it receives the structure. Tell the developer so and stop: never give a worker a customer's credential or a host credential.

In the mode `customer-tenants` tests sign in to the Blueprint, as ES-12 says. A test of a
customer's path needs a customer made for testing on the Platform's Customers page; the pipeline
holds that customer's test administrator's email and password as secrets, beside the test
administrator's. A test never creates, suspends or deletes a customer.

Scopes inside the project's one tenant are set up with the [`manage-scope`](../../manage-scope/SKILL.md) skill.
