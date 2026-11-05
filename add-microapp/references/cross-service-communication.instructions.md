# Cross-Domain Data Access

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

## Overview

In the single shared DaaS architecture, all micro-apps connect to the **same DaaS backend**. Cross-domain data access is straightforward — any app can query any collection directly from the browser, subject to the user's RBAC permissions.

<!-- buildpad-backend: supabase -->
Buildpad UI components call DaaS **directly** through `DaaSProvider`, which supplies the `Authorization: Bearer <supabase-jwt>` and `X-Resource-Uri` headers. CORS for that path is configured on DaaS via `CORS_ORIGINS`. Hand-written fetches go through a proxy route in the same app. The examples below use the direct path because they run inside components.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
Buildpad UI components call the Engine **directly** through `DaaSProvider`, which supplies the signed-in user's access token as `Authorization: Bearer <access token>` and the `X-Resource-Uri` header. On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere. Hand-written fetches go through a proxy route in the same app. The examples below use the direct path because they run inside components.
<!-- /buildpad-backend -->

## Data Access Patterns

### 1. Direct Collection Query (Primary Pattern)

The simplest and most common approach — a micro-app queries a collection from another domain directly:

```typescript
import { useDaaSContext } from '@/lib/buildpad/services';

// billing-app needs user profile data
// Just query the profiles collection — it's in the same DaaS!
export function useProfile(userId: string) {
  const { buildUrl, getHeaders } = useDaaSContext();

  return useEffect(() => {
    fetch(buildUrl(`/api/items/profiles/${userId}`), { headers: getHeaders() })
      .then(r => r.json())
      .then(({ data: profile }) => setProfile(profile));
  }, [userId]);
}
```

**When to use:**

- Any time you need data from another domain's collection
- Simple lookups (get by ID, filter by field)
- This is the default approach — no extra setup needed

**Why it works:**

<!-- buildpad-backend: supabase -->
- All apps share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`
- DaaS has CORS configured via `CORS_ORIGINS` env var
- DaaS RBAC controls what the authenticated user can access
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- All apps share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`, the Engine_URL
- The Engine accepts requests from any origin, without cookies, as the project is provisioned: nothing to configure
- The Engine's roles, policies and permissions control what the signed-in user can access
<!-- /buildpad-backend -->

### 2. DaaS Relational Fields (Recommended for Related Data)

When collections have relationships (M2O, O2M, M2M), use DaaS deep queries to fetch related data in a single request:

```typescript
import { useDaaSContext } from '@/lib/buildpad/services';

export function useInvoiceWithUser(invoiceId: string) {
  const { buildUrl, getHeaders } = useDaaSContext();

  return useEffect(() => {
    // Fetch invoice with user profile data in ONE request
    fetch(buildUrl(`/api/items/invoices/${invoiceId}?fields=*,user_id.display_name,user_id.email`), {
      headers: getHeaders()
    })
      .then(r => r.json())
      .then(({ data: invoice }) => {
        // invoice.user_id = { display_name: 'John Doe', email: 'john@example.com' }
        setInvoice(invoice);
      });
  }, [invoiceId]);
}
```

**When to use:**

- Collections have defined relational fields in DaaS schema
- You need data from related collections on the same page
- Performance matters (one request vs. multiple)

<!-- buildpad-backend: supabase -->
**Setup (via MCP):**

```json
// Define M2O relation: invoices.user_id → profiles.id
// mcp_daas_fields -> action: create
// Setting meta.options.related_collection auto-creates the FK constraint + daas_relations row
{
  "collection": "invoices",
  "field": "user_id",
  "type": "uuid",
  "meta": {
    "interface": "list-m2o",
    "special": ["m2o"],
    "options": {
      "related_collection": "profiles",
      "on_delete": "SET NULL"
    }
  }
}
```

> **Non-PK FK target:** If the FK references a non-PK column (e.g. `uri_path` instead of `id`), add `"related_field": "uri_path"` inside `options`. For UUID primary key targets, `related_field` can be omitted (defaults to the PK).
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
**Setup (via MCP):** create the field, then the relation. On an Engine project a relation is created with the MCP `relations` tool (or `POST /api/relations`), after its field exists.

```json
// Define M2O relation: invoices.user_id → profiles.id
// 1. mcp_daas_fields -> action: create
{
  "action": "create",
  "collection": "invoices",
  "data": {
    "collection": "invoices",
    "field": "user_id",
    "type": "uuid",
    "meta": { "interface": "list-m2o", "special": ["m2o"] }
  }
}

// 2. mcp_daas_relations -> action: create
{
  "action": "create",
  "data": {
    "collection": "invoices",
    "field": "user_id",
    "related_collection": "profiles",
    "schema": { "on_delete": "SET NULL" }
  }
}
```

> **Non-PK FK target:** If the FK references a non-PK column (e.g. `uri_path` instead of `id`), add `"related_field": "uri_path"` to the relation's `data`. For primary key targets, `related_field` can be omitted (defaults to the PK).
<!-- /buildpad-backend -->

### 3. Data Denormalization (Performance Pattern)

Store a read-only copy of frequently needed cross-domain data:

```typescript
// Invoice stores user_display_name directly
// Instead of fetching from profiles on every read
{
  "id": "inv-001",
  "user_id": "user-123",
  "user_display_name": "John Doe",  // Denormalized from profiles
  "amount": 99.99
}
```

**When to use:**

- High-frequency reads where the relational query adds latency
- Data that changes infrequently (display names, emails)
- Reporting/analytics where historical accuracy matters

**Keeping it fresh:**

- Use DaaS action hooks: when a profile updates, update denormalized fields
- Accept staleness for display-only fields
- Use relational queries for real-time accuracy when needed

<!-- buildpad-backend: supabase -->
### 4. DaaS Runtime Extensions (Event-Based)

Use DaaS action hooks to trigger cross-domain side effects:

```javascript
// DaaS action hook: after invoices.create
// Automatically create an analytics event when an invoice is created
module.exports = function registerHook({ action }) {
  action(
    "invoices.items.create",
    async ({ payload, accountability }, { services }) => {
      const { ItemsService } = services;
      const eventsService = new ItemsService("events", { accountability });

      await eventsService.createOne({
        type: "invoice.created",
        source_collection: "invoices",
        source_id: payload.id,
        user_id: accountability.user,
        metadata: { amount: payload.amount },
      });
    },
  );
};
```

**When to use:**

- Automatic side effects across domains (audit trail, notifications)
- Data synchronization between collections
- Business rules that span multiple domains
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### 4. Stored Event Hooks (Event-Based)

Use an action hook stored in the Engine to trigger cross-domain side effects. On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the table [Engine runtime](#engine-runtime) lists; for each interface it lacks, the table says what replaces it.

The hook below is an `action` hook on the event `invoices.items.create`. Store it with
`POST /api/extensions` and an administrator's session, giving `name`, `event`,
`type: "action"`, `code` (the body below) and `status: "active"` (an omitted status stores
`inactive`), or with the Engine's MCP tool `extensions` (administrators only). `code` is the body of a function that
receives `meta`, `context` and `services`:

```javascript
// Engine action hook body — event: invoices.items.create
// Automatically create an analytics event when an invoice is created
await services.items("events").createOne({
  type: "invoice.created",
  source_collection: "invoices",
  source_id: meta.key,
  user_id: context.accountability.user,
  metadata: { amount: meta.payload.amount },
});
```

On a create, `meta.key` is the new item's key and `meta.payload` is what was written. The hook
runs as the user who created the invoice, so `services.items` is held to that user's
permissions. Where that user may not create `events`, call
`services.items("events", { elevated: true })`: it acts as an administrator, and the audit
trail still names the user.

**When to use:**

- Automatic side effects across domains (audit trail, notifications)
- Data synchronization between collections
- Business rules that span multiple domains

#### Engine runtime

What stored code (hooks, cron jobs, custom services) has on the Engine, from the Engine's automation runtime documentation (its sections in brackets).

| Interface taught on a Supabase_Project | On the Engine | Replacement |
|---|---|---|
| The Supabase service in stored code (`services.supabase`) | Refused permanently, 501 `RUNTIME_SUPABASE_UNAVAILABLE` (§2.4) | `services.items(collection)`, with `{ elevated: true }` where the job must act as an administrator |
| SQL functions and raw SQL from stored code | No path (§2) | `services.items` calls, or a custom service |
| `services.items(c)` methods | Nine: `readByQuery`, `readOne`, `readMany`, `createOne`, `createMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`; `readByQuery` returns the array itself (§2) | Read `result`, not `result.data` |
| Query keys | `fields`, `filter`, `sort`, `limit`, `page`, `offset`, `search`; any other key is refused | Drop the key |
| Schema services | Read only: `readAll`, `readOne` | Change structure through the Engine's API or its MCP tools |
| `services.files` | Metadata only: `readByQuery`, `readOne` | Bytes through the application and `/api/files` |
| `services.mail` | Options `to`, `subject`, `html`, `text`, `replyTo`; returns `{ success, ... }`, does not throw (§6) | Check `success` |
| `services.env` | Empty unless the project's Environment Variables name keys (`RUNTIME_ENV_WHITELIST_<SCOPE>`, `RUNTIME_ENV_WHITELIST_GLOBAL`) (§7) | Tell the user to name the key in the project's **Environment Variables** (Engine list) and apply it; never assume one |
| `services.fetch` | Only hosts in `EXTENSION_ALLOWED_DOMAINS`; empty list allows loopback only | Tell the user to add the host to `EXTENSION_ALLOWED_DOMAINS` in the project's **Environment Variables** and apply it |
| `fetch`, `process`, `require`, `import`, `setTimeout`, `setInterval`, `eval`, `Function` | Do not exist (§1) | `services.fetch`; no timers |
| `Intl`, as in `create-service` lines 97-101 | Not found in the runtime's globals (`context`, `services`, `console`, `JSON`, `Date`, `Math`) | Format numbers by hand |
| `console` in a custom service body | Not in scope (§3); in hooks, cron jobs and service tests it is | Return what should be recorded |
| `console.table`, `console.trace` | Do not exist; `log`, `info`, `debug`, `warn`, `error` only (§4) | `console.log` |
| Update and delete hook payloads | `meta.keys` (array); `meta.key` only on create (§5) | Use `meta.keys` |
| Throwing from a filter hook | `new HookError(message, status, code)` is in scope | Unchanged |
| Filesystem extensions, `/api/ext/*` endpoints | None | Stored hooks, cron jobs, custom services |
<!-- /buildpad-backend -->

## Typed Data Access

### Service Module Pattern

Create typed accessor modules for cross-domain data:

```typescript
// lib/data/profiles.ts (used in billing-app)
import type { UserProfile } from "@/types/contracts/users";
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';

export async function getProfile(userId: string): Promise<UserProfile> {
  const response = await fetch(buildApiUrl(`/api/items/profiles/${userId}`), { headers: getApiHeaders() });
  if (!response.ok)
    throw new Error(`Failed to fetch profile: ${response.status}`);
  const body = await response.json();
  return body.data;
}

export async function listProfiles(
  params?: URLSearchParams,
): Promise<UserProfile[]> {
  const query = params?.toString() || "";
  const response = await fetch(buildApiUrl(`/api/items/profiles?${query}`), { headers: getApiHeaders() });
  if (!response.ok)
    throw new Error(`Failed to fetch profiles: ${response.status}`);
  const body = await response.json();
  return body.data;
}
```

```typescript
// Using the accessor in a server component
import { getProfile } from '@/lib/data/profiles';

export default async function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const invoice = await getInvoice(invoiceId);
  const profile = await getProfile(invoice.user_id);

  return (
    <div>
      <h1>Invoice #{invoice.id}</h1>
      <p>Customer: {profile.display_name}</p>
    </div>
  );
}
```

### Shared Types Package

Define interfaces for all domain collections:

```typescript
// packages/shared-types/src/users.ts
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

// packages/shared-types/src/billing.ts
export interface Invoice {
  id: string;
  user_id: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue";
  created_at: string;
  // Relational (populated via ?fields=*,user_id.*)
  user_id_detail?: UserProfile;
}
```

## Error Handling

Even though all apps share the same DaaS, handle errors gracefully:

```typescript
// lib/data/profiles.ts
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';

export async function getProfileSafe(
  userId: string,
): Promise<UserProfile | null> {
  try {
    const response = await fetch(buildApiUrl(`/api/items/profiles/${userId}`), { headers: getApiHeaders() });
    if (response.status === 403) {
      // RBAC: user doesn't have permission to read profiles
      console.warn("No permission to read profiles");
      return null;
    }
    if (!response.ok) {
      console.error(`Profiles API error: ${response.status}`);
      return null;
    }
    const body = await response.json();
    return body.data;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
}
```

### Graceful Degradation in UI

```typescript
// Show invoice even if profile fetch fails
export default async function InvoicePage({ invoiceId }: { invoiceId: string }) {
  const invoice = await getInvoice(invoiceId);
  const profile = await getProfileSafe(invoice.user_id);

  return (
    <div>
      <h1>Invoice #{invoice.id}</h1>
      <p>Customer: {profile?.display_name ?? `User ${invoice.user_id}`}</p>
    </div>
  );
}
```

## RBAC Considerations

The user's role determines what data they can access across all apps:

| Scenario                                   | What Happens                                |
| ------------------------------------------ | ------------------------------------------- |
| Billing app queries `profiles` collection  | DaaS checks user's role has read permission |
| Users app queries `invoices` collection    | DaaS returns 403 if role lacks permission   |
| Admin queries any collection from any app  | Full access (admin role has CRUD on all)    |
| Viewer queries write endpoint from any app | DaaS returns 403 (read-only role)           |

**Design RBAC with cross-domain access in mind:**

```json
// billing_manager needs to read profiles (to show customer names)
{ "role": "billing_manager", "collection": "profiles", "action": "read", "fields": ["id", "display_name", "email"] }

// analytics_viewer needs to read across domains for reports
{ "role": "analytics_viewer", "collection": "invoices", "action": "read", "fields": ["id", "amount", "status", "created_at"] }
{ "role": "analytics_viewer", "collection": "profiles", "action": "read", "fields": ["id", "display_name"] }
{ "role": "analytics_viewer", "collection": "events", "action": "read", "fields": ["*"] }
```

## Anti-Patterns

| Anti-Pattern                    | Why It's Bad                     | Correct Approach                              |
| ------------------------------- | -------------------------------- | --------------------------------------------- |
| API-to-API calls between apps   | Unnecessary — same DaaS backend  | Query the collection directly                 |
| Duplicating collections per app | Schema drift, data inconsistency | One collection, shared access                 |
| A proxy route for a Buildpad component | Unnecessary extra layer  | Let the component call DaaS through DaaSProvider|
| Hardcoding collection names     | Fragile to schema changes        | Use constants/enums from shared-types         |
| Ignoring fetch errors           | Silent failures                  | Handle 403, 404, 500 gracefully               |
