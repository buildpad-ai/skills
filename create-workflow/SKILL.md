---
name: create-workflow
description: Create workflow state machines, content versioning, and multi-stage approval processes for DaaS collections. Sets up workflow definitions, assignments, required fields, and WorkflowButton UI. Use when the user needs content lifecycles (draft/published), approval workflows, or state machine transitions.
argument-hint: "[collection name] [workflow type: simple|review|multi-level|version-based]"
---

# Create Workflow & Versioning

Set up workflow state machines and content versioning for DaaS collections.

## Pre-requisite: Collection Must Exist with Workflow Fields

**Before creating a workflow**, the target collection must already exist and include the workflow fields (Group B from `create-collection` skill). If the collection doesn't exist yet, invoke the `create-collection` skill first, ensuring Group B workflow fields are included.

If the collection already exists but lacks workflow fields, add them using the MCP payload from the [Standard Fields reference](../create-collection/references/standard-fields.instructions.md#group-b-workflow-fields-include-when-collection-uses-workflows) **before** proceeding with workflow definition and assignment.

> **Do NOT create custom status fields or manual state management.** DaaS Workflows are a built-in platform feature. See [Built-in DaaS features](../daas-platform/references/builtin-features.instructions.md) for the full list of features you must not rebuild.

## Handling an Existing `status` (or similar) Field

If the target collection already has a custom lifecycle field (e.g. `status: select-dropdown` with values like `todo`/`in_progress`/`done`), `workflow_state` will be the new source of truth. **DaaS does not support deleting field metadata via the MCP API**, so the existing field must be hidden rather than removed — and there are two follow-up actions you must take, or items will fail to save:

1. **Hide the field AND drop its `required` flag.** Setting `meta.hidden = true` alone is not enough: if `meta.required = true` is left in place, every item create that doesn't supply the old field will 400. Update both at once:
   ```json
   {
     "name": "mcp_daas_fields",
     "arguments": {
       "action": "update",
       "collection": "your_collection",
       "field": "status",
       "data": { "meta": { "hidden": true, "required": false } }
     }
   }
   ```
   Alternatively, set a column-level default in the database so writes that omit the field still satisfy `NOT NULL`.

2. **Migrate consumers off the old field.** Search the codebase for the old field name and replace with `workflow_state`. Common offenders: `archiveField="status"` / `archiveValue="cancelled"` props on `CollectionList`, custom badges keyed off `item.status`, filter UIs, and seed data. Leaving these in place silently breaks the new lifecycle.

## Workflow-Enabled Collection Requirements

Any collection using workflows MUST have these fields:

| Field               | Type   | Purpose                         | Required Meta                                               |
| ------------------- | ------ | ------------------------------- | ----------------------------------------------------------- |
| `workflow_instance` | uuid   | Links item to workflow instance | `special: ["m2o"]`, `foreign_key_table: "daas_wf_instance"` |
| `workflow_state`    | string | Stores current workflow state   | `interface: "xtr-interface-workflow"`                       |

## Setup Steps

### 1. Add Workflow Fields to Collection

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "your_collection",
        "field": "workflow_instance",
        "type": "uuid",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true
        },
        "schema": { "foreign_key_table": "daas_wf_instance" }
      },
      {
        "collection": "your_collection",
        "field": "workflow_state",
        "type": "string",
        "meta": { "interface": "xtr-interface-workflow", "readonly": true }
      }
    ]
  }
}
```

### 2. Create Workflow Definition

Create in `daas_wf_definition` with `workflow_json`. **Naming convention: state and command names are display strings rendered directly by `WorkflowButton` — use Title Case with spaces ("In Progress", "Submit for Review"), not snake_case identifiers.** They must match exactly across `initial_state`, `states[].name`, and `commands[].next_state`.

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit",
          "next_state": "Review",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Review",
      "commands": [
        {
          "name": "Approve",
          "next_state": "Published",
          "policies": [],
          "actions": []
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    { "name": "Published", "commands": [], "isEndState": true }
  ]
}
```

> **Default behavior: `policies: []` means anyone with collection write access can run the command.** This skill leaves policies empty by default. To gate a command to a specific role, follow the [Locking commands to roles](#locking-commands-to-roles) section below before considering setup complete — or surface to the user that the workflow is unsecured.

### 3. Create Workflow Assignment

Create in `daas_wf_assignment`. The assignment row links a definition to a collection; `filter_rule: {}` means "every item in the collection gets a workflow instance auto-created on insert."

```json
{
  "workflow": "<workflow-definition-uuid>",
  "collection": "your_collection",
  "filter_rule": {}
}
```

> **Field name is `workflow`, not `workflow_definition`.** Do not include `auto_assign` or `status` columns — they are not part of the assignment schema and will be silently dropped or rejected by MCP.

### 4. (Optional) Generated Supabase Migration

Even though steps 1–3 use MCP only, the local Supabase database also needs the new columns mirrored so app code (and tests) can read/write them. Generate a migration alongside the MCP changes:

```sql
-- supabase/migrations/<timestamp>_add_workflow_to_<collection>.sql
alter table public.<collection>
    add column if not exists workflow_instance uuid null references daas_wf_instance(id) on delete set null,
    add column if not exists workflow_state    text null;

create index if not exists idx_<collection>_workflow_instance on public.<collection> (workflow_instance);
```

Tell the user to commit this file — leaving it uncommitted means teammates' local databases drift from DaaS.

### 5. Add WorkflowButton to UI

```tsx
import { WorkflowButton } from "@/components/ui/workflow-button";

<WorkflowButton
  itemId={itemId}
  collection="articles"
  onTransition={() => refetch()}
/>;
```

## Locking Commands to Roles

The default skill output produces an unsecured workflow. To restrict a transition to a specific role:

1. Confirm a role exists (`mcp_daas_roles` action: `read`) and find or create a policy via `mcp_daas_policies`. A policy is the unit you reference from `workflow_json` — not the role itself.
2. Link the policy to the role via `mcp_daas_access`. Capture the resulting `daas_access.id` UUID.
3. Update the relevant command's `policies` array in `workflow_json` to include that UUID. A user can run the command if they hold any policy listed.

```json
{
  "name": "Approve",
  "next_state": "Published",
  "policies": ["<daas-access-uuid-for-approve-tasks-policy>"],
  "actions": []
}
```

## Locking Commands to Module Access Keys (alternative / complement)

Instead of (or alongside) policy UUIDs, commands can be gated by named module-level access keys from `daas_module_access_keys`. This is preferred when the capability is already modelled as a key (e.g. the platform seeds `workflow:approve` and `workflow:reject`).

```json
{
  "name": "Approve",
  "next_state": "Published",
  "policies": [],
  "module_access_keys": ["workflow:approve"],
  "actions": []
}
```

`policies` and `module_access_keys` are **OR'd** — the user may execute the command if they satisfy either list. Both can be populated simultaneously.

To grant a key to a role:
1. Confirm the key exists in `daas_module_access_keys` (the platform seeds `workflow:approve` and `workflow:reject` by default).
2. Find or create the policy for the role.
3. Set `module_access: { "workflow:approve": true }` on that policy:

```json
{
  "name": "mcp_daas_policies",
  "arguments": {
    "action": "update",
    "id": "<policy-uuid>",
    "data": { "module_access": { "workflow:approve": true } }
  }
}
```

Users whose effective policies OR-merge to `workflow:approve: true` can then run the command without their policy UUID ever appearing in `policies[]`. This makes permission grants portable across environments (no UUID hard-coding).

If the user explicitly opts out of role gating, mention it once in your final summary so they know what was left open.

## Verify the Workflow Was Set Up Correctly

After running the steps above, confirm the following before reporting success — silent failures here (especially missing `special: ["m2o"]` and the wrong assignment field name) are common:

1. **Fields exist with correct meta** — `mcp_daas_fields` action: `read`, collection: `<your_collection>`. Confirm `workflow_instance` has `meta.special = ["m2o"]` and `schema.foreign_key_table = "daas_wf_instance"`; confirm `workflow_state` has `meta.interface = "xtr-interface-workflow"`.
2. **Definition is valid JSON** — `mcp_daas_items` action: `read`, collection: `daas_wf_definition`. The new row's `workflow_json` should round-trip parse and every `commands[].next_state` should match a `states[].name`.
3. **Assignment is wired up** — `mcp_daas_items` action: `read`, collection: `daas_wf_assignment`. There should be exactly one row with `workflow = <your-definition-id>` and `collection = "<your_collection>"`.
4. **Auto-instance creation works** — create one item in the collection (`mcp_daas_items` action: `create`). Read it back and confirm `workflow_instance` is populated with a UUID and `workflow_state` matches `initial_state`. If `workflow_instance` is null, the `special: ["m2o"]` meta is missing or the assignment is wrong.
5. **(If the user asked for role gating)** Each command has a non-empty `policies` or `module_access_keys` array, and signing in as a non-permitted user hides the corresponding button in `WorkflowButton`.

Surface any failures here to the user — do not stop at "the MCP calls returned 200."

## Common Patterns

- **Simple Draft/Published**: 2 states, 2 commands
- **Content Review**: draft → under_review → published/rejected
- **Multi-Level Approval**: draft → manager_review → director_review → published
- **Version-Based**: Each version has its own workflow state

## Hooks

```typescript
import { useWorkflowAssignment } from "@/lib/buildpad/hooks";
import { useVersions, useWorkflowVersioning } from "@/lib/buildpad/hooks";
```

## References

- [Workflow JSON schema](references/workflow-schema.instructions.md)
- [Workflow versioning](references/workflow-versioning.instructions.md)
- [Workflow components](references/workflow-components.instructions.md)
