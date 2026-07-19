---
name: create-cron
description: Create and manage DaaS cron jobs for scheduled background tasks. Sets up recurring jobs with cron expressions, sandboxed JS code, timezone support, execution history, and overlap protection. Use when the user needs scheduled tasks, recurring jobs, background processing, or timed automation.
argument-hint: "[job name] [schedule: every-minute|hourly|daily|weekly|monthly|custom]"
---

# Create Cron Job

Set up scheduled background tasks using the DaaS cron system. Cron jobs run recurring logic — archive stale records, send digests, sync external systems — without deploying new code.

## Overview

Cron jobs are stored in the database (`daas_cron_jobs`) and executed at runtime using the same JavaScript sandbox as [Runtime Extensions](../hooks-extensions/SKILL.md). They are managed via REST API or MCP.

**Key properties:**

| Property    | Description                                           |
| ----------- | ----------------------------------------------------- |
| Schedule    | Standard 5-field cron expression (`min hour dom mon dow`) |
| Timezone    | IANA timezone string (default `UTC`)                  |
| Code        | JS snippet (same sandbox as runtime extensions)       |
| Status      | `active` / `inactive`                                 |
| Timeout     | Max execution time in ms (default 30,000)             |
| History     | Every run is recorded in `daas_cron_history`          |

## Setup Steps

### 1. Create a Cron Job (Inactive First)

Always create jobs as `inactive` initially, test them, then activate.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "create",
    "name": "Nightly Cleanup",
    "description": "Archive stale sessions every night at midnight",
    "schedule": "0 0 * * *",
    "timezone": "Asia/Singapore",
    "code": "const items = await services.items('sessions');\nconst cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();\nconst stale = await items.readByQuery({ filter: { updated_at: { _lt: cutoff }, status: { _eq: 'pending' } }, limit: 500 });\nfor (const session of stale) { await items.deleteOne(session.id); }\nconsole.log(`Cleaned up ${stale.length} stale sessions`);",
    "status": "inactive",
    "timeout_ms": 60000
  }
}
```

### 2. Test with Manual Trigger

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "run_now",
    "id": "<job-id>"
  }
}
```

### 3. Check Execution History

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "history",
    "id": "<job-id>",
    "limit": 5
  }
}
```

### 4. Activate When Satisfied

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "activate",
    "id": "<job-id>"
  }
}
```

## Cron Expressions

Standard 5-field syntax: `min hour dom mon dow`

| Expression      | Meaning              |
| --------------- | -------------------- |
| `* * * * *`     | Every minute         |
| `0 * * * *`     | Every hour           |
| `0 9 * * 1-5`   | Weekdays at 09:00    |
| `0 0 * * *`     | Daily at midnight    |
| `0 0 1 * *`     | Monthly (1st)        |
| `*/15 * * * *`  | Every 15 minutes     |
| `0 */6 * * *`   | Every 6 hours        |
| `30 2 * * 0`    | Sundays at 02:30     |

## Code Sandbox

Cron code runs in the same sandboxed environment as runtime extensions.

### Available Context Variables

| Variable   | Available | Description                                                    |
| ---------- | --------- | -------------------------------------------------------------- |
| `context`  | ✅        | `{ jobId, jobName, triggeredBy, runId, scheduledAt }`          |
| `services` | ✅        | Full services object (12 members — see table below)            |
| `console`  | ✅        | Captured output (appears in history `logs[]`)                  |
| `JSON`     | ✅        | Standard JSON object                                           |
| `Date`     | ✅        | Standard Date object                                           |
| `Math`     | ✅        | Standard Math object                                           |

**NOT available in cron jobs** (these are extension-only):
- ❌ `payload` — Not applicable
- ❌ `meta` — Not applicable
- ❌ `event` — Not applicable
- ❌ `accountability` — Not injected

Cron jobs access data exclusively through `services.*` calls.

### Background Process User Context

Cron jobs run as the **System Service** user (`00000000-0000-0000-0000-000000000000`). This means:

- `user-created` and `user-updated` special fields are auto-set to the system user UUID
- Audit log entries (`daas_activity`) attribute mutations to this system user
- Permission checks are bypassed (admin-level access)
- The system user cannot log in interactively — it exists only in `daas_users`, not in `auth.users`

> **Important:** `readByQuery()` returns `Item[]` directly — **not** `{ data: Item[] }`. The `{ data }` wrapper only exists in REST API responses. Do not destructure with `const { data } = await items.readByQuery(...)`.

### Available Services

| Service                        | Access                                                      |
| ------------------------------ | ----------------------------------------------------------- |
| `services.items(collection)`   | Full ItemsService (readByQuery, createOne, updateOne…)      |
| `services.collections()`       | CollectionsService                                          |
| `services.fields()`            | FieldsService                                               |
| `services.files()`             | FilesService                                                |
| `services.versions()`          | VersionService                                              |
| `services.relations()`         | RelationsService                                            |
| `services.mail()`              | MailService instance (`send()`, `verify()`)                 |
| `services.mail(options)`       | Send email directly (shorthand, returns `SendMailResult`)   |
| `services.fetch(url, opts)`    | Domain-restricted HTTP fetch (same `safeFetch` as extensions) |
| `services.custom(name)`        | Get a custom reusable service module (see [Custom Services](../create-service/SKILL.md)) |
| `services.supabase`            | Raw Supabase client (service role, bypasses RLS)            |
| `services.env`                 | Whitelisted environment variables (`NODE_ENV`, `NEXT_PUBLIC_SITE_URL`) |

### `mcp_daas_cron` Actions

| Action     | Parameters                                                                 | Purpose                        |
| ---------- | -------------------------------------------------------------------------- | ------------------------------ |
| `list`     | —                                                                          | List all cron jobs             |
| `read`     | `id`                                                                       | Read job details               |
| `create`   | `name`, `code`, `schedule`, `description?`, `timezone?`, `status?`, `timeout_ms?` | Create a cron job     |
| `update`   | `id`, `name?`, `code?`, `schedule?`, `status?`, `timeout_ms?`, …          | Update a cron job              |
| `delete`   | `id`                                                                       | Delete a cron job              |
| `run_now`  | `id`                                                                       | Manually trigger job immediately |
| `activate` | `id`                                                                       | Set status to active           |
| `deactivate` | `id`                                                                     | Set status to inactive         |
| `history`  | `id`, `limit?`                                                             | View run history with logs     |
| `clone`    | `id`, `name?`                                                              | Clone a cron job               |

### Blocked Globals

`setTimeout`, `setInterval`, `require`, `import`, `eval`, `Function` constructor.

## Common Patterns

### Data Cleanup

```javascript
// Archive items older than 30 days
const items = await services.items('temp_uploads');
const cutoff = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
const expired = await items.readByQuery({
  filter: { created_at: { _lt: cutoff } },
  limit: 1000,
});
for (const item of expired) {
  await items.deleteOne(item.id);
}
console.log(`Archived ${expired.length} expired uploads`);
```

### Digest / Report Generation

```javascript
// Daily summary of new items
const items = await services.items('orders');
const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString();
const newOrders = await items.readByQuery({
  filter: { created_at: { _gte: yesterday } },
  fields: ['id', 'total', 'status'],
});
const total = newOrders.reduce((sum, o) => sum + (o.total || 0), 0);
console.log(`Daily report: ${newOrders.length} orders, total: $${total}`);
```

### External Sync

```javascript
// Sync contacts to external CRM every 6 hours
const items = await services.items('contacts');
const unsynced = await items.readByQuery({
  filter: { synced: { _eq: false } },
  limit: 100,
});
for (const contact of unsynced) {
  // Process sync logic with services.supabase if needed
  await items.updateOne(contact.id, { synced: true, synced_at: new Date().toISOString() });
}
console.log(`Synced ${unsynced.length} contacts`);
```

### Status Escalation

```javascript
// Auto-escalate unresolved tickets after 48 hours
const items = await services.items('tickets');
const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
const overdue = await items.readByQuery({
  filter: {
    _and: [
      { status: { _eq: 'open' } },
      { created_at: { _lt: cutoff } },
      { priority: { _neq: 'critical' } }
    ]
  },
  limit: 200,
});
for (const ticket of overdue) {
  await items.updateOne(ticket.id, { priority: 'critical', escalated_at: new Date().toISOString() });
}
console.log(`Escalated ${overdue.length} overdue tickets`);
```

## Next.js API Proxy Routes

All cron API calls from the browser must go through Next.js proxy routes (Rule 4: No CORS).

### Proxy Route Pattern

```typescript
// app/api/cron/route.ts
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}

export async function POST(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}
```

```typescript
// app/api/cron/[id]/route.ts
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}
```

```typescript
// app/api/cron/[id]/run/route.ts
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}/run`);
}
```

```typescript
// app/api/cron/[id]/history/route.ts
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}/history`);
}
```

## Environment Variables

| Variable                  | Default | Description                      |
| ------------------------- | ------- | -------------------------------- |
| `CRON_ENABLED`            | `true`  | Set `false` to disable all jobs  |
| `CRON_HISTORY_RETENTION`  | `100`   | History rows kept per job        |

## Overlap Protection

If a job takes longer than its schedule interval, the next tick is automatically skipped. The DB `running` flag prevents concurrent runs of the same job.

## History Retention

Default: **100 rows per job** (configurable via `CRON_HISTORY_RETENTION`). Old rows are pruned automatically after each run.

## References

- [Cron expressions & sandbox](references/cron-sandbox.instructions.md)
- [Cron MCP tool](references/cron-mcp.instructions.md)
- [Cron API routes](references/cron-api.instructions.md)

````
