````instructions
---
name: Cron REST API Routes
description: DaaS cron REST API endpoints and Next.js proxy route patterns
applyTo: "**/*.{ts,tsx}"
---

# Cron REST API Routes

DaaS provides a complete REST API for managing cron jobs. All routes require **admin** authentication.

---

## DaaS Backend Endpoints

| Method   | Path                     | Description                        |
| -------- | ------------------------ | ---------------------------------- |
| `GET`    | `/api/cron`              | List all cron jobs                 |
| `POST`   | `/api/cron`              | Create a cron job                  |
| `GET`    | `/api/cron/:id`          | Get a single cron job              |
| `PATCH`  | `/api/cron/:id`          | Update + hot-reload a cron job     |
| `DELETE` | `/api/cron/:id`          | Delete job (cascades history)      |
| `POST`   | `/api/cron/:id/run`      | Manually trigger immediately       |
| `GET`    | `/api/cron/:id/history`  | Execution history for a job        |
| `GET`    | `/api/cron/history`      | Recent history across all jobs     |

---

## Create Request Body

```json
{
  "name": "Nightly Cleanup",
  "description": "Archive stale records every night",
  "schedule": "0 0 * * *",
  "timezone": "Asia/Singapore",
  "code": "console.log('Running cleanup...');",
  "status": "inactive",
  "timeout_ms": 60000
}
```

**Fields:**

| Field            | Type    | Required | Default    | Description                    |
| ---------------- | ------- | -------- | ---------- | ------------------------------ |
| `name`           | string  | Yes      | —          | Job name (max 255 chars)       |
| `description`    | string  | No       | —          | Job description                |
| `schedule`       | string  | Yes      | —          | 5-field cron expression        |
| `timezone`       | string  | No       | `UTC`      | IANA timezone string           |
| `code`           | string  | Yes      | —          | JavaScript code to execute     |
| `status`         | string  | No       | `inactive` | `active` or `inactive`         |
| `timeout_ms`     | integer | No       | 30000      | Max execution time (ms)        |
| `memory_limit_mb`| integer | No       | 64         | Max memory (MB)                |

---

## Update Request Body (PATCH)

Only include fields you want to change:

```json
{
  "schedule": "*/30 * * * *",
  "code": "console.log('Updated!');",
  "timeout_ms": 45000
}
```

Active jobs are hot-reloaded — the updated schedule takes effect immediately.

---

## History Query Parameters

```
GET /api/cron/:id/history?limit=50&offset=0
GET /api/cron/history?limit=50&offset=0
```

| Parameter | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `limit`   | integer | 50      | Number of entries to return |
| `offset`  | integer | 0       | Pagination offset          |

---

## History Response

```json
{
  "data": [
    {
      "id": "history-uuid",
      "job_id": "job-uuid",
      "job_name": "Nightly Cleanup",
      "triggered_at": "2026-03-05T00:00:00.000Z",
      "started_at": "2026-03-05T00:00:00.050Z",
      "finished_at": "2026-03-05T00:00:02.150Z",
      "duration_ms": 2100,
      "status": "success",
      "error": null,
      "logs": ["Starting cleanup...", "Cleaned up 42 records"],
      "triggered_by": "schedule"
    }
  ]
}
```

---

## Next.js Proxy Routes

Per Rule 4 (Server-Side Proxy — No CORS), all browser-to-DaaS calls must go through Next.js API proxy routes.

### Route Structure

```
app/
  api/
    cron/
      route.ts                  →  GET /api/cron, POST /api/cron
      history/
        route.ts                →  GET /api/cron/history
      [id]/
        route.ts                →  GET, PATCH, DELETE /api/cron/:id
        run/
          route.ts              →  POST /api/cron/:id/run
        history/
          route.ts              →  GET /api/cron/:id/history
```

### List & Create — `app/api/cron/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}

export async function POST(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}
```

### Global History — `app/api/cron/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  return proxyToDaaS(request, `/api/cron/history?limit=${limit}&offset=${offset}`);
}
```

### Single Job CRUD — `app/api/cron/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}
```

### Manual Trigger — `app/api/cron/[id]/run/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}/run`);
}
```

### Job History — `app/api/cron/[id]/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  return proxyToDaaS(request, `/api/cron/${id}/history?limit=${limit}&offset=${offset}`);
}
```

---

## Database Tables

### `daas_cron_jobs`

```
id              uuid  PK
name            varchar(255)
description     text
schedule        varchar(100)     -- 5-field cron expression
timezone        varchar(64)      -- default UTC
code            text
status          enum: active | inactive
timeout_ms      integer          -- default 30000
memory_limit_mb integer          -- default 64
running         boolean          -- overlap lock
running_since   timestamptz
last_run_at     timestamptz
last_run_status enum: running | success | error | timeout
next_run_at     timestamptz      -- pre-computed for display
created_at / updated_at / created_by / updated_by
```

### `daas_cron_history`

```
id              uuid  PK
job_id          uuid  FK → daas_cron_jobs (ON DELETE CASCADE)
job_name        text  (denormalized)
triggered_at    timestamptz
started_at      timestamptz
finished_at     timestamptz
duration_ms     integer
status          enum: running | success | error | timeout
error           text
logs            text[]           -- captured console.log lines
triggered_by    enum: schedule | manual
```

---

## Environment Variables

| Variable                 | Default | Description                     |
| ------------------------ | ------- | ------------------------------- |
| `CRON_ENABLED`           | `true`  | Set `false` to disable all jobs |
| `CRON_HISTORY_RETENTION` | `100`   | History rows kept per job       |

---

## Overlap Protection

If a job is still running when the next scheduled tick fires, the tick is skipped. The `running` boolean in `daas_cron_jobs` is set atomically before execution and cleared on completion.

If the process crashes mid-job, `running` stays `true`. The flag can be ignored after `timeout_ms * 2` has elapsed.

---

## History Retention

Default: **100 rows per job**. Old rows are pruned automatically after each run via the `prune_cron_history` PostgreSQL function.

---

## Related

- [Cron sandbox environment](./cron-sandbox.instructions.md)
- [Cron MCP tool](./cron-mcp.instructions.md)
- [DaaS API reference](../../daas-platform/references/daas-api.instructions.md)

````
