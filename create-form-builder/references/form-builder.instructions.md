---
name: Form Builder Deep Dive
description: Data model, conditional logic, storage strategies, and multi-tenant scope behaviour for the Buildpad Dynamic Form Builder (@buildpad/ui-forms). Reference for any feature that authors or renders dynamic form definitions.
applyTo: "app/forms/**/*.{ts,tsx},components/ui/form-builder/**/*.{ts,tsx}"
---

# Form Builder — Deep Dive

The Dynamic Form Builder authors a **`FormDefinition`** (a JSON overlay) and merges it onto a collection's live schema at render time via `buildFieldsFromDefinition` — the schema is never mutated. This document covers the data model, conditions, storage, and scopes. For the how-to and CLI, see the parent [SKILL.md](../SKILL.md).

## Data Model

These types originate in `@buildpad/types`. In a scaffolded app, import `FormDefinition`, `FormSection`, and `FormFieldConfig` from the component barrel `@/components/ui/form-builder` (it re-exports them); import `FieldCondition` from `@/lib/buildpad/types` — it is deliberately **not** re-exported from the barrel (see the Conditional Logic section).

```ts
interface FormDefinition {
  id?: string;               // item id in the definitions collection (absent until first save)
  name: string;              // human-readable screen name, e.g. "Bug create screen"
  target_collection: string; // collection the form creates/edits items in
  key?: string | null;       // optional discriminator so multiple forms share one collection
  sections: FormSection[];   // in display order
}

interface FormSection {
  id: string;                // stable id (used for the synthesized group/divider field key)
  title?: string;            // optional heading
  fields: FormFieldConfig[]; // in display order
}

interface FormFieldConfig {
  field: string;                 // schema field key, or the extra's key when store === 'extras'
  width?: 'half' | 'full';
  required?: boolean;            // override
  readonly?: boolean;            // override
  hidden?: boolean;              // override
  note?: string;                 // label/help override → field.meta.note
  conditions?: FieldCondition[]; // consumed verbatim by apply-conditions.ts
  store?: 'column' | 'extras';   // default 'column'
  extra?: ExtraFieldDescriptor;  // REQUIRED when store === 'extras'
}

interface ExtraFieldDescriptor {
  type: string;                       // DaaS type: 'string' | 'integer' | 'boolean' | 'date' | 'json' | …
  interface?: string;                 // VForm interface id (inferred from type when omitted)
  label?: string;
  options?: Record<string, unknown>;  // → field.meta.options
}
```

## Conditional Logic

`ConditionsEditor` authors the exact `FieldCondition[]` shape the runtime already consumes (`apply-conditions.ts` in `@buildpad/ui-form`), so conditions evaluate without translation.

```ts
interface FieldCondition {
  name?: string;                       // for the admin UI
  rule?: Record<string, unknown>;      // DaaS filter JSON: _eq, _neq, _in, _and, _or, …
  // overrides applied when `rule` matches the current form values:
  readonly?: boolean;
  hidden?: boolean;
  required?: boolean;
  options?: Record<string, unknown>;   // replace field options
  clear_hidden_value_on_save?: boolean;
}
```

Rules are built with `FilterPanel`, producing DaaS-compatible filter JSON. **Last-match-wins**: when multiple conditions match, the last one in the array applies (DaaS convention). Import `FieldCondition` from `@/lib/buildpad/types` — it is intentionally *not* re-exported from the form-builder barrel (collision avoidance).

Example — hide `resolution` until `status` is `resolved`, then require it:

```ts
conditions: [
  { name: "hide until resolved", rule: { status: { _neq: "resolved" } }, hidden: true },
  { name: "require when resolved", rule: { status: { _eq: "resolved" } }, required: true },
]
```

## Storage Strategies & Searchability

The form **definition** is config; the form **data** (submitted answers) is what you later search and report on. Answers are stored as **real, typed DaaS columns by default** — natively searchable, sortable, aggregatable, relatable, and field-level-permissioned through the Items API — with a single opt-in **`extras` jsonb** column as the escape hatch for the rare non-searchable tail.

| Strategy | When | Storage |
| -------- | ------------------------- | -------------------------------------------------------------- |
| **Hybrid** | *Use an existing collection* | Real columns for provisioned fields + one opt-in `extras` jsonb tail |
| **Full**   | *Start from scratch* (needs schema rights) | Standard audit system fields + every field a real column, **no** `extras` |

The builder **derives** the strategy — a collection is *full* iff it has no `extras` column — so nothing extra is persisted on the definition. Every field carries `store: 'column' | 'extras'` (default `'column'`); the **Add field** flow lets the author choose, and tick **Index this column** for fields they'll filter or sort on.

> **Rule of thumb:** if you'll ever search / filter / sort / aggregate on a field, keep it a **real column**. `extras` values are not server-searchable, -sortable, or -aggregatable, and are not individually field-permissioned — reach for them only for a display-only tail that never needs querying.

Because real-column answers are ordinary DaaS columns, the existing Items API *is* the search layer — `ItemsService.readByQuery(...)` already speaks `filter` (20+ operators incl. relational dot-notation), `sort`, `search`, `aggregate`, and `groupBy`. Model a Project → Issue hierarchy with **real relations** (an M2O `parent` + a `type` discriminator) and a per-`type` form (definition `key`), then query across it natively (e.g. `filter[project][_eq]=…&filter[issue_type][_eq]=bug`).

## Multi-Tenancy / Scopes

- Data requests reuse the existing `DaaSProvider` header injection, so scoped reads/writes partition by `X-Resource-Uri` automatically on the direct deployment.
- For a scope-enabled **target** collection, `DynamicForm` passes the active scope URI as a create-time default (`scopeField`, default `'resource_uri'`; `injectActiveScope` default `true`) unless DaaS permission presets already inject it. The active scope is read from the `daas_resource_uri` cookie.
- **Definitions** follow a *global-baseline + optional per-tenant-override* model: by default `fb_definitions` is unscoped (one form for all tenants). Scope-enable it and `resolveScreen` picks the nearest-ancestor-or-self definition per scope.

See [manage-scope](../../manage-scope/SKILL.md) for the DaaS scope system.

## Provisioning Modes (API routes)

- **Direct** deployment (default) — the browser calls DaaS directly; no extra routes needed for provisioning.
- **Proxy** mode — DDL writes go through `POST /api/fields/[collection]` and `POST`/`DELETE /api/collections[/…]`, which require DaaS **schema rights**. These come from the same `buildpad add api-routes` module.

Authoring against existing fields needs only item `create`/`update`/`read` on the definitions collection + `read` on the target schema. Provisioning new collections/columns needs schema rights.
