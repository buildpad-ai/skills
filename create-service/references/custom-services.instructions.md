# Custom Services Reference

Detailed reference for DaaS custom services — reusable code modules shared between extensions and cron jobs.

## Database Schema

Custom services are stored in `daas_custom_services`:

| Column         | Type          | Description                              |
| -------------- | ------------- | ---------------------------------------- |
| `id`           | UUID          | Primary key                              |
| `name`         | VARCHAR(255)  | Unique service name (camelCase)          |
| `description`  | TEXT          | Optional description                     |
| `code`         | TEXT          | JS code that returns an object           |
| `tests`        | JSONB         | Array of test definitions                |
| `last_test_run`| JSONB         | Last test run results                    |
| `status`       | ENUM          | active, inactive, draft, error           |
| `dependencies` | TEXT[]        | Names of dependent services              |
| `version`      | INTEGER       | Auto-incremented on update               |
| `timeout_ms`   | INTEGER       | Max execution time (default 5000)        |
| `created_at`   | TIMESTAMPTZ   | Creation timestamp                       |
| `updated_at`   | TIMESTAMPTZ   | Last update timestamp                    |

## REST API

### List Services

```http
GET /api/services
GET /api/services?status=active
```

### Get Service

```http
GET /api/services/{id}
```

### Create Service

```http
POST /api/services
Content-Type: application/json

{
  "name": "myHelpers",
  "description": "Helper utilities",
  "code": "return { formatDate: (d) => d.toISOString().slice(0,10) };",
  "status": "draft",
  "tests": [
    { "name": "test1", "code": "assert.ok(true);" }
  ],
  "dependencies": [],
  "timeout_ms": 5000
}
```

### Update Service

```http
PATCH /api/services/{id}
Content-Type: application/json

{
  "code": "return { ... };",
  "status": "active"
}
```

### Delete Service

```http
DELETE /api/services/{id}
```

Fails with 409 if other services depend on it.

### Run Tests

```http
POST /api/services/{id}/tests
```

Run single test:

```http
POST /api/services/{id}/tests?test=Test%20Name
```

## MCP Tool

Tool name: `mcp_daas_services`

### List

```json
{ "action": "list", "status": "active" }
```

### Read

```json
{ "action": "read", "id": "uuid" }
```

### Create

```json
{
  "action": "create",
  "name": "serviceName",
  "description": "Description",
  "code": "return { method() { return 'value'; } };",
  "status": "draft",
  "tests": [{ "name": "test", "code": "assert.ok(true);" }],
  "dependencies": [],
  "timeout_ms": 5000
}
```

### Update

```json
{
  "action": "update",
  "id": "uuid",
  "code": "return { ... };",
  "status": "active"
}
```

### Delete

```json
{ "action": "delete", "id": "uuid" }
```

### Run All Tests

```json
{ "action": "run_tests", "id": "uuid" }
```

### Run Single Test

```json
{ "action": "run_test", "id": "uuid", "test_name": "test name" }
```

### Activate/Deactivate

```json
{ "action": "activate", "id": "uuid" }
{ "action": "deactivate", "id": "uuid" }
```

## Service Code Structure

Services must return an object:

```javascript
// Basic service
return {
  myMethod(arg) {
    return arg.toUpperCase();
  }
};

// Service with init
return {
  config: null,
  
  async init(context) {
    // Called once when service is instantiated
    const items = await services.items('settings');
    const { data } = await items.readByQuery({ limit: 1 });
    this.config = data[0] || {};
  },
  
  getConfig() {
    return this.config;
  }
};

// Service using other services
return {
  async processItem(itemId) {
    const items = await services.items('my_collection');
    const item = await items.readOne(itemId);
    
    // Use another custom service
    const validators = await services.custom('validators');
    const isValid = validators.validateItem(item);
    
    return { item, isValid };
  }
};
```

## Available Services Context

When service code runs, it has access to:

```javascript
// DaaS service factories
const itemsService = await services.items('collection_name');
const collectionsService = await services.collections();
const fieldsService = await services.fields();
const filesService = await services.files();
const versionsService = await services.versions();
const relationsService = await services.relations();

// Email
const mailService = await services.mail();   // Get MailService instance
await services.mail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' }); // Send directly

// Another custom service
const otherService = await services.custom('otherServiceName');
// Pass { elevated: true } to give the nested service admin-level accountability—
// permission checks inside it are bypassed while the calling user stays in the audit trail:
const elevatedSvc = await services.custom('otherServiceName', { elevated: true });

// HTTP fetch (safe, with domain restrictions)
const response = await services.fetch('https://api.example.com/data');

// Raw Supabase client (service role, bypasses RLS)
const { data } = await services.supabase.from('table').select('*');

// Current user context
const userId = accountability.user;
const userRole = accountability.role;
const isAdmin = accountability.admin;

// Environment variables (whitelisted only)
const nodeEnv = env.NODE_ENV;
const siteUrl = env.NEXT_PUBLIC_SITE_URL;
```

## Elevated Permissions

All service factories available on `services` (or `context.services`) accept an optional `{ elevated: true }` second argument. When elevated, permission checks for that service instance are bypassed while the calling user is still recorded in `user_created`/`user_updated` and `daas_activity`.

```javascript
// Normal — calling user's policies enforced
const items = await services.items('orders');

// Elevated — permission checks skipped, calling user still in audit trail
const items = await services.items('orders', { elevated: true });

// Works on every factory:
// services.fields({ elevated: true })
// services.files({ elevated: true })
// services.versions({ elevated: true })
// services.relations({ elevated: true })
// services.collections({ elevated: true })
// services.custom('name', { elevated: true })  ← propagates admin acc into nested service
```

> **When to use:** Only when the service itself is the authority enforcing a business rule and needs to write to data the calling user cannot directly access. Do not use to silently escalate arbitrary user requests.

> **Cron context:** Cron jobs always run as the system account (`SYSTEM_USER_ID`, `admin: true`). All service calls are already fully elevated — `{ elevated: true }` is accepted but has no additional effect.

---

## Test Structure

Tests are defined as an array of objects:

```json
{
  "tests": [
    {
      "name": "descriptive test name",
      "code": "const svc = await api.instance();\nconst result = svc.myMethod('input');\nassert.equal(result, 'expected');"
    }
  ]
}
```

### Test Context

| Variable | Description |
| -------- | ----------- |
| `api.instance()` | Get fresh service instance |
| `api.call(method, ...args)` | Call method directly |
| `assert.equal(a, b)` | Strict equality (===) |
| `assert.deepEqual(a, b)` | Deep object comparison |
| `assert.ok(value)` | Truthy assertion |
| `assert.throws(fn)` | Expect sync function to throw |
| `assert.rejects(promise)` | Expect promise to reject |
| `console` | Output captured in results |
| `JSON`, `Date`, `Math` | Standard globals |

### Test Results Structure

```json
{
  "passed": 3,
  "failed": 1,
  "total": 4,
  "duration_ms": 156,
  "results": [
    {
      "name": "test name",
      "passed": true,
      "duration_ms": 12,
      "logs": ["log output"]
    },
    {
      "name": "failing test",
      "passed": false,
      "error": "AssertionError: expected 'a' to equal 'b'",
      "duration_ms": 5,
      "logs": []
    }
  ]
}
```

## Dependencies

Services can declare dependencies on other services:

```json
{
  "name": "orderProcessor",
  "dependencies": ["dateHelpers", "emailService"],
  "code": "..."
}
```

**Rules:**

1. Dependencies must exist and be active
2. Circular dependencies are rejected
3. Dependencies are loaded in topological order
4. Deleting a service fails if others depend on it

**Dependency validation:**

```json
// This would be rejected (circular)
// serviceA depends on serviceB
// serviceB depends on serviceA

// This would work (DAG)
// serviceA has no dependencies
// serviceB depends on serviceA
// serviceC depends on serviceA and serviceB
```

## Status Lifecycle

```
draft → active (after testing)
     ↘ inactive (disabled)
     ↘ error (compile/runtime error)

active → inactive (manual disable)
      → error (compile/runtime error)
      → draft (for major changes)

inactive → active (re-enable)
        → draft (for changes)

error → draft (fix and retry)
     → inactive (disable)
```

## Sandbox Environment

Services run in a sandboxed JavaScript environment:

**Allowed:**
- All standard JS syntax
- async/await
- Object/Array methods
- JSON, Date, Math
- String/Number operations

**Blocked:**
- `setTimeout`, `setInterval`
- `require`, `import`
- `eval`, `new Function`
- File system access
- Process/OS access
- Network access (except via `services.fetch`)

## Error Handling

Services should handle errors gracefully:

```javascript
return {
  async fetchData(id) {
    try {
      const items = await services.items('collection');
      const item = await items.readOne(id);
      
      if (!item) {
        throw new Error(`Item not found: ${id}`);
      }
      
      return item;
    } catch (error) {
      console.error(`fetchData failed: ${error.message}`);
      throw error; // Re-throw for caller to handle
    }
  }
};
```

## Performance Considerations

1. **Compile once** — Services are compiled on activation, cached in memory
2. **Hot reload** — Updates trigger recompile without server restart
3. **Timeout protection** — Services are killed after `timeout_ms`
4. **Lazy loading** — Dependencies loaded on first `services.custom()` call

## Naming Conventions

- Use `snake_case` for service names: `date_helpers`, `order_validator`
- Must start with a lowercase letter
- Only lowercase letters, digits, underscores, and hyphens allowed
- **CamelCase names are rejected** by the database constraint
- Use descriptive names: `email_service` not `es`
- Group related services: `user_validator`, `user_formatter`, `user_notifier`
