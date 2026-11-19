---
name: atomic-writes
description: "Engine projects only: prevent race conditions and overbooking on a Buildpad Engine project. Conditional PATCH with _inc/_dec for single-row claims (stock, seats, quotas, counters), optimistic locking with a version field for records people edit, and filter hooks that run services.transaction with row locks when several rows must change together. Use for race conditions, overbooking, double booking, stock/quota/seat claims, counters, optimistic locking or transactional hooks. On a Supabase project it says the feature is not available and stops."
---

# Atomic Writes

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

<!-- buildpad-backend: supabase -->
## On a Supabase project

Conditional updates, increment and decrement operators and transactions in stored code are
features of the Buildpad Engine. They are not available on a Supabase project. Tell the developer
so, and stop: do not build a substitute in this skill.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
Use this skill on an Engine project whenever two requests can change the same data at the same
moment: the last item in stock, a seat or a time slot, a quota, a counter, or a record two people
edit at once. The obvious code reads a row, checks it in the app and writes it back; two buyers who
both read `stock = 1` both pass the check and both write `0`. The fix is to make the check and the
write one step that nobody can get between, inside the Engine.

The Engine serves this from data service version 2026.11.01 (Engine 0.1.0-dev.28). If the
project's Engine is older, these features are not available: tell the developer so and stop.

## Pick the smallest tool

| Situation | Tool | Where |
|---|---|---|
| One row: claim a seat, take one from stock, use one of a quota, bump a counter | `PATCH /api/items/:collection/:id?condition=...` with `{"_dec": n}` / `{"_inc": n}` | The app's server route; no hook |
| A person reads a record, thinks, then saves it (edits of a booking, a document) | Optimistic locking: a numeric `version` field, `condition={"version":{"_eq":<read>}}` and `{"version":{"_inc":1}}` | The app's server route; no hook |
| Several rows or collections change together (take stock **and** create the order) | A `filter` hook that runs `services.transaction` and locks with `readOne(id, { lock: 'update' })` | A stored hook (the [hooks-extensions skill](../hooks-extensions/SKILL.md)) |

Rules that hold for all three:

- **Never hold a lock across HTTP requests.** There is no "lock now, release in the next request".
  A lock lives only inside one `services.transaction`, and a transaction still open when the
  script ends is rolled back. Work that spans a user's think time uses optimistic locking.
- **No SQL.** There is no SQL path from the app or from stored code; do not look for one.
- **Never read-check-write in the app** (`GET` the row, compare in JavaScript, `PATCH` the new
  value). That is the race this skill removes.

## 1. Conditional PATCH (one row)

On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

```bash
curl -X PATCH "$ENGINE_URL/api/items/products/42" \
  -G --data-urlencode 'condition={"stock":{"_gte":1}}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stock": {"_dec": 1}}'
```

- The condition and the change run as one atomic `UPDATE` while the row is locked.
- `condition` is a filter in the same syntax as `filter`, as JSON or in bracket form
  (`condition[stock][_gte]=1`). It is accepted on a **single-item** PATCH only; a batch update
  with `condition` is `400 INVALID_QUERY` (use `filter` there). An empty condition means none.
- `{"_inc": n}` / `{"_dec": n}` on a numeric field compute the new value in the database (`NULL`
  counts as `0`); they also work in batch updates. On any non-numeric, non-text, non-JSON field
  they are `400`.

| Answer | Meaning | What the app does |
|---|---|---|
| `200` | Applied; the body holds the updated item | Success |
| `409 CONDITION_NOT_MET` | The row exists and did not match; nothing changed | "Sold out" / "Someone else saved first" |
| `404` | The row does not exist, or the caller cannot read it | Not found |
| `403` | No read access to the collection, or the condition names a field the caller cannot read | Fix the role's grants |
| `400 INVALID_QUERY` | The condition names a field that does not exist, or is malformed | Fix the code |

The Next.js route handlers, the error parsing and the retry loop for optimistic locking:
[Client patterns](references/client-patterns.md).

## 2. Optimistic locking (read, think, save)

Add a numeric `version` field (default `1`) to the collection. Save with the version that was read
as the condition, and raise it in the same request:

```bash
curl -X PATCH "$ENGINE_URL/api/items/bookings/7" \
  -G --data-urlencode 'condition={"version":{"_eq":5}}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "version": {"_inc": 1}}'
```

The first save wins and the version becomes `6`; the second gets `409 CONDITION_NOT_MET`. Read the
record again, show or merge the change, and retry (a bounded number of times for automatic merges;
ask the person when the change is theirs). Send the version from the form; never re-read it just
before the save, or the check means nothing.

## 3. A transaction in a filter hook (several rows)

The client creates a request item (for example `checkout_requests`), and a `filter` hook on
`checkout_requests.items.create` does the work in one transaction:

```js
const order = await services.transaction(async (tx) => {
  const products = tx.items('products', { elevated: true });
  const product = await products.readOne(payload.product, { lock: 'update' });
  if (product.stock < payload.qty) throw new HookError('Sold out', 409, 'SOLD_OUT');
  await products.updateOne(payload.product, { stock: { _dec: payload.qty } });
  return tx.items('orders', { elevated: true }).createOne({ product: payload.product, qty: payload.qty });
}, { retries: 2, lockTimeoutMs: 2000, timeoutMs: 5000 });
payload.order = order; // createOne returns the new id
return payload;
```

A second checkout for the same product waits at `readOne(..., { lock: 'update' })` until the first
commits, then reads the new stock. A throw rolls back the stock and the order together, and the
client gets the `HookError`'s status and code (`409 SOLD_OUT`). A product id that names no reachable row makes
`readOne` throw `404 NOT_FOUND` (it never returns `null`), which also rolls back.

Create, activate and check the hook as the [hooks-extensions skill](../hooks-extensions/SKILL.md)
says (`POST /api/extensions` with `"type": "filter"` and `"event": "checkout_requests.items.create"`).
The options, the error codes, and the rules of `services.transaction` (one per run, savepoints,
what other hooks see, when action hooks run): [Transactions](references/transactions.md).

## Access for the app's role

Give the role that the app's requests run as only what the chosen pattern needs (see the
[create-rbac skill](../create-rbac/SKILL.md)):

- Conditional PATCH: `read` on the collection (the condition's fields included) and `update` on
  the counted field only (for example `stock`), not on price or name.
- Transaction hook: `read` on `products`, `create` on `checkout_requests`, and nothing on
  `products` or `orders` writes when the hook uses `{ elevated: true }` for them.

## Verify

Never ship this without a concurrency test. The recipe (20 parallel PATCHes on a stock of 1 give
one `200` and nineteen `409`; then the hook path; then two browsers): [Client
patterns, Verify](references/client-patterns.md#verify).

## References

- [Client patterns](references/client-patterns.md): Next.js route handlers, error handling,
  optimistic-locking retries, the verification recipe
- [Transactions](references/transactions.md): `services.transaction`, options, error codes,
  gotchas, a custom service example
<!-- /buildpad-backend -->
