---
name: Client patterns (Engine project)
description: Next.js route handlers for conditional PATCH, optimistic locking and transactional checkouts on a Buildpad Engine project, with error handling, retries and a concurrency verification recipe.
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

# Client patterns

On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

Make the call from a server route handler, never from the browser with a token in client code.
If the app instead acts as one least-privilege service user with a static token kept in a server
environment variable, that token must be a **data** token (`token_kind` `"data"`): a token of kind
`mcp` is refused on data routes. It must never belong to an administrator. Never commit it.

## A small server helper

```ts
// lib/daas.ts
import 'server-only';

const BASE = (process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? '').replace(/\/$/, '');

export type DaasResult = { status: number; code?: string; message?: string; data?: any };

export async function daas(path: string, token: string, init: RequestInit = {}): Promise<DaasResult> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  const err = body?.errors?.[0];
  return { status: res.status, code: err?.extensions?.code, message: err?.message, data: body?.data };
}
```

Errors come back as `{ "errors": [{ "message": "...", "extensions": { "code": "..." } }] }`;
switch on `extensions.code`, not on the message.

## Claim one unit (conditional PATCH)

```ts
// app/api/products/[id]/claim/route.ts
import { daas } from '@/lib/daas';
import { getAccessToken } from '@/lib/auth'; // the app's own way to read the signed-in user's token

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'Sign in first' }, { status: 401 });

  const condition = encodeURIComponent(JSON.stringify({ stock: { _gte: 1 } }));
  const r = await daas(`/api/items/products/${encodeURIComponent(id)}?condition=${condition}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ stock: { _dec: 1 } }),
  });

  if (r.status === 200) return Response.json({ ok: true, product: r.data });
  if (r.status === 409 && r.code === 'CONDITION_NOT_MET') return Response.json({ error: 'Sold out' }, { status: 409 });
  if (r.status === 404) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ error: r.message ?? 'Request failed', code: r.code }, { status: r.status });
}
```

- `409 CONDITION_NOT_MET` is the expected business answer (sold out, seat taken, quota used): show
  it to the user. Do **not** retry it automatically for a claim: the row will still not match.
- `404` means the row is missing or the caller cannot read it; `403` and `400 INVALID_QUERY` mean a
  grant or the code is wrong: log them, do not show them as "sold out".
- To give a unit back (a cancelled order), `PATCH` with `{"stock": {"_inc": 1}}`; add a condition
  if there is a ceiling (`{"stock":{"_lt": 100}}`).

## Save an edit (optimistic locking)

The form carries the `version` it was loaded with. The route sends it as the condition:

```ts
// app/api/bookings/[id]/route.ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'Sign in first' }, { status: 401 });
  const { version, ...changes } = await req.json();
  if (!Number.isInteger(version)) return Response.json({ error: 'version is required' }, { status: 400 });

  const condition = encodeURIComponent(JSON.stringify({ version: { _eq: version } }));
  const r = await daas(`/api/items/bookings/${encodeURIComponent(id)}?condition=${condition}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ ...changes, version: { _inc: 1 } }),
  });
  if (r.status === 409 && r.code === 'CONDITION_NOT_MET') {
    const latest = await daas(`/api/items/bookings/${encodeURIComponent(id)}`, token);
    return Response.json({ error: 'Changed by someone else', latest: latest.data }, { status: 409 });
  }
  return Response.json(r.status === 200 ? { booking: r.data } : { error: r.message, code: r.code }, { status: r.status });
}
```

Retry guidance:

- **A person's edit:** on `409`, show the latest copy and let them re-apply or merge; then save with
  the new `version`. Do not overwrite silently.
- **An automatic change** (a background job that sets one field): read again, re-apply, and retry
  up to 3 times with a short random back-off; after that, report the failure.
- Never drop `version` from the condition to "make it work", and never let the client set
  `version` to a number: always `{"_inc": 1}`.

## Checkout through the transactional hook

The client only creates the request; the `filter` hook on `checkout_requests.items.create` does the
work (see [Transactions](transactions.md)).

```ts
// app/api/checkout/route.ts
export async function POST(req: Request) {
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'Sign in first' }, { status: 401 });
  const { product, qty } = await req.json();
  const r = await daas('/api/items/checkout_requests', token, {
    method: 'POST',
    body: JSON.stringify({ product, qty }),
  });
  if (r.status === 200 || r.status === 201) return Response.json({ ok: true, order: r.data?.order });
  switch (r.code) {
    case 'SOLD_OUT':
      return Response.json({ error: 'Sold out' }, { status: 409 });
    case 'LOCK_TIMEOUT':
    case 'TX_CONFLICT':
    case 'TX_TIMEOUT':
      return Response.json({ error: 'Busy, please try again' }, { status: 503 });
    default:
      return Response.json({ error: r.message ?? 'Checkout failed', code: r.code }, { status: r.status });
  }
}
```

`LOCK_TIMEOUT`, `TX_CONFLICT` and `TX_TIMEOUT` mean contention, not a business refusal: the user
may try again (one automatic retry after a short pause is fine; the hook's own `retries` already
cover `TX_CONFLICT`). `TX_NESTED`, `TX_REQUIRED`, `TX_CLOSED` and `TX_ABORTED` are bugs in the
hook: fix the code.

## Verify

Run these against a scratch product before calling the feature done, then delete the scratch data.

1. **Conditional PATCH under load.** Set a product's `stock` to `1`, then send 20 PATCHes at once
   with a token of the app's role:

   ```bash
   ( for i in $(seq 1 20); do
     curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$ENGINE_URL/api/items/products/$ID" \
       -G --data-urlencode 'condition={"stock":{"_gte":1}}' \
       -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
       -d '{"stock":{"_dec":1}}' &
   done; wait ) | sort | uniq -c
   ```

   Expect exactly `1 200` and `19 409`, and `stock` read back as `0` (never negative).
2. **The hook under load.** Set `stock` to `1` and send 20 parallel `POST
   /api/items/checkout_requests` with `{"product": <id>, "qty": 1}`. Expect one success and
   nineteen `409 SOLD_OUT`, exactly one row in `orders`, and `stock` `0`.
3. **Optimistic locking.** Load the same record in two browsers (two users), save in the first,
   then save in the second: the second must show "changed by someone else", and the record must hold
   the first save with `version` raised by one.
4. **Least privilege.** With the app's role token, a plain `PATCH` of `products.price` must be
   refused, and a direct `POST /api/items/orders` must be refused when only the hook may create
   orders.
