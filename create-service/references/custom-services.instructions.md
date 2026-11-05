# Custom Services Reference

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

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## MCP Tool

On an Engine project the MCP tool `services` manages custom services. It is listed and served to an administrator only, so the agent can use it when the project's MCP configuration carries an administrator's token. Its `action` is `list`, `read`, `create`, `update`, `delete`, `run_tests`, `activate` or `deactivate`; the service's fields and `id` stand at the top level of `arguments`, and a change takes effect as the REST write of the same body does. A `delete` is refused while the project's MCP deletes are off. If the tool is not listed, the project's Engine is older than 0.1.0-dev.4. Without the tool, manage services in the Studio's Custom Services module or through the REST API above, with an administrator's access token (a user whose role holds the matching permission on `daas_custom_services` may list, create, update and delete them too; only an administrator runs tests). Never send the token in the project's MCP configuration to these routes: it is accepted only on the MCP endpoint `/api/mcp`.

## Service Code Structure

On an Engine project the stored code is the body of a factory with one parameter, `context`. It returns the object whose methods callers invoke. `init`, when present, is awaited before a caller gets the object, and `this` is that object. Each `services.custom(name)` call builds a new instance.

```javascript
// Basic service
return {
  myMethod(arg) {
    return arg.toUpperCase();
  }
};

// Service with init
const { services } = context;
return {
  config: null,
  
  async init(ctx) {
    // Awaited once when the service is instantiated
    const rows = await services.items('settings').readByQuery({ limit: 1 });
    this.config = rows[0] || {};
  },
  
  getConfig() {
    return this.config;
  }
};

// Service using other services
const { services: s } = context;
return {
  async processItem(itemId) {
    const item = await s.items('my_collection').readOne(itemId);
    
    // Use another custom service: services.custom answers a promise
    const validators = await s.custom('validators');
    const isValid = validators.validateItem(item);
    
    return { item, isValid };
  }
};
```

## Available Services Context

When service code runs, it reaches the Engine's services through `context`:

```javascript
const { services, accountability, env } = context;

// Engine service factories (schema, files and relations are read only)
const itemsService = services.items('collection_name');   // nine methods
const collectionsService = services.collections();        // readAll, readOne
const fieldsService = services.fields();                  // readAll, readOne
const filesService = services.files();                    // readByQuery, readOne (metadata only)
const versionsService = services.versions();              // readAll, readOne, promote
const relationsService = services.relations();            // readAll, readOne

// Email: returns { success, ... } and does not throw when mail cannot be sent
const mailService = services.mail();   // { send(options), verify() }
const sent = await services.mail({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
if (!sent.success) { /* mail is not configured or the server refused it */ }

// Another custom service (only an active one resolves)
const otherService = await services.custom('other_service_name');
// Pass { elevated: true } (the boolean true) to give the nested service administrator access;
// every audit row still names the calling user:
const elevatedSvc = await services.custom('other_service_name', { elevated: true });

// HTTP fetch: only hosts listed in the project's EXTENSION_ALLOWED_DOMAINS (Environment Variables)
const response = await services.fetch('https://api.example.com/data');

// Current user context: user is always the real caller
const userId = accountability.user;
const userRole = accountability.role;
const isAdmin = accountability.admin;

// Environment variables: only the keys the Engine's operator names; empty by default
const siteUrl = env.SITE_URL;
```

There is no Supabase service, no SQL, no `console` and no `fetch`, `process` or `require` global in a custom service on an Engine project. On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the Engine runtime table of the [hooks-extensions skill](../../hooks-extensions/SKILL.md) lists; for each interface it lacks, the table says what replaces it.
<!-- /buildpad-backend -->

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

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
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

On an Engine project `POST /api/services/:id/tests` runs them live, one after another, inside the request, as the calling administrator. The service is compiled from its stored row, so a `draft` service can be tested.

### Test Context

| Variable | Description |
| -------- | ----------- |
| `api.instance()` | A promise of a fresh service instance |
| `api.call(method, ...args)` | A promise of `instance[method](...args)` |
| `api.cleanup(fn)` | Register `fn` to run after the whole run, a single-test run included |
| `api.services` | The context's `services` |
| `assert` | `equal` (strict), `notEqual`, `deepEqual`, `ok`, `truthy`, `falsy`, `isString`, `isNumber`, `isArray`, `isObject`, `hasProperty`, `includes`, `hasLength`, `throws(fn, expected?)`, `rejects(promise, expected?)` |
| `context` | The same shape a service receives |
| `console` | Output captured in the run |
| `JSON`, `Date`, `Math` | Standard globals |

`expected` is a string the error's message contains, or a regular expression it matches; never the error's class name. `deepEqual` ignores key order. `assert.rejects` answers a promise: write `await assert.rejects(p)`.

### Test Results Structure

```json
{
  "data": {
    "status": "failed",
    "passed": 3,
    "failed": 1,
    "total": 4,
    "duration_ms": 156,
    "results": [
      {
        "name": "test name",
        "status": "passed",
        "duration_ms": 12
      },
      {
        "name": "failing test",
        "status": "failed",
        "error": "expected 'a' to equal 'b'",
        "duration_ms": 5
      }
    ]
  }
}
```

`data.status` decides: the route answers `200` whatever the outcome. A test's `status` is `passed`, `failed` (an assertion failed), `error` (anything else was thrown) or `timeout`. The summary is kept on the service as `last_test_run`; a test run does not change its `version`.

## Dependencies

Services can declare dependencies on other services:

```json
{
  "name": "order_processor",
  "dependencies": ["date_helpers", "email_service"],
  "code": "..."
}
```

**Rules:**

1. Dependencies must exist when the service is saved; a service cannot depend on itself
2. Circular dependencies are rejected, and the refusal names the chain
3. At startup the active services are compiled in dependency order
4. Deleting a service fails with `409` if others depend on it, naming them
<!-- /buildpad-backend -->

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

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```javascript
const { services } = context;

return {
  async fetchData(id) {
    try {
      // readOne throws NOT_FOUND for a missing id; it never answers null
      return await services.items('collection').readOne(id);
    } catch (error) {
      // No console in a service body on the Engine: add context and re-throw for the caller
      throw new Error(`fetchData(${id}) failed: ${error.message}`);
    }
  }
};
```

## Performance Considerations

1. **Compile once** — A service is compiled when it is first resolved and the compiled program is cached; active services are compiled at startup in dependency order
2. **Hot reload** — An edit is visible to the next `services.custom()` call in every process of the Engine, with no restart
3. **Timeout protection** — A method that runs longer than `timeout_ms` (100-30000, default 5000) raises an error the caller can catch
4. **New instance per call** — Every `services.custom()` call builds a new instance and awaits its `init`
<!-- /buildpad-backend -->

## Naming Conventions

- Use `snake_case` for service names: `date_helpers`, `order_validator`
- Must start with a lowercase letter
- Only lowercase letters, digits, underscores, and hyphens allowed
- **CamelCase names are rejected** by the database constraint
- Use descriptive names: `email_service` not `es`
- Group related services: `user_validator`, `user_formatter`, `user_notifier`
