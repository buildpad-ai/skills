````instructions
---
name: Cron Sandbox Environment
description: JavaScript sandbox for cron job code — context variables, services, blocked globals, and coding patterns
applyTo: "**/*.{ts,tsx,json}"
---

# Cron Sandbox Environment

Cron jobs execute in the same sandboxed JavaScript environment as runtime extensions. This reference covers the execution context, available APIs, and best practices for writing cron code.

---

## Execution Context

When a cron job runs, the following variables are available in scope:

### `context`

```typescript
interface CronContext {
  jobId: string;       // UUID of the cron job
  jobName: string;     // Human-readable job name
  triggeredBy: 'schedule' | 'manual' | 'extension';  // How the run was triggered
  runId: string;       // UUID of this specific run
  scheduledAt: string; // ISO timestamp of scheduled execution time
}
```

**Usage:**

```javascript
console.log(`Job ${context.jobName} (${context.jobId}) triggered by ${context.triggeredBy}`);
console.log(`Run ID: ${context.runId}, scheduled at: ${context.scheduledAt}`);
```

### `services`

Service factories for interacting with DaaS data:

| Service                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `services.items(collection)`    | Full ItemsService for CRUD on any collection (17 methods) |
| `services.collections()`        | Read/manage collection metadata                |
| `services.fields()`             | Read/manage field definitions                  |
| `services.files()`              | Upload, import, download, manage files         |
| `services.versions()`           | Content versioning — create, save, promote     |
| `services.relations()`          | Manage foreign key relations                   |
| `services.mail()`               | Send emails via SMTP (`send()`, `verify()`)    |
| `services.mail(options)`        | Send email directly (shorthand)                |
| `services.custom(name, [opts])`     | Load a reusable user-defined custom service    |
| `services.cron.trigger(idOrName)`| Trigger another cron job by ID or name         |
| `services.cron.list([status])`  | List cron jobs (optionally filter by status)   |
| `services.cron.get(idOrName)`   | Get a single cron job by ID or name            |
| `services.fetch(url, options?)` | Domain-restricted HTTP requests                |
| `services.env`                  | Whitelisted env vars (`NODE_ENV`, `NEXT_PUBLIC_SITE_URL`) |
| `services.supabase`             | Raw Supabase client (service role, bypasses RLS) |

> See [Services API reference](../../hooks-extensions/references/services-api.instructions.md) for complete method signatures.

> **Cron accountability:** Cron jobs always run as the system user (`SYSTEM_USER_ID`, `admin: true`). There is no triggering user. All service calls are already fully elevated—`{ elevated: true }` is accepted by every factory but has no additional effect.

### `console`

Standard console methods — output is captured and stored in the `logs` array of `daas_cron_history`:

```javascript
console.log('Info message');     // Captured in history logs
console.warn('Warning message'); // Captured in history logs
console.error('Error message');  // Captured in history logs
```

### Built-in Globals

Standard JavaScript built-ins are available:

- `JSON` — `parse()`, `stringify()`
- `Date` — `new Date()`, `Date.now()`, `Date.parse()`
- `Math` — `floor()`, `ceil()`, `random()`, etc.
- `Array`, `Object`, `String`, `Number`, `Boolean`
- `Map`, `Set`, `Promise`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- `encodeURIComponent`, `decodeURIComponent`

### Blocked Globals

These are NOT available (security restrictions):

| Blocked              | Reason                                    |
| -------------------- | ----------------------------------------- |
| `setTimeout`         | Use cron scheduling instead               |
| `setInterval`        | Use cron scheduling instead               |
| `require`            | No module loading                          |
| `import`             | No ES module imports                       |
| `eval`               | No dynamic code execution                 |
| `Function`           | No constructor-based code execution       |
| `fetch`              | No direct HTTP access from sandbox        |
| `process`            | No Node.js process access                 |

---

## ItemsService API

The most commonly used service in cron jobs:

```javascript
const items = await services.items('collection_name');
```

### Available Methods

| Method                         | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `readByQuery(query)`           | Read items with filter/sort/limit               |
| `readByQueryWithCount(query)`  | Read items + total count (for pagination)       |
| `readOne(id, query?)`          | Read a single item by ID                        |
| `readMany(ids, query?)`        | Read multiple items by IDs                      |
| `readAggregate(query)`         | Run aggregate functions (count, sum, avg, etc.) |
| `getKeysByQuery(query)`        | Get just the primary keys matching a query      |
| `createOne(data)`              | Create a single item                            |
| `createMany(dataArray)`        | Create multiple items                           |
| `updateOne(id, data)`          | Update a single item                            |
| `updateMany(ids, data)`        | Update multiple items with same data            |
| `updateByQuery(query, data)`   | Update all items matching a filter              |
| `updateBatch(items)`           | Update multiple items with different data       |
| `deleteOne(id)`                | Delete a single item                            |
| `deleteMany(ids)`              | Delete multiple items                           |
| `deleteByQuery(query)`         | Delete all items matching a filter              |

### Query Parameters

```javascript
// readByQuery() returns Item[] directly (not { data: Item[] })
const results = await items.readByQuery({
  filter: {
    status: { _eq: 'pending' },
    created_at: { _lt: cutoffDate }
  },
  fields: ['id', 'title', 'status', 'created_at'],
  sort: ['-created_at'],
  limit: 500,
  offset: 0,
});
```

### Filter Operators

| Operator         | Description              |
| ---------------- | ------------------------ |
| `_eq`            | Equals                   |
| `_neq`           | Not equals               |
| `_gt`            | Greater than             |
| `_gte`           | Greater than or equal    |
| `_lt`            | Less than                |
| `_lte`           | Less than or equal       |
| `_in`            | In array                 |
| `_nin`           | Not in array             |
| `_null`          | Is null                  |
| `_nnull`         | Is not null              |
| `_contains`      | Contains substring       |
| `_ncontains`     | Does not contain         |
| `_starts_with`   | Starts with              |
| `_ends_with`     | Ends with                |
| `_and`           | Logical AND (array)      |
| `_or`            | Logical OR (array)       |

---

## Cron Expressions

Standard 5-field syntax: `minute hour day-of-month month day-of-week`

### Field Ranges

| Field          | Allowed Values  | Special Characters     |
| -------------- | --------------- | ---------------------- |
| Minute         | 0-59            | `*` `,` `-` `/`       |
| Hour           | 0-23            | `*` `,` `-` `/`       |
| Day of month   | 1-31            | `*` `,` `-` `/`       |
| Month          | 1-12            | `*` `,` `-` `/`       |
| Day of week    | 0-7 (0,7 = Sun) | `*` `,` `-` `/`       |

### Special Characters

| Character | Meaning                                         |
| --------- | ----------------------------------------------- |
| `*`       | Every value                                     |
| `,`       | Value list separator (`1,3,5`)                  |
| `-`       | Range (`1-5` = Monday to Friday)                |
| `/`       | Step values (`*/15` = every 15 units)           |

### Common Expressions

| Expression       | Meaning                      |
| ---------------- | ---------------------------- |
| `* * * * *`      | Every minute                 |
| `*/5 * * * *`    | Every 5 minutes              |
| `*/15 * * * *`   | Every 15 minutes             |
| `*/30 * * * *`   | Every 30 minutes             |
| `0 * * * *`      | Every hour (at :00)          |
| `0 */2 * * *`    | Every 2 hours                |
| `0 */6 * * *`    | Every 6 hours                |
| `0 */12 * * *`   | Every 12 hours               |
| `0 0 * * *`      | Daily at midnight            |
| `0 9 * * *`      | Daily at 09:00               |
| `0 9 * * 1-5`    | Weekdays at 09:00            |
| `0 0 * * 0`      | Weekly (Sundays at midnight) |
| `0 0 1 * *`      | Monthly (1st at midnight)    |
| `0 0 1 1 *`      | Yearly (Jan 1st at midnight) |
| `30 2 * * 0`     | Sundays at 02:30             |
| `0 8,12,18 * * *`| Daily at 08:00, 12:00, 18:00|

### Timezone Support

All cron expressions are evaluated in the specified timezone (IANA format):

```json
{
  "schedule": "0 9 * * 1-5",
  "timezone": "Asia/Singapore"
}
```

Common timezones:
- `UTC` (default)
- `Asia/Singapore`
- `Asia/Tokyo`
- `America/New_York`
- `Europe/London`
- `Australia/Sydney`

---

## Timeout & Resource Limits

| Property          | Default | Description                                |
| ----------------- | ------- | ------------------------------------------ |
| `timeout_ms`      | 30,000  | Max execution time before forced stop      |
| `memory_limit_mb` | 64      | Max memory allocation for job execution    |

If a job exceeds `timeout_ms`, it is terminated and the history record has `status: 'timeout'`.

---

## Error Handling

Errors thrown in cron code are caught and recorded in `daas_cron_history`:

```javascript
// Errors are captured in history.error field
const items = await services.items('orders');
const { data: orders } = await items.readByQuery({
  filter: { status: { _eq: 'processing' } },
  limit: 100,
});

if (orders.length === 0) {
  console.log('No orders to process');
  return; // Early return is fine
}

for (const order of orders) {
  try {
    await items.updateOne(order.id, { status: 'shipped' });
    console.log(`Shipped order ${order.id}`);
  } catch (err) {
    console.error(`Failed to ship order ${order.id}: ${err.message}`);
    // Continue processing remaining orders
  }
}
```

---

## Best Practices

### 1. Batch with Limits

Always use `limit` in queries to avoid processing too many records at once:

```javascript
// ✅ Good: Process in batches
const { data } = await items.readByQuery({ filter: {...}, limit: 500 });

// ❌ Bad: No limit — could return millions of rows
const { data } = await items.readByQuery({ filter: {...} });
```

### 2. Log Progress

Use `console.log()` liberally — logs are captured in history and invaluable for debugging:

```javascript
console.log(`Starting job at ${new Date().toISOString()}`);
console.log(`Found ${records.length} records to process`);
// ... process ...
console.log(`Completed: ${success} succeeded, ${failed} failed`);
```

### 3. Idempotent Operations

Design jobs to be safely re-runnable:

```javascript
// ✅ Good: Only process unprocessed items
const { data } = await items.readByQuery({
  filter: { processed: { _eq: false } },
  limit: 500,
});

// ❌ Bad: Assumes items haven't been processed before
const { data } = await items.readByQuery({ limit: 500 });
```

### 4. Use Appropriate Timeouts

Set `timeout_ms` based on expected workload:

| Job Type       | Suggested Timeout |
| -------------- | ----------------- |
| Simple cleanup | 15,000 (15s)      |
| Data migration | 120,000 (2min)    |
| External sync  | 60,000 (1min)     |
| Report gen     | 30,000 (30s)      |

### 5. Test Before Activating

Always create jobs as `inactive`, test with `run_now`, check history, then `activate`:

```
create (inactive) → run_now → history (check logs) → activate
```

````
