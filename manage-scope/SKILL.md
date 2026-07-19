---
name: manage-scope
description: Set up and manage multi-tenancy or organizational data partitioning using the DaaS-native scope system. Use whenever the user needs tenant isolation, org-level access control, regional data partitioning, or any hierarchical data separation. This is the standard multi-tenancy approach for DaaS applications.
argument-hint: "[levels: e.g. tenant / region/branch] [use-case: multi-tenant|hierarchical|departmental]"
---

# Manage Scope

The DaaS **scope system** is the standard way to implement multi-tenancy and hierarchical data partitioning. Scopes live in built-in platform tables (`daas_scope_types`, `daas_scope_items`) and are enforced at the API and permission layers automatically — no junction tables, no custom FK columns on every collection.

> **MCP-First:** Use the `scope` MCP tool for all scope setup. SQL is only needed for custom Supabase RLS policies.

> **Lifecycle Events:** All scope operations emit events: `daas_scope_types.items.create/update/delete`, `daas_scope_items.items.create/update/delete`, `daas_scope_collection_config.items.create/update/delete`. You can attach runtime extensions to react to scope changes (e.g., provisioning resources when a new tenant is created).

---

## Critical Rules

1. **`uri_path` is immutable once assigned** — A scope item's `uri_path` is set on creation and baked into all user-role and access assignments. Never update it; delete and recreate if restructuring.
2. **Permission inheritance is upward-only** — A role granted at a parent scope is effective at all descendant scopes. The reverse is NOT true: a role at a child does NOT grant access at the parent.
3. **Data filter direction is configurable** — `inheritance_mode: "exact"` returns data assigned strictly to the active scope, `"down"` returns data for active scope + all descendants. Set per collection via `update_config`.
4. **Scope context is set by the frontend** — All API calls respect the `X-Resource-Uri` header or `daas_resource_uri` cookie. The backend never assumes a scope; if none is provided, `missing_uri_mode` on each collection decides the fallback.
5. **Scope-scoped access entries** — Assign `resource_uri` on `daas_access` records to restrict a policy to a specific scope node and its descendants. A `null` `resource_uri` means global (no scope restriction).
6. **Admin roles bypass scope** — System admins (`is_admin: true`) operate globally. Scope only affects regular user permission checks.

---

## Architecture

```
Scope Tree (types define levels, items are instances):

  daas_scope_types            daas_scope_items
  ─────────────────           ──────────────────────────────────────────
  id  name      level         id  type_id  name         uri_path
  ──  ────────  ─────         ──  ───────  ───────────  ──────────────────────────────────
  t1  Region    0             i1  t1       APAC         /<t1>:<i1>
  t2  Branch    1             i2  t1       EMEA         /<t1>:<i2>
                              i3  t2       Singapore    /<t1>:<i1>/<t2>:<i3>
                              i4  t2       London       /<t1>:<i2>/<t2>:<i4>

Permission Inheritance (upward propagation):
  Role assigned at /<t1>:<i1>  →  effective at /<t1>:<i1>/<t2>:<i3>  ✓
  Role assigned at /<t1>:<i1>/<t2>:<i3>  →  NOT effective at /<t1>:<i1>  ✗

Data Filtering (per collection):
  inheritance_mode: "exact"  → WHERE resource_uri = '<active>'
  inheritance_mode: "down"   → WHERE resource_uri LIKE '<active>%'

Scope Context Flow:
  ScopeSwitcher UI  →  daas_resource_uri cookie  →  API middleware
                                                 →  enforcePermission({ resourceUri })
                                                 →  getPermissionFilters(user, collection, resourceUri)
```

---

## Steps

### Step 1: Design the Hierarchy (Scope Types)

Define one or more scope types representing the levels of your hierarchy, in order from top to bottom.

**Via MCP — create a top-level type:**

```json
// mcp_daas_scope -> action: create_type
{
  "name": "Region",
  "description": "Top-level geographic region",
  "level": 0,
  "meta": {}
}
```

**Create a child level:**

```json
// mcp_daas_scope -> action: create_type
{
  "name": "Branch",
  "description": "Branch office within a region",
  "level": 1,
  "meta": {}
}
```

**Read all types (to get UUIDs for next steps):**

```json
// mcp_daas_scope -> action: read_types
{}
```

> **Tip:** For a flat tenant model (SaaS with no sub-levels), use a single type (e.g., `Tenant`) at `level: 0`.

---

### Step 2: Create Scope Items

Each scope item is a concrete instance (e.g., "APAC", "Singapore HQ"). Provide `parent_uri` when creating child items.

**Create a root item:**

```json
// mcp_daas_scope -> action: create_item
{
  "type_id": "<region-type-uuid>",
  "name": "APAC",
  "meta": {}
}
```

**Create a child item (scoped under APAC):**

```json
// mcp_daas_scope -> action: create_item
{
  "type_id": "<branch-type-uuid>",
  "name": "Singapore HQ",
  "parent_uri": "/<region-type-uuid>:<apac-item-uuid>",
  "meta": {}
}
```

**Read items to obtain `uri_path` values:**

```json
// mcp_daas_scope -> action: read_items
{
  "type_id": "<branch-type-uuid>"
}
```

The `uri_path` returned (e.g., `/<t1>:<i1>/<t2>:<i3>`) is used in all subsequent role assignments and access entries.

---

### Step 3: Assign Users to Roles in Specific Scopes

Use `assign_user_role` to grant a user a role that is effective only within that scope node and its descendants.

**Assign user to a role within Singapore HQ scope:**

```json
// mcp_daas_scope -> action: assign_user_role
{
  "user_id": "<user-uuid>",
  "role_id": "<branch-manager-role-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>"
}
```

**Assign user to a global role (no scope restriction):**

```json
// mcp_daas_users -> action: add_roles
{
  "user_id": "<user-uuid>",
  "roles": ["<global-admin-role-uuid>"]
}
```

> `assign_user_role` writes to `daas_user_roles.resource_uri`. Global roles (null `resource_uri`) are managed through the `users` tool `add_roles` action.

**Read scoped role assignments:**

```json
// mcp_daas_scope -> action: read_user_roles
{
  "user_id": "<user-uuid>"
}
```

**Remove a scoped role assignment:**

```json
// mcp_daas_scope -> action: remove_user_role
{
  "user_id": "<user-uuid>",
  "role_id": "<branch-manager-role-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>"
}
```

#### Role Scope Restrictions (`scope_config`)

Roles can restrict **where** they may be assigned using `scope_config`. When `scope_config.allowed_scopes` is set, any attempt to assign that role to a user is validated against the patterns.

| `scope_config` value | Meaning |
|---|---|
| `null` / absent | No restriction — role can be assigned at any scope |
| `{ "allowed_scopes": ["/<type>:<id>/*"] }` | Role can only be assigned at URIs matching any of the listed patterns (supports `*` wildcard segments) |
| `{ "allowed_scopes": [] }` | Role is **locked** — cannot be assigned to any user |

Validation occurs on `daas_users.items.create` and `daas_users.items.update` via a built-in platform hook (`lib/hooks/role-scope.ts`). It applies to:
- `assign_user_role` scope action
- `PATCH /api/users/:id` (role changes)
- `PATCH /api/items/daas_users/:id` (role changes)
- MCP `mcp_daas_users` → `update` action (role changes)

**Error codes on validation failure:**

| Code | Meaning |
|---|---|
| `ROLE_SCOPE_MISMATCH` | The assignment `resource_uri` does not match any pattern in `allowed_scopes` |
| `ROLE_SCOPE_LOCKED` | The role has `allowed_scopes: []` (empty array) — no assignments allowed |

**Checking assignability before assigning:**

When reading roles, the platform computes an `assignable` boolean field based on the current scope context. Use this to filter the role picker UI:

```json
// mcp_daas_roles -> action: list
{}
// Each role in the response includes:
// "assignable": true   — can be assigned at the current scope
// "assignable": false  — scope_config prevents assignment here
```

> **Tip:** Set `scope_config` via `mcp_daas_roles` → `create` or `update` action. See the [create-rbac skill](../create-rbac/SKILL.md) for examples.

---

### Step 4: Configure Collection Data Filtering

Each collection can be independently configured for how it behaves under scope context.

**Read current configs:**

```json
// mcp_daas_scope -> action: read_configs
{}
```

---

#### Scenario A — New collection (via Data Model UI or MCP)

Add the scope URI column as a **Many-to-One field** (type: `text`, related collection: `daas_scope_items`, related field: `uri_path`). Then call `scope: create_config` to register it.

**Via Data Model UI:**
In the field creation modal, select interface "Many to One", set type to `text`, choose related collection `daas_scope_items`, and select related field `uri_path`. Then run `create_config` below.

**Via MCP (two steps):**

```json
// Step 1 — create collection with scope column as M2O field
// mcp_daas_collections -> action: create
// IMPORTANT: resource_uri MUST be created with interface "list-m2o" and special ["m2o"].
// This causes the system to automatically:
//   • Add the FK constraint: resource_uri → daas_scope_items(uri_path)
//   • Insert the daas_relations metadata row
//   • Reload the PostgREST schema cache
// Creating it as a plain "input" string field skips all of this and breaks ?fields=resource_uri.*
{
  "collection": "orders",
  "meta": { "icon": "shopping_cart" },
  "fields": [
    { "field": "id", "type": "uuid", "schema": { "is_primary_key": true } },
    {
      "field": "resource_uri",
      "type": "string",
      "schema": { "is_nullable": true, "max_length": 1024 },
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "options": {
          "related_collection": "daas_scope_items",
          "related_field": "uri_path",
          "on_delete": "RESTRICT"
        },
        "note": "Scope URI for tenant filtering"
      }
    }
  ]
}
```

```json
// Step 2 — register scope config row
// mcp_daas_scope -> action: create_config
// The FK + daas_relations were already wired in Step 1.
// This call adds the daas_scope_collection_config row that tells the API middleware
// to apply scope filtering on reads/writes.
{
  "config_data": {
    "collection": "orders",
    "field_name": "resource_uri",
    "inheritance_mode": "exact",
    "missing_uri_mode": "strict"
  }
}
```

> The field can be named anything (e.g. `org_uri`, `tenant_uri`). `resource_uri` is just the convention.
> There is **no automatic wiring based on field name** — `create_config` must always be called explicitly.

---

#### Scenario B — Existing collection (add scope to it)

First add the scope URI column (if not present), then register it with `create_config`.

**If the column doesn't exist yet:**

Via Data Model UI: Add a new field with interface "Many to One", type `text`, related collection `daas_scope_items`, related field `uri_path`.

Via MCP fields tool:
```json
// mcp_daas_fields -> action: create
{
  "collection": "orders",
  "field": "resource_uri",
  "type": "text",
  "meta": {
    "interface": "list-m2o",
    "special": ["m2o"],
    "options": {
      "related_collection": "daas_scope_items",
      "related_field": "uri_path",
      "on_delete": "RESTRICT"
    }
  }
}
```

**Then register scope config:**

```json
// mcp_daas_scope -> action: create_config
// FK + daas_relations were already created by the fields tool above.
// This adds the scope config row that enables API middleware filtering.
{
  "config_data": {
    "collection": "orders",
    "field_name": "resource_uri",
    "inheritance_mode": "exact",
    "missing_uri_mode": "strict"
  }
}
```

---

#### Config Settings Reference

| Setting             | Values                     | Effect                                                                           |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `field_name`        | column name in collection  | Name of the TEXT column that stores the scope `uri_path` (usually `resource_uri`) |
| `inheritance_mode`  | `"exact"` \| `"down"`      | `exact` (default): strict match only; `down`: includes all descendant scope items |
| `missing_uri_mode`  | `"strict"` \| `"reject"`   | `strict` (default): no scope = treat as root; `reject`: block if no scope header |

#### Why the FK constraint matters

- Prevents orphaned `resource_uri` values when scope items are deleted
- `ON DELETE RESTRICT` blocks deleting a scope item that is still referenced by collection rows
- Enables API clients to request nested scope item data via M2O expansion: `?fields=resource_uri.name`

**Update config settings (after creation):**

```json
// mcp_daas_scope -> action: update_config
{
  "collection": "orders",
  "config_update": {
    "inheritance_mode": "down"
  }
}
```

---

### Step 5: Assign Policies to Specific Scopes

To restrict a policy to users operating within a given scope and its descendants, set `resource_uri` on the `daas_access` record.

**Assign a policy to a role only within a specific scope:**

```json
// mcp_daas_access -> action: create
{
  "role": "<branch-manager-role-uuid>",
  "policy": "<branch-data-read-policy-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>"
}
```

**Assign a global policy (no scope restriction):**

```json
// mcp_daas_access -> action: create
{
  "role": "<global-viewer-role-uuid>",
  "policy": "<read-all-policy-uuid>"
}
```

> When `check_permission_with_scope` is called, it finds access entries where `resource_uri` is an ancestor-or-equal of the active scope URI. A null `resource_uri` always matches.

---

### Step 6: Frontend — Scope Selection & API Integration

The active scope is communicated to all API calls via the `daas_resource_uri` cookie or `X-Resource-Uri` header. See [Client-Side Scope Integration](references/scope-client.instructions.md) for full patterns.

#### Using the ScopeSwitcher Component

`ScopeSwitcher` is a pre-built component that calls `/api/scope/available` to show accessible scopes for the current user and sets the cookie on selection:

```tsx
import ScopeSwitcher from '@/components/ScopeSwitcher';

// Place in your header/navbar:
<ScopeSwitcher />
```

> **Bug 21 warning — NEVER add a "fallback to all tenants" path in the `/api/scope/available` proxy.**
> If DaaS returns non-200 and you fall back to fetching all rows from `daas_scope_items`, every user will see every tenant regardless of their assignments. This is a data leakage vulnerability. Surface the real DaaS error instead:
>
> ```ts
> // ✅ CORRECT — proxy DaaS directly, surface real errors
> const resp = await fetch(`${daasUrl}/api/scope/available`, { headers, cache: 'no-store' });
> return NextResponse.json(await resp.json(), { status: resp.status });
>
> // ❌ WRONG — dangerous fallback
> if (!resp.ok) {
>   const allScopes = await fetch(`${daasUrl}/api/items/daas_scope_items`); // returns ALL tenants
>   return NextResponse.json(await allScopes.json());
> }
> ```

#### ScopeProvider Context (app-wide scope state)

Wrap your layout with a `ScopeProvider` that reads the active scope from the cookie and exposes it to all components.

> **Bug 20:** The `ScopeProvider` must validate the stored cookie URI against the user's actual available scopes. If the URI isn't in the user's list (stale from a previous user's session), clear it. This is the second defensive layer after the logout route clears the cookie.

```tsx
// lib/contexts/ScopeContext.tsx
'use client';
import { apiRequest } from '@/lib/buildpad/services/api-request';
import { createContext, useContext, useEffect, useState } from 'react';

export interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
}

interface ScopeContextValue {
  resourceUri: string | null;
  activeTenant: ScopeItem | null;
  availableScopes: ScopeItem[];
  setResourceUri: (uri: string | null) => void;
  isLoading: boolean;
}

const ScopeContext = createContext<ScopeContextValue>({
  resourceUri: null, activeTenant: null, availableScopes: [],
  setResourceUri: () => {}, isLoading: true,
});

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [resourceUri, setResourceUriState] = useState<string | null>(null);
  const [availableScopes, setAvailableScopes] = useState<ScopeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)daas_resource_uri=([^;]*)/);
    const cookieUri = match ? decodeURIComponent(match[1]) : null;

    apiRequest<{ data: ScopeItem[] }>('/api/scope/available')
      .then((data) => {
        const scopes = data.data ?? [];
        setAvailableScopes(scopes);

        // Validate the cookie against the user's actual scopes (Bug 20)
        const uriIsValid = cookieUri ? scopes.some(s => s.uri_path === cookieUri) : false;
        if (uriIsValid) {
          setResourceUriState(cookieUri);
        } else {
          if (cookieUri) document.cookie = 'daas_resource_uri=; path=/; max-age=0';
          const autoUri = scopes.length === 1 ? scopes[0].uri_path : null;
          if (autoUri) setResourceUri(autoUri);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setResourceUri = (uri: string | null) => {
    if (uri) {
      document.cookie = `daas_resource_uri=${encodeURIComponent(uri)}; path=/; max-age=${30 * 24 * 3600}`;
    } else {
      document.cookie = 'daas_resource_uri=; path=/; max-age=0';
    }
    setResourceUriState(uri);
  };

  const activeTenant = availableScopes.find(s => s.uri_path === resourceUri) ?? null;
  return <ScopeContext.Provider value={{ resourceUri, activeTenant, availableScopes, setResourceUri, isLoading }}>{children}</ScopeContext.Provider>;
}

export const useScope = () => useContext(ScopeContext);
```

#### Clearing scope on logout (server-side — Bug 20)

The logout route must clear the cookie server-side so the next user doesn't inherit it:

```ts
// app/api/auth/logout/route.ts — inside performLogout:
cookieStore.delete('daas_resource_uri'); // REQUIRED — prevents 403 for next user
```

#### Making scoped API requests

The cookie is sent automatically on all same-origin requests. For explicit override or cross-origin:

```ts
// Cookie is auto-sent — no extra code needed for standard fetch
const res = await fetch('/api/items/orders', { credentials: 'include' });

// Explicit header override (overrides cookie if both present)
const res = await fetch('/api/items/orders', {
  headers: { 'X-Resource-Uri': resourceUri },
  credentials: 'include',
});
```

#### Handling 403 and scope-related errors

The API returns `403` when the user lacks permission in the active scope, and `400` when the scope URI is malformed or unrecognised.

```ts
// lib/api.ts — centralised fetch wrapper with scope error handling
async function scopedFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...options });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const code = body?.errors?.[0]?.extensions?.code;

    if (code === 'FORBIDDEN_SCOPE') {
      // User's role doesn't cover the active scope — redirect to scope selector
      window.location.href = '/select-scope';
      return;
    }
    throw new Error('Permission denied');
  }

  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    const code = body?.errors?.[0]?.extensions?.code;

    if (code === 'INVALID_SCOPE') {
      // Stale or invalid scope cookie — clear it and reload
      document.cookie = 'daas_resource_uri=; path=/; max-age=0';
      window.location.reload();
      return;
    }
    throw new Error('Bad request');
  }

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
```

#### React error boundary for scope access denied

```tsx
// components/ScopeErrorBoundary.tsx — catch scope permission errors in UI
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ScopeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason?.message === 'Permission denied') {
        router.push('/select-scope?error=access_denied');
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [router]);

  return <>{children}</>;
}
```

---

## Common Scenarios

### Scenario 1: Simple SaaS — each user belongs to one tenant

```
Scope types:  Tenant (level 0)
Scope items:  Acme Corp, Beta LLC, Gamma Inc
Assignment:   Each user gets a role at exactly one tenant URI
Config:       all collections: inheritance_mode=exact, missing_uri_mode=strict
```

Setup:
1. Create one scope type `Tenant` at `level: 0`
2. Create one scope item per customer
3. Assign each user `assign_user_role` at their tenant's `uri_path`
4. Configure all collections with `update_config` (`scope_field`, `exact`, `deny`)
5. Place `<ScopeSwitcher />` in header — users with one tenant never see the switcher

---

### Scenario 2: Regional hierarchy — managers see all branches under them

```
Scope types:  Region (level 0), Branch (level 1)
Scope items:  APAC → [Singapore, Sydney], EMEA → [London, Paris]
Assignment:   Regional manager at /<region>:<apac>
              Branch staff at /<region>:<apac>/<branch>:<sgp>
Config:       orders, tasks: inheritance_mode=down, missing_uri_mode=strict
```

Result:
- Singapore staff see only Singapore data
- APAC manager sees APAC + Singapore + Sydney data
- EMEA staff have no access to APAC data at all

---

### Scenario 3: Department isolation — HR, Finance, Engineering each see their own data

```
Scope types:  Department (level 0)
Scope items:  HR, Finance, Engineering
Assignment:   Cross-department admin at root (no resource_uri = global)
              Dept members assigned at their dept URI
Config:       documents, tickets: inheritance_mode=exact, missing_uri_mode=strict
              announcements: no scope config  (visible to all, no isolation)
```

---

### Scenario 4: Mixed — some collections scoped, some global

Not every collection needs scope filtering. Only configure `update_config` on collections that should be isolated. Collections without a config entry have no scope filtering — they return all data regardless of scope context.

```
Collections with scope config:   orders, tasks, documents
Collections without scope config: announcements, help_articles, categories
```

---

### Scenario 5: User onboarding — no scope assigned yet

When a new user logs in and has no `daas_user_roles` entries with `resource_uri`, `/api/scope/available` returns an empty list. Handle this in the frontend:

```tsx
// app/select-scope/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SelectScopePage() {
  const [scopes, setScopes] = useState<{ id: string; name: string; uri_path: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/scope/available', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const selectable = (data.data ?? []).filter((s: any) => s.selectable !== false);
        if (selectable.length === 1) {
          // Auto-select if only one option
          document.cookie = `daas_resource_uri=${encodeURIComponent(selectable[0].uri_path)}; path=/; max-age=${30 * 24 * 3600}`;
          router.replace('/');
        } else {
          setScopes(selectable);
        }
      });
  }, [router]);

  if (scopes.length === 0) {
    return <p>You have not been assigned to any scope. Contact your administrator.</p>;
  }

  return (
    <ul>
      {scopes.map((s) => (
        <li key={s.id}>
          <button onClick={() => {
            document.cookie = `daas_resource_uri=${encodeURIComponent(s.uri_path)}; path=/; max-age=${30 * 24 * 3600}`;
            router.push('/');
          }}>{s.name}</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## Using `mcp_daas_items` with Scope

The `mcp_daas_items` tool accepts a `resource_uri` parameter that fully propagates scope through all CRUD operations, including cross-collection reads and writes via relations.

### What `resource_uri` enforces

| Operation | Effect |
| --------- | ------ |
| **read** | Filters results to items whose scope field matches `resource_uri` (exact or `down` depending on `inheritance_mode`) |
| **create** | Injects `resource_uri` into the scope-enabled field of the new record — client value is overridden |
| **nested O2M create** (inline `{ create: [...] }`) | Also injects `resource_uri` into each child record being created inline |
| **O2M relation read** | Child collection sub-queries are also filtered by `resource_uri` if the child is scope-enabled |
| **update** | Scope filtering applies when resolving which records to update |
| **Omit `resource_uri`** | No scope filtering — global/admin-level access |
| **`resource_uri: null`** | Root scope — only records with no scope assignment |

### Examples

Read orders scoped to a specific branch:
```json
// mcp_daas_items -> action: read
{
  "collection": "orders",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>",
  "query": { "filter": { "status": { "_eq": "pending" } } }
}
```

Create an order with O2M order_lines — both get `resource_uri` injected automatically:
```json
// mcp_daas_items -> action: create
{
  "collection": "orders",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>",
  "data": {
    "customer_name": "Acme Corp",
    "order_lines": {
      "create": [
        { "product": "Widget A", "qty": 3, "price": 100 }
      ]
    }
  }
}
```

> **Source of `resource_uri` in agent context:** The agent should read the user's active scope from the `daas_resource_uri` cookie value or from a prior `mcp_daas_scope` → `read_user_roles` call, then pass that `uri_path` as `resource_uri`.

---

- [Scope Management](references/scope-management.instructions.md) — Full MCP tool reference, resource URI format, collection config settings
- [Scope Permissions](references/scope-permissions.instructions.md) — Permission inheritance, enforcePermission internals, inheritance_mode / missing_uri_mode details
- [Client-Side Scope Integration](references/scope-client.instructions.md) — ScopeProvider, REST API patterns, 400/403 handling, onboarding flow
