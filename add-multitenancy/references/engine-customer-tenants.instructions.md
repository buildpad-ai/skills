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

Available in the mode `customer-tenants`: signing in and choosing the current customer (section 5),
scopes inside a customer (section 6), structure built in the Blueprint (section 7), and people
(section 8). Not available yet: Releases. A change made in the Blueprint therefore reaches only the
customers created after it (section 7.1).

What the mode does not offer is listed in section 4.

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

## 5. Signing in and the current customer

On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session.

The Buildpad CLI's generated sign-in route and the SDK do not know this mode yet: the generated
login route sends `X-Tenant-Id` and has no switch. In the mode `customer-tenants`, replace the login
route with the one below and add the three routes after it; a later release of the skills names the
SDK's functions instead.

### 5.1 The routes the application holds

Next.js App Router, server only, each with the session cookies of `@supabase/ssr`, as the
`create-api-route` skill writes them:

| App route | Engine call | Answer to the browser |
|---|---|---|
| `POST /api/auth/login` | Supabase client `signInWithPassword` against the Engine_URL **with no `X-Tenant-Id` header**; then `settleTenant` | `{data: {tenant}}`, `{data: {choose: [...]}}`, or 403 with "Your account does not belong to any customer of this application" |
| `GET /api/auth/tenants` | `GET <Engine_URL>/api/auth/tenants`, `Authorization: Bearer <access token>` | the entries of `kind: "tenant"`, each with `blueprint: id === NEXT_PUBLIC_BUILDPAD_TENANT_ID` |
| `POST /api/auth/tenant` | `POST <Engine_URL>/api/auth/tenant`, body `{"tenant": "<id>"}`, `Authorization: Bearer <access token>`; then `supabase.auth.setSession` with the answered pair | `{data: {tenant}}`; the browser then reloads the page (`window.location.assign("/")`) |
| `DELETE /api/auth/tenants/[id]` | `DELETE <Engine_URL>/api/auth/tenants/:id` (decline an invitation not yet entered) | 204, or the Engine's 409 or 404 |

### 5.2 `settleTenant`

Run it after every sign-in, and in the layout when a signed-in request finds no current customer (a
refresh of a session bound to no tenant stays bound to none):

```ts
// lib/auth/tenants.ts — server only. In the mode customer-tenants.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const ENGINE = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // the Engine_URL

type ServerClient = SupabaseClient; // the @supabase/ssr server client of the request

export type MyTenant = {
  id: string; name: string; uri_path: string | null; current: boolean;
  kind: "host" | "tenant"; accepted: boolean; state: string;
};

async function engineError(r: Response) {
  const body = await r.json().catch(() => ({}));
  const first = body?.errors?.[0];
  return Object.assign(new Error(first?.message ?? `Engine answered ${r.status}`), {
    status: r.status, code: first?.extensions?.code as string | undefined,
  });
}

export async function listTenants(accessToken: string): Promise<MyTenant[]> {
  const r = await fetch(`${ENGINE}/api/auth/tenants`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!r.ok) throw await engineError(r);
  // The Engine lists the host too when the person has a place there: never offer it.
  return ((await r.json()).data as MyTenant[]).filter((t) => t.kind === "tenant");
}

export async function switchTenant(accessToken: string, tenant: string) {
  const r = await fetch(`${ENGINE}/api/auth/tenant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tenant }),
  });
  if (!r.ok) throw await engineError(r);
  // { access_token, refresh_token, expires }: expires is the remaining lifetime in milliseconds.
  return (await r.json()).data as { access_token: string; refresh_token: string; expires: number };
}

export async function settleTenant(supabase: ServerClient, accessToken: string) {
  const tenants = await listTenants(accessToken);
  const current = tenants.find((t) => t.current);
  if (current) return { tenant: current };                        // bound to a customer already
  if (tenants.length === 0) {                                     // belongs to no customer
    await supabase.auth.signOut();
    return { error: "NO_CUSTOMER" as const };
  }
  if (tenants.length === 1) {                                     // one: switch without asking
    const pair = await switchTenant(accessToken, tenants[0].id);  // this also enters an invitation
    await supabase.auth.setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    return { tenant: tenants[0] };
  }
  return { choose: tenants };                                     // several: the person chooses
}
```

### 5.3 Rules

- **A session bound to no customer.** A session with no `current` entry of `kind: "tenant"` is used
  for nothing but the four routes above. One bound to the host (a person with a host role is bound
  there at sign-in) is treated the same way, and its access token is sent to no data route.
- **The chooser** lists each tenant's `name`. It marks the one whose `id` equals
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID` as the application's own tenant (only its developers hold it). It
  shows `accepted: false` entries as invitations with "Join" (the switch, which enters it) and
  "Decline". It shows an entry whose `state` is not `ready` (`provisioning`, `suspended`,
  `migrating`, `failed`) as unavailable, with the cause from the table in 5.4; a `ready` entry may
  still answer 503 at the switch, which the app shows the same way. It may preselect the last
  choice, kept in the browser as a preference only.
- **The switch** runs only in the app's server route, with the current session. After `setSession`
  the old access token is never sent again. Do not sign the old pair out: the Supabase client's
  default sign-out ends every session of the person, the new one included. The browser reloads the
  whole page, so every client cache, `DaaSProvider` and any `ScopeProvider` start in the new
  customer.
- **The current customer** is the `current` entry of `GET /api/auth/tenants`, read once per request
  on the server (React `cache`); the access token's `tnt` claim names the same tenant and may be
  read instead. The app never stores a tenant id of its own for requests, and sends no tenant id on
  a request that carries a session. The layout shows the current customer's `name`, and a "Switch
  customer" menu when the person holds more than one tenant of `kind: "tenant"`.
- **`NEXT_PUBLIC_BUILDPAD_TENANT_ID`** stays the Blueprint's id. It labels the application's own
  tenant in the chooser, and names the tenant of a request without a session (section 4 says what
  that means for public pages).
- **XAppHub** sign-in is not available in this mode (section 4).
- **Caches after a switch.** No cache in the application, on the server or in the browser, is keyed
  without the current customer; the reload after a switch starts every client cache again.

### 5.4 Answers and their causes

The forwarder of the `create-api-route` skill maps them. Only the 503 is retried.

| Engine answer | Cause | What the app shows | Retry |
|---|---|---|---|
| 401 `TENANT_SUSPENDED` | A Platform member suspended this customer | "Access to <customer> is suspended. Ask your administrator." Then sign out | No |
| 401 `TOKEN_INVALID` | The session ended, or this customer was deleted | "Your session has ended. Sign in again." Then the sign-in page | No |
| 503 `SERVICE_UNAVAILABLE` | The customer is not serving for a moment (being migrated or behind the Engine's version during an Engine upgrade, or failed), or the Engine's session store is unavailable | "<customer> is being updated. Try again in a minute." | Yes: up to 3 times, after 2, 5 and 10 seconds |
| 403 `FORBIDDEN`, "This token is not bound to a tenant. Switch to a tenant first." | The session was never switched | The chooser (`settleTenant`) | After the switch |
| 403 `TENANT_SUSPENDED` from the switch | The chosen customer is suspended | As 401 `TENANT_SUSPENDED`, staying on the chooser | No |
| 403 `FORBIDDEN` from the switch | The person holds no place in that tenant | "You are not a member of that customer." | No |
| 401 `USER_SUSPENDED` from the switch | The person's account is not active | "Your account is not active. Ask your administrator." Then sign out | No |

## 6. Scopes inside a customer

- Every scope URI begins with the current customer's node: the `uri_path` of the `current` entry of
  `GET /api/auth/tenants`, never the Blueprint's and never one built from
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A `ScopeProvider`'s root is that node.
- A scope type's id differs in every customer (a creation copies the Blueprint's scope types under
  new ids): look scope types up by name in the current customer. Roles are the opposite (7.2).
- A creation copies the Blueprint's scope types as they are at that moment, so a scope type made in
  the Blueprint reaches every customer created after it, and no customer created before it. The
  application's setup screen for a customer's administrator therefore creates a scope type it needs
  when it finds it missing, beneath their own tenant node.
- A customer's administrator may create scope types and nodes beneath their own tenant node. Direct
  no root type and no first-level node: a first-level node is a tenant, which only the host creates.
- A role's `scope_config` made in the Blueprint may name the Blueprint's node and its own scope
  types: a creation rewrites them to the new customer's node and same-named types.

## 7. Structure is built in the Blueprint

### 7.1 Where structure is built

On an Engine project with Customer_Tenants collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks and custom services are built in the Blueprint, through the project's MCP token or an administrator's session bound there, never in a customer's tenant. A customer receives them once, when it is created from the Blueprint. Releases are not available yet, so a change made in the Blueprint later reaches no customer that already exists: tell the developer so before changing anything a customer already holds.

The project's MCP token is bound to the Blueprint, so every MCP tool builds there; an administrator's
session used for `POST /api/fields/:collection` is the developer's, bound to the Blueprint. Rows are
not structure: a `languages` row, a form definition, a folder or a setting is data, which no
creation copies.

### 7.2 Roles by identifier

A role or policy made in the Blueprint keeps its id in every customer created from it; a customer
may rename it. Application code names such a role by its id, never by its name. The four seeded
roles have fixed ids in every tenant: Administrator `00000000-0000-0000-0000-000000000001`, User
`00000000-0000-0000-0000-000000000002`, Project Developer `00000000-0000-0000-0000-000000000003`,
Project Viewer `00000000-0000-0000-0000-000000000004`.

### 7.3 Cron jobs

A customer created from the Blueprint receives its cron jobs inactive, whatever their status in the
Blueprint. Until Releases are available, each customer's administrator switches a job on in their
own customer.

## 8. People

- In this mode a person's role is a role in the customer's tenant, not in the project's tenant. A
  customer's administrator, signed in to that customer, adds a person with `POST /api/users` and
  gives a role with `POST /api/users/:id/roles`, or in the application's people screens.
- A person who already has an account anywhere on the Engine is attached, not duplicated: their
  password is unchanged, and the new profile is not entered until they switch to the customer, which
  the application's chooser does on their next sign-in. Until then they see it as an invitation
  (`accepted: false`), which they may decline. Adding someone already in the customer answers 409;
  adding back a person whose profile was deleted restores it as it was, entered or not.
- Each customer's user list holds the Platform's own accounts: the account the Platform's server
  uses, `admin@example.com`, named "BuildPad (platform access)", and, once members open the Studio in
  a customer, members' own accounts, whose `provider` is `platform`. An application tells them apart
  by those two marks, shows them as the Platform's, and does not offer to remove or suspend them: the
  Platform cannot open a customer whose platform account was removed.
- The application's people screens act in the current customer only: they call the Engine with the
  session, which is bound to it, and never name another tenant.

## 9. Workers and tests

On an Engine project with Customer_Tenants a worker acts in the Blueprint only, with the project's own worker token; a worker that acts in a customer's tenant is not available. Work that must run in every customer runs as stored code (cron jobs, hooks) built in the Blueprint, which each customer receives as it receives the structure. Tell the developer so and stop: never give a worker a customer's credential or a host credential.

In the mode `customer-tenants` tests sign in to the Blueprint, as ES-12 says. A test of a
customer's path needs a customer made for testing on the Platform's Customers page; the pipeline
holds that customer's test administrator's email and password as secrets, beside the test
administrator's. A test never creates, suspends or deletes a customer.

## 10. Planning

In the mode `customer-tenants` a plan says, for each thing it adds, whether it is per customer
(rows, people, role assignments, settings, files, scope nodes and scope types) or shared through the
Blueprint (collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks,
custom services, module access keys), and plans each shared change as a Release.

## 11. When something goes wrong

```
403 FORBIDDEN "This token is not bound to a tenant"
  → an unbound session that was never switched
  → switch (settleTenant) before any data call
Signs in but shows nothing
  → the profile is not yet entered, or the session is bound to the Blueprint
  → switch to the customer; the chooser does it
401 TENANT_SUSPENDED
  → a Platform member suspended the customer
  → nothing in the app; the member resumes it
503 SERVICE_UNAVAILABLE
  → the customer is not serving for a moment (an Engine upgrade migrating it), or the session store
  → retry after a few seconds
A field in the Blueprint and not in a customer
  → made after the customer was created, and Releases are not available yet
  → ask the Platform member; the change reaches only customers created after it
```

## 12. Review checks

In the mode `customer-tenants`:
- no tenant id is taken from user input except the one the switch route receives, and the Engine
  checks it;
- no host credential or host session is present anywhere;
- no request reaches two customers with one token, and no server code holds two customers' sessions
  at once;
- no cache in the application (server or browser) is keyed without the current customer, and a
  switch reloads the page.

Scopes inside the project's one tenant are set up with the [`manage-scope`](../../manage-scope/SKILL.md) skill.
