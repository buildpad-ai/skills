---
name: Scope Management (Engine project)
description: API reference for the scope system of an Engine project — scope types, items and collection settings below the project tenant, user-role assignments, scoped access entries, the resource URI format, and the available-scopes route.
applyTo: "**/*.{ts,tsx}"
---

<!-- buildpad-backend-file: engine -->
<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

# Scope Management Instructions (Engine project)

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

In the mode `customer-tenants` every scope URI begins with the current customer's node: the `uri_path` of the `current` entry of `GET /api/auth/tenants`, never the Blueprint's and never one built from `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A customer's administrator may create scope types and nodes beneath their own tenant node. Direct no root type and no first-level node: a first-level node is a tenant, which only the host creates.

The Engine's scope system provides hierarchical data separation inside the project using `daas_scope_types` (hierarchy levels) and `daas_scope_items` (concrete nodes). The active scope of any request is the `X-Resource-Uri` header; a cookie on the app's origin never reaches the Engine. Every write below needs an administrator's session (`Authorization: Bearer <access token>`); never send the project's MCP token to these routes.

---

## Resource URI Format

Every scope item has a `uri_path` that the Engine composes from its ancestry. The first segment is always the project's tenant node:

```
/<tenant-type-id>:<tenant-id>/<type1-id>:<item1-id>/<type2-id>:<item2-id>/...
```

**Examples:**

| Level                         | uri_path                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| The project's tenant node     | `/<tenant-type-id>:<tenant-id>`                                                  |
| First level (Region = APAC)   | `/<tenant-type-id>:<tenant-id>/<region-type-id>:<apac-id>`                       |
| Second level (Branch = SGP)   | `/<tenant-type-id>:<tenant-id>/<region-type-id>:<apac-id>/<branch-type-id>:<sgp-id>` |

**Rules:**
- No trailing slash
- Segments separated by `/`
- Each segment is `<type-id>:<item-id>`
- Ancestors are a prefix of the child URI — `URI.startsWith(parentURI + '/')` or `URI === parentURI`
- The Engine composes it; a `uri_path` sent by a client is refused

---

## Scope Types — `/api/scope/types`

| Method | Route                    | Notes |
| ------ | ------------------------ | ----- |
| GET    | `/api/scope/types`       | The project's types, its tenant's type included |
| GET    | `/api/scope/types/:id`   | One type |
| POST   | `/api/scope/types`       | Create a level |
| PATCH  | `/api/scope/types/:id`   | Change `name`, `parent_id`, `sort`, `icon` or `note` |
| DELETE | `/api/scope/types/:id`   | Refused while any item, or any child type, uses it |

```json
// POST /api/scope/types
{
  "name": "Region",
  "parent_id": "<tenant-type-id>",
  "sort": 1,
  "icon": "public",
  "note": "Top-level geographic grouping"
}
```

| Field       | Type    | Required | Notes                                                                 |
| ----------- | ------- | -------- | --------------------------------------------------------------------- |
| `name`      | string  | ✓        | Display name                                                          |
| `parent_id` | uuid    | ✓        | The type of the level above: the tenant's type, or one of the project's own types |
| `sort`      | integer |          | Display order                                                         |
| `icon`      | string  |          | Icon name                                                             |
| `note`      | string  |          | Human-readable purpose                                                |

A type with no `parent_id` is refused on an Engine project: its nodes would be new tenants, which only the host creates.

---

## Scope Items — `/api/scope/items`

| Method | Route                    | Notes |
| ------ | ------------------------ | ----- |
| GET    | `/api/scope/items`       | The project's nodes |
| GET    | `/api/scope/items/:id`   | One node |
| POST   | `/api/scope/items`       | Create a node |
| PATCH  | `/api/scope/items/:id`   | Change `name` or `sort` only |
| DELETE | `/api/scope/items/:id`   | Refused while referenced; the tenant node is never deleted |

```json
// POST /api/scope/items
{
  "name": "Singapore HQ",
  "scope_type_id": "<branch-type-id>",
  "parent_item_id": "<apac-item-id>",
  "sort": 1
}
```

| Field            | Type    | Required | Notes                                                       |
| ---------------- | ------- | -------- | ----------------------------------------------------------- |
| `name`           | string  | ✓        | Display name                                                |
| `scope_type_id`  | uuid    | ✓        | The type this node belongs to                               |
| `parent_item_id` | uuid    | ✓        | The direct parent node: the tenant node for the first level |
| `sort`           | integer |          | Display order                                               |

The Engine checks three rules: a node of a type that names a parent type needs a `parent_item_id`; the parent must be of that parent type; and a node of a type with no parent type can only be a tenant. It then composes `uri_path` = the parent's `uri_path` + `/` + `scope_type_id` + `:` + the new node's id. A node answers `id`, `name`, `scope_type_id`, `parent_item_id`, `uri_path`, `sort`, and its `scope_type` and `parent`.

**Deletes do not cascade.** Deleting a node that is still referenced — by a child node, a role assignment, an access entry or a row of a scoped collection — is refused, and the answer names the references. Remove or repoint each one first, leaf to root. The project's tenant node cannot be deleted.

---

## Collection Settings — `/api/scope/collection-config`

| Method | Route                                      | Notes |
| ------ | ------------------------------------------ | ----- |
| GET    | `/api/scope/collection-config`             | One row per collection that is confined by scope |
| GET    | `/api/scope/collection-config/:collection` | One collection's setting |
| POST   | `/api/scope/collection-config`             | Register (or replace) a collection's setting |
| PATCH  | `/api/scope/collection-config/:collection` | Change some settings; a body naming nothing is refused |
| DELETE | `/api/scope/collection-config/:collection` | Remove the setting, and with it the confinement |

```json
// POST /api/scope/collection-config
{
  "collection": "orders",
  "field_name": "resource_uri",
  "inheritance_mode": "exact",
  "missing_uri_mode": "reject"
}
```

| Field              | Type   | Values                   | Description                                                                     |
| ------------------ | ------ | ------------------------ | ------------------------------------------------------------------------------- |
| `collection`       | string | any collection name      | Which collection this setting applies to                                        |
| `field_name`       | string | column name              | The field that stores the node's `uri_path` (default `resource_uri`); a many-to-one to `daas_scope_items.uri_path` |
| `inheritance_mode` | string | `"exact"` \| `"down"`    | `exact`: only rows of the active scope; `down` (default): the active scope and every node below it |
| `missing_uri_mode` | string | `"strict"` \| `"reject"` | `strict` (default): a request without `X-Resource-Uri` is served only to a user who reaches every scope, and refused with `MISSING_SCOPE` for anyone else; `reject`: refused for everyone, administrators and the MCP tools included |

The names of the two `missing_uri_mode` values are the reverse of what they suggest: `strict` is the permissive one.

**Setting decision guide:**

| Use case                                        | `inheritance_mode` | `missing_uri_mode` |
| ----------------------------------------------- | ------------------ | ------------------ |
| Strict: each branch owns its own data only      | `exact`            | `reject`           |
| Managers see data for all branches under them   | `down`             | `reject`           |
| Administrators may read every scope at once     | `down`             | `strict`           |
| Fully isolated customers (no parent visibility) | `exact`            | `reject`           |

---

## User-Role Assignments

### MCP: `assign_user_role`, `read_user_roles`, `remove_user_role`

The `scope` MCP tool assigns, reads and removes a user's roles, for administrators only. `assign_user_role` takes its arguments under `assignment`:

```json
{
  "action": "assign_user_role",
  "assignment": {
    "user_id": "<user-uuid>",
    "role_id": "<role-uuid>",
    "resource_uri": "/<tenant-type-id>:<tenant-id>/<region-type-id>:<apac-id>/<branch-type-id>:<sgp-id>"
  }
}
```

`read_user_roles` takes `user_id` (and optionally `role_id` and `resource_uri`) and answers the user's assignments, with `resource_uri` per row. `remove_user_role` takes `user_id`, `role_id` and `resource_uri` at the top level of `arguments`, and removes the assignment at that scope (`resource_uri: null` for the one at no scope). The same tool also creates, reads, changes and deletes scope types, items and collection settings: see the [daas-platform skill](../../daas-platform/SKILL.md). On an Engine older than 0.1.0-dev.19 it has only `assign_user_role` and `create_config`: use the routes.

### REST, with an administrator's session

| Method | Route                                                  | Body / query                                   |
| ------ | ------------------------------------------------------ | ---------------------------------------------- |
| POST   | `/api/users/:id/roles`                                 | `{ "role_id": "<role-uuid>", "resource_uri": "<uri_path>", "sort": 1 }` (answers 201) |
| GET    | `/api/users/:id/roles`                                 | The user's assignments, with `resource_uri` per row |
| DELETE | `/api/users/:id/roles/:roleId?resource_uri=<uri_path>` | Removes the assignment at that scope           |

A role's `scope_config.allowed_scopes` is checked on every assignment (`ROLE_SCOPE_MISMATCH`, `ROLE_SCOPE_LOCKED`).

---

## Scoped Access Entries

To restrict a policy to users operating in a specific scope, set `resource_uri` when creating an access entry (`access` MCP tool, or `POST /api/access`):

```json
// mcp_daas_access -> action: create
{
  "data": {
    "role": "<role-uuid>",
    "policy": "<policy-uuid>",
    "resource_uri": "/<tenant-type-id>:<tenant-id>/<region-type-id>:<apac-id>"
  }
}
```

This policy is only applied when the user's active scope URI is this `resource_uri` or below it, and the role is assigned to the user at or above the active scope.

To filter existing access entries by scope:

```json
// mcp_daas_access -> action: read
{
  "filter_resource_uri": "/<tenant-type-id>:<tenant-id>/<region-type-id>:<apac-id>"
}
```

---

## Available Scopes API

**Endpoint:** `GET /api/scope/available` (any signed-in user, with their own token)

Returns the scopes the current user can switch to, from their own role assignments, plus ancestor nodes for breadcrumb rendering (marked `selectable: false`).

**Response structure:**

```ts
interface AvailableScopes {
  data: AvailableScopeItem[];
  root_access: boolean; // true when the user reaches every scope
}

interface AvailableScopeItem {
  id: string;
  name: string;
  uri_path: string;
  scope_type_id: string;
  scope_type: { id: string; name: string } | null;
  parent_item_id: string | null;
  selectable: boolean; // false = ancestor-only (breadcrumb), true = can switch to
  roles?: { id: string; name: string; inherited: boolean }[]; // the user's roles at this node; absent on ancestor rows
}
```

Rules:
- Items directly assigned to the user → `selectable: true`
- Descendants of assigned items → `selectable: true`
- Ancestors of assigned items (for breadcrumb display) → `selectable: false`

---

## ScopeSwitcher Component

Pre-built component that calls `/api/scope/available` through the app, renders the scope tree, handles selection, and sets the `daas_resource_uri` cookie on the app's own origin.

```tsx
import ScopeSwitcher from '@/components/ScopeSwitcher';

// Place in your header or navigation bar:
<ScopeSwitcher />
```

**Behavior:**
- Fetches available scopes on mount
- Shows items where `selectable !== false` in the selection list
- Full ancestor breadcrumb path is shown for selected item (including non-selectable ancestors)
- On selection: sets `daas_resource_uri` cookie (`path=/`, 30-day expiry) and refreshes the page

The cookie never reaches the Engine: the app turns it into the `X-Resource-Uri` header on every call (see [scope-client](./scope-client.instructions.md)).

**Manual cookie control:**

```ts
// Select a scope
document.cookie = `daas_resource_uri=${encodeURIComponent(uri)}; path=/; max-age=${30 * 24 * 3600}`;

// Clear scope
document.cookie = `daas_resource_uri=; path=/; max-age=0`;
```

---

## Dynamic Variables in Scope Context

Permission filters keep the standard variables inside a scope:

| Variable                | Resolves To                                   |
| ----------------------- | --------------------------------------------- |
| `$CURRENT_USER`         | Current user UUID                             |
| `$CURRENT_USER.<field>` | One column of the current user's own record   |

A path through a relation (`$CURRENT_USER.<relation>.<field>`), `$CURRENT_ROLES` and `$CURRENT_POLICIES` are refused on an Engine project.

When a collection has a scope setting, the Engine confines its rows to the active scope on top of the policy's own filter — you do NOT need to add a manual scope filter in your policy.
