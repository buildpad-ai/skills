---
name: create-collection
description: Generate a complete collection with database migration, API routes, UI pages (list + form), TypeScript types, and tests. Creates everything needed for a new data entity in a DaaS application. Use when the user wants to add a new collection, table, entity, or data model to the project.
argument-hint: "[collection name] [fields as name:type pairs]"
---

# Create Collection

Generate a complete collection module with API routes, UI pages, database migration, and tests.

> **BEFORE generating ANY `.tsx` files** (list pages, form pages, components), you MUST `read_file` the Buildpad component reference at `.github/skills/buildpad-reference/SKILL.md`. This loads the full 40+ component catalog with import paths and usage patterns. Skipping this step leads to raw Mantine usage violations.

## What Gets Created

1. **Database Migration** — `supabase/migrations/[timestamp]_create_[name].sql`
2. **API Routes** — `app/api/items/[name]/route.ts` + `[id]/route.ts`
3. **Content Module Pages** — `app/content/[name]/page.tsx` (list) + `[id]/page.tsx` (form)
4. **Form** — Uses `CollectionForm` from Buildpad (NOT custom)
5. **Layout** — Uses `ContentLayout` + `ContentNavigation` from Buildpad
6. **API Tests** — `tests/api/[name].spec.ts`
7. **Page Tests** — `tests/pages/[name].spec.ts`

## Field Type Mapping

| Field Type         | DB Column       | Buildpad Component  |
| ------------------ | --------------- | ------------------- |
| `text`             | text            | Input               |
| `number`           | integer/numeric | Input (type=number) |
| `boolean`          | boolean         | Toggle              |
| `date`             | timestamptz     | DateTime            |
| `select`           | text + CHECK    | SelectDropdown      |
| `richtext`         | text            | RichTextHtml        |
| `file`             | uuid FK         | FileImage           |
| `m2o:[collection]` | uuid FK         | ListM2O             |
| `m2m:[collection]` | junction table  | ListM2M             |

## Standard Field Groups — Decision Tree

Before creating any collection, determine which field groups to include:

```
For EVERY new collection:
├── 1. ALWAYS add Group A (Audit Fields)
│     → user_created, date_created, user_updated, date_updated
│
├── 2. Does this collection need a state machine / approval workflow?
│     ├── YES → Add Group B (Workflow Fields) + invoke create-workflow skill after
│     └── NO  → Skip Group B
│
└── 3. Does this collection need multi-tenancy / scope isolation?
      ├── YES → Add Group C (Scope Field) + invoke manage-scope skill after
      └── NO  → Skip Group C
```

> **🔴 CRITICAL: Group A is NOT optional.** Every collection must have audit fields. The DaaS platform does NOT auto-add them — you must include them in every `mcp_daas_collections` create or `mcp_daas_fields` create call.

See [Standard Collection Fields reference](references/standard-fields.instructions.md) for copy-pasteable MCP JSON payloads for all three groups.

### Group A: Audit Fields (ALWAYS include)

| Field          | Type      | Special Attribute | Purpose                            |
| -------------- | --------- | ----------------- | ---------------------------------- |
| `user_created` | uuid      | `user-created`    | Auto-set to current user on create |
| `date_created` | timestamp | `date-created`    | Auto-set to current time on create |
| `user_updated` | uuid      | `user-updated`    | Auto-set to current user on update |
| `date_updated` | timestamp | `date-updated`    | Auto-set to current time on update |

### Group B: Workflow Fields (include when collection uses workflows)

| Field               | Type   | Required Meta                                               | Purpose                         |
| ------------------- | ------ | ----------------------------------------------------------- | ------------------------------- |
| `workflow_instance` | uuid   | `special: ["m2o"]`, `foreign_key_table: "daas_wf_instance"` | Links item to workflow instance |
| `workflow_state`    | string | `interface: "xtr-interface-workflow"`                       | Stores current workflow state   |

In addition to the MCP field create, add the columns to the local Supabase migration so the database mirrors DaaS:

```sql
alter table public.<collection>
    add column if not exists workflow_instance uuid null references daas_wf_instance(id) on delete set null,
    add column if not exists workflow_state    text null;
create index if not exists idx_<collection>_workflow_instance on public.<collection> (workflow_instance);
```

After adding Group B fields, proceed to the **`create-workflow` skill** to define workflow definition, assignment, and UI integration.

### Group C: Multi-Tenancy Field (include when collection is scoped)

| Field          | Type | Required Meta                                                               | Purpose            |
| -------------- | ---- | --------------------------------------------------------------------------- | ------------------ |
| `resource_uri` | text | `special: ["m2o"]`, `foreign_key_table: "daas_scope_items"`, FK on uri_path | Scope partitioning |

After adding Group C field, proceed to the **`manage-scope` skill** to register the collection in scope config.

## Standard Columns — SQL Migration (when using migration approach)

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
date_created timestamptz DEFAULT now(),
date_updated timestamptz,
user_created uuid REFERENCES auth.users(id),
user_updated uuid REFERENCES auth.users(id)
```

> **⚠️ Verify Actual Field Names:** The standard column names above (`date_created`, `date_updated`, etc.) are conventions for new migrations. Existing DaaS collections may use different names (e.g., `created_at`, `updated_at`). **Always check the actual schema** via `mcp_daas_schema` or `mcp_daas_fields` before writing queries. Using a wrong field name in `sort` or `filter` causes a silent **500 error** from the DaaS backend.

## API Response Format

```typescript
// Success
{ data: Item | Item[] }
{ data: Item[], meta: { total_count, filter_count } }

// Aggregate (no pagination meta)
{ data: [{ count: { id: 42 }, sum: { amount: 12500 } }] }

// Error
{ errors: [{ message: string, extensions?: { code: string } }] }
```

## Using CollectionForm (preferred for forms)

```tsx
import { CollectionForm } from '@/components/ui/collection-form';

// Create mode
<CollectionForm collection="products" onSuccess={(data) => console.log('Saved:', data)} />

// Edit mode
<CollectionForm collection="products" id={itemId} mode="edit" />
```

## Using CollectionList for ALL Listing Views (MANDATORY)

Every page that renders a list of collection records **MUST** use `CollectionList`. This ensures consistent search, filtering, pagination, permissions, and bulk-action behavior across the entire application.

### CollectionList Props Reference

| Prop                  | Type                                   | Default  | Description                                                     |
| --------------------- | -------------------------------------- | -------- | --------------------------------------------------------------- |
| `collection`          | `string`                               | —        | Collection name (required)                                      |
| `enableSearch`        | `boolean`                              | `true`   | Search bar in toolbar                                           |
| `enableFilter`        | `boolean`                              | `false`  | Inline FilterPanel toggle with active-count badge               |
| `enableSelection`     | `boolean`                              | `false`  | Row selection checkboxes                                        |
| `enableCreate`        | `boolean`                              | `false`  | Create (+) button in toolbar                                    |
| `enableSort`          | `boolean`                              | `true`   | Column sorting                                                  |
| `enableResize`        | `boolean`                              | `true`   | Column resize                                                   |
| `enableReorder`       | `boolean`                              | `true`   | Column drag-and-drop reorder                                    |
| `enableHeaderMenu`    | `boolean`                              | `true`   | Right-click column header menu                                  |
| `enableAddField`      | `boolean`                              | `true`   | Inline "+" button for adding columns                            |
| `enableDelete`        | `boolean`                              | `false`  | Built-in delete with confirmation modal                         |
| `limit`               | `number`                               | `25`     | Items per page (10, 25, 50, 100)                                |
| `tableSpacing`        | `"compact" \| "cozy" \| "comfortable"` | `"cozy"` | Row density                                                     |
| `filter`              | `Record<string, unknown>`              | —        | External DaaS-style filter object                               |
| `archiveField`        | `string`                               | —        | Enable archive filter UI (e.g. `"status"`)                      |
| `archiveValue`        | `string`                               | —        | Value marking items as archived (e.g. `"archived"`)             |
| `unarchiveValue`      | `string`                               | —        | Value marking items as unarchived (e.g. `"draft"`)              |
| `bulkActions`         | `BulkAction[]`                         | `[]`     | Bulk action buttons (permission-gated via `requiredPermission`) |
| `onItemClick`         | `(item) => void`                       | —        | Row click handler (navigate to detail)                          |
| `onCreate`            | `() => void`                           | —        | Create button click handler                                     |
| `onFilterChange`      | `(filter) => void`                     | —        | Filter change callback                                          |
| `onPermissionsLoaded` | `(perms) => void`                      | —        | Permission state callback                                       |
| `onDeleteSuccess`     | `() => void`                           | —        | Callback after successful bulk delete                           |

### Standard List Page Pattern (use for EVERY collection)

```tsx
// app/content/[collection]/page.tsx — collection list view
"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { CollectionList } from "@/components/ui";

export default function CollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = use(params);
  const router = useRouter();

  return (
    <CollectionList
      collection={collection}
      enableSearch
      enableFilter
      enableSelection
      enableCreate
      enableDelete
      enableSort
      enableResize
      enableReorder
      enableHeaderMenu
      limit={25}
      onCreate={() => router.push(`/content/${collection}/+`)}
      onItemClick={(item) => router.push(`/content/${collection}/${item.id}`)}
    />
  );
}
```

### Content Module Layout

```tsx
// app/content/layout.tsx — shared layout with sidebar navigation
import { ContentLayout, ContentNavigation } from "@/components/ui";
import { useCollections } from "@/lib/buildpad/hooks";

// app/content/[collection]/[id]/page.tsx — item form view
import { CollectionForm } from "@/components/ui";
import { isNewItem } from "@/lib/buildpad/utils"; // ALWAYS use isNewItem() for new-item detection
```

See `buildpad-reference` skill for full content module pattern.

## Testing Requirements

All tests MUST pass before the collection is considered complete:

- GET list with pagination
- GET single item by ID
- POST create with validation
- PATCH update with validation
- DELETE item
- Page renders correctly
- Navigation between list and detail

## Post-Generation Validation (MANDATORY)

After generating ALL files for this collection, run the Buildpad-First violation check:

```bash
# Scan generated files for forbidden raw Mantine form/input imports
grep -rn "from '@mantine/form'\|from '@mantine/dates'\|from '@mantine/dropzone'\|<TextInput\|<NumberInput\|<Select \|<Switch \|<Checkbox \|<DatePicker\|<Dropzone" app/ components/ 2>/dev/null
```

**If any matches are found, replace them with Buildpad equivalents before proceeding.**

Quick fix reference:
| Violation | Replace With |
|---|---|
| `<TextInput>` / `<Textarea>` | `Input` / `Textarea` from `@/components/ui` |
| `<Select>` | `SelectDropdown` from `@/components/ui` |
| `<DatePicker>` | `DateTime` from `@/components/ui` |
| `<Switch>` / `<Checkbox>` | `Toggle` / `Boolean` / `SelectMultipleCheckbox` |
| `<Dropzone>` | `Upload` / `Files` from `@/components/ui` |
| `useForm` (@mantine/form) | `VForm` or `CollectionForm` from `@/components/ui` |
| Custom `<Table>` for records | `CollectionList` from `@/components/ui` |

## Scope (Multi-Tenancy) — Adding `resource_uri` to a Collection

If this collection needs to be partitioned by tenant/organization/region, add scope support via `/manage-scope` skill. When enabling scope on a collection:

1. **Add `resource_uri` column with FK constraint:**

```sql
ALTER TABLE public.<collection>
    ADD COLUMN IF NOT EXISTS resource_uri TEXT DEFAULT NULL
    REFERENCES public.daas_scope_items(uri_path) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_<collection>_resource_uri ON public.<collection>(resource_uri);
```

> **FK constraint is required** — it prevents orphaned values and enables M2O nesting (`?fields=resource_uri.name`). Without it, scope item deletions become unsafe.

2. **Register collection in scope config:**

Use `/manage-scope` skill's **Step 4** to register the collection with `field_name: "resource_uri"` and set `inheritance_mode` (exact vs down).

3. **API behavior:**
   - Requests include `X-Resource-Uri` header or `daas_resource_uri` cookie
   - Reads filtered to matching scope items
   - Creates auto-tag items with the active scope
   - Updates/deletes only allowed on items within the active scope

## Post-Creation — Next Steps

After creating the collection with its standard fields:

1. **If Group B (Workflow) fields were included** → Invoke the `create-workflow` skill to define the workflow definition, assignment, and add `WorkflowButton` to the item form UI
2. **If Group C (Scope) fields were included** → Invoke the `manage-scope` skill to register the collection in scope config
3. **Audit logging is automatic** — DaaS logs all item create/update/delete operations to `daas_activity`. Do NOT build custom audit trail code. Query audit data via `GET /api/activity?collection=your_collection`

## References

- [Standard Collection Fields](references/standard-fields.instructions.md) — canonical MCP JSON payloads for audit, workflow, and scope fields
- [API route patterns](../create-api-route/references/api-routes.instructions.md)
- [Workflow setup](/create-workflow) — define workflow definitions, assignments, and UI after adding Group B fields
- [Multi-Tenancy Scope Setup](/manage-scope) — register scope config after adding Group C field
- [Built-in DaaS features](../daas-platform/references/builtin-features.instructions.md) — features you must NOT rebuild
