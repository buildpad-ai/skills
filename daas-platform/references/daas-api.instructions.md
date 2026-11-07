---
name: DaaS API Reference
description: Complete API reference for integrating with the DaaS backend
applyTo: "**/*.{ts,tsx}"
---

# DaaS API Reference

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

Complete API documentation for integrating generated applications with the DaaS (Data-as-a-Service) backend.

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Base URL

```
Development: http://localhost:8080
Production: <Engine_URL>
```

On an Engine project the base URL is the Engine_URL, configured via `NEXT_PUBLIC_BUILDPAD_DAAS_URL` in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` holds the same address).

On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

---

## Authentication

On an Engine project there is **one way to authenticate a data call**: the signed-in user's access token.

On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

On an Engine project the data API serves no request without a session; only the sign-in, `GET /api/server/info` and the Engine's password routes (which an application does not use: password recovery is not available on an Engine project) are served without one. The requests that take their tenant from the header `X-Tenant-Id` are the password sign-in, XAppHub sign-in and anonymous reads of public files. A browser can send `X-Tenant-Id` to the Engine from another origin, without cookies or credentials: the Engine allows that header from any origin and allows no credentialed cross-origin request. Even so, the request that names the tenant is the sign-in made through the application's own server route, which sends `X-Tenant-Id` with the value of `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A public file shown in a browser is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read. A request without a session that names no tenant is served from the Engine's host plane, not from the project. A request with a session takes its tenant from the session.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

### 1. Sign-in (Supabase client, sign-in only)

On an Engine project the Supabase client is kept for sign-in only. Password sign-in, session refresh, reading the signed-in user and sign-out work through it, and its default sign-out ends the user's sessions on every device. An account that holds no role in the project's tenant is refused at password sign-in. XAppHub sign-in also works through it while the project's XAppHub connector is connected: the application's server gives the ID token from XAppHub to `signInWithIdToken` with the provider `my-apps`, and ends the session of an account that holds no role yet (the `add-external-oauth` skill). Not available on an Engine project: sign-up; OAuth sign-in with any provider other than XAppHub; magic link and one-time code; password recovery; changing a password, an email or a profile through the Supabase client; the Supabase client's code exchange; and the Supabase administration API. The Platform's password-less handoff opens the Studio; it is not a way for an application to sign a user in.

The sign-in is the Engine's password grant. The application makes it from its own server route, so the request carries `X-Tenant-Id`:

```bash
# Step 1: Sign in, naming the project's tenant
curl -X POST "<Engine_URL>/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <NEXT_PUBLIC_BUILDPAD_TENANT_ID>" \
  -d '{"email": "user@example.com", "password": "password"}'

# Step 2: Use the access_token from the answer in the Authorization header
curl <Engine_URL>/api/items/articles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 2. Access Token on Every Data Call

Every call to the data API carries `Authorization: Bearer <access token>`. The Engine accepts no cookie session and no static token: a token stored on a user record is not a credential its data API accepts. A call without a valid token is answered **401**:

| Code              | Meaning                                                    | What to do                       |
| ----------------- | ---------------------------------------------------------- | -------------------------------- |
| `UNAUTHENTICATED` | No `Authorization: Bearer` token was sent                  | Send the user's access token     |
| `TOKEN_EXPIRED`   | The access token has expired                               | Refresh the session, then retry  |
| `TOKEN_INVALID`   | The token does not verify, has been revoked, or is outdated | Sign the user in again          |

### 3. Multi-Factor Authentication

On an Engine project multi-factor enrolment, challenge and verification are not served through the Supabase client. The Engine's own routes, each called with the user's session, are `POST /api/auth/mfa/enroll`, `GET /api/auth/mfa/factors`, `POST /api/auth/mfa/verify` and `POST /api/auth/mfa/unenroll`; a session that still needs its second factor is accepted elsewhere only after `POST /api/auth/mfa/verify`.

A session that still needs its second factor is answered **403** with the code `MFA_REQUIRED`.

### Delegation (`X-On-Behalf-Of`)

A signed-in caller whose policy has `delegate_access: true` can attribute a mutation to a responsible user by passing the `X-On-Behalf-Of` header with a valid user UUID. Only the audit identity is delegated: permissions are still checked against the caller.

```bash
curl -X POST <Engine_URL>/api/items/articles \
  -H "Authorization: Bearer <access token>" \
  -H "X-On-Behalf-Of: <responsible-user-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Article"}'
```

| Behaviour | Without delegation | With delegation |
|-----------|-------------------|-----------------|
| `daas_activity.user_id` | Authenticated user | Target user (from header) |
| `daas_activity.performed_by` | NULL | Calling user's UUID |
| Permission checks | Authenticated user | Authenticated user (not the target) |

The `GET /api/activity` response includes a `performer` join for delegation traceability. When `performed_by IS NOT NULL`, the action was delegated.
<!-- /buildpad-backend -->

---

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
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

| HTTP Status | Code                    | Description                                                    |
| ----------- | ----------------------- | -------------------------------------------------------------- |
| 400         | `INVALID_PAYLOAD`       | Invalid request body                                           |
| 400         | `INVALID_QUERY`         | A query parameter the Engine cannot use, or a field the collection does not have |
| 400         | `RECORD_NOT_UNIQUE`     | Duplicate value in a unique field                              |
| 400         | `INVALID_FOREIGN_KEY`   | A relation value that names no row                             |
| 400         | `NOT_NULL_VIOLATION`    | A required value is missing                                    |
| 401         | `UNAUTHENTICATED`       | No `Authorization: Bearer` token was sent                      |
| 401         | `TOKEN_EXPIRED`         | The access token has expired: refresh the session and retry    |
| 401         | `TOKEN_INVALID`         | The token does not verify, has been revoked, or is outdated: sign in again |
| 403         | `FORBIDDEN`             | Valid auth but insufficient permissions                        |
| 403         | `MFA_REQUIRED`          | The session still needs its second factor                      |
| 404         | `NOT_FOUND`             | Resource not found                                             |
| 409         | `CONFLICT`              | The request contradicts something already stored               |
| 429         | `REQUESTS_EXCEEDED`     | Too many requests                                              |
| 500         | `INTERNAL_SERVER_ERROR` | Server error                                                   |

---

## Query Parameters

All list endpoints support these query parameters:

| Parameter   | Type         | Description                                  | Example                                               |
| ----------- | ------------ | -------------------------------------------- | ----------------------------------------------------- |
| `fields`    | string       | Comma-separated fields or `*`                | `fields=id,title,status`                              |
| `filter`    | JSON         | Filter object                                | `filter={"status":{"_eq":"published"}}`               |
| `sort`      | string       | Sort field(s), `-` for descending            | `sort=-date_created,title`                            |
| `limit`     | number       | Items per page (default: 25, at most 1000)   | `limit=50`                                            |
| `page`      | number       | Page number (1-indexed)                      | `page=2`                                              |
| `offset`    | number       | Items to skip                                | `offset=100`                                          |
| `search`    | string       | Full-text search                             | `search=hello`                                        |
| `count`     | string       | `exact` asks for an exact total in `meta`    | `count=exact`                                         |
| `aggregate` | JSON/bracket | Aggregate functions                          | `aggregate[count]=id` or `aggregate={"count":["id"]}` |
| `groupBy`   | string       | Group aggregate results                      | `groupBy=status,category`                             |

On an Engine project `limit` is capped at 1000: a larger value is served as 1000. The query parameters `deep`, `meta` and `version` are ignored: the Engine answers as if they were not sent. Filter on a related field inside `filter` instead of `deep`; every list answer carries its `meta` (below); read a content version through `GET /api/versions/:id`, whose `delta` holds the version's changes, instead of `version`.

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

On an Engine project each level of a dotted path is read with the caller's own permission on that level's collection: a level the caller may not read comes back empty.

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
{ "price": { "_between": [100, 500] } }

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

The Engine also accepts the negated forms `_ncontains`, `_nicontains`, `_nstarts_with`, `_nistarts_with`, `_nends_with`, `_niends_with` and `_nbetween`, and `_regex`. Its dynamic values are `$CURRENT_USER`, `$CURRENT_ROLE` and `$NOW`.

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

Aggregate responses use a nested format:

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

> **Permission-aware:** Aggregate queries respect the caller's read permission on the collection, including the item filter of that permission.

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
    "total_count": 42,
    "filter_count": 42,
    "total": 42,
    "page": 1,
    "limit": 25,
    "offset": 0,
    "total_pages": 2
  }
}
```

`total_count` counts the collection before any filter, and `filter_count` (also sent as `total`) counts the rows that match the request's filter.
<!-- /buildpad-backend -->

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

<!-- buildpad-backend: supabase -->
| Method | Endpoint                            | Description                   |
| ------ | ----------------------------------- | ----------------------------- |
| GET    | `/api/relations`                    | List all relations            |
| POST   | `/api/relations`                    | Create relation (admin)       |
| GET    | `/api/relations/:collection`        | List relations for collection |
| GET    | `/api/relations/:collection/:field` | Get relation details          |
| PATCH  | `/api/relations/:id`                | Update relation (admin)       |
| DELETE | `/api/relations/:id`                | Delete relation (admin)       |

### Files

| Method | Endpoint                  | Description                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/files`              | List files                                                               |
| POST   | `/api/files`              | Upload file (multipart), or register a signed upload with `upload_token` |
| POST   | `/api/files/signed-url`   | Mint a signed upload URL + `uploadToken` (DaaS ≥ 0.1.93)                 |
| DELETE | `/api/files/signed-url`   | Discard an uploaded object that was never registered (`upload_token`)    |
| GET    | `/api/files/:id`          | Get file metadata                                                        |
| PATCH  | `/api/files/:id`          | Update file metadata                                                     |
| DELETE | `/api/files/:id`          | Delete file                                                              |
| GET    | `/api/files/:id/download` | Get a signed download URL                                                |
| POST   | `/api/files/import`       | Import from URL                                                          |

### Assets (File Content)

| Method | Endpoint                     | Description               |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/api/assets/:id`            | Get file content/download |
| GET    | `/api/assets/:id?download`   | Force download            |
| GET    | `/api/assets/:id?key=preset` | Get transformed image     |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Method | Endpoint                            | Description                   |
| ------ | ----------------------------------- | ----------------------------- |
| GET    | `/api/relations`                    | List all relations            |
| POST   | `/api/relations`                    | Create relation (admin)       |
| POST   | `/api/relations/:collection`        | Create relation on a collection (admin) |
| GET    | `/api/relations/:collection`        | List relations for collection |
| GET    | `/api/relations/:collection/:field` | Get relation details          |
| PATCH  | `/api/relations/:collection/:field` | Update relation (admin)       |
| DELETE | `/api/relations/:collection/:field` | Delete relation (admin)       |

On an Engine project a relation is addressed by its collection and field, not by an id.

### Files

On an Engine project files are stored and served by the Engine: `/api/files`, `/api/folders`, `/api/files/signed-url`, and file content at `/api/files/assets/:id` (with a session or a signed token). A file shown in a browser, a public one included, is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read: an `<img>` element or a link sends no `X-Tenant-Id`. Set no storage bucket option: the Engine stores files on its own disk or in S3.

| Method | Endpoint                  | Description                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/files`              | List files                                                               |
| POST   | `/api/files`              | Upload file (multipart), or register a signed upload with `upload_token` |
| PATCH  | `/api/files`              | Batch update file metadata                                               |
| DELETE | `/api/files`              | Batch delete files                                                       |
| GET    | `/api/files/signed-url`   | Get a signed URL for a file's content (`?id=<file id>`)                  |
| POST   | `/api/files/signed-url`   | Mint a signed upload URL + `uploadToken`                                 |
| DELETE | `/api/files/signed-url`   | Discard an uploaded object that was never registered (`upload_token`)    |
| GET    | `/api/files/:id`          | Get file metadata                                                        |
| PATCH  | `/api/files/:id`          | Update file metadata                                                     |
| DELETE | `/api/files/:id`          | Delete file                                                              |
| GET    | `/api/files/:id/download` | Get a signed download URL                                                |
| POST   | `/api/files/import`       | Import from URL                                                          |

### File Content

| Method | Endpoint                             | Description                                                    |
| ------ | ------------------------------------ | -------------------------------------------------------------- |
| GET    | `/api/files/assets/:id`              | File content, with a session or the `token` of a signed URL (supports `Range`) |
| GET    | `/api/files/assets/:id?download`     | Force download                                                 |

On an Engine project file content is served at `/api/files/assets/:id` only. The CLI's generated `app/api/assets/[id]` proxy forwards to `/api/assets/:id`, a path the Engine does not serve: build the URL of a file shown in a browser from `/api/files/signed-url` instead.
<!-- /buildpad-backend -->

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

<!-- buildpad-backend: supabase -->
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
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Method | Endpoint                         | Description                         |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | `/api/extensions`                | List runtime extensions (hooks)     |
| POST   | `/api/extensions`                | Create extension (admin)            |
| GET    | `/api/extensions/:id`            | Get extension                       |
| PATCH  | `/api/extensions/:id`            | Update extension (admin)            |
| DELETE | `/api/extensions/:id`            | Delete extension (admin)            |
| POST   | `/api/extensions/:id/activate`   | Set status to active (admin)        |
| POST   | `/api/extensions/:id/deactivate` | Set status to inactive (admin)      |
| POST   | `/api/extensions/:id/clone`      | Clone an extension (admin)          |

On an Engine project there is no route that tests a hook's code: activate the hook and write a scratch item. See the [hooks-extensions skill](../../hooks-extensions/SKILL.md).

### Cron Jobs

| Method | Endpoint                 | Description                     |
| ------ | ------------------------ | ------------------------------- |
| GET    | `/api/cron`              | List cron jobs                  |
| POST   | `/api/cron`              | Create cron job                 |
| GET    | `/api/cron/history`      | Run history of every job        |
| GET    | `/api/cron/:id`          | Get cron job                    |
| PATCH  | `/api/cron/:id`          | Update cron job                 |
| DELETE | `/api/cron/:id`          | Delete cron job                 |
| POST   | `/api/cron/:id/run`      | Run the job now                 |
| POST   | `/api/cron/:id/clone`    | Clone a cron job                |
| GET    | `/api/cron/:id/history`  | Run history of one job          |

On an Engine project an active cron job fires at its scheduled time. `POST /api/cron/:id/run` runs a job by hand at any time. See the [create-cron skill](../../create-cron/SKILL.md).

### Custom Services

| Method | Endpoint                    | Description                        |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/services`             | List custom services               |
| POST   | `/api/services`             | Create custom service              |
| GET    | `/api/services/:id`         | Get custom service                 |
| PATCH  | `/api/services/:id`         | Update custom service              |
| DELETE | `/api/services/:id`         | Delete custom service              |
| POST   | `/api/services/:id/tests`   | Run the service's tests (admin)    |

See the [create-service skill](../../create-service/SKILL.md). Cron jobs, custom services and hooks are managed with an administrator's session, or by an administrator through the Engine's MCP tools `cron`, `services` and `extensions`.

### Utilities

| Method | Endpoint                        | Description                                         |
| ------ | ------------------------------- | --------------------------------------------------- |
| POST   | `/api/utils/hash/generate`      | Generate bcrypt hash (rate limited)                 |
| POST   | `/api/utils/hash/verify`        | Verify hash (admin)                                 |
| GET    | `/api/utils/random/string`      | Generate random string                              |
| POST   | `/api/utils/sort/:collection`   | Manual item sorting (admin)                         |
| GET    | `/api/utils/export/:collection` | Export a collection (admin)                         |
| POST   | `/api/utils/export/:collection` | Store an export of the rows the caller may read     |
| POST   | `/api/utils/import/:collection` | Import into a collection (admin)                    |
| POST   | `/api/utils/cache/clear`        | Clear cache (admin)                                 |

### Activity and Logs

| Method | Endpoint                     | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| GET    | `/api/activity`              | List activity (audit) entries                |
| GET    | `/api/revisions`             | List revisions                               |
| GET    | `/api/revisions/:id`         | Get revision                                 |
| GET    | `/api/logs`                  | Recent server log entries                    |
| GET    | `/api/logs/stream`           | Stream server log entries                    |
| DELETE | `/api/logs`                  | Clear the server log buffer (admin)          |

### Settings

| Method | Endpoint                 | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/api/settings`          | Get system settings                      |
| PATCH  | `/api/settings`          | Update settings (admin)                  |
| GET    | `/api/settings/smtp`     | Get mail settings                        |
| PATCH  | `/api/settings/smtp`     | Update mail settings (admin)             |
| POST   | `/api/settings/smtp/test`| Send a test mail (admin)                 |
| GET    | `/api/settings/mcp`      | Get MCP settings                         |
| PATCH  | `/api/settings/mcp`      | Update MCP settings (admin)              |

On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.

### MCP (Model Context Protocol)

| Method | Endpoint             | Description                        |
| ------ | -------------------- | ---------------------------------- |
| POST   | `/api/mcp`           | JSON-RPC 2.0 endpoint for AI tools |
| GET    | `/api/mcp/sse`       | Server-sent events transport       |
| POST   | `/api/mcp/messages`  | Messages for the SSE transport     |

The token in the project's MCP configuration is accepted only on these routes. Never send it to the data API.

---

## TypeScript SDK Pattern

When generating frontend code, use this pattern for API calls. Every call carries the signed-in user's access token, never a cookie:

```typescript
// lib/api/client.ts
const ENGINE_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;

export async function fetchItems<T>(
  accessToken: string,
  collection: string,
  options?: {
    fields?: string;
    filter?: Record<string, any>;
    sort?: string;
    limit?: number; // at most 1000
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
    `${ENGINE_URL}/api/items/${collection}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "API Error");
  }

  return response.json();
}

export async function createItem<T>(
  accessToken: string,
  collection: string,
  data: Partial<T>,
): Promise<{ data: T }> {
  const response = await fetch(`${ENGINE_URL}/api/items/${collection}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.message || "API Error");
  }

  return response.json();
}
```

`accessToken` is the signed-in user's access token from the Supabase client's session. On a `401` with `TOKEN_EXPIRED`, refresh the session and retry once; on `TOKEN_INVALID` or `UNAUTHENTICATED`, send the user to sign in.
<!-- /buildpad-backend -->

---

## Related Instructions

- See [permissions-filtering.instructions.md](../../create-rbac/references/permissions-filtering.instructions.md) for item-level and field-level permissions
- See [daas-mcp-tools.instructions.md](./daas-mcp-tools.instructions.md) for AI agent MCP integration
<!-- buildpad-backend: supabase -->
- See [utilities-api.instructions.md](../../hooks-extensions/references/utilities-api.instructions.md) for utility endpoint details
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- See the [hooks-extensions skill](../../hooks-extensions/SKILL.md) for hooks and for what stored code can reach on an Engine project; the utility endpoints are listed above
<!-- /buildpad-backend -->
- See [workflow-versioning.instructions.md](../../create-workflow/references/workflow-versioning.instructions.md) for workflow and versioning patterns
