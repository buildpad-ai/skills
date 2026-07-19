---
name: create-api-route
description: Generate a server-side Next.js API route for Supabase auth (login, logout, callback, session). These routes manage Supabase SSR cookies and run server-side. Do NOT use this skill to create proxy routes for DaaS data — the UI calls DaaS directly using Authorization Bearer tokens instead. Use when the user needs a new auth endpoint or server-side Supabase route.
argument-hint: "[route type: login|logout|callback|user]"
---

# Create API Route

Generate a server-side Supabase auth route. These routes manage HTTP-only cookies for Supabase SSR sessions.

> **Important:** Only create auth routes here. Data routes (items, fields, files, etc.) are NOT needed — the UI calls DaaS directly using `Authorization: Bearer <supabase-jwt>`. CORS is handled by DaaS via `CORS_ORIGINS` env var.

## Auth Routes Only

```
app/api/auth/
├── login/route.ts      # POST — Supabase signInWithPassword
├── logout/route.ts     # POST — Supabase signOut
├── callback/route.ts   # GET  — OAuth/magic-link code exchange
└── user/route.ts       # GET  — Current user from server-side session
```

## Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ collection: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");
  const sort = searchParams.get("sort");
  const filter = searchParams.get("filter");

  let query = supabase.from(collection).select("*", { count: "exact" });
  query = query.range(offset, offset + limit - 1);
  if (sort)
    query = query.order(sort.replace("-", ""), {
      ascending: !sort.startsWith("-"),
    });

  const { data, error, count } = await query;
  if (error)
    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: 500 },
    );
  return NextResponse.json({
    data,
    meta: { total_count: count, filter_count: count },
  });
}
```

## Query Parameters

- `fields` — Comma-separated field names or `*`
- `filter` — JSON filter object `{ "status": { "_eq": "published" } }`
- `sort` — Sort field(s) with `-` prefix for descending
- `limit`, `offset` — Pagination
- `aggregate` — Aggregate functions: `aggregate[count]=id` or `aggregate={"count":["id"]}`
- `groupBy` — Group aggregate results by field(s)

When an `aggregate` parameter is present, the GET handler returns computed values instead of individual items. Supported operations: `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`, `avgDistinct`, `min`, `max`. Response format: `{ data: [{ count: { id: 42 } }] }` (no pagination meta).

> **⚠️ Field Name Verification:** Before using any field name in `sort`, `fields`, or `filter` parameters, verify it exists in the DaaS schema using `mcp_daas_schema` or `mcp_daas_fields`. Using a non-existent field (e.g., `sort=-date_created` when the actual column is `created_at`) causes DaaS to return a **500 error** with no helpful message. Never assume field names — always check the schema first.

## Authentication

All routes must check auth:

```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user)
  return NextResponse.json(
    { errors: [{ message: "Unauthorized" }] },
    { status: 401 },
  );
```

## Input Validation (Zod)

```typescript
import { z } from "zod";
const schema = z.object({
  name: z.string().min(1).max(255),
  status: z.enum(["draft", "published"]),
});
const validated = schema.parse(body);
```

## Required Tests

Create `tests/api/[collection].spec.ts` with:

- GET all items (200) + query parameters
- POST create with valid data (201) + invalid data (400)
- GET single item (200) + non-existent (404)
- PATCH update (200) + non-existent (404)
- DELETE item (200/204) + non-existent (404)

## References

- [API route patterns](references/api-routes.instructions.md)
- [API authorization](references/api-authorization.instructions.md)
