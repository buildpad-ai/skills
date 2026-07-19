---
name: API Routes
description: DaaS-compatible API route patterns for DaaS
applyTo: "app/api/**/*.ts"
---

# API Route Instructions

## Overview

All API routes follow DaaS-compatible patterns with:

- Standard REST endpoints
- DaaS-style query parameters (fields, filter, search, sort, limit, page)
- Consistent response format (`{ data: ... }` or `{ errors: [...] }`)
- Authentication via JWT or static tokens
- Permission enforcement via RLS and RBAC

**Important:** For authorization patterns, see [api-authorization.instructions.md](./api-authorization.instructions.md) which covers:

- Authentication methods (Cookie, JWT, Static Token)
- Permission enforcement with `enforcePermission()`
- Field-level access control
- Item-level filtering

## Auth Module Setup

All API routes should use `@buildpad/services/auth` for authentication:

```typescript
// lib/supabase/auth-config.ts
import { configureAuth } from "@buildpad/services/auth";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

let initialized = false;

export function initializeAuth() {
  if (initialized) return;

  configureAuth({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    getHeaders: () => headers(),
    getCookies: () => cookies(),
    createServerClient,
    createClient,
  });

  initialized = true;
}
```

## Standard REST Endpoint Pattern (with Authorization)

```typescript
// app/api/items/[collection]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { initializeAuth } from "@/lib/supabase/auth-config";
import {
  createAuthenticatedClient,
  enforcePermission,
  filterResponseFields,
  getPermissionFilters,
  applyFilterToQuery,
  validateFieldsAccess,
  AuthenticationError,
  PermissionError,
} from "@buildpad/services/auth";
import { z } from "zod";

// Initialize auth
initializeAuth();

type RouteParams = { params: Promise<{ collection: string }> };

// Query params schema
const querySchema = z.object({
  fields: z.string().optional(),
  filter: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  limit: z.coerce.number().optional().default(25),
  offset: z.coerce.number().optional().default(0),
  page: z.coerce.number().optional(),
  meta: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { collection } = await params;
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    // 1. Enforce permission
    const { user, isAdmin } = await enforcePermission({
      collection,
      action: "read",
    });

    // 2. Get authenticated client
    const { supabase } = await createAuthenticatedClient();
    let queryBuilder = supabase
      .from(collection)
      .select(query.fields || "*", { count: "exact" });

    // 3. Apply permission filters (non-admin only)
    if (!isAdmin) {
      const permissionFilter = await getPermissionFilters(collection, "read");
      if (permissionFilter) {
        queryBuilder = applyFilterToQuery(queryBuilder, permissionFilter);
      }
    }

    // Apply user filter
    if (query.filter) {
      const filter = JSON.parse(query.filter);
      queryBuilder = applyFilterToQuery(queryBuilder, filter);
    }

    // Apply search (across text fields)
    if (query.search) {
      // Apply full-text search...
    }

    // Calculate offset from page if provided
    const offset = query.page ? (query.page - 1) * query.limit : query.offset;

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + query.limit - 1);

    // Apply sort
    if (query.sort) {
      const desc = query.sort.startsWith("-");
      const field = desc ? query.sort.slice(1) : query.sort;
      queryBuilder = queryBuilder.order(field, { ascending: !desc });
    }

    const { data, error, count } = await queryBuilder;

    if (error) throw error;

    // 4. Filter response fields (non-admin only)
    const filteredData = isAdmin
      ? data
      : await filterResponseFields(data || [], collection, "read");

    return NextResponse.json({
      data: filteredData,
      meta: {
        total_count: count,
        filter_count: data?.length,
        page: query.page || 1,
        limit: query.limit,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { collection } = await params;
    const body = await request.json();

    // 1. Enforce permission
    const { user, isAdmin } = await enforcePermission({
      collection,
      action: "create",
    });

    // 2. Validate field access (non-admin only)
    if (!isAdmin) {
      const { allowed, forbiddenFields } = await validateFieldsAccess(
        Object.keys(body),
        collection,
        "create",
      );

      if (!allowed) {
        return NextResponse.json(
          {
            errors: [
              {
                message: `Access denied to fields: ${forbiddenFields.join(", ")}`,
              },
            ],
          },
          { status: 403 },
        );
      }
    }

    // 3. Create item
    const { supabase } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from(collection)
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
```

## Single Item Endpoint

```typescript
// app/api/items/[collection]/[id]/route.ts
import { initializeAuth } from "@/lib/supabase/auth-config";
import {
  createAuthenticatedClient,
  enforcePermission,
  filterResponseFields,
  getPermissionFilters,
  applyFilterToQuery,
  validateFieldsAccess,
} from "@buildpad/services/auth";

initializeAuth();

type RouteParams = {
  params: Promise<{ collection: string; id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { collection, id } = await params;

    // 1. Enforce permission
    const { isAdmin } = await enforcePermission({
      collection,
      action: "read",
    });

    // 2. Build query with permission filters
    const { supabase } = await createAuthenticatedClient();
    let query = supabase.from(collection).select("*").eq("id", id);

    if (!isAdmin) {
      const permissionFilter = await getPermissionFilters(collection, "read");
      if (permissionFilter) {
        query = applyFilterToQuery(query, permissionFilter);
      }
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { errors: [{ message: "Item not found" }] },
          { status: 404 },
        );
      }
      throw error;
    }

    // 3. Filter response fields
    const filteredData = isAdmin
      ? data
      : await filterResponseFields(data, collection, "read");

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { collection, id } = await params;
    const body = await request.json();

    // 1. Enforce permission
    const { isAdmin } = await enforcePermission({
      collection,
      action: "update",
    });

    // 2. Validate field access
    if (!isAdmin) {
      const { allowed, forbiddenFields } = await validateFieldsAccess(
        Object.keys(body),
        collection,
        "update",
      );

      if (!allowed) {
        return NextResponse.json(
          {
            errors: [
              {
                message: `Access denied to fields: ${forbiddenFields.join(", ")}`,
              },
            ],
          },
          { status: 403 },
        );
      }
    }

    // 3. Build update query with permission filters
    const { supabase } = await createAuthenticatedClient();
    let query = supabase.from(collection).update(body).eq("id", id);

    if (!isAdmin) {
      const permissionFilter = await getPermissionFilters(collection, "update");
      if (permissionFilter) {
        query = applyFilterToQuery(query, permissionFilter);
      }
    }

    const { data, error } = await query.select().single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { errors: [{ message: "Item not found or access denied" }] },
          { status: 404 },
        );
      }
      throw error;
    }

    // 4. Filter response fields
    const filteredData = isAdmin
      ? data
      : await filterResponseFields(data, collection, "read");

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { collection, id } = await params;

    // 1. Enforce permission
    const { isAdmin } = await enforcePermission({
      collection,
      action: "delete",
    });

    // 2. Build delete query with permission filters
    const { supabase } = await createAuthenticatedClient();
    let query = supabase.from(collection).delete().eq("id", id);

    if (!isAdmin) {
      const permissionFilter = await getPermissionFilters(collection, "delete");
      if (permissionFilter) {
        query = applyFilterToQuery(query, permissionFilter);
      }
    }

    const { error } = await query;

    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
```

## Error Handling

Use the error handler from `@buildpad/services/auth`:

```typescript
import { AuthenticationError, PermissionError } from "@buildpad/services/auth";
import { z } from "zod";

function handleError(error: unknown): NextResponse {
  console.error("API Error:", error);

  // Authentication errors (401)
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: 401 },
    );
  }

  // Permission errors (403)
  if (error instanceof PermissionError) {
    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: error.statusCode },
    );
  }

  // Validation errors (400)
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        errors: error.errors.map((e) => ({
          message: e.message,
          field: e.path.join("."),
        })),
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    // Supabase errors
    if ("code" in error) {
      const pgError = error as { code: string; message: string };

      switch (pgError.code) {
        case "23505": // unique_violation
          return NextResponse.json(
            { errors: [{ message: "Duplicate entry" }] },
            { status: 409 },
          );
        case "23503": // foreign_key_violation
          return NextResponse.json(
            { errors: [{ message: "Referenced item not found" }] },
            { status: 400 },
          );
        case "PGRST301": // insufficient_privilege
          return NextResponse.json(
            { errors: [{ message: "Forbidden" }] },
            { status: 403 },
          );
      }
    }

    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { errors: [{ message: "Internal server error" }] },
    { status: 500 },
  );
}
```

## Response Format (DaaS-compatible)

```typescript
// Success responses
{ data: Item }                    // Single item
{ data: Item[] }                  // Multiple items
{ data: Item[], meta: { ... } }   // With metadata

// Error responses
{
  errors: [
    { message: string, extensions?: { code: string, field?: string } }
  ]
}
```

## Authentication Check

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { errors: [{ message: "Unauthorized" }] },
      { status: 401 },
    );
  }

  // Continue with authorized request...
}
```

## Workflow Transition Endpoint

Required endpoint for WorkflowButton component:

```typescript
// app/api/workflow/transition/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      workflowInstanceId,
      commandName,
      workflowField = "status",
    } = await request.json();

    if (!workflowInstanceId || !commandName) {
      return NextResponse.json(
        {
          error: "Missing required fields: workflowInstanceId and commandName",
        },
        { status: 400 },
      );
    }

    // 1. Get workflow instance with definition
    const { data: instance, error: instanceError } = await supabase
      .from("daas_wf_instance")
      .select("*, workflow:daas_wf_definition(*)")
      .eq("id", workflowInstanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: "Workflow instance not found" },
        { status: 404 },
      );
    }

    // 2. Parse workflow definition
    const workflowJson =
      typeof instance.workflow.workflow_json === "string"
        ? JSON.parse(instance.workflow.workflow_json)
        : instance.workflow.workflow_json;

    // 3. Find next state (supports both array and object formats)
    let nextState: string | null = null;

    if (Array.isArray(workflowJson.states)) {
      const currentState = workflowJson.states.find(
        (s: { name: string }) => s.name === instance.current_state,
      );
      const command = currentState?.commands?.find(
        (c: { name: string }) => c.name === commandName,
      );
      nextState = command?.next_state;
    } else if (typeof workflowJson.states === "object") {
      const currentStateConfig = workflowJson.states[instance.current_state];
      const transition = currentStateConfig?.transitions?.find(
        (t: { name: string }) => t.name === commandName,
      );
      nextState = transition?.to;
    }

    if (!nextState) {
      return NextResponse.json(
        {
          error: `Transition '${commandName}' not found for state '${instance.current_state}'`,
        },
        { status: 400 },
      );
    }

    // 4. Update workflow instance
    const { error: updateError } = await supabase
      .from("daas_wf_instance")
      .update({
        current_state: nextState,
        date_updated: new Date().toISOString(),
      })
      .eq("id", workflowInstanceId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update workflow: ${updateError.message}` },
        { status: 500 },
      );
    }

    // 5. Update item's workflow field (optional)
    if (workflowField && instance.collection && instance.item_id) {
      await supabase
        .from(instance.collection)
        .update({ [workflowField]: nextState })
        .eq("id", instance.item_id);
    }

    // 6. Record history (optional)
    try {
      await supabase.from("daas_wf_history").insert({
        workflow_instance: workflowInstanceId,
        from_state: instance.current_state,
        to_state: nextState,
        command_name: commandName,
        user_id: user.id,
      });
    } catch {
      // History table may not exist
    }

    return NextResponse.json({
      data: {
        success: true,
        previousState: instance.current_state,
        currentState: nextState,
      },
    });
  } catch (error) {
    console.error("Workflow transition error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
```

## Users API Endpoints

### Get Current User

```typescript
// app/api/users/me/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fields = searchParams.get("fields") || "*";

  const { data, error: dbError } = await supabase
    .from("daas_users")
    .select(fields)
    .eq("id", user.id)
    .single();

  if (dbError) throw dbError;

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  // Filter allowed fields for self-update
  const allowedFields = [
    "first_name",
    "last_name",
    "avatar",
    "location",
    "title",
    "description",
    "language",
    "theme",
    "last_page",
    "roles",
  ];

  const restrictedFields = ["status", "email", "token"];
  const attempted = Object.keys(body).filter((k) =>
    restrictedFields.includes(k),
  );

  if (attempted.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot update restricted fields: ${attempted.join(", ")}`,
        fields: attempted,
      },
      { status: 403 },
    );
  }

  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowedFields.includes(k)),
  );

  // Handle password update via Supabase Auth
  if (body.password) {
    await supabase.auth.updateUser({ password: body.password });
  }

  const { data, error: dbError } = await supabase
    .from("daas_users")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (dbError) throw dbError;

  return NextResponse.json({ data });
}
```

## Files API Endpoints

### Upload Files

```typescript
// app/api/files/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const folder = formData.get("folder") as string | null;
  const title = formData.get("title") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const filename = `${Date.now()}-${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("files")
    .upload(filename, file);

  if (uploadError) throw uploadError;

  // Create metadata record
  const { data, error: dbError } = await supabase
    .from("daas_files")
    .insert({
      filename_disk: uploadData.path,
      filename_download: file.name,
      title: title || file.name,
      type: file.type,
      filesize: file.size,
      folder,
      uploaded_by: user.id,
      uploaded_on: new Date().toISOString(),
    })
    .select()
    .single();

  if (dbError) throw dbError;

  return NextResponse.json({ data }, { status: 201 });
}
```

## Permissions Check

```typescript
// Helper to check user permissions
async function checkPermission(
  supabase: SupabaseClient,
  userId: string,
  collection: string,
  action: "create" | "read" | "update" | "delete",
): Promise<boolean> {
  // Check if user is admin via policy-based access
  const { data: isAdmin } = await supabase.rpc("has_admin_access", {
    user_id: userId,
  });

  if (isAdmin) return true;

  // Check role-based permissions
  const { data: permissions } = await supabase
    .from("daas_permissions")
    .select("*")
    .eq("collection", collection)
    .eq("action", action);

  // Check if any permission matches user's role/policies
  // ... implementation depends on your permission model

  return permissions && permissions.length > 0;
}
```

## Utilities Endpoints

```typescript
// app/api/utils/hash/generate/route.ts
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { string } = await request.json();

  if (!string) {
    return NextResponse.json(
      {
        errors: [
          {
            message: '"string" is required',
            extensions: { code: "INVALID_PAYLOAD" },
          },
        ],
      },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(string, 10);
  return NextResponse.json({ data: hash });
}

// app/api/utils/hash/verify/route.ts
export async function POST(request: NextRequest) {
  const { string, hash } = await request.json();

  if (!string || !hash) {
    return NextResponse.json(
      {
        errors: [{ message: '"string" and "hash" are required' }],
      },
      { status: 400 },
    );
  }

  const isValid = await bcrypt.compare(string, hash);
  return NextResponse.json({ data: isValid });
}

// app/api/utils/random/string/route.ts
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const length = parseInt(searchParams.get("length") || "32");

  if (length < 1 || length > 500) {
    return NextResponse.json(
      {
        errors: [{ message: '"length" must be between 1 and 500' }],
      },
      { status: 400 },
    );
  }

  const randomString = nanoid(length);
  return NextResponse.json({ data: randomString });
}
```

## Version Endpoints

```typescript
// app/api/versions/[id]/save/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const delta = await request.json();

  const supabase = await createClient();

  // Get existing version
  const { data: version } = await supabase
    .from("daas_versions")
    .select("delta")
    .eq("id", id)
    .single();

  // Merge deltas
  const newDelta = { ...(version?.delta || {}), ...delta };

  const { data, error } = await supabase
    .from("daas_versions")
    .update({
      delta: newDelta,
      date_updated: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({ data });
}

// app/api/versions/[id]/promote/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();

  // Get version with delta
  const { data: version } = await supabase
    .from("daas_versions")
    .select("*")
    .eq("id", id)
    .single();

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Apply delta to main item
  const { error } = await supabase
    .from(version.collection)
    .update(version.delta)
    .eq("id", version.item);

  if (error) throw error;

  return NextResponse.json({
    data: { mainItem: version.item, version: id },
  });
}
```

## Best Practices

1. **Always validate input** with Zod schemas
2. **Use consistent error format** with `errors` array
3. **Apply authentication** on all non-public endpoints
4. **Check permissions** before data access
5. **Handle M2M/alias fields** - filter them out before database updates
6. **Support DaaS query params** - fields, filter, search, sort, limit, page
7. **Return metadata** when requested via `meta` param
8. **Use transactions** for multi-step operations
