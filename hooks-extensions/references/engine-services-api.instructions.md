---
name: Engine Services API
description: Complete API reference for the built-in services of the Engine runtime (extensions, cron jobs, and custom services) — every service, every method, and what the runtime does not provide.
applyTo: "**/*.{ts,tsx,json}"
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

# Engine Services API — Complete Reference

On an Engine project all stored code (runtime extensions, cron jobs, and custom services) runs in the Engine's runtime and reaches the same `services` object. This document gives the method signatures of every built-in service the Engine provides, and says what it does not provide.

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the Engine runtime table in the [hooks-extensions skill](../SKILL.md) lists; for each interface it lacks, the table says what replaces it.

> **How to access services:**
> - In **extensions** (filter/action hooks): `services` is a direct variable (also `context.services`) — use `services.items('coll')`
> - In **cron jobs**: `services` is a direct variable — use `services.items('coll')`
> - In **custom services**: access via `context.services` — e.g., `const { services } = context;`

The code is the body of an async function in strict mode, so `await` works at the top level. Every service call is answered at once (`await` on it is harmless); the exception is `services.custom`, which answers a promise you must `await`.

---

## Service Factory Summary

| Factory Call | Returns | Purpose |
|---|---|---|
| `services.items(collection, [opts])` | Items service | Nine read and write methods on one collection |
| `services.collections([opts])` | `readAll`, `readOne` | Read collection metadata |
| `services.fields([opts])` | `readAll`, `readOne` | Read field definitions |
| `services.relations([opts])` | `readAll`, `readOne` | Read relations |
| `services.files([opts])` | `readByQuery`, `readOne` | Read file metadata |
| `services.versions([opts])` | `readAll`, `readOne`, `promote` | Read content versions and promote one |
| `services.mail()` | `{ send, verify }` | Mail through the Engine's SMTP settings |
| `services.mail(options)` | `{ success, ... }` | Send one email |
| `await services.custom(name, [opts])` | Custom service object | Load an active custom service |
| `services.cron.trigger(idOrName)` | history id string | Run a cron job now |
| `services.cron.list([status])` | Cron jobs | List cron jobs, without code |
| `services.cron.get(idOrName)` | Cron job | Get one cron job, without code |
| `services.fetch(url, [init])` | Response | HTTP to the hosts the Engine's operator allows |
| `services.env` | object | Only the variables the Engine's operator names |

There is no Supabase service: `services.supabase` is refused with `501 RUNTIME_SUPABASE_UNAVAILABLE`, permanently. There is no SQL from stored code. `Object.keys(services)` lists exactly the members that work.

---

## Elevated Permissions

By default, service calls are checked against the **grants of the run's principal**: in a hook, the caller who fired it; in a custom service, its caller; in a cron job, the Engine's system account, which holds the Administrator policy. Pass `{ elevated: true }` as the options argument to evaluate the calls as an administrator while every audit record (`user_created`/`user_updated` and the activity log) still names the original principal.

```javascript
// Runtime extension (action hook on orders.items.create)
const log = services.items('order_status_log', { elevated: true });
await log.createOne({ order_id: meta.key, status: 'pending' });
// ^ the caller is still recorded in user_created and the activity log

// The read-only factories take the same option:
const fields   = services.fields({ elevated: true });
const files    = services.files({ elevated: true });
const versions = services.versions({ elevated: true });
const rels     = services.relations({ elevated: true });
const colls    = services.collections({ elevated: true });

// Nested custom service — strictly the boolean true:
const helper = await services.custom('my_helper', { elevated: true });
await helper.doRestrictedOperation();
```

`{ elevated: 0 }` does not elevate, and an options argument that is not a plain object is refused.

> **Security:** Only use `elevated` when the stored code itself is the authority (enforcing a business rule). Do not use it to silently escalate arbitrary user requests.

---

## Items Service

The most commonly used service: reads and writes on any collection, through the same checks as `/api/items/:collection`.

```javascript
const items = services.items('articles');
```

### Methods

| Method | Signature | Returns |
|---|---|---|
| `readByQuery` | `(query?)` | The array of items itself |
| `readOne` | `(key, query?)` | The item; a key that names no reachable row throws `404 NOT_FOUND` |
| `readMany` | `(keys, query?)` | The items found; a key that names no reachable row is left out |
| `createOne` | `(data)` | The primary key written |
| `createMany` | `(rows)` | The primary keys, in one transaction |
| `updateOne` | `(key, data)` | The key written |
| `updateMany` | `(keys, data)` | The keys written, one payload for all, in one transaction |
| `deleteOne` | `(key)` | The key removed |
| `deleteMany` | `(keys)` | The keys removed, in one transaction |

> **Important:** `readByQuery()` returns `Item[]` directly, **not** `{ data: Item[] }`. Do not destructure with `const { data } = await items.readByQuery(...)`.

There is no count, aggregate, key-only, query-wide update, batch update with different data, or query-wide delete method. Read the keys with `readByQuery({ fields: ['id'], filter, limit })`, then call `updateMany` or `deleteMany`; loop over `updateOne` where each row gets different data.

### Query Object

```javascript
const results = await services.items('articles').readByQuery({
  fields: ['id', 'title', 'author.name'],  // Field selection (dot notation for relations)
  filter: {                                  // Filter conditions
    status: { _eq: 'published' },
    date_created: { _gt: '2026-01-01' }
  },
  sort: ['-date_created', 'title'],          // Sort (- prefix for descending)
  limit: 25,                                 // Page size: 25 when omitted, at most 1000
  offset: 0,                                 // Skip N items (or page: 1)
  search: 'keyword',                         // Search across string fields
});
```

The keys are `fields`, `filter`, `sort`, `limit`, `page`, `offset` and `search`. Any other key, `deep` and `aggregate` included, is refused with `400 INVALID_PAYLOAD`, not ignored. A non-integer `limit`, `page` or `offset` is refused.

A field your grant does not allow, or a collection you may not read, is refused exactly as the Items API refuses it.

### Filter Operators

| Operator | Description | Example |
|---|---|---|
| `_eq` | Equals | `{ status: { _eq: 'active' } }` |
| `_neq` | Not equals | `{ status: { _neq: 'archived' } }` |
| `_gt` | Greater than | `{ amount: { _gt: 100 } }` |
| `_gte` | Greater than or equal | `{ amount: { _gte: 100 } }` |
| `_lt` | Less than | `{ amount: { _lt: 1000 } }` |
| `_lte` | Less than or equal | `{ amount: { _lte: 1000 } }` |
| `_in` | In array | `{ status: { _in: ['active', 'pending'] } }` |
| `_nin` | Not in array | `{ status: { _nin: ['archived'] } }` |
| `_null` | Is null | `{ deleted_at: { _null: true } }` |
| `_nnull` | Is not null | `{ email: { _nnull: true } }` |
| `_contains` | Contains substring | `{ title: { _contains: 'draft' } }` |
| `_icontains` | Contains (case-insensitive) | `{ title: { _icontains: 'draft' } }` |
| `_starts_with` | Starts with | `{ name: { _starts_with: 'A' } }` |
| `_ends_with` | Ends with | `{ email: { _ends_with: '@company.com' } }` |
| `_between` | Between two values | `{ amount: { _between: [10, 100] } }` |
| `_has` | Has (or has no) related row | `{ comments: { _has: true } }` |
| `_and` | Logical AND | `{ _and: [{ status: { _eq: 'active' } }, { role: { _eq: 'admin' } }] }` |
| `_or` | Logical OR | `{ _or: [{ status: { _eq: 'active' } }, { status: { _eq: 'pending' } }] }` |

A filter may reach **one relation deep** — `{ 'comments.status': { _eq: 'published' } }` or `{ comments: { _has: true } }` — and needs a read grant on the related collection. A path through two relations, `_some` and `_none` are refused.

---

## Mail

Sends through the Engine's SMTP settings, the same ones the Settings page uses.

### Getting the service

```javascript
// Option A: the mail object, for several operations
const mail = services.mail();
await mail.send({ to: 'user@example.com', subject: 'Hello', text: 'World' });
await mail.send({ to: 'other@example.com', subject: 'Hi', html: '<b>Hello</b>' });

// Option B: send directly
const result = await services.mail({ to: 'user@example.com', subject: 'Hello', text: 'World' });
```

### `send(options)` — Send an Email

```javascript
const result = await services.mail().send({
  to: 'recipient@example.com',         // string or string[] (required)
  subject: 'Order Confirmation',        // string (required)
  text: 'Your order has been shipped.', // Plain-text body
  html: '<h1>Order Shipped</h1>',       // HTML body
  replyTo: 'support@example.com',       // string (optional)
});
```

The Engine reads only `to`, `subject`, `text`, `html` and `replyTo`; `cc`, `bcc`, `from` and `attachments` are not sent.

**Returns:**

```javascript
{ success: true, messageId: '<abc@mail>' }   // sent
{ success: false, error: '<the settings message>' }  // the Engine could not send
```

**Failure is a value, not a throw**, when the Engine cannot send (mail switched off, no host, the server refused). A wrong call — no recipient, an option that is not a string, a value holding a line break — **throws** `400 INVALID_PAYLOAD`. Check `success`.

### `verify()` — Test the SMTP Connection

```javascript
const status = await services.mail().verify();
// { success: true, message: '...' } or { success: false, message: '...' }
```

### Common Patterns

**Send notification after item creation (action hook):**

```javascript
const item = await services.items(meta.collection).readOne(meta.key);

const sent = await services.mail({
  to: 'admin@company.com',
  subject: `New ${meta.collection} created: ${item.title || meta.key}`,
  html: `<p>A new item was created in <b>${meta.collection}</b>.</p>
         <p>ID: ${meta.key}</p>
         <p>Created at: ${new Date().toISOString()}</p>`
});
if (!sent.success) console.warn('Mail not sent:', sent.error);
```

**Send digest email (cron job):**

```javascript
const yesterday = new Date(Date.now() - 86400000).toISOString();

// No aggregate on the Engine: read the rows (at most 1000 per call) and add them up
const orders = await services.items('orders').readByQuery({
  fields: ['id', 'total'],
  filter: { date_created: { _gt: yesterday } },
  limit: 1000,
});
const revenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

await services.mail({
  to: 'reports@company.com',
  subject: `Daily Orders Summary — ${new Date().toISOString().slice(0, 10)}`,
  html: `<h2>Daily Summary</h2>
         <p>Orders: ${orders.length}</p>
         <p>Revenue: $${revenue.toFixed(2)}</p>`
});
```

---

## Files

File **metadata** only. Stored code cannot upload, import, download, sign a URL for, or delete a file: do that through the application and `/api/files`.

```javascript
const files = services.files();
```

| Method | Signature | Description |
|---|---|---|
| `readByQuery` | `(query?)` | List file records (`filter`, `sort` with one key, `limit`, `page`, `offset`, `search`; no `fields`) |
| `readOne` | `(key)` | Get one file record |

---

## Versions

Content versions: read them, and promote one into its item. Versions are created and saved through `/api/versions`, not from stored code.

```javascript
const versions = services.versions();
```

| Method | Signature | Description |
|---|---|---|
| `readAll` | `({ collection?, item? }?)` | List versions, optionally for one collection or item; any other key is refused |
| `readOne` | `(id)` | Get one version |
| `promote` | `(id)` | Apply the version's changes to its item; needs `update` on `daas_versions` |

---

## Collections, Fields and Relations

Read only. Each needs a read grant on `daas_collections`, `daas_fields` or `daas_relations`; a grant narrowed by fields or a row filter is refused (read `services.items('daas_fields')` instead, which honours one). Change structure through the Engine's API (see the [create-collection skill](../../create-collection/SKILL.md)).

```javascript
await services.collections().readAll();                 // every collection
await services.collections().readOne('articles');
await services.fields().readAll();                      // every collection's fields
await services.fields().readAll('articles');            // one collection's
await services.fields().readOne('articles', 'title');
await services.relations().readAll();                   // every relation
await services.relations().readAll('articles');         // those touching one collection
await services.relations().readOne('articles', 'author');
```

---

## Custom Services

Load user-defined reusable services by name.

```javascript
const helpers = await services.custom('date_helpers');
const result = helpers.formatDate('2026-01-15');
```

- Answers a promise of the object the service's code returns: always `await` it
- Only an `active` service resolves; any other name or status throws `Custom service "<name>" not found or inactive`
- Each call builds a new instance and awaits its `init`
- Custom services can call other custom services through `context.services.custom()`
- A method that runs longer than the service's `timeout_ms` throws an error the caller can catch

See the [create-service skill](../../create-service/SKILL.md).

### Example: Use custom service in an extension

```javascript
// Filter hook — use a validator service
const validator = await services.custom('order_validator');
const result = validator.validate(payload);
if (!result.valid) {
  throw new HookError('Validation failed: ' + result.errors.join(', '), 422, 'VALIDATION_FAILED');
}
return payload;
```

---

## Cron Service (Programmatic Triggers)

Trigger, list, or inspect cron jobs from any stored code. `services.cron` is a namespace (not a factory).

### Methods

| Method | Signature | Description |
|---|---|---|
| `trigger` | `(idOrName: string) → string` | Run a cron job now, by ID or unique name. Answers the run's history id, or `""` when the job was already running. Records `triggered_by: 'extension'`. |
| `list` | `(status?: 'active' \| 'inactive') → CronJob[]` | List cron jobs ordered by name, without their code |
| `get` | `(idOrName: string) → CronJob` | Get one cron job, without its code |

A job is the API's snake_case fields without `code`: `id`, `name`, `description`, `schedule`, `timezone`, `status`, `timeout_ms`, `memory_limit_mb`, `running`, `running_since`, `last_run_at`, `last_run_status`, `next_run_at`, `created_at`, `updated_at`, `created_by`, `updated_by`. A missing value is `null`; a time is an ISO-8601 string in UTC.

On an Engine project an active cron job fires at its scheduled time. `services.cron.trigger` runs a job by hand, at once, as `POST /api/cron/:id/run` does.

### Example: Trigger a cron job from an extension

```javascript
// Action hook: run a cleanup job after an item is deleted
const historyId = await services.cron.trigger('nightly-cleanup');
if (historyId) console.log('Started cleanup, history id:', historyId);
```

A triggered run that failed still answers its history id; read its outcome from `services.cron.get(ref).last_run_status`.

### Errors

```javascript
try {
  await services.cron.trigger('non-existent-job');
} catch (err) {
  console.error(err.message); // "Cron job not found: non-existent-job" (404 NOT_FOUND)
}
```

A name that more than one job carries is refused with `400 INVALID_PAYLOAD`: trigger it by id.

---

## Fetch (HTTP Requests)

HTTP requests from stored code. A request is allowed only to `localhost`, `127.0.0.1`, `::1`, and the hosts in the project's `EXTENSION_ALLOWED_DOMAINS` (set under **Environment Variables** on the Buildpad platform) (and their subdomains). An empty list allows the loopback hosts only.

```javascript
const response = await services.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
  body: JSON.stringify({ key: 'value' })
});
response.ok;                  // a 2xx status
response.status;              // 201
response.headers.get('etag'); // null when absent
const data = await response.json();   // or await response.text()
```

- Only `http` and `https`, and only an absolute URL
- Every redirect is checked against the list again, up to 10
- A response over 8 MiB is refused
- An object `body` is sent as `[object Object]`: send `JSON.stringify(...)` or a string
- A host outside the list throws `403 FORBIDDEN` before any request is sent; an upstream failure throws `502 RUNTIME_FETCH_FAILED`

---

## Environment Variables (env)

`services.env` is a plain object of the variables the Engine's operator exposes. **The default is empty.** It never holds `NODE_ENV` or `NEXT_PUBLIC_SITE_URL`, and never the application's own variables.

| Rule (narrowest first) | Variable the operator sets |
|---|---|
| The source's list | `RUNTIME_ENV_WHITELIST_CRON`, `RUNTIME_ENV_WHITELIST_EXTENSION` or `RUNTIME_ENV_WHITELIST_CUSTOM_SERVICE` (names, comma-separated) |
| The global list | `RUNTIME_ENV_WHITELIST_GLOBAL` |
| The source's prefix | `CRON_PUBLIC_<KEY>`, `EXTENSION_PUBLIC_<KEY>`, `CUSTOM_SERVICE_PUBLIC_<KEY>` (appears as `<KEY>`) |
| The global prefix | `RUNTIME_PUBLIC_<KEY>` (appears as `<KEY>`) |

```javascript
const siteUrl = services.env.SITE_URL;   // undefined unless the operator exposes it
if (!siteUrl) throw new Error('Ask the Engine operator to expose SITE_URL');
```

Keys are upper-cased; an empty value is left out. The Engine's own credentials (database, signing keys, cache, object store, mail) can never be exposed. In custom services, `context.env` is the same object as `context.services.env`.

---

## Global Variables Available in Stored Code

| Variable | Extensions (Filter) | Extensions (Action) | Cron Jobs | Custom Services |
|---|---|---|---|---|
| `services` | ✅ direct | ✅ direct | ✅ direct | ✅ via `context.services` |
| `payload` | ✅ (data being written, rows read, or the query) | ❌ | ❌ | ❌ |
| `meta` | ✅ `{ event, collection }`, `keys` on update/delete | ✅ `{ event, collection, key, keys, payload }` as the event carries them | ❌ | ❌ |
| `context` | ✅ `{ accountability, resourceUri, services }` | ✅ `{ accountability, resourceUri, services }` | ✅ `{ jobId, jobName, triggeredBy, runId, scheduledAt }` | ✅ `{ services, env, accountability }` |
| `console` | ✅ | ✅ | ✅ | ❌ (✅ in its tests) |
| `JSON` | ✅ | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ | ✅ |
| `Math` | ✅ | ✅ | ✅ | ✅ |
| `HookError` | ✅ | ✅ | ❌ | ❌ |
| `env` | ✅ via `services.env` | ✅ via `services.env` | ✅ via `services.env` | ✅ via `context.env` |

### What is NOT available

`fetch`, `process`, `require`, `import`, `setTimeout`, `setInterval`, `eval`, `Function`, the file system, `Intl` and `URLSearchParams`. Using one is a `ReferenceError` (or a refusal). There is no Supabase service and no SQL.

---

## Errors a Service Call Raises

A refused call throws an `Error` carrying `statusCode` and `code`, so `catch (e) { if (e.code === 'FORBIDDEN') … }` works.

| Situation | `statusCode` | `code` |
|---|---|---|
| The grant refuses the action | 403 | `FORBIDDEN` |
| A metadata service with a narrowed grant | 403 | `FORBIDDEN` |
| A row, file, field or version is not there | 404 | `NOT_FOUND` |
| A bad argument, a malformed query, a mail option of the wrong type | 400 | `INVALID_PAYLOAD` |
| A fetch host outside the list | 403 | `FORBIDDEN` |
| The upstream failed, or too many redirects | 502 | `RUNTIME_FETCH_FAILED` |
| The response was over 8 MiB | 502 | `RUNTIME_FETCH_RESPONSE_TOO_LARGE` |
| `services.supabase` | 501 | `RUNTIME_SUPABASE_UNAVAILABLE` |
| The Engine itself failed | 500 | `INTERNAL_SERVER_ERROR` |

---

## When to Use Which Service

| Scenario | Service | Method |
|---|---|---|
| Read items from a collection | `services.items(coll)` | `readByQuery(query)` |
| Create an item | `services.items(coll)` | `createOne(data)` |
| Batch update items | `services.items(coll)` | `updateMany(keys, data)`, or a loop of `updateOne` |
| Update items matching a filter | `services.items(coll)` | `readByQuery({ fields: ['id'], filter })`, then `updateMany(keys, data)` |
| Count or sum items | `services.items(coll)` | `readByQuery` with `limit` up to 1000, then count in code |
| Send email notification | `services.mail()` | `send({ to, subject, text/html })`, then check `success` |
| Upload or import a file | — | Not from stored code: the application and `/api/files` |
| Promote a content version | `services.versions()` | `promote(id)` |
| Get a reusable helper | `services.custom(name)` | Methods defined by the service |
| Run a cron job now | `services.cron` | `trigger(idOrName)` |
| Call an external API | `services.fetch(url, init)` | An allowed host only |
| Read an operator-exposed setting | `services.env` | A plain object; empty by default |
| Check collection schema | `services.fields()` | `readAll(collection)` |
