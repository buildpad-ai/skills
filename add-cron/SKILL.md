---
name: add-cron
description: Scaffold the Buildpad Cron Jobs module — ready-made /cron and /cron/[id] admin pages (CronJobsManager with a jobs list and a run History tab, CronJobDetail with a code editor slot, settings and per-job history, CronRunsTable, CronRunLogModal). Use when the user wants an admin UI to list, edit, run, activate, clone or delete DaaS cron jobs, or to inspect run history and logs. To create or change a cron job itself through DaaS (schedule, sandboxed code, manual trigger), use create-cron instead.
argument-hint: "[--cwd path/to/project]"
---

# Add the Cron Jobs Module

A ready-made cron administration surface installed via the Buildpad CLI (Copy & Own — the code is copied into your project). It manages two records of DaaS's built-in scheduler — **jobs** (`daas_cron_jobs`: a JavaScript snippet, a cron schedule read in a timezone, a timeout and a memory limit) and **runs** (`daas_cron_history`: one row per execution, with its outcome, trigger, duration, error and console output).

Two screens ship together:

- **`CronJobsManager`** — the `/cron` page. A **Jobs** tab: search by name, schedule or description, refresh, pagination, and a row menu with Edit, Run Now, Activate or Deactivate, Clone and Delete. A **History** tab: the runs of every job.
- **`CronJobDetail`** — the `/cron/[id]` editor: the job's code beside its settings (name, description, schedule, timezone, timeout, memory limit, and status for a stored job), with Run Now, Activate or Deactivate and Save in the header, and a second tab with the run history of that job.

A row of either history opens the run log (`CronRunLogModal`).

This module is the admin UI. What a job is, how its code runs, and how to create one through the API or the MCP tool is [create-cron](../create-cron/SKILL.md).

## CRITICAL: Never Create These Manually

Like all Buildpad UI, the Cron Jobs module is CLI-installed and owned as source. Do **not** hand-write `components/ui/cron-management/*` or the `useCronJobs` / `useCronRuns` hooks in `lib/buildpad/hooks/` — scaffold them. Do **not** build a custom scheduler, job table or log viewer either: cron jobs are a built-in platform feature (see [daas-platform](../daas-platform/SKILL.md)).

## Prerequisites Check

```bash
node --version && pnpm --version && npx --version
```

Requires Node.js v24 LTS and pnpm v10+ (see [add-buildpad](../add-buildpad/SKILL.md) for install guidance). The module **must** render under the authenticated layout (`buildpad init` generates `app/[lang]/(authenticated)/` with a `DaaSProviderWrapper`), with `<Notifications />` mounted and the Buildpad i18n provider in place (see [add-i18n](../add-i18n/SKILL.md)).

**This module calls DaaS directly from the browser. It has no proxy routes — do not add `api-routes` for it, and do not write the `/api/cron` proxy routes that [create-cron](../create-cron/SKILL.md) describes for hand-built pages.** Every request goes to `NEXT_PUBLIC_BUILDPAD_DAAS_URL` with the session token that `DaaSProviderWrapper` supplies:

```bash
# .env.local
NEXT_PUBLIC_BUILDPAD_DAAS_URL=https://your-daas.example.com
```

**DaaS CORS must be configured first.** The calls are cross-origin and authenticated. DaaS's default `cors_origins: ["*"]` is **incompatible** with credentialed requests — the browser blocks every preflight, and the list shows its load-error state. Set explicit origins before mounting the module (see [daas-platform](../daas-platform/SKILL.md) "CORS must use explicit origins").

The module works against both DaaS backends (the Supabase-backed DaaS and the Go engine); the hooks absorb their differences in list and error shapes.

## Installation

The Cron Jobs module is **opt-in** — it is not part of `bootstrap`. It adds **no npm package**.

```bash
# Two page shells, components/ui/cron-management/ (21 files), the vtable and
# input-code components when the app lacks them, the cron hooks, types and form
# logic, and a "Cron Jobs" sidebar entry under "Automation"
npx @buildpad/cli@latest add cron-routes --cwd /path/to/project
```

To install only the components (no pages, no sidebar entry) — for an app that has its own routes and shell:

```bash
npx @buildpad/cli@latest add cron-management --cwd /path/to/project
```

> The docs use the shorthand `buildpad add cron-routes` when the CLI is installed globally; `npx @buildpad/cli@latest add …` is the equivalent no-install form used across these skills.

> **If the CLI command fails, `@buildpad/cli` IS published to npm** — verify with `npm view @buildpad/cli version` before assuming otherwise. The CLI fetches its registry from `raw.githubusercontent.com`, so confirm the environment can reach **both** npm and the GitHub raw CDN. If `add cron-routes` reports an unknown target, the installed CLI predates this module: use `@latest`.

## The Routes

```
app/[lang]/(authenticated)/
└── cron/
    ├── page.tsx            # /cron       — CronJobsManager
    └── [id]/page.tsx       # /cron/[id]  — CronJobDetail (/cron/new creates)
```

The sidebar label is a dictionary key (`app.nav.cron`, with `app.nav.automation` for the group — the Workflows module shares that group). An app created before this module gets them with `npx @buildpad/cli@latest upgrade i18n`.

## Usage

The components never navigate. Each page passes router callbacks, so your router (and its locale prefix) decides where a click goes.

### List view — `CronJobsManager`

```tsx
// app/[lang]/(authenticated)/cron/page.tsx
"use client";

import { useLocaleRouter } from "@/lib/i18n/navigation";
import { CronJobsManager } from "@/components/ui/cron-management";

export default function CronJobsPage() {
  const router = useLocaleRouter();
  return (
    <CronJobsManager
      onJobClick={(job) => router.push(`/cron/${job.id}`)}
      onCreateJob={() => router.push("/cron/new")}
    />
  );
}
```

| Prop | Purpose |
| ----------------- | ------------------------------------------------------ |
| `onJobClick` | Open a job: row click, the job's name (a button), and the row menu's Edit. Without it rows do not open |
| `onCreateJob` | The permission-gated New Cron Job button. Without it the button is not drawn |
| `collection` | Collection the permission checks use (default `daas_cron_jobs`) |
| `pageSize` / `pageSizeOptions` / `historyPageSize` | Pagination control (25 jobs, 50 runs by default) |
| `hideHeader` | Embed the list without its heading |
| `urlParams` / `urlParamPrefix` | Search, page and the open tab live in the query string by default (`?search=…&page=2&tab=history`); turn off for an embedded list, prefix when two lists share a page |
| `translations` | Override strings for this instance |

Run Now is answered when the run has **ended**, not when it starts; the list reloads then. A job that was already running is not started again, and the notification says so. Next Run is shown for an active job only.

### Detail view — `CronJobDetail`

```tsx
// app/[lang]/(authenticated)/cron/[id]/page.tsx
"use client";

import { use } from "react";
import { useLocaleRouter } from "@/lib/i18n/navigation";
import { CronJobDetail } from "@/components/ui/cron-management";

export default function CronJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useLocaleRouter();
  return (
    <CronJobDetail
      id={id}
      onBack={() => router.push("/cron")}
      onCreated={(job) => router.push(`/cron/${job.id}`)}
    />
  );
}
```

**Navigate after a create.** After a successful create the editor goes on as the editor of the stored job (a further Save updates it; it does not create a second one), but the URL still says `/cron/new` and a reload would open an empty form. `onCreated` receives the stored job; navigate to `/cron/${job.id}` (as the generated page does) or to the list. Keep this when you customise the pages.

| Prop | Purpose |
| ----------------- | ------------------------------------------------------ |
| `id` (required) | The job's id, or `"new"` to create one |
| `onBack` | Breadcrumb, and the Back button of the not-found / access-denied / load-error states |
| `onCreated` / `onSaved` | Called with the stored job after a create / after a save of an existing job |
| `collection` | Collection the permission checks use (default `daas_cron_jobs`) |
| `readOnly` | Show the job with no way to change it |
| `defaultCode` / `codeHelp` | The code a new job starts with, and the "Cron Code" notice above the editor |
| `timezoneOptions` | Options of the Timezone select (default: the 26 whole-hour UTC offsets) |
| `renderCodeEditor` / `codeEditorMinHeight` | Your own code editor; see below |
| `historyPageSize` | Runs per page on the History tab |

Editor rules worth knowing before you customise:

- Name, schedule and code are required. Whether the schedule is a valid expression and whether the code compiles is the server's to say — a refused save shows the server's sentence.
- Save is disabled while nothing changed, and a save of an existing job sends **only the fields that changed**.
- Run Now and Activate wait for unsaved changes to be saved. Deactivate does not: it stops the job at once and keeps the edits in the form.
- Timeout and Memory Limit take whole numbers only.
- A stored timezone that is not one of the options is shown and kept as stored. Do not "normalise" it to UTC.

### The code editor slot

The built-in editor is `InputCode`: a monospace textarea with line numbers and **no syntax highlighting** — the module adds no editor library. To use a highlighting editor, install one in the app and pass `renderCodeEditor`. It receives `CronCodeEditorProps`: `value` (always a string), `onChange(value)` (pass `''`, not `null`, for an emptied editor), `readOnly`, `minHeight`, `placeholder`, and `id` / `aria-labelledby` / `aria-describedby` to put on the element that takes the text.

```tsx
<CronJobDetail
  id={id}
  onBack={() => router.push("/cron")}
  onCreated={(job) => router.push(`/cron/${job.id}`)}
  renderCodeEditor={(props) => <MyHighlightedEditor {...props} />}
/>
```

A custom editor **must honour `readOnly`**: a user without update access gets the editor read-only, code included. The slot is not called when the caller's read grant withholds the `code` field; the editor shows a notice instead.

What a job's code can call through `services` differs per backend (see [create-cron](../create-cron/SKILL.md)). The default code and the default notice name only what both backends give; a host that knows its backend can pass a better `defaultCode` and `codeHelp`.

### Supporting components (reuse anywhere)

`CronRunsTable` (`jobId?`, `showJobColumn`, `pageSize`, `refreshKey` — it owns its load, Refresh button and pager; use it to show runs on another page), `CronRunLogModal` (`run`, `onClose`, `showJobName`), and the badges `CronJobStatusBadge`, `CronRunStatusBadge`, `CronTriggerBadge`.

## The Data Layer (reuse anywhere)

Both screens are thin wrappers over two hooks from `@/lib/buildpad/hooks`:

```tsx
import { useCronJobs, useCronRuns } from "@/lib/buildpad/hooks";
```

- **`useCronJobs()`** → `fetchJobs({ page, limit, search, status })`, `getJob`, `createJob`, `updateJob`, `deleteJob`, `cloneJob(id, name?)` (the copy is inactive), `runJob` (+ `loading`, `error`, `errorInfo`)
- **`useCronRuns()`** → `fetchRuns({ page, limit, offset })` (every job), `fetchJobRuns(jobId, params)` (one job), both newest first

Three details matter when you call the hooks yourself:

- On a `CronJobRecord` only `id` and `name` are certain. A field the caller's grant withholds is **absent**, `code` above all. An absent field is not an empty value: do not show a default in its place, and do not send one back.
- `runJob` resolves when the run has ended, to `{ historyId, skipped, message }`. `skipped` is `true` when the job was already running and nothing ran. A run whose code failed still resolves; its outcome is the status of the history row.
- `loading` is true while any request of that hook instance is in flight, a run included. Keep a pending flag per action where that matters.

Every method rejects with a typed `DaaSRequestError` whose `kind` is `notFound | forbidden | mfaRequired | unauthenticated | invalid | failure` (`invalid`: a schedule that is not a cron expression, or code that does not compile — the `message` is the server's sentence). Branch on `kind`; never treat a rejected load as an empty list. Types (`CronJobRecord`, `CronRunRecord`, …) and the collection-name constant (`CRON_JOBS_COLLECTION`) come from `@/lib/buildpad/types`; the pure form logic (`cronJobToForm`, `changedCronJobFields`, `findCronJobFormProblem`, `cronTimezoneOptions`, `parseCronLogLine`, …) from `@/lib/buildpad/utils` — use it when you write a custom editor, so your saves send only what the user changed.

## Access-Control Semantics (IMPORTANT)

- Every check uses one collection: **`daas_cron_jobs`**. Both backends decide every cron route by the caller's grant on it, the two history routes included. **A grant on `daas_cron_history` opens nothing.**
- `read`: no check in the UI — the API's answer decides, and a refusal draws the access-denied state. `create`: the New Cron Job button, Clone, and `/cron/new`. `update`: Edit, Run Now, Activate, Deactivate and Save; without it the editor is read-only, code included. `delete`: the row menu's Delete. A row menu with no allowed action is not drawn.
- Until the permissions are known, no write control is drawn and the editor takes no edit. Do not "fix" that by rendering buttons optimistically.
- The gates only hide controls. Grant the collection permissions through policies (see [create-rbac](../create-rbac/SKILL.md)); a hidden button is not the protection.
- Gate your navigation link too, so a user without read access to `daas_cron_jobs` does not see Cron Jobs in the sidebar.
- A job's code runs on the server as the System Service user, with permission checks bypassed (see [create-cron](../create-cron/SKILL.md) "Background Process User Context") — not as the user who edited it. Treat `create` and `update` on `daas_cron_jobs` as the right to run code on the server, and grant them accordingly.

## Post-Install Validation

```bash
npx @buildpad/cli@latest status --cwd /path/to/project
npx @buildpad/cli@latest validate --cwd /path/to/project
cd /path/to/project && pnpm build
```

Then open `/cron` signed in as a user with read on `daas_cron_jobs`: the list loads (an empty DaaS shows the empty state, not a load error). A load error on the list means `NEXT_PUBLIC_BUILDPAD_DAAS_URL` or the DaaS CORS origins are wrong.

## Related

- [create-cron](../create-cron/SKILL.md) — create a cron job through DaaS: schedule, sandboxed code, manual trigger, history.
- [add-workflows](../add-workflows/SKILL.md) — the Workflows module; it shares the "Automation" sidebar group.
- [add-buildpad](../add-buildpad/SKILL.md) — the underlying CLI and low-level field widgets.
- [create-rbac](../create-rbac/SKILL.md) — the collection permissions this module's gates read.
- [buildpad-reference](../buildpad-reference/SKILL.md) — full component catalog.
