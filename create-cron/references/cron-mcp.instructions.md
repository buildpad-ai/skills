````instructions
---
name: Cron MCP Tool Reference
description: Complete mcp_daas_cron tool reference for AI agents managing scheduled jobs
applyTo: "**/*.{ts,tsx,json}"
---

# MCP Tool: `mcp_daas_cron`

Manage and monitor DaaS cron jobs from AI agents or MCP clients. All actions require **admin** authentication.

---

## Actions Overview

| Action           | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `list`           | List jobs (optionally filter by `status`)  |
| `read`           | Get a single job by ID                     |
| `create`         | Create a new cron job                      |
| `update`         | Update job config + hot-reload schedule    |
| `delete`         | Delete job and cascade history             |
| `activate`       | Set status to active + start scheduling    |
| `deactivate`     | Set status to inactive + stop scheduling   |
| `clone`          | Duplicate a job (always creates inactive)  |
| `run_now`        | Manually trigger a job immediately         |
| `history`        | Get execution history for a specific job   |
| `recent_history` | Get history across all jobs                |
| `stats`          | Get runtime stats (scheduled count, etc.)  |

---

## Action: `create`

Create a new cron job. **Always create as `inactive` first, test, then activate.**

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "create",
    "name": "Nightly Cleanup",
    "description": "Archive stale records every night",
    "schedule": "0 0 * * *",
    "timezone": "Asia/Singapore",
    "code": "const items = await services.items('sessions');\nconst cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();\nconst { data: stale } = await items.readByQuery({ filter: { updated_at: { _lt: cutoff }, status: { _eq: 'pending' } }, limit: 500 });\nfor (const session of stale) { await items.deleteOne(session.id); }\nconsole.log(`Cleaned up ${stale.length} stale sessions`);",
    "status": "inactive",
    "timeout_ms": 60000
  }
}
```

**Parameters:**

| Parameter        | Type    | Required | Default | Description                           |
| ---------------- | ------- | -------- | ------- | ------------------------------------- |
| `name`           | string  | Yes      | —       | Human-readable job name               |
| `description`    | string  | No       | —       | Job description                       |
| `schedule`       | string  | Yes      | —       | 5-field cron expression               |
| `timezone`       | string  | No       | `UTC`   | IANA timezone                         |
| `code`           | string  | Yes      | —       | JavaScript code to execute            |
| `status`         | string  | No       | `inactive` | `active` or `inactive`             |
| `timeout_ms`     | integer | No       | 30000   | Max execution time in milliseconds    |
| `memory_limit_mb`| integer | No       | 64      | Max memory allocation in MB           |

---

## Action: `list`

List all cron jobs, optionally filtered by status.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "list"
  }
}
```

With status filter:

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "list",
    "status": "active"
  }
}
```

---

## Action: `read`

Get a single cron job by ID.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "read",
    "id": "<job-uuid>"
  }
}
```

---

## Action: `update`

Update a cron job. Changes are hot-reloaded — if the job is active, the schedule is updated immediately.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "update",
    "id": "<job-uuid>",
    "schedule": "*/30 * * * *",
    "code": "console.log('Updated logic');",
    "timeout_ms": 45000
  }
}
```

---

## Action: `delete`

Delete a cron job and all its execution history (cascade).

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "delete",
    "id": "<job-uuid>"
  }
}
```

---

## Action: `activate`

Set a job to `active` status and start scheduling it.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "activate",
    "id": "<job-uuid>"
  }
}
```

---

## Action: `deactivate`

Set a job to `inactive` status and stop scheduling it.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "deactivate",
    "id": "<job-uuid>"
  }
}
```

---

## Action: `clone`

Duplicate an existing job. The clone is always created as `inactive`.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "clone",
    "id": "<job-uuid>"
  }
}
```

---

## Action: `run_now`

Manually trigger a job immediately, regardless of its schedule or status.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "run_now",
    "id": "<job-uuid>"
  }
}
```

The history entry will have `triggered_by: "manual"`.

---

## Action: `history`

Get execution history for a specific job.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "history",
    "id": "<job-uuid>",
    "limit": 20
  }
}
```

**Parameters:**

| Parameter | Type    | Default | Description |
| --------- | ------- | ------- | ----------- |
| `id`      | string  | —       | Job UUID    |
| `limit`   | integer | 50      | Max entries |
| `offset`  | integer | 0       | Pagination  |

**Response includes:**

```json
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
  "logs": ["Cleaned up 42 stale sessions"],
  "triggered_by": "schedule"
}
```

**History status values:**

| Status    | Meaning                                     |
| --------- | ------------------------------------------- |
| `running` | Job is currently executing                  |
| `success` | Job completed without errors                |
| `error`   | Job threw an error (see `error` field)      |
| `timeout` | Job exceeded `timeout_ms` and was stopped   |

---

## Action: `recent_history`

Get execution history across all jobs.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "recent_history",
    "limit": 50
  }
}
```

---

## Action: `stats`

Get runtime statistics.

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "stats"
  }
}
```

**Response:**

```json
{
  "total_jobs": 5,
  "active_jobs": 3,
  "inactive_jobs": 2,
  "currently_running": 0,
  "scheduled_count": 3
}
```

---

## Complete Workflow Example

### Step 1: Create Inactive Job

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "create",
    "name": "Sync to CRM",
    "description": "Sync new contacts to external CRM every 6 hours",
    "schedule": "0 */6 * * *",
    "timezone": "UTC",
    "code": "const items = await services.items('contacts');\nconst { data: unsynced } = await items.readByQuery({ filter: { synced: { _eq: false } }, limit: 100 });\nfor (const c of unsynced) { await items.updateOne(c.id, { synced: true, synced_at: new Date().toISOString() }); }\nconsole.log(`Synced ${unsynced.length} contacts`);",
    "status": "inactive",
    "timeout_ms": 60000
  }
}
```

### Step 2: Test with Manual Trigger

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "run_now",
    "id": "<job-id>"
  }
}
```

### Step 3: Check Logs

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

### Step 4: Activate

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "activate",
    "id": "<job-id>"
  }
}
```

### Step 5: Monitor

```json
{
  "name": "mcp_daas_cron",
  "arguments": {
    "action": "stats"
  }
}
```

---

## Error Handling

MCP errors follow JSON-RPC 2.0 format:

```json
{
  "error": {
    "code": -32603,
    "message": "Cron job not found"
  }
}
```

| Error Message                  | Cause                        | Solution                       |
| ------------------------------ | ---------------------------- | ------------------------------ |
| "Admin access required"        | Non-admin user               | Use admin token                |
| "Cron job not found"           | Invalid job ID               | Check UUID                     |
| "Invalid cron expression"      | Bad schedule syntax           | Validate 5-field expression    |
| "Job is currently running"     | Overlap protection active    | Wait for completion            |
| "Cron jobs are disabled"       | `CRON_ENABLED=false`         | Enable in environment          |

---

## Related

- [Cron sandbox environment](./cron-sandbox.instructions.md)
- [Cron REST API routes](./cron-api.instructions.md)
- [DaaS MCP tools overview](../../daas-platform/references/daas-mcp-tools.instructions.md)

````
