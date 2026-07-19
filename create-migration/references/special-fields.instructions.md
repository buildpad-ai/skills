---
name: Special Fields
description: Auto-populated and special behavior fields in DaaS
applyTo: "**/*.{ts,tsx}"
---

# Special Fields

This guide covers DaaS special fields that have automatic behaviors like auto-population, hashing, and type casting.

## Overview

Special fields are configured via the `meta.special` property in `daas_fields`. They provide automatic behaviors that reduce boilerplate and ensure data consistency.

## Special Field Types

| Special        | Description               | Auto-Set On    |
| -------------- | ------------------------- | -------------- |
| `uuid`         | Auto-generate UUID        | Create         |
| `date-created` | Set to current timestamp  | Create         |
| `date-updated` | Set to current timestamp  | Create, Update |
| `user-created` | Set to current user's ID  | Create         |
| `user-updated` | Set to current user's ID  | Create, Update |
| `hash`         | Hash value with bcrypt    | Create, Update |
| `cast-json`    | Parse/stringify JSON      | Read, Write    |
| `cast-boolean` | Coerce to boolean         | Read, Write    |
| `cast-csv`     | Parse/stringify CSV array | Read, Write    |
| `file`         | File relationship         | -              |
| `files`        | Files relationship (M2M)  | -              |

---

## UUID Generation

Automatically generates a UUID for the primary key.

### Configuration

```json
{
  "field": "id",
  "type": "uuid",
  "meta": {
    "special": ["uuid"]
  },
  "schema": {
    "is_primary_key": true
  }
}
```

### Behavior

- **On Create**: If `id` is not provided, generates a UUID v4
- **On Update**: No change

### MCP Example

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "products",
        "field": "id",
        "type": "uuid",
        "meta": { "special": ["uuid"] },
        "schema": { "is_primary_key": true }
      }
    ]
  }
}
```

### Form Handling

```tsx
// Don't show UUID field in create forms
<form>
  {/* id field is auto-generated, don't include */}
  <TextInput label="Name" {...form.getInputProps("name")} />
</form>
```

---

## Timestamps (date-created, date-updated)

Automatically track creation and modification times.

### Configuration

```json
{
  "field": "date_created",
  "type": "timestamp",
  "meta": {
    "special": ["date-created"],
    "readonly": true
  }
}
```

```json
{
  "field": "date_updated",
  "type": "timestamp",
  "meta": {
    "special": ["date-updated"],
    "readonly": true
  }
}
```

### Behavior

| Field          | On Create  | On Update  |
| -------------- | ---------- | ---------- |
| `date-created` | Set to NOW | No change  |
| `date-updated` | Set to NOW | Set to NOW |

### MCP Example

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "fields": [
          {
            "field": "id",
            "type": "uuid",
            "meta": { "special": ["uuid"] },
            "schema": { "is_primary_key": true }
          },
          {
            "field": "title",
            "type": "string"
          },
          {
            "field": "date_created",
            "type": "timestamp",
            "meta": {
              "special": ["date-created"],
              "readonly": true,
              "hidden": true,
              "interface": "datetime",
              "display": "datetime"
            }
          },
          {
            "field": "date_updated",
            "type": "timestamp",
            "meta": {
              "special": ["date-updated"],
              "readonly": true,
              "hidden": true,
              "interface": "datetime",
              "display": "datetime"
            }
          }
        ]
      }
    ]
  }
}
```

### Form Handling

```tsx
// Display as read-only or hide completely
<TextInput label="Created" value={formatDate(item.date_created)} disabled />;

// Or filter out in form schema
const editableFields = fields.filter(
  (f) =>
    !f.meta?.special?.includes("date-created") &&
    !f.meta?.special?.includes("date-updated"),
);
```

---

## User Tracking (user-created, user-updated)

Automatically track which users created and modified records.

### Configuration

```json
{
  "field": "user_created",
  "type": "uuid",
  "meta": {
    "special": ["user-created"],
    "readonly": true,
    "interface": "select-dropdown-m2o",
    "display": "user"
  },
  "schema": {
    "foreign_key_table": "daas_users"
  }
}
```

```json
{
  "field": "user_updated",
  "type": "uuid",
  "meta": {
    "special": ["user-updated"],
    "readonly": true,
    "interface": "select-dropdown-m2o",
    "display": "user"
  },
  "schema": {
    "foreign_key_table": "daas_users"
  }
}
```

### Behavior

| Field          | On Create           | On Update           |
| -------------- | ------------------- | ------------------- |
| `user-created` | Set to current user | No change           |
| `user-updated` | Set to current user | Set to current user |

### MCP Example

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "field": "user_created",
        "type": "uuid",
        "meta": {
          "special": ["user-created"],
          "readonly": true
        }
      },
      {
        "collection": "articles",
        "field": "user_updated",
        "type": "uuid",
        "meta": {
          "special": ["user-updated"],
          "readonly": true
        }
      }
    ]
  }
}
```

### Permission Integration

Use with `$CURRENT_USER` for self-access patterns:

```json
{
  "collection": "articles",
  "action": "update",
  "permissions": {
    "user_created": { "_eq": "$CURRENT_USER" }
  }
}
```

---

## Password Hashing

Automatically hash values using bcrypt (10 rounds).

### Configuration

```json
{
  "field": "password",
  "type": "string",
  "meta": {
    "special": ["hash"],
    "interface": "input-hash",
    "hidden": true
  }
}
```

### Behavior

- **On Create**: Hash the provided value
- **On Update**: Hash the new value (only if changed)
- **On Read**: Value is never returned (concealed)

### Important Notes

- Hashed fields are **never returned** in API responses
- Use `/api/utils/hash/verify` to verify passwords
- The `daas_users.password` field has this special by default

### MCP Example

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "api_keys",
        "field": "secret_key",
        "type": "string",
        "meta": {
          "special": ["hash"],
          "hidden": true
        }
      }
    ]
  }
}
```

### Form Handling

```tsx
// Password input - never show existing value
<PasswordInput
  label="Password"
  placeholder="Enter new password to change"
  {...form.getInputProps("password")}
/>;

// On submit, only include if changed
const submitData = {
  ...formValues,
  // Only include password if user entered a new one
  ...(formValues.password ? { password: formValues.password } : {}),
};
```

---

## JSON Casting

Automatically parse JSON strings to objects and stringify objects for storage.

### Configuration

```json
{
  "field": "metadata",
  "type": "json",
  "meta": {
    "special": ["cast-json"],
    "interface": "input-code",
    "options": {
      "language": "json"
    }
  }
}
```

### Behavior

- **On Read**: Parse JSON string to object
- **On Write**: Stringify object to JSON

### Use Cases

- Configuration objects
- Flexible metadata storage
- Dynamic form options
- Translation objects

### MCP Example

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "settings",
    "data": {
      "key": "site_config",
      "value": {
        "theme": "dark",
        "locale": "en-US",
        "features": ["search", "comments"]
      }
    }
  }
}
```

The `value` object is automatically stringified for storage.

---

## Boolean Casting

Coerce various values to boolean.

### Configuration

```json
{
  "field": "is_active",
  "type": "boolean",
  "meta": {
    "special": ["cast-boolean"],
    "interface": "boolean"
  }
}
```

### Behavior

Truthy values → `true`:

- `true`, `1`, `"1"`, `"true"`, `"yes"`, `"on"`

Falsy values → `false`:

- `false`, `0`, `"0"`, `"false"`, `"no"`, `"off"`, `null`, `undefined`

### Use Cases

- Import data with varied boolean formats
- Handle form checkbox values
- Normalize database values

---

## CSV Casting

Parse comma-separated strings to arrays and vice versa.

### Configuration

```json
{
  "field": "tags",
  "type": "csv",
  "meta": {
    "special": ["cast-csv"],
    "interface": "tags"
  }
}
```

### Behavior

- **On Read**: `"a,b,c"` → `["a", "b", "c"]`
- **On Write**: `["a", "b", "c"]` → `"a,b,c"`

### MCP Example

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "articles",
    "data": {
      "title": "My Article",
      "tags": ["news", "featured", "tech"]
    }
  }
}
```

Stored as: `"news,featured,tech"`

---

## File Relations

Mark fields as file references.

### Single File

```json
{
  "field": "featured_image",
  "type": "uuid",
  "meta": {
    "special": ["file"],
    "interface": "file-image"
  },
  "schema": {
    "foreign_key_table": "daas_files"
  }
}
```

### Multiple Files (M2M)

```json
{
  "field": "gallery",
  "type": "alias",
  "meta": {
    "special": ["files"],
    "interface": "files"
  }
}
```

Requires a junction table (e.g., `articles_files`) with M2M relation setup.

---

## Creating Collections with Special Fields

### Complete Example via MCP

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "blog_posts",
        "fields": [
          {
            "field": "id",
            "type": "uuid",
            "meta": { "special": ["uuid"] },
            "schema": { "is_primary_key": true }
          },
          {
            "field": "title",
            "type": "string",
            "schema": { "is_nullable": false }
          },
          {
            "field": "content",
            "type": "text"
          },
          {
            "field": "featured_image",
            "type": "uuid",
            "meta": {
              "special": ["file"],
              "interface": "file-image"
            }
          },
          {
            "field": "tags",
            "type": "csv",
            "meta": {
              "special": ["cast-csv"],
              "interface": "tags"
            }
          },
          {
            "field": "metadata",
            "type": "json",
            "meta": {
              "special": ["cast-json"],
              "interface": "input-code"
            }
          },
          {
            "field": "is_published",
            "type": "boolean",
            "meta": {
              "special": ["cast-boolean"],
              "interface": "boolean"
            },
            "schema": { "default_value": false }
          },
          {
            "field": "date_created",
            "type": "timestamp",
            "meta": {
              "special": ["date-created"],
              "readonly": true
            }
          },
          {
            "field": "date_updated",
            "type": "timestamp",
            "meta": {
              "special": ["date-updated"],
              "readonly": true
            }
          },
          {
            "field": "user_created",
            "type": "uuid",
            "meta": {
              "special": ["user-created"],
              "readonly": true
            }
          },
          {
            "field": "user_updated",
            "type": "uuid",
            "meta": {
              "special": ["user-updated"],
              "readonly": true
            }
          }
        ]
      }
    ]
  }
}
```

---

## Form Generation Guidelines

When generating forms for collections with special fields:

### Fields to HIDE from forms:

| Special              | On Create  | On Edit           |
| -------------------- | ---------- | ----------------- |
| `uuid` (primary key) | Hide       | Show as readonly  |
| `date-created`       | Hide       | Show as readonly  |
| `date-updated`       | Hide       | Show as readonly  |
| `user-created`       | Hide       | Show as readonly  |
| `user-updated`       | Hide       | Show as readonly  |
| `hash`               | Show input | Show change input |

### Field Detection

```typescript
function getFormFields(fields: Field[]) {
  return fields.filter((field) => {
    const special = field.meta?.special || [];

    // Hide auto-generated fields
    if (special.includes("uuid") && field.schema?.is_primary_key) return false;
    if (special.includes("date-created")) return false;
    if (special.includes("date-updated")) return false;
    if (special.includes("user-created")) return false;
    if (special.includes("user-updated")) return false;

    // Include all other fields
    return true;
  });
}

function isReadonlyField(field: Field, isEdit: boolean) {
  if (field.meta?.readonly) return true;

  const special = field.meta?.special || [];
  if (isEdit && special.includes("uuid") && field.schema?.is_primary_key)
    return true;

  return false;
}
```

---

## Related Instructions

- See [daas-api.instructions.md](../../daas-platform/references/daas-api.instructions.md) for API reference
- See [daas-mcp-tools.instructions.md](../../daas-platform/references/daas-mcp-tools.instructions.md) for creating fields via MCP
- See [workflow-versioning.instructions.md](../../create-workflow/references/workflow-versioning.instructions.md) for workflow field integration
