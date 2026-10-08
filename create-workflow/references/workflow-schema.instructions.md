---
name: Workflow JSON Schema
description: Complete workflow definition schema and configuration guide
applyTo: "**/*.{ts,tsx,json}"
---

# Workflow JSON Schema

Complete reference for defining workflow state machines in DaaS.

## Overview

Workflows provide:

- **State machines** for content lifecycle (draft → review → published)
- **Policy-based authorization** for state transitions
- **Automatic instance creation** when items match assignment rules
- **Actions** for side effects (notifications, version promotion)
- **Version awareness** for content versioning integration

> **Key Column**: Workflow state machines are stored in the `workflow_json` JSONB column of `daas_wf_definition`. This column must contain a valid `WorkflowDefinition` object (see schema below).

---

## Workflow Tables

| Table                | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `daas_wf_definition` | Workflow definitions (`workflow_json` column = state machine) |
| `daas_wf_assignment` | Links workflows to collections via filter rules               |
| `daas_wf_instance`   | Active workflow instances tracking current state              |

---

## Collection Requirements for Workflow

A collection that uses workflows carries these fields:

| Field               | Type      | Purpose                             | How the system finds it                                                             |
| ------------------- | --------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `workflow_state`    | String    | Stores current state name           | `meta.interface = 'xtr-interface-workflow'`                                         |
| `workflow_instance` | UUID (FK) | Links item to its workflow instance | A many-to-one relation whose target is `daas_wf_instance` (foreign key + `daas_relations` row) |

What each one is for:

- **Instances are created from the assignment**, whether or not either field exists. When an item is created the engine looks up `daas_wf_assignment` for the collection, and creates a `daas_wf_instance` row holding the item's id and the workflow's initial state.
- **`workflow_state`** is what the engine writes the state to — on creation and after every transition. Without it the instance still advances, but the item never shows its state.
- **`workflow_instance`** is a convenience pointer from the item to its instance. It is filled only when the field is a real relation. `WorkflowButton` does not need it: it finds the instance by `collection` + `item_id`.

**🔴 Declare the relation with `meta.options.related_collection`.** That (with `special: ["m2o"]`) is what creates the foreign key and the relation, on both backends. `schema.foreign_key_table` is **not** read on create — the Next.js backend ignores it and the Go engine refuses it with 400 — so a field declared that way is a bare uuid column and is never filled.

### Field Definitions (MCP)

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
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true,
          "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" }
        }
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

### Common Mistakes

❌ **WRONG** — the relation named in `schema`. No foreign key, no relation, the column is never filled:

```json
{
  "field": "workflow_instance",
  "type": "uuid",
  "meta": { "interface": "select-dropdown-m2o", "special": ["m2o"], "readonly": true, "hidden": true },
  "schema": { "foreign_key_table": "daas_wf_instance" }
}
```

✅ **CORRECT** — the relation named in `meta.options`:

```json
{
  "field": "workflow_instance",
  "type": "uuid",
  "schema": { "is_nullable": true },
  "meta": {
    "interface": "select-dropdown-m2o",
    "special": ["m2o"],
    "readonly": true,
    "hidden": true,
    "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" }
  }
}
```

❌ **WRONG** — the field listed inline in the `collections` create call (observed on DaaS 0.1.98). That path gives every `uuid` column `DEFAULT gen_random_uuid()`: with the relation, every insert fails on the foreign key; without it, the column fills with random UUIDs that name no instance. Create the collection first, then add `workflow_instance` with the `fields` tool.

Check the result with the `relations` tool (`action: "read"`, `collection`): there must be a row with `many_field: "workflow_instance"` and `one_collection: "daas_wf_instance"`.

### Filter Rule Fields

If your workflow assignment uses `filter_rule`, the referenced fields must exist in the collection:

```json
// Assignment with filter_rule
{ "filter_rule": { "status": { "_neq": "archived" } } }

// ⚠️ Requires 'status' field in the collection!
```

---

## Workflow Definition JSON Schema

### Complete Schema

```typescript
interface WorkflowDefinition {
  /** Initial state when workflow instance is created */
  initial_state: string;

  /** All states in the workflow */
  states: WorkflowState[];
}

interface WorkflowState {
  /** Unique state name (must match references in commands) */
  name: string;

  /** Available transitions from this state */
  commands: WorkflowCommand[];

  /** If true, no transitions are possible from this state */
  isEndState: boolean;
}

interface WorkflowCommand {
  /** Display name for the transition button */
  name: string;

  /** Target state after successful transition */
  next_state: string;

  /** Policy UUIDs required to execute (user needs at least one). OR'd with module_access_keys — satisfying either grants access. */
  policies: string[];

  /**
   * Module-level access key names required to execute (user needs at least one).
   * OR'd with policies — satisfying either grants access.
   * Keys must exist in daas_module_access_keys. Example: ["workflow:approve"]
   */
  module_access_keys?: string[];

  /** Side effects to execute after transition */
  actions: WorkflowAction[];
}

interface WorkflowAction {
  /** Human-readable action name */
  name: string;

  /** Event name to emit (registered handler will execute) */
  event_name: string;

  /** Additional data passed to the action handler */
  parameters?: Record<string, any>;
}
```

### JSON Schema (for validation)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["initial_state", "states"],
  "properties": {
    "initial_state": {
      "type": "string",
      "description": "Name of the initial state when workflow instance is created"
    },
    "states": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "commands", "isEndState"],
        "properties": {
          "name": {
            "type": "string",
            "description": "Unique state identifier"
          },
          "commands": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["name", "next_state", "policies", "actions"],
              "properties": {
                "name": {
                  "type": "string",
                  "description": "Command/transition display name"
                },
                "next_state": {
                  "type": "string",
                  "description": "Target state after transition"
                },
                "policies": {
                  "type": "array",
                  "items": { "type": "string", "format": "uuid" },
                  "description": "Policy UUIDs required (user needs at least one). OR'd with module_access_keys — satisfying either grants access."
                },
                "module_access_keys": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "Module access key names required (user needs at least one). OR'd with policies. Keys from daas_module_access_keys e.g. [\"workflow:approve\"]."
                },
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["name", "event_name"],
                    "properties": {
                      "name": {
                        "type": "string",
                        "description": "Action display name"
                      },
                      "event_name": {
                        "type": "string",
                        "description": "Event to emit (e.g., xtr.item.promote)"
                      },
                      "parameters": {
                        "type": "object",
                        "description": "Additional data for the action"
                      }
                    }
                  }
                }
              }
            }
          },
          "isEndState": {
            "type": "boolean",
            "description": "If true, no transitions possible from this state"
          }
        }
      }
    }
  }
}
```

---

## Example Workflows

### Simple Approval Workflow

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit for Review",
          "next_state": "Pending Review",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Pending Review",
      "commands": [
        {
          "name": "Approve",
          "next_state": "Published",
          "policies": ["reviewer-policy-uuid"],
          "actions": []
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": ["reviewer-policy-uuid"],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Published",
      "commands": [
        {
          "name": "Unpublish",
          "next_state": "Draft",
          "policies": ["admin-policy-uuid"],
          "actions": []
        }
      ],
      "isEndState": false
    }
  ]
}
```

### Multi-Level Approval with Actions

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit",
          "next_state": "Manager Review",
          "policies": [],
          "actions": [
            {
              "name": "Notify Manager",
              "event_name": "xtr.notify.email",
              "parameters": {
                "template": "review_request",
                "to_role": "manager"
              }
            }
          ]
        }
      ],
      "isEndState": false
    },
    {
      "name": "Manager Review",
      "commands": [
        {
          "name": "Approve",
          "next_state": "Legal Review",
          "policies": ["manager-policy-uuid"],
          "actions": [
            {
              "name": "Notify Legal",
              "event_name": "xtr.notify.email",
              "parameters": {
                "template": "legal_review_request"
              }
            }
          ]
        },
        {
          "name": "Request Changes",
          "next_state": "Draft",
          "policies": ["manager-policy-uuid"],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Legal Review",
      "commands": [
        {
          "name": "Approve & Publish",
          "next_state": "Published",
          "policies": ["legal-policy-uuid"],
          "actions": [
            {
              "name": "Promote Version",
              "event_name": "xtr.item.promote",
              "parameters": {}
            },
            {
              "name": "Notify Author",
              "event_name": "xtr.notify.email",
              "parameters": {
                "template": "content_published"
              }
            }
          ]
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": ["legal-policy-uuid"],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Published",
      "commands": [],
      "isEndState": true
    }
  ]
}
```

### Version-Aware Workflow

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [
        {
          "name": "Submit for Approval",
          "next_state": "Pending Approval",
          "policies": [],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Pending Approval",
      "commands": [
        {
          "name": "Approve & Promote",
          "next_state": "Published",
          "policies": ["approver-policy-uuid"],
          "actions": [
            {
              "name": "Promote to Main",
              "event_name": "xtr.item.promote",
              "parameters": {
                "reason": "Approved for publication"
              }
            }
          ]
        },
        {
          "name": "Reject",
          "next_state": "Draft",
          "policies": ["approver-policy-uuid"],
          "actions": []
        }
      ],
      "isEndState": false
    },
    {
      "name": "Published",
      "commands": [],
      "isEndState": true
    }
  ]
}
```

---

## Built-in Actions

Only the two events listed below ship as built-in handlers in DaaS (`lib/hooks/workflow-actions.ts` registers `xtr.item.promote` and `xtr.event_test.write_log`). Any other `event_name` you reference (e.g. an email-notify event) must be registered as a custom action handler — referencing an unregistered event silently no-ops.

### xtr.item.promote

Promotes a content version to the main item.

```json
{
  "name": "Promote Version",
  "event_name": "xtr.item.promote",
  "parameters": {
    "reason": "Approved by reviewer"
  }
}
```

**Behavior:**

- Only executes if workflow instance has `version_key` (is for a version)
- Uses `VersionService.promote()` to merge version delta to main item
- Silently skips if workflow is for main item (no version)

### xtr.event_test.write_log

Test/debug action that logs transition details.

```json
{
  "name": "Debug Log",
  "event_name": "xtr.event_test.write_log",
  "parameters": {
    "message": "Transition completed"
  }
}
```

---

## Creating Workflows via MCP

### Step 1: Create Workflow Definition

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_definition",
    "data": {
      "name": "Article Approval",
      "description": "Standard article review workflow",
      "workflow_json": {
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
                "policies": ["reviewer-policy-uuid"],
                "actions": []
              },
              {
                "name": "Reject",
                "next_state": "Draft",
                "policies": ["reviewer-policy-uuid"],
                "actions": []
              }
            ],
            "isEndState": false
          },
          {
            "name": "Published",
            "commands": [],
            "isEndState": true
          }
        ]
      }
    }
  }
}
```

### Step 2: Create Workflow Assignment

Link workflow to a collection with filter rules:

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_assignment",
    "data": {
      "workflow": "workflow-definition-uuid",
      "collection": "articles",
      "filter_rule": {
        "status": { "_neq": "archived" }
      }
    }
  }
}
```

**Filter rule examples:**

```json
// All items in collection
{ }

// Items with specific status
{ "status": "pending" }

// Items in a category
{ "category": "news" }

// Complex filter
{
  "_and": [
    { "status": { "_neq": "archived" } },
    { "type": { "_in": ["article", "blog"] } }
  ]
}
```

### Step 3: Add Workflow Fields to Collection

For automatic workflow tracking, add these fields to your collection:

**Workflow Instance Field (Foreign Key):**

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "field": "workflow_instance",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true,
          "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" }
        }
      }
    ]
  }
}
```

**Workflow State Field:**

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles",
        "field": "workflow_state",
        "type": "string",
        "meta": {
          "interface": "xtr-interface-workflow",
          "readonly": true
        }
      }
    ]
  }
}
```

---

## Workflow Assignment Rules

### Important: One Assignment Per Item

When an item is created:

1. System queries `daas_wf_assignment` for matching collection
2. Filters assignments by `filter_rule` against the item
3. **Exactly ONE** assignment must match
4. If 0 or 2+ match, workflow creation is skipped

### Example: Multiple Workflows for One Collection

Use distinct filter rules:

```json
// Assignment 1: News articles
{
  "collection": "articles",
  "filter_rule": { "category": "news" },
  "workflow": "news-workflow-uuid"
}

// Assignment 2: Blog posts
{
  "collection": "articles",
  "filter_rule": { "category": "blog" },
  "workflow": "blog-workflow-uuid"
}

// Assignment 3: Press releases
{
  "collection": "articles",
  "filter_rule": { "category": "press" },
  "workflow": "press-workflow-uuid"
}
```

Each article matches **exactly one** assignment based on its category.

---

## Executing Transitions

### API Endpoint

```bash
POST /api/workflow/transition
Content-Type: application/json
Authorization: Bearer <token>

{
  "workflowInstanceId": "instance-uuid",
  "commandName": "Approve"
}
```

### From an agent (MCP)

There is **no MCP action that runs a transition** — the `items` tool cannot do it, and there is no `_workflow_transition` collection. A transition is always the REST call above, made with the session of the user who is transitioning (that user is who the command's gate is checked against and who the history records).

MCP is for finding the instance to transition:

```json
{
  "name": "items",
  "arguments": {
    "action": "read",
    "collection": "daas_wf_instance",
    "query": {
      "filter": {
        "collection": { "_eq": "articles" },
        "item_id": { "_eq": "article-uuid" }
      },
      "fields": ["id", "current_state", "workflow", "terminated"]
    }
  }
}
```

### What the endpoint answers

| Status | Body | Meaning |
| ------ | ---- | ------- |
| 200 | `{ "message": "Successfully transitioned workflow state" }` | Instance moved, history written, item's state field updated |
| 400 | `{ "error": "Command \"X\" not found in state \"Draft\"" }` | Not a command of the current state |
| 400 | `{ "error": "Current state \"Draft\" not found in workflow definition" }` | The definition was edited and no longer has the state this instance is in |
| 403 | `{ "message": "You are not authorized to perform this transition" }` | The caller holds none of the command's policies or module access keys |
| 404 | `{ "error": "Workflow instance not found" }` | Unknown instance id |

The endpoint runs its writes with elevated permissions, so the command's gate is the **only** authorization: the caller's permissions on the collection are not consulted. A command with no `policies` and no `module_access_keys` can therefore be run by any authenticated user who has the instance id.

---

## Policy Authorization

### How Policy Check Works

1. User attempts transition with `commandName`
2. System finds command in current state
3. If `policies` is empty, transition is allowed
4. If `policies` has UUIDs, user must have **at least one** policy

### User's Policies Come From

1. **Direct assignment**: `daas_access.user = user_id`
2. **Role assignment**: `daas_access.role = user's role`
3. **Public policies**: `daas_access.user IS NULL AND role IS NULL`

### Example Setup

```json
// 1. Create policy
{
  "name": "policies",
  "arguments": {
    "action": "create",
    "data": [{
      "name": "Article Reviewer",
      "description": "Can approve/reject articles"
    }]
  }
}

// 2. Assign to role
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_access",
    "data": {
      "role": "editor-role-uuid",
      "policy": "reviewer-policy-uuid"
    }
  }
}

// 3. Reference in workflow
{
  "name": "Approve",
  "next_state": "Published",
  "policies": ["reviewer-policy-uuid"],
  "actions": []
}
```

---

## Version Integration

### Version-Aware Workflow Flow

1. **Create Version**: `POST /api/versions` with `collection`, `item`, `key`
2. **Hook Triggers**: `versions.create` event fires
3. **Workflow Created**: Instance with `version_key` populated
4. **State Updates**: Via `VersionService.save()` (creates version deltas)
5. **Promote on Approval**: `xtr.item.promote` action merges to main item

### Query Version's Workflow

```json
{
  "name": "items",
  "arguments": {
    "action": "read",
    "collection": "daas_wf_instance",
    "query": {
      "filter": {
        "collection": { "_eq": "articles" },
        "item_id": { "_eq": "article-uuid" },
        "version_key": { "_eq": "draft" }
      }
    }
  }
}
```

---

## Complete Workflow Setup Checklist

When creating a workflow-enabled collection, follow these steps IN ORDER:

### Step 1: Create the Collection

```json
{
  "name": "mcp_daas_collections",
  "arguments": {
    "action": "create",
    "data": { "collection": "your_collection" }
  }
}
```

### Step 2: Create Business Fields

Add your regular fields (title, content, status, etc.)

### Step 3: Create Workflow Fields (CRITICAL!)

**Add them with the `fields` tool after the collection exists; `workflow_instance` declares its relation in `meta.options`:**

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
        "schema": { "is_nullable": true },
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["m2o"],
          "readonly": true,
          "hidden": true,
          "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" }
        }
      },
      {
        "collection": "your_collection",
        "field": "workflow_state",
        "type": "string",
        "meta": {
          "interface": "xtr-interface-workflow",
          "readonly": true
        }
      }
    ]
  }
}
```

### Step 4: Create Workflow Definition

```json
{
  "name": "mcp_daas_items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_definition",
    "data": {
      "name": "Your Workflow Name",
      "description": "Description of the workflow",
      "workflow_json": {
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
          {
            "name": "Published",
            "commands": [],
            "isEndState": true
          }
        ]
      }
    }
  }
}
```

### Step 5: Create Workflow Assignment

Links the workflow definition to the collection:

```json
{
  "name": "mcp_daas_items",
  "arguments": {
    "action": "create",
    "collection": "daas_wf_assignment",
    "data": {
      "workflow": "<ID from Step 4>",
      "collection": "your_collection",
      "filter_rule": {}
    }
  }
}
```

> **The FK column is `workflow`, not `workflow_definition`.** Don't include `auto_assign` or `status` — they aren't part of the assignment schema and are silently dropped (or rejected) by MCP. The Step 2 example earlier in this document already uses the correct shape; this section is the canonical write payload.

### Step 6: Verify Setup

Create a test item and verify:

1. `workflow_instance` is populated with a UUID
2. `workflow_state` is set to the initial state

---

## Troubleshooting

### Items Created Without a Linked workflow_instance

**Symptoms:** New items have `workflow_instance: null`, or a UUID that matches no row in `daas_wf_instance`, while `workflow_state` is set correctly.

**Cause:** The field is not a real relation to `daas_wf_instance`. It was declared with `schema.foreign_key_table` (ignored on create) or without `meta.options.related_collection`, so there is no foreign key and no `daas_relations` row. A random UUID additionally means the field was listed inline in the `collections` create call, which gave the column a `gen_random_uuid()` default.

**Check:** `relations` tool, `action: "read"`, `collection: "your_collection"` — a correctly created field has a row with `many_field: "workflow_instance"`, `one_collection: "daas_wf_instance"`.

**Fix:** Updating the field's `meta` does not create the relation. On a new collection, delete the field and create it again with the `fields` tool and `meta.options.related_collection` (see [Field Definitions](#field-definitions-mcp)). On a collection that already has rows, the column's default and its stray values have to be corrected with a migration before a foreign key can be added.

The workflow itself is unaffected: instances exist and transitions work, because the instance is found through `collection` + `item_id`.

### Items Created Without Any Instance

**Symptoms:** No row in `daas_wf_instance` for the item; `workflow_state` stays null.

**Causes:**

1. No assignment for the collection, or the item matches no assignment's `filter_rule`.
2. More than one assignment matches. The engine refuses to choose and creates nothing; the Logs page shows "Multiple workflow assignments matched".
3. You read the create response. The instance is created by a hook *after* the insert, so the response still carries `workflow_state: null` — read the item again.

### Workflow Won't Open / Display

**Symptoms:** Clicking on workflow shows nothing or errors

**Cause:** The `workflow_json` format is incorrect.

**Wrong format (DO NOT USE):**

```json
{
  "initialState": "Draft",
  "states": {
    "Draft": { "transitions": [...] }
  }
}
```

**Correct format:**

```json
{
  "initial_state": "Draft",
  "states": [
    {
      "name": "Draft",
      "commands": [...],
      "isEndState": false
    }
  ]
}
```

### Transitions Don't Execute

**Symptoms:** Clicking transition buttons has no effect

**Causes & Fixes:**

1. **No instance** - see "Items Created Without Any Instance" above; the button shows no state
2. **The button is inert** - on Buildpad UI 3.0.0 a `readonly` state field disables the button inside a form; render it outside the form (see the create-workflow skill, step 5)
3. **404 on the transition** - the app has no route for `POST /api/workflow/transition`; on Buildpad UI 3.0.0 the button posts to the app's own origin, which needs a proxy to DaaS
4. **403 "not authorized"** - the user holds none of the command's `policies` (policy ids, not access-row ids) or `module_access_keys`; on DaaS 0.1.98 that includes administrators
5. **403 on load** - the user has no read permission on `daas_wf_instance` / `daas_wf_definition`

### Workflow State Not Updating After Transition

**Symptoms:** Transition succeeds but `workflow_state` doesn't change

**Causes** (observed on DaaS 0.1.98 — the endpoint answers 200 in every one of them, because a failure to write the item's state field is logged, not returned):

1. The `workflow_state` field is missing the `xtr-interface-workflow` interface (fix below).
2. A filter extension on `<collection>.items.update` threw while the engine wrote the state.
3. The collection is scope-enabled and the request carried no `X-Resource-Uri`: the engine's write is filtered to the root scope and matches no row.

Compare `daas_wf_instance.current_state` with the item's `workflow_state` to see whether they have drifted.

**Fix:**

```json
{
  "name": "mcp_daas_fields",
  "arguments": {
    "action": "update",
    "collection": "your_collection",
    "field": "workflow_state",
    "data": {
      "meta": {
        "interface": "xtr-interface-workflow",
        "readonly": true
      }
    }
  }
}
```

### Workflow JSON Schema Validation Errors

**Common mistakes:**

- Using `initialState` instead of `initial_state`
- Using object for `states` instead of array
- Missing `commands` array (even if empty)
- Missing `isEndState` boolean
- Using `policies` as objects instead of UUID strings

---

## Troubleshooting

### Workflow not created

| Symptom                              | Cause                      | Solution                                            |
| ------------------------------------ | -------------------------- | --------------------------------------------------- |
| No instance created                  | No assignment matches      | Check `filter_rule`                                 |
| No instance created                  | Multiple assignments match | Make filters mutually exclusive                     |
| Instance created, fields not updated | Missing workflow fields    | Add `workflow_instance` and `workflow_state` fields |

### Transition fails

| Error                | Cause          | Solution                    |
| -------------------- | -------------- | --------------------------- |
| "Not authorized"     | Missing policy | Assign policy to user/role  |
| "Command not found"  | Wrong state    | Check current_state matches |
| "Instance not found" | Invalid UUID   | Verify workflowInstanceId   |

### Actions not executing

| Symptom         | Cause                  | Solution                          |
| --------------- | ---------------------- | --------------------------------- |
| Action skipped  | No handler registered  | Register event handler            |
| Promote skipped | Main item (no version) | Only works with version workflows |

---

## Related Instructions

- See [permissions-filtering.instructions.md](../../create-rbac/references/permissions-filtering.instructions.md) for policy setup
- See [hooks-extensions.instructions.md](../../hooks-extensions/references/hooks-extensions.instructions.md) for custom action handlers
- See [daas-mcp-tools.instructions.md](../../daas-platform/references/daas-mcp-tools.instructions.md) for MCP workflow operations
- See [workflow-versioning.instructions.md](./workflow-versioning.instructions.md) for version integration patterns
