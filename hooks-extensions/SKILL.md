---
name: hooks-extensions
description: DaaS runtime extensions (hooks) and utilities API reference. Covers filter hooks (validation, transformation before save), action hooks (audit logging, notifications after save), and utility endpoints. Use DaaS extensions instead of implementing backend logic in Next.js API routes. Automatically loaded as background context.
user-invokable: false
---

# Hooks & Extensions Reference

## Runtime Extensions

DaaS runtime extensions (hooks) run server-side on data events. They replace custom backend logic in Next.js API routes.

### Extension Types

| Type     | When             | Use For                                                | Blocking?        |
| -------- | ---------------- | ------------------------------------------------------ | ---------------- |
| `filter` | Before operation | Validation, data transformation, auto-populate fields  | Yes — can reject |
| `action` | After operation  | Audit logging, notifications, sync to external systems | No — async       |

### Creating Extensions via MCP

Use **top-level parameters** (not wrapped in a `data` object):

```json
// Filter hook — validate before save
{
  "name": "mcp_daas_extensions",
  "arguments": {
    "action": "create",
    "name": "Validate Title Length",
    "event": "articles.items.create",
    "type": "filter",
    "code": "if (!payload.title || payload.title.length < 3) { throw new Error('Title too short'); } return payload;",
    "status": "active"
  }
}

// Action hook — audit logging (async, non-blocking)
{
  "name": "mcp_daas_extensions",
  "arguments": {
    "action": "create",
    "name": "Audit Logger",
    "event": "items.create",
    "type": "action",
    "code": "console.log('Created:', meta.collection, meta.key); await services.items(meta.collection).createOne({ action: 'create', collection: meta.collection, item_id: meta.key, payload_keys: Object.keys(meta.payload || {}) });",
    "status": "active"
  }
}
```

### `mcp_daas_extensions` Actions

| Action       | Parameters                                             | Purpose                        |
| ------------ | ------------------------------------------------------ | ------------------------------ |
| `list`       | `event?`, `status?`, `type?`                           | List all extensions            |
| `read`       | `id`                                                   | Read extension details         |
| `create`     | `name`, `event`, `type`, `code`, `status?`, `sort?`, `timeout_ms?` | Create an extension |
| `update`     | `id`, `name?`, `event?`, `type?`, `code?`, `status?`, `sort?`, `timeout_ms?` | Update an extension |
| `delete`     | `id`                                                   | Delete an extension            |
| `activate`   | `id`                                                   | Set status to active           |
| `deactivate` | `id`                                                   | Set status to inactive         |
| `clone`      | `id`, `name?`                                          | Clone an extension             |

> **Note:** All parameters are top-level in `arguments` — do NOT wrap them in a `data` object.
> The `delete` action requires the platform setting `mcp_allow_deletes = true` (env: `MCP_ALLOW_DELETES=true`). Without it, delete returns "Delete operations are disabled".

### Event Names

- `items.create` / `items.update` / `items.delete` — All collections
- `[collection].items.create` — Specific collection
- `auth.login` / `auth.logout` — Auth events
- System collections also emit events: `daas_cron_jobs.items.*`, `daas_custom_services.items.*`, `daas_extensions.items.*`, `daas_scope_types.items.*`, `daas_scope_items.items.*`, `daas_scope_collection_config.items.*`, `daas_access.items.*`, `daas_user_roles.items.*`, `daas_settings.items.*`, `daas_folders.items.*`, `daas_users.items.*`, `daas_roles.items.*`

### Built-in Platform Hooks

The following hooks are **hardcoded in the platform** (not runtime extensions). They fire automatically and cannot be disabled or overridden via the extensions API.

| Hook | Event | Purpose |
|---|---|---|
| Role-scope read | `daas_roles.items.read` | Computes the `assignable` boolean on each role based on the current scope context and `scope_config.allowed_scopes` |
| Role-scope validate | `daas_users.items.create`, `daas_users.items.update` | Validates role assignments against `scope_config`. Throws `ROLE_SCOPE_MISMATCH` or `ROLE_SCOPE_LOCKED` if the assignment violates scope restrictions |

> These hooks are implemented in `lib/hooks/role-scope.ts`. Do **not** create runtime extensions for the same events expecting to replicate or override this behavior.

### Hook Context Variables

**Common to all hooks:**

| Variable   | Type    | Description                                                     |
| ---------- | ------- | --------------------------------------------------------------- |
| `services` | object  | Full services object (see table below)                          |
| `context`  | object  | Supabase client (circular reference — do NOT JSON.stringify)    |
| `console`  | object  | `log`, `warn`, `error` — captured in logs                      |
| `JSON`     | object  | `parse`, `stringify`                                            |
| `Date`     | class   | Standard Date constructor                                       |
| `Math`     | object  | Standard Math object                                            |

**Filter hooks — additional variables:**

| Variable  | Type   | Description                                                    |
| --------- | ------ | -------------------------------------------------------------- |
| `payload` | object | The data being written (modify and `return payload`)           |
| `meta`    | object | `{ event, collection }` — event metadata (no payload or key)  |

**Action hooks — additional variables:**

| Variable | Type   | Description                                                                |
| -------- | ------ | -------------------------------------------------------------------------- |
| `meta`   | object | `{ event, payload, key, collection }` — full event data                   |

In action hooks, access event data via `meta`:
- `meta.payload` — The data that was written
- `meta.key` / `meta.keys` — The ID(s) of the created/updated/deleted item(s)
- `meta.collection` — The collection name
- `meta.event` — The event name string (e.g., `"articles.items.create"`)

**NOT available (despite Directus conventions):**
- ❌ `event` — Use `meta.event`
- ❌ `collection` — Use `meta.collection`
- ❌ `key` / `keys` — Use `meta.key` or `meta.keys`
- ❌ `accountability` — Not injected into sandbox

### `services` Object Members

All service factory calls accept an optional `{ elevated: true }` option (see below).

| Member                              | Type     | Purpose                                                |
| ----------------------------------- | -------- | ------------------------------------------------------ |
| `services.items(coll, [opts])`      | async fn | CRUD + aggregate on any collection (17 methods)        |
| `services.collections([opts])`      | async fn | Collection management                                  |
| `services.fields([opts])`           | async fn | Field management                                       |
| `services.files([opts])`            | async fn | File upload, import, download, metadata                |
| `services.versions([opts])`         | async fn | Content versioning — create, save, promote             |
| `services.relations([opts])`        | async fn | Relation management                                    |
| `services.mail()`                   | async fn | Send emails via SMTP (`send()`, `verify()`)            |
| `services.mail(options)`            | async fn | Send email directly (shorthand)                        |
| `services.custom(name, [opts])`      | async fn | Load a reusable custom service (see [Custom Services](../create-service/SKILL.md)) |
| `services.fetch(url)`               | function | Domain-restricted HTTP fetch                           |
| `services.supabase`                 | object   | Raw Supabase client (service role, bypasses RLS)       |
| `services.env`                      | object   | Runtime whitelisted env vars. Always includes `NODE_ENV` and `NEXT_PUBLIC_SITE_URL`. Additional keys configured via `RUNTIME_ENV_WHITELIST_EXTENSION` or `EXTENSION_PUBLIC_*` deployment env vars. Use `services.env.KEY` or `context.services.env.KEY` (equivalent in extensions). `context.env` does NOT exist. |

> **All factory calls are async** — always `await` them. See [Services API reference](references/services-api.instructions.md) for complete method signatures.

### Elevated Permissions

By default, service calls enforce the **triggering user's own permission policies**. Pass `{ elevated: true }` to bypass permission checks while keeping the original user in the audit trail (`user_created`/`user_updated` fields and `daas_activity` log).

Use this when the extension must perform an operation the user is not directly allowed to do — e.g. writing to a field locked by their policy.

```js
// Normal — user's own permissions enforced
const svc = await services.items('orders');

// Elevated — permission checks skipped, user still in audit trail
const svc = await services.items('orders', { elevated: true });
// Same flag works on every service factory:
// services.fields({ elevated: true })
// services.files({ elevated: true })
// services.versions({ elevated: true })
// services.relations({ elevated: true })
// services.collections({ elevated: true })
// services.custom('name', { elevated: true })  ← propagates admin acc into the nested service

// Example: action hook writing to a protected status log (orders.items.create)
const log = await services.items('order_status_log', { elevated: true });
await log.createOne({ order_id: meta.key, status: 'pending', note: 'auto-created' });
```

> **Cron jobs** always run as the system account (`admin: true`). Permission checks are already bypassed — `{ elevated: true }` is not needed in cron code.

> **Custom services** inherit the calling context's accountability. Pass `{ elevated: true }` when *calling* `services.custom('name', { elevated: true })` to give the nested service admin-level accountability — permission checks inside the custom service are bypassed while the triggering user is still recorded in the audit trail. You can also use `{ elevated: true }` on any `context.services` factory call *within* the custom service itself.

### Correct Code Examples

**Filter hook — validate and transform:**
```js
// payload and meta are available directly
const helper = await services.custom('my_validator');
const check = helper.validatePayload(payload, ['name', 'email']);
if (!check.valid) {
  throw new Error('Missing: ' + check.missing.join(', '));
}
payload.name = payload.name.trim().toUpperCase();
return payload; // MUST return payload
```

**Action hook — audit logging:**
```js
// In action hooks, all event data is in meta (not direct variables)
const helper = await services.custom('audit_logger');
const audit = helper.buildAuditEntry(
  'create',
  meta.collection,    // NOT collection (undefined)
  meta.key,           // NOT key (undefined)
  { payload_keys: Object.keys(meta.payload || {}) }
);
const items = await services.items('audit_logs');
await items.createOne(audit);
```

## Performance: Extensions vs API Routes

| Approach              | Request Flow                               | User Waits For    |
| --------------------- | ------------------------------------------ | ----------------- |
| API Route (❌)        | Request → DaaS → Audit → Response          | Operation + Audit |
| Action Extension (✅) | Request → DaaS → Response → (async: Audit) | Operation only    |

## Special Fields (Auto-Populated)

Instead of hooks for timestamps/user tracking, use special fields:

| Field Type   | `meta.special` Value | Purpose                |
| ------------ | -------------------- | ---------------------- |
| UUID PK      | `["uuid"]`           | Auto-generate UUID     |
| Created date | `["date-created"]`   | Auto-set on create     |
| Updated date | `["date-updated"]`   | Auto-set on update     |
| Created by   | `["user-created"]`   | Auto-set creating user |
| Updated by   | `["user-updated"]`   | Auto-set updating user |

## References

- [Hooks & extensions guide](references/hooks-extensions.instructions.md)
- [Services API reference](references/services-api.instructions.md) — complete method signatures for all built-in services
- [Utilities API](references/utilities-api.instructions.md)
