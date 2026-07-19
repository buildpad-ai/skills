---
name: DaaS API Reference
description: Complete API reference for integrating with the DaaS backend
applyTo: "**/*.{ts,tsx}"
---

# DaaS API Reference

Complete API documentation for integrating generated applications with the DaaS (Data-as-a-Service) backend.

## Base URL

```
Development: http://localhost:3000
Production: https://your-daas-domain.com
```

The DaaS URL is configured via `NEXT_PUBLIC_BUILDPAD_DAAS_URL` in `.env.local`.

---

## Authentication

DaaS supports **three authentication methods**. All API requests require authentication.

### 1. Cookie-Based (Browser Sessions)

For browser-based applications. Cookies are sent automatically after login.

```typescript
// Login via Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// Subsequent requests automatically include session cookie
const response = await fetch(`${DAAS_URL}/api/items/articles`);
```

### 2. JWT Bearer Token (API Clients)

For API clients, mobile apps, or server-to-server communication.

```bash
# Step 1: Get JWT token from Supabase Auth
curl -X POST "https://your-project.supabase.co/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email": "user@example.com", "password": "password"}'

# Step 2: Use JWT in Authorization header
curl http://localhost:3000/api/items/articles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 3. Static Token (Programmatic Access)

Long-lived tokens for CI/CD, automation scripts, and server integrations. Stored in `daas_users.token` field.

```bash
# Generate token via API (as admin)
curl http://localhost:3000/api/utils/random/string?length=32 \
  -H "Authorization: Bearer <admin_jwt>"

# Assign token to user
curl -X PATCH http://localhost:3000/api/users/<user_id> \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"token": "<generated_token>"}'

# Use static token
curl http://localhost:3000/api/items/articles \
  -H "Authorization: Bearer <static_token>"
```

> ⚠️ **Security Note:** Static tokens bypass database RLS policies. Security is enforced at the application layer via permission checks.

### Service Account Delegation (`X-On-Behalf-Of`)

Service accounts with `delegate_access: true` (or `admin_access: true`) on their policy can attribute mutations to a responsible user by passing the `X-On-Behalf-Of` header with a valid user UUID.

```bash
curl -X POST http://localhost:3000/api/items/articles \
  -H "Authorization: Bearer <service_account_token>" \
  -H "X-On-Behalf-Of: <responsible-user-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Article"}'
```

| Behaviour | Without delegation | With delegation |
|-----------|-------------------|-----------------|
| `daas_activity.user_id` | Authenticated user | Target user (from header) |
| `daas_activity.performed_by` | NULL | Service account UUID |
| Permission checks | Authenticated user | Authenticated user (not the target) |

The `GET /api/activity` response includes a `performer` join (via `daas_activity_performed_by_fkey`) for delegation traceability. When `performed_by IS NOT NULL`, the action was delegated.

---

## Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "errors": [
    {
      "message": "Human-readable error message",
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ]
}
```

### Common Error Codes

| HTTP Status | Code                    | Description                             |
| ----------- | ----------------------- | --------------------------------------- |
| 400         | `INVALID_PAYLOAD`       | Invalid request body or parameters      |
| 401         | `UNAUTHORIZED`          | Missing or invalid authentication       |
| 403         | `FORBIDDEN`             | Valid auth but insufficient permissions |
| 404         | `NOT_FOUND`             | Resource not found                      |
| 404         | `COLLECTION_NOT_FOUND`  | Table/collection doesn't exist          |
| 409         | `CONFLICT`              | Duplicate key or constraint violation   |
| 500         | `INTERNAL_SERVER_ERROR` | Server error                            |

---

## Query Parameters

All list endpoints support these query parameters:

| Parameter   | Type         | Description                       | Example                                               |
| ----------- | ------------ | --------------------------------- | ----------------------------------------------------- |
| `fields`    | string       | Comma-separated fields or `*`     | `fields=id,title,status`                              |
| `filter`    | JSON         | Filter object                     | `filter={"status":{"_eq":"published"}}`               |
| `sort`      | string       | Sort field(s), `-` for descending | `sort=-date_created,title`                            |
| `limit`     | number       | Items per page (default: 25)      | `limit=50`                                            |
| `page`      | number       | Page number (1-indexed)           | `page=2`                                              |
| `offset`    | number       | Items to skip                     | `offset=100`                                          |
| `search`    | string       | Full-text search                  | `search=hello`                                        |
| `deep`      | JSON         | Nested relation queries           | `deep={"author":{"_filter":{"active":true}}}`         |
| `version`   | string       | Get item with version applied     | `version=draft`                                       |
| `aggregate` | JSON/bracket | Aggregate functions               | `aggregate[count]=id` or `aggregate={"count":["id"]}` |
| `groupBy`   | string       | Group aggregate results           | `groupBy=status,category`                             |

### M2M Field Expansion (Junction-First Dot-Notation)

Many-to-many (M2M) relations are stored in a junction table. The API returns **junction table records**, not flattened related items. Use dot-notation through the junction FK column to expand the related collection:

| `fields` value           | What is returned                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `roles`                  | Junction PKs only: `[{ "id": "junction-uuid" }]`                                                 |
| `roles.*`                | All junction columns (FKs as scalars): `[{ "id": "…", "role_id": "role-uuid", "resource_uri": "/…" }]` |
| `roles.role_id.*`        | Junction + expanded FK object: `[{ "id": "…", "role_id": { "id": "…", "name": "Admin" }, "resource_uri": "…" }]` |
| `roles.role_id.name`     | Junction + specific FK field: `[{ "id": "…", "role_id": { "name": "Admin" }, "resource_uri": "…" }]` |
| `roles.resource_uri.*`   | Junction + expanded M2O column: `[{ "id": "…", "role_id": "…", "resource_uri": { "id": "…", "uri_path": "/…" } }]` |

> **Key difference from M2O:** For an M2O field like `author`, `fields=author.name` returns `{ "author": { "name": "…" } }` directly. For an M2M field like `roles`, `fields=roles.role_id.name` goes through the junction table first — the extra `.role_id` segment names the junction FK column that points to the related collection.

> **Frontend access pattern:** To get a user's role names, request `fields=*,roles.role_id.name` and read `user.roles.map(r => r.role_id.name)`. Do **not** use `user.roles[0].id` for the role UUID — that is the junction record PK. Use `user.roles[0].role_id` (string) or `user.roles[0].role_id.id` (when expanded).

### Filter Operators

```json
// Equality
{ "status": { "_eq": "published" } }
{ "status": { "_neq": "archived" } }

// Comparison
{ "price": { "_gt": 100 } }
{ "price": { "_gte": 100 } }
{ "price": { "_lt": 500 } }
{ "price": { "_lte": 500 } }

// Array
{ "status": { "_in": ["draft", "review"] } }
{ "status": { "_nin": ["archived"] } }

// String
{ "title": { "_contains": "hello" } }
{ "title": { "_icontains": "hello" } }  // case-insensitive
{ "title": { "_starts_with": "Hello" } }
{ "title": { "_istarts_with": "hello" } }
{ "title": { "_ends_with": "world" } }
{ "title": { "_iends_with": "world" } }

// Null
{ "published_at": { "_null": true } }
{ "published_at": { "_nnull": true } }

// Empty (for arrays/strings)
{ "tags": { "_empty": true } }
{ "tags": { "_nempty": true } }

// Logical
{ "_and": [{ "status": { "_eq": "published" } }, { "featured": { "_eq": true } }] }
{ "_or": [{ "status": { "_eq": "draft" } }, { "status": { "_eq": "review" } }] }

// Relational (filter by related item)
{ "author": { "role": { "_eq": "editor" } } }

// Dynamic values
{ "user_created": { "_eq": "$CURRENT_USER" } }
```

### Aggregate Functions

Perform aggregate calculations on collection data. Returns computed values without individual items.

**Supported operations:** `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`, `avgDistinct`, `min`, `max`

#### Bracket Notation

```bash
# Count all items
GET /api/items/orders?aggregate[count]=*

# Multiple aggregates
GET /api/items/orders?aggregate[count]=*&aggregate[sum]=amount

# With groupBy
GET /api/items/orders?aggregate[count]=id&groupBy=status

# With groupBy and filter
GET /api/items/orders?aggregate[sum]=amount&groupBy=status&filter={"status":{"_eq":"completed"}}
```

#### JSON Notation

```bash
GET /api/items/orders?aggregate={"count":["*"],"sum":["amount"]}&groupBy=status
```

#### Aggregate Response Format

Aggregate responses use a nested format (no pagination meta):

```json
{
  "data": [
    {
      "status": "completed",
      "count": { "id": 42 },
      "sum": { "amount": 12500 }
    },
    {
      "status": "pending",
      "count": { "id": 8 },
      "sum": { "amount": 3200 }
    }
  ]
}
```

> **Permission-aware:** Aggregate queries respect collection-level read permissions and item-level RLS filters. User-provided filters are merged with permission filters via `_and` logic.

---

## Response Format

### Single Item

```json
{
  "data": {
    "id": "uuid",
    "title": "Article Title",
    "status": "published"
  }
}
```

### List with Pagination

```json
{
  "data": [
    { "id": "uuid-1", "title": "Article 1" },
    { "id": "uuid-2", "title": "Article 2" }
  ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 42,
    "filter_count": 42
  }
}
```

---

## API Endpoints

### Items (CRUD for any collection)

| Method | Endpoint                     | Description     |
| ------ | ---------------------------- | --------------- |
| GET    | `/api/items/:collection`     | List items      |
| POST   | `/api/items/:collection`     | Create item(s)  |
| GET    | `/api/items/:collection/:id` | Get single item |
| PATCH  | `/api/items/:collection/:id` | Update item     |
| DELETE | `/api/items/:collection/:id` | Delete item     |
| PATCH  | `/api/items/:collection`     | Batch update    |
| DELETE | `/api/items/:collection`     | Batch delete    |

### Collections (Schema Management)

| Method | Endpoint                 | Description               |
| ------ | ------------------------ | ------------------------- |
| GET    | `/api/collections`       | List all collections      |
| POST   | `/api/collections`       | Create collection (admin) |
| GET    | `/api/collections/:name` | Get collection details    |
| PATCH  | `/api/collections/:name` | Update collection (admin) |
| DELETE | `/api/collections/:name` | Delete collection (admin) |

### Fields (Column Management)

| Method | Endpoint                         | Description                |
| ------ | -------------------------------- | -------------------------- |
| GET    | `/api/fields`                    | List all fields            |
| GET    | `/api/fields/:collection`        | List fields for collection |
| POST   | `/api/fields/:collection`        | Create field (admin)       |
| GET    | `/api/fields/:collection/:field` | Get field details          |
| PATCH  | `/api/fields/:collection/:field` | Update field (admin)       |
| DELETE | `/api/fields/:collection/:field` | Delete field (admin)       |

### Relations (Foreign Keys)

| Method | Endpoint                            | Description                   |
| ------ | ----------------------------------- | ----------------------------- |
| GET    | `/api/relations`                    | List all relations            |
| POST   | `/api/relations`                    | Create relation (admin)       |
| GET    | `/api/relations/:collection`        | List relations for collection |
| GET    | `/api/relations/:collection/:field` | Get relation details          |
| PATCH  | `/api/relations/:id`                | Update relation (admin)       |
| DELETE | `/api/relations/:id`                | Delete relation (admin)       |

### Files

| Method | Endpoint            | Description          |
| ------ | ------------------- | -------------------- |
| GET    | `/api/files`        | List files           |
| POST   | `/api/files`        | Upload file(s)       |
| GET    | `/api/files/:id`    | Get file metadata    |
| PATCH  | `/api/files/:id`    | Update file metadata |
| DELETE | `/api/files/:id`    | Delete file          |
| POST   | `/api/files/import` | Import from URL      |

### Assets (File Content)

| Method | Endpoint                     | Description               |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/api/assets/:id`            | Get file content/download |
| GET    | `/api/assets/:id?download`   | Force download            |
| GET    | `/api/assets/:id?key=preset` | Get transformed image     |

### Folders

| Method | Endpoint           | Description   |
| ------ | ------------------ | ------------- |
| GET    | `/api/folders`     | List folders  |
| POST   | `/api/folders`     | Create folder |
| GET    | `/api/folders/:id` | Get folder    |
| PATCH  | `/api/folders/:id` | Update folder |
| DELETE | `/api/folders/:id` | Delete folder |

### Users

| Method | Endpoint         | Description         |
| ------ | ---------------- | ------------------- |
| GET    | `/api/users`     | List users          |
| POST   | `/api/users`     | Create user (admin) |
| GET    | `/api/users/me`  | Get current user    |
| PATCH  | `/api/users/me`  | Update current user |
| GET    | `/api/users/:id` | Get user by ID      |
| PATCH  | `/api/users/:id` | Update user (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |

### Roles

| Method | Endpoint         | Description         |
| ------ | ---------------- | ------------------- |
| GET    | `/api/roles`     | List roles          |
| POST   | `/api/roles`     | Create role (admin) |
| GET    | `/api/roles/:id` | Get role            |
| PATCH  | `/api/roles/:id` | Update role (admin) |
| DELETE | `/api/roles/:id` | Delete role (admin) |

### Policies

| Method | Endpoint            | Description           |
| ------ | ------------------- | --------------------- |
| GET    | `/api/policies`     | List policies         |
| POST   | `/api/policies`     | Create policy (admin) |
| GET    | `/api/policies/:id` | Get policy            |
| PATCH  | `/api/policies/:id` | Update policy (admin) |
| DELETE | `/api/policies/:id` | Delete policy (admin) |

### Permissions

| Method | Endpoint               | Description               |
| ------ | ---------------------- | ------------------------- |
| GET    | `/api/permissions`     | List permissions          |
| POST   | `/api/permissions`     | Create permission (admin) |
| GET    | `/api/permissions/:id` | Get permission            |
| PATCH  | `/api/permissions/:id` | Update permission (admin) |
| DELETE | `/api/permissions/:id` | Delete permission (admin) |

### Access (Policy Assignments)

| Method | Endpoint          | Description                |
| ------ | ----------------- | -------------------------- |
| GET    | `/api/access`     | List access records        |
| POST   | `/api/access`     | Assign policy to user/role |
| DELETE | `/api/access/:id` | Remove policy assignment   |

### Versions (Content Versioning)

| Method | Endpoint                    | Description                   |
| ------ | --------------------------- | ----------------------------- |
| GET    | `/api/versions`             | List versions                 |
| POST   | `/api/versions`             | Create version                |
| GET    | `/api/versions/:id`         | Get version                   |
| PATCH  | `/api/versions/:id`         | Update version                |
| DELETE | `/api/versions/:id`         | Delete version                |
| POST   | `/api/versions/:id/save`    | Save changes to version delta |
| POST   | `/api/versions/:id/promote` | Promote version to main item  |

### Workflows

| Method | Endpoint             | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/api/workflows`     | List workflow definitions |
| POST   | `/api/workflows`     | Create workflow           |
| GET    | `/api/workflows/:id` | Get workflow              |
| PATCH  | `/api/workflows/:id` | Update workflow           |
| DELETE | `/api/workflows/:id` | Delete workflow           |

### Workflow Assignments

| Method | Endpoint                        | Description       |
| ------ | ------------------------------- | ----------------- |
| GET    | `/api/workflow-assignments`     | List assignments  |
| POST   | `/api/workflow-assignments`     | Create assignment |
| PATCH  | `/api/workflow-assignments/:id` | Update assignment |
| DELETE | `/api/workflow-assignments/:id` | Delete assignment |

### Workflow Instances

| Method | Endpoint                      | Description              |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/api/workflow-instances`     | List instances           |
| GET    | `/api/workflow-instances/:id` | Get instance             |
| POST   | `/api/workflow/transition`    | Execute state transition |

### Runtime Extensions

| Method | Endpoint               | Description             |
| ------ | ---------------------- | ----------------------- |
| GET    | `/api/extensions`      | List runtime extensions |
| POST   | `/api/extensions`      | Create extension        |
| GET    | `/api/extensions/:id`  | Get extension           |
| PATCH  | `/api/extensions/:id`  | Update extension        |
| DELETE | `/api/extensions/:id`  | Delete extension        |
| POST   | `/api/extensions/test` | Test extension code     |

### Utilities

| Method | Endpoint                        | Description            |
| ------ | ------------------------------- | ---------------------- |
| POST   | `/api/utils/hash/generate`      | Generate bcrypt hash   |
| POST   | `/api/utils/hash/verify`        | Verify hash            |
| GET    | `/api/utils/random/string`      | Generate random string |
| POST   | `/api/utils/sort/:collection`   | Manual item sorting    |
| POST   | `/api/utils/export/:collection` | Export to JSON/CSV     |
| POST   | `/api/utils/import/:collection` | Import from JSON/CSV   |
| POST   | `/api/utils/cache/clear`        | Clear cache (admin)    |

### Logs

| Method | Endpoint        | Description        |
| ------ | --------------- | ------------------ |
| GET    | `/api/logs`     | List activity logs |
| GET    | `/api/logs/:id` | Get log entry      |

### Settings

| Method | Endpoint        | Description             |
| ------ | --------------- | ----------------------- |
| GET    | `/api/settings` | Get system settings     |
| PATCH  | `/api/settings` | Update settings (admin) |

### MCP (Model Context Protocol)

| Method | Endpoint   | Description                        |
| ------ | ---------- | ---------------------------------- |
| POST   | `/api/mcp` | JSON-RPC 2.0 endpoint for AI tools |

---

## TypeScript SDK Pattern

When generating frontend code, use this pattern for API calls:

```typescript
// lib/api/client.ts
const DAAS_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;

export async function fetchItems<T>(
  collection: string,
  options?: {
    fields?: string;
    filter?: Record<string, any>;
    sort?: string;
    limit?: number;
    page?: number;
  },
): Promise<{ data: T[]; meta: { total: number } }> {
  const params = new URLSearchParams();

  if (options?.fields) params.set("fields", options.fields);
  if (options?.filter) params.set("filter", JSON.stringify(options.filter));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.page) params.set("page", String(options.page));

  const response = await fetch(
    `${DAAS_URL}/api/items/${collection}?${params}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "API Error");
  }

  return response.json();
}

export async function createItem<T>(
  collection: string,
  data: Partial<T>,
): Promise<{ data: T }> {
  const response = await fetch(`${DAAS_URL}/api/items/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "API Error");
  }

  return response.json();
}
```

---

## Related Instructions

- See [permissions-filtering.instructions.md](../../create-rbac/references/permissions-filtering.instructions.md) for item-level and field-level permissions
- See [daas-mcp-tools.instructions.md](./daas-mcp-tools.instructions.md) for AI agent MCP integration
- See [utilities-api.instructions.md](../../hooks-extensions/references/utilities-api.instructions.md) for utility endpoint details
- See [workflow-versioning.instructions.md](../../create-workflow/references/workflow-versioning.instructions.md) for workflow and versioning patterns
