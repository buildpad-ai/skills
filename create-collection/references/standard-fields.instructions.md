---
name: Standard Collection Fields
description: Canonical field definitions for DaaS collections. Every collection MUST include audit fields. Workflow and scope fields are added when the collection requires those features. Contains copy-pasteable MCP JSON payloads.
applyTo: "**/*.{ts,tsx,json,sql}"
---

# Standard Collection Fields

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

<!-- buildpad-backend: supabase -->
This reference defines the **mandatory and optional field groups** that every DaaS collection must follow. The DaaS platform does NOT auto-add these fields — you must create them explicitly via MCP or SQL migration.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
This reference defines the **mandatory and optional field groups** that every collection must follow. The Engine does NOT auto-add these fields — you must create them explicitly through the Engine's API or its MCP tools.
<!-- /buildpad-backend -->

> **Rule: Every collection MUST include Group A (Audit Fields).** Group B and C are added based on feature requirements.

<!-- buildpad-backend: supabase -->
> **Rule: add every `uuid` relation field (`user_created`, `user_updated`, `workflow_instance`) with the `fields` tool, after the collection exists.**
>
> - A many-to-one is turned into a foreign key and a relation from **`meta.options.related_collection`** (with the `m2o` special). `schema.foreign_key_table` is not read on create — the Next.js backend ignores it and the Go engine refuses it — so the field would be a bare column.
> - Listed inline in the `collections` create call, every `uuid` column gets `DEFAULT gen_random_uuid()` (observed on DaaS 0.1.98). A relation column then holds a random UUID that references nothing, or — once it has a foreign key — makes every insert fail.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
> **Rule: add every `uuid` relation field (`user_created`, `user_updated`, `workflow_instance`) with the `fields` tool, after the collection exists.**
>
> - A many-to-one is turned into a foreign key and a relation from **`meta.options.related_collection`** (with the `m2o` special), and `meta.options.related_field` names the column it points at when that is not the primary key. The Engine refuses `schema.foreign_key_table`.
> - The `fields` tool reads the field's name from `data.field`, and it does not keep the `schema` block. A field that needs a default, not-null or a length (such as `date_created`) goes in the collection create (`POST /api/collections`, fields inline) or through `POST /api/fields/:collection`, each with an administrator's session.
<!-- /buildpad-backend -->

---

## Group A: Audit Fields (ALWAYS Include)

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
These four fields enable automatic user/timestamp tracking. The Engine fills `user-created`, `user-updated` and `date-updated` on every item write. It fills `date-created` from the column default only, so `date_created` must carry `"default_value": "NOW()"`.

### `date_created` and `date_updated` — REST, with an administrator's session

Inline in the collection create (see the full example below), or one at a time with `POST /api/fields/YOUR_COLLECTION`:

```json
{
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
    "default_value": "NOW()"
  }
}
```

```json
{
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
```

### `user_created` and `user_updated` — MCP Payload (use with `mcp_daas_fields`)

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
        "field": "user_updated",
        "type": "uuid",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["user-updated", "m2o"],
          "readonly": true,
          "hidden": true,
          "width": "half",
          "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" }
        }
      }
    ]
  }
}
```

There is no SQL equivalent on an Engine project: the fields above are the columns.

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

There is no SQL equivalent on an Engine project.
<!-- /buildpad-backend -->

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

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "YOUR_COLLECTION",
        "field": "resource_uri",
        "type": "string",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true,
          "options": { "related_collection": "daas_scope_items", "related_field": "uri_path", "on_delete": "RESTRICT" }
        }
      }
    ]
  }
}
```

On an Engine project the relation comes from `meta.options.related_collection` (`daas_scope_items`) and `related_field` (`uri_path`); there is no SQL equivalent. On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

In the mode `customer-tenants` every scope URI begins with the current customer's node: the `uri_path` of the `current` entry of `GET /api/auth/tenants`, never the Blueprint's and never one built from `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A `resource_uri` value, an `X-Resource-Uri` header and a `ScopeProvider`'s root all begin with it.
<!-- /buildpad-backend -->

### After Adding

Invoke the `manage-scope` skill to register the collection with `field_name: "resource_uri"` and set `inheritance_mode` (exact vs down).

---

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Full Standard Collection Example

This example creates an `articles` collection with audit and workflow fields plus business fields. It takes two calls: the table with its plain columns, then the relation fields.

### Step 1: Create the collection (plain columns only) — `POST /api/collections`, with an administrator's session

The MCP `collections` tool does not keep the `schema` block, and `date_created` needs its default, so this step goes through the Engine's API.

```json
{
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
      "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" },
      "schema": { "default_value": "NOW()" }
    },
    {
      "field": "date_updated",
      "type": "timestamp",
      "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
    }
  ]
}
```

It answers 201. A collection created with `fields` gets exactly those fields: name the primary key yourself.

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
        "meta": { "interface": "select-dropdown-m2o", "special": ["user-created", "m2o"], "readonly": true, "hidden": true, "width": "half", "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "user_updated",
        "type": "uuid",
        "meta": { "interface": "select-dropdown-m2o", "special": ["user-updated", "m2o"], "readonly": true, "hidden": true, "width": "half", "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "workflow_instance",
        "type": "uuid",
        "meta": { "interface": "select-dropdown-m2o", "special": ["m2o"], "readonly": true, "hidden": true, "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles",
        "field": "workflow_state",
        "type": "string",
        "meta": { "interface": "xtr-interface-workflow", "readonly": true }
      }
    ]
  }
}
```
<!-- /buildpad-backend -->

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
