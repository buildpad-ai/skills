---
name: grant-module-access
description: Grant application-level capability flags to users via DaaS Module-Level Access Keys. Keys such as `workflow:approve` or `system:logs` are registered in `daas_module_access_keys`, toggled on policies, and checked in React with `usePermissions().hasModuleAccess(key)` or in API routes with the OR-merge logic already built into the platform. Use when an application needs to gate a feature, page, or workflow command that is not tied to a collection CRUD operation.
argument-hint: "[key names to register] [policies/roles to grant them to]"
---

# Grant Module-Level Access

Add named capability flags to DaaS policies using the platform's built-in Module-Level Access system. No custom columns, no copied server utilities, no manual context wiring needed.

## Concept

DaaS has two independent permission dimensions:

| Dimension | Stored on | Controls |
|---|---|---|
| **Record-Level Access** | `daas_permissions` rows | Which collections a user can CRUD, and with what filters |
| **Module-Level Access** | `daas_policies.module_access` (JSONB) | Whether a user has a named application capability |

Module access keys live in `daas_module_access_keys` — a hierarchical registry. Each leaf key has a format like `workflow:approve` or `system:logs`. Folder nodes (`key = null`) group related keys in the UI.

**OR-merge semantics**: a user holds a key if *any* of their effective policies sets it to `true`. Admin users bypass all checks.

---

## Step 1: Register the Key(s)

Use the MCP `module_access_keys` tool (or the **Module Access Keys** page at `/module-access-keys`).

### Create a folder group (optional)

```json
{
  "name": "module_access_keys",
  "arguments": {
    "action": "create",
    "data": {
      "display_name": "Reporting",
      "description": "Reporting and analytics access",
      "key": null,
      "sort": 40
    }
  }
}
```

### Create leaf key(s)

```json
{
  "name": "module_access_keys",
  "arguments": {
    "action": "create",
    "data": {
      "parent_id": "<folder-uuid>",
      "display_name": "Export Reports",
      "description": "Download CSV/XLSX exports from the Reports page",
      "key": "reports:export",
      "sort": 10
    }
  }
}
```

Key format rules:
- Lowercase letters, digits, and `:`, `_`, `.`, `/`, `-` only
- Must start with a letter
- Globally unique across all keys
- Convention: `<domain>:<capability>` — e.g. `workflow:approve`, `system:logs`, `reports:export`

`system:` and `workflow:` namespaces contain platform-seeded keys. Use a project-specific prefix for application keys.

---

## Step 2: Grant the Key on a Policy

Use the MCP `policies` tool:

```json
{
  "name": "policies",
  "arguments": {
    "action": "update",
    "id": "<policy-uuid>",
    "data": {
      "module_access": {
        "reports:export": true
      }
    }
  }
}
```

Only keys set to `true` are granted. Keys set to `false` or absent are not granted.
Multiple policies held by a user are OR-merged — the user gains the key if *any* policy grants it.

Alternatively, toggle the key in the **Module-Level Access** tab of the Policy editor UI at `/policies/<id>`.

---

## Step 3: Check in React (Client Components)

`hasModuleAccess` is already wired into `PermissionsContext` — no code changes needed:

```tsx
import { usePermissions } from '@/lib/buildpad/hooks';

function ReportsPage() {
  const { hasModuleAccess } = usePermissions();

  return (
    <div>
      <ReportsTable />
      {hasModuleAccess('reports:export') && (
        <Button onClick={handleExport}>Export</Button>
      )}
    </div>
  );
}
```

`hasModuleAccess` returns `true` for admins regardless of the `module_access` map.

---

## Step 4: Check in API Routes (Server-Side)

Query `daas_policies.module_access` directly using the `get_user_policies` RPC:

```typescript
// app/api/reports/export/route.ts
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: policyIds } = await supabase.rpc('get_user_policies', { user_id: user.id });
  const { data: policies } = await supabase
    .from('daas_policies')
    .select('module_access, admin_access')
    .in('id', policyIds ?? []);

  const isAdmin = policies?.some(p => p.admin_access);
  const canExport = isAdmin || policies?.some(
    p => (p.module_access as Record<string, boolean>)?.['reports:export'] === true
  );

  if (!canExport) return new Response('Forbidden', { status: 403 });

  // ... generate export
}
```

---

## Step 5: Gate Workflow Commands (optional)

If the capability controls a workflow state-machine transition, add `module_access_keys` to the command definition:

```json
{
  "name": "approve",
  "next_state": "approved",
  "policies": [],
  "module_access_keys": ["workflow:approve"],
  "actions": []
}
```

`policies` and `module_access_keys` are OR'd — the user may execute the command if they satisfy *either* list. Existing workflows with only `policies` are unaffected.

Two things to know when a key gates a workflow command (observed on DaaS 0.1.98 and Buildpad UI 3.0.0):

- **The transition endpoint has no administrator bypass.** Unlike `hasModuleAccess`, it reads the grant map only, so an administrator who does not hold the key is answered 403. Grant the key on the administrators' policy if they must be able to run the command.
- **`WorkflowButton` does not filter by module access keys.** It offers a key-gated command to every user and the server refuses the ones without the key. Expect that 403 in the UI, or filter the commands yourself with `hasModuleAccess`.

---

## Step 6: Gate Pages and Sidebar Nav (optional)

For pages that should be entirely inaccessible without the key, add a guard at the top of the page component and hide the sidebar nav item:

```tsx
// app/reports/page.tsx
'use client';
import { usePermissions } from '@/lib/buildpad/hooks';

export default function ReportsPage() {
  const { hasModuleAccess } = usePermissions();

  if (!hasModuleAccess('reports:export')) {
    return <Paper p="xl"><Text c="red">You do not have access to this page.</Text></Paper>;
  }

  return <ReportsContent />;
}
```

```tsx
// A client wrapper around AuthenticatedShell that filters the nav items it passes in
{hasModuleAccess('reports:export') && (
  <SidebarNavItem href="/reports" label="Reports" icon={<IconChartBar size={18} />} ... />
)}
```

`hasModuleAccess` already answers `true` for an administrator — do not add `isAdmin ||` in front of it. The check also fails closed while permissions load, so a gated item appears a moment after the page does rather than flashing in and out.

To gate a whole area that only administrators should see (no policy grants it), register a key, grant it on no policy, and check it the same way: administrators pass, everyone else does not, and the area can later be delegated by granting the key.

---

## Summary

| Step | Where | What |
|---|---|---|
| 1 | MCP `module_access_keys` / `/module-access-keys` UI | Register key in the platform catalogue |
| 2 | MCP `policies` / Policy editor UI | Toggle key `true` on the relevant policy |
| 3 | React component | `usePermissions().hasModuleAccess('key')` |
| 4 | API route | Query `daas_policies.module_access` via `get_user_policies` RPC |
| 5 | Workflow command JSON (optional) | Add `module_access_keys: ["key"]` |
| 6 | `LayoutShell.tsx` (optional) | Hide nav item unless key is granted |

## Security Checklist

- [ ] Server-side check in every API route that performs a guarded action (UI checks are UX-only)
- [ ] Admin users (`admin_access: true`) bypass all module access checks — this is intended
- [ ] Key names follow the `<domain>:<capability>` convention and are globally unique
- [ ] Workflow commands use `module_access_keys` instead of bespoke policy IDs where possible

## Required Verification Tests (MANDATORY)

Run these checks whenever module keys are introduced or modified:

- [ ] Granted user can access the gated UI/action
- [ ] Ungranted user cannot see gated UI elements
- [ ] Ungranted user is blocked server-side (`403`) even if UI is bypassed
- [ ] Admin bypass behavior remains correct

If any test fails, treat the feature as incomplete.

## Additional Reference

- [Module access checklist](../../references/module-access-checklist.md)
