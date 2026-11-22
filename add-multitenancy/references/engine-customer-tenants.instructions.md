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
customers created after it (section 7.1). With Self-onboarding on, it reaches no customer at all
until Releases are available (section 13).

Customers that sign themselves up: available while the project's Self-onboarding is on (section 13).

Customer hosts: the Platform serves the application on one host name per customer, and signed-in
people use it to reach their customer directly (section 14).

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
customer from code, except through the `add-customer-onboarding` skill's route, with the person's
own session. Never take a tenant id from user input, except the one the application's tenant switch
receives, which the Engine checks; the id a person's own creation chose, which the Engine accepts
only for that person's own retry, is not such an input.

## 4. Not available

On an Engine project with Customer_Tenants a public page of one customer is not available: a request without a session acts in the tenant `X-Tenant-Id` names, and the Engine maps no host name to a customer. A page without a session reads the Blueprint only, through `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. Tell the developer so and stop: never send a customer's tenant id as `X-Tenant-Id`, and never let a visitor choose a tenant. A customer's own host name serves signed-in people only, as the `add-multitenancy` skill's guide `engine-customer-tenants` says in its section 14.

Who could offer it later: the Buildpad platform with the Engine, by mapping a host name to a customer for requests without a session (the Platform's second wave).

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
login route sends `X-Tenant-Id` and has no switch. In the mode `customer-tenants`:
- replace the login route and add the three routes of 5.1 as the
  [`create-api-route`](../../create-api-route/SKILL.md) skill's Engine routes reference writes them,
  under "In the mode `customer-tenants`", with `lib/auth/tenants.ts` exactly as 5.2 gives it;
- change two generated files, `lib/supabase/server.ts` and `lib/supabase/middleware.ts`, as 5.6
  says;
- add the chooser's page `/choose-customer` (5.3).

A later release of the skills names the SDK's functions instead.

### 5.1 The routes the application holds

Next.js App Router, server only, each with the session cookies of `@supabase/ssr`, as the
`create-api-route` skill writes them:

| App route | Engine call | Answer to the browser |
|---|---|---|
| `POST /api/auth/login` | Supabase client `signInWithPassword` against the Engine_URL **with no `X-Tenant-Id` header**; then `settleTenant` | `{data: {tenant}}`, `{data: {choose: [...]}}`, or 403 with "Your account does not belong to any customer of this application"; with Self-onboarding on, also `{data: {create: true}}` and 403 with the code `EMAIL_NOT_CONFIRMED` (5.5) |
| `GET /api/auth/tenants` | `GET <Engine_URL>/api/auth/tenants`, `Authorization: Bearer <access token>` | the entries of `kind: "tenant"`, each with `blueprint: id === NEXT_PUBLIC_BUILDPAD_TENANT_ID` |
| `POST /api/auth/tenant` | `POST <Engine_URL>/api/auth/tenant`, body `{"tenant": "<id>"}`, `Authorization: Bearer <access token>`; then `supabase.auth.setSession` with the answered pair | `{data: {tenant}}`; the browser then reloads the page (`window.location.assign("/")`) |
| `DELETE /api/auth/tenants/[id]` | `DELETE <Engine_URL>/api/auth/tenants/:id` (decline an invitation not yet entered) | 204, or the Engine's 409 or 404 |

### 5.2 `settleTenant`

Run it after every sign-in, in the login route. Never run it in a layout or page: a Server Component
cannot set the session cookies, so the switch would be lost. A signed-in request that finds no
current customer (a refresh of a session bound to no tenant stays bound to none) is sent to the
chooser's page instead (5.3):

```ts
// lib/auth/tenants.ts — server only. In the mode customer-tenants.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const ENGINE = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // the Engine_URL
// true only once the add-customer-onboarding skill builds sign-up (5.5); never read from the
// environment or the request.
export const SELF_ONBOARDING = false;

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
  if (tenants.length === 0) {                                     // belongs to no customer yet
    if (SELF_ONBOARDING) return { create: true as const };        // add-customer-onboarding
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

- **A session bound to no customer.** A session with no `current` entry of `kind: "tenant"` reaches
  no data route. Besides the middleware's own `getUser`, refresh and sign-out (5.6), it is used for
  nothing but the four routes above, and, with Self-onboarding on, a fifth: the app's
  `POST /api/onboarding/customers`, which sends its access token to the Engine's
  `POST /api/onboarding/customers` only (5.5). The middleware answers 403 for every other `/api/`
  path, so the generated catch-all `app/api/[...path]` never forwards it. One bound to the host (a
  person with a host role is bound there at sign-in) is treated the same way, and its access token
  is sent to no data route.
- **The chooser** is the page `/choose-customer`. With no tenant to list, it sends the browser to
  `/create-company` when Self-onboarding is on (5.5), and signs out otherwise:

  ```tsx
  // app/(auth)/choose-customer/page.tsx — a server component, before it renders the list.
  const tenants = await listTenants(session.access_token);
  if (tenants.length === 0) redirect(SELF_ONBOARDING ? "/create-company" : "/logout"); // next/navigation
  ```

  Export `SELF_ONBOARDING` from `lib/auth/tenants.ts` for this. `/logout` is the page or route that
  calls the logout route. It lists each tenant's `name`. It marks the one whose `id` equals
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID` as the application's own tenant (only its developers hold it). It
  shows `accepted: false` entries as invitations with "Join" (the switch, which enters it) and
  "Decline". It shows an entry whose `state` is not `ready` (`provisioning`, `suspended`,
  `migrating`, `failed`) as unavailable, with the cause from the table in 5.4; a `ready` entry may
  still answer 503 at the switch, which the app shows the same way. It may preselect the last
  choice, kept in the browser as a preference only. With Self-onboarding on, it also shows a
  "Create another company" link to `/create-company`, always: the app cannot read the project's
  `per_identity` (how many companies one person may create), and the create route's 409 at that
  limit explains itself.
- **The switch** runs only in the app's server route, with the current session. After `setSession`
  the old access token is never sent again. Do not sign the old pair out: the Supabase client's
  default sign-out ends every session of the person, the new one included. The browser reloads the
  whole page, so every client cache, `DaaSProvider` and any `ScopeProvider` start in the new
  customer.
- **The current customer** is the `current` entry of `GET /api/auth/tenants`, read once per request
  on the server (React `cache`); the access token's `tnt` claim names the same tenant and may be
  read instead. The app never stores a tenant id of its own for requests, and sends no tenant id on
  a request that carries a session. The layout shows the current customer's `name`, and a "Switch
  customer" menu when the person holds more than one tenant of `kind: "tenant"`. In the CLI's
  shell, put both in its `headerActions` slot. The layout never switches: with a session and no
  current customer it redirects to `/choose-customer`.

```ts
// lib/auth/current.ts — server only. Read once per request.
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/auth/tenants";

export const currentCustomer = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;                                      // the middleware sent it to sign-in
  const tenants = await listTenants(session.access_token);
  return { current: tenants.find((t) => t.current) ?? null, count: tenants.length };
});
```

```tsx
// In the signed-in layout (a server component):
const customer = await currentCustomer();
if (customer && !customer.current) redirect("/choose-customer"); // from next/navigation
// customer.current.name, and the "Switch customer" menu when customer.count > 1, in headerActions.
```
- **`NEXT_PUBLIC_BUILDPAD_TENANT_ID`** stays the Blueprint's id. It labels the application's own
  tenant in the chooser, and names the tenant of a request without a session (section 4 says what
  that means for public pages).
- **XAppHub** sign-in is not available in this mode (section 4).
- **Caches after a switch.** No cache in the application, on the server or in the browser, is keyed
  without the current customer; the reload after a switch starts every client cache again.

### 5.4 Answers and their causes

The forwarder of the `create-api-route` skill passes them back unchanged; the page shows each as
the table says. Only the 503 is retried.

| Engine answer | Cause | What the app shows | Retry |
|---|---|---|---|
| 401 `TENANT_SUSPENDED` | A Platform member suspended this customer | "Access to <customer> is suspended. Ask your administrator." Then sign out | No |
| 401 `TOKEN_INVALID` | The session ended, or this customer was deleted | "Your session has ended. Sign in again." Then the sign-in page | No |
| 503 `SERVICE_UNAVAILABLE` | The customer is not serving for a moment (being migrated or behind the Engine's version during an Engine upgrade, or failed), or the Engine's session store is unavailable | "<customer> is being updated. Try again in a minute." | Yes: up to 3 times, after 2, 5 and 10 seconds |
| 403 `FORBIDDEN`, "This token is not bound to a tenant. Switch to a tenant first." | The session was never switched | The chooser (`settleTenant`) | After the switch |
| 403 `TENANT_SUSPENDED` from the switch | The chosen customer is suspended | As 401 `TENANT_SUSPENDED`, staying on the chooser | No |
| 403 `FORBIDDEN` from the switch | The person holds no place in that tenant | "You are not a member of that customer." | No |
| 401 `USER_SUSPENDED` from the switch | The person's account is not active | "Your account is not active. Ask your administrator." Then sign out | No |

### 5.5 With Self-onboarding on

In the mode `customer-tenants` with Self-onboarding on (section 13), the `add-customer-onboarding`
skill changes the sign-in above in three places, and in nothing else:

1. **An unverified sign-in.** For a person who signed up and has not confirmed their address,
   `signInWithPassword` answers the GoTrue error code `email_not_confirmed`. The login route maps it
   to 403 `{errors: [{message: "Confirm your email first.", extensions: {code: "EMAIL_NOT_CONFIRMED"}}]}`,
   the shape of its other answers. The page shows the message, links to `/verify-email` to send the
   confirmation again, and always shows a "Create an account" link to `/sign-up`.
2. **An empty tenant list.** The skill sets `SELF_ONBOARDING` to `true` in `lib/auth/tenants.ts`.
   `settleTenant` then keeps the unbound session and answers `{create: true}` instead of signing out
   with `NO_CUSTOMER`, and the login route sends the browser to `/create-company`. Without the flow
   the constant stays `false`, and `NO_CUSTOMER` stands.
3. **The middleware** lets the unbound session reach `/create-company`, and makes `/sign-up` and
   `/verify-email` public (5.6).

The person creates their company on `/create-company` with that unbound session, through the fifth
route of 5.3; the route then switches into the new customer as 5.1's switch does.

### 5.6 The middleware and the shared server client

Two files the CLI generates change in the mode `customer-tenants`. Running the CLI again with
`--overwrite` restores them, so change them again afterwards.

**`lib/supabase/server.ts` sends no `X-Tenant-Id`.** Delete the line that adds
`global: { headers: { 'X-Tenant-Id': … } }`. The routes of 5.1 and the onboarding routes use this
client for `getSession`, `refreshSession` and `setSession`, and none of them names a tenant.

**`lib/supabase/middleware.ts` knows the unbound session.** The Engine's `GET /auth/v1/user` answers
a session bound to no tenant with 403 "This token is not bound to a tenant", so the generated
`getUser()` check reads a person who has just signed in, and has not chosen or created a customer
yet, as signed out, and loops them back to sign-in. Replace the part after `getUser()` with this:

```ts
  const { data: { user }, error } = await supabase.auth.getUser();

  // A session bound to no customer: the Engine's GoTrue refuses it with 403 FORBIDDEN "This token
  // is not bound to a tenant". A missing or expired session is 401, or no error at all with no
  // user: both mean signed out. getSession reads the cookie, already refreshed by getUser; the
  // Engine checks the token on every route this lets through.
  let unbound = false;
  if (!user && error?.status === 403) {
    const { data: { session } } = await supabase.auth.getSession();
    unbound = session !== null;
  }

  const pathname = request.nextUrl.pathname;
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const path = stripLocale(pathname);

  // With Self-onboarding on (add-customer-onboarding), also "/sign-up" and "/verify-email".
  const publicRoutes = ['/login', '/signup', '/auth', '/api/auth'];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));
  const isApiRoute = path.startsWith('/api');

  // Keep the refreshed session cookies on any answer other than supabaseResponse.
  const withCookies = (res: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (unbound) {
    // With Self-onboarding on, also "/create-company" and "/api/onboarding/customers".
    const unboundPages = ['/choose-customer'];
    const unboundApi = ['/api/auth/'];
    if (isApiRoute && !unboundApi.some((route) => path.startsWith(route))) {
      return withCookies(NextResponse.json(
        { errors: [{ message: 'Choose a customer first.', extensions: { code: 'NO_CURRENT_CUSTOMER' } }] },
        { status: 403 },
      ));
    }
    if (!isApiRoute && !isPublicRoute && !unboundPages.some((route) => path.startsWith(route))) {
      return withCookies(NextResponse.redirect(new URL(`/${locale}/choose-customer`, publicOrigin(request))));
    }
    return supabaseResponse;
  }

  if (!user && !isPublicRoute && !isApiRoute) {
    const url = new URL(`/${locale}/login`, publicOrigin(request));
    url.search = request.nextUrl.search;
    return withCookies(NextResponse.redirect(url));
  }

  return supabaseResponse;
```

A session bound to a customer, or to the host, passes `getUser()` as before; the layout sends one
with no current customer to the chooser (5.3).

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

In the mode `customer-tenants` with Self-onboarding on, this changes. Turning sign-up on publishes
Release 1, and from then on the Engine creates every new customer, signed up or made on the
Platform's Customers page, from the latest published Release, not from the Blueprint as it is. A
change made in the Blueprint after that reaches no customer, new or existing, until a later Release
is published, and the Platform offers later Releases only once Releases are available. Tell the
developer so before a change in the Blueprint, and before sign-up is turned on: build the structure
new customers need first.

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
custom services, module access keys), and says, for each shared change, that it reaches only the customers created after it: Releases are not available yet.
With Self-onboarding on, it says instead that a shared change reaches no customer until a later
Release is published (section 7.1).

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
A field in the Blueprint and in no customer, even a new one (Self-onboarding)
  → made after sign-up was turned on: new customers are created from Release 1
  → no customer gets it until a later Release is published (section 7.1)
A new person loops between sign-in and the sign-in page (Self-onboarding)
  → the middleware reads the unbound session as signed out
  → change lib/supabase/middleware.ts as section 5.6 says
Signs up but no email arrives (Self-onboarding)
  → the app's Mail_Sender failed, or the mail provider's domain is not verified
  → the mail provider's logs
Every sign-up says "Sign-up is not available right now." (Self-onboarding)
  → the log names it: onboarding.not_configured (the key is not in .env.production),
    onboarding.key_invalid (401 TOKEN_INVALID: the key is revoked), onboarding.engine_too_old
  → the Customers page's key list (last use) and the amplify.yml line
Sign-ups answer 429 after five (Self-onboarding)
  → no X-Onboarding-Client-Address, so all sign-ups share one bucket
  → send the address
Creating a company answers 503 (Self-onboarding)
  → the template-copy lock
  → retry with the same id
Creating a company answers 409 before creating anything (Self-onboarding)
  → the Blueprint has no published Release
  → ask the Platform member who turned Self-onboarding on: turning it on publishes the first Release
"There is no customer at this address." (404) on a customer host
  → the subdomain's slug is not in config/customer-hosts.ts
  → add the customer from get_project_detail's customers[], then deploy (section 14.6)
The chooser, or every customer, appears on a customer host
  → the application does not see the customer host: the hosting passes another name in
    X-Forwarded-Host and Host, or the host map is not read
  → log requestHost() once on the deployed app; check the map and section 14.2
"Your account does not belong to <customer>." on a customer host
  → the person's own list lacks that customer (another customer's person, or not yet added)
  → an administrator of that customer adds them, or they use their own customer's host
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

With customer hosts (section 14), also:
- the customer host map holds only `slug`, `tenantId` and `name`, copied from `customers[]` of
  `get_project_detail`, and no code without a session reads it;
- on a customer's host the sign-in, the list, the switch and the decline use only that customer's
  entry of the person's own list; a person outside it gets 403 `NOT_A_MEMBER` and no sign-out;
- a subdomain the map does not name answers 404 on every path;
- every redirect is built from `publicOrigin()`, which uses the request's host only when it is one
  label of the customer domain and in the map; the matcher's tests include lookalike hosts.

With Self-onboarding on (section 13), also:
- `BUILDPAD_ONBOARDING_KEY` is read only in one server-only module, never with a `NEXT_PUBLIC_`
  prefix and never in a client component;
- the sign-up route checks the bot-check token before it calls the Engine;
- the sign-up page shows the same text for a new and an existing address.

Scopes inside the project's one tenant are set up with the [`manage-scope`](../../manage-scope/SKILL.md) skill.

## 13. Customers who sign themselves up

On an Engine project with Customer_Tenants customers sign themselves up only while the project's Self_Onboarding is on, which `selfOnboarding` in `.buildpad/project.json` says. While it is off, tell the developer that a project Admin turns it on from the Platform's Customers page, and stop. While it is on, build it with the `add-customer-onboarding` skill: the application's own server routes call the Engine's sign-up, verification and customer routes with `BUILDPAD_ONBOARDING_KEY`, read on the server only and never sent to a browser. Never put the host administrator's credential or a call to `/api/tenants` in the application.

Who turns it on: a project Admin, from the Platform's Customers page, once a host administrator has turned on the premium flag Customer self-onboarding for the project.

Turning sign-up on publishes Release 1, and new customers are created from it, so a change made in
the Blueprint afterwards reaches no customer until a later Release is published (section 7.1).

Build it with the [`add-customer-onboarding`](../../add-customer-onboarding/SKILL.md) skill.

## 14. Customer hosts

On an Engine project with Customer_Tenants the Buildpad platform serves the application on one host name per customer, `<slug>.<customer domain>`, and the application maps the host to the customer itself, with a committed map from each customer's `slug` to its `id` copied from `customers[]` of `get_project_detail`. The map only chooses which entry of the signed-in person's own `GET /api/auth/tenants` list to enter: the password sign-in still sends no `X-Tenant-Id`, and nothing without a session uses the map. On a customer's host the application enters that customer without a chooser, refuses a person whose list does not hold it without signing them out, answers 404 for a subdomain the map does not name, and builds a redirect from the request's host only when that host is one label of the customer domain and in the map. Build it as the `add-multitenancy` skill's guide `engine-customer-tenants` says in its section 14.

The Platform sets the hosts up: every customer of the project is served on `<slug>.<customer domain>`,
for example `acme.lms.apps.buildpad.ai`, and the application keeps answering on its own address (the
bare host). The Engine maps no host to a tenant, and its `GET /api/auth/tenants` entries carry no
slug, so the application holds the map. Take each customer's `slug`, `id` and `name` from
`customers[]` of `get_project_detail`. Ask the developer once for the customer domain (the part
after `<slug>.`) when you do not know it. A request without a session still reads the Blueprint only
(section 4).

| Host | What the application does |
|---|---|
| `<slug>.<customer domain>`, slug in the map | Sign-in enters that customer, never the chooser; a person whose list lacks it is refused (14.3) |
| `<label>.<customer domain>`, label not in the map | 404 on every path (14.2) |
| Any other host (the bare host, the hosting's default domain, `localhost`) | Sections 5.1 to 5.6, unchanged |
| `<slug>.localhost:<port>`, in development only | As the customer's host |

### 14.1 The map and the host

```ts
// config/customer-hosts.ts: committed. Copied from get_project_detail customers[]; one line per customer.
export const CUSTOMER_HOST_SUFFIX = "lms.apps.buildpad.ai"; // the customer domain
export const CUSTOMER_HOSTS: Readonly<Record<string, { tenantId: string; name: string }>> = {
  acme: { tenantId: "<customers[].id>", name: "Acme" },
};
```

```ts
// lib/customer-host.ts: Edge-safe (the middleware imports it). No server-only import.
import { CUSTOMER_HOST_SUFFIX, CUSTOMER_HOSTS } from "@/config/customer-hosts";

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"; // exactly one DNS label
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CUSTOMER = new RegExp(`^(${LABEL})\\.${esc(CUSTOMER_HOST_SUFFIX)}$`);
const DEV = new RegExp(`^(${LABEL})\\.localhost$`);

export type HostCustomer =
  | { kind: "bare" }
  | { kind: "unknown"; slug: string }
  | { kind: "customer"; slug: string; tenantId: string; name: string };

/** The host the client addressed: the first X-Forwarded-Host entry, else Host. */
export function requestHost(headers: Pick<Headers, "get">): string | null {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  return first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
}

/** Lower case, port removed; null for an IPv6 literal or a trailing dot. */
export function hostnameOf(host: string | null): string | null {
  const v = host?.trim().toLowerCase();
  if (!v || v.startsWith("[")) return null;
  const name = v.split(":")[0];
  return name && !name.endsWith(".") ? name : null;
}

export function resolveHostCustomer(host: string | null): HostCustomer {
  const name = hostnameOf(host);
  const m = name && (CUSTOMER.exec(name) ?? (process.env.NODE_ENV !== "production" ? DEV.exec(name) : null));
  if (!m) return { kind: "bare" };
  const slug = m[1];
  const entry = Object.hasOwn(CUSTOMER_HOSTS, slug) ? CUSTOMER_HOSTS[slug] : undefined;
  return entry ? { kind: "customer", slug, ...entry } : { kind: "unknown", slug };
}

export const hostCustomerOf = (h: Pick<Headers, "get">) => resolveHostCustomer(requestHost(h));

/** Exactly https://<one label>.<customer domain>: no port, path, user info or lookalike suffix. */
export function isCustomerOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && !u.port && !u.username && origin === u.origin && CUSTOMER.test(u.hostname);
  } catch {
    return false;
  }
}

/** All entries on the bare host, the host's customer on its host, none on an unknown one. */
export function onlyHostCustomer<T extends { id: string }>(tenants: T[], host: HostCustomer): T[] {
  if (host.kind === "bare") return tenants;
  return host.kind === "customer" ? tenants.filter((t) => t.id === host.tenantId) : [];
}

export const notMemberOfHost = (name: string) => `Your account does not belong to ${name}.`;
```

In route handlers and server components read the host with `hostCustomerOf(await headers())`
(`next/headers`). A forged `X-Forwarded-Host` changes only which customer the client's own request
asks for: the person's own list and the Engine still decide, and a browser cannot set the header on
another person's cross-site request.

### 14.2 The middleware

Answer an unknown subdomain before anything else, so it never falls back to the bare host's sign-in
(where a person could open any of their customers on an address meant for one):

```ts
// middleware.ts: first lines of the middleware function.
if (hostCustomerOf(request.headers).kind === "unknown") {
  const body = { errors: [{ message: "There is no customer at this address.", extensions: { code: "UNKNOWN_CUSTOMER_HOST" } }] };
  return request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json(body, { status: 404, headers: { "Cache-Control": "private, no-store" } })
    : new NextResponse("There is no customer at this address.\n", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
```

A mapped customer host passes on: the routes and the current-customer read take the customer from
the host themselves. The session cookies stay host-only (the `@supabase/ssr` default, no `Domain`), so
each host has its own session and the bare host's session is not sent to a customer's host.

### 14.3 Sign-in, the list, the switch and the decline

Give `settleTenant` (5.2) the host, and filter the list before anything else. With at most one entry
left, the person is entered without a chooser:

```ts
// lib/auth/tenants.ts: settleTenant on a customer's host.
export async function settleTenant(supabase: ServerClient, accessToken: string, host: HostCustomer = { kind: "bare" }) {
  const tenants = onlyHostCustomer(await listTenants(accessToken), host);
  if (host.kind !== "bare" && tenants.length === 0) {
    // Refused, never moved to another of the person's customers. No signOut: the client's default
    // sign-out ends the person's sessions on every host and device. The login route drops this
    // host's new cookies instead.
    return { error: "NOT_A_MEMBER" as const, message: notMemberOfHost(host.kind === "customer" ? host.name : "this customer") };
  }
  // ... then exactly the body of 5.2, on `tenants`.
}
```

```ts
// app/api/auth/login/route.ts: after signInWithPassword, still with no X-Tenant-Id.
const host = hostCustomerOf(await headers());
const settled = await settleTenant(supabase, data.session.access_token, host);
if ("error" in settled && settled.error === "NOT_A_MEMBER") {
  for (const { name } of cookieStore.getAll()) {
    if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) cookieStore.delete(name); // this host's new session
  }
  return NextResponse.json({ errors: [{ message: settled.message, extensions: { code: "NOT_A_MEMBER" } }] }, { status: 403 });
}
```

The other routes of 5.1, on a customer's host:

- **`GET /api/auth/tenants`** answers `onlyHostCustomer(tenants, host)`; when that is empty, 403
  `NOT_A_MEMBER` with `notMemberOfHost(name)`.
- **`POST /api/auth/tenant`** first lists the person's tenants and refuses, with 403 `NOT_A_MEMBER`,
  an id that is not in `onlyHostCustomer(tenants, host)`. Only then does it switch, and the Engine
  checks the id again.
- **`DELETE /api/auth/tenants/[id]`** forwards only the host's customer id. Any other id gets 404.
- **The current customer** (5.3) is read from `onlyHostCustomer(tenants, host)`. A session bound to
  another customer has no current customer on this host, so data routes refuse it as an unbound
  session (403), and the layout sends it to the chooser, which offers only the host's customer. When
  the person's list lacks the host's customer, the layout shows `notMemberOfHost(name)` with "Sign in
  again", without signing out. The "Switch customer" menu offers nothing on a customer's host.

The catch-all proxy keeps refusing the Engine's `auth/*` and `tenants*` paths: the tenant still
comes only through these routes.

### 14.4 Origins and redirects

The CLI's `lib/origin.ts` builds every redirect from `publicOrigin(request)`: the configured
`NEXT_PUBLIC_HOST_ORIGIN` first, then the forwarded host. Put the customer's host in front, rebuilt
from the checked name, so a redirect returns to the host the request came to:

```ts
// lib/origin.ts: the first lines of publicOrigin(request), and the helper.
export function customerOrigin(request: Pick<Request, "headers" | "url">): string | null {
  const host = requestHost(request.headers);
  if (resolveHostCustomer(host).kind !== "customer") return null;
  const name = hostnameOf(host)!;
  if (name.endsWith(".localhost")) return new URL(`${new URL(request.url).protocol}//${host}`).origin; // development
  return `https://${name}`; // never the header's own text, never a port
}

export function publicOrigin(request: Pick<Request, "headers" | "url">): string {
  const customer = customerOrigin(request);
  if (customer) return customer;
  // ... the CLI's body: NEXT_PUBLIC_HOST_ORIGIN, then the forwarded host, then the request's origin.
}
```

`NEXT_PUBLIC_HOST_ORIGIN` stays the bare host's origin. A host that matches the pattern but not the
map, or a lookalike such as `evil-lms.apps.buildpad.ai`, `acme.lms.apps.buildpad.ai.evil.com` or
`a.acme.lms.apps.buildpad.ai`, is never a redirect target: `publicOrigin` uses the configured
origin for it. Where the application checks a POST's `Origin` header against its own (for example
the consent POST of the `add-mcp-server` skill), compare it with the request's `customerOrigin()`
on a customer's host, and with the configured origin anywhere else. Send the consent page's redirect
to that same origin, and on a customer's host let the consent bind only the host's customer.

### 14.5 Development and tests

- In development `<slug>.localhost:3000` stands for the customer's host. Browsers resolve every
  `*.localhost` name to the loopback address. Add `allowedDevOrigins: ["*.localhost"]` to
  `next.config.ts` so the dev server serves those origins.
- Unit tests: the matcher refuses `evil-<domain>`, `<slug>.<domain>.evil.com`, two labels,
  `http://`, a port, a path and a trailing dot. A mapped slug gives `customer`, an unmapped one
  `unknown`, and any other host `bare`. On a customer's host, the sign-in enters a member who has
  several customers without a chooser. It refuses a non-member with 403 and no sign-out. The list,
  the switch and the decline refuse other ids. The middleware answers 404 for an unknown
  subdomain.
- Playwright: from Node, name the host with an `x-forwarded-host` header, because Node's resolver
  may not resolve `*.localhost`. From the browser, open `http://<slug>.localhost:<port>`. Tests that
  sign in reach the Engine, so ask the developer first.

### 14.6 Adding a customer host

When the Platform creates a customer, add its `slug`, `id` and `name` from `get_project_detail` to
`config/customer-hosts.ts` and deploy. Until then its subdomain answers 404. No environment variable
changes, and the application keeps no list of redirect URLs for its own hosts. After the first
deploy, open `https://<slug>.<customer domain>` and sign in as a member: no chooser should appear. If
it does, the hosting is not passing the customer's host name to the application (section 11).
