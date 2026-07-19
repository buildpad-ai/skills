---
name: Hooks and Runtime Extensions
description: Event hooks and runtime extensions for custom business logic (MCP-managed)
applyTo: "**/*.{ts,tsx}"
---

# Hooks and Runtime Extensions

This guide covers the DaaS event hook system and runtime extensions that AI agents can manage via MCP.

## Overview

DaaS provides an event-driven architecture for custom business logic:

- **Event Hooks**: React to item operations (create, update, delete, read)
- **Runtime Extensions**: Database-stored hooks managed via API/MCP (hot-reloadable)

> **Note for AI Agents**: You can create and manage runtime extensions via MCP tools. File-based extensions require deployment access and are not manageable via MCP.

---

## Event System

### Event Types

| Type       | Timing                           | Purpose               | Can Modify Data |
| ---------- | -------------------------------- | --------------------- | --------------- |
| **Filter** | Before operation (or after read) | Validate, transform   | ✅ Yes          |
| **Action** | After operation                  | Side effects, logging | ❌ No           |

### Event Names

Events follow the pattern: `[collection].items.[operation]` or `items.[operation]`

| Event                   | Trigger                | Scope               |
| ----------------------- | ---------------------- | ------------------- |
| `items.create`          | Any item created       | All collections     |
| `items.update`          | Any item updated       | All collections     |
| `items.delete`          | Any item deleted       | All collections     |
| `items.read`            | Any item(s) read       | All collections     |
| `items.query`           | Before query execution | All collections     |
| `articles.items.create` | Article created        | Specific collection |
| `articles.items.update` | Article updated        | Specific collection |
| `articles.items.delete` | Article deleted        | Specific collection |
| `articles.items.read`   | Article(s) read        | Specific collection |
| `versions.create`       | Version created        | Versioning system   |

#### System Collection Events

Platform system collections emit lifecycle events, enabling hooks on administrative operations:

| Event | Trigger | Collection |
| --- | --- | --- |
| `daas_cron_jobs.items.create` | Cron job created | `daas_cron_jobs` |
| `daas_cron_jobs.items.update` | Cron job updated | `daas_cron_jobs` |
| `daas_cron_jobs.items.delete` | Cron job deleted | `daas_cron_jobs` |
| `daas_custom_services.items.create` | Custom service created | `daas_custom_services` |
| `daas_custom_services.items.update` | Custom service updated | `daas_custom_services` |
| `daas_custom_services.items.delete` | Custom service deleted | `daas_custom_services` |
| `daas_extensions.items.create` | Runtime extension created | `daas_extensions` |
| `daas_extensions.items.update` | Runtime extension updated | `daas_extensions` |
| `daas_extensions.items.delete` | Runtime extension deleted | `daas_extensions` |
| `daas_scope_types.items.create` | Scope type created | `daas_scope_types` |
| `daas_scope_types.items.update` | Scope type updated | `daas_scope_types` |
| `daas_scope_types.items.delete` | Scope type deleted | `daas_scope_types` |
| `daas_scope_items.items.create` | Scope item created | `daas_scope_items` |
| `daas_scope_items.items.update` | Scope item updated | `daas_scope_items` |
| `daas_scope_items.items.delete` | Scope item deleted | `daas_scope_items` |
| `daas_scope_collection_config.items.create` | Scope collection config created | `daas_scope_collection_config` |
| `daas_scope_collection_config.items.update` | Scope collection config updated | `daas_scope_collection_config` |
| `daas_scope_collection_config.items.delete` | Scope collection config deleted | `daas_scope_collection_config` |
| `daas_access.items.create` | Access record created (policy assignment) | `daas_access` |
| `daas_access.items.update` | Access record updated | `daas_access` |
| `daas_access.items.delete` | Access record deleted (policy detached) | `daas_access` |
| `daas_user_roles.items.create` | User-role assignment created | `daas_user_roles` |
| `daas_user_roles.items.delete` | User-role assignment removed | `daas_user_roles` |
| `daas_settings.items.update` | Platform settings updated | `daas_settings` |
| `daas_folders.items.create` | File folder created | `daas_folders` |
| `daas_folders.items.update` | File folder updated | `daas_folders` |
| `daas_folders.items.delete` | File folder deleted | `daas_folders` |
| `daas_users.items.update` | User profile updated (including self-update) | `daas_users` |

This means you can create hooks that react to system lifecycle changes — for example, invalidating caches when settings change, sending notifications when a user is assigned a new role, logging scope hierarchy modifications, or auditing policy assignment changes.

### Filter Hooks (Blocking)

Filter hooks run **before** an operation and can modify the payload. The operation waits for all filters to complete.

**Use cases:**

- Validation (throw error to abort)
- Data transformation
- Auto-populate fields
- Sanitization

**Filter receives:**

```typescript
(payload, meta, context) => modifiedPayload;
```

**Example: Validate and transform**

```javascript
// Filter code for articles.items.create
if (!payload.title || payload.title.trim().length < 3) {
  throw new Error("Title must be at least 3 characters");
}

return {
  ...payload,
  title: payload.title.trim(),
  slug: payload.title.toLowerCase().replace(/\s+/g, "-"),
  word_count: payload.content?.split(/\s+/).length || 0,
};
```

### Action Hooks (Non-blocking)

Action hooks run **after** an operation completes. They execute asynchronously and don't block the response.

**Use cases:**

- Logging and audit trails
- Notifications
- External API calls
- Analytics

**Action receives:**

```typescript
(meta, context) => void
```

**Example: Log creation**

```javascript
// Action code for items.create
console.log(`[Audit] Item created in ${meta.collection}`);
console.log(`  Key: ${meta.key}`);
console.log(`  User: ${context.accountability?.user}`);
console.log(`  Time: ${new Date().toISOString()}`);
```

---

## Runtime Extensions

Runtime extensions are database-stored hooks that can be created, tested, and modified without redeploying the application.

### Benefits

- ✅ **Hot-reloadable**: Changes take effect immediately
- ✅ **MCP-manageable**: AI agents can create/modify via MCP
- ✅ **Testable**: Test code before activating
- ✅ **Auditable**: Track who created/modified
- ✅ **Version-controlled**: Stored in database with history

### Extension Schema

| Field         | Type                   | Description             |
| ------------- | ---------------------- | ----------------------- |
| `id`          | UUID                   | Primary key             |
| `name`        | string                 | Human-readable name     |
| `description` | string                 | What the extension does |
| `event`       | string                 | Event to listen for     |
| `type`        | 'filter' \| 'action'   | Hook type               |
| `code`        | string                 | JavaScript code         |
| `status`      | 'active' \| 'inactive' | Enable/disable          |
| `sort`        | number                 | Execution order         |

### Available Context in Extensions

Extension code has access to:

```javascript
// payload - The data being created/updated (filter only)
// meta - Operation metadata
{
  event: 'articles.items.create',
  collection: 'articles',
  key: 'uuid-of-created-item',       // For create/update/delete
  keys: ['uuid1', 'uuid2'],          // For batch operations
  payload: { title: 'New Article' }  // Original payload
}

// context - Execution context
{
  accountability: {
    user: 'user-uuid',
    role: 'role-uuid',   // primary role from daas_user_roles (lowest sort)
    admin: false
  },
  services: {
    // Service factories (see below)
  }
}
```

### Services Available in Extensions

In extensions, `services` is a **direct variable** (NOT `context.services`):

```javascript
// ItemsService - CRUD on any collection
const items = await services.items("articles");
const allArticles = await items.readByQuery({ limit: 10 });
const newId = await items.createOne({ title: "New" });
await items.updateOne(newId, { status: "published" });

// VersionService - Content versioning
const versions = await services.versions();
await versions.createOne({
  collection: "articles",
  item: "article-uuid",
  key: "draft",
  name: "Draft Version",
});

// MailService - Send emails
const mail = await services.mail();
await mail.send({
  to: 'admin@company.com',
  subject: 'New item created',
  text: `Item ${meta.key} created in ${meta.collection}`
});

// Custom service - Reusable shared code
const helpers = await services.custom('date_helpers');
const formatted = helpers.formatDate(new Date());

// Direct Supabase (advanced)
const { data } = await services.supabase
  .from("custom_table")
  .select("*");

// HTTP requests (domain-restricted)
const response = await services.fetch(
  "https://api.example.com/webhook",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: meta.event }),
  },
);
```

> See [Services API reference](services-api.instructions.md) for complete method signatures of all services.
```

---

## Managing Extensions via MCP

AI agents use the `extensions` MCP tool to manage runtime extensions.

### List Extensions

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "extensions",
    "arguments": {
      "action": "list",
      "status": "active"
    }
  }
}
```

### Create Extension

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "extensions",
    "arguments": {
      "action": "create",
      "name": "Auto-slug generator",
      "description": "Generates URL slug from title for articles",
      "event": "articles.items.create",
      "type": "filter",
      "code": "if (!payload.slug && payload.title) { payload.slug = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); } return payload;",
      "status": "inactive"
    }
  }
}
```

### Test Extension (Before Activating)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "extensions",
    "arguments": {
      "action": "test",
      "code": "if (!payload.slug && payload.title) { payload.slug = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'); } return payload;",
      "type": "filter",
      "event": "articles.items.create",
      "testPayload": {
        "title": "Hello World Article",
        "content": "This is the content"
      }
    }
  }
}
```

**Test Response:**

```json
{
  "success": true,
  "result": {
    "title": "Hello World Article",
    "content": "This is the content",
    "slug": "hello-world-article"
  },
  "logs": [],
  "executionTime": 2
}
```

### Activate Extension

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "extensions",
    "arguments": {
      "action": "update",
      "id": "extension-uuid",
      "data": {
        "status": "active"
      }
    }
  }
}
```

### Delete Extension

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "extensions",
    "arguments": {
      "action": "delete",
      "id": "extension-uuid"
    }
  }
}
```

---

## Common Extension Patterns

### 1. Auto-Populate Fields

```javascript
// Filter: articles.items.create
// Auto-set reading_time based on content length

const wordCount = (payload.content || "").split(/\s+/).filter(Boolean).length;
payload.reading_time = Math.ceil(wordCount / 200); // 200 words per minute
payload.word_count = wordCount;

return payload;
```

### 2. Validation

```javascript
// Filter: products.items.create
// Validate required fields and price

if (!payload.name || payload.name.trim().length === 0) {
  throw new Error("Product name is required");
}

if (payload.price !== undefined && payload.price < 0) {
  throw new Error("Price cannot be negative");
}

if (payload.sku && !/^[A-Z0-9-]+$/.test(payload.sku)) {
  throw new Error(
    "SKU must contain only uppercase letters, numbers, and hyphens",
  );
}

return payload;
```

### 3. Audit Logging

```javascript
// Action: items.update
// Log all updates to an audit collection

const items = await context.services.items("audit_logs");

await items.createOne({
  action: "update",
  collection: meta.collection,
  item_id: meta.key,
  user_id: context.accountability?.user,
  changes: JSON.stringify(meta.payload),
  timestamp: new Date().toISOString(),
});
```

### 4. Send Notification on Status Change

```javascript
// Action: articles.items.update
// Send webhook when article is published

if (meta.payload.status === "published") {
  await context.services.fetch("https://hooks.slack.com/services/xxx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Article published: ${meta.payload.title || meta.key}`,
    }),
  });
}
```

### 5. Cascade Updates

```javascript
// Action: categories.items.update
// Update all products when category name changes

if (meta.payload.name) {
  const products = await context.services.items("products");

  // Get products in this category
  const { data } = await products.readByQuery({
    filter: { category_id: { _eq: meta.key } },
  });

  // Update each product's cached category name
  for (const product of data) {
    await products.updateOne(product.id, {
      category_name_cache: meta.payload.name,
    });
  }
}
```

### 6. Prevent Deletion of Referenced Items

```javascript
// Filter: categories.items.delete
// Prevent deleting categories with products

const products = await context.services.items("products");
const { data } = await products.readByQuery({
  filter: { category_id: { _eq: meta.key } },
  limit: 1,
});

if (data && data.length > 0) {
  throw new Error("Cannot delete category with existing products");
}

return payload;
```

---

## Extension Execution Order

When multiple extensions match an event:

1. Extensions are sorted by `sort` field (ascending)
2. Filter hooks execute **sequentially** (each receives output of previous)
3. Action hooks execute **in parallel** (fire-and-forget)

```javascript
// Extension 1 (sort: 1): Trim whitespace
payload.title = payload.title?.trim();
return payload;

// Extension 2 (sort: 2): Generate slug (receives trimmed title)
payload.slug = payload.title?.toLowerCase().replace(/\s+/g, "-");
return payload;

// Extension 3 (sort: 3): Validate (receives slug)
if (!payload.slug) throw new Error("Slug required");
return payload;
```

---

## Error Handling

### Filter Hook Errors

Throwing an error in a filter hook **aborts the operation**:

```javascript
// This will prevent the item from being created
if (payload.status === "published" && !payload.approved_by) {
  throw new Error("Articles must be approved before publishing");
}
```

The error is returned to the client:

```json
{
  "errors": [
    {
      "message": "Articles must be approved before publishing",
      "extensions": { "code": "EXTENSION_ERROR" }
    }
  ]
}
```

### Action Hook Errors

Action hooks run after the operation completes. Errors are logged but don't affect the response:

```javascript
// This won't fail the original operation
try {
  await context.services.fetch("https://unreliable-api.com/webhook");
} catch (error) {
  console.error("Webhook failed:", error.message);
  // Original operation already succeeded
}
```

---

## Best Practices

1. **Always return payload in filter hooks** - Even if unchanged
2. **Keep hooks focused** - One hook, one responsibility
3. **Test before activating** - Use the test endpoint
4. **Handle errors gracefully** - Especially in action hooks
5. **Use descriptive names** - Future you will thank you
6. **Set appropriate sort order** - For dependent hooks
7. **Log important operations** - For debugging

---

## Related Instructions

- See [daas-api.instructions.md](../../daas-platform/references/daas-api.instructions.md) for API endpoint reference
- See [daas-mcp-tools.instructions.md](../../daas-platform/references/daas-mcp-tools.instructions.md) for complete MCP tool documentation
- See [workflow-versioning.instructions.md](../../create-workflow/references/workflow-versioning.instructions.md) for workflow actions
