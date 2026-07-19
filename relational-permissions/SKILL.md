---
name: relational-permissions
description: Configure permissions on junction and child collections so that nested relational writes (M2M, O2M, M2A) are enforced at every level — not just the parent. Use when setting up write access for collections that participate in relational fields, or when debugging silent no-ops on nested mutations.
argument-hint: "[parent collection] [relation type] [child/junction collection]"
---

# Relational Permissions

Configure permission enforcement for nested relational writes so that create/update/delete operations on junction and child collections are gated by the same two-layer model as top-level collections.

## Why This Matters

When a client sends a PATCH to a parent collection with nested relational data:

```json
PATCH /api/items/cmp_catalogues/:id
{
  "catalogue_services": {
    "create": [{ "service_id": "...", "quantity": 1 }],
    "delete": ["junction-row-id"]
  }
}
```

The platform checks permission on `cmp_catalogues` (the parent). Without relational permission enforcement, the write to `cmp_catalogue_services` (the junction table) would execute **without any permission check** — any user with `update` on the parent could freely create/delete junction rows.

With relational permissions enabled, the platform also checks:
- `create` on `cmp_catalogue_services` (for the `create` block)
- `delete` on `cmp_catalogue_services` (for the `delete` block)

---

## Two-Layer Enforcement Model

```
Request with nested relational data
│
├─ Layer 1: Gate Check (boolean)
│  "Does the user have ANY permission for this action on this child collection?"
│  → 403 if no → abort
│
└─ Layer 2: Item-Level Filter
   "Which specific rows can the user touch?"
   → Resolved from daas_permissions.permissions JSONB
   → Applied as WHERE clause on UPDATE/DELETE
   → Applied as validation/fields/presets on INSERT
```

### Layer 1 — Gate Check

Uses `check_permission_with_scope` (scope-aware) or `check_permission` (flat). Returns true/false. Cached per request.

### Layer 2 — Item-Level Filter

| Operation | How applied |
|---|---|
| UPDATE | Filter merged into WHERE clause — non-matching rows unchanged |
| DELETE | Filter merged into WHERE clause — non-matching rows kept |
| Nullify (O2M deselect) | Same as UPDATE |
| INSERT | `fields` (allowlist), `validation` (pre-check), `presets` (server defaults) |

---

## Setup Steps

### Step 1 — Identify the child/junction collections

For each relational field on the parent collection, identify the target table:

| Relation type | Target table |
|---|---|
| M2M | Junction table (from `daas_relations.many_collection` where `junction_field` is set) |
| O2M | Child table (from `daas_relations.many_collection`) |
| M2A | Junction table + each target collection in `one_allowed_collections` |

Use MCP to query:

```json
{
  "method": "tools/call",
  "params": {
    "name": "read_items",
    "arguments": {
      "collection": "daas_relations",
      "query": {
        "filter": { "one_collection": { "_eq": "cmp_catalogues" } }
      }
    }
  }
}
```

### Step 2 — Create permissions on the child/junction collection

For each action the user needs on the child collection, create a `daas_permissions` row under the appropriate policy:

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_item",
    "arguments": {
      "collection": "daas_permissions",
      "item": {
        "policy": "<policy-uuid>",
        "collection": "cmp_catalogue_services",
        "action": "create",
        "fields": ["catalogue_id", "service_id", "quantity", "unit_price"],
        "presets": {
          "user_created": "$CURRENT_USER"
        },
        "permissions": null,
        "validation": null
      }
    }
  }
}
```

Repeat for `update` and `delete` as needed:

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_item",
    "arguments": {
      "collection": "daas_permissions",
      "item": {
        "policy": "<policy-uuid>",
        "collection": "cmp_catalogue_services",
        "action": "delete",
        "permissions": {
          "user_created": { "_eq": "$CURRENT_USER" }
        }
      }
    }
  }
}
```

### Step 3 — Verify with the audit endpoint

```
GET /api/utils/audit-relational-permissions
```

This returns a report of all junction/child collections that are missing permissions for roles with parent access. After your setup, the child collection should no longer appear in the gap report.

### Step 4 — Enable enforcement

Set the environment variable:

```
ENFORCE_RELATIONAL_PERMISSIONS=true
```

⚠️ In warn mode (`false`, default), violations are logged but not blocked. Switch to `true` only after all permissions are seeded.

---

## Filter Rule Constraints

🔴 **CRITICAL:** Not all filter patterns work on child/junction mutation queries. When writing `permissions` JSONB rules for child collections, use only the patterns marked ✅ below.

### Supported (use these)

| Pattern | Example |
|---|---|
| Scalar operators | `{ "status": { "_eq": "active" } }` |
| `_in` / `_nin` | `{ "type": { "_in": ["A", "B"] } }` |
| `_null` / `_nnull` | `{ "deleted_at": { "_null": true } }` |
| String operators | `{ "name": { "_starts_with": "TMP-" } }` |
| `_between` / `_regex` | `{ "sort": { "_between": [1, 100] } }` |
| `_and` / `_or` (scalar only) | `{ "_and": [{ "status": { "_eq": "draft" } }, { "user_created": { "_eq": "$CURRENT_USER" } }] }` |
| `$CURRENT_USER` / `$CURRENT_POLICIES` | `{ "user_created": { "_eq": "$CURRENT_USER" } }` |

### Unsupported — do NOT use on child collections

| Pattern | Why | Impact if used |
|---|---|---|
| `_has` (relation existence) | PostgREST UPDATE/DELETE don't support `!inner` joins | Filter silently ignored — wider access than intended |
| Dot-notation (`owner.status`) | Same as `_has` — requires embedded-resource joins | Filter silently ignored |
| `_some` / `_none` | Not implemented in filter translator | Operator silently skipped — wider access |
| `_or` mixing scalar + relational | Relational branch silently dropped | Partial enforcement only |

---

## Nesting Depth Limit

Relational writes are processed **one level deep**. Nested relational fields inside a child record payload are **not recursively processed**.

```
✅ parent → child (1 level)
❌ parent → child → grandchild (2 levels — grandchild ignored)
```

To mutate deeper levels, issue separate API calls for each level.

---

## Common Patterns

### Full junction access scoped to current user

```json
{
  "action": "create",
  "collection": "catalogue_services",
  "fields": ["catalogue_id", "service_id", "quantity", "unit_price"],
  "presets": { "user_created": "$CURRENT_USER" }
}
```
```json
{
  "action": "delete",
  "collection": "catalogue_services",
  "permissions": { "user_created": { "_eq": "$CURRENT_USER" } }
}
```

### O2M child with field restriction + validation

```json
{
  "action": "create",
  "collection": "order_items",
  "fields": ["product_id", "quantity", "unit_price"],
  "validation": { "quantity": { "_gte": 1, "_lte": 100 } },
  "presets": { "user_created": "$CURRENT_USER" }
}
```

### Read-only junction (user cannot modify relations)

Do not create any `create`/`update`/`delete` permission on the junction collection. The gate check will reject all mutation attempts.

---

## References

- [Relational Permissions Documentation](../../microbuild-supabase-users/docs/RELATIONAL_PERMISSIONS.md)
- [Create RBAC Skill](../create-rbac/SKILL.md)
- [Grant Module Access Skill](../grant-module-access/SKILL.md)
- [Manage Scope Skill](../manage-scope/SKILL.md)
