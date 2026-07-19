---
name: React Components
description: React component patterns for the DaaS platform
applyTo: "components/**/*.{ts,tsx}"
---

# React Component Instructions

## 🔴 CRITICAL: Buildpad-First Rule

**STOP! Before creating ANY component, check if Buildpad provides it.**

Buildpad UI Packages provides 40+ production-ready components. You MUST use them when available.

### Before Creating a Component

1. **Check Buildpad first** - Query MCP or check the component list
2. **Use Buildpad CLI** - `pnpm cli add <component> --cwd /path/to/project`
3. **Only create custom if not available** - Document why Buildpad doesn't meet requirements

### Buildpad Component Categories

| Need This?           | Use Buildpad Component                                     |
| -------------------- | ---------------------------------------------------------- |
| Text input           | `Input`, `Textarea`, `InputCode`                           |
| Rich text            | `RichTextHtml`, `RichTextMarkdown`, `InputBlockEditor`     |
| Selection (single)   | `SelectDropdown`, `SelectRadio`                            |
| Selection (multiple) | `SelectMultipleCheckbox`, `SelectMultipleDropdown`, `Tags` |
| Boolean              | `Toggle`, `Boolean`                                        |
| Date/Time            | `DateTime`                                                 |
| File upload          | `FileInterface`, `FileImage`, `Files`, `Upload`            |
| Color picker         | `Color`                                                    |
| Map/Location         | `Map`, `MapWithRealMap`                                    |
| M2O relation         | `ListM2O` + `useRelationM2O` hooks                         |
| M2M relation         | `ListM2M` + `useRelationM2M` hooks                         |
| O2M relation         | `ListO2M` + `useRelationO2M` hooks                         |
| Dynamic forms        | `VForm`, `FormField`, `FormFieldInterface`                 |
| Collection CRUD      | `CollectionForm`, `CollectionList`                         |
| Listing records      | `CollectionList` (search, filter, pagination, permissions) |
| Collection filtering | `FilterPanel` (field-type-aware filter builder)            |
| Content navigation   | `ContentNavigation` + `useCollections` hook                |
| Content module shell | `ContentLayout` (sidebar + header + main area)             |
| Save actions menu    | `SaveOptions` (save & stay, save & add new, etc.)          |
| Workflow UI          | `WorkflowButton`                                           |
| Permissions UI       | `SystemPermissions`                                        |
| Layout               | `Divider`, `Notice`, `GroupDetail`                         |

### When Custom Components ARE Allowed

✅ **Allowed:**

- App-specific layouts (navigation, sidebars, headers)
- Custom dashboards and visualizations
- Specialized data displays not covered by Buildpad
- Extending Buildpad components with project-specific logic
- Composite components that combine multiple Buildpad components

❌ **NOT Allowed:**

- Recreating Input, Select, DatePicker, File upload components
- Custom relation selectors (use ListM2M/M2O/O2M)
- Custom form field wrappers (use VForm/FormField)
- Custom toggle/switch (use Toggle/Boolean)
- Custom table/list views for collection records (use `CollectionList`)
- Custom filter UI for collections (use `FilterPanel`)

### Violation Examples

```tsx
// ❌ WRONG: Creating custom text input
function CustomInput({ value, onChange, placeholder }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

// ✅ CORRECT: Use Buildpad Input
import { Input } from '@/components/ui/input';
<Input field="name" value={value} onChange={onChange} placeholder={placeholder} />

// ❌ WRONG: Creating custom file uploader
function FileUploader({ onUpload }) { ... }

// ✅ CORRECT: Use Buildpad Files
import { Files } from '@/components/ui/files';
import { useFiles } from '@/lib/buildpad/hooks';

// ❌ WRONG: Custom relation selector
function CategoryPicker({ categories, selected, onSelect }) { ... }

// ✅ CORRECT: Use Buildpad relation components
import { ListM2O } from '@/components/ui/list-m2o';
import { useRelationM2O, useRelationM2OItem } from '@/lib/buildpad/hooks';
```

---

## Component Structure

```tsx
"use client"; // Only if needed

import { useState } from "react";
import { Box, Text } from "@mantine/core";
import type { ComponentProps } from "./types";

interface MyComponentProps {
  /** The collection name */
  collection: string;
  /** Callback when item is selected */
  onSelect?: (id: string) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * MyComponent - Description of what it does
 *
 * @example
 * <MyComponent collection="products" onSelect={handleSelect} />
 */
export function MyComponent({
  collection,
  onSelect,
  className,
}: MyComponentProps) {
  const [value, setValue] = useState("");

  return (
    <Box className={className}>
      <Text>{collection}</Text>
    </Box>
  );
}

// Optional: Default export for lazy loading
export default MyComponent;
```

## Props Patterns

### Field Interface Props (Standard Pattern)

```tsx
interface FieldInterfaceProps {
  field: string; // Field name in collection
  value: any; // Current field value
  onChange: (value: any) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
}
```

### Collection Props

```tsx
interface CollectionComponentProps {
  collection: string;
  primaryKey?: string | number;
  mode?: "create" | "edit" | "view";
  onSuccess?: (data: AnyItem) => void;
  onCancel?: () => void;
}
```

## Mantine v8 Patterns

```tsx
import {
  TextInput,
  Button,
  Group,
  Stack,
  Modal,
  ActionIcon,
  Skeleton,
  Alert,
  Badge,
  Paper,
  Table,
  Tabs,
  ScrollArea,
  Card,
  Select,
  MultiSelect,
  Switch,
  Checkbox,
  Menu,
  Tooltip,
} from "@mantine/core";
import {
  useDisclosure,
  useDebouncedValue,
  useLocalStorage,
} from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconEdit,
  IconTrash,
  IconPlus,
  IconSearch,
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconRefresh,
} from "@tabler/icons-react";

// Buildpad UI Components (Copy & Own - from components/ui)
import {
  Input,
  SelectDropdown,
  DateTime,
  Toggle,
  Notice,
  Divider,
  CollectionForm,
  CollectionList,
  FilterPanel,
  ContentNavigation,
  ContentLayout,
  SaveOptions,
} from "@/components/ui";

// VForm Dynamic Form System (from components/ui via @buildpad/ui-form)
import { VForm, FormField, FormFieldLabel } from "@/components/ui";

// DaaS API Utilities (from lib/buildpad/services)
import {
  apiRequest,
  buildApiUrl,
  getApiHeaders,
  DaaSProvider,
  useDaaSContext,
  setGlobalDaaSConfig,
} from "@/lib/buildpad/services";

// Authentication & Permission Hooks (from lib/buildpad/hooks)
import {
  useAuth, // Authentication state (user, isAdmin, isAuthenticated)
  usePermissions, // Field-level and action-level permissions
  DaaSProvider, // Also exported from hooks for convenience
  useDaaSContext, // Access DaaS config in components
} from "@/lib/buildpad/hooks";

// Relation Hooks (from lib/buildpad/hooks)
import {
  useRelationM2M,
  useRelationM2MItems,
  useRelationM2O,
  useRelationM2OItem,
  useRelationO2M,
  useRelationO2MItems,
  useFiles,
  useSelection,
  useVersions,
  useWorkflowAssignment,
  useWorkflowVersioning,
  useCollections, // Collection hierarchy + navigation state
} from "@/lib/buildpad/hooks";

// Buildpad Services (from lib/buildpad/services)
import {
  ItemsService,
  FieldsService,
  CollectionsService,
  PermissionsService, // includes static `isAdmin` getter (true when /permissions/me returns isAdmin)
} from "@/lib/buildpad/services";
```

## Authentication & Permission Patterns

```tsx
// Using authentication hooks
import { useAuth, usePermissions } from "@/lib/buildpad/hooks";

function ProtectedEditor({ collection }: { collection: string }) {
  const { user, isAdmin, isAuthenticated, loading } = useAuth();
  const { canPerform, getAccessibleFields, isFieldAccessible } = usePermissions(
    {
      collections: [collection],
    },
  );

  if (loading) return <Skeleton />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!canPerform(collection, "update")) {
    return <Alert color="red">No permission to edit {collection}</Alert>;
  }

  const editableFields = getAccessibleFields(collection, "update");

  return (
    <VForm collection={collection} enforcePermissions={true} action="update" />
  );
}
```

## Buildpad Component Usage

```tsx
// Using Buildpad field interfaces
import { Input, SelectDropdown, DateTime, Toggle } from "@/components/ui";

function ProductForm({ product, onChange }) {
  return (
    <Stack>
      <Input
        field="title"
        value={product.title}
        onChange={(val) => onChange({ ...product, title: val })}
        label="Product Title"
        required
      />

      <SelectDropdown
        field="status"
        value={product.status}
        onChange={(val) => onChange({ ...product, status: val })}
        label="Status"
        choices={[
          { text: "Draft", value: "draft" },
          { text: "Published", value: "published" },
        ]}
      />

      <DateTime
        field="publish_date"
        value={product.publish_date}
        onChange={(val) => onChange({ ...product, publish_date: val })}
        label="Publish Date"
        type="datetime"
      />
    </Stack>
  );
}
```

## VForm Dynamic Form Usage

> **⚠️ CRITICAL**: VForm is a **controlled component**. It has NO `onSubmit` prop and renders a `<div>`, NOT a `<form>`.
> You MUST pass `modelValue` + `onUpdate` and handle submission externally.
> See [VForm usage reference](../../create-feature/references/vform-usage.instructions.md) for the complete pattern.

```tsx
// VForm auto-renders all fields based on collection schema
import { VForm } from '@/components/ui';
import type { FieldValues } from '@/components/ui/vform/types';

function ArticleEditor({ articleId }: { articleId?: string }) {
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState([]);

  return (
    <VForm
      collection="articles"
      primaryKey={articleId || '+'}  // '+' = create mode
      modelValue={values}
      onUpdate={setValues}
      validationErrors={errors}
    />
  );
}

// With permission enforcement
import { DaaSProvider } from '@/lib/buildpad/services';

function ProtectedForm({ articleId }: { articleId: string }) {
  const [values, setValues] = useState({});

  return (
    <DaaSProvider config={{ url: 'https://xxx.buildpad-daas.xtremax.com', token: 'xxx' }}>
      <VForm
        collection="articles"
        primaryKey={articleId}
        modelValue={values}
        onUpdate={setValues}
        enforcePermissions={true}
        action="update"  // 'create' | 'update' | 'read'
        onPermissionsLoaded={(fields) => console.log('Accessible fields:', fields)}
      />
    </DaaSProvider>
  );
}

// With initial values (edit mode)
<VForm
  collection="products"
  primaryKey={productId}
  initialValues={existingProduct}
  modelValue={changes}
  onUpdate={setChanges}
/>

// With explicit fields (no API call needed)
<VForm
  fields={customFields}
  modelValue={values}
  onUpdate={setValues}
/>
```

## DaaS Provider for Storybook/Testing

```tsx
// Wrap components for direct DaaS access (bypasses Next.js proxy)
import { DaaSProvider } from "@/lib/buildpad/services";

function StorybookWrapper({ children }) {
  return (
    <DaaSProvider
      config={{
        url: "https://xxx.buildpad-daas.xtremax.com",
        token: "static-token",
      }}
      onAuthenticated={(user) => console.log("Authenticated:", user)}
    >
      {children}
    </DaaSProvider>
  );
}

// In Next.js app (uses proxy routes - no config needed)
function AppWrapper({ children }) {
  return <DaaSProvider>{children}</DaaSProvider>;
}
```

## Content Module Pattern (ContentLayout + ContentNavigation)

The content module provides a complete DaaS-style data management UI.
Use `ContentLayout` + `ContentNavigation` + `useCollections` to build it.

### Content Layout (app/content/layout.tsx)

```tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { ContentLayout, ContentNavigation } from "@/components/ui";
import { useCollections } from "@/lib/buildpad/hooks";
import { useAuth } from "@/lib/buildpad/hooks";

export default function ContentModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Extract current collection from URL: /content/[collection]/...
  const currentCollection = pathname.split("/")[2] || undefined;

  const {
    rootCollections,
    activeGroups,
    toggleGroup,
    showHidden,
    setShowHidden,
    hasHiddenCollections,
    showSearch,
    dense,
    loading,
  } = useCollections({ currentCollection });

  const { isAdmin } = useAuth();

  return (
    <ContentLayout
      sidebar={
        <ContentNavigation
          rootCollections={rootCollections}
          activeGroups={activeGroups}
          onToggleGroup={toggleGroup}
          currentCollection={currentCollection}
          onNavigate={(col) => router.push(`/content/${col}`)}
          showHidden={showHidden}
          onToggleHidden={() => setShowHidden(!showHidden)}
          hasHiddenCollections={hasHiddenCollections}
          showSearch={showSearch}
          dense={dense}
          loading={loading}
          isAdmin={isAdmin}
        />
      }
    >
      {children}
    </ContentLayout>
  );
}
```

### Collection List Page (app/content/[collection]/page.tsx)

Every page that renders a list of records MUST use `CollectionList`.
CollectionList provides an integrated toolbar, FilterPanel, permission-gated
create/delete actions, and DaaS-style pagination out of the box.
CRUD permissions are auto-fetched — do not manually gate buttons or pass permission state.

```tsx
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
      enableAddField
      limit={25}
      tableSpacing="cozy"
      onCreate={() => router.push(`/content/${collection}/+`)}
      onItemClick={(item) => router.push(`/content/${collection}/${item.id}`)}
    />
  );
}
```

### Item Edit Page (app/content/[collection]/[id]/page.tsx)

> **IMPORTANT**: Always use `isNewItem()` from `@/lib/buildpad/utils` (exported by `@buildpad/utils`) to detect new items. Never write inline `id === "+"` checks — the utility also handles the URL-encoded `%2B` variant that Next.js may produce in dynamic route segments.

```tsx
"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { CollectionForm } from "@/components/ui";
import { isNewItem } from "@/lib/buildpad/utils";

export default function ItemPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = use(params);
  const router = useRouter();
  const isNew = isNewItem(id);

  return (
    <CollectionForm
      collection={collection}
      id={isNew ? undefined : id}
      mode={isNew ? "create" : "edit"}
      onSuccess={() => router.push(`/content/${collection}`)}
      onCancel={() => router.back()}
    />
  );
}
```

## Two-Tier Testing Strategy

Buildpad uses a two-tier testing approach:

| Tier       | Type            | Description                                   |
| ---------- | --------------- | --------------------------------------------- |
| **Tier 1** | Storybook Tests | Isolated, no auth, with Vite proxy            |
| **Tier 2** | DaaS E2E Tests  | Real API, auth required, permissions enforced |

```bash
# Tier 1: Storybook Tests
pnpm storybook:form                    # Start VForm Storybook
pnpm test:storybook                    # Run Playwright against Storybook

# Tier 2: DaaS E2E Tests
pnpm test:e2e                          # Run against hosted DaaS
pnpm test:e2e:ui                       # Interactive Playwright UI
```

// Modal with disclosure hook
const [opened, { open, close }] = useDisclosure(false);

// Debounced search
const [search, setSearch] = useState('');
const [debouncedSearch] = useDebouncedValue(search, 300);

// Confirmation modal
const openDeleteModal = () => modals.openConfirmModal({
title: 'Delete item',
children: <Text size="sm">Are you sure you want to delete this item?</Text>,
labels: { confirm: 'Delete', cancel: 'Cancel' },
confirmProps: { color: 'red' },
onConfirm: () => handleDelete(),
});

// Notifications
notifications.show({
title: 'Success',
message: 'Item saved successfully',
color: 'green',
icon: <IconCheck size={16} />,
});

````

## Event Handlers

```tsx
// Form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await saveItem(formData);
    notifications.show({ title: 'Saved', message: 'Item saved' });
    onSuccess?.(formData);
  } catch (error) {
    notifications.show({
      title: 'Error',
      message: error instanceof Error ? error.message : 'Failed to save',
      color: 'red',
    });
  }
};

// Click with async handling
const handleDelete = async () => {
  if (!confirm('Are you sure?')) return;
  await deleteItem(id);
};
````

## Conditional Rendering

```tsx
// Loading states
if (isLoading) return <Skeleton height={100} />;
if (error) return <Alert color="red">{error.message}</Alert>;
if (!data) return null;

// Conditional elements
{
  showHeader && <Header />;
}
{
  items.length > 0 ? (
    <ItemList items={items} />
  ) : (
    <EmptyState message="No items found" />
  );
}
```

## Forwarding Refs

```tsx
import { forwardRef } from "react";

interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, ...props }, ref) => (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} {...props} />
    </div>
  ),
);

Input.displayName = "Input";
```

## Testing

```tsx
// Component.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent collection="products" />);
    expect(screen.getByText("products")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<MyComponent collection="products" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });
});
```
