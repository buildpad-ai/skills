---
name: DaaS Built-In Features
description: Comprehensive list of features provided natively by the DaaS platform. Check this reference BEFORE implementing any server-side feature. If DaaS provides it, use it — do NOT rebuild it.
applyTo: "**/*.{ts,tsx,json,sql}"
---

# DaaS Built-In Features — DO NOT Rebuild

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

Before implementing ANY server-side feature, check this list. If DaaS provides it natively, **use the built-in feature**. Building custom implementations creates inconsistency, maintenance burden, and bypasses platform-level security and auditing.

---

## Activity / Audit Trail

**Status: Fully built-in. NEVER build custom audit trail functionality.**

DaaS automatically logs all item mutations (create, update, delete) to the `daas_activity` table with before/after snapshots and user attribution. No configuration required — it works for every collection by default.

<!-- buildpad-backend: supabase -->
| What | How |
|------|-----|
| Query audit log | `GET /api/activity?collection=articles&action=create,update&limit=50` |
| Filter by user | `GET /api/activity?user_id=<uuid>` |
| Filter by date range | `GET /api/activity?from=2026-01-01&to=2026-03-31` |
| Search audit entries | `GET /api/activity?search=invoice` |
| MCP access | `mcp_daas_items` with `collection: "daas_activity"` (read-only) |

Each activity entry includes: `action`, `timestamp`, `collection`, `item` (PK), `revisions` (before/after snapshot), linked `user` object with email and name. When service account delegation is used (`X-On-Behalf-Of` header), the entry also includes `performed_by` (service account UUID) and a `performer` join with the service account's details.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| What | How |
|------|-----|
| Query audit log | `GET /api/activity?collection=articles&action=create,update&limit=50` |
| Filter by user | `GET /api/activity?user_id=<uuid>` |
| Filter by date range | `GET /api/activity?from=2026-01-01&to=2026-03-31` |
| Search audit entries | `GET /api/activity?search=invoice` |
| MCP access | None on an Engine project: the `mcp_daas_items` tool refuses `daas_activity`. Read the activity through `GET /api/activity` |

Each activity entry includes: `action`, `timestamp`, `collection`, `item` (PK), `revisions` (before/after snapshot), `ip`, `user_agent`, `origin`, `comment`, and a linked `user` object with email, first and last name. When delegation is used (the `X-On-Behalf-Of` header, sent by a signed-in caller whose policy has `delegate_access: true`), the entry also includes `performed_by` (the calling user's UUID) and a `performer` join with that user's details.
<!-- /buildpad-backend -->

**DO NOT build:** custom audit tables, manual logging hooks, activity tracking middleware, change history components that write their own logs.

---

## Workflow / State Machine

**Status: Fully built-in. NEVER build custom state management or approval logic.**

DaaS provides a complete workflow engine with state definitions, command-based transitions, policy authorization, and automatic instance creation.

<!-- buildpad-backend: supabase -->
| What | How |
|------|-----|
| Define workflow | Create item in `daas_wf_definition` with `workflow_json` |
| Assign to collection | Create item in `daas_wf_assignment` with collection + filter_rule |
| Execute transition | `POST /api/workflow/transition` with `workflowInstanceId` + `commandName` |
| Track history | Transition history stored per instance |
| UI component | `WorkflowButton` from Buildpad |
| Hooks | `useWorkflowAssignment`, `useWorkflowVersioning` |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| What | How |
|------|-----|
| Define workflow | `POST /api/workflows` with `name` and `workflow_json` (`PATCH /api/workflows/:id` to change it); the Engine validates the definition |
| Assign to collection | `POST /api/workflow-assignments` with `workflow`, `collection` + `filter_rule` |
| Execute transition | `POST /api/workflow/transition` with `workflowInstanceId` + `commandName` |
| Track history | `GET /api/workflow-instances/:id/history` |
| UI component | `WorkflowButton` from Buildpad |
| Hooks | `useWorkflowAssignment`, `useWorkflowVersioning` |
<!-- /buildpad-backend -->

See the `create-workflow` skill for full setup instructions.

**DO NOT build:** custom status fields with manual update logic, custom approval chains, custom state machine code, manual transition tracking tables, custom "Submit for Review" buttons that update a `status` column directly.

---

## Content Versioning

**Status: Fully built-in. NEVER build custom version/draft management.**

DaaS supports named content versions with delta-based storage. Versions can be promoted to the main item, and integrate with workflows for approval flows.

<!-- buildpad-backend: supabase -->
| What | How |
|------|-----|
| Create version | `POST /api/versions` with `collection`, `item`, `key` |
| Get item with version applied | `GET /api/items/:collection/:id?version=draft` |
| Promote version | Built-in `xtr.item.promote` workflow action |
| Hooks | `useVersions`, `useWorkflowVersioning` |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| What | How |
|------|-----|
| Create version | `POST /api/versions` with `collection`, `item`, `key` |
| Get a version's changes | `GET /api/versions/:id` — its `delta` holds the changes (on an Engine project `GET /api/items/:collection/:id` ignores `version`) |
| Save changes to a version | `POST /api/versions/:id/save` |
| Promote version | `POST /api/versions/:id/promote`, or the built-in `xtr.item.promote` workflow action |
| Hooks | `useVersions`, `useWorkflowVersioning` |
<!-- /buildpad-backend -->

**DO NOT build:** custom version tables, manual diff/snapshot tracking, custom draft management, revision comparison logic.

---

<!-- buildpad-backend: supabase -->
## File Management

**Status: Fully built-in. NEVER build custom file upload/storage.**

DaaS provides comprehensive file management with Supabase Storage backend, including upload, direct-to-storage signed uploads for large files (DaaS ≥ 0.1.93), metadata, thumbnails, and hierarchical folders.

| What | How |
|------|-----|
| Upload file | `POST /api/files` (multipart) through the app's `/api/files` proxy |
| Large upload, direct to storage (DaaS ≥ 0.1.93) | `POST /api/files/signed-url` → `PUT uploadUrl` → `POST /api/files` with `{ upload_token }` — `useFiles().uploadFiles` does this for you |
| Discard a failed signed upload | `DELETE /api/files/signed-url` with `{ upload_token }` |
| List/search files | `GET /api/files` with filters |
| Create folders | `POST /api/folders` |
| MCP tool | `mcp_daas_files` |
| UI components | `FileInterface`, `FileImage`, `Files`, `Upload` from Buildpad |

**Lifecycle events:** Folder CRUD operations emit `daas_folders.items.create/update/delete` events. File operations emit events via `FilesService`.

**DO NOT build:** custom upload API routes (including minting your own signed URLs with `supabase.storage.createSignedUploadUrl`), custom file storage logic, direct inserts into `daas_files`, custom thumbnail generation, custom folder management. The app's `app/api/files/**` routes are thin proxies installed by the CLI, not places for upload logic.

---

## Cron / Scheduled Jobs

**Status: Fully built-in. NEVER build custom scheduling in Next.js.**

DaaS provides scheduled background task execution with cron expressions, timezone support, sandboxed JavaScript, execution history, and manual trigger capability.

| What | How |
|------|-----|
| Create cron job | `mcp_daas_cron` with `action: "create"` |
| Schedule syntax | Standard 5-field cron expression (min hour dom mon dow) |
| Manual trigger | `mcp_daas_cron` with `action: "run_now"` |
| View history | `mcp_daas_cron` with `action: "history"` |
| Shared code | Use DaaS Custom Services (`services.custom("service_name")`) |

**Lifecycle events:** Cron job CRUD operations emit `daas_cron_jobs.items.create/update/delete` events, so you can attach runtime extensions to react to cron job changes (e.g., audit logging when a job is activated).

**DO NOT build:** `setInterval`/`setTimeout` loops, Next.js API route cron handlers, external scheduler integrations (AWS EventBridge, etc.), custom job queue tables.

---

## RBAC / Permissions

**Status: Fully built-in. NEVER build custom access control.**

DaaS provides a complete role-based access control system: Roles → Policies → Permissions with field-level and item-level filtering, all enforced at the database level via RLS.

| What | How |
|------|-----|
| Create role | `mcp_daas_roles` |
| Create policy | `mcp_daas_policies` |
| Assign permissions | `mcp_daas_permissions` |
| Check current user permissions | `GET /api/permissions/me` |
| UI permission gating | `usePermissions` hook, `CollectionList` built-in permission gates |

**Lifecycle events:** Access/role assignment operations emit events: `daas_access.items.create/update/delete` (policy assignments), `daas_user_roles.items.create/delete` (role assignments). Use these to react to permission changes (e.g., sending a notification when a user is granted a new role, or invalidating permission caches when access records change).

**DO NOT build:** custom permission tables, manual `isAdmin` checks against a custom field, custom role assignment UI, manual access control middleware.

---

## Multi-Tenancy / Scope System

**Status: Fully built-in. NEVER build custom tenant isolation.**

DaaS provides a hierarchical scope system using Resource URIs (materialized paths) that automatically filters all queries by the active scope.

| What | How |
|------|-----|
| Define scope types | `mcp_daas_scope` with `action: "create_type"` |
| Create scope items | `mcp_daas_scope` with `action: "create_item"` |
| Register collection | `mcp_daas_scope` with `action: "register_collection"` |
| UI component | `ScopeSwitcher` from Buildpad |
| Set active scope | `X-Resource-Uri` header or `daas_resource_uri` cookie |

See the `manage-scope` skill for full setup instructions.

**Lifecycle events:** Scope CRUD operations emit events on three collections: `daas_scope_types.items.create/update/delete`, `daas_scope_items.items.create/update/delete`, and `daas_scope_collection_config.items.create/update/delete`. Use these to react to scope hierarchy changes (e.g., provisioning resources when a new tenant is created, or invalidating caches when collection config changes).

**DO NOT build:** custom `tenant_id` or `organization_id` columns, manual query filtering by tenant, custom scope switcher UI, manual tenant isolation middleware.

---

## Custom Services (Shared Code)

**Status: Fully built-in. Use for shared business logic between extensions and cron jobs.**

DaaS Custom Services allow you to write reusable JavaScript modules that can be shared between runtime extensions and cron jobs.

| What | How |
|------|-----|
| Create service | `mcp_daas_services` with `action: "create"` |
| Use in extensions/cron | `const svc = services.custom("my_service")` |
| Run tests | `mcp_daas_services` with `action: "run_tests"` |

**Lifecycle events:** Custom service CRUD operations emit `daas_custom_services.items.create/update/delete` events, so you can attach runtime extensions to react to service changes.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## File Management

**Status: Fully built-in. NEVER build custom file upload/storage.**

The Engine provides comprehensive file management, including upload, direct-to-storage signed uploads for large files, metadata, signed URLs, and hierarchical folders.

On an Engine project files are stored and served by the Engine: `/api/files`, `/api/folders`, `/api/files/signed-url`, and file content at `/api/files/assets/:id` (with a session or a signed token). A file shown in a browser, a public one included, is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read: an `<img>` element or a link sends no `X-Tenant-Id`. Set no storage bucket option: the Engine stores files on its own disk or in S3.

| What | How |
|------|-----|
| Upload file | `POST /api/files` (multipart) through the app's `/api/files` proxy |
| Large upload, direct to storage | `POST /api/files/signed-url` → `PUT uploadUrl` → `POST /api/files` with `{ upload_token }` — `useFiles().uploadFiles` does this for you |
| Discard a failed signed upload | `DELETE /api/files/signed-url` with `{ upload_token }` |
| Show or offer a file in a browser | A signed URL from `GET /api/files/signed-url?id=<file id>` |
| List/search files | `GET /api/files` with filters |
| Create folders | `POST /api/folders` |
| MCP tools | `mcp_daas_files`, `mcp_daas_folders` |
| UI components | `FileInterface`, `FileImage`, `Files`, `Upload` from Buildpad |

**Lifecycle events:** On an Engine project the file and folder routes emit no event a hook can bind to.

**DO NOT build:** custom upload API routes (including minting your own signed upload URLs from a storage client), custom file storage logic, direct inserts into `daas_files`, custom thumbnail generation, custom folder management. The app's `app/api/files/**` routes are thin proxies installed by the CLI, not places for upload logic.

---

## Cron / Scheduled Jobs

**Status: Built-in. NEVER build custom scheduling in Next.js.**

The Engine stores cron jobs with cron expressions, a time zone, a JavaScript body, execution history, and manual trigger capability.

On an Engine project an active cron job fires at its scheduled time.

| What | How |
|------|-----|
| Create cron job | The Studio's Cron module, or `POST <Engine_URL>/api/cron` with an administrator's session |
| Schedule syntax | Standard 5-field cron expression (min hour dom mon dow), with an IANA `timezone` |
| Manual trigger | `POST /api/cron/:id/run` |
| View history | `GET /api/cron/:id/history` |
| Shared code | Use Custom Services (`services.custom("service_name")`) |

See the [create-cron skill](../../create-cron/SKILL.md) for full setup instructions.

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the table [Engine runtime](#engine-runtime) lists; for each interface it lacks, the table says what replaces it.

### Engine runtime

What stored code (hooks, cron jobs, custom services) has on the Engine, from the Engine's automation runtime documentation (its sections in brackets).

| Interface taught on a Supabase_Project | On the Engine | Replacement |
|---|---|---|
| The Supabase service in stored code (`services.supabase`) | Refused permanently, 501 `RUNTIME_SUPABASE_UNAVAILABLE` (§2.4) | `services.items(collection)`, with `{ elevated: true }` where the job must act as an administrator |
| SQL functions and raw SQL from stored code | No path (§2) | `services.items` calls, or a custom service |
| `services.items(c)` methods | Nine: `readByQuery`, `readOne`, `readMany`, `createOne`, `createMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`; `readByQuery` returns the array itself (§2) | Read `result`, not `result.data` |
| Query keys | `fields`, `filter`, `sort`, `limit`, `page`, `offset`, `search`; any other key is refused | Drop the key |
| Schema services | Read only: `readAll`, `readOne` | Change structure through the Engine's API or its MCP tools |
| `services.files` | Metadata only: `readByQuery`, `readOne` | Bytes through the application and `/api/files` |
| `services.mail` | Options `to`, `subject`, `html`, `text`, `replyTo`; returns `{ success, ... }`, does not throw (§6) | Check `success` |
| `services.env` | Empty unless the operator names keys (`RUNTIME_ENV_WHITELIST_<SCOPE>`, `RUNTIME_ENV_WHITELIST_GLOBAL`) (§7) | Ask the operator to name the key; never assume one |
| `services.fetch` | Only hosts in `EXTENSION_ALLOWED_DOMAINS`; empty list allows loopback only | Ask the operator to allow the host |
| `fetch`, `process`, `require`, `import`, `setTimeout`, `setInterval`, `eval`, `Function` | Do not exist (§1) | `services.fetch`; no timers |
| `Intl`, as in `create-service` lines 97-101 | Not found in the runtime's globals (`context`, `services`, `console`, `JSON`, `Date`, `Math`) | Format numbers by hand |
| `console` in a custom service body | Not in scope (§3); in hooks, cron jobs and service tests it is | Return what should be recorded |
| `console.table`, `console.trace` | Do not exist; `log`, `info`, `debug`, `warn`, `error` only (§4) | `console.log` |
| Update and delete hook payloads | `meta.keys` (array); `meta.key` only on create (§5) | Use `meta.keys` |
| Throwing from a filter hook | `new HookError(message, status, code)` is in scope | Unchanged |
| Filesystem extensions, `/api/ext/*` endpoints | None | Stored hooks, cron jobs, custom services |

**Lifecycle events:** On an Engine project the cron routes emit no event a hook can bind to.

**DO NOT build:** `setInterval`/`setTimeout` loops, Next.js API route cron handlers, external scheduler integrations (AWS EventBridge, etc.), custom job queue tables.

---

## RBAC / Permissions

**Status: Fully built-in. NEVER build custom access control.**

The Engine provides a complete role-based access control system: Roles → Policies → Permissions with field-level and item-level filtering, enforced by the Engine on every request.

On an Engine project collections, fields, relations, roles, policies and permissions are created through the Engine's API (`/api/collections`, `/api/fields/:collection`, `/api/relations`, `/api/roles`, `/api/policies`, `/api/access`, `/api/permissions`) or its MCP tools `collections`, `fields`, `relations`, `roles`, `policies`, `access` and `permissions`. Access is roles, policies and permissions: a permission belongs to a policy, and a policy is attached to a role or a user. The MCP `collections` and `fields` tools keep a field's name, type and `meta` but not its `schema` block (default, not-null, length): set those through `POST /api/fields/:collection` with an administrator's session.

| What | How |
|------|-----|
| Create role | `mcp_daas_roles`, or `POST /api/roles` |
| Create policy | `mcp_daas_policies`, or `POST /api/policies` |
| Attach a policy to a role or a user | `mcp_daas_access`, or `POST /api/access` |
| Assign permissions | `mcp_daas_permissions`, or `POST /api/permissions` |
| Check current user permissions | `GET /api/permissions/me` |
| UI permission gating | `usePermissions` hook, `CollectionList` built-in permission gates |

**Lifecycle events:** On an Engine project the role, policy, permission and access routes emit no event a hook can bind to.

**DO NOT build:** custom permission tables, manual `isAdmin` checks against a custom field, custom role assignment UI, manual access control middleware.

---

## Multi-Tenancy / Scope System

**Status: Fully built-in. NEVER build custom tenant isolation.**

The Engine provides a hierarchical scope system using Resource URIs (materialized paths) that automatically filters all queries by the active scope.

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.

| What | How |
|------|-----|
| Define scope types | `POST /api/scope/types` with an administrator's session |
| Create scope items | `POST /api/scope/items` with an administrator's session |
| Register collection | `POST /api/scope/collection-config` with an administrator's session |
| Assign a role at a scope | `mcp_daas_scope` with `action: "assign_user_role"` |
| UI component | `ScopeSwitcher` from Buildpad |
| Set active scope | `X-Resource-Uri` header (the `ScopeSwitcher` keeps the choice in the `daas_resource_uri` cookie, and `getHeaders` sends it as the header) |

See the `manage-scope` skill for full setup instructions.

**Lifecycle events:** On an Engine project the scope routes emit no event a hook can bind to.

**DO NOT build:** custom `tenant_id` or `organization_id` columns, manual query filtering by tenant, custom scope switcher UI, manual tenant isolation middleware.

---

## Custom Services (Shared Code)

**Status: Fully built-in. Use for shared business logic between extensions and cron jobs.**

Custom Services allow you to write reusable JavaScript modules that can be shared between hooks and cron jobs. They run in the Engine's runtime (see [Engine runtime](#engine-runtime)).

| What | How |
|------|-----|
| Create service | The Studio, or `POST <Engine_URL>/api/services` with an administrator's session |
| Use in extensions/cron | `const svc = services.custom("my_service")` |
| Run tests | `POST /api/services/:id/tests` (see the [create-service skill](../../create-service/SKILL.md)) |

**Lifecycle events:** On an Engine project the custom service routes emit no event a hook can bind to.
<!-- /buildpad-backend -->

**DO NOT build:** shared utility files in the Next.js project for server-side logic that should run in DaaS, custom service registries, manual dependency management between hooks.

---

## Import / Export

**Status: Fully built-in. NEVER build custom data import/export.**

<!-- buildpad-backend: supabase -->
| What | How |
|------|-----|
| Import JSON/CSV | `POST /api/utils/import/:collection` |
| Export JSON/CSV | `GET /api/utils/export/:collection` |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| What | How |
|------|-----|
| Import JSON/CSV | `POST /api/utils/import/:collection` (administrator; a CSV file is read by its `.csv` name, or set `?format=csv`) |
| Export JSON/CSV | `GET /api/utils/export/:collection?format=json` or `?format=csv` (administrator) |
| Store an export of what the caller may read | `POST /api/utils/export/:collection` |
<!-- /buildpad-backend -->

**DO NOT build:** custom CSV parsers, custom JSON import endpoints, custom data export routes.

---

## Hashing & Random Utilities

**Status: Fully built-in. NEVER build custom crypto helpers.**

<!-- buildpad-backend: supabase -->
| What | How |
|------|-----|
| Generate bcrypt hash | `POST /api/utils/hash/generate` |
| Verify bcrypt hash | `POST /api/utils/hash/verify` |
| Generate random string | `GET /api/utils/random/string?length=32` |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| What | How |
|------|-----|
| Generate bcrypt hash | `POST /api/utils/hash/generate` (any signed-in user, rate limited) |
| Verify bcrypt hash | `POST /api/utils/hash/verify` (administrator) |
| Generate random string | `GET /api/utils/random/string?length=32` |
<!-- /buildpad-backend -->

**DO NOT build:** custom bcrypt implementations, custom random token generators, custom password hashing utilities.

---

## Platform Settings

<!-- buildpad-backend: supabase -->
**Status: Fully built-in. Events enabled for configuration change hooks.**

DaaS platform settings (CORS, SMTP, MCP, general) are managed through a singleton `daas_settings` row.

| What | How |
|------|-----|
| Read settings | `GET /api/settings` |
| Update settings | `PATCH /api/settings` |
| CORS config | `GET/PATCH /api/settings/cors` or `mcp_daas_cors-settings` |
| SMTP config | `GET/PATCH /api/settings/smtp` or `mcp_daas_smtp-settings` |
| MCP config | `GET/PUT /api/settings/mcp` |

**Lifecycle events:** Settings updates emit `daas_settings.items.update` events. Use these to react to platform configuration changes (e.g., invalidating CORS caches when origins change, reloading SMTP transport when credentials are updated).

---

## User Profiles

**Status: Fully built-in. Events enabled for all user mutations.**

DaaS user profile updates (including self-updates via `/api/users/me`) now emit lifecycle events.

**Lifecycle events:** User profile mutations emit `daas_users.items.update` events (both admin updates and self-updates). Use these for audit trails or to trigger side effects when user profiles change (e.g., syncing display names to external systems).

---

## Runtime Extensions (Hooks)

**Status: Fully built-in. Use for validation, transformation, and side effects.**

DaaS runtime extensions allow you to run sandboxed JavaScript on item operations (create, read, update, delete) — both before (filter hooks) and after (action hooks).

| What | How |
|------|-----|
| Before-save validation | Filter hook on `items.create` / `items.update` |
| After-save side effects | Action hook on `items.create` / `items.update` |
| Create extension | `mcp_daas_extensions` with `action: "create"` |

**Lifecycle events:** Extension CRUD operations emit `daas_extensions.items.create/update/delete` events, so you can attach hooks that react to extension changes (e.g., audit trail for hook modifications).

See the `hooks-extensions` background skill for complete event names and patterns.

**DO NOT build:** Next.js API middleware for validation, custom webhook dispatchers, manual event emitters in API routes.

---

## Quick Check — "Should I Build This?"

| If the user asks for... | Answer | Use Instead |
|------------------------|--------|-------------|
| "Add audit logging" | NO — already built-in | `GET /api/activity` |
| "Track who created/updated items" | NO — use special fields | `special: ["user-created"]`, `special: ["date-created"]` etc. |
| "Add approval workflow" | NO — use DaaS workflows | `create-workflow` skill |
| "Add draft/published states" | NO — use DaaS workflows | `create-workflow` skill |
| "Add versioning/drafts" | NO — use DaaS versions | `POST /api/versions` |
| "Upload files" | NO — use DaaS files | `mcp_daas_files` + Buildpad components |
| "Schedule a job" | NO — use DaaS cron | `mcp_daas_cron` |
| "Add role-based access" | NO — use DaaS RBAC | `create-rbac` skill |
| "Add multi-tenancy" | NO — use DaaS scopes | `manage-scope` skill |
| "Import CSV data" | NO — use DaaS import | `POST /api/utils/import/:collection` |
| "Hash a password" | NO — use DaaS utils | `POST /api/utils/hash/generate` |
| "Add custom validation" | Use DaaS extension | Filter hook via `mcp_daas_extensions` |
| "Send notification after save" | Use DaaS extension | Action hook via `mcp_daas_extensions` |
| "Reusable server-side code" | Use DaaS services | `mcp_daas_services` |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
**Status: Fully built-in.**

The Engine's project settings (SMTP, MCP, general) are kept in a single `daas_settings` row. The cross-origin settings are kept there too, but on an Engine project they are provisioned and are not changed (below).

| What | How |
|------|-----|
| Read settings | `GET /api/settings` |
| Update settings | `PATCH /api/settings` (administrator) |
| Cross-origin settings | Change nothing (below) |
| SMTP config | `GET/PATCH /api/settings/smtp` (administrator), or the MCP tool `smtp-settings` (`get`, `update`, `test`; administrators only) |
| MCP config | `GET/PATCH /api/settings/mcp` (administrator) |

On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.

**Lifecycle events:** On an Engine project a settings change emits no event a hook can bind to.

---

## User Profiles

**Status: Fully built-in.**

Users read and update their own profile through `GET`/`PATCH /api/users/me`; an administrator manages users through `/api/users` or the `mcp_daas_users` tool.

**Lifecycle events:** On an Engine project the `/api/users` routes emit no event a hook can bind to.

---

## Runtime Extensions (Hooks)

**Status: Fully built-in. Use for validation, transformation, and side effects.**

Hooks run JavaScript in the Engine's runtime on item operations — both before the write (filter hooks) and after it (action hooks). They run as the caller who triggered them, in that caller's tenant.

| What | How |
|------|-----|
| Before-save validation | Filter hook on `items.create` / `items.update` (or `<collection>.items.create`) |
| After-save side effects | Action hook on `items.create` / `items.update` |
| Refuse a write from a filter hook | `throw new HookError(message, status, code)` |
| Create extension | The Studio, or `POST <Engine_URL>/api/extensions` with an administrator's session |

**Events:** `items.query`, `items.read`, `items.create`, `items.update`, `items.delete` and `versions.create`, each with its collection-scoped twin `<collection>.items.<operation>`. They fire for item reads and writes through the items API; the Engine's own routes for files, folders, users, roles, policies, permissions, access, scope, settings, cron jobs, custom services and hooks emit none.

See the [hooks-extensions skill](../../hooks-extensions/SKILL.md) for complete event payloads and patterns.

**DO NOT build:** Next.js API middleware for validation, custom webhook dispatchers, manual event emitters in API routes.

---

## Quick Check — "Should I Build This?"

| If the user asks for... | Answer | Use Instead |
|------------------------|--------|-------------|
| "Add audit logging" | NO — already built-in | `GET /api/activity` |
| "Track who created/updated items" | NO — use special fields | `special: ["user-created"]`, `special: ["date-created"]` etc. |
| "Add approval workflow" | NO — use workflows | `create-workflow` skill |
| "Add draft/published states" | NO — use workflows | `create-workflow` skill |
| "Add versioning/drafts" | NO — use versions | `POST /api/versions` |
| "Upload files" | NO — use the Engine's files | `mcp_daas_files` + Buildpad components |
| "Schedule a job" | NO — use cron jobs | [create-cron](../../create-cron/SKILL.md) |
| "Add role-based access" | NO — use RBAC | `create-rbac` skill |
| "Add multi-tenancy" | NO — use scopes | `manage-scope` skill |
| "Import CSV data" | NO — use the import utility | `POST /api/utils/import/:collection` |
| "Hash a password" | NO — use the hash utility | `POST /api/utils/hash/generate` |
| "Add custom validation" | Use a hook | Filter hook ([hooks-extensions](../../hooks-extensions/SKILL.md)) |
| "Send notification after save" | Use a hook | Action hook ([hooks-extensions](../../hooks-extensions/SKILL.md)) |
| "Reusable server-side code" | Use custom services | [create-service](../../create-service/SKILL.md) |
<!-- /buildpad-backend -->
