---
name: DAAS MCP Tools for AI Agents
description: Complete DAAS MCP tool reference for AI agents integrating with DaaS
applyTo: "**/*.{ts,tsx,json}"
---

# DAAS MCP Tools for AI Agents

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

Complete reference for using DAAS MCP (Model Context Protocol) tools to interact with DaaS.

## ⚠️ Quick Reference - Common Patterns

### Getting Schema Information

```json
// List all collections (lightweight)
{ "name": "schema", "arguments": {} }

// Get detailed schema for specific collections
{ "name": "schema", "arguments": { "keys": ["articles", "users"] } }
```

> ⚠️ **Note:** The `schema` tool has NO `action` parameter. Just pass `keys` or nothing.

### Creating Fields (Single vs Batch)

```json
// ✅ Single field - use object directly
{ "name": "fields", "arguments": {
  "action": "create",
  "data": { "collection": "articles", "field": "title", "type": "string" }
}}

// ✅ Multiple fields - use array
{ "name": "fields", "arguments": {
  "action": "create",
  "data": [
    { "collection": "articles", "field": "title", "type": "string" },
    { "collection": "articles", "field": "content", "type": "text" }
  ]
}}
```

### Updating Fields

```json
// ✅ Correct - collection/field inside data object
{
  "name": "fields",
  "arguments": {
    "action": "update",
    "data": {
      "collection": "articles",
      "field": "title",
      "meta": { "required": true }
    }
  }
}
```

<!-- buildpad-backend: supabase -->
### Deleting Fields

```json
// ✅ Correct - use fields array (not singular field)
{
  "name": "fields",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "fields": ["deprecated_field1", "deprecated_field2"]
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Deleting Fields

```json
// ✅ On an Engine project - name the collection, and the fields in keys
{
  "name": "fields",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "keys": ["deprecated_field1", "deprecated_field2"]
  }
}
```
<!-- /buildpad-backend -->

### Data Parameter Format

| Tool          | Single Item   | Batch                  | Notes                                         |
| ------------- | ------------- | ---------------------- | --------------------------------------------- |
| `items`       | `data: {...}` | `data: [{...}, {...}]` | Both work                                     |
| `fields`      | `data: {...}` | `data: [{...}, {...}]` | Both work                                     |
| `collections` | `data: {...}` | `data: [{...}]`        | Array preferred                               |
| `relations`   | `data: {...}` | `data: [{...}]`        | Array preferred                               |
| `roles`       | `data: {...}` | `data: [{...}, {...}]` | Both work; `name` required for create         |
| `policies`    | `data: {...}` | `data: [{...}, {...}]` | Both work; `name` required for create         |
| `permissions` | `data: {...}` | `data: [{...}, {...}]` | Both work; see ⚠️ `data.action` warning below |

---

<!-- buildpad-backend: supabase -->
## Overview

DAAS MCP provides a standardized interface for AI agents to:

- **Query and manage data** - CRUD operations on any collection
- **Modify schemas** - Create tables, fields, and relations (admin only)
- **Manage files** - Upload, organize, and retrieve files
- **Configure permissions** - Set up RBAC rules
- **Create business logic** - Runtime extensions (hooks)
- **Schedule background tasks** - Cron jobs with sandboxed code
- **Manage workflows** - State machines for content lifecycle

## DAAS MCP Endpoint

```
POST /api/mcp
Authorization: Bearer <static_token>
Content-Type: application/json
```

All requests use **JSON-RPC 2.0** format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": { ... }
  }
}
```

## Authentication

AI agents authenticate using **static tokens**:

1. Admin creates a user for the AI agent
2. Generates a static token for that user
3. Token is included in `Authorization: Bearer <token>` header
4. User's permissions apply to all DAAS MCP operations

---

## Available Tools

### Data Tools (All Users)

| Tool      | Description                         |
| --------- | ----------------------------------- |
| `items`   | CRUD operations on collection items |
| `schema`  | Read collection and field schema    |
| `files`   | Manage uploaded files               |
| `folders` | Manage file folders                 |
| `assets`  | Retrieve file content as base64     |
| `users`   | Read/update user profiles           |

### Admin-Only Tools

| Tool          | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `collections` | Create/update/delete database tables                                                 |
| `fields`      | Create/update/delete table columns                                                   |
| `relations`   | Manage foreign key relationships                                                     |
| `roles`       | Manage role definitions (CRUD)                                                       |
| `policies`    | Manage permission policies (CRUD)                                                    |
| `access`      | Link policies to roles/users (CRD)                                                   |
| `permissions` | Manage permission rules (CRUD)                                                       |
| `extensions`  | Manage runtime hooks                                                                 |
| `cron`        | Manage scheduled background jobs                                                     |
| `scope`       | Manage hierarchical scopes for multi-tenancy and org-level partitioning (admin only) |
| `logs`        | View and search application logs                                                     |

> **Note:** `roles`, `policies`, `access`, and `permissions` all support full CRUD operations via their dedicated MCP tools. Do NOT use the `items` tool to write to `daas_permissions`, `daas_roles`, or `daas_policies`.

### System Tools

| Tool            | Description                   |
| --------------- | ----------------------------- |
| `system-prompt` | Load DaaS-specific AI context |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Overview

On an Engine project the MCP server lets AI agents:

- **Query and manage data** - CRUD and aggregates on content collections
- **Modify schemas** - Create collections, fields, and relations (admin only)
- **Manage files** - Read and edit file metadata, import files from a URL, organize folders
- **Configure permissions** - Set up roles, policies, access grants and permission rules (admin only)
- **Assign scoped roles** - Bind a role to a user at a scope (admin only)
- **Run workflows** - Read workflow definitions and run a command on an instance
- **Manage stored code and settings** - Cron jobs, custom services, hooks, mail settings and module access keys (admin only)

For hooks, cron jobs and the application log, see [Hooks, cron jobs and logs on an Engine project](#hooks-cron-jobs-and-logs-on-an-engine-project).

## DAAS MCP Endpoint

On an Engine project the MCP server is the Engine's own, at `<Engine_URL>/api/mcp`:

```
POST /api/mcp
Authorization: Bearer <token>
Content-Type: application/json
```

All requests use **JSON-RPC 2.0** format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": { ... }
  }
}
```

`GET /api/mcp/sse` and `POST /api/mcp/messages` serve the same tools to a client that keeps a stream open. `GET /api/mcp` answers whether the server is enabled and whether deletes are allowed.

## Authentication

On an Engine project the MCP endpoint reads the token from the `Authorization: Bearer` header only; a token in the query string is refused with `TOKEN_INVALID`. It accepts a user's static token, which is bound to the project's tenant and works only while that user's account is active, or a signed-in user's access token. A session that still needs its second factor is refused until that factor is verified. An unknown or revoked token is answered `TOKEN_INVALID`, and an expired session `TOKEN_EXPIRED`.

Every tool runs as the token's user: that user's roles, policies and permissions apply to every call, and the administrator-only tools are listed and served only to an administrator.

The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

---

## Available Tools

### Data Tools (All Users)

The caller's permissions decide what each call may read or write.

| Tool      | Description                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `items`   | `read`, `create`, `update`, `delete` and `aggregate` on the items of a content collection                                      |
| `schema`  | Read collection and field schema (no `action`)                                                                               |
| `files`   | `read`, `update` and `delete` file metadata, and `import` a file from a URL                                                  |
| `folders` | `create`, `read`, `update` and `delete` file folders                                                                          |
| `users`   | `read` and `update` users; credential columns are never returned, and fields only an administrator may change stay administrator-only |

### Admin-Only Tools

| Tool          | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `collections` | `create`, `read`, `update` (metadata) and `delete` collections                         |
| `fields`      | `create`, `read`, `update` and `delete` a collection's fields; `create_index`, `drop_index` and `rename` |
| `relations`   | `create`, `read`, `update` and `delete` foreign-key relations                          |
| `roles`       | Manage role definitions (CRUD)                                                       |
| `policies`    | Manage permission policies (CRUD)                                                    |
| `access`      | Grant a policy to a role or a user, read the grants, revoke one (`create`, `read`, `delete`) |
| `permissions` | Manage the permission rules inside a policy (CRUD)                                   |
| `scope`       | Create, change and delete scope types, items and collection settings; read a user's roles (`read_user_roles`); assign and remove a role at a scope (`assign_user_role`, `remove_user_role`). Its reads of types, items and settings follow the caller's grants |
| `workflows`   | `create`, `read`, `update` and `delete` workflow definitions                         |
| `workflow_assignments` | `create`, `read`, `update` and `delete` the bindings of a definition to a collection |
| `utilities`   | `realign_sequences`: move each integer key's sequence past the largest key, after an import |
| `cron`        | `list`, `read`, `create`, `update`, `delete`, `activate`, `deactivate`, `clone`, `run_now`, `history`, `recent_history` and `stats` for cron jobs |
| `services`    | `list`, `read`, `create`, `update`, `delete`, `run_tests`, `run_test`, `activate` and `deactivate` for custom services |
| `extensions`  | `list`, `read`, `create`, `update`, `delete`, `activate`, `deactivate` and `clone` for hooks |
| `smtp-settings` | `get` and `update` the mail settings, and `test` them                              |
| `module_access_keys` | `create`, `read`, `update` and `delete` module access keys                    |
| `cors-settings` | `get` and `update` the cross-origin settings: change nothing through it, as the project's cross-origin settings stay as provisioned |

The last six take their fields at the top level of `arguments`, next to `action` and `id`. A change takes effect as the REST write of the same body does, and a `delete` is refused while the project's MCP deletes are off. They are served from Engine 0.1.0-dev.4: if `tools/list` does not list them, use the REST routes. `cron` `recent_history` and `stats`, `services` `run_test`, and the `scope` tool's actions other than `assign_user_role` and `create_config` are served from Engine 0.1.0-dev.19; `workflows`, `workflow_assignments` and the `fields` actions `create_index`, `drop_index` and `rename` from 0.1.0-dev.18. If an action is not in the tool's `action` list, use the REST route.

The `fields` tool's `update` takes `schema.is_unique` (`true` or `false`) to add or drop the field's unique constraint, and `schema.add_index` to create or drop its single-column index; a uniqueness the rows already break is refused with the database's reason. `create_index` takes `data` `{collection, columns, name, unique}` for an index over several columns, or a unique one; `drop_index` takes `collection` and `keys` (the index names). `rename` takes `data` `{collection, field, new_field}` and carries the field's metadata, relations and permission field lists with it, but not free text that names the field (filters, validation, templates, hooks, cron jobs): its answer lists what to check by hand.

On an Engine project collections, fields, relations, roles, policies and permissions are created through the Engine's API (`/api/collections`, `/api/fields/:collection`, `/api/relations`, `/api/roles`, `/api/policies`, `/api/access`, `/api/permissions`) or its MCP tools `collections`, `fields`, `relations`, `roles`, `policies`, `access` and `permissions`. Access is roles, policies and permissions: a permission belongs to a policy, and a policy is attached to a role or a user. The MCP `collections` and `fields` tools keep a field's name, type and `meta` but not its `schema` block (default, not-null, length): set those through `POST /api/fields/:collection` with an administrator's session.

> **Note:** The `items` tool refuses the Engine's own tables by name (`daas_users`, `daas_roles`, `daas_policies`, `daas_permissions`, `daas_access`, `daas_activity`, `daas_sessions`, `daas_settings`). Use the dedicated tool for each.

### System Tools

| Tool            | Description                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `system-prompt` | Load DaaS-specific AI context; not listed while the project's settings turn it off |

### One Tool per Verb

The Engine also serves an older set of tools that name the operation in the tool, not in an `action` argument: `daas_read_items`, `daas_create_item`, `daas_update_item`, `daas_delete_item` (listed only while deletes are allowed), `daas_list_collections`, `daas_get_schema`, `daas_create_collection` (administrators only), `daas_list_files`, `daas_list_workflows` and `daas_trigger_transition`. The same permissions apply.

### Logs and File Content

| Tool     | Description |
| -------- | ----------- |
| `logs`   | The Engine's recent log entries, as `GET /api/logs` answers them: `tail` (the newest; `lines`, 1 to 500, default 50), `read`, `search` (`query`, text the message contains), `stats` (counts by level and source) and `clear` |
| `assets` | A file's content, given its `id`: an image or audio file as an image or audio item, any other file as its metadata and its bytes in base64 |

`logs` is listed to an administrator and to a user whose role holds the system-logs module key; `clear` is for administrators only. `read` and `search` take `level`, `source`, `extensionName`, `correlation_id`, `since` and `until` (RFC 3339 times) and `limit`. `assets` serves a file to any caller who may read it, and answers a file the caller may not read as one that does not exist. A file over 10 MiB is refused; `width`, `height` and `quality` are accepted and change nothing.

Both are served from Engine 0.1.0-dev.19. If `tools/list` does not list them, the project's Engine is older: file content is served at `/api/files/assets/:id`, with a session or a signed token, and the log is described in [Hooks, cron jobs and logs on an Engine project](#hooks-cron-jobs-and-logs-on-an-engine-project).
<!-- /buildpad-backend -->

---

## Tool: `items`

CRUD operations on any collection.

### Read Items

```json
{
  "name": "items",
  "arguments": {
    "action": "read",
    "collection": "articles",
    "query": {
      "fields": ["id", "title", "content", "author.name"],
      "filter": { "status": { "_eq": "published" } },
      "sort": ["-date_created"],
      "limit": 10,
      "page": 1
    }
  }
}
```

<!-- buildpad-backend: supabase -->
### Read Single Item

```json
{
  "name": "items",
  "arguments": {
    "action": "read",
    "collection": "articles",
    "id": "article-uuid"
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Read Single Item

On an Engine project a read addresses items by `keys` (an array), and answers an array of rows:

```json
{
  "name": "items",
  "arguments": {
    "action": "read",
    "collection": "articles",
    "keys": ["article-uuid"]
  }
}
```
<!-- /buildpad-backend -->

### Create Item

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "articles",
    "data": {
      "title": "New Article",
      "content": "Article content...",
      "status": "draft"
    }
  }
}
```

### Create Multiple Items

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "articles",
    "data": [
      { "title": "Article 1", "status": "draft" },
      { "title": "Article 2", "status": "draft" }
    ]
  }
}
```

### Update Item

```json
{
  "name": "items",
  "arguments": {
    "action": "update",
    "collection": "articles",
    "id": "article-uuid",
    "data": {
      "title": "Updated Title",
      "status": "published"
    }
  }
}
```

<!-- buildpad-backend: supabase -->
### Delete Item

> ⚠️ Requires `DAAS_MCP_ALLOW_DELETES=true` to be enabled

```json
{
  "name": "items",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "id": "article-uuid"
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Delete Item

> ⚠️ On an Engine project deletes are refused until an administrator turns on the project setting `mcp_allow_deletes` (see [Configuration](#configuration)). A delete addresses items by `keys` (an array), which it requires.

```json
{
  "name": "items",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "keys": ["article-uuid"]
  }
}
```
<!-- /buildpad-backend -->

### Aggregate Items

Perform aggregate calculations (count, sum, avg, min, max, etc.) on a collection.

```json
{
  "name": "items",
  "arguments": {
    "action": "aggregate",
    "collection": "orders",
    "query": {
      "aggregate": { "count": ["id"], "sum": ["amount"] },
      "groupBy": ["status"],
      "filter": { "status": { "_eq": "completed" } }
    }
  }
}
```

**Supported operations:** `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`, `avgDistinct`, `min`, `max`

<!-- buildpad-backend: supabase -->
Response uses nested format:

```json
{
  "data": [
    { "status": "completed", "count": { "id": 42 }, "sum": { "amount": 12500 } }
  ]
}
```

> Aggregate queries respect collection-level read permissions and item-level RLS filters.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
On an Engine project the `items` tool answers its rows under `raw`, as every action-dispatched tool does, and an aggregate row is nested by function:

```json
{
  "raw": [
    { "status": "completed", "count": { "id": 42 }, "sum": { "amount": 12500 } }
  ]
}
```

A group-by column, and a count over `*`, stay flat in the row.

> On an Engine project an aggregate runs under the caller's read permission on the collection, its row filter included.
<!-- /buildpad-backend -->

---

## Tool: `schema`

Read database schema information.

> ⚠️ **Important:** This tool has NO `action` parameter. Do NOT use `action: "read"` or `action: "apply"` - they will fail.

### List All Collections (Lightweight)

Call without arguments to get a quick overview:

```json
{
  "name": "schema",
  "arguments": {}
}
```

**Response:**

```json
{
  "collections": ["articles", "users", "categories"],
  "collection_folders": ["system"],
  "notes": { "articles": "Blog articles collection" }
}
```

### Get Detailed Schema for Specific Collections

Provide `keys` array to get full field information:

```json
{
  "name": "schema",
  "arguments": {
    "keys": ["articles", "categories", "daas_users"]
  }
}
```

**Response includes:**

- Collection metadata
- Fields with types and constraints
- Relations (foreign keys)
- Interface configuration

### Common Usage Pattern

```json
// Step 1: Get collection list
{ "name": "schema", "arguments": {} }

// Step 2: Get details for collections you need
{ "name": "schema", "arguments": { "keys": ["articles"] } }
```

---

## Tool: `collections` (Admin Only)

Manage database tables.

### List Collections

```json
{
  "name": "collections",
  "arguments": {
    "action": "read"
  }
}
```

<!-- buildpad-backend: supabase -->
### Create Collection

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "products",
        "fields": [
          {
            "field": "id",
            "type": "uuid",
            "schema": { "is_primary_key": true }
          },
          {
            "field": "name",
            "type": "string",
            "schema": { "max_length": 255, "is_nullable": false }
          },
          {
            "field": "price",
            "type": "decimal",
            "schema": { "numeric_precision": 10, "numeric_scale": 2 }
          },
          {
            "field": "description",
            "type": "text"
          },
          {
            "field": "status",
            "type": "string",
            "schema": { "default_value": "draft" }
          },
          {
            "field": "date_created",
            "type": "timestamp",
            "meta": { "special": ["date-created"] }
          },
          {
            "field": "user_created",
            "type": "uuid",
            "meta": { "special": ["user-created"] }
          }
        ],
        "meta": {
          "icon": "shopping_cart",
          "note": "Product catalog"
        }
      }
    ]
  }
}
```

### Delete Collection

```json
{
  "name": "collections",
  "arguments": {
    "action": "delete",
    "collection": "products"
  }
}
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Create Collection

On an Engine project the `collections` tool creates the table with an `id` UUID primary key (generated by default) and the columns `created_at` and `updated_at`: do not list an `id` field. Each initial field keeps only its `field` and `type`; a `meta` or `schema` block given with an initial field is not applied. The collection's own `meta` is applied.

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "products",
        "fields": [
          { "field": "name", "type": "string" },
          { "field": "price", "type": "decimal" },
          { "field": "description", "type": "text" },
          { "field": "status", "type": "string" }
        ],
        "meta": {
          "icon": "shopping_cart",
          "note": "Product catalog"
        }
      }
    ]
  }
}
```

Add a field that needs `meta` (for example `"special": ["user-created"]`) afterwards with the `fields` tool, which keeps `meta`. Set a `schema` block (length, not-null, default) through `POST /api/fields/:collection` with an administrator's session.

### Delete Collection

```json
{
  "name": "collections",
  "arguments": {
    "action": "delete",
    "keys": ["products"]
  }
}
```

On an Engine project a delete names the collections in `keys` (an array), and is refused until `mcp_allow_deletes` is on.
<!-- /buildpad-backend -->
---

## Tool: `fields` (Admin Only)

Manage table columns.

### Data Format

The `data` parameter accepts **both** a single object OR an array of objects:

```json
// ✅ Single object (for one field)
"data": { "collection": "...", "field": "...", "type": "..." }

// ✅ Array (for multiple fields)
"data": [{ "collection": "...", "field": "...", "type": "..." }]
```

### List Fields for Collection

```json
{
  "name": "fields",
  "arguments": {
    "action": "read",
    "collection": "articles"
  }
}
```

### Create Single Field

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "articles",
      "field": "featured_image",
      "type": "uuid",
      "meta": {
        "interface": "file-image",
        "display": "image",
        "special": ["file"]
      },
      "schema": {
        "is_nullable": true
      }
    }
  }
}
```

**More field examples:**

```json
// String field with validation
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "articles",
      "field": "title",
      "type": "string",
      "meta": {
        "interface": "input",
        "required": true,
        "width": "full"
      },
      "schema": {
        "is_nullable": false,
        "max_length": 255
      }
    }
  }
}

// Select dropdown
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "articles",
      "field": "status",
      "type": "string",
      "meta": {
        "interface": "select-dropdown",
        "options": {
          "choices": [
            { "text": "Draft", "value": "draft" },
            { "text": "Published", "value": "published" }
          ]
        }
      },
      "schema": {
        "default_value": "draft"
      }
    }
  }
}

// Auto-timestamp (date-created)
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "articles",
      "field": "date_created",
      "type": "timestamp",
      "meta": {
        "hidden": true,
        "readonly": true,
        "special": ["date-created"]
      },
      "schema": {
        "is_nullable": false
      }
    }
  }
}
```

### Create Multiple Fields (Batch)

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      { "collection": "todos", "field": "title", "type": "string" },
      { "collection": "todos", "field": "description", "type": "text" },
      {
        "collection": "todos",
        "field": "status",
        "type": "string",
        "meta": { "interface": "select-dropdown" }
      }
    ]
  }
}
```

### Update Field

> ⚠️ **Note:** `collection` and `field` go INSIDE the `data` object, not as separate parameters.

```json
{
  "name": "fields",
  "arguments": {
    "action": "update",
    "data": {
      "collection": "articles",
      "field": "title",
      "meta": {
        "required": true,
        "note": "Article headline"
      }
    }
  }
}
```

<!-- buildpad-backend: supabase -->
### Delete Fields

> ⚠️ **Note:** Use `fields` (array) not `field` (string). Can delete multiple at once.

```json
{
  "name": "fields",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "fields": ["deprecated_field", "old_column"]
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Delete Fields

> ⚠️ **Note:** On an Engine project name the collection, and the fields in `keys` (an array). Can delete multiple at once.

```json
{
  "name": "fields",
  "arguments": {
    "action": "delete",
    "collection": "articles",
    "keys": ["deprecated_field", "old_column"]
  }
}
```
<!-- /buildpad-backend -->

### Create Many-to-One Field

<!-- buildpad-backend: supabase -->
Use the `fields` tool to create an M2O field — this **automatically creates the FK constraint, reloads the PostgREST schema cache, and inserts the `daas_relations` metadata row** in one step.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
Use the `fields` tool to create an M2O field. On an Engine project this creates the column, its foreign-key constraint and the `daas_relations` metadata row in one transaction. `meta.options.related_field` names a referenced column other than the primary key, and `meta.options.on_delete` sets the referential action.
<!-- /buildpad-backend -->

```json
// FK to related collection's primary key (most common)
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles",
    "data": {
      "field": "author",
      "type": "uuid",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "options": {
          "related_collection": "daas_users",
          "on_delete": "SET NULL"
        }
      }
    }
  }
}
```

```json
// FK to a non-PK column (e.g. text field uri_path) — add related_field
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "orders",
    "data": {
      "field": "resource_uri",
      "type": "string",
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
  }
}
```

<!-- buildpad-backend: supabase -->
> **When to use the `relations` tool instead:** Use the `relations` tool only to register relation metadata for FKs that were created outside DaaS (e.g. via a raw SQL migration). For all new M2O fields, prefer the `fields` approach above.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
> **When to use the `relations` tool instead:** On an Engine project the `relations` tool adds the foreign-key constraint and the `daas_relations` row to a column that already exists, for example a field first created without relational `meta`. For all new M2O fields, prefer the `fields` approach above.
<!-- /buildpad-backend -->

---

## Tool: `relations` (Admin Only)

Manage foreign key relationships.

### List Relations

```json
{
  "name": "relations",
  "arguments": {
    "action": "read"
  }
}
```

### Create Many-to-One Relation

```json
{
  "name": "relations",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "field": "author",
        "related_collection": "daas_users",
        "schema": {
          "on_delete": "SET NULL"
        },
        "meta": {
          "one_field": "articles"
        }
      }
    ]
  }
}
```

### Create Many-to-Many Relation

```json
{
  "name": "relations",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles_tags",
        "field": "articles_id",
        "related_collection": "articles",
        "meta": {
          "one_field": "tags",
          "sort_field": null,
          "one_deselect_action": "nullify",
          "junction_field": "tags_id"
        }
      },
      {
        "collection": "articles_tags",
        "field": "tags_id",
        "related_collection": "tags",
        "meta": {
          "one_field": "articles",
          "junction_field": "articles_id"
        }
      }
    ]
  }
}
```

---

## Tool: `files`

Manage uploaded files.

### List Files

```json
{
  "name": "files",
  "arguments": {
    "action": "read",
    "query": {
      "filter": { "type": { "_starts_with": "image/" } },
      "limit": 20
    }
  }
}
```

### Import File from URL

```json
{
  "name": "files",
  "arguments": {
    "action": "import",
    "data": [
      {
        "url": "https://example.com/image.jpg",
        "file": {
          "title": "Example Image",
          "folder": "folder-uuid"
        }
      }
    ]
  }
}
```

### Update File Metadata

```json
{
  "name": "files",
  "arguments": {
    "action": "update",
    "id": "file-uuid",
    "data": {
      "title": "Updated Title",
      "description": "New description",
      "tags": ["product", "featured"]
    }
  }
}
```

---

## Tool: `folders`

Manage file organization.

### List Folders

```json
{
  "name": "folders",
  "arguments": {
    "action": "read"
  }
}
```

### Create Folder

```json
{
  "name": "folders",
  "arguments": {
    "action": "create",
    "data": {
      "name": "Product Images",
      "parent": null
    }
  }
}
```

---

<!-- buildpad-backend: supabase -->
## Tool: `assets`

Retrieve file content.

### Get File as Base64

```json
{
  "name": "assets",
  "arguments": {
    "id": "file-uuid"
  }
}
```

**Response:**

```json
{
  "content": [
    {
      "type": "resource",
      "resource": {
        "uri": "daas://files/file-uuid",
        "mimeType": "image/jpeg",
        "blob": "base64-encoded-content..."
      }
    }
  ]
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## File Content

On an Engine project the MCP server has no tool that returns a file's content. File content is served at `/api/files/assets/:id`, with a session or a signed token; a signed URL comes from `/api/files/signed-url`. Read and edit a file's metadata with the `files` tool.
<!-- /buildpad-backend -->

---

## Tool: `permissions` (Admin Only)

Full CRUD for permission rules.

> ⚠️ **Critical — Two `action` fields exist:**
>
> - **Top-level `action`** — the CRUD operation to perform: `"create"`, `"read"`, `"update"`, `"delete"`
> - **`data.action`** — the _permission action_ being granted: `"create"`, `"read"`, `"update"`, `"delete"`, `"share"`
>
> These are **separate fields**. Always pass both explicitly.

### Create a Single Permission

```json
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": {
      "policy": "policy-uuid",
      "collection": "articles",
      "action": "read",
      "fields": ["*"],
      "permissions": { "status": { "_eq": "published" } }
    }
  }
}
```

### Create Multiple Permissions (Batch)

```json
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": [
      {
        "policy": "policy-uuid",
        "collection": "articles",
        "action": "read",
        "fields": ["*"],
        "permissions": null
      },
      {
        "policy": "policy-uuid",
        "collection": "articles",
        "action": "update",
        "fields": ["title", "content"],
        "permissions": { "user_created": { "_eq": "$CURRENT_USER" } }
      }
    ]
  }
}
```

### Read All Permissions

```json
{
  "name": "permissions",
  "arguments": {
    "action": "read"
  }
}
```

### Read Permissions by Policy

```json
{
  "name": "permissions",
  "arguments": {
    "action": "read",
    "policy": "policy-uuid"
  }
}
```

### Read Permissions by Collection

```json
{
  "name": "permissions",
  "arguments": {
    "action": "read",
    "collection": "articles",
    "query": {
      "fields": ["id", "action", "fields", "permissions"]
    }
  }
}
```

### Update a Permission

```json
{
  "name": "permissions",
  "arguments": {
    "action": "update",
    "id": 42,
    "data": {
      "fields": ["id", "title", "content"],
      "permissions": { "status": { "_in": ["published", "review"] } }
    }
  }
}
```

### Delete Permissions

```json
{
  "name": "permissions",
  "arguments": {
    "action": "delete",
    "keys": [1, 5, 12]
  }
}
```

> **Required fields for create:** `data.policy` (UUID), `data.collection` (string), `data.action` (permission action enum).
> **Permission actions:** `create`, `read`, `update`, `delete`, `share`.
> **`data.fields`:** `["*"]` for all fields, or list specific field names. Omit for all fields.
> **`data.permissions`:** `null` for no item filter (full access), or a DaaS filter object.

---

## Tool: `roles` (Admin Only)

Full CRUD for role definitions.

### Create a Single Role

```json
{
  "name": "roles",
  "arguments": {
    "action": "create",
    "data": {
      "name": "Editor",
      "icon": "edit",
      "description": "Can edit content"
    }
  }
}
```

### Create Multiple Roles (Batch)

```json
{
  "name": "roles",
  "arguments": {
    "action": "create",
    "data": [
      {
        "name": "Editor",
        "icon": "edit"
      },
      {
        "name": "Viewer",
        "icon": "visibility"
      }
    ]
  }
}
```

### Read Roles

```json
{ "name": "roles", "arguments": { "action": "read" } }
```

### Update a Role

```json
{
  "name": "roles",
  "arguments": {
    "action": "update",
    "id": "role-uuid",
    "data": { "description": "Updated description" }
  }
}
```

### Delete Roles

```json
{ "name": "roles", "arguments": { "action": "delete", "keys": ["role-uuid"] } }
```

> **Required for create:** `data.name`. Optional: `icon`, `description`, `parent` (UUID for role hierarchy).
> **Note:** `admin_access` and `app_access` are no longer columns on `daas_roles`. Access is now controlled via policies attached to roles through the `daas_access` junction table. Use the `policies` and `access` tools to manage access flags.

---

## Tool: `policies` (Admin Only)

Full CRUD for permission policy containers.

### Create a Policy

```json
{
  "name": "policies",
  "arguments": {
    "action": "create",
    "data": {
      "name": "Content Editor Policy",
      "description": "Grants edit access to content collections",
      "admin_access": false,
      "app_access": true
    }
  }
}
```

### Create Multiple Policies (Batch)

```json
{
  "name": "policies",
  "arguments": {
    "action": "create",
    "data": [
      { "name": "Viewer Policy", "admin_access": false, "app_access": true },
      { "name": "Editor Policy", "admin_access": false, "app_access": true }
    ]
  }
}
```

### Read Policies

```json
{ "name": "policies", "arguments": { "action": "read" } }
```

### Update a Policy

```json
{
  "name": "policies",
  "arguments": {
    "action": "update",
    "id": "policy-uuid",
    "data": { "enforce_tfa": true }
  }
}
```

### Delete Policies

```json
{
  "name": "policies",
  "arguments": { "action": "delete", "keys": ["policy-uuid"] }
}
```

> **Required for create:** `data.name`. Optional: `icon`, `description`, `admin_access` (default false), `app_access` (default true), `enforce_tfa` (default false), `delegate_access` (default false).
> **Important flags:** `admin_access: true` bypasses ALL permission checks — use only for admin policies. `app_access: true` grants access to the DaaS dashboard UI. `delegate_access: true` allows service accounts with this policy to use the `X-On-Behalf-Of` header for delegation (admins implicitly have this right).

---

<!-- buildpad-backend: supabase -->
## Tool: `extensions` (Admin Only)

Manage runtime hooks. See [hooks-extensions.instructions.md](../../hooks-extensions/references/hooks-extensions.instructions.md) for details.

### 🔴 CRITICAL: When to Use Extensions

**Use DaaS Runtime Extensions instead of implementing logic in Next.js API routes for:**

| Use Case            | Extension Type | Event                                                    |
| ------------------- | -------------- | -------------------------------------------------------- |
| Audit logging       | `action`       | `items.create`, `items.update`, `items.delete`           |
| Field validation    | `filter`       | `{collection}.items.create`, `{collection}.items.update` |
| Data transformation | `filter`       | `items.create`, `items.update`                           |
| Notifications       | `action`       | `items.create`, `items.update`                           |
| External sync       | `action`       | `items.create`, `items.update`, `items.delete`           |

### Extension Types

- **`filter`** - Runs BEFORE the operation, can modify payload or throw errors to abort
- **`action`** - Runs AFTER the operation, for side effects (logging, notifications)

### Create Extension - Validation

```json
{
  "name": "extensions",
  "arguments": {
    "action": "create",
    "name": "Validate Article",
    "description": "Ensures articles have valid titles",
    "event": "articles.items.create",
    "type": "filter",
    "code": "if (!payload.title || payload.title.length < 5) { throw new Error('Title must be at least 5 characters'); } return payload;",
    "status": "inactive"
  }
}
```

### Create Extension - Audit Logging

**This replaces manual audit logging in API routes:**

```json
{
  "name": "extensions",
  "arguments": {
    "action": "create",
    "name": "Audit Logger - Create",
    "description": "Logs all item creations to audit_logs collection",
    "event": "items.create",
    "type": "action",
    "code": "await services.items.createItem('audit_logs', { action: 'create', collection: event.collection, item_id: event.key, user_id: accountability?.user || null, user_email: accountability?.email || null, metadata: { payload: event.payload, timestamp: new Date().toISOString() } });",
    "status": "active"
  }
}
```

```json
{
  "name": "extensions",
  "arguments": {
    "action": "create",
    "name": "Audit Logger - Update",
    "description": "Logs all item updates to audit_logs collection",
    "event": "items.update",
    "type": "action",
    "code": "await services.items.createItem('audit_logs', { action: 'update', collection: event.collection, item_id: event.key, user_id: accountability?.user || null, user_email: accountability?.email || null, metadata: { changes: event.payload, timestamp: new Date().toISOString() } });",
    "status": "active"
  }
}
```

```json
{
  "name": "extensions",
  "arguments": {
    "action": "create",
    "name": "Audit Logger - Delete",
    "description": "Logs all item deletions to audit_logs collection",
    "event": "items.delete",
    "type": "action",
    "code": "await services.items.createItem('audit_logs', { action: 'delete', collection: event.collection, item_id: event.key, user_id: accountability?.user || null, user_email: accountability?.email || null, metadata: { timestamp: new Date().toISOString() } });",
    "status": "active"
  }
}
```

### Test Extension

```json
{
  "name": "extensions",
  "arguments": {
    "action": "test",
    "code": "if (!payload.title) throw new Error('Title required'); return payload;",
    "type": "filter",
    "event": "articles.items.create",
    "testPayload": { "content": "No title here" }
  }
}
```

### Available Context in Extension Code

Extensions have access to these variables:

- `event` - Contains `collection`, `key`, `payload`
- `accountability` - The current user: `{ user: uuid, email: string, role: uuid, admin: boolean }` (role is the user's primary role, resolved from the `daas_user_roles` junction table by lowest `sort` value)
- `services` - DaaS services: `services.items.createItem()`, `services.items.updateItem()`, etc.
- `payload` - The data being created/updated (for filter hooks)

---

## Tool: `cron` (Admin Only)

Manage scheduled background jobs. See [cron-mcp.instructions.md](../../create-cron/references/cron-mcp.instructions.md) for complete reference.

---

## Tool: `scope` (Admin Only)

Manage the DaaS-native hierarchical scope system for multi-tenancy and organizational partitioning. See the `/manage-scope` skill for complete reference.

**Supported actions:** `create_type`, `read_types`, `update_type`, `delete_type`, `create_item`, `read_items`, `update_item`, `delete_item`, `read_configs`, `update_config`, `assign_user_role`, `remove_user_role`, `read_user_roles`.

```json
// Quick example — read all scope types
{ "name": "scope", "arguments": { "action": "read_types" } }

// Assign user to a scoped role
{ "name": "scope", "arguments": {
  "action": "assign_user_role",
  "user_id": "<uuid>",
  "role_id": "<uuid>",
  "resource_uri": "/<type-uuid>:<item-uuid>"
}}
```

> **Multi-tenancy:** Use the `scope` tool to implement multi-tenancy in DaaS applications. See the `/manage-scope` skill for the complete setup guide.

### 🔴 CRITICAL: When to Use Cron Jobs

**Use DaaS Cron Jobs instead of implementing scheduled logic in external schedulers or cron tabs for:**

| Use Case          | Schedule Example | Description                                       |
| ----------------- | ---------------- | ------------------------------------------------- |
| Data cleanup      | `0 0 * * *`      | Archive or delete stale records nightly           |
| Report generation | `0 9 * * 1-5`    | Generate daily reports on weekday mornings        |
| External sync     | `0 */6 * * *`    | Sync data to/from external systems every 6 hours  |
| Status escalation | `*/15 * * * *`   | Check and escalate overdue items every 15 minutes |
| Digest emails     | `0 8 * * 1`      | Send weekly digest every Monday at 08:00          |

### Create Job (Always Inactive First)

```json
{
  "name": "cron",
  "arguments": {
    "action": "create",
    "name": "Nightly Cleanup",
    "schedule": "0 0 * * *",
    "timezone": "UTC",
    "code": "const items = await services.items('sessions');\nconst cutoff = new Date(Date.now() - 24*3600_000).toISOString();\nconst {data: stale} = await items.readByQuery({filter: {updated_at: {_lt: cutoff}}, limit: 500});\nfor (const s of stale) { await items.deleteOne(s.id); }\nconsole.log(`Cleaned ${stale.length} sessions`);",
    "status": "inactive"
  }
}
```

### Test → Check → Activate Workflow

```json
// 1. Manual trigger
{ "name": "cron", "arguments": { "action": "run_now", "id": "<job-id>" } }

// 2. Check history
{ "name": "cron", "arguments": { "action": "history", "id": "<job-id>", "limit": 5 } }

// 3. Activate
{ "name": "cron", "arguments": { "action": "activate", "id": "<job-id>" } }
```

### Available Actions

`list`, `read`, `create`, `update`, `delete`, `activate`, `deactivate`, `clone`, `run_now`, `history`, `recent_history`, `stats`

---

## Tool: `logs` (Admin Only)

View and search application logs for debugging and monitoring.

### Log Sources

| Source      | Description                                              |
| ----------- | -------------------------------------------------------- |
| `extension` | Runtime extension logs (console.log from extension code) |
| `api`       | REST API request/response logs                           |
| `emitter`   | Event emitter logs (hook execution)                      |
| `database`  | Database query logs                                      |
| `auth`      | Authentication/authorization logs                        |
| `system`    | System-level logs                                        |

### Log Levels

`debug` | `info` | `warn` | `error`

### Tail (Recent Logs)

Get the most recent log entries:

```json
{
  "name": "logs",
  "arguments": {
    "action": "tail",
    "lines": 100,
    "source": "extension",
    "level": "error"
  }
}
```

**Parameters:**

- `lines` (optional): Number of entries (default: 50, max: 500)
- `source` (optional): Filter by source
- `level` (optional): Filter by level

### Read (Query Logs)

Advanced log querying with multiple filters:

```json
{
  "name": "logs",
  "arguments": {
    "action": "read",
    "level": ["warn", "error"],
    "source": "extension",
    "extensionName": "Validate",
    "since": "1h",
    "limit": 50
  }
}
```

**Parameters:**

- `level` (optional): Single level or array of levels
- `source` (optional): Single source or array of sources
- `extensionId` (optional): Filter by extension UUID
- `extensionName` (optional): Filter by extension name (partial match)
- `collection` (optional): Filter by collection name
- `since` (optional): Time range - ISO date or relative (`1h`, `30m`, `1d`)
- `until` (optional): End of time range (ISO date)
- `limit` (optional): Max entries (default: 100, max: 500)

### Search (Full-Text)

Search log messages:

```json
{
  "name": "logs",
  "arguments": {
    "action": "search",
    "query": "validation failed",
    "source": "extension",
    "limit": 50
  }
}
```

### Stats (Log Statistics)

Get log statistics summary:

```json
{
  "name": "logs",
  "arguments": {
    "action": "stats"
  }
}
```

**Response:**

```json
{
  "total": 150,
  "byLevel": { "debug": 50, "info": 80, "warn": 15, "error": 5 },
  "bySource": { "extension": 100, "api": 30, "emitter": 20 }
}
```

### Clear (Reset Buffer)

Clear all logs from memory:

```json
{
  "name": "logs",
  "arguments": {
    "action": "clear"
  }
}
```

### Log Entry Format

```json
{
  "id": "log-uuid",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "error",
  "source": "extension",
  "message": "Validation failed: title too short",
  "extensionId": "ext-uuid",
  "extensionName": "Validate Article",
  "collection": "articles",
  "requestId": "req-uuid",
  "userId": "user-uuid",
  "data": { "titleLength": 3 }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Hooks, cron jobs and logs on an Engine project

On an Engine project an administrator manages hooks with the MCP tool `extensions` and cron jobs with the MCP tool `cron`, or through the Studio and the REST routes below. The application log is read with the MCP tool `logs` (see [Logs and File Content](#logs-and-file-content)) or the route below.

- **Hooks** run code in the Engine when an item is written: a `filter` hook runs before the write and may change the payload or abort it (validation, data transformation); an `action` hook runs after it (audit logging, notifications, external sync). Create and manage hooks in the Studio, with the MCP tool `extensions`, or through `<Engine_URL>/api/extensions` with an administrator's session (`POST` to create, `PATCH` and `DELETE` on `/api/extensions/:id`, and `POST /api/extensions/:id/activate`, `/deactivate` and `/clone`). Event names are `items.create`, `items.update` and `items.delete`, or the same prefixed with a collection (`articles.items.create`). The [hooks-extensions](../../hooks-extensions/SKILL.md) skill has the code a hook may run.
- **Cron jobs** run stored code on a schedule. Create and manage them in the Studio's Cron module, with the MCP tool `cron`, or through `<Engine_URL>/api/cron` with an administrator's session (`/api/cron/:id`, `POST /api/cron/:id/run`, `POST /api/cron/:id/clone`, `GET /api/cron/:id/history`). On an Engine project an active cron job fires at its scheduled time. The [create-cron](../../create-cron/SKILL.md) skill has the steps.
- **Stored code** (hooks and cron jobs) runs in the Engine's runtime, which has no `fetch`, `process` or `require`; the two skills above say what it provides.
- **Logs** are read with `GET <Engine_URL>/api/logs`, with the session of an administrator or of a user granted the `system:logs` module access. The parameters `level`, `source`, `extensionName` and `limit` narrow the answer (one value each), and from Engine 0.1.0-dev.19 so do `search` (text the message contains), `since` and `until` (RFC 3339 times). `GET /api/logs/stream` streams new entries, and `DELETE /api/logs` clears them (administrators only).

---

## Tool: `scope` (Admin Only)

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.

On an Engine project the MCP `scope` tool serves the scope routes' actions. Each applies its route's checks, and a write refused there is refused here with the same reason.

| Action | Arguments | Route it follows |
| ------ | --------- | ---------------- |
| `read_types`, `read_items` | `id` for one, or `limit` and `offset` | `GET /api/scope/types`, `GET /api/scope/items` |
| `create_type`, `update_type` | `type_data` (`name`, `parent_id`, `sort`, `icon`, `note`); `id` to update | `POST /api/scope/types`, `PATCH /api/scope/types/:id` |
| `create_item` | `item_data` (`name`, `scope_type_id`, `parent_item_id`, `sort`) | `POST /api/scope/items` |
| `update_item` | `id` and `item_update` (`name`, `sort`: the parent never changes) | `PATCH /api/scope/items/:id` |
| `delete_type`, `delete_item` | `id` | `DELETE /api/scope/types/:id`, `DELETE /api/scope/items/:id` |
| `read_configs` | `collection` for one, or none for every registration | `GET /api/scope/collection-config` |
| `create_config` | `config_data` (`collection`, `field_name`, `missing_uri_mode`, `inheritance_mode`) | `POST /api/scope/collection-config` |
| `update_config` | `collection` and `config_update` (`field_name`, `missing_uri_mode`, `inheritance_mode`) | `PATCH /api/scope/collection-config/:collection` |
| `read_user_roles` | `user_id`; optionally `role_id` and `resource_uri` (`null` for bindings at no scope) | `GET /api/users/:id/roles` |
| `assign_user_role` | `assignment` (`user_id`, `role_id`, `resource_uri`) | `POST /api/users/:id/roles` |
| `remove_user_role` | `user_id`, `role_id`, and `resource_uri` (`null` for the binding at no scope) | `DELETE /api/users/:id/roles/:roleId` |

The reads of types, items and collection settings follow the caller's grants; every other action is for administrators only, and `delete_type` and `delete_item` are refused while the project's MCP deletes are off. A role whose scope rules do not allow the scope is refused (`ROLE_SCOPE_MISMATCH`, `ROLE_SCOPE_LOCKED`). In `create_config`, `field_name` (default `resource_uri`) must be a column of the collection, and `add_fk` is accepted and ignored: the Engine makes no foreign key for a tenant column. On an Engine older than 0.1.0-dev.19 the tool has only `assign_user_role` and `create_config`: use the routes above for the rest. See the `/manage-scope` skill for the complete setup.

```json
// Assign a user to a scoped role
{ "name": "scope", "arguments": {
  "action": "assign_user_role",
  "assignment": {
    "user_id": "<uuid>",
    "role_id": "<uuid>",
    "resource_uri": "/<type-uuid>:<item-uuid>"
  }
}}
```

Omit `resource_uri` for a role binding that is not limited to one scope.

```json
// Register a collection as tenanted
{ "name": "scope", "arguments": {
  "action": "create_config",
  "config_data": {
    "collection": "orders",
    "field_name": "resource_uri",
    "inheritance_mode": "exact",
    "missing_uri_mode": "reject"
  }
}}
```
<!-- /buildpad-backend -->

---

## Tool: `system-prompt`

Load DaaS-specific context for AI reasoning.

```json
{
  "name": "system-prompt",
  "arguments": {}
}
```

Returns schema information, available tools, and usage guidelines for the AI.

---

<!-- buildpad-backend: supabase -->
## Error Handling

DAAS MCP errors follow JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "You don't have permission to access this collection"
  }
}
```

### Common Error Codes

| Code     | Meaning                                     |
| -------- | ------------------------------------------- |
| `-32600` | Invalid request format                      |
| `-32601` | Method/tool not found                       |
| `-32602` | Invalid parameters                          |
| `-32603` | Internal error (includes permission errors) |

### Common Error Messages

| Message                      | Cause                         | Solution                          |
| ---------------------------- | ----------------------------- | --------------------------------- |
| "DAAS MCP is not enabled"    | DAAS MCP disabled in settings | Enable via Settings → AI          |
| "Not authenticated"          | Missing/invalid token         | Provide valid Bearer token        |
| "Admin access required"      | Tool requires admin           | Use admin user's token            |
| "Delete operations disabled" | Safety setting                | Set `DAAS_MCP_ALLOW_DELETES=true` |
| "Collection not found"       | Table doesn't exist           | Check collection name             |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Error Handling

On an Engine project a tool that refuses a call answers a JSON-RPC `result` marked `"isError": true`; its text is a JSON array holding the message, `[{"error": "<message>"}]`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "[{\"error\":\"Admin access required for this tool\"}]" }],
    "isError": true
  }
}
```

A JSON-RPC `error` is answered only for a request the server cannot handle:

| Code     | Meaning                                                  |
| -------- | -------------------------------------------------------- |
| `-32700` | Parse error                                              |
| `-32600` | Invalid request format                                   |
| `-32601` | Method not found                                         |
| `-32602` | Invalid parameters, including a `tools/call` with no tool name |

A request without a usable token, and any request while the MCP server is turned off, is refused before JSON-RPC: with an HTTP status and the Engine's error document, `{ "errors": [{ "message": "...", "extensions": { "code": "..." } }] }`.

### Common Error Messages

| Message | Cause | Solution |
| ------- | ----- | -------- |
| HTTP 401 `TOKEN_INVALID`: "No token provided." or "Invalid token." | Missing, unknown or revoked token | Send a valid token as `Authorization: Bearer` |
| HTTP 401 `TOKEN_INVALID`: "Send the token in the Authorization header as a Bearer token; the token query parameter is not accepted." | Token in the query string | Send it in the `Authorization` header |
| HTTP 401 `TOKEN_EXPIRED`: "Token expired." | Expired session | Sign in again |
| HTTP 403 `MCP_DISABLED`: "The MCP server is disabled in project settings." | `mcp_enabled` is off | An administrator turns `mcp_enabled` on |
| "Admin access required for this tool" | Tool requires an administrator | Use an administrator's token |
| "Delete operations are disabled in project settings (mcp_allow_deletes)." | Safety setting | An administrator turns `mcp_allow_deletes` on; otherwise do not delete |
| `forbidden: insufficient permissions to <action> "<collection>"` | The caller lacks that grant | Report the missing grant; do not retry |
| `Cannot access system collection "<name>" via items tool. Use dedicated tools instead.` | `items` called on an Engine table | Use the dedicated tool |
| `Tool "<name>" not found` | The tool is not served (or the system prompt is turned off) | Use a tool that `tools/list` lists |
| `Unknown action: <action>` or `argument '<name>' is required` | Wrong arguments | Check the tool's arguments |
<!-- /buildpad-backend -->

---

## Best Practices for AI Agents

<!-- buildpad-backend: supabase -->
### 1. Schema-First Approach

Always read schema before operating on collections:

```json
// First: Understand the schema
{ "name": "schema", "arguments": { "keys": ["articles"] } }

// Then: Create items with correct structure
{ "name": "items", "arguments": { "action": "create", ... } }
```

### 2. Test Extensions Before Activating

```json
// 1. Create as inactive
{ "name": "extensions", "arguments": { "action": "create", "status": "inactive", ... } }

// 2. Test with sample data
{ "name": "extensions", "arguments": { "action": "test", ... } }

// 3. Activate if test passes
{ "name": "extensions", "arguments": { "action": "update", "id": "...", "data": { "status": "active" } } }
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### 1. Schema-First Approach

Always read schema before operating on collections:

```json
// First: Understand the schema
{ "name": "schema", "arguments": { "keys": ["articles"] } }

// Then: Create items with correct structure
{ "name": "items", "arguments": { "action": "create", ... } }
```

### 2. Try Hooks on Scratch Data Before Relying on Them

On an Engine project no route or MCP action test-runs a hook. Create the hook with `"status": "inactive"` in the Studio, through `POST <Engine_URL>/api/extensions` or with the MCP tool `extensions` (administrators only), activate it (`POST /api/extensions/:id/activate`, or the tool's `activate`), write a scratch item with the `items` tool, and check the result and the log (`GET /api/logs`). Deactivate it (`POST /api/extensions/:id/deactivate`) if it misbehaves. See the [hooks-extensions](../../hooks-extensions/SKILL.md) skill.
<!-- /buildpad-backend -->

### 3. Use Proper Permissions

Set up minimal required permissions:

```json
// Good: Specific fields and filters
{
  "action": "read",
  "fields": ["id", "title", "status"],
  "permissions": { "status": { "_neq": "archived" } }
}

// Avoid: Overly broad access
{
  "action": "read",
  "fields": ["*"],
  "permissions": null
}
```

### 4. Handle Errors Gracefully

Always check for error responses and handle appropriately.

---

<!-- buildpad-backend: supabase -->
## Creating Workflows via MCP

Use the `items` tool on workflow tables. **Full schema and examples in [workflow-schema.instructions.md](../../create-workflow/references/workflow-schema.instructions.md).**

### Workflow Tables

| Collection           | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `daas_wf_definition` | Workflow definitions - **`workflow_json` column holds state machine** |
| `daas_wf_assignment` | Links workflows to collections via filter rules                       |
| `daas_wf_instance`   | Active workflow instances (auto-created by system)                    |

### Key Insight: workflow_json Column

The `workflow_json` JSONB column in `daas_wf_definition` must contain a valid state machine:

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit",
          "next_state": "Review",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Review",
      "commands": [
        {
          "name": "Approve",
          "next_state": "Published",
          "policies": [],
          "actions": []
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    { "name": "Published", "commands": [], "isEndState": true }
  ]
}
```

### Minimal MCP Example

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_definition",
    "data": {
      "name": "Simple Approval",
      "workflow_json": {
        "initial_state": "Draft",
        "states": [
          /* see schema */
        ]
      }
    }
  }
}
```

Then assign to collection:

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_assignment",
    "data": {
      "workflow": "definition-uuid",
      "collection": "articles",
      "filter_rule": {}
    }
  }
}
```

### Collection Requirements

**Before assigning workflow**, the target collection MUST have:

1. `workflow_instance` field (UUID FK to `daas_wf_instance`)
2. `workflow_state` field (interface: `xtr-interface-workflow`)

Without these fields, workflow state won't update on items.

**For complete schema, field setup, and patterns → See [workflow-schema.instructions.md](../../create-workflow/references/workflow-schema.instructions.md)**

## Configuration

### Environment Variables

| Variable                         | Default | Description                    |
| -------------------------------- | ------- | ------------------------------ |
| `DAAS_MCP_ENABLED`               | `true`  | Enable/disable DAAS MCP server |
| `DAAS_MCP_ALLOW_DELETES`         | `false` | Allow delete operations        |
| `DAAS_MCP_SYSTEM_PROMPT_ENABLED` | `true`  | Enable system-prompt tool      |

### Settings (Database)

DAAS MCP settings can be managed via `/api/settings` or the Settings UI:

- **daas_mcp_enabled**: Master toggle
- **daas_mcp_allow_deletes**: Delete safety
- **daas_mcp_system_prompt**: Custom AI context
- **daas_mcp_prompts_collection**: Reusable prompts table
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Creating Workflows on an Engine Project

On an Engine project a workflow definition is created through the Engine's workflow API, which checks the state machine before it stores it: `POST <Engine_URL>/api/workflows`, and `PATCH /api/workflows/:id` to change one, with an administrator's session. The MCP `items` tool also reaches `daas_wf_definition`, but it stores the row without that check: do not create or change definitions with it. **Full steps in the [create-workflow](../../create-workflow/SKILL.md) skill.**

### Workflow Tables

| Collection           | Purpose                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `daas_wf_definition` | Workflow definitions - **`workflow_json` column holds state machine**; written through `/api/workflows`  |
| `daas_wf_assignment` | Binds a definition to a collection, with an optional filter rule; written through `/api/workflow-assignments` |
| `daas_wf_instance`   | One per item of a bound collection, created by the Engine; read through `/api/workflow-instances`          |

### Key Insight: workflow_json Column

The `workflow_json` column in `daas_wf_definition` must contain a valid state machine:

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit",
          "next_state": "Review",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Review",
      "commands": [
        {
          "name": "Approve",
          "next_state": "Published",
          "policies": [],
          "actions": []
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    { "name": "Published", "commands": [], "isEndState": true }
  ]
}
```

A command may also list `module_access_keys`: a caller who satisfies the command's `policies` or its module-access keys may run it.

### Minimal Example

```
POST <Engine_URL>/api/workflows
Authorization: Bearer <administrator's access token>
Content-Type: application/json

{
  "name": "Simple Approval",
  "workflow_json": {
    "initial_state": "Draft",
    "states": [ /* see above */ ]
  }
}
```

Then bind it to a collection:

```
POST <Engine_URL>/api/workflow-assignments
Authorization: Bearer <administrator's access token>
Content-Type: application/json

{
  "workflow": "definition-uuid",
  "collection": "articles",
  "filter_rule": null
}
```

A `filter_rule` of `null` binds every item of the collection. The Engine then creates an instance for each item that enters the collection. An instance moves only by a command: the MCP `daas_trigger_transition` tool (`instance_id`, `command_name`) or `POST /api/workflow/transition`. The MCP `daas_list_workflows` tool reads the definitions the caller may read.

### Collection Requirements

On an Engine project the Engine finds an item's workflow fields by what they are, not by their names, and both are optional:

1. a link field: a many-to-one to `daas_wf_instance`, so the item editor can open the item's instance;
2. a state field with the interface `xtr-interface-workflow`, which shows the current state.

Without them the workflow still runs; the item shows no state.

**For complete schema, field setup, and patterns → See the [create-workflow](../../create-workflow/SKILL.md) skill**

## Configuration

On an Engine project the MCP server reads no environment variable. Its settings belong to the project: read them with `GET <Engine_URL>/api/settings/mcp`, and change them with `PATCH /api/settings/mcp` with an administrator's session.

- **mcp_enabled** (default `true`): master toggle. While it is off, the MCP endpoint answers `403` with `MCP_DISABLED`.
- **mcp_allow_deletes** (default `false`): delete safety. While it is off, `daas_delete_item` is not listed, and a `delete` action of `items`, `files`, `folders`, `collections`, `fields` or `relations` is refused with "Delete operations are disabled in project settings (mcp_allow_deletes)." Deletes through `roles`, `policies`, `access` and `permissions` are not covered.
- **mcp_system_prompt_enabled** (default `true`): while it is off, the `system-prompt` tool is not listed.
- **mcp_system_prompt**: custom AI context.
- **mcp_prompts_collection**: reusable prompts table.
<!-- /buildpad-backend -->

---

## Related Instructions

- See [daas-api.instructions.md](./daas-api.instructions.md) for REST API reference
- See [permissions-filtering.instructions.md](../../create-rbac/references/permissions-filtering.instructions.md) for permission details
<!-- buildpad-backend: supabase -->
- See [hooks-extensions.instructions.md](../../hooks-extensions/references/hooks-extensions.instructions.md) for extension patterns
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- See the [hooks-extensions](../../hooks-extensions/SKILL.md) skill for hook patterns, and the [create-cron](../../create-cron/SKILL.md) skill for cron jobs
<!-- /buildpad-backend -->
- See [workflow-schema.instructions.md](../../create-workflow/references/workflow-schema.instructions.md) for workflow definitions
