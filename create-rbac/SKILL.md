---
name: create-rbac
description: Set up complete role-based access control for DaaS applications including roles, policies, permissions, access entries, and dynamic filters. Supports patterns like own_items, role_hierarchy, and public_read. For multi-tenancy, use /manage-scope which handles scope-aware role assignment natively. Use when the user needs roles, permissions, access control, or security configuration.
argument-hint: "[collections] [roles] [pattern: own_items|role_hierarchy|public_read]"
---

# Create RBAC Configuration

Set up complete role-based access control using DaaS MCP tools.

## RBAC Entity Hierarchy

```
Role → Access → Policy → Permission (collection × action × filter)
```

## Setup Steps

### Step 1: Plan Permission Matrix

```
| Role   | Collection | Action | Fields | Filter                    | Presets                   |
|--------|-----------|--------|--------|---------------------------|---------------------------|
| Editor | articles  | create | *      | null                      | { user_created: $CUR_USER }|
| Editor | articles  | read   | *      | null                      | null                      |
| Author | articles  | update | *      | { user_created: $CUR_USER }| null                     |
```

### Step 2: Create Roles (via MCP)

```json
{
  "name": "roles",
  "arguments": {
    "action": "create",
    "data": { "name": "Editor", "icon": "edit" }
  }
}
```

#### Scope-Restricted Roles

Use `scope_config` to control where a role can be assigned:

```json
{
  "name": "roles",
  "arguments": {
    "action": "create",
    "data": {
      "name": "Branch Manager",
      "icon": "business",
      "scope_config": {
        "allowed_scopes": ["^/.*branch"],
        "validation_message": "{role_name} requires a branch scope"
      }
    }
  }
}
```

| `scope_config` value               | Effect                                |
| ---------------------------------- | ------------------------------------- |
| `null` (default)                   | No restrictions — assignable anywhere |
| `{ "allowed_scopes": [] }`         | **Locked** — cannot be assigned       |
| `{ "allowed_scopes": [".+"] }`     | Scoped only — requires `resource_uri` |
| `{ "allowed_scopes": ["^$"] }`     | Global only — no `resource_uri`       |
| `{ "allowed_scopes": ["^/org:"] }` | Pattern match on `resource_uri`       |

When reading roles, each includes a computed `assignable: boolean` based on the request's `X-Resource-Uri`.

### Step 3: Create Policies

```json
{
  "name": "policies",
  "arguments": { "action": "create", "data": { "name": "Editor Policy" } }
}
```

### Step 4: Link via Access

```json
{
  "name": "access",
  "arguments": {
    "action": "create",
    "data": { "policy": "<policy-id>", "role": "<role-id>" }
  }
}
```

### Step 5: Create Permissions

> ⚠️ **`data.action` is the permission action** (what access is granted: `read`/`create`/`update`/`delete`/`share`), not the tool operation. The top-level `action: "create"` is the CRUD operation. Always pass both.

```json
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": {
      "policy": "<policy-id>",
      "collection": "articles",
      "action": "read",
      "fields": ["*"]
    }
  }
}
```

## Scoped Role Assignments (Multi-tenancy / Hierarchy)

To grant a role that is only effective within a specific scope node (and its descendants), use the `scope` MCP tool instead of the `users` tool:

```json
// mcp_daas_scope -> action: assign_user_role
{
  "user_id": "<user-uuid>",
  "role_id": "<role-uuid>",
  "resource_uri": "/<type-uuid>:<item-uuid>"
}
```

This writes to `daas_user_roles.resource_uri`. The role is only evaluated when the user's active scope URI is equal to or a descendant of `resource_uri`. Global (cross-scope) roles use the `users` tool `add_roles` action (which sets `resource_uri: null`).

See `/manage-scope` skill for full scope setup.

> **Lifecycle Events:** Role and policy assignment operations emit events: `daas_access.items.create/update/delete` (policy assignments), `daas_user_roles.items.create/delete` (role assignments). You can attach runtime extensions to react to permission changes (e.g., sending a welcome notification when a user is granted a role, or invalidating permission caches).

## Dynamic Variables for Filters

| Variable                           | Description       |
| ---------------------------------- | ----------------- |
| `$CURRENT_USER`                    | User's UUID       |
| `$CURRENT_USER.<field>`            | Field on user     |
| `$CURRENT_USER.<relation>.<field>` | Nested relation   |
| `$CURRENT_ROLE`                    | Primary role UUID |
| `$NOW`                             | Current timestamp |

## Common Filter Patterns

```json
// Own items only
{ "user_created": { "_eq": "$CURRENT_USER" } }

// Published OR own drafts
{ "_or": [{ "status": { "_eq": "published" } }, { "user_created": { "_eq": "$CURRENT_USER" } }] }

// Same organization
{ "organization": { "_eq": "$CURRENT_USER.organization" } }
```

## Security Principles

1. **Least privilege** — start with no access, grant only what's needed
2. **Defense in depth** — item-level AND field-level restrictions
3. **No hardcoded IDs** — always use dynamic variables
4. **Sensitive fields** — never expose password, token, secret fields
5. **Verify** — read back permissions and test with debug endpoint

## Required: Permissions Proxy Route

> ⚠️ **ALWAYS verify this route exists before testing RBAC.** If it's missing, `CollectionList` and `CollectionForm` fall back to empty permissions and silently grant full UI access to all users — making RBAC appear to have no effect. DaaS still enforces permissions server-side, but the UI won't reflect them.

Check whether `app/api/permissions/me/route.ts` exists. If not, create it:

```ts
// app/api/permissions/me/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getDaaSUrl } from "@/lib/api/auth-headers";

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaaSUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/permissions/me${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy error";
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
```

This route proxies `GET /permissions/me` from DaaS using the current user's JWT, so Buildpad components can resolve CRUD permissions without cross-origin requests.

## Required: Module-Level Access Keys (ALWAYS include with RBAC)

After setting up roles and policies, **always** register Module-Level Access Keys for every non-CRUD capability gate in the feature. Raw role name checks (`user.role === 'manager'`, `if (roleName === 'admin')`) are forbidden — every capability gate must go through this system.

### Step 1 — Register key(s)

```json
// mcp_daas_module_access_keys → action: "create"
// Optional: create a folder node first (key: null), then leaf keys under it
{
  "parent_id": "<folder-uuid-or-null>",
  "display_name": "Approve Tickets",
  "description": "Can approve or reject ticket submissions",
  "key": "tickets:approve",
  "sort": 10
}
```

Key naming convention: `<domain>:<capability>` (e.g. `tickets:approve`, `dashboard:manager_stats`, `reports:export`).
The `system:` and `workflow:` prefixes are platform-reserved — use a project-specific prefix.

### Step 2 — Grant on policy

```json
// mcp_daas_policies → action: "update"
{
  "id": "<policy-uuid>",
  "data": {
    "module_access": {
      "tickets:approve": true
    }
  }
}
```

OR-merge semantics: the user gains the key if *any* of their effective policies sets it to `true`. Admin users bypass all checks.

### Step 3 — Check in React

```tsx
const { hasModuleAccess } = usePermissions();

// Gate UI elements
{hasModuleAccess('tickets:approve') && (
  <Button onClick={handleApprove}>Approve</Button>
)}

// Gate entire pages / sidebar nav items
if (!hasModuleAccess('dashboard:manager_stats')) {
  return <Text c="dimmed">Access denied.</Text>;
}
```

`hasModuleAccess` returns `true` for admins regardless of the policy map.

### Step 4 — Validate (no raw role checks)

After generating `.tsx` files, run:

```bash
grep -rn "role === \|roleName\|user\.role\|is_manager\|is_admin\|isManager\b" app/ components/ 2>/dev/null
grep -rn "detectAdminFromMe\|checkAdmin\|roleObj\.name === 'Administrator'\|admin_access\s*===\s*true\|\bisAdmin\b" app/ components/ 2>/dev/null
```

Any match that is NOT reading from `hasModuleAccess` must be replaced before proceeding.

### Step 5 — Capability Matrix Artifact (STOP-SHIP)

Before considering RBAC setup complete, produce a capability matrix in the response:

- key name (`domain:capability`)
- policy grants (`module_access` map)
- UI guard locations (`hasModuleAccess`)
- API guard locations (module_access OR-merge checks)

If this artifact is missing, RBAC work is incomplete.

---

## Required: E2E Tests

Create `tests/api/rbac-[app].spec.ts`:

- Test each role's allowed actions
- Test denied actions return 403
- Test item-level filtering works
- Test field-level restrictions

## References

- [RBAC setup guide](references/rbac-setup.instructions.md)
- [Permissions filtering](references/permissions-filtering.instructions.md)
- [Module access checklist](../../references/module-access-checklist.md)
