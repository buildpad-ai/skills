---
name: Standard Collection Fields
description: Canonical field definitions for DaaS collections. Every collection MUST include audit fields. Workflow and scope fields are added when the collection requires those features. Contains copy-pasteable MCP JSON payloads.
applyTo: "**/*.{ts,tsx,json,sql}"
---

# Standard Collection Fields

This reference defines the **mandatory and optional field groups** that every DaaS collection must follow. The DaaS platform does NOT auto-add these fields — you must create them explicitly via MCP or SQL migration.

> **Rule: Every collection MUST include Group A (Audit Fields).** Group B and C are added based on feature requirements.

> **Rule: add every `uuid` relation field (`user_created`, `user_updated`, `workflow_instance`) with the `fields` tool, after the collection exists.**
>
> - A many-to-one is turned into a foreign key and a relation from **`meta.options.related_collection`** (with the `m2o` special). `schema.foreign_key_table` is not read on create — the Next.js backend ignores it and the Go engine refuses it — so the field would be a bare column.
> - Listed inline in the `collections` create call, every `uuid` column gets `DEFAULT gen_random_uuid()` (observed on DaaS 0.1.98). A relation column then holds a random UUID that references nothing, or — once it has a foreign key — makes every insert fail.

---

## Group A: Audit Fields (ALWAYS Include)

These four fields enable automatic user/timestamp tracking. The DaaS platform recognizes the `special` attribute values `date-created`, `date-updated`, `user-created`, `user-updated` and auto-populates them on item create/update operations.

### MCP Payload (use with `mcp_daas_fields`)

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "YOUR_COLLECTION",
        "field": "user_created",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["user-created", "m2o"],
          "readonly": true,
          "hidden": true,
          "width": "half",
          "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" }
        }
      },
      {
        "collection": "YOUR_COLLECTION",
        "field": "date_created",
        "type": "timestamp",
        "meta": {
          "interface": "datetime",
          "special": ["date-created"],
          "readonly": true,
          "width": "half",
          "display": "datetime"
        },
        "schema": {
          "default_value": "CURRENT_TIMESTAMP"
        }
      },
      {
        "collection": "YOUR_COLLECTION",
        "field": "user_updated",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["user-updated", "m2o"],
          "readonly": true,
          "hidden": true,
          "width": "half",
          "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" }
        }
      },
      {
        "collection": "YOUR_COLLECTION",
        "field": "date_updated",
        "type": "timestamp",
        "meta": {
          "interface": "datetime",
          "special": ["date-updated"],
          "readonly": true,
          "width": "half",
          "display": "datetime"
        }
      }
    ]
  }
}
```

### SQL Migration Equivalent

```sql
user_created uuid REFERENCES auth.users(id),
date_created timestamptz DEFAULT now(),
user_updated uuid REFERENCES auth.users(id),
date_updated timestamptz
```

---

## Group B: Workflow Fields (Include When Collection Uses Workflows)

Add these fields when the collection needs a state machine (draft/review/published, approval flows, etc.). After adding these fields, proceed to the `create-workflow` skill to define the workflow definition and assignment.

### MCP Payload (use with `mcp_daas_fields`)

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "YOUR_COLLECTION",
        "field": "workflow_instance",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true,
          "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" }
        }
      },
      {
        "collection": "YOUR_COLLECTION",
        "field": "workflow_state",
        "type": "string",
        "meta": {
          "interface": "xtr-interface-workflow",
          "readonly": true
        }
      }
    ]
  }
}
```

### SQL Migration Equivalent

```sql
workflow_instance uuid REFERENCES public.daas_wf_instance(id),
workflow_state text
```

### Critical Notes

- **`workflow_instance` must be a real relation** — declared with `meta.options.related_collection: "daas_wf_instance"` and created through the `fields` tool. Otherwise the pointer is never filled. (Instances themselves are created from the workflow *assignment*; this field only links the item to its instance.)
- **`workflow_state` is `readonly`** — the state changes through transitions only. Also keep it (and `workflow_instance`) out of the `fields` list of non-admin `update` permissions.
- After adding these fields, invoke the `create-workflow` skill to:
  1. Create a workflow definition in `daas_wf_definition`
  2. Create a workflow assignment in `daas_wf_assignment`
  3. Grant the users who run transitions read on `daas_wf_instance` and `daas_wf_definition`, and gate the commands
  4. Add the `WorkflowButton` component to the UI

---

## Group C: Multi-Tenancy / Scope Field (Include When Collection Is Scoped)

Add this field when the collection needs to be partitioned by tenant, organization, department, or region. After adding this field, proceed to the `manage-scope` skill to register the collection in scope config.

### MCP Payload (use with `mcp_daas_fields`)

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "YOUR_COLLECTION",
        "field": "resource_uri",
        "type": "text",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true
        },
        "schema": {
          "foreign_key_table": "daas_scope_items",
          "foreign_key_column": "uri_path"
        }
      }
    ]
  }
}
```

### SQL Migration Equivalent

```sql
resource_uri text DEFAULT NULL
    REFERENCES public.daas_scope_items(uri_path) ON DELETE RESTRICT
```

### After Adding

Invoke the `manage-scope` skill to register the collection with `field_name: "resource_uri"` and set `inheritance_mode` (exact vs down).

---

## Full Standard Collection Example

This example creates an `articles` collection with audit and workflow fields plus business fields. It takes two calls: the table with its plain columns, then the relation fields.

### Step 1: Create the collection (plain columns only)

```json
{
  "name": "mcp_daas_collections",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "articles",
      "meta": {
        "icon": "article",
        "note": "Published articles"
      },
      "fields": [
        {
          "field": "id",
          "type": "uuid",
          "meta": { "hidden": true, "readonly": true },
          "schema": { "is_primary_key": true }
        },
        {
          "field": "title",
          "type": "string",
          "meta": { "interface": "input", "required": true }
        },
        {
          "field": "content",
          "type": "text",
          "meta": { "interface": "input-rich-text-html" }
        },
        {
          "field": "date_created",
          "type": "timestamp",
          "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" }
        },
        {
          "field": "date_updated",
          "type": "timestamp",
          "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
        }
      ]
    }
  }
}
```

### Step 2: Add the relation fields and the workflow state

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "field": "user_created",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": { "interface": "select-dropdown-m2o", "special": ["user-created", "m2o"], "readonly": true, "hidden": true, "width": "half", "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "user_updated",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": { "interface": "select-dropdown-m2o", "special": ["user-updated", "m2o"], "readonly": true, "hidden": true, "width": "half", "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "workflow_instance",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": { "interface": "select-dropdown-m2o", "special": ["m2o"], "readonly": true, "hidden": true, "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "workflow_state",
        "type": "string",
        "schema": { "is_nullable": true },
        "meta": { "interface": "xtr-interface-workflow", "readonly": true }
      }
    ]
  }
}
```

Confirm with the `relations` tool (`action: "read"`, `collection: "articles"`): one row per relation field. An empty list means the relations were not created.

### Step 3: Configure Workflow (if Group B included)

Proceed to `create-workflow` skill to define workflow definition and assignment.

### Step 4: Configure Scope (if Group C included)

Proceed to `manage-scope` skill to add the scope field and register the collection in scope config.

---

## Decision Tree — Which Field Groups to Include

```
For EVERY new collection:
├── 1. ALWAYS add Group A (Audit Fields)
│     → user_created, date_created, user_updated, date_updated
│
├── 2. Does this collection need a state machine / approval workflow?
│     ├── YES → Add Group B (Workflow Fields) + invoke create-workflow skill
│     └── NO  → Skip Group B
│
└── 3. Does this collection need multi-tenancy / scope isolation?
      ├── YES → Add Group C (Scope Field) + invoke manage-scope skill
      └── NO  → Skip Group C
```

### Signals That Workflow is Needed

- User mentions: "approval", "review", "draft/published", "state machine", "lifecycle", "submit for approval"
- The data has distinct lifecycle stages (e.g., Draft → Review → Published)
- Different users need to act at different stages

### Signals That Scope is Needed

- User mentions: "multi-tenant", "organization", "department", "tenant isolation"
- Data must be partitioned by org, team, region, or customer
- Different tenants should not see each other's data
