---
name: Transactions (Engine project)
description: services.transaction in hooks, cron jobs and custom services on a Buildpad Engine project — options, row locks, error codes, and the gotchas found in real use.
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

# Transactions in stored code

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the Engine runtime table of the [hooks-extensions skill](../../hooks-extensions/SKILL.md) lists; for each interface it lacks, the table says what replaces it.

`services.transaction(fn, opts?)` runs several item reads and writes as one database transaction,
in a hook, a cron job or a custom service (Engine 0.1.0-dev.28, data service 2026.11.01). The
callback receives `tx`; `tx.items(collection, opts?)` has the nine methods of `services.items`, with
the same grants, filter hooks, tenant guard, `{ elevated: true }` and audit rows, but every call
runs in the one transaction.

```js
const result = await services.transaction(async (tx) => {
  // ...reads and writes through tx.items(...)
  return value; // returning commits; services.transaction answers this value
}, { retries: 2, lockTimeoutMs: 2000, timeoutMs: 5000 });
```

## Behaviour

- **Commit and rollback.** The callback returning commits. The callback throwing rolls back and
  rethrows the **same** error, so a `HookError` keeps its status and code and the client sees it.
  Activity rows written inside commit or roll back with the data.
- **Row locks.** `tx.items(c).readOne(id, { lock: 'update' })` locks the row until the transaction
  ends; a second locking read or a write of the same row waits. It is the **only** call that takes a
  lock. Only rows the caller's grant and tenant reach are read, so a row outside them is neither
  found nor locked. Outside a transaction the option fails with `TX_REQUIRED`.
- **One transaction per run.** A nested `services.transaction`, or two started together
  (`Promise.all`), fails with `TX_NESTED`. Await one before starting the next. A `tx` kept after its
  transaction ended fails with `TX_CLOSED`.
- **A savepoint per operation.** Each `tx.items(...)` call runs in its own savepoint. If the body
  catches a failed call (a unique violation, `LOCK_TIMEOUT`), the transaction is still usable and
  can commit. A commit after a failure the database still holds against the transaction answers
  `TX_ABORTED`.
- **Side effects wait for the commit.** `items.*` action hooks queued by writes inside the
  transaction run after the commit and not at all after a rollback, so an email for an order is
  never sent for an order that was rolled back. Filter hooks run inline, as always.
- **Other code does not see uncommitted rows.** A plain `services.items` call inside the callback,
  and any hook that a `tx` write fires, run outside the transaction: they do not see its
  uncommitted rows, and while it is open each of their statements waits for a lock at most
  `lockTimeoutMs` (then `LOCK_TIMEOUT`). Use `tx.items`, not `services.items`, inside the callback.
- **A run that ends with the transaction open** (timed out, interrupted, a promise left pending) is
  rolled back.

## Options

| Option | Default | Meaning |
|---|---|---|
| `retries` | `0` (0 to 5) | Re-runs the whole callback after `TX_CONFLICT` (deadlock or serialization failure). The callback must be safe to run again |
| `lockTimeoutMs` | `2000` | How long to wait for a row lock before `LOCK_TIMEOUT`; not retried |
| `timeoutMs` | `5000` (at most `60000`) | Limit for the whole transaction, then `TX_TIMEOUT`; the run's own deadline (the hook's `timeout_ms`) still applies |

## Error codes

| Code | Status | When |
|---|---|---|
| `TX_NESTED` | 400 | A second transaction opened while one is open (nested or concurrent) |
| `TX_REQUIRED` | 400 | `lock` used outside a transaction |
| `LOCK_TIMEOUT` | 409 | A lock not obtained within `lockTimeoutMs`, or work beside the open transaction waited past it |
| `TX_CONFLICT` | 409 | Deadlock or serialization failure, after any `retries` |
| `TX_CLOSED` | 409 | A `tx` used after its transaction ended |
| `TX_ABORTED` | 409 | A commit after a failure the database still holds against the transaction |
| `TX_TIMEOUT` | 504 | The transaction ran longer than `timeoutMs` |

Your own refusals use `new HookError(message, status, code)`, for example
`new HookError('Sold out', 409, 'SOLD_OUT')`. Give the client a stable `code` it can switch on.

## The checkout hook

A `filter` hook on `checkout_requests.items.create` (create it inactive, activate it and test it as
the [hooks-extensions skill](../../hooks-extensions/SKILL.md) says):

```js
const qty = Number(payload.qty);
if (!Number.isInteger(qty) || qty < 1) throw new HookError('qty must be a positive integer', 400, 'INVALID_QTY');
const order = await services.transaction(async (tx) => {
  const products = tx.items('products', { elevated: true });
  const product = await products.readOne(payload.product, { lock: 'update' });
  if (product.stock < qty) throw new HookError('Sold out', 409, 'SOLD_OUT');
  await products.updateOne(payload.product, { stock: { _dec: qty } });
  return tx.items('orders', { elevated: true }).createOne({ product: payload.product, qty });
}, { retries: 2 });
payload.order = order;
payload.status = 'confirmed';
return payload;
```

The `checkout_requests` row itself is written after the filter returns, outside the transaction.
If that final write could fail (a required field missing), validate the payload **before** the
transaction, as above, so stock is never taken for a request that is then refused.

## Gotchas found in real use

- **`readOne` on a missing row throws**, it does not return `null`: a key that names no row the
  caller can reach (another tenant's included) throws a 404 `NOT_FOUND` error, which rolls the
  transaction back and reaches the client as `404 NOT_FOUND` unless the hook catches it. Do not
  write `if (!product)`.
- **`createOne` returns the new item's id**, not the item. Store it (`payload.order = id`) or read
  it back with `readOne`.
- **Elevate what the caller may not write.** The client's role should not hold `update` on
  `products` or `create` on `orders`; use `tx.items(c, { elevated: true })` for those inside the
  hook. The audit trail still names the caller. A filter runs before the caller's grant is applied
  to the payload, so the hook cannot widen what the caller writes to `checkout_requests` itself.
- **Only `readOne` locks.** `readByQuery` and `readMany` take no lock; read the rows you decide on
  with `readOne(id, { lock: 'update' })`, one by one. Lock several rows in a fixed order (sorted
  ids) so two runs cannot deadlock; set `retries` for the rare `TX_CONFLICT`.
- **Keep it short.** No `services.fetch` or mail inside the callback: other buyers wait on the lock
  while it is open. Put side effects in an action hook, which runs after the commit.
- **Hooks fired by `tx` writes do not see the uncommitted rows**, and a plain `services.items` call
  inside the callback does not either.
- **No SQL, no lock across requests.** The transaction lives inside one run of stored code.

## In a custom service

```js
return {
  transferPoints: async function (fromId, toId, points) {
    return context.services.transaction(async (tx) => {
      const members = tx.items('members', { elevated: true });
      const from = await members.readOne(fromId, { lock: 'update' });
      if (from.points < points) throw new Error('Not enough points');
      await members.updateOne(fromId, { points: { _dec: points } });
      await members.updateOne(toId, { points: { _inc: points } });
    }, { lockTimeoutMs: 2000, retries: 2 });
  },
};
```
