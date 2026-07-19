---
name: API Authorization
description: Authentication and authorization patterns for DaaS API routes
applyTo: "app/api/**/*.ts"
---

# API Authorization Instructions

## Overview

All API routes must implement proper authentication and authorization using the `@buildpad/services/auth` module. This ensures consistent security across all generated applications.

## Required Setup

### 1. Auth Configuration

Create an auth configuration file that initializes the auth module:

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
    cookieConfig: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });

  initialized = true;
}
```

### 2. Import Pattern

All API routes should import from the auth module:

```typescript
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

// Initialize at module level
initializeAuth();
```

## Standard API Route Pattern

### GET - Read Items

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    const { collection } = await params;

    // 1. Enforce permission (throws if denied)
    const { user, isAdmin } = await enforcePermission({
      collection,
      action: "read",
    });

    // 2. Get authenticated Supabase client
    const { supabase } = await createAuthenticatedClient();

    // 3. Build query
    let query = supabase.from(collection).select("*", { count: "exact" });

    // 4. Apply item-level permission filters (non-admin only)
    if (!isAdmin) {
      const permissionFilter = await getPermissionFilters(collection, "read");
      if (permissionFilter) {
        query = applyFilterToQuery(query, permissionFilter);
      }
    }

    // 5. Execute query
    const { data, error, count } = await query;
    if (error) throw error;

    // 6. Filter fields based on permissions (non-admin only)
    const filteredData = isAdmin
      ? data
      : await filterResponseFields(data, collection, "read");

    return NextResponse.json({
      data: filteredData,
      meta: { total_count: count },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### POST - Create Items

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
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

    // 4. Filter response fields
    const filteredData = isAdmin
      ? data
      : await filterResponseFields(data, collection, "read");

    return NextResponse.json({ data: filteredData }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### PATCH - Update Items

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  try {
    const { collection, id } = await params;
    const body = await request.json();

    // 1. Enforce permission
    const { user, isAdmin } = await enforcePermission({
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
    return handleAuthError(error);
  }
}
```

### DELETE - Remove Items

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
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
    return handleAuthError(error);
  }
}
```

## Error Handler

Create a reusable error handler:

```typescript
// lib/utils/api-errors.ts
import { NextResponse } from "next/server";
import { AuthenticationError, PermissionError } from "@buildpad/services/auth";

export function handleAuthError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: 401 },
    );
  }

  if (error instanceof PermissionError) {
    return NextResponse.json(
      { errors: [{ message: error.message }] },
      { status: error.statusCode },
    );
  }

  if (error instanceof Error) {
    // Handle Supabase errors
    const pgError = error as { code?: string; message: string };

    switch (pgError.code) {
      case "PGRST116":
        return NextResponse.json(
          { errors: [{ message: "Item not found" }] },
          { status: 404 },
        );
      case "23505":
        return NextResponse.json(
          { errors: [{ message: "Duplicate entry" }] },
          { status: 409 },
        );
      case "23503":
        return NextResponse.json(
          { errors: [{ message: "Referenced item not found" }] },
          { status: 400 },
        );
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

## Self-Access Pattern

For endpoints where users should access their own data:

```typescript
export async function GET(request: NextRequest) {
  try {
    // Use createAuthenticatedClient directly (no collection permission needed)
    const { supabase, user } = await createAuthenticatedClient();

    const { data, error } = await supabase
      .from("daas_users")
      .select("id, email, first_name, last_name, avatar, status")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

## Admin-Only Endpoints

For endpoints that require admin access:

```typescript
import { isAdmin, AuthenticationError } from "@buildpad/services/auth";

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const adminAccess = await isAdmin();

    if (!adminAccess) {
      throw new PermissionError("Admin access required", 403);
    }

    // Proceed with admin operation...
  } catch (error) {
    return handleAuthError(error);
  }
}
```

## Public Endpoints (No Auth Required)

For truly public endpoints:

```typescript
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  // Use anon key client (respects RLS for public access)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("public_content")
    .select("*")
    .eq("published", true);

  if (error) throw error;

  return NextResponse.json({ data });
}
```

## Permission Hierarchy

1. **Admin** (policy grants `admin_access = true`, checked via `has_admin_access()` RPC): Full access to everything
2. **Self-Access**: Users can always access their own user record
3. **Permission-Based**: Access via role/policy permissions
4. **Public**: Access to public collections via RLS

## Security Checklist

When creating an API route, ensure:

- [ ] `initializeAuth()` is called at module level
- [ ] `enforcePermission()` is called before any data access
- [ ] Field access is validated for write operations
- [ ] Permission filters are applied to queries
- [ ] Response fields are filtered for non-admin users
- [ ] Proper error handling with `handleAuthError()`
- [ ] No sensitive data exposed in error messages
