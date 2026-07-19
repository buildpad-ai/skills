---
name: Workflow & Versioning Components
description: Component patterns for workflow and versioning features
applyTo: "components/**/{workflow,version}*.{ts,tsx}"
---

# Workflow & Versioning Component Patterns

## WorkflowButton Component

Displays current workflow state with available transitions as a dropdown button.

```tsx
import { WorkflowButton } from '@/components/ui/workflow-button';

interface WorkflowButtonProps {
  /** Collection name */
  collection: string;
  /** Item ID/UUID */
  itemId: string;
  /** Optional version key for version-specific workflows */
  versionKey?: string;
}

// Usage
<WorkflowButton 
  collection="articles"
  itemId="item-uuid"
  versionKey="draft"  // Optional
/>
```

### Features
- Display current workflow state with label and icon
- Dropdown menu showing available commands
- Click handler for state transitions
- Loading state while transitioning
- Error notifications on failed transitions

## ItemViewWithVersions Component

Enhanced item view with built-in version and workflow support.

```tsx
'use client';

import { ItemViewWithVersions } from '@/components/content/ItemViewWithVersions';

interface ItemViewWithVersionsProps {
  /** Collection name */
  collection: string;
  /** Item ID/UUID */
  itemId: string;
  /** Whether form is read-only */
  readOnly?: boolean;
}

export default function ArticleDetail() {
  return (
    <ItemViewWithVersions
      collection="articles"
      itemId="uuid-123"
      readOnly={false}
    />
  );
}
```

### Features
- Fetches item with version support
- Shows version selector dropdown
- Handles version-aware form editing
- Integrates WorkflowButton
- Auto-saves to version delta instead of main item
- "Create New Version" button when workflow terminates

## Workflow-Aware Form Component

Form that integrates versioning and workflow state management.

```tsx
'use client';

import { useState } from 'react';
import { useVersions } from '@/lib/hooks/useVersions';
import { useWorkflowVersioning } from '@/lib/hooks/useWorkflowVersioning';
import { WorkflowProvider } from '@/lib/contexts/WorkflowContext';
import { WorkflowButton } from '@/components/ui/workflow-button';
import { Button, TextInput, Stack, Textarea } from '@mantine/core';

function ArticleFormContent({ collection, itemId }) {
  const [edits, setEdits] = useState({});
  
  // Get versions for the item
  const { versions, currentVersion, saveVersion } = useVersions(collection, itemId);
  
  // Determine if editing should be allowed based on workflow state
  const { editDisabled, showActionEditButton, createOrSwitchVersion } = useWorkflowVersioning({
    versions,
    currentVersion,
    itemId,
  });

  const handleSave = async () => {
    // Create new version if needed, then save edits
    await createOrSwitchVersion(async () => {
      await saveVersion(edits);
      setEdits({});
    });
  };

  return (
    <Stack gap="lg">
      {/* Form Fields */}
      <TextInput
        label="Title"
        value={edits.title || currentVersion?.delta?.title || ''}
        onChange={(e) => setEdits({ ...edits, title: e.target.value })}
        disabled={editDisabled}
        placeholder="Enter article title"
      />
      
      <Textarea
        label="Content"
        value={edits.content || currentVersion?.delta?.content || ''}
        onChange={(e) => setEdits({ ...edits, content: e.target.value })}
        disabled={editDisabled}
        placeholder="Enter article content"
        minRows={5}
      />
      
      {/* Workflow Status */}
      <WorkflowButton collection={collection} itemId={itemId} />
      
      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        disabled={editDisabled || Object.keys(edits).length === 0}
      >
        {showActionEditButton ? 'Create New Version' : 'Save Changes'}
      </Button>
    </Stack>
  );
}

// Wrap with WorkflowProvider for context
export function ArticleForm({ collection, itemId }) {
  return (
    <WorkflowProvider collection={collection} itemId={itemId}>
      <ArticleFormContent collection={collection} itemId={itemId} />
    </WorkflowProvider>
  );
}
```

## Version Selector Component

Dropdown to select between versions.

```tsx
'use client';

import { useVersions } from '@/lib/hooks/useVersions';
import { Select } from '@mantine/core';

interface VersionSelectorProps {
  collection: string;
  itemId: string;
  onVersionChange?: (versionKey: string) => void;
}

export function VersionSelector({ collection, itemId, onVersionChange }: VersionSelectorProps) {
  const { versions, currentVersion } = useVersions(collection, itemId);
  
  return (
    <Select
      label="Version"
      data={versions.map(v => ({
        value: v.key || v.id,
        label: v.name || v.key || 'Unnamed'
      }))}
      value={currentVersion?.key || currentVersion?.id}
      onChange={(value) => {
        if (value) {
          onVersionChange?.(value);
        }
      }}
      description="Select a version to view/edit"
      searchable
    />
  );
}
```

## Workflow State Display Component

Show current workflow state with styling.

```tsx
'use client';

import { useWorkflow } from '@/lib/contexts/WorkflowContext';
import { Badge, Group, Text, Stack, Skeleton } from '@mantine/core';
import { IconCircle } from '@tabler/icons-react';

interface WorkflowStateDisplayProps {
  showHistory?: boolean;
}

export function WorkflowStateDisplay({ showHistory = false }: WorkflowStateDisplayProps) {
  const { currentState, workflowInstance, loading } = useWorkflow();
  
  if (loading) return <Skeleton height={40} />;
  
  if (!currentState) return null;
  
  const stateColorMap: Record<string, string> = {
    draft: 'gray',
    review: 'blue',
    published: 'green',
    rejected: 'red',
    archived: 'dark',
  };
  
  const color = stateColorMap[currentState.name] || 'gray';
  
  return (
    <Stack gap="xs">
      <Group gap="sm">
        <IconCircle size={12} color={color} fill={color} />
        <div>
          <Text size="sm" c="dimmed">Status</Text>
          <Badge color={color}>{currentState.label || currentState.name}</Badge>
        </div>
      </Group>
      
      {showHistory && workflowInstance && (
        <Text size="xs" c="dimmed">
          Terminated: {workflowInstance.terminated ? 'Yes' : 'No'}
        </Text>
      )}
    </Stack>
  );
}
```

## Transition History Component

Display history of workflow state transitions.

```tsx
'use client';

import { useMemo } from 'react';
import { Table, Skeleton, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface TransitionHistoryProps {
  workflowInstanceId: string;
}

export function TransitionHistory({ workflowInstanceId }: TransitionHistoryProps) {
  const [history, setHistory] = useMemo(() => [], []);
  
  if (!history) return <Skeleton height={200} />;
  
  if (history.length === 0) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="blue">
        No transitions yet
      </Alert>
    );
  }
  
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>From State</Table.Th>
          <Table.Th>To State</Table.Th>
          <Table.Th>Command</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Date</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {history.map((transition) => (
          <Table.Tr key={transition.id}>
            <Table.Td>{transition.from_state}</Table.Td>
            <Table.Td>{transition.to_state}</Table.Td>
            <Table.Td>{transition.command}</Table.Td>
            <Table.Td>{transition.user_id}</Table.Td>
            <Table.Td>{new Date(transition.timestamp).toLocaleString()}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

## Version Comparison Component

Compare changes between versions.

```tsx
'use client';

import { useVersions } from '@/lib/hooks/useVersions';
import { Stack, Group, Text, Button } from '@mantine/core';

interface VersionComparisonProps {
  collection: string;
  itemId: string;
}

export function VersionComparison({ collection, itemId }: VersionComparisonProps) {
  const { versions } = useVersions(collection, itemId);
  
  if (versions.length < 2) {
    return <Text c="dimmed">Need at least 2 versions to compare</Text>;
  }
  
  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>Compare Versions</Text>
      {/* Implementation for showing diffs between versions */}
    </Stack>
  );
}
```

## Best Practices

### Version Management
1. **Save incrementally** - Don't wait for all edits to save
2. **Show version name** - Use meaningful names like "Draft 1", "Review Round 1"
3. **Confirm version creation** - Warn users when creating new versions
4. **Preserve history** - Never delete versions, only mark as archived

### Workflow Integration
1. **Disable editing in published state** - Prevent accidental edits to published items
2. **Show available transitions** - Display only allowed commands for current user
3. **Provide feedback** - Show loading states during transitions
4. **Log transitions** - Maintain complete audit trail

### Performance
1. **Lazy load versions** - Only fetch when needed
2. **Cache workflow states** - Avoid re-fetching unless necessary
3. **Batch updates** - Combine multiple edits before saving
4. **Debounce polling** - Use 2-5 second intervals for workflow state checks
