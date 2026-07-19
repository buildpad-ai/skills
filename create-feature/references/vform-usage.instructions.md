---
name: VForm Usage
description: VForm controlled component patterns for form pages. CRITICAL reference for any feature that uses VForm or CollectionForm.
applyTo: "app/**/*.{ts,tsx},components/**/*.{ts,tsx}"
---

# VForm Usage Instructions

## 🔴 CRITICAL: VForm is a CONTROLLED Component

VForm does **NOT** have an `onSubmit` prop. It does **NOT** render a `<form>` element.
VForm is purely a field-rendering engine. The parent component MUST:

1. **Manage form state** with `useState` — pass `modelValue` + `onUpdate`
2. **Handle submission externally** — use an `onClick` handler on a Button, NOT `type="submit"`

### Common Mistakes to AVOID

```tsx
// ❌ WRONG: VForm has no onSubmit prop — values will be silently lost
<VForm fields={fields} onSubmit={handleSubmit} />

// ❌ WRONG: VForm renders <div>, not <form> — this button is disconnected
<Button type="submit" form="vform">Save</Button>

// ❌ WRONG: No modelValue/onUpdate — fields cannot capture user input
<VForm fields={fields} initialValues={data} loading={loading} />
```

## Required Props for Interactive Forms

| Prop                     | Type                            | Required?                  | Purpose                                                        |
| ------------------------ | ------------------------------- | -------------------------- | -------------------------------------------------------------- |
| `fields` or `collection` | `Field[]` or `string`           | One required               | Field definitions (explicit) or collection name (auto-fetched) |
| `modelValue`             | `FieldValues`                   | **YES** for editable forms | Current edited values (controlled state)                       |
| `onUpdate`               | `(values: FieldValues) => void` | **YES** for editable forms | Called when any field changes                                  |
| `initialValues`          | `FieldValues`                   | For edit mode              | Pre-populated values from existing record                      |
| `loading`                | `boolean`                       | Optional                   | Shows skeleton loading state                                   |
| `primaryKey`             | `string \| number`              | Optional                   | `'+'` for create, id for edit, affects field readonly logic    |
| `disabled`               | `boolean`                       | Optional                   | Disables all fields                                            |

## Complete Form Page Pattern (with explicit fields)

This is the pattern to use when field definitions are known at build time:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Title, Paper, Stack, Button, Group } from "@mantine/core";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { VForm } from "@/components/ui";
import type { FieldValues } from "@/components/ui/vform/types";

interface FormContentProps {
  itemId?: string;
}

export default function FormContent({ itemId }: FormContentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState<Record<string, any>>({});
  const [formValues, setFormValues] = useState<FieldValues>({});

  // Fetch existing data for edit mode
  useEffect(() => {
    if (itemId) {
      fetch(`/api/items/${itemId}`)
        .then((res) => res.json())
        .then((result) => setInitialData(result.data))
        .catch(() =>
          notifications.show({
            title: "Error",
            message: "Failed to load",
            color: "red",
          }),
        );
    }
  }, [itemId]);

  // VForm calls onUpdate with ONLY the changed fields (delta)
  const handleUpdate = useCallback((values: FieldValues) => {
    setFormValues(values);
  }, []);

  // Submission is handled OUTSIDE VForm
  async function handleSubmit() {
    const mergedValues = { ...initialData, ...formValues };
    setLoading(true);
    try {
      const url = itemId ? `/api/items/${itemId}` : "/api/items";
      const method = itemId ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        // For PATCH: send only changed fields. For POST: send all.
        body: JSON.stringify(itemId ? formValues : mergedValues),
      });
      if (!response.ok) throw new Error("Save failed");
      notifications.show({
        title: "Success",
        message: "Saved",
        color: "green",
      });
      router.push("/items");
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  // Define fields with DaaS-compatible schema
  const fields = [
    {
      field: "name",
      name: "Name",
      type: "string",
      meta: { interface: "input", required: true, width: "half" },
    },
    {
      field: "status",
      name: "Status",
      type: "string",
      meta: {
        interface: "select-dropdown",
        required: true,
        width: "half",
        options: {
          choices: [
            { text: "Active", value: "active" },
            { text: "Inactive", value: "inactive" },
          ],
        },
      },
    },
    {
      field: "description",
      name: "Description",
      type: "text",
      meta: { interface: "input-multiline", width: "full" },
    },
  ];

  return (
    <Stack gap="lg">
      <Title order={2}>{itemId ? "Edit Item" : "New Item"}</Title>
      <Paper withBorder p="xl" radius="md">
        {/* VForm: controlled via modelValue + onUpdate */}
        <VForm
          fields={fields}
          initialValues={initialData}
          modelValue={formValues}
          onUpdate={handleUpdate}
          loading={loading}
        />
        {/* Submit button is OUTSIDE VForm, uses onClick */}
        <Group justify="flex-end" mt="xl">
          <Button variant="light" onClick={() => router.push("/items")}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            {itemId ? "Update" : "Create"}
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
```

## Collection-Based Form Pattern (auto-fetches fields)

When the collection schema is stored in DaaS (DaaS), VForm can fetch fields automatically:

```tsx
"use client";

import { useState, useCallback } from "react";
import { VForm } from "@/components/ui";
import type { FieldValues } from "@/components/ui/vform/types";

export default function CollectionEditor({
  collection,
  itemId,
}: {
  collection: string;
  itemId?: string;
}) {
  const [formValues, setFormValues] = useState<FieldValues>({});

  const handleUpdate = useCallback((values: FieldValues) => {
    setFormValues(values);
  }, []);

  return (
    <VForm
      collection={collection}
      primaryKey={itemId || "+"}
      modelValue={formValues}
      onUpdate={handleUpdate}
      enforcePermissions={true}
      action={itemId ? "update" : "create"}
    />
  );
}
```

## Alternative: CollectionForm (All-in-One)

If you need schema fetch + form + submission all handled automatically, use `CollectionForm` instead of VForm:

```tsx
import { CollectionForm } from "@/components/ui/collection-form";

// CollectionForm handles state, submission, and field rendering internally
<CollectionForm
  collection="articles"
  id={itemId}
  mode={itemId ? "edit" : "create"}
  onSuccess={(item) => router.push(`/articles/${item.id}`)}
  onCancel={() => router.back()}
/>;
```

## How VForm State Flow Works

```
User types/selects → Interface component onChange
  → FormField onChange → VForm handleFieldChange
    → VForm calls onUpdate({ ...modelValue, [field]: newValue })
      → Parent's setFormValues updates state
        → React re-renders → VForm receives new modelValue
          → Field shows updated value
```

Key: `onUpdate` receives a **delta object** containing ONLY fields the user has changed from `initialValues`. This is intentional — for PATCH requests you only send changed fields.

## Field Definition Structure

Fields passed to VForm should follow the DaaS `Field` type:

```tsx
const field = {
  field: "field_name", // Database column name (required)
  name: "Display Name", // Human-readable label
  type: "string", // Database type: string, text, integer, float, boolean, json, uuid, timestamp, etc.
  collection: "my_collection", // Optional: collection this field belongs to
  schema: {
    // Optional: database schema info
    is_nullable: true,
    default_value: null,
    max_length: 255,
    is_primary_key: false,
    has_auto_increment: false,
  },
  meta: {
    // Required: field metadata
    interface: "input", // Interface type (determines which component renders)
    required: false,
    readonly: false,
    hidden: false,
    width: "full", // 'full' | 'half' | 'half-left' | 'half-right' | 'fill'
    sort: 0, // Display order
    group: null, // Parent group field name
    note: "Help text", // Tooltip description
    options: {}, // Interface-specific options (e.g., choices for select-dropdown)
    special: [], // Special field types: ['uuid'], ['hash'], etc.
  },
};
```

## Available Interface Types

| `meta.interface`               | Component              | For                           |
| ------------------------------ | ---------------------- | ----------------------------- |
| `input`                        | Input                  | Text, number, UUID            |
| `input-multiline` / `textarea` | Textarea               | Multi-line text               |
| `input-code`                   | InputCode              | Code with syntax highlighting |
| `input-rich-text-html`         | RichTextHTML           | WYSIWYG HTML editor           |
| `input-rich-text-md`           | RichTextMarkdown       | Markdown editor               |
| `input-block-editor`           | InputBlockEditor       | Block-based editor            |
| `select-dropdown`              | SelectDropdown         | Single select from choices    |
| `select-radio`                 | SelectRadio            | Radio button group            |
| `select-multiple-checkbox`     | SelectMultipleCheckbox | Checkbox group                |
| `select-multiple-dropdown`     | SelectMultipleDropdown | Multi-select dropdown         |
| `boolean`                      | Boolean                | Checkbox boolean              |
| `toggle`                       | Toggle                 | Switch toggle                 |
| `datetime`                     | DateTime               | Date/time picker              |
| `slider`                       | Slider                 | Numeric range slider          |
| `tags`                         | Tags                   | Tag input                     |
| `file`                         | File                   | Single file upload            |
| `file-image`                   | FileImage              | Image upload with preview     |
| `files`                        | Files                  | Multiple file upload          |
| `list-m2o`                     | ListM2O                | Many-to-One relation          |
| `list-o2m`                     | ListO2M                | One-to-Many relation          |
| `list-m2m`                     | ListM2M                | Many-to-Many relation         |
| `list-m2a`                     | ListM2A                | Many-to-Any relation          |
| `presentation-divider`         | Divider                | Visual separator (no input)   |
| `presentation-notice`          | Notice                 | Alert/info notice (no input)  |
