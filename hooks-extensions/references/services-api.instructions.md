---
name: DaaS Sandbox Services API
description: Complete API reference for all built-in services available inside the DaaS sandbox environment (extensions, cron jobs, and custom services). Covers every service, every method, and method signatures.
applyTo: "**/*.{ts,tsx,json}"
---

# DaaS Sandbox Services API — Complete Reference

All DaaS code environments (runtime extensions, cron jobs, and custom services) share the same `services` object. This document provides the **complete method signatures** for every built-in service.

> **How to access services:**
> - In **extensions** (filter/action hooks): `services` is a direct variable — use `services.items('coll')`
> - In **cron jobs**: `services` is a direct variable — use `services.items('coll')`
> - In **custom services**: access via `context.services` — e.g., `const { services } = context;`

---

## Service Factory Summary

All service factories accept an optional `{ elevated: true }` option. When elevated, permission checks are bypassed while the triggering user is still recorded in audit fields (`user_created`/`user_updated`) and the `daas_activity` log. See [Elevated Permissions](#elevated-permissions) below.

| Factory Call | Returns | Purpose |
|---|---|---|
| `await services.items(collection, [opts])` | `ItemsService` | CRUD + aggregate on any collection |
| `await services.collections([opts])` | `CollectionsService` | Manage tables/collections |
| `await services.fields([opts])` | `FieldsService` | Manage columns/fields |
| `await services.files([opts])` | `FilesService` | Upload, manage, and download files |
| `await services.versions([opts])` | `VersionService` | Content versioning and draft management |
| `await services.relations([opts])` | `RelationsService` | Manage foreign key relationships |
| `await services.mail()` | `MailService` | Send emails via SMTP |
| `await services.custom(name, [opts])` | Custom service object | Load a user-defined reusable service |
| `services.cron.trigger(idOrName)` | `Promise<{ historyId }>` | Trigger a cron job by ID or name |
| `services.cron.list([status])` | `Promise<CronJob[]>` | List cron jobs (optionally filter by status) |
| `services.cron.get(idOrName)` | `Promise<CronJob>` | Get a single cron job by ID or name |
| `services.fetch(url, options?)` | `Promise<Response>` | Domain-restricted HTTP requests |
| `services.supabase` | `SupabaseClient` | Raw Supabase client (service role, bypasses RLS) |
| `services.env` | `Record<string, string>` | Whitelisted environment variables (`NODE_ENV`, `NEXT_PUBLIC_SITE_URL`) |

> **All service factory calls are `async`** (except `supabase`, `fetch`, and `env`). Always `await` them.

---

## Elevated Permissions

By default, service calls enforce the **triggering user's own permission policies**. Pass `{ elevated: true }` as the second argument to any service factory to bypass permission checks while keeping the original user in the audit trail.

**Where it applies:**
- **Runtime Extensions** — `{ elevated: true }` uses the triggering user's identity for auditing but skips their policy checks.
- **Custom Services** (when called from an extension) — the service inherits the calling user's accountability; `{ elevated: true }` works identically inside `context.services`.
- **Cron Jobs** — always run as system admin; `{ elevated: true }` is accepted but redundant.

```javascript
// Runtime Extension (action hook on orders.items.create)
const log = await services.items('order_status_log', { elevated: true });
await log.createOne({ order_id: meta.key, status: 'pending' });
// ^ user is still recorded in user_created / daas_activity

// All factories accept the same option:
const fields   = await services.fields({ elevated: true });
const files    = await services.files({ elevated: true });
const versions = await services.versions({ elevated: true });
const rels     = await services.relations({ elevated: true });
const colls    = await services.collections({ elevated: true });

// Nested custom service — pass elevated to propagate admin acc into it:
const helper = await services.custom('my_helper', { elevated: true });
await helper.doRestrictedOperation();
// ^ helper runs with admin:true; triggering user still appears in audit fields
```

> **Security:** Only use `elevated` when the extension logic itself is the authority (enforcing a business rule). Do not use it to silently escalate arbitrary user requests.

---

## ItemsService

The most commonly used service. Provides full CRUD, aggregation, and batch operations on any collection.

```javascript
const items = await services.items('articles');
```

### Read Methods

| Method | Signature | Description |
|---|---|---|
| `readByQuery` | `(query?: Query) → Promise<Item[]>` | List items with filter, sort, limit, offset, fields |

> **Important:** `readByQuery()` returns `Item[]` directly, **not** `{ data: Item[] }`. The `{ data }` wrapper only exists in REST API responses. Do not destructure with `const { data } = await items.readByQuery(...)`.

| `readByQueryWithCount` | `(query?: Query) → Promise<{ items: Item[], count: number }>` | List items + total count (for pagination) |
| `readOne` | `(key: string, query?: Query) → Promise<Item>` | Get single item by primary key |
| `readMany` | `(keys: string[], query?: Query) → Promise<Item[]>` | Get multiple items by primary keys |
| `readAggregate` | `(query?: Query) → Promise<AnyItem[]>` | Run aggregate functions (count, sum, avg, min, max) |
| `getKeysByQuery` | `(query: Query) → Promise<string[]>` | Get just the primary keys matching a query |

### Create Methods

| Method | Signature | Description |
|---|---|---|
| `createOne` | `(data: Partial<Item>, opts?) → Promise<string>` | Create one item, returns primary key |
| `createMany` | `(data: Partial<Item>[], opts?) → Promise<string[]>` | Create multiple items, returns primary keys |

### Update Methods

| Method | Signature | Description |
|---|---|---|
| `updateOne` | `(key: string, data: Partial<Item>, opts?) → Promise<string>` | Update one item by key |
| `updateMany` | `(keys: string[], data: Partial<Item>, opts?) → Promise<string[]>` | Update multiple items with same data |
| `updateByQuery` | `(query: Query, data: Partial<Item>, opts?) → Promise<string[]>` | Update all items matching a filter |
| `updateBatch` | `(data: Partial<Item>[], opts?) → Promise<string[]>` | Update multiple items with different data (each must include `id`) |

### Delete Methods

| Method | Signature | Description |
|---|---|---|
| `deleteOne` | `(key: string, opts?) → Promise<string>` | Delete one item by key |
| `deleteMany` | `(keys: string[], opts?) → Promise<string[]>` | Delete multiple items by keys |
| `deleteByQuery` | `(query: Query, opts?) → Promise<string[]>` | Delete all items matching a filter |

### Query Object

```javascript
const items = await services.items('articles');
const results = await items.readByQuery({
  fields: ['id', 'title', 'author.name'],  // Field selection (dot notation for relations)
  filter: {                                  // Filter conditions
    status: { _eq: 'published' },
    date_created: { _gt: '2026-01-01' }
  },
  sort: ['-date_created', 'title'],          // Sort (- prefix for descending)
  limit: 25,                                 // Page size (-1 for all)
  offset: 0,                                 // Skip N items
  search: 'keyword',                         // Full-text search across string fields
  deep: {                                    // Nested relation filters
    'comments': { _filter: { approved: { _eq: true } } }
  }
});
```

### Aggregate Query

```javascript
const items = await services.items('orders');
const result = await items.readAggregate({
  aggregate: { count: ['id'], sum: ['amount'], avg: ['amount'] },
  groupBy: ['status'],
  filter: { date_created: { _gt: '2026-01-01' } }
});
// Returns: [{ status: 'completed', count: { id: 42 }, sum: { amount: 12500 }, avg: { amount: 297 } }, ...]
```

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
| `_and` | Logical AND | `{ _and: [{ status: { _eq: 'active' } }, { role: { _eq: 'admin' } }] }` |
| `_or` | Logical OR | `{ _or: [{ status: { _eq: 'active' } }, { status: { _eq: 'pending' } }] }` |

---

## MailService

Send emails via SMTP. Requires SMTP environment variables to be configured on the DaaS server.

### Getting the service

```javascript
// Option A: Get MailService instance for multiple operations
const mail = await services.mail();
await mail.send({ to: 'user@example.com', subject: 'Hello', text: 'World' });
await mail.send({ to: 'other@example.com', subject: 'Hi', html: '<b>Hello</b>' });

// Option B: Send directly (shorthand for single sends)
const result = await services.mail({ to: 'user@example.com', subject: 'Hello', text: 'World' });
```

When called with options, `services.mail(options)` sends immediately and returns the result.
When called without options, `services.mail()` returns the MailService instance.

### `send(options)` — Send an Email

```javascript
const mail = await services.mail();
const result = await mail.send({
  to: 'recipient@example.com',         // string or string[] (required)
  subject: 'Order Confirmation',        // string (required)
  text: 'Your order has been shipped.', // Plain-text body (one of text/html required)
  html: '<h1>Order Shipped</h1>',       // HTML body (one of text/html required)
  cc: 'manager@example.com',            // string or string[] (optional)
  bcc: ['audit@example.com'],           // string or string[] (optional)
  replyTo: 'support@example.com',       // string (optional)
  from: 'noreply@company.com',          // Override sender (optional)
  attachments: [                         // Array (optional)
    {
      filename: 'report.pdf',
      content: base64String,             // string or Buffer
      contentType: 'application/pdf'
    }
  ]
});
```

**Returns:**

```javascript
{
  success: true,           // boolean
  messageId: '<abc@mail>', // string (SMTP message ID)
  accepted: ['recipient@example.com'],  // string[]
  rejected: [],            // string[]
  error: undefined         // string (only on failure)
}
```

### `verify()` — Test SMTP Connection

```javascript
const mail = await services.mail();
const status = await mail.verify();
// Returns: { success: true } or { success: false, error: 'Connection refused' }
```

### Common Patterns

**Send notification after item creation (action hook):**

```javascript
const mail = await services.mail();
const items = await services.items(meta.collection);
const item = await items.readOne(meta.key);

await mail.send({
  to: 'admin@company.com',
  subject: `New ${meta.collection} created: ${item.title || meta.key}`,
  html: `<p>A new item was created in <b>${meta.collection}</b>.</p>
         <p>ID: ${meta.key}</p>
         <p>Created at: ${new Date().toISOString()}</p>`
});
```

**Send digest email (cron job):**

```javascript
const mail = await services.mail();
const items = await services.items('orders');
const yesterday = new Date(Date.now() - 86400000).toISOString();

const results = await items.readAggregate({
  aggregate: { count: ['id'], sum: ['total'] },
  filter: { date_created: { _gt: yesterday } }
});

const stats = results[0] || { count: { id: 0 }, sum: { total: 0 } };
await mail.send({
  to: 'reports@company.com',
  subject: `Daily Orders Summary — ${new Date().toLocaleDateString()}`,
  html: `<h2>Daily Summary</h2>
         <p>Orders: ${stats.count.id}</p>
         <p>Revenue: $${stats.sum.total}</p>`
});
```

---

## FilesService

Manage files in Supabase Storage. Extends ItemsService (all ItemsService methods are available on file metadata records in `daas_files`).

```javascript
const files = await services.files();
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `uploadOne` | `(fileData: Buffer\|Blob, metadata: { title?, description?, type, folder? }, existingKey?) → Promise<string>` | Upload a file, returns file ID |
| `importOne` | `(url: string, body?: { title?, description?, folder? }) → Promise<string>` | Import file from URL |
| `getDownloadUrl` | `(key: string, expiresIn?: number) → Promise<string>` | Get signed download URL (default 3600s) |
| `getPublicUrl` | `(file: FileRecord) → string\|null` | Get public URL if bucket is public |
| `readByQuery` | `(query?: Query) → Promise<FileRecord[]>` | List files with filtering |
| `readOne` | `(key: string, query?) → Promise<FileRecord>` | Get file metadata by ID |
| `deleteOne` | `(key: string) → Promise<string>` | Delete file and storage object |
| `deleteMany` | `(keys: string[]) → Promise<string[]>` | Delete multiple files |

### Example: Upload file from external URL in a cron job

```javascript
const files = await services.files();
const fileId = await files.importOne('https://example.com/report.pdf', {
  title: 'Monthly Report',
  description: 'Auto-imported report'
});
console.log('Imported file:', fileId);
```

---

## VersionService

Content versioning with delta-based storage. Extends ItemsService (operates on `daas_versions`).

```javascript
const versions = await services.versions();
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `createOne` | `(data: { collection, item, key, name? }) → Promise<string>` | Create a named version |
| `save` | `(id: string, data: Record<string, unknown>) → Promise<VersionRecord>` | Merge data into version's delta |
| `promote` | `(id: string) → Promise<{ mainItem: string }>` | Apply version's delta to main item |
| `getVersionsForItem` | `(collection: string, item: string) → Promise<VersionRecord[]>` | Get all versions for an item |
| `getVersionByKey` | `(collection: string, item: string, key: string) → Promise<VersionRecord\|null>` | Get version by key (e.g., "draft") |
| `getItemWithVersion` | `(collection: string, item: string, versionKey: string) → Promise<{ item, version }\|null>` | Get item with version delta applied |

### Example: Create and promote a version in a custom service

```javascript
const versions = await services.versions();

// Create a draft version
const versionId = await versions.createOne({
  collection: 'articles',
  item: articleId,
  key: 'draft',
  name: 'Draft v2'
});

// Save changes to the draft
await versions.save(versionId, {
  title: 'Updated Title',
  content: 'New content...'
});

// Promote draft to main item
await versions.promote(versionId);
```

---

## CollectionsService

Manage collection (table) metadata. Primarily used for reading collection configuration.

```javascript
const collections = await services.collections();
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `readByQuery` | `() → Promise<Collection[]>` | List all collections |
| `readOne` | `(collection: string) → Promise<Collection\|null>` | Get one collection's metadata |
| `readMany` | `(names: string[]) → Promise<Collection[]>` | Get multiple collections |
| `createOne` | `(payload: CreateCollectionDTO) → Promise<Collection>` | Create a new collection (table + metadata) |
| `updateOne` | `(collection: string, data: UpdateCollectionDTO) → Promise<Collection>` | Update collection metadata |
| `deleteOne` | `(collection: string) → Promise<void>` | Drop table and remove metadata |

---

## FieldsService

Manage field (column) definitions and metadata.

```javascript
const fields = await services.fields();
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `readAll` | `(collection?: string) → Promise<Field[]>` | List all fields, optionally filtered by collection |
| `readOne` | `(collection: string, field: string) → Promise<Field>` | Get one field's definition |
| `createField` | `(collection: string, fieldData: CreateFieldDTO) → Promise<Field>` | Add a column to a collection |
| `updateField` | `(collection: string, field: string, fieldData: UpdateFieldDTO) → Promise<Field>` | Update field definition/metadata |
| `deleteField` | `(collection: string, field: string) → Promise<void>` | Remove a column |

---

## RelationsService

Manage foreign key relationships between collections.

```javascript
const relations = await services.relations();
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `readAll` | `(collection?: string) → Promise<Relation[]>` | List all relations, optionally filtered |
| `readOne` | `(collection: string, field: string) → Promise<Relation>` | Get one relation |
| `createOne` | `(data: CreateRelationDTO) → Promise<Relation>` | Create a relation (FK + junction for M2M) |
| `updateOne` | `(collection: string, field: string, data: UpdateRelationDTO) → Promise<Relation>` | Update a relation |
| `deleteOne` | `(collection: string, field: string) → Promise<void>` | Remove a relation |

---

## Custom Services

Load user-defined reusable services by name.

```javascript
const helpers = await services.custom('date_helpers');
const result = helpers.formatDate('2026-01-15');
```

- Returns the object exported by the custom service's `return { ... }` statement
- The service must be `active` (or `draft` during testing)
- Custom services can call other custom services via `services.custom()`
- Circular dependencies are rejected at creation time

### Example: Use custom service in an extension

```javascript
// Filter hook — use a validator service
const validator = await services.custom('order_validator');
const result = validator.validate(payload);
if (!result.valid) {
  throw new Error('Validation failed: ' + result.errors.join(', '));
}
return payload;
```

---

## Cron Service (Programmatic Triggers)

Trigger, list, or inspect cron jobs from within any sandbox context (extensions, cron jobs, or custom services). Available as `services.cron`.

> **Note:** `services.cron` is a synchronous namespace (not a factory). Its methods are async — call `await services.cron.trigger(...)`.

### Methods

| Method | Signature | Description |
|---|---|---|
| `trigger` | `(idOrName: string) → Promise<{ historyId: string }>` | Trigger a cron job immediately by ID or name. Records `triggered_by: 'extension'` in history. |
| `list` | `(status?: 'active' \| 'inactive') → Promise<CronJob[]>` | List cron jobs. Optionally filter by status. Returns metadata (no code). |
| `get` | `(idOrName: string) → Promise<CronJob>` | Get a single cron job by ID or name. Returns metadata (no code). |

### Returned CronJob Shape (list / get)

```typescript
{
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  timezone: string;
  status: 'active' | 'inactive';
  last_run_at: string | null;
  last_run_status: 'success' | 'error' | 'timeout' | null;
  next_run_at: string | null;
  running?: boolean;         // only from get()
}
```

> **Security:** `services.cron` does not expose the job's `code` field. It only provides metadata and the ability to trigger execution.

### Example: Trigger a cron job from an extension

```javascript
// Action hook: trigger a cleanup job after an item is deleted
const result = await services.cron.trigger('nightly-cleanup');
console.log('Triggered cleanup, historyId:', result.historyId);
```

### Example: Conditionally trigger from a cron job

```javascript
// Cron code: check if there are stale records, then trigger a cleanup job
const items = await services.items('temp_uploads');
const stale = await items.readByQuery({
  filter: { created_at: { _lt: new Date(Date.now() - 86400000).toISOString() } },
  limit: 1,
});

if (stale.length > 0) {
  const result = await services.cron.trigger('cleanup-temp-uploads');
  console.log('Triggered cleanup for stale uploads, historyId:', result.historyId);
} else {
  console.log('No stale uploads, skipping cleanup');
}
```

### Example: Use in a custom service

```javascript
// Custom service code
return {
  async triggerJob(nameOrId) {
    return context.services.cron.trigger(nameOrId);
  },
  async listActiveJobs() {
    return context.services.cron.list('active');
  },
};
```

### Error Handling

```javascript
try {
  await services.cron.trigger('non-existent-job');
} catch (err) {
  console.error(err.message); // "Cron job not found: non-existent-job"
}
```

> **Overlap protection:** If the target job is already running, `trigger()` returns `{ historyId: '' }` (empty string) and the run is skipped. The caller does not receive an error.

---

## Fetch (HTTP Requests)

Make HTTP requests to external APIs. **Domain-restricted** — only `localhost` and domains listed in the `EXTENSION_ALLOWED_DOMAINS` environment variable are permitted.

```javascript
const response = await services.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
  body: JSON.stringify({ key: 'value' })
});
const data = await response.json();
```

> **Note:** `services.fetch` follows the standard Fetch API interface but with domain restrictions. If the domain is not whitelisted, the request throws an error.

---

## Environment Variables (env)

`services.env` is a **synchronous property** (not a factory) that exposes a small set of whitelisted environment variables.

```javascript
// Read environment variables
const nodeEnv = services.env.NODE_ENV;           // e.g. 'development', 'production'
const siteUrl = services.env.NEXT_PUBLIC_SITE_URL; // e.g. 'https://myapp.example.com'
```

### Available Variables

| Variable | Description |
|---|---|
| `NODE_ENV` | Current runtime environment (`development`, `production`, `test`) |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the DaaS instance |

> **Note:** Only these two variables are exposed. Other environment variables (secrets, API keys, etc.) are blocked for security.

> **Custom Services:** In custom services, environment variables are accessed via `context.env` (same shape) rather than `services.env`.

---

## Supabase Client (Raw)

Direct access to the Supabase PostgreSQL client with **service role** (bypasses RLS). Use only when the other services don't cover your use case.

```javascript
// Direct query
const { data, error } = await services.supabase
  .from('custom_table')
  .select('id, name, status')
  .eq('status', 'active')
  .limit(100);

// RPC call
const { data } = await services.supabase.rpc('my_function', { param: 'value' });

// Raw SQL via service role (use sparingly)
const { data } = await services.supabase.rpc('execute_sql', {
  sql: 'SELECT count(*) FROM articles WHERE status = $1',
  params: ['published']
});
```

> **Warning:** The supabase client uses the service role and bypasses all RLS policies. Use `services.items()` instead whenever possible — it respects accountability and triggers activity logging.

---

## Global Variables Available in Sandbox

In addition to `services`, the sandbox provides:

| Variable | Extensions (Filter) | Extensions (Action) | Cron Jobs | Custom Services |
|---|---|---|---|---|
| `services` | ✅ direct | ✅ direct | ✅ direct | ✅ via `context.services` |
| `payload` | ✅ (data being written) | ❌ | ❌ | ❌ |
| `meta` | ✅ `{ event, collection }` | ✅ `{ event, collection, key, keys, payload }` | ❌ | ❌ |
| `context` | ❌ | ❌ | ✅ `{ jobId, jobName, triggeredBy, runId, scheduledAt }` | ✅ `{ services, accountability, env }` |
| `console` | ✅ | ✅ | ✅ | ✅ |
| `JSON` | ✅ | ✅ | ✅ | ✅ |
| `Date` | ✅ | ✅ | ✅ | ✅ |
| `Math` | ✅ | ✅ | ✅ | ✅ |
| `accountability` | ❌ | ❌ | ❌ | ✅ via `context.accountability` |
| `env` | ✅ via `services.env` | ✅ via `services.env` | ✅ via `services.env` | ✅ via `context.env` |

### What is NOT available (blocked)

`setTimeout`, `setInterval`, `require`, `import`, `eval`, `new Function`, `process`, `fs`, `__dirname`, `__filename`

---

## When to Use Which Service

| Scenario | Service | Method |
|---|---|---|
| Read items from a collection | `services.items(coll)` | `readByQuery(query)` |
| Create an item | `services.items(coll)` | `createOne(data)` |
| Batch update items | `services.items(coll)` | `updateMany(keys, data)` or `updateBatch(items)` |
| Update items matching a filter | `services.items(coll)` | `updateByQuery(query, data)` |
| Count/sum/avg items | `services.items(coll)` | `readAggregate(query)` |
| Get items + total count for pagination | `services.items(coll)` | `readByQueryWithCount(query)` |
| Send email notification | `services.mail()` | `send({ to, subject, text/html })` |
| Upload or import a file | `services.files()` | `uploadOne(data, meta)` or `importOne(url)` |
| Create/promote a content version | `services.versions()` | `createOne(...)`, `save(...)`, `promote(...)` |
| Get a reusable helper | `services.custom(name)` | Methods defined by the service |
| Call an external API | `services.fetch(url, opts)` | Standard Fetch API |
| Read whitelisted env vars | `services.env` | Sync property: `{ NODE_ENV, NEXT_PUBLIC_SITE_URL }` |
| Direct DB query (escape hatch) | `services.supabase` | Supabase client methods |
| Check collection schema | `services.fields()` | `readAll(collection)` |
