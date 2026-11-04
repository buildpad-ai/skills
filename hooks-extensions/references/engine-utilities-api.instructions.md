---
name: Utilities API (Engine project)
description: The Engine utility endpoints for hashing, random strings, sorting, import/export and cache, called with a signed-in user session
applyTo: "**/*.{ts,tsx}"
---

<!-- buildpad-backend-file: engine -->
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

# Utilities API (Engine project)

Reference for the Engine's utility endpoints, which provide common helper operations.

## Overview

The Utilities API provides:

- **Hashing**: bcrypt hash generation and verification
- **Random Strings**: Cryptographically secure random string generation
- **Sorting**: Manual item reordering in collections (administrator only)
- **Import/Export**: Bulk data transfer as JSON or CSV
- **Cache**: Cache management (administrator only)

**Every route needs a signed-in user's session.** On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

Call these routes from the application's own server routes, forwarding the user's token with `getAuthHeaders()` and `getDaasUrl()` from `@/lib/api/auth-headers`. Stored code (hooks, cron jobs, custom services) holds no token and cannot call them.

| Route | Who may call it |
|---|---|
| `POST /api/utils/hash/generate` | Any signed-in user (30 per minute per user) |
| `POST /api/utils/hash/verify` | Administrator |
| `GET /api/utils/random/string` | Any signed-in user |
| `POST /api/utils/sort/:collection` | Administrator |
| `GET /api/utils/export/:collection` | Administrator |
| `POST /api/utils/export/:collection` | A user with `read` on the collection |
| `POST /api/utils/import/:collection` | Administrator |
| `POST /api/utils/cache/clear` | Administrator |

---

## Hash Generation

### POST /api/utils/hash/generate

Generate a bcrypt hash from a plaintext string of at most 72 bytes.

**Use cases:**

- Hash a value before storing it in a hashed field
- Generate API key hashes
- Create secure tokens

**Request:**

```json
{
  "string": "mySecretPassword123"
}
```

**Response (200):**

```json
{
  "data": "$2a$10$N9qo8uLOickgx2ZMRZoMye3Z1rLIVrBw8v3sKGDfmvMKw4Y8pHZlC"
}
```

**TypeScript Example (server route):**

```typescript
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

const response = await fetch(`${getDaasUrl()}/api/utils/hash/generate`, {
  method: "POST",
  headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
  body: JSON.stringify({ string: "password123" }),
  cache: "no-store",
});

const { data: hash } = await response.json();
// hash: "$2a$10$..."
```

**Notes:**

- Each call produces a unique hash (random salt)
- A string over 72 bytes is refused with `400`: bcrypt hashes no more than that
- More than 30 calls a minute from one user answer `429` with `Retry-After`
- User passwords are not set this way on an Engine project: an administrator sets them in the Studio's Users module

---

## Hash Verification

### POST /api/utils/hash/verify

Verify a plaintext string against a bcrypt hash. **Administrator only.**

**Request:**

```json
{
  "string": "mySecretPassword123",
  "hash": "$2a$10$N9qo8uLOickgx2ZMRZoMye3Z1rLIVrBw8v3sKGDfmvMKw4Y8pHZlC"
}
```

**Response - Match (200):**

```json
{
  "data": true
}
```

**Response - No Match (200):**

```json
{
  "data": false
}
```

A hash whose cost is too high to check is refused with `422`.

**TypeScript Example (server route, administrator's session):**

```typescript
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

async function verifyHash(value: string, hash: string): Promise<boolean> {
  const response = await fetch(`${getDaasUrl()}/api/utils/hash/verify`, {
    method: "POST",
    headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ string: value, hash }),
    cache: "no-store",
  });

  const { data } = await response.json();
  return data;
}
```

---

## Random String Generation

### GET /api/utils/random/string

Generate a cryptographically secure random string.

**Query Parameters:**

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `length`  | number | 32      | Length of string (1-500) |

**Response (200):**

```json
{
  "data": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Examples:**

```bash
# Default 32 characters
curl "$ENGINE_URL/api/utils/random/string" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Custom length
curl "$ENGINE_URL/api/utils/random/string?length=64" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Use cases:**

- Create unique identifiers
- Generate secure API keys
- Create verification codes

**TypeScript Example (server route):**

```typescript
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

async function generateToken(length = 32): Promise<string> {
  const response = await fetch(
    `${getDaasUrl()}/api/utils/random/string?length=${length}`,
    { headers: await getAuthHeaders(), cache: "no-store" },
  );
  const { data } = await response.json();
  return data;
}

const token = await generateToken(48);
```

---

## Manual Sorting

### POST /api/utils/sort/:collection

Reorder items by writing their `sort` field. **Administrator only.**

**Requirements:**

- The collection must have an integer `sort` field; without one the call is refused with `400 INVALID_COLLECTION`
- The caller must be an administrator

**Request — the whole order:**

```json
{
  "items": ["category-3-uuid", "category-1-uuid", "category-2-uuid"]
}
```

Each listed item's `sort` becomes its position in the list, starting at 1.

**Request — one item:**

```json
{
  "item": "category-3-uuid",
  "to": 2
}
```

`to` is the `sort` value the item gets. A body that names neither is refused with `400`.

**Example: Reorder categories (server route, administrator's session)**

```typescript
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

await fetch(`${getDaasUrl()}/api/utils/sort/categories`, {
  method: "POST",
  headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
  body: JSON.stringify({ items: ["category-3-uuid", "category-1-uuid", "category-2-uuid"] }),
  cache: "no-store",
});
// → { "data": { "success": true } }
```

---

## Data Export

### GET /api/utils/export/:collection

Download a collection as a file. **Administrator only.** `?format=json` (the default) answers a JSON array; `?format=csv` answers CSV. Concealed fields are masked as the Items API masks them.

```bash
curl "$ENGINE_URL/api/utils/export/products?format=csv" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -o products.csv
```

### POST /api/utils/export/:collection

Store an export as a file in the Engine's file library. Any user with `read` on the collection may call it, and the file holds only what that user could read through `/api/items`.

**Request:**

```json
{
  "format": "json",
  "filter": {
    "status": { "_eq": "active" }
  },
  "fields": ["id", "name", "email", "created_at"],
  "sort": ["-created_at"],
  "limit": 1000
}
```

**Parameters:**

| Field    | Type   | Description              |
| -------- | ------ | ------------------------ |
| `format` | string | `json` (default) or `csv` |
| `filter` | object | Optional filter criteria |
| `fields` | array  | Fields to include        |
| `sort`   | array  | Sort order               |
| `limit`  | number | Max rows; `0` or `-1` for every row, up to 50,000 |

**Response (200):**

```json
{
  "data": { "id": "file-uuid", "filename": "products_<time>.json", "rows": 2 }
}
```

The file is a record in `daas_files`: show it to a user through a signed URL from `/api/files/signed-url`. An export with no rows is refused with `400`.

---

## Data Import

### POST /api/utils/import/:collection

Insert rows from JSON or CSV. **Administrator only.** Rows are inserted in one transaction; there is no update of existing rows.

**JSON Import:**

```json
{
  "data": [
    { "name": "Product 1", "price": 29.99 },
    { "name": "Product 2", "price": 49.99 }
  ]
}
```

A plain JSON array of rows is accepted too.

**CSV Import (multipart/form-data, or a `text/csv` body):**

```bash
curl -X POST "$ENGINE_URL/api/utils/import/products" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@products.csv"
```

The format comes from `?format=json|csv`, else from the file name or the content type.

**Response (200):**

```json
{
  "data": {
    "total_processed": 10,
    "total_inserted": 10
  }
}
```

A body that cannot be read in its format, or holds no rows, is refused with `400`; a body over the upload limit with `413`.

**TypeScript Example (server route, administrator's session):**

```typescript
import { getAuthHeaders, getDaasUrl } from "@/lib/api/auth-headers";

async function importData(collection: string, items: object[]) {
  const response = await fetch(`${getDaasUrl()}/api/utils/import/${collection}`, {
    method: "POST",
    headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ data: items }),
    cache: "no-store",
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.errors?.[0]?.message ?? "Import failed");
  return result.data; // { total_processed, total_inserted }
}
```

---

## Cache Management (Administrator Only)

### POST /api/utils/cache/clear

Drop the Engine's rebuildable caches (compiled permissions, schema, scope configuration, settings). Sessions and revoked tokens are kept.

**Response (200):**

```json
{
  "data": true
}
```

**Use cases:**

- After schema changes made outside the API
- After permission updates that do not show
- When debugging caching issues

---

## Error Responses

All utility endpoints return errors in the standard format:

**400 Bad Request:**

```json
{
  "errors": [
    {
      "message": "\"string\" is required",
      "extensions": { "code": "INVALID_PAYLOAD" }
    }
  ]
}
```

**401 Unauthorized:** no session (`UNAUTHENTICATED`), or a token that is not valid or has expired (`TOKEN_INVALID`, `TOKEN_EXPIRED`): sign in again.

**403 Forbidden:**

```json
{
  "errors": [
    {
      "message": "You do not have permission to access this resource.",
      "extensions": { "code": "FORBIDDEN" }
    }
  ]
}
```

---

## MCP and Stored Code

On an Engine project the MCP tool `utilities` has one action, for administrators only: `realign_sequences`, which moves each integer key's sequence past the largest key after an import (`collections` narrows it). The utilities above have no MCP tool. Stored code cannot call these routes either: it has no session to send. Call them from the application's own server routes with the signed-in user's token, as the examples above do.

---

## Related Instructions

- See the [daas-platform skill](../../daas-platform/SKILL.md) for the Engine's API
- See the [Engine hooks guide](./engine-hooks.instructions.md) for runtime extensions
