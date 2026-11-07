---
name: Content Translations
description: Directus-style content translations on DaaS — the languages collection, a <collection>_translations junction per translated collection created through the fields tool's corresponding_field option (o2m alias, never the unimplemented translations special), Supabase SQL mirrors, permissions, locale-aware query helpers with fallback, per-locale workflow, and scope. Copy-pasteable MCP JSON payloads.
applyTo: "**/*.{ts,tsx,json,sql}"
---

# Content Translations on DaaS

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

Content that editors author per language lives in DaaS, not in dictionaries. The model is the Directus one — a `languages` collection and one `<collection>_translations` junction per translated collection — built from the pieces DaaS already implements.

<!-- buildpad-backend: supabase -->
> **Why `special: ["o2m"]` and not `["translations"]`.** DaaS reserves the Directus `translations` special: the relation resolver treats it as a virtual relation (reads work) and `filterAliasFields` strips it from column writes — but `extractRelationalData` in `lib/services/items/relation-writer.ts` only dispatches nested writes for `m2m`, `o2m`, and `files`. A `translations`-special field therefore has its nested rows stripped and never written, with no error. `o2m` takes the full read **and** write path. Switch only when DaaS ships the `translations` interface, junction wizard, and writer branch together.

All payloads below use the DaaS MCP tool names (`collections`, `fields`, `items`, `permissions`); skills refer to them as `mcp_daas_*`. Formats are documented in [daas-mcp-tools](../../daas-platform/references/daas-mcp-tools.instructions.md). Verify field names with the `schema` tool before writing any filter — a wrong name is a silent 500.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
> **Why `special: ["o2m"]` and not `["translations"]`.** On an Engine project the `translations` special is an alias relation that a collection create refuses, and the recipe below needs no special interface: a plain one-to-many alias (`special: ["o2m"]`) takes the full read **and** write path, with each nested row checked as if the user wrote it directly. Switch only when the Engine and the Studio ship the `translations` interface together.

On an Engine project the payloads below go to the Engine: the MCP tools `collections`, `fields`, `items` and `permissions`, or the Engine's REST routes with an administrator's session where a payload carries a `schema` block (the MCP tools do not keep it). Tool formats are in [daas-platform](../../daas-platform/SKILL.md). Verify field names with the `schema` tool before writing any filter.
<!-- /buildpad-backend -->

---

## 1. `languages` collection (once per project)

`code` must equal the values in `lib/i18n/config.ts`. Languages are global — do **not** add Group C (`resource_uri`).

<!-- buildpad-backend: supabase -->
### MCP payload

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "languages",
        "meta": {
          "icon": "translate",
          "note": "Content languages. `code` must match lib/i18n/config.ts exactly.",
          "sort_field": "sort"
        },
        "fields": [
          {
            "field": "id",
            "type": "uuid",
            "meta": { "hidden": true, "readonly": true },
            "schema": { "is_primary_key": true, "has_auto_increment": false, "default_value": "gen_random_uuid()" }
          },
          {
            "field": "code",
            "type": "string",
            "meta": { "interface": "input", "required": true, "width": "half", "note": "BCP 47 tag: en, id, ar" },
            "schema": { "max_length": 10, "is_nullable": false, "is_unique": true }
          },
          {
            "field": "name",
            "type": "string",
            "meta": { "interface": "input", "required": true, "width": "half" },
            "schema": { "max_length": 100, "is_nullable": false }
          },
          {
            "field": "direction",
            "type": "string",
            "meta": {
              "interface": "select-dropdown",
              "width": "half",
              "options": {
                "choices": [
                  { "text": "Left to right", "value": "ltr" },
                  { "text": "Right to left", "value": "rtl" }
                ]
              }
            },
            "schema": { "max_length": 3, "default_value": "ltr" }
          },
          {
            "field": "sort",
            "type": "integer",
            "meta": { "interface": "input", "hidden": true }
          },
          {
            "field": "user_created",
            "type": "uuid",
            "meta": { "interface": "select-dropdown-m2o", "special": ["user-created"], "readonly": true, "hidden": true, "width": "half" },
            "schema": { "foreign_key_table": "daas_users" }
          },
          {
            "field": "date_created",
            "type": "timestamp",
            "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" },
            "schema": { "default_value": "CURRENT_TIMESTAMP" }
          },
          {
            "field": "user_updated",
            "type": "uuid",
            "meta": { "interface": "select-dropdown-m2o", "special": ["user-updated"], "readonly": true, "hidden": true, "width": "half" },
            "schema": { "foreign_key_table": "daas_users" }
          },
          {
            "field": "date_updated",
            "type": "timestamp",
            "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
          }
        ]
      }
    ]
  }
}
```

### Seed rows

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "languages",
    "data": [
      { "code": "en", "name": "English", "direction": "ltr", "sort": 1 },
      { "code": "id", "name": "Bahasa Indonesia", "direction": "ltr", "sort": 2 }
    ]
  }
}
```

### SQL mirror — `supabase/migrations/[timestamp]_create_languages.sql`

```sql
create table if not exists public.languages (
    id            uuid primary key default gen_random_uuid(),
    code          varchar(10) not null unique,
    name          varchar(100) not null,
    direction     varchar(3) not null default 'ltr' check (direction in ('ltr', 'rtl')),
    sort          integer,
    user_created  uuid references auth.users(id),
    date_created  timestamptz default now(),
    user_updated  uuid references auth.users(id),
    date_updated  timestamptz
);

insert into public.languages (code, name, direction, sort) values
    ('en', 'English', 'ltr', 1),
    ('id', 'Bahasa Indonesia', 'ltr', 2)
on conflict (code) do nothing;
```

After creation, read the collection back with the `fields` tool and confirm `code` carries the unique constraint; if the MCP schema dropped `is_unique`, the migration above is the safety net.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### REST payload — `POST /api/collections`, with an administrator's session

`code` needs its unique flag and `date_created` its default, and the MCP `collections` tool keeps neither, so create `languages` through the Engine's API. The Engine fills `date-created` from the column default only, so the default must be set here. The two relation fields of Group A (`user_created`, `user_updated`) are added in the next call.

```json
{
  "collection": "languages",
  "meta": {
    "icon": "translate",
    "note": "Content languages. `code` must match lib/i18n/config.ts exactly.",
    "sort_field": "sort"
  },
  "fields": [
    {
      "field": "id",
      "type": "uuid",
      "meta": { "hidden": true, "readonly": true },
      "schema": { "is_primary_key": true }
    },
    {
      "field": "code",
      "type": "string",
      "meta": { "interface": "input", "required": true, "width": "half", "note": "BCP 47 tag: en, id, ar" },
      "schema": { "max_length": 10, "is_nullable": false, "is_unique": true }
    },
    {
      "field": "name",
      "type": "string",
      "meta": { "interface": "input", "required": true, "width": "half" },
      "schema": { "max_length": 100, "is_nullable": false }
    },
    {
      "field": "direction",
      "type": "string",
      "meta": {
        "interface": "select-dropdown",
        "width": "half",
        "options": {
          "choices": [
            { "text": "Left to right", "value": "ltr" },
            { "text": "Right to left", "value": "rtl" }
          ]
        }
      },
      "schema": { "max_length": 3, "default_value": "ltr" }
    },
    {
      "field": "sort",
      "type": "integer",
      "meta": { "interface": "input", "hidden": true }
    },
    {
      "field": "date_created",
      "type": "timestamp",
      "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" },
      "schema": { "default_value": "NOW()" }
    },
    {
      "field": "date_updated",
      "type": "timestamp",
      "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
    }
  ]
}
```

### Audit relations — `fields` tool

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "languages",
    "data": [
      {
        "field": "user_created",
        "type": "uuid",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["user-created", "m2o"],
          "readonly": true,
          "hidden": true,
          "width": "half",
          "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" }
        }
      },
      {
        "field": "user_updated",
        "type": "uuid",
        "meta": {
          "interface": "select-dropdown-m2o",
          "special": ["user-updated", "m2o"],
          "readonly": true,
          "hidden": true,
          "width": "half",
          "options": { "related_collection": "daas_users", "related_field": "id", "on_delete": "SET NULL" }
        }
      }
    ]
  }
}
```

### Seed rows

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "languages",
    "data": [
      { "code": "en", "name": "English", "direction": "ltr", "sort": 1 },
      { "code": "id", "name": "Bahasa Indonesia", "direction": "ltr", "sort": 2 }
    ]
  }
}
```

After creation, read the fields back (`GET /api/fields/languages`, or the `fields` tool) and confirm `code` reports `is_unique: true`. There is no SQL file on an Engine project: the Engine's API is the only place the structure is defined.
<!-- /buildpad-backend -->

---

## 2. `<collection>_translations` junction (per translated collection)

Worked example: `articles` with translatable `title` and `body`. Locale-independent fields (`slug`, `published_at`, `author`, images) stay on `articles`; translatable ones move to the junction.

<!-- buildpad-backend: supabase -->
### Step 2a — create the junction with its own fields

```json
{
  "name": "collections",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles_translations",
        "meta": {
          "icon": "translate",
          "hidden": true,
          "note": "Per-language fields of articles. One row per (article, language)."
        },
        "fields": [
          {
            "field": "id",
            "type": "uuid",
            "meta": { "hidden": true, "readonly": true },
            "schema": { "is_primary_key": true, "has_auto_increment": false, "default_value": "gen_random_uuid()" }
          },
          {
            "field": "title",
            "type": "string",
            "meta": { "interface": "input", "required": true },
            "schema": { "max_length": 255 }
          },
          {
            "field": "body",
            "type": "text",
            "meta": { "interface": "input-rich-text-html" }
          },
          {
            "field": "user_created",
            "type": "uuid",
            "meta": { "interface": "select-dropdown-m2o", "special": ["user-created"], "readonly": true, "hidden": true, "width": "half" },
            "schema": { "foreign_key_table": "daas_users" }
          },
          {
            "field": "date_created",
            "type": "timestamp",
            "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" },
            "schema": { "default_value": "CURRENT_TIMESTAMP" }
          },
          {
            "field": "user_updated",
            "type": "uuid",
            "meta": { "interface": "select-dropdown-m2o", "special": ["user-updated"], "readonly": true, "hidden": true, "width": "half" },
            "schema": { "foreign_key_table": "daas_users" }
          },
          {
            "field": "date_updated",
            "type": "timestamp",
            "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
          }
        ]
      }
    ]
  }
}
```

### Step 2b — the parent link, which auto-creates the `translations` alias

Creating an M2O through the `fields` tool creates the FK, reloads the PostgREST cache, writes the `daas_relations` row, and — because of `corresponding_field` — inserts the O2M alias field on the parent (`interface: "list-o2m"`, `special: ["o2m"]`) with `one_field` set. One call, sequential (not batched with 2c).

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "articles_id",
      "type": "uuid",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "required": true,
        "hidden": true,
        "options": {
          "related_collection": "articles",
          "corresponding_field": "translations",
          "on_delete": "CASCADE"
        }
      }
    }
  }
}
```

### Step 2c — the language link (FK to the non-PK `languages.code`)

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "languages_code",
      "type": "string",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "required": true,
        "width": "half",
        "options": {
          "related_collection": "languages",
          "related_field": "code",
          "on_delete": "CASCADE",
          "template": "{{name}}"
        }
      }
    }
  }
}
```

### Step 2d — polish the alias on the parent (optional)

Use the `fields` tool's update action (see "Update Field" in daas-mcp-tools) on `articles.translations` to set:

```json
{
  "meta": {
    "interface": "list-o2m",
    "special": ["o2m"],
    "width": "full",
    "note": "One row per language",
    "options": { "template": "{{languages_code}} — {{title}}", "enableCreate": true, "enableSelect": false }
  }
}
```

Editors now see a related list on the article form and add one row per language; `CollectionForm collection="articles"` renders it through `ListO2M` with no extra code.

### SQL mirror — `supabase/migrations/[timestamp]_create_articles_translations.sql`

The composite unique constraint cannot be expressed through the MCP field schema — the migration is where it lives.

```sql
create table if not exists public.articles_translations (
    id              uuid primary key default gen_random_uuid(),
    articles_id     uuid not null references public.articles(id) on delete cascade,
    languages_code  varchar(10) not null references public.languages(code) on delete cascade,
    title           varchar(255) not null,
    body            text,
    user_created    uuid references auth.users(id),
    date_created    timestamptz default now(),
    user_updated    uuid references auth.users(id),
    date_updated    timestamptz,
    unique (articles_id, languages_code)
);

create index if not exists idx_articles_translations_articles_id   on public.articles_translations (articles_id);
create index if not exists idx_articles_translations_languages_code on public.articles_translations (languages_code);
```

If `title`/`body` previously lived on `articles`, add a data-migration step that copies them into a default-locale translation row before dropping the parent columns.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### Step 2a — create the junction with its own fields (`POST /api/collections`, administrator's session)

```json
{
  "collection": "articles_translations",
  "meta": {
    "icon": "translate",
    "hidden": true,
    "note": "Per-language fields of articles. One row per (article, language)."
  },
  "fields": [
    {
      "field": "id",
      "type": "uuid",
      "meta": { "hidden": true, "readonly": true },
      "schema": { "is_primary_key": true }
    },
    {
      "field": "title",
      "type": "string",
      "meta": { "interface": "input", "required": true },
      "schema": { "max_length": 255 }
    },
    {
      "field": "body",
      "type": "text",
      "meta": { "interface": "input-rich-text-html" }
    },
    {
      "field": "date_created",
      "type": "timestamp",
      "meta": { "interface": "datetime", "special": ["date-created"], "readonly": true, "width": "half", "display": "datetime" },
      "schema": { "default_value": "NOW()" }
    },
    {
      "field": "date_updated",
      "type": "timestamp",
      "meta": { "interface": "datetime", "special": ["date-updated"], "readonly": true, "width": "half", "display": "datetime" }
    }
  ]
}
```

Then add `user_created` and `user_updated` with the `fields` tool, exactly as for `languages` above, with `"collection": "articles_translations"`.

### Step 2b — the parent link, which creates the `translations` alias

Creating an M2O through the `fields` tool creates the foreign key and the relation, and — because of `corresponding_field` — inserts the O2M alias field on the parent (`interface: "list-o2m"`, `special: ["o2m"]`) with `one_field` set. One call, sequential (not batched with 2c). The `fields` tool reads the field's name from `data.field`.

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "articles_id",
      "type": "uuid",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "required": true,
        "hidden": true,
        "options": {
          "related_collection": "articles",
          "corresponding_field": "translations",
          "on_delete": "CASCADE"
        }
      }
    }
  }
}
```

### Step 2c — the language link (FK to the non-PK `languages.code`)

`related_field` names the column the foreign key points at; `code` qualifies because it is unique.

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "languages_code",
      "type": "string",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "required": true,
        "width": "half",
        "options": {
          "related_collection": "languages",
          "related_field": "code",
          "on_delete": "CASCADE",
          "template": "{{name}}"
        }
      }
    }
  }
}
```

### Step 2d — polish the alias on the parent (optional)

Use the `fields` tool's update action on `articles.translations` (`"collection": "articles"`, and `"field": "translations"` inside `data`) to set:

```json
{
  "meta": {
    "interface": "list-o2m",
    "special": ["o2m"],
    "width": "full",
    "note": "One row per language",
    "options": { "template": "{{languages_code}} — {{title}}", "enableCreate": true, "enableSelect": false }
  }
}
```

Editors now see a related list on the article form and add one row per language; `CollectionForm collection="articles"` renders it through `ListO2M` with no extra code.

### Step 2e — one row per (article, language)

A field's `is_unique` covers one column only. From Engine 0.1.0-dev.18 the MCP `fields` tool makes the pair unique in one call: `create_index` with `data` `{"collection": "articles_translations", "columns": ["articles_id", "languages_code"], "unique": true}`; rows that already repeat a pair are refused. If the tool's `action` list has no `create_index`, the pair `(articles_id, languages_code)` is made unique through the Engine's schema migration routes, each with an administrator's session:

1. `GET /api/schema/snapshot` answers the current schema as `data`.
2. In that snapshot, find `articles_translations` under `collections` and add `"unique_constraints": [["articles_id", "languages_code"]]` to its `schema` object.
3. `POST /api/schema/diff` with the edited snapshot as the body answers the difference as `data`, with a `hash`.
4. `POST /api/schema/apply` with that `data` as the body answers 204 when the constraint is in place, and 409 when the schema changed after step 1: start again from step 1.

If `title`/`body` previously lived on `articles`, copy them into a default-locale translation row (with the `items` tool) before deleting the parent fields.
<!-- /buildpad-backend -->

---

## 3. Permissions

<!-- buildpad-backend: supabase -->
`apply_rls_to_collection` runs automatically when a collection is created through DaaS, so RLS is in place. **Policy permissions are not** — without them every read returns empty and every nested write is a silent no-op.

```json
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": [
      { "policy": "<app-policy-uuid>", "collection": "languages", "action": "read", "fields": ["*"], "permissions": null },
      { "policy": "<app-policy-uuid>", "collection": "articles_translations", "action": "read", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "create", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "update", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "delete", "fields": ["*"], "permissions": null }
    ]
  }
}
```

A **translator** role is just `update` (and optionally `create`) on `articles_translations` with no write permission on `articles`. Nested writes through `articles.translations` are gated on the junction exactly like top-level writes — finish with [relational-permissions](../../relational-permissions/SKILL.md). Public front ends that read published content only get `read` with `permissions: { "workflow_state": { "_eq": "Published" } }` (see §5).
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
On an Engine project nothing is granted when a collection is created: access is roles, policies and permissions on every request. Without permissions every read and every nested write through the alias is refused.

```json
{
  "name": "permissions",
  "arguments": {
    "action": "create",
    "data": [
      { "policy": "<app-policy-uuid>", "collection": "languages", "action": "read", "fields": ["*"], "permissions": null },
      { "policy": "<app-policy-uuid>", "collection": "articles_translations", "action": "read", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "create", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "update", "fields": ["*"], "permissions": null },
      { "policy": "<editor-policy-uuid>", "collection": "articles_translations", "action": "delete", "fields": ["*"], "permissions": null }
    ]
  }
}
```

The Engine keeps one rule per policy, collection and action, so create each rule once and update it afterwards. A **translator** role is just `update` (and optionally `create`) on `articles_translations` with no write permission on `articles`. Nested writes through `articles.translations` are gated on the junction exactly like top-level writes — finish with [relational-permissions](../../relational-permissions/SKILL.md). Public front ends that read published content only get `read` with `permissions: { "workflow_state": { "_eq": "Published" } }` (see §5).
<!-- /buildpad-backend -->

---

## 4. Reading translated content

DaaS parses Directus's `deep` query parameter but the generic items service ignores it, so `?fields=*,translations.*&deep[translations][_filter]...` cannot narrow to one language. Two patterns cover every case:

| Need | Query |
| --- | --- |
| One item, one locale, with fallback | `GET /api/items/articles_translations?filter={"articles_id":{"_eq":"<id>"},"languages_code":{"_in":["id","en"]}}&fields=*,articles_id.*` |
| List for a locale (front page) | `GET /api/items/articles_translations?filter={"languages_code":{"_eq":"id"}}&fields=id,title,articles_id.id,articles_id.slug,articles_id.date_created&sort=-date_created&limit=25` |
| All languages of one item (editing) | `GET /api/items/articles/<id>?fields=*,translations.*` |

Nested M2O selection (`articles_id.*`) is supported by the fields parser, so the junction row carries its parent's locale-independent fields in the same response. The backend returns an **empty** result when a translation is missing — it never falls back — so always request the default locale too and choose client-side.

### `lib/i18n/content.ts`

```ts
import { defaultLocale, type Locale } from "./config";

export type TranslationRow<T> = T & { id: string; languages_code: string };

/** Requested locale → default locale → first available. */
export function pickTranslation<T>(
  rows: TranslationRow<T>[],
  locale: Locale,
): TranslationRow<T> | undefined {
  return (
    rows.find((r) => r.languages_code === locale) ??
    rows.find((r) => r.languages_code === defaultLocale) ??
    rows[0]
  );
}

/** Query string for one parent's rows in the requested + default locale. */
export function translationsQuery(parentField: string, parentId: string, locale: Locale): string {
  const filter = {
    [parentField]: { _eq: parentId },
    languages_code: { _in: Array.from(new Set([locale, defaultLocale])) },
  };
  return `filter=${encodeURIComponent(JSON.stringify(filter))}&fields=*,${parentField}.*`;
}

/** Query string for a locale's list, newest first. */
export function localeListQuery(parentField: string, locale: Locale, limit = 25): string {
  const filter = { languages_code: { _eq: locale } };
  return `filter=${encodeURIComponent(JSON.stringify(filter))}&fields=*,${parentField}.*&sort=-date_created&limit=${limit}`;
}
```

Usage through the app's proxy routes (installed by `buildpad add api-routes`):

```ts
const res = await fetch(`/api/items/articles_translations?${translationsQuery("articles_id", id, locale)}`);
const { data } = await res.json();
const article = pickTranslation(data, locale);
```

Column names above (`articles_id`, `languages_code`, `date_created`) are the ones this recipe creates; confirm them with the `schema` tool if the project deviated.

---

<!-- buildpad-backend: supabase -->
## 5. Per-locale workflow (publish languages independently)

The workflow engine creates one `daas_wf_instance` per row of any collection that has an assignment, keyed by `(collection, item_id)`. Put Group B on the **junction** and each translation row gets its own draft/review/published lifecycle — no DaaS changes.

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles_translations",
        "field": "workflow_instance",
        "type": "uuid",
        "schema": { "is_nullable": true },
        "meta": { "interface": "select-dropdown-m2o", "special": ["m2o"], "readonly": true, "hidden": true, "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles_translations",
        "field": "workflow_state",
        "type": "string",
        "meta": { "interface": "xtr-interface-workflow", "readonly": true }
      }
    ]
  }
}
```

Then, per [create-workflow](../../create-workflow/SKILL.md): a definition, and an assignment `{ "workflow": "<definition-uuid>", "collection": "articles_translations", "filter_rule": {} }`. Add to the SQL mirror:

```sql
alter table public.articles_translations
    add column if not exists workflow_instance uuid null references public.daas_wf_instance(id) on delete set null,
    add column if not exists workflow_state    text null;
create index if not exists idx_articles_translations_workflow_instance on public.articles_translations (workflow_instance);
```

Rules:

- **Do not rely on parent-level Group B for per-language publishing.** One `workflow_state` on `articles` means "publish English" publishes every language. Keep parent Group B only when the locale-independent fields have their own lifecycle; then both collections carry Group B, each with its own assignment.
- **Parent-level versions cannot draft translation rows.** `VersionService` applies one JSONB delta to one row and alias fields are stripped from the payload; per-locale drafts are `daas_versions` rows whose `collection` is the junction.
- **One draft per locale is a convention, not a constraint.** Neither `daas_versions` nor `daas_wf_instance` has a unique index on `(collection, item_id, version_key)`; reuse an existing draft for a translation row instead of creating another.
- Published-only reads add `"workflow_state": { "_eq": "Published" }` to the filters in §4.

---

## 6. Scope (multi-tenancy)

If the parent is scoped (`resource_uri`, Group C), the junction must be scoped too or tenants will read each other's translations through the alias:

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "resource_uri",
      "type": "string",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "readonly": true,
        "hidden": true,
        "options": { "related_collection": "daas_scope_items", "related_field": "uri_path", "on_delete": "RESTRICT" }
      }
    }
  }
}
```

Register the junction in scope config with [manage-scope](../../manage-scope/SKILL.md) (same `inheritance_mode` as the parent). `languages` stays unscoped.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## 5. Per-locale workflow (publish languages independently)

The workflow engine creates one `daas_wf_instance` per row of any collection that has an assignment, keyed by `(collection, item_id)`. Put Group B on the **junction** and each translation row gets its own draft/review/published lifecycle.

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": [
      {
        "collection": "articles_translations",
        "field": "workflow_instance",
        "type": "uuid",
        "meta": { "interface": "select-dropdown-m2o", "special": ["m2o"], "readonly": true, "hidden": true, "options": { "related_collection": "daas_wf_instance", "related_field": "id", "on_delete": "SET NULL" } }
      },
      {
        "collection": "articles_translations",
        "field": "workflow_state",
        "type": "string",
        "meta": { "interface": "xtr-interface-workflow", "readonly": true }
      }
    ]
  }
}
```

Then, per [create-workflow](../../create-workflow/SKILL.md): a definition (`POST /api/workflows`), and an assignment through `POST /api/workflow-assignments`: `{ "workflow": "<definition-uuid>", "collection": "articles_translations", "filter_rule": {} }`. There is no SQL file to add.

Rules:

- **Do not rely on parent-level Group B for per-language publishing.** One `workflow_state` on `articles` means "publish English" publishes every language. Keep parent Group B only when the locale-independent fields have their own lifecycle; then both collections carry Group B, each with its own assignment.
- **Parent-level versions cannot draft translation rows.** A version (`/api/versions`) holds one delta for one item of one collection; per-locale drafts are versions whose `collection` is the junction.
- **Treat one draft per locale as a convention.** Reuse an existing draft for a translation row instead of creating another.
- Published-only reads add `"workflow_state": { "_eq": "Published" }` to the filters in §4.

---

## 6. Scope (multi-tenancy)

On an Engine project the project is one tenant. Every scope hierarchy begins below the project's tenant node: create no scope type without a parent and no scope item without a parent. Scope types, items and collection settings are managed through the MCP `scope` tool, or through `/api/scope/types`, `/api/scope/items` and `/api/scope/collection-config` with an administrator's session. The tool reads types, items and collection settings with the caller's grants; only an administrator may create, change or delete them through it, read a user's roles (`read_user_roles`), or assign and remove a role at a scope (`assign_user_role`, `remove_user_role`), and a delete is refused while the project's MCP deletes are off. If `tools/list` offers only `assign_user_role` and `create_config` for it, the project's Engine is older than 0.1.0-dev.19: use the routes for the rest.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

If the parent is scoped (`resource_uri`, Group C), the junction must be scoped too or users of one scope will read another scope's translations through the alias:

```json
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "collection": "articles_translations",
    "data": {
      "field": "resource_uri",
      "type": "string",
      "meta": {
        "interface": "list-m2o",
        "special": ["m2o"],
        "readonly": true,
        "hidden": true,
        "options": { "related_collection": "daas_scope_items", "related_field": "uri_path", "on_delete": "RESTRICT" }
      }
    }
  }
}
```

Register the junction in the scope collection settings (`/api/scope/collection-config`) with [manage-scope](../../manage-scope/SKILL.md), with the same `inheritance_mode` as the parent. `languages` stays unscoped.
<!-- /buildpad-backend -->

---

## 7. Field and collection display names

DaaS already stores translated display names in `daas_fields.translations` and `daas_collections.translations` (`[{ "language": "id", "translation": "Judul" }]`), editable in the admin's field settings or via the `fields` tool's update action:

```json
{ "meta": { "translations": [ { "language": "id", "translation": "Judul" }, { "language": "en", "translation": "Title" } ] } }
```

`VForm`/`FormField` resolve them through `getFieldDisplayName(field, locale)` when the page passes `locale={locale}` from `useI18n()`. Matching is exact, then prefix (`id-ID` → `id`), then Title Case of the field name.

---

## 8. Checklist per translated collection

- [ ] `languages` exists, seeded, `code` values equal `lib/i18n/config.ts`
- [ ] Junction created with Group A; parent link created with `corresponding_field: "translations"`; language link with `related_field: "code"`
- [ ] `articles.translations` shows `special: ["o2m"]` (not `translations`) in the `fields` tool
<!-- buildpad-backend: supabase -->
- [ ] SQL mirror with `unique (<parent>_id, languages_code)` committed
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- [ ] The pair `(<parent>_id, languages_code)` made unique through the schema migration routes (Step 2e)
<!-- /buildpad-backend -->
- [ ] Permissions granted; relational-permissions checked for nested writes
- [ ] Group B on the junction (+ assignment) if languages publish independently
- [ ] Group C on the junction if the parent is scoped
- [ ] Reads go through `pickTranslation()` with the default-locale fallback
- [ ] `tests/api/translations.spec.ts` covers create-through-parent, read-per-locale, fallback, and per-locale workflow isolation
