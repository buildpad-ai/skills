---
name: DAAS MCP Tools for AI Agents
description: Complete DAAS MCP tool reference for AI agents integrating with DaaS
applyTo: "**/*.{ts,tsx,json}"
---

# DAAS MCP Tools for AI Agents

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

Response uses nested format:

```json
{
  "data": [
    { "status": "completed", "count": { "id": 42 }, "sum": { "amount": 12500 } }
  ]
}
```

> Aggregate queries respect collection-level read permissions and item-level RLS filters.

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

### Create Many-to-One Field

Use the `fields` tool to create an M2O field — this **automatically creates the FK constraint, reloads the PostgREST schema cache, and inserts the `daas_relations` metadata row** in one step.

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

> **When to use the `relations` tool instead:** Use the `relations` tool only to register relation metadata for FKs that were created outside DaaS (e.g. via a raw SQL migration). For all new M2O fields, prefer the `fields` approach above.

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

---

## Best Practices for AI Agents

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

---

## Related Instructions

- See [daas-api.instructions.md](./daas-api.instructions.md) for REST API reference
- See [permissions-filtering.instructions.md](../../create-rbac/references/permissions-filtering.instructions.md) for permission details
- See [hooks-extensions.instructions.md](../../hooks-extensions/references/hooks-extensions.instructions.md) for extension patterns
- See [workflow-schema.instructions.md](../../create-workflow/references/workflow-schema.instructions.md) for workflow definitions
