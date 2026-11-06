---
name: App Code (Engine project)
description: Porting a Next.js app from a Supabase project to the Buildpad Engine, step by step with before-and-after code — environment, password sign-in through a server route, data calls with a Bearer token, files, administrator code, schema and access rules, database functions.
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

# App Code (Engine project)

The details behind the checklist in this skill's [SKILL.md](../SKILL.md), in the same order. Each
step names the skill that holds the full templates; copy from there rather than from memory.

On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

## 1. Environment

```bash
# .env.example — the new starter kit's .env.local holds the real values
NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>
NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key
NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>
```

Remove the service-role key variable from every environment file, from the deployment's settings
and from CI, and remove every line of code that reads it. `BUILDPAD_DAAS_URL`, where the app sets
it, is the Engine_URL too. A variable that held the old project's Supabase address under another
name is removed or set to the Engine_URL.

## 2. Sign-in

Before: the browser signed in straight through the Supabase client, and the app had sign-up,
magic-link, password-reset and OAuth pages and an auth callback route.

After: the browser posts to the app's own login route, which signs in against the Engine and names
the tenant. Copy the login, logout and current-user routes from
[create-api-route](../../create-api-route/SKILL.md) (its Engine API routes reference, "Sign-in
Routes"). The heart of the login route:

```typescript
// app/api/auth/login/route.ts (excerpt): the server client names the tenant
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, // the Engine_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: { headers: { "X-Tenant-Id": process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID! } },
    cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
  },
);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
// The Supabase client sends this to <Engine_URL>/auth/v1/token?grant_type=password
```

```typescript
// The login form posts to the route; it never calls the Engine itself
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

Remove:

- the sign-up page and route: an administrator creates users (step 4);
- magic-link and one-time-code sign-in, and the auth callback route;
- the forgotten-password and reset-password pages: an administrator resets a password in the
  Studio's Users module;
- the change-password, change-email and profile forms that called the Supabase client;
- every OAuth button. Keep XAppHub sign-in only, with the Engine variant of
  [add-external-oauth](../../add-external-oauth/SKILL.md).

Keep the session refresh in the middleware and the sign-out: both work through the Supabase client.
Sign-out ends the user's sessions on every device. An account that holds no role in the project's
tenant is refused at sign-in: the move lists those accounts, and an administrator gives each a role.
Users keep their passwords; tell the developer which pages were removed.

## 3. Data calls

Before: the app read tables through the Supabase client, a PostgREST address, or a DaaS path without
`/api`, and some calls sent cookies.

After: every call goes to a path under `<Engine_URL>/api` with the user's access token, from a
forwarding route or the Buildpad SDK.

```typescript
// app/api/items/[collection]/route.ts: the forwarder from create-api-route
import { type NextRequest } from "next/server";
import { forwardToEngine } from "@/lib/api/forward";

type RouteParams = { params: Promise<{ collection: string }> };

async function forward(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  return forwardToEngine(request, `/api/items/${encodeURIComponent(collection)}`);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
```

```typescript
// A server component or route that reads directly
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

const filter = encodeURIComponent(JSON.stringify({ status: { _eq: "published" } }));
const res = await fetch(`${getDaasUrl()}/api/items/articles?filter=${filter}&sort=-date_created&limit=20`, {
  headers: await getAuthHeaders(), // Authorization: Bearer <access token>
  cache: "no-store",
});
const { data: articles } = await res.json();
```

| Supabase client | Engine items API |
|---|---|
| `from('t').select('a,b')` | `GET /api/items/t?fields=a,b` |
| `.eq('status', 'x')`, `.in('id', ids)` | `filter={"status":{"_eq":"x"}}`, `filter={"id":{"_in":[...]}}` |
| `.order('date', { ascending: false })`, `.range(0, 19)` | `sort=-date`, `limit=20&offset=0` |
| `.insert(row)` | `POST /api/items/t` with the row |
| `.update(data).eq('id', id)` | `PATCH /api/items/t/:id` |
| `.delete().eq('id', id)` | `DELETE /api/items/t/:id` (answers 204) |
| `count: 'exact'` | The `meta` of a list answer (`filter_count`, `total_count`), or `aggregate[count]=id` |

The Engine answers `{ data }` (and `meta` for a list) or `{ errors: [...] }`. It serves at most 1000
items a request. Remove `credentials: 'include'` from every data call, and send no `X-Tenant-Id`
after sign-in: a request with a session takes its tenant from the session. A scoped collection takes
`X-Resource-Uri` (see [manage-scope](../../manage-scope/SKILL.md)). A static token on a user record
is not a credential the data API accepts.

## 4. Administrator code

Before: server code built a Supabase client with the service-role key to create users, read every
row or bypass the access rules.

After, by task:

| Task | On the Engine |
|---|---|
| Create a user, give a role | An administrator, in the Studio's Users module, or `POST /api/users` then `POST /api/users/:id/roles` from a server route with a signed-in administrator's token ([add-users](../../add-users/SKILL.md)) |
| Reset a password | An administrator, in the Studio's Users module |
| Read or write rows the user may not | A permission that allows it ([create-rbac](../../create-rbac/SKILL.md)), or a hook or custom service with `{ elevated: true }` ([hooks-extensions](../../hooks-extensions/SKILL.md)) |
| A nightly job over all rows | A cron job: it runs as the Engine's system account ([create-cron](../../create-cron/SKILL.md)) |
| Check a module access key | `GET <Engine_URL>/api/permissions/me` with the user's token; read `isAdmin` and `moduleAccess` ([grant-module-access](../../grant-module-access/SKILL.md)) |

Never put the token from the project's MCP configuration, or any other administrator token, in the
app. Delete the server file that built the service-role client once nothing imports it.

## 5. Files

Before: uploads and downloads went through `supabase.storage` (bucket `upload`, `download`,
`getPublicUrl`, `createSignedUrl`, `remove`), and pages linked to `/storage/v1` addresses.

After: files go through the Engine's file routes, and a page shows a file through a signed URL.
The Files module and its routes are in [add-files](../../add-files/SKILL.md); the signed-URL route is
in [create-api-route](../../create-api-route/SKILL.md).

```typescript
// Upload: the browser posts multipart to the app's forwarder, which sends it to POST /api/files
const form = new FormData();
form.append("file", file);
const res = await fetch("/api/files", { method: "POST", body: form });
const { data: stored } = await res.json(); // stored.id is the file id to save on the record
```

```typescript
// Show: the server asks for a signed URL, the page puts it in <img src>
const res = await fetch(`/api/files/signed-url?id=${fileId}&expires=3600`);
const { data } = await res.json();
// <img src={data.url} />; add &width=400&height=300&fit=cover&format=auto for a thumbnail
```

- The move kept every file's id: a record field that holds a file id still works. Code that named
  a file by bucket and path finds its id through `GET /api/files` with a `filter` (on
  `filename_download`, `folder` or `title`), then stores the id.
- Image parameters on `/api/files/assets/:id` and on signed URLs: `width`, `height`, `fit`
  (`cover`, `contain`, `inside`, `outside`), `quality`, `format` (`auto`, `jpg`, `png`, `webp`,
  `avif`, `tiff`), `withoutEnlargement`, or a preset `key`. A request for WebP or AVIF can be
  answered as JPEG or PNG.
- Never put `/api/files/assets/:id` without its token in a page: the browser sends no
  `Authorization` header, and the Engine answers 401.
- If the app kept objects in a bucket outside the project's file library, ask the developer whether
  the move carried them.

## 6. Schema and access

Delete the Supabase migrations folder (`supabase/migrations`) and the rest of the `supabase` folder
once step 7 has ported what it held. From now on the schema changes in the Studio or over MCP
([create-collection](../../create-collection/SKILL.md)); an Engine project has no database migrations
([create-migration](../../create-migration/SKILL.md) says so).

Each row-level security policy in those SQL files becomes a permission. Before deleting the files,
read each policy and check that a moved permission gives the same rows:

| Policy in SQL (in words) | Permission on the Engine |
|---|---|
| A user reads the rows whose owner column is their own id | `read` with filter `{ "user_created": { "_eq": "$CURRENT_USER" } }` (or the owner field the collection has) |
| Anyone signed in reads published rows | `read` with filter `{ "status": { "_eq": "published" } }` on the role's policy |
| Only a role's members write | `create` and `update` on that role's policy only |
| A user sees the rows of their organisation | A scope ([manage-scope](../../manage-scope/SKILL.md)), or a filter on `$CURRENT_USER.<field>` |

Add what is missing with [create-rbac](../../create-rbac/SKILL.md). Then go through "Permission rules
that change meaning" in this skill's [SKILL.md](../SKILL.md).

### What the app scan does not catch

- **Scope ids and URIs.** The move gives every scope item a new id, and each `uri_path` is nested
  under the project's own scope item: `/<project type id>:<tenant id>/<region type id>:<region id>`,
  where the old project had `/<type>:<id>`. App code that hard-codes a scope URI or a region id is
  answered 403 `FORBIDDEN_SCOPE` ("outside this tenant"). Read the items (`daas_scope_items`,
  through the MCP `scope` tool or `GET /api/scope/items`) and update every constant, seed and
  environment value that holds one.
- **Role ids.** A role can get a new id (on one moved project the "Management" role did). Find each
  role by its name (the MCP `roles` tool or `GET /api/roles`) and update the ids the code holds.
- **Custom user fields.** Fields the app added to `daas_users` (such as `crm_region_uri` or
  `crm_is_management`) are not moved. Create them again with the MCP `fields` tool, and set a
  default through `POST /api/fields/daas_users`. A boolean field with a default cannot be added as
  not-null to a table that has rows: create it nullable, with the default.

## 7. Database functions, triggers, views and edge functions

None of them moved. Port each one, then delete it from the repository:

| Was | Becomes |
|---|---|
| A function the app calls through the Supabase client's `rpc` method | An API route that makes the items calls ([create-api-route](../../create-api-route/SKILL.md)); the page calls the route |
| A trigger that fills or checks a column | A filter hook; a trigger that writes elsewhere after a change becomes an action hook ([hooks-extensions](../../hooks-extensions/SKILL.md)) |
| Logic shared by several hooks and jobs | A custom service ([create-service](../../create-service/SKILL.md)) |
| A view | A read with `fields` and a filter, or an API route that combines reads |
| An edge function | An API route; a scheduled one becomes a cron job ([create-cron](../../create-cron/SKILL.md)) |
| A column default that is not a literal, a current time or a new UUID | Set in the Studio, or by a filter hook |

```typescript
// Before (in words): the page called the database function "close_order" through the client's rpc method.
// After: app/api/orders/[id]/close/route.ts makes the same writes with the user's token
import { type NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${getDaasUrl()}/api/items/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() }),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
```

A function that changed several collections at once in one transaction loses that guarantee
through several calls: tell the developer, and keep the writes in an order that is safe to repeat.

## 8. Cross-origin settings

Remove any code or deployment step that set the data service's cross-origin settings. Nothing
replaces it.

## 9. Tests, workers, mobile and deployment

- Tests sign in as users an administrator created, with the environment of step 1; a pipeline
  needs only the test administrator's email and password ([create-tests](../../create-tests/SKILL.md)).
- A runtime worker: see [worker-messaging](../../worker-messaging/SKILL.md) for an Engine project.
- A mobile wrapper loads the deployed app: point it at the new address and rebuild
  ([add-mobile-app](../../add-mobile-app/SKILL.md)).
- The app moves as a microapp of the new project. Set its environment as in step 1.

## 10. Verify

1. Run the migration tool's app scan again: it reports nothing.
2. Search the code for anything the scan does not cover: other names of the old Supabase address,
   calls on `supabase.storage`, the Supabase client's `rpc` method, and imports of the deleted
   service-role client.
3. Run the build, the lint and the tests (`pnpm build`, `pnpm lint`, `pnpm test`, or the project's
   own scripts), and fix what fails.
4. Sign in as a moved user with their old password; read and write a record of each collection the
   app uses; upload and show a file.
5. Report to the developer: what changed, what was removed (with what replaces it), the keys and
   hosts to ask the Engine's operator for, and the items to switch on at cut-over.
