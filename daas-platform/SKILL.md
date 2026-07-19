---
name: daas-platform
description: Core DaaS (Data-as-a-Service) platform knowledge including two-tier architecture, DaaS-compatible REST API, Supabase integration, Next.js App Router patterns, MCP tool usage, and environment configuration. Automatically loaded as background context for all DaaS development tasks.
user-invokable: false
---

# DaaS Platform Reference

## Two-Tier Architecture

```
Frontend App  →  DaaS Backend (DaaS)  →  Supabase (PostgreSQL)
(Next.js)        (DaaS-compatible REST API)           (Database)
```

- Frontend connects to DaaS backend for ALL data operations
- Frontend uses Supabase ONLY for authentication (via proxy routes)
- Never query Supabase directly from frontend code

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5.x
- **UI**: Mantine v8 + Buildpad components (Copy & Own)
- **Backend**: DaaS (DaaS-compatible REST API)
- **Auth**: Supabase Auth via server-side proxy routes
- **Testing**: Playwright (E2E) + Vitest (unit)
- **Design**: Token-based theming with CSS custom properties (`--ds-*`)

## Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

Always read `.env.local` to get actual configured values before making API calls.

## REST API Pattern

```
GET    /api/items/:collection          # List items
POST   /api/items/:collection          # Create item
GET    /api/items/:collection/:id      # Get item
PATCH  /api/items/:collection/:id      # Update item
DELETE /api/items/:collection/:id      # Delete item
GET    /api/fields/:collection         # Get field schema
GET    /api/relations                  # Get relations
```

### Query Parameters

- `fields`: `*` or comma-separated field names
- `filter`: `{ "status": { "_eq": "published" } }`
- `sort`: Field name, `-` prefix for descending
- `limit`, `offset`: Pagination
- `aggregate`: Aggregate functions — `{ "count": ["id"], "sum": ["amount"] }` or bracket notation `aggregate[count]=id`
- `groupBy`: Group aggregate results — comma-separated field names

### Aggregate Functions

Perform calculations on collection data without fetching individual items:

```
GET /api/items/:collection?aggregate[count]=id&groupBy=status
GET /api/items/:collection?aggregate={"count":["*"],"sum":["amount"]}&filter={"status":{"_eq":"completed"}}
```

**Supported operations:** `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`, `avgDistinct`, `min`, `max`

**Response format** (nested, permission-aware):

```json
{
  "data": [
    { "status": "completed", "count": { "id": 42 }, "sum": { "amount": 12500 } }
  ]
}
```

Aggregate queries respect collection-level read permissions and item-level RLS filters.

### Filter Operators

`_eq`, `_neq`, `_lt`, `_lte`, `_gt`, `_gte`, `_in`, `_nin`, `_contains`, `_icontains`, `_starts_with`, `_ends_with`, `_null`, `_nnull`, `_and`, `_or`

## DaaS MCP Tools

| Tool                   | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `mcp_daas_items`       | CRUD + aggregate on collection items                  |
| `mcp_daas_schema`      | Read collection/field schema (no `action` param!)     |
| `mcp_daas_collections` | Manage tables (admin)                                 |
| `mcp_daas_fields`      | Manage columns — `data` accepts object OR array       |
| `mcp_daas_relations`   | Foreign key relationships                             |
| `mcp_daas_files`       | File management                                       |
| `mcp_daas_users`       | User profiles                                         |
| `mcp_daas_roles`       | Role definitions (CRUD — create/read/update/delete)   |
| `mcp_daas_permissions` | Permission rules (CRUD — create/read/update/delete)   |
| `mcp_daas_extensions`  | Runtime hooks (admin)                                 |
| `mcp_daas_cron`        | Scheduled background jobs (admin)                     |
| `mcp_daas_services`    | Reusable custom service modules shared between extensions and cron jobs (admin) |
| `mcp_daas_scope`       | Hierarchical scope management — types, items, collection configs, scoped role assignments (admin) |

### MCP Action Quick Reference

**`mcp_daas_services`** — Custom Services:

| Action       | Key Parameters                        | Purpose                                 |
| ------------ | ------------------------------------- | --------------------------------------- |
| `list`       | `status?`                             | List all services                       |
| `read`       | `id`                                  | Read service details                    |
| `create`     | `name`, `code`, `tests[]?`, `status?` | Create a service (`snake_case` names!)  |
| `update`     | `id`, `code?`, `tests[]?`, `status?`  | Update service (auto-increments version)|
| `delete`     | `id`                                  | Delete service (fails if dependents)    |
| `run_tests`  | `id`                                  | Run all built-in tests                  |
| `run_test`   | `id`, `test`                          | Run a single test by name               |
| `activate`   | `id`                                  | Set status to active                    |
| `deactivate` | `id`                                  | Set status to inactive                  |

**`mcp_daas_cron`** — Cron Jobs:

| Action       | Key Parameters                          | Purpose                        |
| ------------ | --------------------------------------- | ------------------------------ |
| `list`       | —                                       | List all cron jobs             |
| `read`       | `id`                                    | Read job details               |
| `create`     | `name`, `code`, `schedule`, `status?`   | Create a cron job              |
| `update`     | `id`, `code?`, `schedule?`, `status?`   | Update a cron job              |
| `delete`     | `id`                                    | Delete a cron job              |
| `run_now`    | `id`                                    | Manually trigger immediately   |
| `activate`   | `id`                                    | Set status to active           |
| `deactivate` | `id`                                    | Set status to inactive         |
| `history`    | `id`, `limit?`                          | View run history with logs     |
| `clone`      | `id`, `name?`                           | Clone a cron job               |

**`mcp_daas_extensions`** — Runtime Extensions:

| Action       | Key Parameters                             | Purpose                    |
| ------------ | ------------------------------------------ | -------------------------- |
| `list`       | `event?`, `status?`, `type?`               | List all extensions        |
| `read`       | `id`                                       | Read extension details     |
| `create`     | `name`, `event`, `type`, `code`, `status?` | Create an extension        |
| `update`     | `id`, `code?`, `name?`, `status?`          | Update an extension        |
| `delete`     | `id`                                       | Delete an extension        |
| `activate`   | `id`                                       | Set status to active       |
| `deactivate` | `id`                                       | Set status to inactive     |
| `clone`      | `id`, `name?`                              | Clone an extension         |

> **All MCP tools** use top-level parameters in `arguments` — do NOT wrap in a `data` object.
>
> **Delete restriction:** The `delete` action on most tools is blocked by default. The platform setting `mcp_allow_deletes` (env: `MCP_ALLOW_DELETES`) must be `true` for delete to work. RBAC tools (`roles`, `policies`, `permissions`, `access`) are exempt from this restriction.

### MCP Pitfalls

- `schema` tool has NO `action` parameter — just use `keys`
- `permissions`, `roles`, and `policies` all support full CRUD via their own dedicated MCP tools — do NOT use the `items` tool for these collections
- For `permissions` create: the `data.action` field is the **permission action** (`"create"`/`"read"`/`"update"`/`"delete"`/`"share"`), which is different from the top-level `action` parameter (`"create"`) — pass them both explicitly
- `fields.delete` uses `fields: []` (array), not `field` (string)

### Schema Verification Rule (CRITICAL)

**Always verify field names against the actual DaaS schema before writing queries, sort parameters, or filter expressions.** Do NOT assume field names — they may differ from common conventions (e.g., `created_at` vs `date_created`). Using a non-existent field in `sort`, `fields`, or `filter` causes the DaaS backend to return a **500 error** with no helpful message.

Before writing any API route or page that queries a collection:

1. Use `mcp_daas_schema` (with `keys: ["collection_name"]`) or `mcp_daas_fields` to get the actual field names
2. Use only the field names returned by the schema in `sort`, `fields`, and `filter` parameters
3. Pay special attention to audit/timestamp columns — names vary between DaaS instances (e.g., `created_at` vs `date_created` vs `date_created`)

## Backend-First Rule

**Before implementing ANY server-side feature**, check the [Built-in DaaS Features reference](references/builtin-features.instructions.md). If DaaS provides it natively, use it — do NOT rebuild it in Next.js. This is the most common source of agent errors: building custom implementations of features that DaaS already provides.

| Pattern                        | DaaS Feature                                        | DO NOT Build                                         |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| State machine / approvals      | DaaS Workflows (`create-workflow` skill)             | Custom status fields, manual state logic             |
| Audit / change tracking        | **Automatic** — `daas_activity` + `GET /api/activity`| Custom audit tables, logging hooks                   |
| Validation before save         | Runtime Extensions (filter hooks)                    | Next.js API middleware validation                    |
| Side effects after save        | Runtime Extensions (action hooks)                    | Custom webhook dispatchers                           |
| Scheduled tasks                | DaaS Cron Jobs (`mcp_daas_cron`)                     | `setInterval`, Next.js cron, external schedulers     |
| Shared reusable code           | DaaS Custom Services (`services.custom()`)           | Shared utility files for server-side logic           |
| Auto timestamps                | Special fields: `date-created`, `date-updated`       | Manual `new Date()` in API routes                    |
| Auto user tracking             | Special fields: `user-created`, `user-updated`       | Manual `req.user.id` assignment                      |
| Permissions / access control   | DaaS Permission system (RBAC)                        | Custom permission tables, `isAdmin` fields           |
| Content versioning / drafts    | DaaS Versions API (`POST /api/versions`)             | Custom version/draft tables                          |
| File upload / storage          | DaaS Files API (`POST /api/files`)                   | Custom upload endpoints, storage logic               |
| Multi-tenancy / scoping        | DaaS Scope system (`manage-scope` skill)             | Custom `tenant_id` columns, manual filtering         |
| Data import/export             | `POST /api/utils/import`, `GET /api/utils/export`   | Custom CSV parsers, import routes                    |
| Hashing / random tokens        | `POST /api/utils/hash/*`, `/random/string`           | Custom bcrypt/crypto code                            |

## References

- [DaaS API reference](references/daas-api.instructions.md)
- [DaaS MCP tools](references/daas-mcp-tools.instructions.md)
- [Next.js patterns](references/nextjs.instructions.md)
- [Built-in DaaS features](references/builtin-features.instructions.md) — DO NOT rebuild these

---

## Provider Architecture Rules (Learned from Production)

### Rule: DaaSProvider MUST be in `(authenticated)/layout.tsx`, NEVER in root layout (Bug 22)

Next.js root layouts never unmount during client-side navigation. If `DaaSProviderWrapper` is in `app/layout.tsx`, it stays alive across logout → `/login` → re-login, delivering a stale null token and causing 401 on every DaaS call after the second login. Fix: place it in `app/(authenticated)/layout.tsx` so it fully unmounts when the user navigates to `/login`.

### Rule: DaaSProviderWrapper must use `onAuthStateChange`, NOT `getSession`, pass `token` as sync prop, and gate `ready` on non-null token (Bug 19 + Bug 27)

`supabase.auth.getSession()` from `createBrowserClient` can return `{ session: null }` before the async storage adapter finishes reading cookies. Use `onAuthStateChange` which fires `INITIAL_SESSION` only after cookie parsing is complete.

Two additional requirements:
1. Pass `token: tokenState` as a **sync prop** to `DaaSProvider` — without it `effectiveToken` is `null` on first render, so `setGlobalDaaSConfig` sets a null-token config and child components get 401.
2. Only set `ready = true` when `tok` is non-null — `INITIAL_SESSION` can fire with `session = null` when the access token is expired and Supabase is performing a silent refresh. Setting `ready` unconditionally causes children to mount without auth.
3. Make `useMemo` deps include `tokenState` so `DaaSProvider` re-renders when the token refreshes.

```tsx
const [tokenState, setTokenState] = useState<string | null>(null);
const tokenRef = useRef<string | null>(null);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      const tok = session?.access_token ?? null;
      tokenRef.current = tok;
      setTokenState(tok);
      if (tok) setReady(true); // only gate-open when token is present
    }
  );
  return () => subscription.unsubscribe();
}, [supabase]);

const config = useMemo(() => ({
  url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? '',
  token: tokenState ?? undefined,   // sync prop for first render
  getToken: async () => tokenRef.current,
  // ...
}), [tokenState]);                  // re-create when token refreshes

if (!ready) return null;
```

### Rule: DaaSProvider must NOT clear `globalDaaSConfig` on unmount (Bug 27)

React 18+ StrictMode (on by default in Next.js dev) double-invokes effects: **mount → cleanup → mount**. If `DaaSProvider` runs `setGlobalDaaSConfig(null)` in an effect cleanup, the cleanup fires between the two mounts. Child components (`CollectionList`, `VForm`) that re-mount in the second pass call `getApiHeadersAsync()` during the null window → **401 on every hard reload in dev, and intermittently in production**.

The render body already calls `setGlobalDaaSConfig(resolvedConfig)` synchronously on every mount, so the next mount overwrites the config. Do **not** add any cleanup that nulls out `globalDaaSConfig`.

### Rule: `DaaSConfig` must include `getHeaders` for scope forwarding (Bug 16)

Buildpad components call DaaS **directly** from the browser — they do NOT go through the Next.js proxy. Without `getHeaders`, the `X-Resource-Uri` header is never sent on direct calls, and DaaS falls back to root scope where the user has no role → 403.

```tsx
getHeaders: async () => {
  const raw = document.cookie
    .split('; ')
    .find(r => r.startsWith('daas_resource_uri='))
    ?.split('=')[1];
  return raw ? { 'X-Resource-Uri': decodeURIComponent(raw) } : {};
},
```

### Rule: CORS must use explicit origins + allow `X-Resource-Uri` header (Bugs 17 + 25)

The DaaS default `cors_origins: ["*"]` is **incompatible** with Buildpad’s `credentials: 'include'` — the browser blocks every preflight. Also, `X-Resource-Uri` is not in the default `cors_allowed_headers`, so even after fixing origins the header is blocked. Always run this at project creation:

```json
{
  "cors_origins": ["http://localhost:3000", "http://localhost:3001", "<amplifyUrl>"],
  "cors_allow_credentials": true,
  "cors_allowed_headers": ["Content-Type","Authorization","Origin","X-Requested-With","Accept","X-Resource-Uri"],
  "cors_max_age": 0
}
```

### Rule: Any context that calls DaaS on mount must wait for scope to be ready (Bug 26)

If a context provider fetches from DaaS (e.g. `/api/policies/me`) and lives inside `ScopeProvider`, the first fetch will have no scope cookie yet and will get 401. The `.catch()` handler will set state to empty/false and the effect will never re-run if `scopeLoading` is not in deps.

Pattern — always consume `useScope()` and guard + react to scope changes:

```tsx
const { resourceUri, isLoading: scopeLoading } = useScope();

useEffect(() => {
  if (scopeLoading) return; // wait for scope cookie to be set
  // ... fetch from DaaS
}, [version, resourceUri, scopeLoading]); // re-fetch when tenant switches
```
