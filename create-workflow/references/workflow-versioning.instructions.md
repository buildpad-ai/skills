---
name: Workflow & Versioning
description: Content versioning and workflow state machine implementation
applyTo: "app/**/*.{ts,tsx}, lib/**/*.{ts,tsx}"
---

# Workflow & Content Versioning Instructions

## Overview

The platform supports **content lifecycle management** through two integrated systems:

1. **Content Versioning** - Create multiple versions/drafts of items
2. **Workflow System** - Move content through state machines (draft → review → published)

These work together to enable:

- Draft/published workflows for content management
- Multi-stage approval processes
- Version-aware editing
- Complete audit trails of state transitions

## Architecture

### Two-Tier System

```
┌─────────────────────────────────────────────────┐
│              Frontend (main-nextjs)              │
│  ├── ItemViewWithVersions                       │
│  ├── WorkflowButton                             │
│  ├── useVersions()                              │
│  ├── useWorkflow()                              │
│  └── useWorkflowVersioning()                    │
└──────────────────────┬──────────────────────────┘
                       │ API calls
                       ▼
┌──────────────────────────────────────────────────┐
│         DaaS Backend (DaaS)      │
│  ├── /api/versions                              │
│  ├── /api/workflow/transition                   │
│  ├── Workflow automation hooks                  │
│  └── Version delta management                   │
└──────────────────────┬───────────────────────────┘
                       │ Database access
                       ▼
┌──────────────────────────────────────────────────┐
│           Supabase PostgreSQL                    │
│  ├── daas_wf_definition                          │
│  ├── daas_wf_assignment                          │
│  ├── daas_wf_instance                            │
│  ├── daas_wf_transition_history                  │
│  └── daas_versions                          │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Version Creation**: User saves changes → Frontend calls `/api/versions` → DaaS creates version record
2. **Workflow Instance**: DaaS hook detects version creation → Creates workflow instance in `daas_wf_instance`
3. **Workflow State**: Frontend polls for instance → Displays available commands via WorkflowButton
4. **Transition**: User clicks command → Frontend calls `/api/workflow/transition` → DaaS updates state + history

## Content Versioning

### Core Concepts

| Concept           | Description                                         |
| ----------------- | --------------------------------------------------- |
| **Version**       | A snapshot of item data stored in `daas_versions`   |
| **Version Key**   | Identifier for a version (e.g., "1", "draft", "v2") |
| **Version Delta** | JSON diff of changes from the main item             |
| **Promote**       | Apply version delta back to main item               |

### Database Schema

#### daas_versions Table

```sql
CREATE TABLE daas_versions (
  id UUID PRIMARY KEY,
  collection VARCHAR(64) NOT NULL,
  item UUID NOT NULL,
  key VARCHAR(255),
  name VARCHAR(255),
  delta JSONB,
  date_created TIMESTAMP DEFAULT NOW(),
  user_created UUID,
  FOREIGN KEY (user_created) REFERENCES daas_users(id)
);
```

#### URL Parameters

Retrieve specific versions:

```typescript
// Get item with specific version applied
GET /api/items/articles/item-uuid?version=draft
GET /api/items/articles/item-uuid?version=1
GET /api/items/articles/item-uuid         // Latest published
```

### API: Versions

**Base URL:** `/api/versions`

| Method | Endpoint            | Description                      |
| ------ | ------------------- | -------------------------------- |
| GET    | `/api/versions`     | List versions (supports filters) |
| POST   | `/api/versions`     | Create new version               |
| GET    | `/api/versions/:id` | Get single version               |
| PATCH  | `/api/versions/:id` | Update version (delta merge)     |
| DELETE | `/api/versions/:id` | Delete version                   |

#### Create Version

```typescript
const response = await fetch("/api/versions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    key: "1", // Unique identifier
    name: "Draft 1", // Human-readable name
    collection: "articles",
    item: "uuid-123", // Main item UUID
    delta: {
      // Changes from main item
      title: "Updated Title",
      status: "draft",
    },
  }),
});

const { data: version } = await response.json();
```

#### Save to Version

```typescript
// Update version delta (incremental save)
const response = await fetch("/api/versions/version-uuid", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    delta: {
      title: "New Title",
      content: "Updated content",
    },
  }),
});
```

#### Promote Version

```typescript
// Apply version delta to main item
const response = await fetch("/api/items/articles/item-uuid", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    // Merge version delta into main item
    ...versionDelta,
  }),
});
```

## Workflow System

### Core Concepts

| Concept                 | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| **Workflow Definition** | JSON-based state machine with states and commands                           |
| **Workflow Instance**   | Active instance tracking current state of an item/version                   |
| **Workflow Assignment** | Links collection to workflow with optional filter rules                     |
| **State**               | A named state in the workflow (e.g., "draft", "review", "published")        |
| **Command**             | Action that transitions between states (e.g., "submit", "approve")          |
| **Policy**              | Permission requirement to execute a command                                 |
| **Action**              | Side effect triggered on transition (e.g., version promotion, notification) |

### Workflow Definition Structure

```json
{
  "id": "wf-uuid",
  "name": "Publishing Workflow",
  "workflow_json": {
    "initial_state": "draft",
    "states": [
      {
        "name": "draft",
        "label": "Draft",
        "commands": [
          {
            "name": "submit",
            "label": "Submit for Review",
            "next_state": "review",
            "policies": [],
            "actions": []
          }
        ],
        "isEndState": false
      },
      {
        "name": "review",
        "label": "In Review",
        "commands": [
          {
            "name": "approve",
            "label": "Approve & Publish",
            "next_state": "published",
            "policies": ["policy-uuid-reviewer"],
            "actions": [
              {
                "type": "promote_version",
                "config": {}
              }
            ]
          },
          {
            "name": "reject",
            "label": "Send Back to Draft",
            "next_state": "draft",
            "policies": ["policy-uuid-reviewer"],
            "actions": []
          }
        ],
        "isEndState": false
      },
      {
        "name": "published",
        "label": "Published",
        "commands": [],
        "isEndState": true
      }
    ]
  }
}
```

### Database Schema

#### daas_wf_definition Table

```sql
CREATE TABLE daas_wf_definition (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  workflow_json JSONB NOT NULL,
  date_created TIMESTAMP DEFAULT NOW(),
  user_created UUID
);
```

#### daas_wf_assignment Table

```sql
CREATE TABLE daas_wf_assignment (
  id UUID PRIMARY KEY,
  collection VARCHAR(64) NOT NULL,
  workflow UUID NOT NULL REFERENCES daas_wf_definition(id),
  filter_rule JSONB,
  date_created TIMESTAMP DEFAULT NOW()
);
```

#### daas_wf_instance Table

```sql
CREATE TABLE daas_wf_instance (
  id UUID PRIMARY KEY,
  workflow UUID NOT NULL REFERENCES daas_wf_definition(id),
  collection VARCHAR(64) NOT NULL,
  item UUID NOT NULL,
  version_key VARCHAR(255),
  current_state VARCHAR(255) NOT NULL,
  terminated BOOLEAN DEFAULT FALSE,
  date_created TIMESTAMP DEFAULT NOW(),
  user_created UUID,
  UNIQUE(workflow, item, version_key)
);
```

#### daas_wf_transition_history Table

```sql
CREATE TABLE daas_wf_transition_history (
  id UUID PRIMARY KEY,
  workflow_instance UUID NOT NULL REFERENCES daas_wf_instance(id),
  from_state VARCHAR(255),
  to_state VARCHAR(255),
  command VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id UUID
);
```

### Setting Up Workflows

#### Step 1: Create Workflow Definition

In the DaaS admin panel or database:

```typescript
const definition = {
  name: "Content Publishing",
  workflow_json: {
    initial_state: "draft",
    states: [
      {
        name: "draft",
        commands: [{ name: "submit", next_state: "review", policies: [] }],
        isEndState: false,
      },
      {
        name: "review",
        commands: [
          { name: "approve", next_state: "published", policies: [] },
          { name: "reject", next_state: "draft", policies: [] },
        ],
        isEndState: false,
      },
      {
        name: "published",
        commands: [],
        isEndState: true,
      },
    ],
  },
};
```

#### Step 2: Assign Workflow to Collection

Create a workflow assignment:

```typescript
const assignment = {
  collection: "articles",
  workflow: "workflow-definition-uuid",
  filter_rule: null, // Apply to all items, or use filter
};
```

#### Step 3: Add Collection Fields (Optional)

Add fields to track workflow state:

1. **Workflow Instance Field** (Many-to-One)
   - Interface: Default
   - Related Collection: `daas_wf_instance`
   - Mark as read-only in metadata

2. **Workflow State Field** (Text)
   - Interface: `xtr-interface-workflow`
   - Mark as read-only in metadata
   - Auto-populated by DaaS

### API: Workflow Transitions

#### POST /api/workflow/transition

Execute a workflow state transition.

**Request Body:**

```json
{
  "workflowInstanceId": "instance-uuid",
  "commandName": "approve"
}
```

**Response (Success - 200):**

```json
{
  "message": "Successfully transitioned workflow state",
  "workflowInstance": {
    "id": "instance-uuid",
    "current_state": "published",
    "terminated": false
  }
}
```

**Response (Unauthorized - 403):**

```json
{
  "message": "You are not authorized to perform this transition"
}
```

### Automatic Workflow Creation

The DaaS backend automatically creates workflow instances when:

1. **Item Created** - If collection has workflow assignment
2. **Version Created** - If parent item matches assignment filter

The hook:

1. Checks for workflow assignments on the collection
2. Tests filter rules against the item (not version)
3. Creates instance with initial state
4. Sets `version_key` if version event

## Frontend Hooks & Components

### useVersions()

Manage content versions for an item.

```typescript
import { useVersions } from "@/lib/buildpad/hooks";

const {
  versions, // ContentVersion[]
  currentVersion, // ContentVersion | null
  loading, // boolean
  createVersion, // (key: string, name?: string) => Promise<ContentVersion>
  saveVersion, // (key: string, delta: object) => Promise<void>
  deleteVersion, // (key: string) => Promise<void>
  promoteVersion, // (key: string) => Promise<void>
  refetchVersions, // () => Promise<void>
} = useVersions("articles", "item-uuid");

// Create a new version
const newVersion = await createVersion("draft", "Draft 1");

// Save changes to version delta
await saveVersion("draft", { title: "Updated Title" });

// Promote version to main item
await promoteVersion("draft");
```

### useWorkflowAssignment()

Check if a collection has workflow enabled.

```typescript
import { useWorkflowAssignment } from "@/lib/buildpad/hooks";

// Check specific collection
const {
  hasWorkflowAssignment, // boolean
  loading, // boolean
  error, // string | null
} = useWorkflowAssignment("articles");

// Get all assigned collections
const { assignedCollections } = useWorkflowAssignment();
// assignedCollections is a Set<string>
```

### useWorkflowVersioning()

Integrate workflow state with versioning UI.

```typescript
import { useWorkflowVersioning, useVersions } from '@/lib/buildpad/hooks';

function ContentEditor({ collection, id }: Props) {
  const { versions, currentVersion, createVersion } = useVersions(collection, id);

  const {
    isLastVersion,             // Is current version the latest?
    lastVersionKey,            // Key of the most recent version
    showRevertButton,          // Should show revert option?
    editDisabled,              // Disable editing (terminated/scheduled)?
    showActionButtons,         // Show workflow action buttons?
    showActionEditButton,      // Show edit button for terminated?
    createOrSwitchVersion,     // Create new version or switch to latest
  } = useWorkflowVersioning({ versions, currentVersion, itemId: id });

  // editDisabled is true when:
  // - workflowInstance.terminated is true
  // - current_state is "Scheduled Unpublish" or "Scheduled Publish"

  const handleEdit = async () => {
    await createOrSwitchVersion(async () => {
      await createVersion('draft', 'New Draft');
    });
  };

  if (editDisabled) {
    return <Notice type="info">Editing disabled - workflow in terminal state</Notice>;
  }
}
```

### WorkflowProvider & useWorkflow() (Context-based)

Use WorkflowProvider to wrap components that need workflow state.

```typescript
'use client';

import { WorkflowProvider, useWorkflow } from '@/contexts/workflow-context';

// Wrapper component
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
    workflowInstance,          // WorkflowInstance | null
    workflowInstanceId,        // Instance ID
    commands,                  // Available transitions as SelectOption[]
    loading,                   // boolean
    errorMessage,              // string | null
    transitionCount,           // Increments after transitions (watch to refetch)
    fetchWorkflowInstance,     // Refetch workflow data
    notifyTransitionComplete,  // Call after successful transition
  } = useWorkflow();

  // Note: Transitions are handled by WorkflowButton component
  // The context provides state, not executeTransition

  return (
    <div>
      <p>Current State: {workflowInstance?.current_state}</p>
      <p>Terminated: {workflowInstance?.terminated ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### WorkflowButton Component

Displays current workflow state with available transitions.

```typescript
import { WorkflowButton } from '@/components/ui/workflow-button';

<WorkflowButton
  itemId="uuid-123"
  collection="articles"
  canCompare={true}           // Enable revision comparison
  alwaysVisible={true}        // Show even without active workflow
  onChange={(value) => {}}    // Called on state change
  onTransition={() => {       // Called after successful transition
    refetch();                // Reload data
  }}
/>
```

### ItemViewWithVersions Component

Enhanced item view supporting versioning and workflows.

```typescript
'use client';

import { ItemViewWithVersions } from '@/components/content/ItemViewWithVersions';

export default function ArticleDetailPage() {
  return (
    <ItemViewWithVersions
      collection="articles"
      itemId="uuid-123"
      readOnly={false}
    />
  );
}
```

## Implementation Patterns

### Version-Aware Form

```tsx
"use client";

import { useState } from "react";
import { useVersions } from "@/lib/hooks/useVersions";
import { useWorkflowVersioning } from "@/lib/hooks/useWorkflowVersioning";
import { Button, TextInput } from "@mantine/core";

export function ArticleForm({ collection, itemId }) {
  const [edits, setEdits] = useState({});
  const { versions, currentVersion, createVersion, saveVersion } = useVersions(
    collection,
    itemId,
  );

  const {
    showActionEditButton,
    editDisabled,
    createOrSwitchVersion,
    isLastVersion,
  } = useWorkflowVersioning({
    versions,
    currentVersion,
    itemId,
  });

  const handleSave = async () => {
    await createOrSwitchVersion(async () => {
      await saveVersion(edits);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <TextInput
        label="Title"
        value={edits.title || currentVersion?.delta?.title || ""}
        onChange={(e) => setEdits({ ...edits, title: e.target.value })}
        disabled={editDisabled}
      />

      <Button type="submit" disabled={editDisabled}>
        {showActionEditButton ? "Create New Version" : "Save Changes"}
      </Button>
    </form>
  );
}
```

### Workflow State Display

```tsx
"use client";

import { WorkflowProvider } from "@/lib/contexts/WorkflowContext";
import { WorkflowButton } from "@/components/ui/workflow-button";
import { useWorkflow } from "@/lib/contexts/WorkflowContext";

function WorkflowBadge() {
  const { currentState, loading } = useWorkflow();

  if (loading) return <div>Loading...</div>;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        State: {currentState?.label || "Unknown"}
      </span>
    </div>
  );
}

export function ArticleView({ collection, itemId, versionKey }) {
  return (
    <WorkflowProvider
      collection={collection}
      itemId={itemId}
      versionKey={versionKey}
    >
      <div className="space-y-4">
        <WorkflowBadge />
        <WorkflowButton
          collection={collection}
          itemId={itemId}
          versionKey={versionKey}
        />
      </div>
    </WorkflowProvider>
  );
}
```

## Best Practices

### Versioning

1. **Create versions at logical checkpoints** - Not on every keystroke
2. **Use meaningful version names** - "Draft 1", "Review Round 1", etc.
3. **Preserve version history** - Don't delete versions, mark as archived
4. **Test version promotion** - Ensure deltas merge correctly

### Workflow Design

1. **Keep workflows simple** - 3-5 states maximum for most use cases
2. **Use filter rules for targeted workflows** - Assign workflows to specific item types
3. **Require policies for critical transitions** - Especially "publish" or "delete"
4. **Document state meanings** - Use descriptive state labels
5. **Test permission scenarios** - Ensure users can't skip approval steps

### Performance

1. **Cache workflow definitions** - Don't fetch on every component render
2. **Poll workflow instances efficiently** - Use reasonable intervals (2-5 seconds)
3. **Limit version history queries** - Use pagination for old versions
4. **Batch transition history** - Load in pages, not all at once

## Common Workflows

### Content Publishing (Draft → Review → Published)

```json
{
  "initial_state": "draft",
  "states": [
    {
      "name": "draft",
      "commands": [{ "name": "submit", "next_state": "review" }]
    },
    {
      "name": "review",
      "commands": [
        { "name": "approve", "next_state": "published" },
        { "name": "reject", "next_state": "draft" }
      ]
    },
    { "name": "published", "commands": [] }
  ]
}
```

### Simple Draft/Published

```json
{
  "initial_state": "draft",
  "states": [
    {
      "name": "draft",
      "commands": [{ "name": "publish", "next_state": "published" }]
    },
    {
      "name": "published",
      "commands": [{ "name": "unpublish", "next_state": "draft" }]
    }
  ]
}
```

### Multi-Level Approval (Draft → Manager → Director → Published)

```json
{
  "initial_state": "draft",
  "states": [
    {
      "name": "draft",
      "commands": [{ "name": "submit", "next_state": "manager_review" }]
    },
    {
      "name": "manager_review",
      "commands": [
        { "name": "manager_approve", "next_state": "director_review" },
        { "name": "manager_reject", "next_state": "draft" }
      ]
    },
    {
      "name": "director_review",
      "commands": [
        { "name": "director_approve", "next_state": "published" },
        { "name": "director_reject", "next_state": "manager_review" }
      ]
    },
    { "name": "published", "commands": [] }
  ]
}
```

## Troubleshooting

### Workflow Instance Not Created

**Cause**: Filter rule doesn't match item or no assignment exists
**Solution**:

1. Check assignment exists: `SELECT * FROM daas_wf_assignment WHERE collection = 'articles'`
2. Test filter rule: Verify item matches the filter rule JSON
3. Check logs for errors during version creation

### Can't Execute Command

**Cause**: User doesn't have required policy
**Solution**:

1. Check command requires policies: Look at workflow definition
2. Verify user has policy in `daas_access`
3. Check role and user-level assignments

### Version Delta Not Merging

**Cause**: Deep merge logic not handling your data structure
**Solution**:

1. Verify delta structure matches target item structure
2. Test with simpler deltas first
3. Check for circular references in nested objects
