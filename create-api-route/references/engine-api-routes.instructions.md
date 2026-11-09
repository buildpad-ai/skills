---
name: Engine API Routes
description: Route templates for an Engine project — forwarders that send the signed-in user's access token to the Engine and pass its answer back (items, workflow transition, users me, files and signed URLs, permissions, versions), the sign-in routes, and local utilities.
applyTo: "app/api/**/*.ts"
---

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

# Engine API Route Instructions

## Overview

On an Engine project every data route of the application is a **forwarder**:

- It reads the signed-in user's access token from the session and sends it as `Authorization: Bearer <access token>`.
- It sends the request to the same path under `<Engine_URL>/api/...`, with the query string and the body as received, and with `X-Resource-Uri` when the caller sent one.
- It passes the Engine's status and body back unchanged: `{ data: ... }`, `{ errors: [{ message, extensions: { code } }] }`, or 204 with no body.
- It checks no permission and builds no query of its own. The Engine checks the user's roles, policies, permissions and scope on every request, and a route that repeats those checks can only disagree with them.

On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes of the `external-oauth` module, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`. For XAppHub sign-in the CLI installs the `external-oauth-engine` module in place of `external-oauth`; its routes are used as the `add-external-oauth` skill says.

**Important — Amplify's ~30s limit applies to every route here.** Amplify Hosting runs API routes as Lambda functions: a slow buffered response gets a clean 504 around 28s, and a streamed response does not reach the browser before that either. If a route calls something slow or needs to stream progressively, do not build it as a single request/response call: have the client call it repeatedly within a time budget until the work reports done, or offload it to a worker (see the `worker-messaging` skill).

## Helpers

### `lib/api/auth-headers.ts`

The Buildpad CLI installs this file. `getAuthHeaders()` reads the signed-in user's session through the Supabase server client and returns `{ "Content-Type": "application/json", Authorization: "Bearer <access token>" }`; with no session it returns no `Authorization`, and the Engine answers 401. `getDaasUrl()` returns `BUILDPAD_DAAS_URL`, or else `NEXT_PUBLIC_BUILDPAD_DAAS_URL`, without a trailing slash. On an Engine project both must hold the Engine_URL; set `BUILDPAD_DAAS_URL` to nothing else.

### `lib/api/forward.ts`

Every forwarder in this file uses this helper:

```typescript
// lib/api/forward.ts
import { type NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

/**
 * Sends one request on to `enginePath` on the Engine with the signed-in user's
 * access token, and passes the Engine's status and body back unchanged.
 * `jsonBody`, when given, replaces the request body (sent as JSON).
 */
export async function forwardToEngine(
  request: NextRequest,
  enginePath: string,
  jsonBody?: string,
): Promise<NextResponse> {
  try {
    const headers = await getAuthHeaders();
    const resourceUri = request.headers.get("x-resource-uri");
    if (resourceUri) headers["X-Resource-Uri"] = resourceUri;

    const method = request.method;
    let body: BodyInit | undefined;
    if (method !== "GET" && method !== "HEAD") {
      if (jsonBody !== undefined) {
        body = jsonBody;
      } else {
        // Forward the body as received: multipart keeps its boundary.
        const contentType = request.headers.get("content-type");
        if (contentType) headers["Content-Type"] = contentType;
        const raw = await request.arrayBuffer();
        if (raw.byteLength > 0) body = raw;
      }
    }
    if (!body) delete headers["Content-Type"];

    const query = request.nextUrl.searchParams.toString();
    const response = await fetch(
      `${getDaasUrl()}${enginePath}${query ? `?${query}` : ""}`,
      { method, headers, body, cache: "no-store" },
    );

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Engine could not be reached";
    return NextResponse.json({ errors: [{ message }] }, { status: 502 });
  }
}
```

In the mode `customer-tenants` the Engine also gives the answers below. The forwarder passes them back unchanged, as it passes every answer; the application shows each as the table says, and retries only the 503:

| Engine answer | Cause | What the app shows | Retry |
|---|---|---|---|
| 401 `TENANT_SUSPENDED` | A Platform member suspended this customer | "Access to <customer> is suspended. Ask your administrator." Then sign out | No |
| 401 `TOKEN_INVALID` | The session ended, or this customer was deleted | "Your session has ended. Sign in again." Then the sign-in page | No |
| 503 `SERVICE_UNAVAILABLE` | The customer is not serving for a moment (being migrated or behind the Engine's version during an Engine upgrade, or failed), or the Engine's session store is unavailable | "<customer> is being updated. Try again in a minute." | Yes: up to 3 times, after 2, 5 and 10 seconds |
| 403 `FORBIDDEN`, "This token is not bound to a tenant. Switch to a tenant first." | The session was never switched | The chooser (`settleTenant`, under Sign-in Routes) | After the switch |
| 403 `TENANT_SUSPENDED` from the switch | The chosen customer is suspended | As 401 `TENANT_SUSPENDED`, staying on the chooser | No |
| 403 `FORBIDDEN` from the switch | The person holds no place in that tenant | "You are not a member of that customer." | No |
| 401 `USER_SUSPENDED` from the switch | The person's account is not active | "Your account is not active. Ask your administrator." Then sign out | No |

## Sign-in Routes

On an Engine project the Supabase client is kept for sign-in only. Password sign-in, session refresh, reading the signed-in user and sign-out work through it, and its default sign-out ends the user's sessions on every device. An account that holds no role in the project's tenant is refused at password sign-in. XAppHub sign-in also works through it while the project's XAppHub connector is connected: the application's server gives the ID token from XAppHub to `signInWithIdToken` with the provider `my-apps`, and ends the session of an account that holds no role yet (the `add-external-oauth` skill). Not available on an Engine project: sign-up; OAuth sign-in with any provider other than XAppHub; magic link and one-time code; password recovery; changing a password, an email or a profile through the Supabase client; the Supabase client's code exchange; and the Supabase administration API. The Platform's password-less handoff opens the Studio; it is not a way for an application to sign a user in.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

On an Engine project with Customer_Tenants a public page of one customer is not available: a request without a session acts in the tenant `X-Tenant-Id` names, and nothing maps a host name to a customer yet. A page without a session reads the Blueprint only, through `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. Tell the developer so and stop: do not put a customer's tenant id in the application or let a visitor choose it.

On an Engine project the data API serves no request without a session; only the sign-in, `GET /api/server/info` and the Engine's password routes are served without one (an application must not use them: on an Engine project an administrator resets a user's password). The requests that take their tenant from the header `X-Tenant-Id` are the password sign-in, XAppHub sign-in and anonymous reads of public files. A browser can send `X-Tenant-Id` to the Engine from another origin, without cookies or credentials: the Engine allows that header from any origin and allows no credentialed cross-origin request. Even so, the request that names the tenant is the sign-in made through the application's own server route, which sends `X-Tenant-Id` with the value of `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A public file shown in a browser is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read. A request without a session that names no tenant is served from the Engine's host plane, not from the project. A request with a session takes its tenant from the session.

### Login — `app/api/auth/login/route.ts`

The login route builds its own Supabase server client that sends `X-Tenant-Id` on every request it makes:

```typescript
// app/api/auth/login/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json(
      { errors: [{ message: "Email and password are required" }] },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // the Engine_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { "X-Tenant-Id": process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID! },
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // A wrong password, an unknown address and an account with no role in the
    // project's tenant are all refused here.
    return NextResponse.json({ errors: [{ message: error.message }] }, { status: 401 });
  }

  return NextResponse.json({ data: { user: data.user } });
}
```

### In the mode `customer-tenants`

On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session.

The Buildpad CLI's generated sign-in route and the SDK do not know this mode yet: the generated login route sends `X-Tenant-Id` and has no switch. In the mode `customer-tenants`, replace the login route with the one below and add the three routes after it; a later release of the skills names the SDK's functions instead.

`lib/auth/tenants.ts` holds the Engine calls the four routes share. Run `settleTenant` after every sign-in, and in the layout when a signed-in request finds no current customer (a refresh of a session bound to no tenant stays bound to none):

```typescript
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

The login route sends no `X-Tenant-Id`, then settles the session's tenant. It answers `{ data: { tenant } }` when the session is bound to a customer, `{ data: { choose: [...] } }` when the person chooses, and 403 when the account belongs to no customer:

```typescript
// app/api/auth/login/route.ts — in the mode customer-tenants
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { settleTenant } from "@/lib/auth/tenants";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json(
      { errors: [{ message: "Email and password are required" }] },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  // No X-Tenant-Id header: the sign-in names no tenant.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // the Engine_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json(
      { errors: [{ message: error?.message ?? "Sign-in failed" }] },
      { status: 401 },
    );
  }

  const settled = await settleTenant(supabase, data.session.access_token);
  if ("error" in settled) {
    return NextResponse.json(
      { errors: [{ message: "Your account does not belong to any customer of this application" }] },
      { status: 403 },
    );
  }
  return NextResponse.json({ data: settled });
}
```

The three routes after it list the person's tenants, switch, and decline an invitation not yet entered. Each reads the access token from the session, and passes an Engine answer that is not a success back with its status and code:

```typescript
// app/api/auth/tenants/route.ts — in the mode customer-tenants
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/auth/tenants";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ errors: [{ message: "Unauthorized" }] }, { status: 401 });
  }
  try {
    const blueprint = process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID; // the application's own tenant
    const tenants = await listTenants(session.access_token);
    return NextResponse.json({
      data: tenants.map((t) => ({ ...t, blueprint: t.id === blueprint })),
    });
  } catch (e) {
    const { message, status = 502, code } = e as Error & { status?: number; code?: string };
    return NextResponse.json({ errors: [{ message, extensions: { code } }] }, { status });
  }
}

// app/api/auth/tenant/route.ts — in the mode customer-tenants
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTenants, switchTenant } from "@/lib/auth/tenants";

export async function POST(request: NextRequest) {
  const { tenant } = await request.json(); // the one tenant id taken from the request: the Engine checks it
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ errors: [{ message: "Unauthorized" }] }, { status: 401 });
  }
  try {
    const pair = await switchTenant(session.access_token, tenant);
    // From here on the old access token is never sent again. Do not sign the old pair out:
    // the default sign-out ends every session of the person, the new one included.
    await supabase.auth.setSession({
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
    });
    const current = (await listTenants(pair.access_token)).find((t) => t.current);
    return NextResponse.json({ data: { tenant: current } }); // the browser then reloads the page
  } catch (e) {
    const { message, status = 502, code } = e as Error & { status?: number; code?: string };
    return NextResponse.json({ errors: [{ message, extensions: { code } }] }, { status });
  }
}

// app/api/auth/tenants/[id]/route.ts — in the mode customer-tenants
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

// Declines an invitation not yet entered: 204, or the Engine's 409 or 404.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/auth/tenants/${encodeURIComponent(id)}`);
}
```

After the switch answers, the browser reloads the whole page (`window.location.assign("/")`), so every client cache, `DaaSProvider` and any `ScopeProvider` start in the new customer. The `add-multitenancy` skill's guide `engine-customer-tenants` gives the chooser, the current customer and the switch menu.

### Logout and current user

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut(); // ends the user's sessions on every device
  return NextResponse.json({ data: { success: true } });
}

// app/api/auth/user/route.ts
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ errors: [{ message: "Unauthorized" }] }, { status: 401 });
  }
  return NextResponse.json({ data: user });
}
```

These templates need no `app/api/auth/callback/route.ts` and no OAuth provider route: the Supabase client's code exchange is not available on an Engine project, and OAuth sign-in is available only with XAppHub, whose callback and provider routes the CLI's `external-oauth-engine` module writes (see the `add-external-oauth` skill). An administrator creates every user who signs in with a password (see the `add-users` skill); a user's first XAppHub sign-in creates an account without a role.

## Items

### Collection route — `app/api/items/[collection]/route.ts`

```typescript
// app/api/items/[collection]/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

type RouteParams = { params: Promise<{ collection: string }> };

async function forward(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  return forwardToEngine(request, `/api/items/${encodeURIComponent(collection)}`);
}

export const GET = forward; // list
export const POST = forward; // create one, or several from an array
export const PATCH = forward; // update several
export const DELETE = forward; // delete several
```

### Single item route — `app/api/items/[collection]/[id]/route.ts`

```typescript
// app/api/items/[collection]/[id]/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

type RouteParams = { params: Promise<{ collection: string; id: string }> };

async function forward(request: NextRequest, { params }: RouteParams) {
  const { collection, id } = await params;
  return forwardToEngine(
    request,
    `/api/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
  );
}

export const GET = forward;
export const PATCH = forward;
export const DELETE = forward;
```

### `X-Resource-Uri`

A collection that is scoped is read and written at the scope named by the header `X-Resource-Uri` (see the `manage-scope` skill). The browser sends the header to the application's route, and `forwardToEngine()` sends it on. Do not drop it, and do not set it in the route from anything but the caller's request. A scoped collection reached without the header answers 403 `MISSING_SCOPE` to a user who does not reach every scope.

### Answers

| Request | Engine answer |
|---|---|
| `GET` list | 200 `{ data: [...], meta }` (`meta` holds the counts and the page) |
| `GET` one | 200 `{ data: {...} }`; 404 `NOT_FOUND` when the item does not exist |
| `POST` | 200 `{ data }` |
| `PATCH` | 200 `{ data }`; 404 `NOT_FOUND` |
| `DELETE` one | 204 with no body; 404 `NOT_FOUND` |
| `DELETE` several | 200 with a body |
| No session | 401 `UNAUTHENTICATED`; `TOKEN_EXPIRED` or `TOKEN_INVALID` means sign in again |
| No permission | 403 `FORBIDDEN` |

Query parameters pass through untouched: `fields`, `filter`, `search`, `sort`, `limit`, `offset`, `page`, `aggregate`, `groupBy`. The Engine serves at most 1000 items per request, and `limit=-1` is served as 1000: page through larger sets with `page` or `offset`. A field name the collection does not have answers 400.

## Workflow Transition

Required endpoint for the `WorkflowButton` component. The Engine runs the whole transition: it finds the command in the instance's current state, checks the command's gate at the scope the request names, moves the instance, records one history row, and writes the new state back to the item. The route only forwards.

```typescript
// app/api/workflow/transition/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

// Body: { workflowInstanceId, commandName }. The Engine ignores any other key.
export async function POST(request: NextRequest) {
  return forwardToEngine(request, "/api/workflow/transition");
}
```

The Engine answers 200 with `{ message }` when the transition ran; 400 for a command that is not available in the current state; 403 when the user may not run it; 404 when the instance does not exist. Instance state changes only through this route: never write a workflow instance as an item.

## Users Me

```typescript
// app/api/users/me/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

// GET supports ?fields= as /api/users/:id does.
export async function GET(request: NextRequest) {
  return forwardToEngine(request, "/api/users/me");
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  // Send no password change from the application: on an Engine project an
  // administrator resets a user's password, in the Studio's Users module.
  delete body.password;
  delete body.current_password;
  return forwardToEngine(request, "/api/users/me", JSON.stringify(body));
}
```

The Engine decides what a user may change on their own record. It writes `first_name`, `last_name`, `avatar`, `location`, `title`, `description`, `language`, `theme`, `tags` and `last_page`, and drops any other unknown key. It answers 403, and stores nothing, for a body that names `status`, `email`, `token` or another restricted field, and 400 for a body with nothing it can write.

## Files

On an Engine project files are stored and served by the Engine: `/api/files`, `/api/folders`, `/api/files/signed-url`, and file content at `/api/files/assets/:id` (with a session or a signed token). A file shown in a browser, a public one included, is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read: an `<img>` element or a link sends no `X-Tenant-Id`. Set no storage bucket option: the Engine stores files on its own disk or in S3.

### Upload and list — `app/api/files/route.ts`

```typescript
// app/api/files/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

// GET lists file records. POST forwards the body untouched: multipart/form-data
// with a `file` part (plus optional `title`, `description`, `folder`), or JSON
// `{ upload_token, filename_download, ... }` to register a direct upload.
export async function GET(request: NextRequest) {
  return forwardToEngine(request, "/api/files");
}

export async function POST(request: NextRequest) {
  return forwardToEngine(request, "/api/files");
}
```

The Engine checks the user's permission on `daas_files` and refuses a body larger than its upload limit. Do not parse a multipart body in the route.

### Signed URLs — `app/api/files/signed-url/route.ts`

```typescript
// app/api/files/signed-url/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";
import { getDaasUrl } from "@/lib/api/auth-headers";

// GET ?id=<file id>&expires=<seconds>: a URL that shows the file without a session.
export async function GET(request: NextRequest) {
  const response = await forwardToEngine(request, "/api/files/signed-url");
  if (!response.ok) return response;
  const { data } = await response.json();
  // On the Engine's own disk the URL is a path on the Engine; on S3 it is a full address.
  const url = data.url.startsWith("/") ? `${getDaasUrl()}${data.url}` : data.url;
  return NextResponse.json({ data: { ...data, url } });
}

// POST { filename_download, type, filesize, folder? }: start a direct upload.
// DELETE { upload_token }: discard a direct upload that was not registered.
export async function POST(request: NextRequest) {
  return forwardToEngine(request, "/api/files/signed-url");
}

export async function DELETE(request: NextRequest) {
  return forwardToEngine(request, "/api/files/signed-url");
}
```

- **Showing a file.** `GET` needs read permission on `daas_files` and answers `{ data: { url, expires_at } }`. `expires` is in seconds: 3600 when absent, at most seven days. Put the returned URL in `<img src>` or a link; it works without a session until it expires.
- **Direct upload.** `POST` needs create permission on `daas_files` and answers 201 `{ data: { uploadUrl, uploadToken, primaryKey, ... } }`. The browser sends the bytes with `PUT uploadUrl` (the token in the URL is its authority), then registers the file with `POST /api/files` and the JSON body `{ upload_token, filename_download }`. If either step fails, `DELETE` with `{ upload_token }` answers 204 and removes the object.
- File content is at `/api/files/assets/:id`. A route that forwards to `/api/assets/:id`, as the CLI's generated assets route does, reaches nothing on the Engine: show files through a signed URL instead.

## Permissions

```typescript
// app/api/permissions/me/route.ts
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

export async function GET(request: NextRequest) {
  return forwardToEngine(request, "/api/permissions/me");
}
```

The Engine answers `{ data, isAdmin, moduleAccess, meta }`: `data` holds the user's permissions by collection and action, `isAdmin` is true for an administrator, and `moduleAccess` maps each module access key to true or false. Buildpad components read this route to show or hide actions.

A server route that must refuse a user without a module access key asks the Engine the same way:

```typescript
// lib/api/module-access.ts
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

/** True when the signed-in user is an administrator or holds the key. */
export async function hasModuleAccess(key: string): Promise<boolean> {
  const response = await fetch(`${getDaasUrl()}/api/permissions/me`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const { isAdmin, moduleAccess } = await response.json();
  return isAdmin === true || moduleAccess?.[key] === true;
}
```

The key check only decides what the route does next; every data call the route then makes still goes through `forwardToEngine()` with the user's token, and the Engine still checks it.

## Versions

A version holds unsaved changes (`delta`) to one item. Every version route forwards:

```typescript
// app/api/versions/route.ts — GET lists versions, POST creates one
// Body of POST: { collection, item, key, name?, delta? }
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

export async function GET(request: NextRequest) {
  return forwardToEngine(request, "/api/versions");
}
export async function POST(request: NextRequest) {
  return forwardToEngine(request, "/api/versions");
}

// app/api/versions/[id]/route.ts — GET reads one, PATCH renames, DELETE removes
type RouteParams = { params: Promise<{ id: string }> };

async function forwardOne(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return forwardToEngine(request, `/api/versions/${encodeURIComponent(id)}`);
}
export const GET = forwardOne;
export const PATCH = forwardOne;
export const DELETE = forwardOne;

// app/api/versions/[id]/save/route.ts — merge the changed fields into the delta
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return forwardToEngine(request, `/api/versions/${encodeURIComponent(id)}/save`);
}

// app/api/versions/[id]/promote/route.ts — apply the delta to the item
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return forwardToEngine(request, `/api/versions/${encodeURIComponent(id)}/promote`);
}
```

The Engine checks the user's permission on the version's collection for each of these: read to list and read; update and create to create; update to rename, save and promote; delete to remove. Save takes a JSON object of field values (an empty one answers 400); promote writes the delta to the item and answers 200.

## Local Utilities

These routes compute a value in the application and call nothing on the Engine:

```typescript
// app/api/utils/hash/generate/route.ts
import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { string } = await request.json();

  if (!string) {
    return NextResponse.json(
      {
        errors: [
          {
            message: '"string" is required',
            extensions: { code: "INVALID_PAYLOAD" },
          },
        ],
      },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(string, 10);
  return NextResponse.json({ data: hash });
}

// app/api/utils/hash/verify/route.ts
export async function POST(request: NextRequest) {
  const { string, hash } = await request.json();

  if (!string || !hash) {
    return NextResponse.json(
      {
        errors: [{ message: '"string" and "hash" are required' }],
      },
      { status: 400 },
    );
  }

  const isValid = await bcrypt.compare(string, hash);
  return NextResponse.json({ data: isValid });
}

// app/api/utils/random/string/route.ts
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const length = parseInt(searchParams.get("length") || "32");

  if (length < 1 || length > 500) {
    return NextResponse.json(
      {
        errors: [{ message: '"length" must be between 1 and 500' }],
      },
      { status: 400 },
    );
  }

  const randomString = nanoid(length);
  return NextResponse.json({ data: randomString });
}
```

## Best Practices

1. **Forward, do not re-implement**: every data route calls `forwardToEngine()`; none builds a query or checks a permission itself
2. **Pass the Engine's answer through**: its status, its `{ errors: [...] }`, and 204 with no body
3. **Send the user's own token**: `getAuthHeaders()` only; never the MCP token or another administrator token
4. **Keep `X-Resource-Uri`** on every request to a scoped collection
5. **Validate input** with Zod where a route accepts input of its own
6. **Name the tenant only at sign-in**: the login route sends `X-Tenant-Id`; every other request takes its tenant from the session
7. **Show files through signed URLs**, never through an anonymous read
