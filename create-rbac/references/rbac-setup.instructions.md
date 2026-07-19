---
name: RBAC Setup
description: Complete guide for AI agents to set up role-based access control in DaaS
applyTo: "**/*.{ts,tsx}"
---

# RBAC Setup Instructions

Complete reference for configuring role-based access control (RBAC) via DaaS MCP tools.

## RBAC Entity Graph

```
User ──┬── daas_user_roles ──── Role ──── Access ──── Policy ──── Permission
       │        (M2M junction)                              (collection + action + filter)
       └── Access ──── Policy ──── Permission
            (direct user assignment)
```

> **Important**: Users can have **multiple roles** via the `daas_user_roles` M2M junction table
> (`user_id`, `role_id`, `sort`). There is no single `role` FK on `daas_users`.

### Entity Summary

| Entity         | Table              | Purpose                                              |
| -------------- | ------------------ | ---------------------------------------------------- |
| **Role**       | `daas_roles`       | Named group (e.g., "Editor", "Viewer")               |
| **User↔Role**  | `daas_user_roles`  | M2M junction: assigns one or more roles to a user    |
| **Policy**     | `daas_policies`    | Container for a set of permission rules              |
| **Access**     | `daas_access`      | Junction linking a policy to a role OR user          |
| **Permission** | `daas_permissions` | Single rule: collection + action + field/item filter |

### How Permissions Resolve

A user's effective permissions come from **three sources** combined with OR logic:

1. **Role policies**: ALL roles in `daas_user_roles` → `daas_access` (matching any role) → `policy` → `permissions`
2. **Direct policies**: `daas_access` (where `user = user.id`) → `policy` → `permissions`
3. **Public policies**: `daas_access` (where `role IS NULL AND user IS NULL`) → `policy` → `permissions`

Policies from ALL of a user's roles are collected and merged together.

Admin users (those whose policies grant `admin_access: true`) bypass **all** permission checks. Use `has_admin_access()` RPC to check.

---

## MCP Tool Reference (RBAC)

### roles — Manage Role Definitions

| Action   | Required Fields | Optional                                       |
| -------- | --------------- | ---------------------------------------------- |
| `create` | `data.name`     | `data.icon`, `data.description`, `data.parent` |
| `read`   | —               | `keys`, `query`                                |
| `update` | `id`, `data`    | —                                              |
| `delete` | `keys`          | —                                              |

```json
// Create a role
{ "name": "roles", "arguments": { "action": "create", "data": { "name": "Editor", "icon": "edit", "description": "Can edit content" } } }

// Read all roles
{ "name": "roles", "arguments": { "action": "read" } }
```

### policies — Manage Permission Policies

| Action   | Required Fields | Optional                                                                                    |
| -------- | --------------- | ------------------------------------------------------------------------------------------- |
| `create` | `data.name`     | `data.icon`, `data.description`, `data.admin_access`, `data.app_access`, `data.enforce_tfa`, `data.delegate_access` |
| `read`   | —               | `keys`, `query`                                                                             |
| `update` | `id`, `data`    | —                                                                                           |
| `delete` | `keys`          | —                                                                                           |

```json
// Create a policy
{
  "name": "policies",
  "arguments": {
    "action": "create",
    "data": {
      "name": "Editor Policy",
      "icon": "shield",
      "description": "Editor permissions"
    }
  }
}
```

**Important policy flags:**

- `admin_access: true` — bypasses ALL permission checks (use only for admin policy)
- `app_access: true` — grants access to the DaaS app/dashboard UI
- `enforce_tfa: true` — requires two-factor authentication
- `delegate_access: true` — allows acting on behalf of another user via `X-On-Behalf-Of` header (for service account delegation)

### access — Link Policies to Roles/Users

| Action   | Required Fields | Optional                                               |
| -------- | --------------- | ------------------------------------------------------ |
| `create` | `data.policy`   | `data.role`, `data.user`, `data.sort`                  |
| `read`   | —               | `filter_role`, `filter_user`, `filter_policy`, `query` |
| `delete` | `keys`          | —                                                      |

**Important:** Always pass `data` as a single object, NOT an array. Create one access entry per call.

```json
// Assign policy to role (most common)
{ "name": "access", "arguments": { "action": "create", "data": { "policy": "<policy-uuid>", "role": "<role-uuid>" } } }

// Assign policy directly to user
{ "name": "access", "arguments": { "action": "create", "data": { "policy": "<policy-uuid>", "user": "<user-uuid>" } } }

// Public access (no auth required) — just omit role and user
{ "name": "access", "arguments": { "action": "create", "data": { "policy": "<policy-uuid>" } } }

// Read access entries filtered by role
{ "name": "access", "arguments": { "action": "read", "filter_role": "<role-uuid>" } }
```

### permissions — Manage Permission Rules

> ⚠️ **Two `action` fields — always pass both explicitly:**
>
> - **Top-level `action`** — the CRUD operation: `"create"`, `"read"`, `"update"`, `"delete"`
> - **`data.action`** — the _permission action_ being granted: `"create"`, `"read"`, `"update"`, `"delete"`, `"share"`
>
> The `data` parameter accepts a **single object** or **array of objects**. The JSON Schema for this tool uses `z.any()` (no oneOf), so any valid object or array is accepted — validation happens server-side.

| Action   | Required Fields                                 | Optional                                                             |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `create` | `data.policy`, `data.collection`, `data.action` | `data.fields`, `data.permissions`, `data.validation`, `data.presets` |
| `read`   | —                                               | `keys`, `policy`, `collection`, `query`                              |
| `update` | `id`, `data`                                    | —                                                                    |
| `delete` | `keys`                                          | —                                                                    |

```json
// Create read permission with item filter
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": {
      "policy": "<policy-uuid>",
      "collection": "articles",
      "action": "read",
      "fields": ["id", "title", "content", "status"],
      "permissions": { "status": { "_eq": "published" } }
    }
  }
}
```

**Permission actions:** `create`, `read`, `update`, `delete`, `share`

**Fields values:**

- `["*"]` — all fields allowed
- `["id", "title", "content"]` — specific fields only
- `null` — all fields (same as `["*"]`)

**Permissions values (item-level filter):**

- `null` — no filter, all items accessible
- `{ "field": { "_op": "value" } }` — filter using DaaS filter syntax

---

## Dynamic Variables

Use these in `permissions` (item filters), `validation`, and `presets` fields:

| Variable                           | Type        | Description                                              | Example                                                        |
| ---------------------------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `$CURRENT_USER`                    | `string`    | Current user's UUID                                      | `{ "user_created": { "_eq": "$CURRENT_USER" } }`               |
| `$CURRENT_USER.<field>`            | `any`       | A field on the current user                              | `{ "organization": { "_eq": "$CURRENT_USER.organization" } }`  |
| `$CURRENT_USER.<relation>.<field>` | `any`       | Nested relation field                                    | `{ "department": { "_eq": "$CURRENT_USER.role.department" } }` |
| `$CURRENT_ROLE`                    | `string`    | User's **primary** role UUID (lowest `sort` in junction) | `{ "assigned_role": { "_eq": "$CURRENT_ROLE" } }`              |
| `$CURRENT_ROLES`                   | `string[]`  | **All** role UUIDs for the user (all junction rows)      | `{ "target_role": { "_in": "$CURRENT_ROLES" } }`               |
| `$CURRENT_POLICIES`                | `string[]`  | All policy UUIDs for the user                            | `{ "required_policy": { "_in": "$CURRENT_POLICIES" } }`        |
| `$NOW`                             | `timestamp` | Current timestamp                                        | `{ "publish_date": { "_lte": "$NOW" } }`                       |

> **Prefer `$CURRENT_ROLES` over `$CURRENT_ROLE`** when users can have multiple roles — it captures all role assignments.

### Variable Resolution

Dynamic variables are resolved at query-time by the permission enforcer. They work in:

- `permissions` field — item-level filters
- `presets` field — default values for create/update
- `validation` field — validation rules

Nested paths like `$CURRENT_USER.organization.name` resolve by traversing relations on the `daas_users` table.

---

## Common RBAC Patterns

### Pattern 1: Own Items CRUD

Users can fully manage their own items and read others' published items.

```json
// Create — auto-set author
{ "policy": "P", "collection": "C", "action": "create", "fields": ["*"], "presets": { "user_created": "$CURRENT_USER" } }

// Read — own items + published
{ "policy": "P", "collection": "C", "action": "read", "fields": ["*"], "permissions": { "_or": [{ "user_created": { "_eq": "$CURRENT_USER" } }, { "status": { "_eq": "published" } }] } }

// Update — own items only
{ "policy": "P", "collection": "C", "action": "update", "fields": ["title", "content", "status"], "permissions": { "user_created": { "_eq": "$CURRENT_USER" } } }

// Delete — own items only
{ "policy": "P", "collection": "C", "action": "delete", "permissions": { "user_created": { "_eq": "$CURRENT_USER" } } }
```

### Pattern 2: Role Hierarchy (Admin → Editor → Viewer)

```text
Admin Policy:   admin_access: true on policy (bypasses everything)
Editor Policy:  full CRUD on content collections, read on users
Viewer Policy:  read-only on published content
```

### Pattern 3: Scope-Based Multi-Tenancy

Use the DaaS scope system for tenant/org isolation. RBAC only defines the role and policy — scope enforcement is handled by the platform automatically.

```json
// 1. Create a role and policy as normal
// mcp_daas_roles -> { "name": "Member" }
// mcp_daas_policies -> { "name": "Member Access" }

// 2. Create permissions with NO tenant filter — scope handles isolation
{
  "policy": "<policy-id>",
  "collection": "orders",
  "action": "read",
  "fields": ["*"],
  "permissions": null
}

// 3. Assign user to role at a specific scope node
// mcp_daas_scope -> action: assign_user_role
{
  "user_id": "<uuid>",
  "role_id": "<role-uuid>",
  "resource_uri": "/<type-uuid>:<tenant-uuid>"
}

// 4. Configure collection to filter by scope
// mcp_daas_scope -> action: update_config
{
  "collection": "orders",
  "scope_field": "tenant_id",
  "inheritance_mode": "exact",
  "missing_uri_mode": "strict"
}
```

The platform resolves: active scope URI → match `scope_field` value → return only that tenant's data. No permission filter needed. See `/manage-scope` skill for complete setup.

### Pattern 4: Public Read, Authenticated Write

```json
// Public policy (access.role=null, access.user=null)
{ "policy": "public-P", "collection": "articles", "action": "read", "fields": ["id", "title", "content", "author"], "permissions": { "status": { "_eq": "published" } } }

// Authenticated policy (access.role = authenticated-role)
{ "policy": "auth-P", "collection": "articles", "action": "create", "fields": ["title", "content"], "presets": { "status": "draft", "user_created": "$CURRENT_USER" } }
```

### Pattern 5: System Collection Permissions

For `daas_users`, `daas_files`, etc.:

```json
// Allow reading user profiles (limited fields)
{ "policy": "P", "collection": "daas_users", "action": "read", "fields": ["id", "email", "first_name", "last_name", "avatar"] }

// Allow users to update their own profile
{ "policy": "P", "collection": "daas_users", "action": "update", "fields": ["first_name", "last_name", "avatar", "theme"], "permissions": { "id": { "_eq": "$CURRENT_USER" } } }

// Allow file uploads
{ "policy": "P", "collection": "daas_files", "action": "create", "fields": ["*"] }
{ "policy": "P", "collection": "daas_files", "action": "read", "fields": ["*"], "permissions": { "uploaded_by": { "_eq": "$CURRENT_USER" } } }
```

---

## Step-by-Step RBAC Setup Workflow

### 1. Read existing schema

```json
{ "name": "schema", "arguments": {} }
```

### 2. Identify collections that need permissions

Exclude system collections unless explicitly needed. Focus on user-created collections.

### 3. Create roles

One MCP call per role. Save the returned UUIDs.

### 4. Create policies

One per role (or one shared + role-specific). Save UUIDs.

### 5. Create access entries

Link each policy to its role. **One `create` call per policy-role pair** — do NOT try to batch into arrays.

```json
// For each policy that a role needs:
{
  "name": "access",
  "arguments": {
    "action": "create",
    "data": { "policy": "<policy-uuid>", "role": "<role-uuid>" }
  }
}
```

### 6. Create permissions

Batch by policy. For each policy, create all collection×action permission rules.

### 7. Verify

Read back permissions per policy:

```json
{
  "name": "permissions",
  "arguments": { "action": "read", "policy": "<policy-uuid>" }
}
```

Test via debug endpoint:

```
GET /api/permissions/me?debug=true
Authorization: Bearer <user-token>
```

---

## Validation Checklist

Before considering RBAC setup complete, verify:

- [ ] Every role has at least one policy linked via access
- [ ] Every collection in the app has at least read permissions for the intended roles
- [ ] `daas_users` has read permission if the app shows user info (avatars, names)
- [ ] `daas_files` has create+read permission if the app allows file uploads
- [ ] Item-level filters use correct dynamic variables (not hardcoded UUIDs)
- [ ] Presets auto-set `user_created` on create actions where needed
- [ ] Field lists don't accidentally expose sensitive columns (password, token, secret)
- [ ] Non-admin roles do NOT have `admin_access: true` on their policy

---

## Delete Operations

Delete operations on RBAC entities require `allowDeletes: true` in the MCP server settings. The setting is stored in `daas_settings.mcp_allow_deletes`.

When deletes are disabled, use update operations to deactivate rather than remove:

- Roles: remove access entries instead of deleting the role
- Policies: remove access entries to unlink from roles
- Permissions: update `fields` to empty array or set restrictive filter

---

## Troubleshooting

| Symptom                           | Cause                              | Fix                                                  |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| 403 on all requests               | No matching permission rule        | Create permission for collection+action              |
| Empty results (not 403)           | Item filter too restrictive        | Check `permissions` filter logic                     |
| Missing fields in response        | `fields` array too narrow          | Add missing fields to permission                     |
| User can see others' data         | No item filter                     | Add `{ "user_created": { "_eq": "$CURRENT_USER" } }` |
| `$CURRENT_USER.org` not resolving | Field doesn't exist on users table | Verify field name via schema tool                    |
| Delete operations fail            | `allowDeletes` is false            | Enable in settings or use update instead             |
