---
name: Module-Level Access
description: Reference for the DaaS built-in Module-Level Access Keys feature — application capability flags that integrate natively with the DaaS Policy/Role/User chain.
applyTo: "**/*.{ts,tsx}"
---

# Module-Level Access — Implementation Reference

Platform-native capability flags stored as `module_access JSONB` on `daas_policies` and managed via the `daas_module_access_keys` registry. No custom columns or server utilities required.

## Architecture Overview

```
daas_module_access_keys (registry)
  └─ { id, parent_id, display_name, key: "reports:export" }

daas_policies.module_access (JSONB)
  └─ { "reports:export": true, "workflow:approve": false }

User
 ├── daas_access (direct user → policy)
 └── daas_user_roles → Role → daas_access → Policy
                                           ↓
         OR-merge module_access across all policies → effectiveModuleAccess
```

Admin users (`admin_access: true` on any policy) receive `true` for all keys.

---

## Key Registry (`daas_module_access_keys`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `parent_id` | UUID nullable | Self-reference — null = root node |
| `display_name` | text | Label shown in Policy editor |
| `description` | text nullable | Optional explanation |
| `key` | varchar(100) nullable | `null` = folder node; non-null = leaf (grantable) |
| `sort` | int | Display order within siblings |

Key format constraint: `^[a-z][a-z0-9_:./-]*$`, globally UNIQUE.

### System-seeded keys

| Key | Purpose |
|---|---|
| `system:logs` | View application logs page |
| `system:activity` | View activity feed |
| `system:cron` | Manage cron jobs |
| `system:settings.smtp` | Configure SMTP settings |
| `system:settings.cors` | Configure CORS settings |
| `system:settings.ai` | Configure AI settings |
| `system:settings.general` | Configure general settings |
| `system:extensions` | Manage extensions |
| `system:services` | Manage custom services |
| `workflow:approve` | Execute `approve` workflow transitions |
| `workflow:reject` | Execute `reject` workflow transitions |

---

## MCP Tools

### Register a key

```json
{
  "name": "module_access_keys",
  "arguments": {
    "action": "create",
    "data": {
      "display_name": "Export Reports",
      "key": "reports:export",
      "sort": 10
    }
  }
}
```

### Grant on a policy

```json
{
  "name": "policies",
  "arguments": {
    "action": "update",
    "id": "<policy-uuid>",
    "data": {
      "module_access": { "reports:export": true }
    }
  }
}
```

---

## Client Hook

`hasModuleAccess` is part of `PermissionsContext` — available everywhere the context is mounted:

```typescript
import { usePermissions } from '@/lib/buildpad/hooks';

const { hasModuleAccess, moduleAccess } = usePermissions();

// Single key
const canExport = hasModuleAccess('reports:export');

// All resolved flags
console.log(moduleAccess); // → { "reports:export": true, ... }
```

`hasModuleAccess` returns `true` for admin users unconditionally.

---

## API Response

`GET /api/permissions/me` now includes:

```json
{
  "data": { /* collection permissions */ },
  "isAdmin": false,
  "moduleAccess": { "reports:export": true },
  "meta": { "resource_uri": "/tenant:1" }
}
```

Two things to know about `moduleAccess`:

- **Granted keys only.** `false` is dropped during the OR-merge, so the map never
  contains a `false` value — `Object.keys(moduleAccess)` *is* the grant list.
  Keep checking `=== true` anyway.
- **For an admin it is informational.** The admin branch merges that admin's own
  policies; it is not the set of every registered key. `isAdmin: true` is what
  grants everything, so short-circuit on that rather than reading the map.

`meta.resource_uri` echoes the scope the response was resolved at — use it to key
client-side caches (see Scope Awareness below).

---

## Server-Side Check Pattern

```typescript
const { data: policyIds } = await supabase.rpc('get_user_policies', { user_id: user.id });
const { data: policies } = await supabase
  .from('daas_policies')
  .select('module_access, admin_access')
  .in('id', policyIds ?? []);

const isAdmin = policies?.some(p => p.admin_access);
const allowed = isAdmin || policies?.some(
  p => (p.module_access as Record<string, boolean>)?.['reports:export'] === true
);

if (!allowed) return new Response('Forbidden', { status: 403 });
```

---

## Workflow Integration

```json
{
  "name": "approve",
  "next_state": "approved",
  "module_access_keys": ["workflow:approve"],
  "policies": [],
  "actions": []
}
```

`module_access_keys` and `policies` are OR'd in the transition route. Existing `policies`-only workflows are fully backward compatible.

---

## Scope Awareness

`GET /api/permissions/me` resolves policies against the **active Resource URI**,
so `moduleAccess` reflects only the keys granted at the current scope. A key
granted by a policy bound to `/tenant:A` does not appear while the user is
scoped to `/tenant:B`.

The scope is read from the `X-Resource-Uri` header, then the
`daas_resource_uri` cookie:

| Request carries | Policy resolution |
|---|---|
| neither | `get_user_policies()` — flat, scope-unaware (backward compatible) |
| empty value | root scope — only root assignments + public policies |
| `/tenant:1` | that scope, with upward ancestor matching (an assignment at `/tenant:1` covers `/tenant:1/dept:2`) |

Two consequences for application code:

1. **Cache permissions per scope.** A cache that ignores scope will serve the
   previous tenant's keys after a scope switch. `@buildpad/services`
   `PermissionsService` and `@buildpad/hooks` `usePermissions` both key on the
   scope cookie already.
2. **Server-side checks must see the same scope.** Route handlers that resolve
   policies themselves should pass the request's Resource URI through, so the
   guard agrees with what the UI was told.

### Reading raw policy rows at a scope

`GET /api/policies/me` returns the full `daas_policies` rows effective at a
scope, including `module_access` and any custom JSONB columns the application
added. Use it when you need more than the merged boolean map — otherwise
`/api/permissions/me` is the cheaper call, and it merges for you.

```
GET /api/policies/me
Header: X-Resource-URI: /tenant:123/dept:456   (optional — omit for root scope)
```

```json
{
  "data": [{ "id": "uuid", "name": "Tenant Admin", "admin_access": false,
             "module_access": { "reports:export": true } }],
  "meta": { "resource_uri": "/tenant:123/dept:456", "is_admin": false }
}
```

Backed by `get_user_policies_for_scope(userId, resourceUri)` with upward
ancestor matching. Admin users receive all policies.

---

## Anti-Patterns

| Don't | Do |
|---|---|
| Add a `custom_permissions` column to `daas_policies` | Use the built-in `module_access` column |
| Hand-write `lib/permissions/custom.ts` | `npx @buildpad/cli add services` → `lib/module-access/enforce.ts` |
| Free-text key entry on the policy editor | Register keys in `daas_module_access_keys`, then toggle them |
| `user.role === 'manager'` | `hasModuleAccess('domain:capability')` |
| Trust a client-side check | Enforce with `enforceModuleAccess()` in the route |
