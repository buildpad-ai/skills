---
name: Buildpad Components
description: Instructions for using Buildpad Copy & Own components distributed via CLI, including VForm dynamic forms and DaaS integration
applyTo: "lib/buildpad/**/*.{ts,tsx}"
---

# Buildpad Component Instructions

## � Documentation Reference

For detailed information, refer to the **buildpad-ui** documentation:

| Document                             | Description                                         |
| ------------------------------------ | --------------------------------------------------- |
| `buildpad-ui/docs/CLI.md`            | CLI commands, component locations, dependency trees |
| `buildpad-ui/docs/COMPONENT_MAP.md`  | Quick component lookup table                        |
| `buildpad-ui/docs/ARCHITECTURE.md`   | System architecture diagrams                        |
| `buildpad-ui/docs/TESTING.md`        | Playwright E2E testing guide                        |
| `buildpad-ui/docs/DISTRIBUTION.md`   | Distribution methods and security                   |
| `buildpad-ui/docs/DESIGN_SYSTEM.md`  | Token-based theming architecture                    |
| `buildpad-ui/docs/PUBLISHING.md`     | npm publishing & release workflow                   |
| `buildpad-ui/packages/registry.json` | Master registry with all component metadata         |

---

## �🔴 CRITICAL: Buildpad-First Rule (MANDATORY)

**ALL UI components, hooks, and services MUST use Buildpad UI Packages first.**

### The Rule

| Scenario                     | Action                                                   |
| ---------------------------- | -------------------------------------------------------- |
| Buildpad has the component   | ✅ **MUST USE** Buildpad via CLI                         |
| Buildpad doesn't have it     | ⚠️ Create custom, document why, follow Buildpad patterns |
| Extending Buildpad component | ✅ Allowed - import and wrap/extend                      |

### Before Creating ANY Component

```
STOP! ➔ Check Buildpad ➔ Available? ➔ Use CLI to add it
                                ↓
                           Not available?
                                ↓
                   Create custom + document reason
```

### Quick Reference: What Buildpad Provides

- **40+ UI Components**: Input, Select, DateTime, Files, Relations, Layout, etc.
- **12+ React Hooks**: useRelationM2M/M2O/O2M/M2A, useFiles, useVersions, etc.
- **Services**: ItemsService, FieldsService, CollectionsService, apiRequest
- **Types**: Field, Collection, Relation, File, and 30+ other types
- **VForm**: Dynamic form system with 40+ interface types

### Violation = Code Review Rejection

Creating custom components that duplicate Buildpad functionality will be flagged during code review and must be refactored.

---

## Distribution Model: Copy & Own

Buildpad components use a **Copy & Own** distribution model — source code is copied into your project via the CLI, not consumed as runtime npm dependencies. This gives you full ownership and customization.

**npm-published tools:**

- `@buildpad/cli` — `npx @buildpad/cli@latest add <component>`
- `@buildpad/mcp` — `npx @buildpad/mcp@latest` (for VS Code MCP server)

### Prerequisites

Before adding components, ensure required tools are installed:

```bash
node --version && pnpm --version && npx --version
```

If any tool is missing, install based on OS:

- **Node.js** (v24 LTS): macOS: `brew install node@24`; Linux: `fnm install 24`; Windows: https://nodejs.org/en/download or `winget install OpenJS.NodeJS.LTS`
- **pnpm** (v10+): All OS: `corepack enable && corepack prepare pnpm@latest --activate` (see https://pnpm.io/installation)
- **npx**: Comes bundled with Node.js — reinstall Node if missing

See [prerequisites.instructions.md](../../create-project/references/prerequisites.instructions.md) for full OS-specific details.

Then choose one approach:

**Option A: Use npx (Recommended — no local clone needed)**

```bash
npx @buildpad/cli@latest bootstrap --cwd /path/to/your-project
```

**Option B: Use local clone (Development)**

1. Clone `buildpad-ui` repository locally
2. Build the packages: `cd buildpad-ui && pnpm install && pnpm build`

## Adding Components

CLI commands can be run via npx or from the local `buildpad-ui` directory:

```bash
# Via npx (recommended)
npx @buildpad/cli@latest init --cwd /path/to/your-project
npx @buildpad/cli@latest add input select-dropdown datetime --cwd /path/to/your-project
npx @buildpad/cli@latest add --category selection --cwd /path/to/your-project
npx @buildpad/cli@latest add --all --cwd /path/to/your-project
npx @buildpad/cli@latest list
npx @buildpad/cli@latest status --cwd /path/to/your-project
npx @buildpad/cli@latest diff input --cwd /path/to/your-project
npx @buildpad/cli@latest validate --cwd /path/to/your-project
npx @buildpad/cli@latest fix --cwd /path/to/your-project
npx @buildpad/cli@latest outdated --cwd /path/to/your-project

# Via local clone
cd /path/to/buildpad-ui
pnpm cli init --cwd /path/to/your-project
pnpm cli add input select-dropdown datetime --cwd /path/to/your-project
pnpm cli add --category selection --cwd /path/to/your-project
pnpm cli add --all --cwd /path/to/your-project
pnpm cli list
pnpm cli status --cwd /path/to/your-project
pnpm cli diff input --cwd /path/to/your-project
pnpm cli validate --cwd /path/to/your-project
pnpm cli fix --cwd /path/to/your-project
pnpm cli outdated --cwd /path/to/your-project
```

### New CLI Commands

| Command              | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `buildpad fix`       | Auto-fix common issues (untransformed imports, broken paths, missing CSS, SSR issues, duplicate exports) |
| `buildpad outdated`  | Check which installed components have newer versions available                                           |
| `buildpad validate`  | Check for untransformed imports, missing files, SSR problems                                             |
| `buildpad bootstrap` | Full setup: init + add --all + install deps + validate                                                   |

## Project Structure After Installation

Components are copied to your project with this structure:

```
your-project/
├── components/ui/          # Copied UI components
│   ├── input.tsx
│   ├── select-dropdown.tsx
│   ├── datetime.tsx
│   └── ...
├── lib/buildpad/         # Shared libs (auto-installed as dependencies)
│   ├── utils.ts            # cn() and other utilities
│   ├── types/              # TypeScript type definitions
│   │   ├── core.ts
│   │   ├── file.ts
│   │   └── relations.ts
│   ├── services/           # CRUD service classes + DaaS API utilities
│   │   ├── items.ts
│   │   ├── fields.ts
│   │   ├── collections.ts
│   │   ├── permissions.ts
│   │   ├── api-request.ts     # apiRequest, buildApiUrl, getApiHeaders
│   │   └── daas-provider.tsx  # DaaSProvider, useDaaSContext
│   ├── hooks/              # React hooks
│   │   ├── useAuth.ts             # Authentication state
│   │   ├── usePermissions.ts      # Permission checking
│   │   ├── useRelationM2M.ts
│   │   ├── useRelationM2O.ts
│   │   ├── useRelationO2M.ts
│   │   ├── useRelationM2A.ts
│   │   ├── useFiles.ts
│   │   ├── useSelection.ts
│   │   ├── usePreset.ts
│   │   ├── useEditsGuard.ts
│   │   ├── useClipboard.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useVersions.ts
│   │   ├── useWorkflowAssignment.ts
│   │   └── useWorkflowVersioning.ts
│   └── ui-form/            # VForm dynamic form system
│       ├── VForm.tsx
│       ├── FormField.tsx
│       ├── FormFieldLabel.tsx
│       └── FormFieldInterface.tsx
└── buildpad.json         # Tracks installed components
```

## Import Transformation

The CLI automatically transforms imports from package format to local paths:

```tsx
// Original (in buildpad-ui source)
import { useRelationM2M } from "@buildpad/hooks";
import type { M2MItem } from "@buildpad/types";
import { ItemsService } from "@buildpad/services";

// Transformed (in your project after CLI copy)
import { useRelationM2M } from "@/lib/buildpad/hooks";
import type { M2MItem } from "@/lib/buildpad/types";
import { ItemsService } from "@/lib/buildpad/services";
```

### Import Transformation Troubleshooting

If you see `Module not found: Can't resolve '@buildpad/*'` errors, the transformation may have missed some files.

**Solution 1:** Reinstall with overwrite:

```bash
pnpm cli add --all --overwrite --cwd /path/to/project
```

**Solution 2:** Find and fix manually:

```bash
# Find untransformed imports
grep -r "from '@buildpad/" components/ lib/

# Common patterns to fix:
# @buildpad/services → @/lib/buildpad/services
# @buildpad/hooks → @/lib/buildpad/hooks
# @buildpad/types → @/lib/buildpad/types
# @buildpad/ui-form → @/lib/buildpad/ui-form
```

## Post-CLI Required Dependencies

**CRITICAL:** If you used `pnpm cli bootstrap`, ALL dependencies are installed automatically — skip this section.

If you used `pnpm cli add` (without bootstrap), the CLI copies components but does NOT install npm dependencies. You MUST install:

```bash
# Core utilities (ALWAYS REQUIRED)
pnpm add clsx tailwind-merge

# For --all installation, run this single command:
pnpm add clsx tailwind-merge @mantine/dates @mantine/dropzone @mantine/tiptap dayjs @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-subscript @tiptap/extension-superscript @tiptap/extension-text-align @tiptap/extension-underline @tiptap/extension-code-block-lowlight lowlight @editorjs/editorjs @editorjs/header @editorjs/nested-list @editorjs/paragraph @editorjs/code @editorjs/quote @editorjs/checklist @editorjs/delimiter @editorjs/table @editorjs/underline @editorjs/inline-code
```

## Available Components

### By Category

**Input Components:**

- `input` - Single-line text input with validation
- `textarea` - Multi-line text input
- `input-code` - Code editor with syntax highlighting
- `tags` - Tag input with presets and custom tags
- `rich-text-html` - WYSIWYG HTML editor (requires @tiptap packages)
- `rich-text-markdown` - Markdown editor with preview
- `input-block-editor` - Block-based editor (Notion-style, requires @editorjs packages)

**Selection Components:**

- `select-dropdown` - Dropdown select with search
- `select-radio` - Radio button selection
- `select-multiple-checkbox` - Checkbox group
- `select-multiple-checkbox-tree` - Tree-based hierarchical multi-select
- `select-multiple-dropdown` - Dropdown multi-select with search
- `select-icon` - Icon picker with Tabler icons
- `autocomplete-api` - External API-backed autocomplete
- `collection-item-dropdown` - Collection item selector

**Boolean Components:**

- `boolean` - Switch toggle
- `toggle` - Enhanced toggle with icons and labels

**DateTime Components:**

- `datetime` - Date/time picker
- `slider` - Range slider with numeric support

**File Components:**

- `file` - Single file upload (requires onUpload prop)
- `file-image` - Image picker with preview and focal point
- `files` - Multiple file upload with drag & drop
- `upload` - Drag-and-drop file upload zone

**Media Components:**

- `color` - Color picker with RGB/HSL, presets, opacity
- `map` - Interactive map for coordinates
- `map-with-real-map` - Full MapLibre GL JS map with drawing

**Relational Components:**

- `list-m2m` - Many-to-Many list with hooks integration
- `list-m2o` - Many-to-One selector with hooks integration
- `list-o2m` - One-to-Many list with hooks integration
- `list-m2a` - Many-to-Any (polymorphic) with hooks integration

**Layout Components:**

- `divider` - Horizontal/vertical divider with title
- `notice` - Alert/notice (info, success, warning, danger)
- `group-detail` - Collapsible form section

**System Components:**

- `system-permissions` - Permissions management interface with collection-based CRUD permission toggles for policy editing (full/custom/none access levels)

**Collection Components:**

- `collection-form` - Dynamic form based on collection schema
- `collection-list` - Dynamic list/table with search, FilterPanel, permission-gated create/delete, pagination (25/50/100/250), and bulk actions
- `filter-panel` - Field-type-aware filter builder producing DaaS-compatible JSON

**VForm Components (Dynamic Form System):**

- `vform` - Main dynamic form component that renders fields based on collection schema
- `form-field` - Individual field wrapper with label, validation, and interface rendering
- `form-field-label` - Label component with required indicator and tooltip
- `form-field-interface` - Dynamic interface component loader (40+ interface types)

**VTable Components (Dynamic Table System):**

- `vtable` - Dynamic table with sorting, selection, drag-drop reorder, and DaaS Playground
- `form-field` - Individual field wrapper with label, validation, and interface rendering
- `form-field-label` - Label component with required indicator and tooltip
- `form-field-interface` - Dynamic interface component loader (40+ interface types)

**Workflow Components:**

- `workflow-button` - State transition buttons with policy-based commands

## VForm Dynamic Form Component

VForm is a DaaS-inspired dynamic form system that automatically renders fields based on collection schema.

### Basic Usage

```tsx
import { VForm } from "@/lib/buildpad/ui-form";

function ArticleForm() {
  const [values, setValues] = useState({});

  return (
    <VForm
      collection="articles"
      modelValue={values}
      onUpdate={setValues}
      primaryKey="+" // '+' for create mode, item ID for edit
    />
  );
}
```

### With Validation Errors

```tsx
<VForm
  collection="articles"
  modelValue={values}
  onUpdate={setValues}
  validationErrors={[
    { field: "title", type: "required", message: "Title is required" },
    { field: "email", type: "email", message: "Invalid email format" },
  ]}
/>
```

### With Explicit Fields (No API Call)

```tsx
<VForm
  fields={myFieldsArray}
  modelValue={values}
  onUpdate={setValues}
  primaryKey="existing-id"
/>
```

### VForm Features

- 🎯 Dynamic field rendering based on schema (40+ interface types)
- 🔐 Permission enforcement (filter fields by user permissions)
- ✅ Validation error display with field-level messages
- 📱 Responsive grid layout (full, half, fill widths)
- 🔄 Change tracking and dirty state management
- 📊 Field groups and hierarchical organization
- 🎭 Create vs Edit mode with proper state handling
- 🔒 Read-only and disabled field support

### VForm with Permission Enforcement

VForm can filter fields based on user permissions, following the DaaS security architecture:

```tsx
import { VForm } from "@/lib/buildpad/ui-form";
import { DaaSProvider } from "@/lib/buildpad/services";

function ProtectedForm() {
  const [values, setValues] = useState({});

  return (
    <DaaSProvider
      config={{ url: "https://xxx.buildpad-daas.xtremax.com", token: "xxx" }}
    >
      <VForm
        collection="articles"
        modelValue={values}
        onUpdate={setValues}
        enforcePermissions={true}
        action="update" // 'create' | 'update' | 'read'
        onPermissionsLoaded={(fields) =>
          console.log("Accessible fields:", fields)
        }
      />
    </DaaSProvider>
  );
}
```

**Permission Enforcement Props:**

| Prop                  | Type                             | Default | Description                                    |
| --------------------- | -------------------------------- | ------- | ---------------------------------------------- |
| `enforcePermissions`  | `boolean`                        | `false` | Enable permission-based field filtering        |
| `action`              | `'create' \| 'update' \| 'read'` | auto    | Form action for permission filtering           |
| `onPermissionsLoaded` | `(fields: string[]) => void`     | -       | Callback when accessible fields are determined |

---

## 📋 Component Props Reference

### VForm Props (Complete Reference)

```tsx
interface VFormProps {
  /** Collection name to load fields from */
  collection?: string;
  /** Explicit field definitions (overrides collection) */
  fields?: Field[];
  /** Current form values (edited fields only) */
  modelValue?: FieldValues;
  /** Initial/default values */
  initialValues?: FieldValues;
  /** Update handler for form values */
  onUpdate?: (values: FieldValues) => void;
  /** Primary key value: '+' for create, existing ID for edit */
  primaryKey?: string | number;
  /** Disable all fields */
  disabled?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Validation errors */
  validationErrors?: ValidationError[];
  /** Auto-focus first editable field */
  autofocus?: boolean;
  /** Show only fields in this group */
  group?: string | null;
  /** Fields to exclude from rendering */
  excludeFields?: string[];
  /** CSS class name */
  className?: string;
  /** Form action for permission filtering */
  action?: "create" | "read" | "update";
  /** Enable permission-based field filtering */
  enforcePermissions?: boolean;
  /** Callback when permissions are loaded */
  onPermissionsLoaded?: (accessibleFields: string[]) => void;
}
```

### CollectionForm Props (CRUD Wrapper)

⚠️ **Important:** CollectionForm uses different prop names than VForm!

```tsx
interface CollectionFormProps {
  /** Collection name - REQUIRED */
  collection: string;
  /** Item ID for edit mode (NOT primaryKey!) */
  id?: string | number;
  /** Mode: 'create' or 'edit' (NOT based on primaryKey!) */
  mode?: "create" | "edit";
  /** Default values for new items */
  defaultValues?: Record<string, unknown>;
  /** Callback on successful save (NOT onSaved!) */
  onSuccess?: (data?: Record<string, unknown>) => void;
  /** Callback on cancel */
  onCancel?: () => void;
  /** Fields to exclude from form */
  excludeFields?: string[];
  /** Fields to show (if set, only these fields are shown) */
  includeFields?: string[];
}
```

**Common Mistakes:**

```tsx
// ❌ WRONG - using VForm props on CollectionForm
<CollectionForm
  collection="articles"
  primaryKey="123"      // ❌ Wrong! Use 'id'
  onSaved={handleSave}  // ❌ Wrong! Use 'onSuccess'
/>

// ✅ CORRECT
<CollectionForm
  collection="articles"
  id="123"
  mode="edit"
  onSuccess={handleSave}
  onCancel={() => router.back()}
/>
```

### Field Interface Props (Standard Pattern)

All field interface components follow this base pattern:

```tsx
interface FieldInterfaceProps {
  field: string; // Field name
  value: any; // Current field value
  onChange: (value: any) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
}
```

---

## Authentication Hooks

Buildpad provides authentication and permission hooks that follow the DaaS architecture:

### useAuth Hook

Get authentication state and methods:

```tsx
import { useAuth } from "@/lib/buildpad/hooks";

function UserProfile() {
  const {
    user, // Current user object
    isAdmin, // Boolean - user has admin role
    isAuthenticated, // Boolean - user is logged in
    loading, // Boolean - auth state loading
    error, // Error if any
    refresh, // () => Promise - refresh auth state
    checkPermission, // (collection, action) => boolean
  } = useAuth();

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <LoginButton />;

  return (
    <div>
      <h1>Welcome, {user.first_name}!</h1>
      {isAdmin && <Badge>Admin</Badge>}
    </div>
  );
}
```

### usePermissions Hook

Check field-level and action-level permissions:

```tsx
import { usePermissions } from "@/lib/buildpad/hooks";

function ArticleEditor({ articleId }: { articleId: string }) {
  const {
    canPerform, // Check action permission
    getAccessibleFields, // Get fields user can access
    isFieldAccessible, // Check specific field access
    isAdmin, // User has admin privileges
    loading,
  } = usePermissions({ collections: ["articles"] });

  if (!canPerform("articles", "update")) {
    return <Alert>You don't have permission to edit articles</Alert>;
  }

  const editableFields = getAccessibleFields("articles", "update");

  return (
    <ArticleForm
      fields={editableFields}
      readonly={!isFieldAccessible("articles", "update", "title")}
    />
  );
}
```

## DaaS API Utilities

For direct DaaS API access in Storybook or testing environments:

### DaaSProvider (React Context)

```tsx
import { DaaSProvider } from "@/lib/buildpad/services";

// Wrap components to enable direct DaaS API access
<DaaSProvider
  config={{
    url: "https://xxx.buildpad-daas.xtremax.com",
    token: "your-static-token",
  }}
  onAuthenticated={(user) => console.log("Authenticated:", user)}
>
  <VForm collection="articles" />
</DaaSProvider>;

// In Next.js app (calls DaaS directly with Supabase JWT)
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
<DaaSProvider
  config={{
    url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!,
    getToken: () =>
      supabase.auth
        .getSession()
        .then(({ data }) => data.session?.access_token ?? null),
  }}
>
  <App />
</DaaSProvider>;
```

### useDaaSContext Hook

Access DaaS configuration and authentication state:

```tsx
import { useDaaSContext } from "@/lib/buildpad/hooks";

function MyComponent() {
  const {
    config, // DaaS URL and token
    user, // Current authenticated user
    isAuthenticated, // Whether user is logged in
    isDaaSMode, // Whether in direct DaaS mode
  } = useDaaSContext();
  // ...
}
```

### apiRequest (Auto-Detects Mode)

```tsx
import {
  apiRequest,
  buildApiUrl,
  getApiHeaders,
} from "@/lib/buildpad/services";

// Works in both Next.js (Supabase JWT) and Storybook (static token)
const response = await apiRequest("/api/items/articles?limit=10");

// Build full DaaS URL manually
const url = buildApiUrl("/api/items/articles");

// Get auth headers synchronously
const headers = getApiHeaders();
```

### Testing with Storybook (Two-Tier Strategy)

Buildpad uses a two-tier testing strategy:

**Tier 1: Storybook Tests (Isolated, No Auth)**

- `pnpm storybook:form` - Start VForm Storybook on port 6006
- Test components with mocked data
- Fast iteration during development
- All 40+ interface types available

**Tier 2: DaaS E2E Tests (Real API, Auth Required)**

- `pnpm test:e2e` - Run Playwright against hosted DaaS
- Full integration with authentication
- Test permissions and workflow
- Real Supabase backend

### VForm DaaS Playground (Storybook)

Test VForm with real DaaS schemas directly in Storybook:

```bash
# Start Storybook with DaaS token (Storybook calls DaaS directly, no proxy needed)
STORYBOOK_DAAS_URL=https://xxx.buildpad-daas.xtremax.com \
STORYBOOK_DAAS_TOKEN=your-static-token \
pnpm storybook:form

# Navigate to "Forms/VForm DaaS Playground" → "Playground" story
# DaaS must have CORS_ORIGINS set to allow localhost:6006
```

**Playground Features:**

- **Static Token Tab**: Uses token from environment variable (automatic)
- **Login Tab**: Enter email/password to get a JWT access token
- **Permission Settings**: Enable field-level permission filtering
- **Action Selection**: Test create/update/read permissions separately
- **Collection Dropdown**: Select any collection from the schema

**Running Storybook Tests:**

```bash
# Install Playwright
pnpm exec playwright install chromium

# Run Storybook tests (Tier 1)
pnpm test:storybook

# Run DaaS E2E tests (Tier 2)
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui
```

## Workflow Button Usage

The WorkflowButton component provides state machine functionality for content workflows.

**IMPORTANT:** Workflow functionality requires the `WorkflowProvider` context wrapper. The button component handles transitions internally.

### Basic Usage with WorkflowProvider

```tsx
import { WorkflowProvider } from "@/contexts/workflow-context";
import { WorkflowButton } from "@/components/ui/workflow-button";

function ArticleEditor({ articleId }: { articleId: string }) {
  return (
    <WorkflowProvider itemId={articleId} collection="articles">
      <ArticleEditorInner articleId={articleId} />
    </WorkflowProvider>
  );
}

function ArticleEditorInner({ articleId }: { articleId: string }) {
  return (
    <WorkflowButton
      itemId={articleId}
      collection="articles"
      workflowField="status" // Field to update on transition
      canCompare={true} // Enable revision comparison
      alwaysVisible={true} // Show even without workflow
      onTransition={() => {
        // Reload data after successful transition
        refetch();
      }}
    />
  );
}
```

### useWorkflow Hook (Context-based)

The `useWorkflow` hook provides access to workflow state within a `WorkflowProvider`. It does NOT accept props - configuration is done via the provider.

```tsx
import { WorkflowProvider, useWorkflow } from "@/contexts/workflow-context";

// Wrapper component sets up the provider
function ArticlePage({ articleId }: { articleId: string }) {
  return (
    <WorkflowProvider itemId={articleId} collection="articles">
      <ArticleContent />
    </WorkflowProvider>
  );
}

// Inner component uses the hook (no arguments)
function ArticleContent() {
  const {
    workflowInstance, // Current workflow instance
    workflowInstanceId, // Instance ID
    commands, // Available transitions from current state
    loading,
    errorMessage,
    transitionCount, // Increments after transitions (watch this to reload data)
    fetchWorkflowInstance, // Refetch workflow data
    fetchUserPolicies, // Fetch user's policies
    clearError, // Clear error message
    notifyTransitionComplete, // Call after successful transition
  } = useWorkflow();

  // Note: Transitions are handled by the WorkflowButton component internally.
  // The context provides state and commands, but not executeTransition.
  // Use notifyTransitionComplete() after transitions to update transitionCount.

  return (
    <div>
      <p>Current State: {workflowInstance?.current_state}</p>
      <p>Terminated: {workflowInstance?.terminated ? "Yes" : "No"}</p>
      {commands.map((cmd) => (
        <span key={cmd.value}>
          {cmd.command} → {cmd.nextState}
        </span>
      ))}
    </div>
  );
}
```

### useWorkflowAssignment Hook

Check if a collection has workflow enabled:

```tsx
import { useWorkflowAssignment } from "@/contexts/workflow-assignment-context";

function CollectionEditor({ collection }: { collection: string }) {
  // Check specific collection
  const { hasWorkflowAssignment, loading, error } =
    useWorkflowAssignment(collection);

  if (hasWorkflowAssignment) {
    // Show workflow UI
  }
}

// Or get all assigned collections
function WorkflowAdmin() {
  const { assignedCollections, refetch } = useWorkflowAssignment();
  // assignedCollections is a Set<string> of collection names with workflows
}
```

### useWorkflowVersioning Hook

Manage workflow + versioning integration:

```tsx
import { useWorkflowVersioning } from "@/hooks/use-workflow-versioning";
import { useVersions } from "@/hooks/use-versions";

function ContentEditor({ collection, id }: Props) {
  const { versions, currentVersion, createVersion } = useVersions(
    collection,
    id,
  );

  const {
    isLastVersion, // Is current version the latest?
    lastVersionKey, // Key of the most recent version
    showRevertButton, // Should show revert option?
    editDisabled, // Should editing be disabled? (terminated/scheduled)
    showActionButtons, // Show workflow action buttons?
    showActionEditButton, // Show edit button for terminated workflows?
    createOrSwitchVersion, // Create new version or switch to latest
  } = useWorkflowVersioning({ versions, currentVersion, itemId: id });

  // editDisabled is true when:
  // - workflowInstance.terminated is true
  // - current_state is "Scheduled Unpublish" or "Scheduled Publish"

  const handleEdit = async () => {
    await createOrSwitchVersion(async () => {
      await createVersion(); // Creates new version if needed
    });
  };
}
```

### Workflow JSON Format

Workflow definitions use an **Array Format** stored in `workflow_json`:

```json
{
  "first_state": "Draft",
  "compare_rollback_state": "Published",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit",
          "next_state": "Review",
          "policies": ["uuid-of-policy"],
          "actions": [{ "name": "notify", "event": "on_enter" }]
        }
      ]
    },
    {
      "name": "Review",
      "commands": [
        { "name": "Approve", "next_state": "Published", "policies": [] },
        { "name": "Reject", "next_state": "Draft", "policies": [] }
      ]
    },
    {
      "name": "Published",
      "is_end_state": true,
      "commands": []
    }
  ]
}
```

**Key fields:**

- `first_state` - Initial state for new items
- `compare_rollback_state` - State that enables revision comparison (optional)
- `states[].name` - State name (displayed to user)
- `states[].is_end_state` - Marks terminal states
- `states[].commands[].name` - Transition button label
- `states[].commands[].next_state` - Target state after transition
- `states[].commands[].policies` - Array of policy UUIDs (empty = all users)

### Required Database Tables

- `daas_wf_definition` - Workflow definitions
- `daas_wf_instance` - Active workflow instances
- `daas_wf_assignment` - Assignment rules
- `daas_wf_history` - Transition history (optional)

### Required API Endpoints

- `GET /api/items/daas_wf_instance` - Fetch workflow instances (filter by `item_id`, `version_key`)
- `GET /api/items/daas_wf_assignment` - Fetch workflow assignments (check which collections have workflows)
- `GET /api/users/me` - Get current user with policies
- `GET /api/access` - Fetch policy details by IDs
- `PATCH /api/items/daas_wf_instance/:id` - Update workflow instance (execute transitions)

**Note:** The workflow definition is embedded in the instance response via the `workflow.*` fields relation.

## Import Patterns

Once components are copied to your project, import them using local paths:

```tsx
// Types - from lib/buildpad/types
import type {
  Field,
  Collection,
  AnyItem,
  PrimaryKey,
  Query,
  Filter,
  DaaSFile,
  M2MRelationInfo,
  M2ORelationInfo,
  O2MRelationInfo,
} from "@/lib/buildpad/types";

// Services - from lib/buildpad/services
import {
  ItemsService,
  FieldsService,
  CollectionsService,
  PermissionsService, // includes static `isAdmin` getter (true when /permissions/me returns isAdmin)
} from "@/lib/buildpad/services";

// DaaS API Utilities (for Storybook/Testing with direct DaaS access)
import {
  apiRequest, // Make API requests (auto-detects proxy vs direct mode)
  buildApiUrl, // Build URL respecting DaaS configuration
  getApiHeaders, // Get auth headers for direct mode
  DaaSProvider, // React provider for direct DaaS access
  useDaaSContext, // Hook to access DaaS config
  setGlobalDaaSConfig, // Set global config for non-React contexts
} from "@/lib/buildpad/services";

// VForm Component (dynamic form system)
import {
  VForm, // Main dynamic form component
  FormField, // Individual field wrapper
  FormFieldLabel, // Label with required indicator
  FormFieldInterface, // Dynamic interface loader
} from "@/lib/buildpad/ui-form";

// Hooks - from lib/buildpad/hooks
import {
  useRelationM2M,
  useRelationM2MItems,
  useRelationM2O,
  useRelationM2OItem,
  useRelationO2M,
  useRelationO2MItems,
  useRelationM2A,
  useRelationM2AItems,
  useFiles,
  useSelection,
  usePreset,
  useEditsGuard,
  useHasEdits,
  useClipboard,
  useLocalStorage,
  // Versioning & workflow hooks
  useVersions,
  useWorkflowAssignment,
  useWorkflowVersioning,
} from "@/lib/buildpad/hooks";

// UI Components - from components/ui
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputCode } from "@/components/ui/input-code";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { SelectRadio } from "@/components/ui/select-radio";
import {
  SelectMultipleCheckbox,
  SelectMultipleCheckboxTree,
  SelectMultipleDropdown,
} from "@/components/ui/select-multiple-checkbox";
import { DateTime } from "@/components/ui/datetime";
import { Boolean } from "@/components/ui/boolean";
import { Toggle } from "@/components/ui/toggle";
import { Color } from "@/components/ui/color";
import { Tags } from "@/components/ui/tags";
import { Slider } from "@/components/ui/slider";
import { Notice } from "@/components/ui/notice";
import { Divider } from "@/components/ui/divider";
import { GroupDetail } from "@/components/ui/group-detail";
import { FileInterface, FileImage, Files, Upload } from "@/components/ui/file";
import { ListM2M } from "@/components/ui/list-m2m";
import { ListM2O } from "@/components/ui/list-m2o";
import { ListO2M } from "@/components/ui/list-o2m";
import { ListM2A } from "@/components/ui/list-m2a";
import { CollectionForm } from "@/components/ui/collection-form";
import { CollectionList } from "@/components/ui/collection-list";
import { WorkflowButton } from "@/components/ui/workflow-button";
import { RichTextHtml } from "@/components/ui/rich-text-html";
import { RichTextMarkdown } from "@/components/ui/rich-text-markdown";
import { InputBlockEditor } from "@/components/ui/input-block-editor";
import { AutocompleteAPI } from "@/components/ui/autocomplete-api";
import { CollectionItemDropdown } from "@/components/ui/collection-item-dropdown";
import { SelectIcon } from "@/components/ui/select-icon";
```

## Service Usage

```tsx
// ItemsService - CRUD operations
const itemsService = new ItemsService("products");

// Read items with query
const items = await itemsService.readByQuery({
  filter: { status: { _eq: "published" } },
  sort: ["-date_created"],
  limit: 50,
  fields: ["id", "title", "status", "category.*"],
});

// Read single item
const item = await itemsService.readOne(id);

// Create item
const created = await itemsService.createOne({ title: "New Product" });

// Update item
const updated = await itemsService.updateOne(id, { title: "Updated" });

// Delete item
await itemsService.deleteOne(id);
```

## Hook Usage

### Many-to-Many (M2M)

```tsx
function ProductTags({ productId }: { productId: string }) {
  // Get relation metadata
  const { relationInfo, loading: metaLoading } = useRelationM2M(
    "products",
    "tags",
  );

  // Manage relation items
  const {
    items, // Current related items
    loading, // Loading state
    loadItems, // Reload items
    selectItems, // Add items to relation
    removeItem, // Remove item from relation
    stagedItems, // Unsaved selections (for new parent items)
  } = useRelationM2MItems(relationInfo, productId);

  return (
    <Stack>
      {items.map((tag) => (
        <Badge key={tag.id} onClose={() => removeItem(tag.id)}>
          {tag.name}
        </Badge>
      ))}
      <Button onClick={() => openTagSelector()}>Add Tags</Button>
    </Stack>
  );
}
```

### Many-to-One (M2O)

```tsx
function ProductCategory({ productId }: { productId: string }) {
  const { relationInfo } = useRelationM2O("products", "category");
  const { item, selectItem, clearItem } = useRelationM2OItem(
    relationInfo,
    productId,
  );

  return (
    <Group>
      <Text>{item?.name || "No category"}</Text>
      <ActionIcon onClick={() => openCategorySelector()}>
        <IconEdit />
      </ActionIcon>
    </Group>
  );
}
```

### One-to-Many (O2M)

```tsx
function CategoryProducts({ categoryId }: { categoryId: string }) {
  const { relationInfo } = useRelationO2M("categories", "products");
  const { items, addItem, removeItem } = useRelationO2MItems(
    relationInfo,
    categoryId,
  );

  return (
    <DataTable
      records={items}
      columns={[{ accessor: "title" }, { accessor: "status" }]}
    />
  );
}
```

### Many-to-Any (M2A) - Polymorphic

```tsx
function ContentBlocks({ pageId }: { pageId: string }) {
  const { relationInfo } = useRelationM2A("pages", "blocks");
  const { items, addItem, removeItem } = useRelationM2AItems(
    relationInfo,
    pageId,
  );

  return (
    <Stack>
      {items.map((block) => (
        <Card key={block.id}>
          <Text>Collection: {block.$collection}</Text>
          <Text>Item: {block.$item}</Text>
        </Card>
      ))}
    </Stack>
  );
}
```

### Content Versions

```tsx
function ArticleEditor({ articleId }: { articleId: string }) {
  const {
    versions, // List of all versions
    currentVersion, // Currently selected version
    loading,
    createVersion, // Create new version
    saveVersion, // Save to version delta
    deleteVersion, // Delete a version
    promoteVersion, // Apply version to main item
  } = useVersions("articles", articleId);

  const handleSaveDraft = async (data: any) => {
    await saveVersion("draft", data);
  };

  return (
    <Stack>
      <Select
        label="Version"
        data={versions.map((v) => ({ value: v.key, label: v.name }))}
        value={currentVersion?.key}
      />
      <Button onClick={() => createVersion("draft", "Draft")}>
        Create Draft
      </Button>
    </Stack>
  );
}
```

### Workflow Assignment

```tsx
function CollectionEditor({ collection }: { collection: string }) {
  const { hasWorkflowAssignment, loading } = useWorkflowAssignment(collection);

  if (hasWorkflowAssignment) {
    return <WorkflowButton collection={collection} itemId={itemId} />;
  }

  return null;
}
```

### Workflow Versioning Integration

```tsx
function ContentWithWorkflow({ collection, id }: Props) {
  const { versions, currentVersion, createVersion } = useVersions(
    collection,
    id,
  );

  const {
    isLastVersion, // Is current version the latest?
    lastVersionKey, // Key of the most recent version
    showRevertButton, // Should show revert option?
    editDisabled, // Disable editing (terminated/scheduled)?
    showActionButtons, // Show workflow actions?
    createOrSwitchVersion, // Create or switch to version
  } = useWorkflowVersioning({ versions, currentVersion, itemId: id });

  if (editDisabled) {
    return (
      <Notice type="info">This item is in a terminal workflow state.</Notice>
    );
  }
}
```

## Component Props Pattern

All field components follow this interface:

```tsx
interface FieldComponentProps {
  field: string; // Field name
  value: any; // Current value
  onChange: (value: any) => void; // Value change handler
  disabled?: boolean; // Disable editing
  label?: string; // Field label
  placeholder?: string; // Placeholder text
  required?: boolean; // Required field
  error?: string | null; // Error message

  // Component-specific props...
}
```

## Customizing Components

Since you own the code, customize freely:

```tsx
// components/ui/input.tsx
// Add your custom logic, styling, or behavior

export function Input({ field, value, onChange, ...props }: InputProps) {
  // Add custom validation
  const validate = (val: string) => {
    if (props.required && !val) return "Required";
    if (props.maxLength && val.length > props.maxLength) return "Too long";
    return null;
  };

  // Add custom formatting
  const format = (val: string) => {
    if (props.slugify) return slugify(val);
    return val;
  };

  return (
    <MantineTextInput
      label={props.label}
      value={value}
      onChange={(e) => onChange(format(e.target.value))}
      error={validate(value)}
      // Your custom props...
    />
  );
}
```

---

## 🔧 Troubleshooting

### Module Not Found Errors

**Problem:** `Module not found: Can't resolve '../upload'` (or similar relative import errors)

**Cause:** Components have dependencies on other components (called `registryDependencies`). If a component was manually copied or the CLI didn't install dependencies correctly, you'll see missing module errors.

#### Component Dependency Matrix (Key Dependencies)

| Component         | Requires                                                  | Notes                              |
| ----------------- | --------------------------------------------------------- | ---------------------------------- |
| `file-image`      | `upload`                                                  | File image picker uses upload zone |
| `file`            | `upload`                                                  | Single file uses upload zone       |
| `files`           | `upload`                                                  | Multi-file uses upload zone        |
| `collection-form` | `vform`, all interface components                         | Dynamic form needs all interfaces  |
| `collection-list` | `vform`, all interface components                         | Table edit needs all interfaces    |
| `list-m2m`        | `hooks`, `services`, `collection-form`, `collection-list` | Relation + UI components           |
| `list-m2o`        | `hooks`, `services`, `collection-form`, `collection-list` | Relation + UI components           |
| `list-o2m`        | `hooks`, `services`, `collection-form`, `collection-list` | Relation + UI components           |
| `list-m2a`        | `hooks`, `services`, `collection-form`, `collection-list` | Relation + UI components           |

#### How to Fix

1. **Verify dependencies first:**

   ```bash
   cd /path/to/buildpad-ui
   pnpm cli info file-image --cwd /path/to/your-project
   ```

2. **Check what's installed:**

   ```bash
   pnpm cli status --cwd /path/to/your-project
   ```

3. **Add missing dependencies:**

   ```bash
   pnpm cli add upload --cwd /path/to/your-project
   ```

4. **Or reinstall with dependencies:**
   ```bash
   pnpm cli add file-image --overwrite --cwd /path/to/your-project
   ```

### Import Path Transformation Issues

**Problem:** Imports still use `@buildpad/*` instead of local paths like `@/lib/buildpad/*`

**Example errors:**

- `Module not found: Can't resolve '@buildpad/services'`
- `Module not found: Can't resolve '@buildpad/hooks'`
- `Module not found: Can't resolve '@buildpad/ui-collections'`

**Cause:** The CLI transforms imports during copy. If transformation fails, the file was manually copied, or there's a dynamic import that wasn't caught, imports won't work.

#### Expected Import Transformations

| Source (Original)                      | Target (Your Project)               |
| -------------------------------------- | ----------------------------------- |
| `@buildpad/types`                      | `@/lib/buildpad/types`              |
| `@buildpad/hooks`                      | `@/lib/buildpad/hooks`              |
| `@buildpad/services`                   | `@/lib/buildpad/services`           |
| `@buildpad/ui-collections`             | Local component imports             |
| `../upload` (relative)                 | `./upload` (same folder)            |
| Dynamic `import('@buildpad/services')` | `import('@/lib/buildpad/services')` |

#### How to Fix

**Option 1: Reinstall with CLI (Recommended)**

```bash
cd /path/to/buildpad-ui

# Reinitialize project config
pnpm cli init --cwd /path/to/your-project

# Reinstall affected components with --overwrite
pnpm cli add list-o2m --overwrite --cwd /path/to/your-project
```

**Option 2: Manual Fix (If CLI doesn't resolve)**

If the CLI transformation isn't working, manually fix the imports in the affected file:

```tsx
// BEFORE (broken - @buildpad packages don't exist in your project)
import { useRelationO2M } from "@buildpad/hooks";
import { ItemsService } from "@buildpad/services";
import { CollectionForm } from "@buildpad/ui-collections";

// AFTER (fixed - local paths that exist in your project)
import { useRelationO2M } from "@/lib/buildpad/hooks";
import { ItemsService } from "@/lib/buildpad/services";
import { CollectionForm } from "@/components/ui/collection-form";
```

**Also fix dynamic imports:**

```tsx
// BEFORE (broken)
const ItemsService = (await import("@buildpad/services")).ItemsService;

// AFTER (fixed)
const ItemsService = (await import("@/lib/buildpad/services")).ItemsService;
```

#### Verify buildpad.json Configuration

Ensure your project has correct configuration:

```json
{
  "srcDir": true,
  "aliases": {
    "components": "@/components/ui",
    "lib": "@/lib/buildpad"
  }
}
```

### Projects with `src/` Directory

**Important:** Projects with a `src/` folder need proper configuration:

```json
// buildpad.json (for src/ projects)
{
  "srcDir": true,
  "aliases": {
    "components": "@/components/ui",
    "lib": "@/lib/buildpad"
  }
}
```

Components will be installed to:

- `src/components/ui/` (not `components/ui/`)
- `src/lib/buildpad/` (not `lib/buildpad/`)

### Storybook Import Errors

**Problem:** Storybook fails to resolve Buildpad imports

**Cause:** Storybook may not have the same path aliases configured

**Fix:** Ensure `vite.config.ts` or `.storybook/main.ts` has matching aliases:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/lib/buildpad": path.resolve(__dirname, "./src/lib/buildpad"),
      "@/components/ui": path.resolve(__dirname, "./src/components/ui"),
    },
  },
});
```

### Prevention: Always Use CLI Commands

**NEVER manually copy component files.** Always use CLI commands:

```bash
# ✅ Correct - CLI handles dependencies and transforms
pnpm cli add file-image --cwd /path/to/your-project

# ❌ Wrong - Manual copy breaks imports and misses dependencies
cp packages/ui-interfaces/src/file-image/FileImage.tsx your-project/components/ui/
```

### Validation Checklist After Adding Components

After running `pnpm cli add`, verify:

- [ ] Run `pnpm cli status` to confirm all components are installed
- [ ] Run `pnpm cli validate` to check for broken imports and compatibility issues
- [ ] Check that `upload.tsx` exists if using file components
- [ ] Verify imports in new files use `@/lib/buildpad/*` (not `@buildpad/*`)
- [ ] Run `pnpm build` or `pnpm dev` to catch any module errors early
- [ ] If using VForm, all 32+ interface components should be installed

---

## ⚠️ Next.js 16 / React 19 Compatibility

Next.js 16+ with React 19 introduces breaking changes that affect Buildpad components. Follow these guidelines to avoid runtime errors.

### The Component Prop Issue

**Problem:** React 19 no longer allows passing React components as props in Server Components.

```tsx
// ❌ WRONG - This causes "Functions cannot be passed directly to Client Components" error
// In a Server Component (app/page.tsx without "use client")
import Link from "next/link";
import { Anchor, Button } from "@mantine/core";

export default function Page() {
  return (
    <Anchor component={Link} href="/dashboard">
      <Button>Go to Dashboard</Button>
    </Anchor>
  );
}
```

**Error message:**

```
Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
  <... component={function LinkComponent} href=... children=...>
```

### Solution 1: Wrap Link Around Button

```tsx
// ✅ CORRECT - Use Link directly instead of component prop
import Link from "next/link";
import { Button } from "@mantine/core";

export default function Page() {
  return (
    <Link href="/dashboard" style={{ textDecoration: "none" }}>
      <Button>Go to Dashboard</Button>
    </Link>
  );
}
```

### Solution 2: Make it a Client Component

```tsx
// ✅ CORRECT - Add "use client" directive
"use client";

import Link from "next/link";
import { Anchor, Button } from "@mantine/core";

export default function ClientPage() {
  return (
    <Anchor component={Link} href="/dashboard">
      <Button>Go to Dashboard</Button>
    </Anchor>
  );
}
```

### Other React 19 Considerations

**1. Mantine Components in Server Components**

Many Mantine components work in Server Components, but avoid:

- `component={...}` prop with React components
- Event handlers like `onClick` without "use client"
- Hooks or state

**2. Suspense Required for useSearchParams**

```tsx
// ✅ CORRECT - Wrap in Suspense
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
```

**3. Server Actions**

Use `"use server"` for form actions:

```tsx
// In a Server Component
async function handleSubmit(formData: FormData) {
  "use server";
  // This runs on the server
  await saveToDatabase(formData);
}
```

### CLI Validation for React 19 Issues

The Buildpad CLI can detect React 19 compatibility issues:

```bash
pnpm cli validate --cwd /path/to/your-project
```

This checks for:

- `component={...}` patterns in Server Components
- Missing "use client" directives
- Other common compatibility issues
