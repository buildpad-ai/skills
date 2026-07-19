---
name: Utilities API
description: DaaS utility endpoints for hashing, random strings, sorting, and import/export
applyTo: "**/*.{ts,tsx}"
---

# Utilities API

Reference for DaaS utility endpoints that provide common helper operations.

## Overview

The Utilities API provides:

- **Hashing**: Secure bcrypt hash generation and verification
- **Random Strings**: Cryptographically secure random string generation
- **Sorting**: Manual item reordering in collections
- **Import/Export**: Bulk data transfer via JSON/CSV
- **Cache**: Cache management (admin only)

All endpoints require authentication.

---

## Hash Generation

### POST /api/utils/hash/generate

Generate a bcrypt hash from a plaintext string.

**Use cases:**

- Hash passwords before storage
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

**TypeScript Example:**

```typescript
const response = await fetch(`${DAAS_URL}/api/utils/hash/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ string: "password123" }),
});

const { data: hash } = await response.json();
// hash: "$2a$10$..."
```

**Notes:**

- Uses bcrypt with 10 salt rounds
- Each call produces a unique hash (random salt)
- Safe for password storage

---

## Hash Verification

### POST /api/utils/hash/verify

Verify a plaintext string against a bcrypt hash.

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

**TypeScript Example:**

```typescript
const isValid = await verifyPassword(inputPassword, storedHash);

async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const response = await fetch(`${DAAS_URL}/api/utils/hash/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ string: password, hash }),
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
| `length`  | number | 32      | Length of string (1-256) |

**Response (200):**

```json
{
  "data": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Examples:**

```bash
# Default 32 characters
curl http://localhost:3000/api/utils/random/string \
  -H "Authorization: Bearer <token>"

# Custom length
curl "http://localhost:3000/api/utils/random/string?length=64" \
  -H "Authorization: Bearer <token>"
```

**Use cases:**

- Generate static tokens for users
- Create unique identifiers
- Generate secure API keys
- Create verification codes

**TypeScript Example:**

```typescript
async function generateToken(length = 32): Promise<string> {
  const response = await fetch(
    `${DAAS_URL}/api/utils/random/string?length=${length}`,
    { credentials: "include" },
  );
  const { data } = await response.json();
  return data;
}

// Generate a user token
const token = await generateToken(48);
```

---

## Manual Sorting

### POST /api/utils/sort/:collection

Manually reorder items in a collection by updating their sort field.

**Requirements:**

- Collection must have a `sort` field (integer type)
- User must have `update` permission on the collection

**Request:**

```json
{
  "item": "item-uuid-to-move",
  "to": "target-item-uuid"
}
```

This moves `item` to the position **after** `to`.

**Example: Reorder categories**

```typescript
// Move category-3 after category-1
await fetch(`${DAAS_URL}/api/utils/sort/categories`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    item: "category-3-uuid",
    to: "category-1-uuid",
  }),
});
```

**Moving to first position:**

```json
{
  "item": "item-uuid",
  "to": null
}
```

---

## Data Export

### POST /api/utils/export/:collection

Export collection data to JSON or CSV format.

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
| `format` | string | `json` or `csv`          |
| `filter` | object | Optional filter criteria |
| `fields` | array  | Fields to include        |
| `sort`   | array  | Sort order               |
| `limit`  | number | Max items (default: all) |

**Response (JSON format):**

```json
{
  "data": [
    { "id": "1", "name": "John", "email": "john@example.com" },
    { "id": "2", "name": "Jane", "email": "jane@example.com" }
  ]
}
```

**Response (CSV format):**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="users_export.csv"

id,name,email,created_at
1,John,john@example.com,2025-01-01T00:00:00Z
2,Jane,jane@example.com,2025-01-02T00:00:00Z
```

**TypeScript Example:**

```typescript
async function exportToCSV(collection: string, filter?: object) {
  const response = await fetch(`${DAAS_URL}/api/utils/export/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      format: "csv",
      filter,
      fields: ["*"],
    }),
  });

  const blob = await response.blob();

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${collection}_export.csv`;
  a.click();
}
```

---

## Data Import

### POST /api/utils/import/:collection

Import data from JSON or CSV format.

**JSON Import:**

```json
{
  "format": "json",
  "data": [
    { "name": "Product 1", "price": 29.99 },
    { "name": "Product 2", "price": 49.99 }
  ]
}
```

**CSV Import (multipart/form-data):**

```bash
curl -X POST "http://localhost:3000/api/utils/import/products" \
  -H "Authorization: Bearer <token>" \
  -F "format=csv" \
  -F "file=@products.csv"
```

**Response (200):**

```json
{
  "data": {
    "created": 10,
    "updated": 5,
    "errors": []
  }
}
```

**Response with errors:**

```json
{
  "data": {
    "created": 8,
    "updated": 3,
    "errors": [
      { "row": 5, "message": "Duplicate key violation" },
      { "row": 12, "message": "Invalid price format" }
    ]
  }
}
```

**Import Options:**

| Option        | Type   | Description                            |
| ------------- | ------ | -------------------------------------- |
| `format`      | string | `json` or `csv`                        |
| `data`        | array  | Data for JSON import                   |
| `file`        | file   | File for CSV import                    |
| `onDuplicate` | string | `skip`, `update`, or `error` (default) |

**TypeScript Example:**

```typescript
async function importData(collection: string, items: object[]) {
  const response = await fetch(`${DAAS_URL}/api/utils/import/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      format: "json",
      data: items,
      onDuplicate: "update",
    }),
  });

  const result = await response.json();
  console.log(
    `Created: ${result.data.created}, Updated: ${result.data.updated}`,
  );

  if (result.data.errors.length > 0) {
    console.error("Import errors:", result.data.errors);
  }
}
```

---

## Cache Management (Admin Only)

### POST /api/utils/cache/clear

Clear the internal cache. Requires admin access.

**Request:**

```json
{}
```

**Response (200):**

```json
{
  "data": {
    "cleared": true
  }
}
```

**Use cases:**

- After schema changes
- After permission updates
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

**401 Unauthorized:**

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": { "code": "UNAUTHORIZED" }
    }
  ]
}
```

**403 Forbidden:**

```json
{
  "errors": [
    {
      "message": "Admin access required",
      "extensions": { "code": "FORBIDDEN" }
    }
  ]
}
```

---

## MCP Usage

AI agents can use utilities via the `items` tool on system collections, or through direct API calls. Currently, there's no dedicated MCP tool for utilities.

**Example: Generate token via API in extension**

```javascript
// In a runtime extension
const response = await context.services.fetch(
  `${DAAS_URL}/api/utils/random/string?length=48`,
);
const { data: token } = await response.json();
```

---

## Related Instructions

- See [daas-api.instructions.md](../../daas-platform/references/daas-api.instructions.md) for complete API reference
- See [hooks-extensions.instructions.md](./hooks-extensions.instructions.md) for using utilities in extensions
