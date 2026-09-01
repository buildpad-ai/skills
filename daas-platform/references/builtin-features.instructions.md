---
name: DaaS Built-In Features
description: Comprehensive list of features provided natively by the DaaS platform. Check this reference BEFORE implementing any server-side feature. If DaaS provides it, use it — do NOT rebuild it.
applyTo: "**/*.{ts,tsx,json,sql}"
---

# DaaS Built-In Features — DO NOT Rebuild

Before implementing ANY server-side feature, check this list. If DaaS provides it natively, **use the built-in feature**. Building custom implementations creates inconsistency, maintenance burden, and bypasses platform-level security and auditing.

---

## Activity / Audit Trail

**Status: Fully built-in. NEVER build custom audit trail functionality.**

DaaS automatically logs all item mutations (create, update, delete) to the `daas_activity` table with before/after snapshots and user attribution. No configuration required — it works for every collection by default.

| What | How |
|------|-----|
| Query audit log | `GET /api/activity?collection=articles&action=create,update&limit=50` |
| Filter by user | `GET /api/activity?user_id=<uuid>` |
| Filter by date range | `GET /api/activity?from=2026-01-01&to=2026-03-31` |
| Search audit entries | `GET /api/activity?search=invoice` |
| MCP access | `mcp_daas_items` with `collection: "daas_activity"` (read-only) |

Each activity entry includes: `action`, `timestamp`, `collection`, `item` (PK), `revisions` (before/after snapshot), linked `user` object with email and name. When service account delegation is used (`X-On-Behalf-Of` header), the entry also includes `performed_by` (service account UUID) and a `performer` join with the service account's details.

**DO NOT build:** custom audit tables, manual logging hooks, activity tracking middleware, change history components that write their own logs.

---

## Workflow / State Machine

**Status: Fully built-in. NEVER build custom state management or approval logic.**

DaaS provides a complete workflow engine with state definitions, command-based transitions, policy authorization, and automatic instance creation.

| What | How |
|------|-----|
| Define workflow | Create item in `daas_wf_definition` with `workflow_json` |
| Assign to collection | Create item in `daas_wf_assignment` with collection + filter_rule |
| Execute transition | `POST /api/workflow/transition` with `workflowInstanceId` + `commandName` |
| Track history | Transition history stored per instance |
| UI component | `WorkflowButton` from Buildpad |
| Hooks | `useWorkflowAssignment`, `useWorkflowVersioning` |

See the `create-workflow` skill for full setup instructions.

**DO NOT build:** custom status fields with manual update logic, custom approval chains, custom state machine code, manual transition tracking tables, custom "Submit for Review" buttons that update a `status` column directly.

---

## Content Versioning

**Status: Fully built-in. NEVER build custom version/draft management.**

DaaS supports named content versions with delta-based storage. Versions can be promoted to the main item, and integrate with workflows for approval flows.

| What | How |
|------|-----|
| Create version | `POST /api/versions` with `collection`, `item`, `key` |
| Get item with version applied | `GET /api/items/:collection/:id?version=draft` |
| Promote version | Built-in `xtr.item.promote` workflow action |
| Hooks | `useVersions`, `useWorkflowVersioning` |

**DO NOT build:** custom version tables, manual diff/snapshot tracking, custom draft management, revision comparison logic.

---

## File Management

**Status: Fully built-in. NEVER build custom file upload/storage.**

DaaS provides comprehensive file management with Supabase Storage backend, including upload, metadata, thumbnails, and hierarchical folders.

| What | How |
|------|-----|
| Upload file | `POST /api/files` (multipart) |
| List/search files | `GET /api/files` with filters |
| Create folders | `POST /api/folders` |
| MCP tool | `mcp_daas_files` |
| UI components | `FileInterface`, `FileImage`, `Files`, `Upload` from Buildpad |

**Lifecycle events:** Folder CRUD operations emit `daas_folders.items.create/update/delete` events. File operations already emitted events via `FilesService`.

**DO NOT build:** custom upload API routes, custom file storage logic, custom thumbnail generation, custom folder management.

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

**DO NOT build:** shared utility files in the Next.js project for server-side logic that should run in DaaS, custom service registries, manual dependency management between hooks.

---

## Import / Export

**Status: Fully built-in. NEVER build custom data import/export.**

| What | How |
|------|-----|
| Import JSON/CSV | `POST /api/utils/import/:collection` |
| Export JSON/CSV | `GET /api/utils/export/:collection` |

**DO NOT build:** custom CSV parsers, custom JSON import endpoints, custom data export routes.

---

## Hashing & Random Utilities

**Status: Fully built-in. NEVER build custom crypto helpers.**

| What | How |
|------|-----|
| Generate bcrypt hash | `POST /api/utils/hash/generate` |
| Verify bcrypt hash | `POST /api/utils/hash/verify` |
| Generate random string | `GET /api/utils/random/string?length=32` |

**DO NOT build:** custom bcrypt implementations, custom random token generators, custom password hashing utilities.

---

## Platform Settings

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
