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
import { usePermissions } from '@/lib/hooks';

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
  "moduleAccess": {
    "reports:export": true,
    "workflow:approve": false
  }
}
```

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


Full implementation guide for adding named boolean permission flags (`"MyApp.Feature.Key": true`) that integrate with the DaaS Policy/Role/User assignment chain.

## Architecture Overview

```
daas_policies.custom_permissions (JSONB)
  └─ { "MyApp.Dashboard.TaskWidget": true, "MyApp.Reports.Export": false }

User
 ├── daas_access (direct user → policy)
 └── daas_user_roles → Role → daas_access → Policy
                                           ↓
            merge all policies with OR → effectiveCustomPermissions
```

One policy assignment grants both data-access rules (existing `daas_permissions` rows) and custom capability flags (`custom_permissions` JSONB).

---

## Database: Add Column via MCP

```json
// MCP tool call — no SQL migration file needed
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "daas_policies",
      "field": "custom_permissions",
      "type": "json",
      "meta": {
        "required": false,
        "hidden": false,
        "note": "Application capability flags: { \"AppName.Domain.Key\": boolean }"
      }
    }
  }
}
```

`PATCH /api/policies/:id` immediately accepts and round-trips `custom_permissions` because DaaS uses `select('*')`.

---

## Server-Side Utilities (`lib/permissions/custom.ts`)

```typescript
// Installed via: npx buildpad add lib/permissions/custom
import { getCustomPermissions, hasCustomPermission, enforceCustomPermission } from '@/lib/permissions/custom';

// In a Server Component
const perms = await getCustomPermissions();
// → { "MyApp.Dashboard.TaskWidget": true, "MyApp.Reports.Export": false }

// In an API route handler
await enforceCustomPermission('MyApp.LeaveRequest.Reject'); // throws PermissionError(403) if denied
```

### Full API

| Export | Where to use | Behaviour |
|--------|-------------|-----------|
| `getCustomPermissions()` | Server Component, API route | Returns merged `Record<string, boolean>` for current user |
| `hasCustomPermission(key)` | Server Component, API route | Returns `boolean` for one key |
| `enforceCustomPermission(key)` | API route handler | Throws 403 `PermissionError` if key is not `true` |

Admin users (any policy with `admin_access: true`) always receive `true` for all keys.

---

## Extend `/api/permissions/me`

```typescript
// Append to the existing /api/permissions/me GET handler
import { resolveCustomPermissions } from '@/lib/permissions/custom';

// After building allPermissions...
const custom = isAdmin ? {} : await resolveCustomPermissions(supabase, policyIdArray);

return NextResponse.json({
  data: allPermissions,
  custom,          // ← new field piggybacks on existing request
  isAdmin,
});
```

Or add a standalone endpoint:

```
GET /api/permissions/me/custom
→ { "data": { "MyApp.Dashboard.TaskWidget": true, ... } }
```

---

## Built-in: `GET /api/policies/me` (Scope-aware)

The platform provides `GET /api/policies/me` which returns the **full policy rows** for the current user at a given scope, including any custom JSONB fields:

```
GET /api/policies/me
Header: X-Resource-URI: /tenant:123/dept:456   (optional — omit for root scope)
```

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tenant Admin",
      "admin_access": false,
      "custom_permissions": { "MyApp.Dashboard.TaskWidget": true },
      "feature_flags": { "beta_ui": true }
    }
  ],
  "meta": {
    "resource_uri": "/tenant:123/dept:456",
    "is_admin": false
  }
}
```

Uses `get_user_policies_for_scope(userId, resourceUri)` with upward ancestor matching. Admin users receive all policies.

The client owns merging logic — example with boolean OR:

```typescript
// Merge custom_permissions across all policies (true wins)
const flags = policies.data.reduce((acc, policy) => ({
  ...acc,
  ...(policy.custom_permissions ?? {}),
}), {} as Record<string, boolean>);

const canReject = flags['MyApp.LeaveRequest.Reject'] === true;
```

This is the **recommended approach** when the application adds custom JSONB columns to `daas_policies` and needs to read them client-side at a specific scope.

---

## Client-Side Context Extension

```typescript
// lib/contexts/PermissionsContext.tsx — add to PermissionsContextValue
interface PermissionsContextValue {
  // ... existing fields ...
  customPermissions: Record<string, boolean>;
  hasCustomPermission: (key: string) => boolean;
}

// In PermissionsProvider.fetchPermissions()
const data = await response.json();
setPermissions(data.data || {});
setCustomPermissions(data.custom || {});   // ← no extra network call

// Resolver
const hasCustomPermission = useCallback(
  (key: string): boolean => {
    if (isAdmin) return true;
    return customPermissions[key] === true;
  },
  [customPermissions, isAdmin]
);
```

---

## Client Hooks

```typescript
/**
 * Check a single custom permission flag.
 * Returns false when key is absent or explicitly false.
 *
 * @example
 * const canReject = useCustomPermission('MyApp.LeaveRequest.Reject');
 * return canReject ? <Button>Reject</Button> : null;
 */
export function useCustomPermission(key: string): boolean {
  const { hasCustomPermission } = usePermissions();
  return useMemo(() => hasCustomPermission(key), [key, hasCustomPermission]);
}

/**
 * Returns the full resolved custom permissions map.
 * Useful for rendering dynamic capability lists.
 */
export function useCustomPermissions(): Record<string, boolean> {
  const { customPermissions } = usePermissions();
  return customPermissions;
}
```

---

## API Route Pattern

```typescript
// app/api/leave-requests/[id]/reject/route.ts
import { enforceCustomPermission } from '@/lib/permissions/custom';
import { enforcePermission } from '@/lib/permissions/enforcer';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Custom flag guard (application capability)
  await enforceCustomPermission('MyApp.LeaveRequest.Reject');

  // 2. Data-access guard (collection permission) — unchanged
  await enforcePermission({ collection: 'leave_requests', action: 'update' });

  // 3. Business logic
  const { id } = await params;
  // ...
}
```

Both `enforceCustomPermission` and `enforcePermission` throw `PermissionError` which the standard error handler serialises as `{ error: '...' }` with status 403.

---

## Component Patterns

### Guard a widget

```tsx
function Dashboard() {
  const showTaskWidget = useCustomPermission('MyApp.Dashboard.TaskWidget');
  const showAnalytics  = useCustomPermission('MyApp.Dashboard.Analytics');

  return (
    <SimpleGrid cols={2}>
      {showTaskWidget && <TaskWidget />}
      {showAnalytics  && <AnalyticsWidget />}
      <CalendarWidget /> {/* always visible */}
    </SimpleGrid>
  );
}
```

### Guard action buttons

```tsx
function LeaveRequestActions({ id }: { id: string }) {
  const canApprove = useCustomPermission('MyApp.LeaveRequest.Approve');
  const canReject  = useCustomPermission('MyApp.LeaveRequest.Reject');

  return (
    <Group>
      {canApprove && <Button color="green" onClick={() => approve(id)}>Approve</Button>}
      {canReject  && <Button color="red"   onClick={() => reject(id)}>Reject</Button>}
    </Group>
  );
}
```

### Guard a page (Server Component)

```typescript
// app/reports/export/page.tsx
import { hasCustomPermission } from '@/lib/permissions/custom';
import { redirect } from 'next/navigation';

export default async function ExportPage() {
  if (!(await hasCustomPermission('MyApp.Reports.Export'))) redirect('/403');
  // ...
}
```

---

## Policy Editor UI (`components/CustomPermissionsEditor.tsx`)

```bash
npx buildpad add components/CustomPermissionsEditor
```

```tsx
// Usage in Policy detail page
import { CustomPermissionsEditor } from '@/components/CustomPermissionsEditor';

{!isNew && policy && (
  <Paper shadow="xs" p="md" withBorder mt="md">
    <CustomPermissionsEditor
      policyId={policy.id}
      onChange={(updated) => console.log('custom_permissions saved', updated)}
    />
  </Paper>
)}
```

The editor validates key naming (`AppName.Domain.Capability` dot-notation), prevents duplicates, and persists via `PATCH /api/policies/:id`.

---

## Key Naming Rules

| Rule | Example |
|------|---------|
| Must start with app name | `MyApp.` |
| Three segments minimum | `MyApp.Domain.Capability` |
| PascalCase segments | `MyApp.LeaveRequest.Reject` |
| Reserved: `DaaS.*` | Never use this prefix |
| Multi-tenant: prefix with scope | `TenantA.MyApp.Reports.Export` |

---

## Security

- FE `useCustomPermission` checks are **UX only** (hide/show controls)
- `enforceCustomPermission` in the API route is the **security boundary**
- Only `admin_access: true` users can write `daas_policies` — no privilege escalation
- Admin bypass is consistent with collection permission behaviour
