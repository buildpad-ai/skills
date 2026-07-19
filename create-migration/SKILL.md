---
name: create-migration
description: Generate a Supabase PostgreSQL database migration with proper schema, RLS policies, indexes, triggers, and grants. Follows DaaS naming conventions and includes standard audit columns. Use when the user needs a database migration, table creation, schema change, or wants to add columns to a collection.
argument-hint: "[migration description]"
---

# Create Database Migration

Generate a Supabase PostgreSQL migration with proper schema, RLS policies, and indexes.

## Migration File Location

```
supabase/migrations/[YYYYMMDDHHMMSS]_[description].sql
```

## Naming Conventions

- Tables: `snake_case`, plural (`user_profiles`, `blog_posts`)
- Columns: `snake_case` (`date_created`, `user_id`)
- Primary keys: `id` (UUID)
- Foreign keys: `[referenced_table]_id` (`category_id`)
- Junction tables: `[table1]_[table2]` (`products_tags`)

## Standard Columns

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
date_created timestamptz DEFAULT now(),
date_updated timestamptz,
user_created uuid REFERENCES auth.users(id),
user_updated uuid REFERENCES auth.users(id)
```

## Migration Sections (Required)

1. **Header Comment** — description, author, date
2. **CREATE TABLE** — with data types and constraints
3. **Enable RLS** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. **RLS Policies** — SELECT, INSERT, UPDATE, DELETE
5. **Indexes** — FK columns, filtered columns, sorted columns
6. **Triggers** — `date_updated` auto-update, audit logging
7. **GRANT** — permissions for `authenticated` and `anon` roles

## Data Types

| Use Case   | PostgreSQL Type             |
| ---------- | --------------------------- |
| ID         | `uuid`                      |
| Short text | `text` or `varchar(n)`      |
| Long text  | `text`                      |
| Integer    | `integer` or `bigint`       |
| Decimal    | `numeric(precision, scale)` |
| Boolean    | `boolean`                   |
| Timestamp  | `timestamptz`               |
| JSON       | `jsonb`                     |
| Array      | `text[]`, `uuid[]`          |
| Enum       | `text` with CHECK           |

## Relationships

### One-to-Many

```sql
category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL
```

### Many-to-Many (junction table)

```sql
CREATE TABLE public.products_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  products_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tags_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(products_id, tags_id)
);
```

## RLS Policy Patterns

```sql
-- Owner can CRUD their own
CREATE POLICY "users_own_data" ON public.[table]
  FOR ALL USING (auth.uid() = user_created);

-- Published items are public
CREATE POLICY "published_public" ON public.[table]
  FOR SELECT USING (status = 'published' OR auth.uid() = user_created);
```

## Commands

```bash
supabase migration new [description]
supabase db push
supabase db reset
```

## References

- [Special fields](references/special-fields.instructions.md)
