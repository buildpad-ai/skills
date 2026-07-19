---
applyTo: "**/*.{spec.ts,test.ts},**/app/**/*.{ts,tsx},**/api/**/*.ts"
---

# Playwright E2E Testing Standards

All implementations, features, and refactors MUST include Playwright tests to ensure functional correctness. This document defines the testing strategy, patterns, and requirements.

## 🎯 Two-Tier Testing Strategy

Buildpad uses a **two-tier testing approach** for comprehensive validation:

### Tier 1: Storybook Component Tests (Isolated)

- **Purpose:** Fast, isolated component testing without authentication
- **Environment:** Storybook on `localhost:6006`
- **Auth Required:** No - uses mocked data
- **Best For:** Component development, interface testing, visual validation

```bash
# Start Storybook for VForm development
pnpm storybook:form

# Run Playwright against Storybook
pnpm test:storybook
```

**Test Files:**

- `tests/ui-form/vform-storybook.spec.ts` - VForm Storybook tests
- `packages/ui-form/src/VForm.stories.tsx` - Mocked data stories
- `packages/ui-form/src/VForm.daas.stories.tsx` - DaaS Playground (real API)

### Tier 2: DaaS E2E Tests (Integration)

- **Purpose:** Full integration testing with real API
- **Environment:** DaaS application
- **Auth Required:** Yes - uses admin user credentials
- **Best For:** Complete workflows, permissions, real data

```bash
# Run against hosted DaaS
pnpm test:e2e

# Interactive Playwright UI
pnpm test:e2e:ui
```

**Test Files:**

- `tests/ui-form/vform-daas.spec.ts` - DaaS integration tests
- `tests/ui-form/vform.spec.ts` - Complete E2E workflow tests
- `tests/auth.setup.ts` - Authentication setup

### DaaS Playground (Storybook with Real API)

The DaaS Playground story allows testing VForm with real DaaS credentials:

**Proxy Mode (Recommended - No CORS):**

```bash
# Start with environment variables for Vite proxy
STORYBOOK_DAAS_URL=https://xxx.buildpad-daas.xtremax.com \
STORYBOOK_DAAS_TOKEN=your-static-token \
pnpm storybook:form
```

**Direct Mode (Manual Entry):**

```bash
# Start Storybook without env vars
pnpm storybook:form
# Navigate to "Forms/VForm DaaS Playground"
# Enter DaaS URL and static token manually
```

## 🔴 CRITICAL: Test Requirements

**Implementation is NOT complete without corresponding tests!**

Every implementation MUST include:

1. **API Tests** - For all new/modified API routes
2. **Page Tests** - For all new/modified pages
3. **Component Tests** - For complex interactive components
4. **E2E Tests** - For complete user flows

## Test Directory Structure

```
tests/
├── auth.setup.ts                    # Global auth setup (runs once)
├── setup-test-users.ts              # Test user creation script
├── helpers/
│   ├── test-utils.ts               # Shared test utilities
│   ├── test-fixtures.ts            # Database fixtures
│   └── auth-tokens.ts              # Auth helpers
├── api/                            # API endpoint tests
│   └── [feature].spec.ts           # REST API tests
├── components/                     # Component integration tests
│   └── [component].spec.ts         # Interactive component tests
├── pages/                          # Page E2E tests
│   └── [page].spec.ts              # Page behavior tests
└── e2e/                            # End-to-end user flows
    └── [flow].spec.ts              # Complete user journeys
```

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## Authentication Setup

Authentication is a critical component of E2E testing. The framework uses Playwright's storage state feature to create reusable auth states for different user types.

### Authentication Architecture

```
tests/
├── auth.setup.ts              # Creates auth state files (runs once before all tests)
├── setup-test-users.ts        # Creates test users in database (run manually)
├── helpers/
│   └── auth-tokens.ts         # Auth token helpers for API tests
└── playwright/
    └── .auth/                 # Generated auth state files (gitignored)
        ├── admin.json         # Admin user session
        ├── readonly.json      # Read-only user session
        ├── editor.json        # Editor user session
        └── [custom].json      # Custom test user sessions
```

### Step 1: Create Test Users Script

Create `tests/setup-test-users.ts` to provision test users with specific permissions:

```typescript
/**
 * Setup script to create test users with specific permissions
 * Run this before executing E2E tests
 *
 * Usage: pnpm tsx tests/setup-test-users.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing required environment variables:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test role IDs - use constants for consistent test infrastructure
const ROLE_IDS = {
  readOnly: "11111111-1111-1111-1111-111111111111",
  editor: "22222222-2222-2222-2222-222222222222",
  creator: "33333333-3333-3333-3333-333333333333",
  noPermission: "44444444-4444-4444-4444-444444444444",
};

// Test users configuration
const TEST_USERS = [
  {
    email: "readonly@test.com",
    password: "Test123!@#",
    firstName: "Read",
    lastName: "Only",
    roleId: ROLE_IDS.readOnly,
  },
  {
    email: "editor@test.com",
    password: "Test123!@#",
    firstName: "Editor",
    lastName: "User",
    roleId: ROLE_IDS.editor,
  },
  {
    email: "creator@test.com",
    password: "Test123!@#",
    firstName: "Creator",
    lastName: "User",
    roleId: ROLE_IDS.creator,
  },
  {
    email: "noperm@test.com",
    password: "Test123!@#",
    firstName: "No",
    lastName: "Permission",
    roleId: ROLE_IDS.noPermission,
  },
];

async function createTestUser(config: (typeof TEST_USERS)[0]) {
  console.log(`\n📝 Creating user: ${config.email}`);

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
        user_metadata: {
          first_name: config.firstName,
          last_name: config.lastName,
        },
      });

    if (authError) {
      if (authError.message.includes("already registered")) {
        console.log(`  ⚠️  User already exists, updating...`);

        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(
          (u) => u.email === config.email,
        );

        if (existingUser) {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password: config.password,
          });

          // Assign role via M2M junction table (daas_users.role column was removed)
          await supabase.from("daas_user_roles").upsert(
            { daas_users_id: existingUser.id, role_id: config.roleId },
            { onConflict: "daas_users_id,role_id" },
          );

          console.log(`  ✅ Updated existing user`);
          return;
        }
      }
      throw authError;
    }

    if (!authData?.user) {
      throw new Error("User creation failed");
    }

    const userId = authData.user.id;
    console.log(`  ✅ Created auth user: ${userId}`);

    // 2. Create/update daas_users record (role is assigned via junction table, not a column)
    const { error: updateError } = await supabase.from("daas_users").upsert({
      id: userId,
      email: config.email,
      first_name: config.firstName,
      last_name: config.lastName,
      status: "active",
    });

    if (updateError) {
      console.error(`  ❌ Error updating daas_users:`, updateError);
    } else {
      console.log(`  ✅ Created daas_users record`);
    }

    // 3. Assign role via daas_user_roles M2M junction table
    const { error: roleError } = await supabase.from("daas_user_roles").upsert(
      { daas_users_id: userId, role_id: config.roleId },
      { onConflict: "daas_users_id,role_id" },
    );

    if (roleError) {
      console.error(`  ❌ Error assigning role:`, roleError);
    } else {
      console.log(`  ✅ Assigned role via junction table`);
    }
  } catch (error) {
    console.error(`  ❌ Error creating user:`, error);
  }
}

async function main() {
  console.log("🚀 Setting up test users for E2E testing...\n");

  for (const user of TEST_USERS) {
    await createTestUser(user);
  }

  console.log("\n✨ Test user setup complete!\n");
  console.log("📋 Test user credentials:");
  TEST_USERS.forEach((user) => {
    console.log(`   ${user.email} / ${user.password}`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### Step 2: Auth Setup File

Create `tests/auth.setup.ts` to generate auth state files:

```typescript
// tests/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

/**
 * Global setup that runs before all tests.
 * Creates multiple authentication states for different user types.
 */

/**
 * Setup 1: Admin User
 * User whose policy grants admin_access = true
 */
setup("authenticate as admin", async ({ page }) => {
  const authFile = "playwright/.auth/admin.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  // Login as admin user
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });
  await expect(
    page.locator('nav, [role="navigation"], h1, h2').first(),
  ).toBeVisible({ timeout: 5000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
  console.log("✓ Admin authentication state saved");
});

/**
 * Setup 2: Read-Only User
 * User with read permissions only
 */
setup("authenticate as readonly user", async ({ page }) => {
  const authFile = "playwright/.auth/readonly.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("readonly@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.waitForLoadState("networkidle");

  await page.context().storageState({ path: authFile });
  console.log("✓ Read-only user authentication state saved");
});

/**
 * Setup 3: Editor User
 * User with read + update permissions
 * Note: Skipped if user doesn't exist
 */
setup.skip("authenticate as editor user", async ({ page }) => {
  const authFile = "playwright/.auth/editor.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("editor@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });

  await page.context().storageState({ path: authFile });
  console.log("✓ Editor user authentication state saved");
});

/**
 * Setup 4: Creator User
 * User with read + create permissions
 */
setup.skip("authenticate as creator user", async ({ page }) => {
  const authFile = "playwright/.auth/creator.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("creator@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|policies|roles)/, { timeout: 10000 });

  await page.context().storageState({ path: authFile });
  console.log("✓ Creator user authentication state saved");
});

/**
 * Setup 5: No Permission User
 * User with no permissions at all
 */
setup.skip("authenticate as no-permission user", async ({ page }) => {
  const authFile = "playwright/.auth/noperm.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("noperm@test.com");
  await page.getByLabel("Password").fill("Test123!@#");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );

  await page.context().storageState({ path: authFile });
  console.log("✓ No-permission user authentication state saved");
});
```

### Step 3: Auth Token Helper

Create `tests/helpers/auth-tokens.ts` for API tests with bearer tokens:

```typescript
/**
 * Auth Token Helper for API Tests
 * Loads authentication tokens from environment or .env.test.local
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.test.local if it exists
const envPath = path.join(process.cwd(), ".env.test.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export const authTokens = {
  admin: process.env.TEST_ADMIN_TOKEN || "",
  limitedUser: process.env.TEST_LIMITED_USER_TOKEN || "",
  readonlyUser: process.env.TEST_READONLY_USER_TOKEN || "",
};

/**
 * Create request headers with auth token
 */
export function authHeaders(token: string): Record<string, string> {
  if (!token) {
    throw new Error("Auth token is undefined or empty");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Validate that all required tokens are available
 */
export function validateTokens(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!authTokens.admin) missing.push("TEST_ADMIN_TOKEN");

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get user ID from JWT token
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.sub || null;
  } catch {
    return null;
  }
}
```

### Step 4: Using Auth States in Tests

#### Using Storage State in Tests

```typescript
// tests/e2e/admin-features.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Admin Features", () => {
  // Use admin auth state for all tests in this describe block
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("should show admin navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("should access admin-only page", async ({ page }) => {
    await page.goto("/settings/ai");
    await expect(
      page.locator("h1, h2").filter({ hasText: "Settings" }),
    ).toBeVisible();
  });
});

test.describe("Non-Admin Access", () => {
  // Use readonly auth state for all tests in this describe block
  test.use({ storageState: "playwright/.auth/readonly.json" });

  test("should not show admin-only features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('a[href="/settings/ai"]')).not.toBeVisible();
  });

  test("should redirect from admin pages", async ({ page }) => {
    await page.goto("/settings/ai");
    await page.waitForLoadState("networkidle");

    // Should redirect or show 403
    expect(page.url()).not.toContain("/settings");
  });
});
```

#### Using Tokens in API Tests

```typescript
// tests/api/protected-endpoint.spec.ts
import { test, expect } from "@playwright/test";
import { authHeaders, authTokens } from "../helpers/auth-tokens";

test.describe("Protected API Endpoints", () => {
  test("should return 401 without auth", async ({ request }) => {
    const response = await request.get("/api/protected");
    expect(response.status()).toBe(401);
  });

  test("should return 200 with valid token", async ({ request }) => {
    const response = await request.get("/api/protected", {
      headers: authHeaders(authTokens.admin),
    });
    expect(response.status()).toBe(200);
  });

  test("should return 403 for unauthorized user", async ({ request }) => {
    const response = await request.delete("/api/admin-only", {
      headers: authHeaders(authTokens.readonlyUser),
    });
    expect(response.status()).toBe(403);
  });
});
```

### Setup Commands

```bash
# 1. Create test users in database (one-time)
pnpm tsx tests/setup-test-users.ts

# 2. Generate auth states (runs automatically with tests)
pnpm exec playwright test --project=setup

# 3. Verify auth files exist
ls -la playwright/.auth/
# Expected: admin.json, readonly.json, etc.
```

### Gitignore Auth Files

Add to `.gitignore`:

```gitignore
# Playwright auth states (contain session tokens)
playwright/.auth/
```

### Creating Custom Auth States for Specific Tests

For tests requiring specific permissions (e.g., item-level filtering):

```typescript
// tests/auth-custom.setup.ts
import { test as setup } from "@playwright/test";

setup("authenticate as user with status filter", async ({ page }) => {
  const authFile = "playwright/.auth/user-with-status-filter.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("filter-user@example.com");
  await page.getByLabel("Password").fill("Test123!@#");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.context().storageState({ path: authFile });
});

setup("authenticate as user with self access", async ({ page }) => {
  const authFile = "playwright/.auth/user-with-self-access.json";

  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Email").fill("self-access@example.com");
  await page.getByLabel("Password").fill("Test123!@#");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    { timeout: 10000 },
  );
  await page.context().storageState({ path: authFile });
});
```

### Auth State Reference

| Auth File          | User Type     | Permissions      | Use Case             |
| ------------------ | ------------- | ---------------- | -------------------- |
| `admin.json`       | Admin         | Full access      | Admin feature tests  |
| `readonly.json`    | Read-only     | Read only        | View-only tests      |
| `editor.json`      | Editor        | Read + Update    | Edit tests           |
| `creator.json`     | Creator       | Read + Create    | Create tests         |
| `noperm.json`      | No permission | None             | Access denied tests  |
| `user-with-*.json` | Custom        | Specific filters | RLS/permission tests |

## Test Utilities

Create reusable helpers in `tests/helpers/test-utils.ts`:

```typescript
import { Page, expect, APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

/**
 * Generic API request helper
 */
async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
  requestContext?: APIRequestContext,
) {
  if (requestContext) {
    let response;
    switch (method) {
      case "GET":
        response = await requestContext.get(path);
        break;
      case "POST":
        response = await requestContext.post(path, { data });
        break;
      case "PATCH":
        response = await requestContext.patch(path, { data });
        break;
      case "DELETE":
        response = await requestContext.delete(path);
        break;
    }
    return {
      ok: response.ok(),
      status: response.status(),
      json: () => response.json(),
      text: () => response.text(),
    };
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
    text: () => response.text(),
  };
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("networkidle");
}

/**
 * Login helper
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(users|roles|policies)/, { timeout: 10000 });
}

/**
 * Create test data via API
 */
export async function createTestDataViaAPI(
  endpoint: string,
  data: Record<string, unknown>,
  request?: APIRequestContext,
) {
  const response = await apiRequest("POST", endpoint, data, request);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create test data: ${response.status}. ${errorText}`,
    );
  }

  const result = (await response.json()) as { data?: unknown };
  if (!result || !result.data) {
    throw new Error(`Invalid response: ${JSON.stringify(result)}`);
  }

  return result.data;
}

/**
 * Delete test data via API
 */
export async function deleteTestDataViaAPI(
  endpoint: string,
  request?: APIRequestContext,
) {
  await apiRequest("DELETE", endpoint, undefined, request);
}

/**
 * Wait for notification
 */
export async function waitForNotification(page: Page, message?: string) {
  if (message) {
    await expect(
      page.locator(".mantine-Notification-root").filter({ hasText: message }),
    ).toBeVisible();
  } else {
    await expect(
      page.locator(".mantine-Notification-root").first(),
    ).toBeVisible();
  }
}
```

## API Test Patterns

### Basic CRUD API Test

```typescript
// tests/api/[feature].spec.ts
import { test, expect } from "@playwright/test";
import {
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] API", () => {
  let createdIds: string[] = [];

  test.afterEach(async () => {
    // Cleanup all created items
    for (const id of createdIds) {
      await deleteTestDataViaAPI(`/api/[feature]/${id}`);
    }
    createdIds = [];
  });

  test.describe("GET /api/[feature]", () => {
    test("should return all items", async ({ request }) => {
      // Create test data
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Test Item",
      });
      createdIds.push(item.id);

      const response = await request.get("http://localhost:3000/api/[feature]");
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBeTruthy();
    });

    test("should support search parameter", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Unique Search Term XYZ",
      });
      createdIds.push(item.id);

      const response = await request.get(
        "http://localhost:3000/api/[feature]?search=Unique",
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      const found = data.data.some((r: { name: string }) =>
        r.name.includes("Unique"),
      );
      expect(found).toBeTruthy();
    });
  });

  test.describe("GET /api/[feature]/[id]", () => {
    test("should return single item by ID", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Single Item Test",
      });
      createdIds.push(item.id);

      const response = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.id).toBe(item.id);
    });

    test("should return 404 for non-existent item", async ({ request }) => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request.get(
        `http://localhost:3000/api/[feature]/${fakeId}`,
      );
      expect(response.status()).toBe(404);
    });
  });

  test.describe("POST /api/[feature]", () => {
    test("should create item with valid data", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {
            name: "Created via Test",
            description: "Test description",
          },
        },
      );

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe("Created via Test");

      createdIds.push(data.data.id);
    });

    test("should validate required fields", async ({ request }) => {
      const response = await request.post(
        "http://localhost:3000/api/[feature]",
        {
          data: {},
        },
      );

      expect(response.status()).toBe(400);
    });
  });

  test.describe("PATCH /api/[feature]/[id]", () => {
    test("should update existing item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "Original Name",
      });
      createdIds.push(item.id);

      const response = await request.patch(
        `http://localhost:3000/api/[feature]/${item.id}`,
        {
          data: { name: "Updated Name" },
        },
      );

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.data.name).toBe("Updated Name");
    });
  });

  test.describe("DELETE /api/[feature]/[id]", () => {
    test("should delete item", async ({ request }) => {
      const item = await createTestDataViaAPI("/api/[feature]", {
        name: "To Be Deleted",
      });

      const response = await request.delete(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(response.status()).toBe(200);

      // Verify deleted
      const getResponse = await request.get(
        `http://localhost:3000/api/[feature]/${item.id}`,
      );
      expect(getResponse.status()).toBe(404);
    });
  });
});
```

## Page Test Patterns

### List Page Test

```typescript
// tests/pages/[feature].spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] Pages", () => {
  test.describe("/[feature] - List Page", () => {
    let testItemId: string;
    let uniqueName: string;

    test.beforeEach(async ({ page }) => {
      uniqueName = `E2E Test Item ${Date.now()}`;

      const item = await createTestDataViaAPI("/api/[feature]", {
        name: uniqueName,
        description: "Test item for E2E testing",
      });
      testItemId = item.id;

      await page.goto("/[feature]");
      await waitForPageLoad(page);

      await page
        .waitForSelector('[class*="LoadingOverlay"]', {
          state: "hidden",
          timeout: 10000,
        })
        .catch(() => {});
      await page.waitForSelector("table tbody", { timeout: 10000 });
    });

    test.afterEach(async () => {
      if (testItemId) {
        await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
      }
    });

    test("should display list page", async ({ page }) => {
      await expect(
        page.locator("h2, h1").filter({ hasText: "[Feature]" }),
      ).toBeVisible();
    });

    test("should display table with headers", async ({ page }) => {
      const table = page.locator("table");
      await expect(table).toBeVisible();

      const headers = page.locator("thead th");
      expect(await headers.count()).toBeGreaterThan(0);
    });

    test("should have Add button", async ({ page }) => {
      const createButton = page.locator('button:has-text("Add")');
      await expect(createButton).toBeVisible();
    });

    test("should display existing items", async ({ page }) => {
      await expect(
        page.locator("tbody").filter({ hasText: uniqueName }),
      ).toBeVisible();
    });

    test("should navigate to detail when clicking row", async ({ page }) => {
      await page.waitForSelector("tbody tr", { timeout: 10000 });

      const testRow = page
        .locator("tbody tr")
        .filter({ hasText: uniqueName })
        .first();
      await testRow.click();

      await page.waitForURL(/\/\[feature\]\/[a-f0-9-]+/, { timeout: 5000 });
      expect(page.url()).toMatch(/\/\[feature\]\/[a-f0-9-]+/);
    });

    test("should filter when searching", async ({ page }) => {
      const searchInput = page
        .locator('input[type="search"], input[placeholder*="Search"]')
        .first();

      await searchInput.fill(uniqueName);
      await page.waitForTimeout(800); // Debounce

      const rows = page.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
```

### Detail Page Test

```typescript
// tests/pages/[feature]-detail.spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Feature] Detail Page", () => {
  let testItemId: string;

  test.beforeEach(async ({ page }) => {
    const item = await createTestDataViaAPI("/api/[feature]", {
      name: "Detail Test Item",
      description: "For detail page testing",
    });
    testItemId = item.id;

    await page.goto(`/[feature]/${testItemId}`);
    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (testItemId) {
      await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
    }
  });

  test("should load item data", async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toHaveValue(
      "Detail Test Item",
    );
  });

  test("should have save button", async ({ page }) => {
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
  });

  test("should update item", async ({ page }) => {
    await page.fill('input[name="name"]', "Updated Name");
    await page.click('button:has-text("Save")');

    await expect(
      page.locator("text=Updated successfully, text=Saved"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should validate required fields", async ({ page }) => {
    await page.fill('input[name="name"]', "");
    await page.click('button:has-text("Save")');

    await expect(
      page.locator("text=/required|cannot be empty/i"),
    ).toBeVisible();
  });
});
```

## Component Test Patterns

### Modal Component Test

```typescript
// tests/components/[component]-modal.spec.ts
import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  createTestDataViaAPI,
  deleteTestDataViaAPI,
} from "../helpers/test-utils";

test.describe("[Component] Modal", () => {
  let testItemId: string;

  test.beforeEach(async ({ page }) => {
    const item = await createTestDataViaAPI("/api/[feature]", {
      name: "Modal Test Item",
    });
    testItemId = item.id;

    await page.goto(`/[feature]/${testItemId}`);
    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (testItemId) {
      await deleteTestDataViaAPI(`/api/[feature]/${testItemId}`);
    }
  });

  test.describe("Modal Opening and Closing", () => {
    test("should open modal when clicking add button", async ({ page }) => {
      await page.click('button:has-text("Add")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    test("should close modal when clicking cancel", async ({ page }) => {
      await page.click('button:has-text("Add")');

      await page.click('[role="dialog"] button:has-text("Cancel")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).not.toBeVisible();
    });

    test("should close modal when clicking X button", async ({ page }) => {
      await page.click('button:has-text("Add")');

      const closeButton = page
        .locator('[role="dialog"] button[aria-label="Close"]')
        .first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe("Modal Form", () => {
    test("should submit form and close modal", async ({ page }) => {
      await page.click('button:has-text("Add")');

      await page.fill('[role="dialog"] input[name="field"]', "Test Value");
      await page.click('[role="dialog"] button:has-text("Save")');

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      await page.click('button:has-text("Add")');
      await page.click('[role="dialog"] button:has-text("Save")');

      await expect(
        page.locator('[role="dialog"] text=/required/i'),
      ).toBeVisible();
    });
  });
});
```

## Role-Based Access Tests

### Admin vs Non-Admin Tests

```typescript
// tests/e2e/[feature]-access.spec.ts
import { test, expect } from "@playwright/test";

test.describe("[Feature] Access - Admin", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("should show feature link in navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const link = page.getByRole("link", { name: "[Feature]" });
    await expect(link).toBeVisible();
  });

  test("should allow access to feature page", async ({ page }) => {
    await page.goto("/[feature]");
    await expect(
      page.locator("h1, h2").filter({ hasText: "[Feature]" }),
    ).toBeVisible();
  });
});

test.describe("[Feature] Access - Non-Admin", () => {
  test.use({ storageState: "playwright/.auth/readonly.json" });

  test("should not show admin-only features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const adminLink = page.locator('a[href="/admin-feature"]');
    await expect(adminLink).not.toBeVisible();
  });

  test("should redirect from protected pages", async ({ page }) => {
    await page.goto("/admin-feature");
    await page.waitForLoadState("networkidle");

    // Should redirect or show 403
    expect(page.url()).not.toContain("/admin-feature");
  });
});
```

## Best Practices

### 1. Always Clean Up Test Data

```typescript
test.afterEach(async () => {
  for (const id of createdIds) {
    await deleteTestDataViaAPI(`/api/[feature]/${id}`);
  }
  createdIds = [];
});
```

### 2. Use Data-TestId for Stable Selectors

```tsx
// In component
<button data-testid="add-item-btn">Add Item</button>;

// In test
await page.click('[data-testid="add-item-btn"]');
```

### 3. Wait for Network Stability

```typescript
await page.waitForLoadState("networkidle");
await page.waitForSelector("table tbody", { timeout: 10000 });
```

### 4. Use Descriptive Test Names

```typescript
test("should display validation error when name is empty", async ({ page }) => {
  // ...
});
```

### 5. Group Related Tests

```typescript
test.describe('[Feature] API', () => {
  test.describe('GET /api/[feature]', () => {
    test('should return all items', ...);
    test('should support pagination', ...);
  });

  test.describe('POST /api/[feature]', () => {
    test('should create with valid data', ...);
    test('should validate required fields', ...);
  });
});
```

### 6. Handle Async Operations

```typescript
await page.waitForResponse(
  (response) =>
    response.url().includes("/api/[feature]") && response.status() === 200,
);
```

## Test Commands

```bash
# Run all tests
pnpm test

# Run tests in UI mode (recommended for development)
pnpm test:ui

# Run tests in debug mode
pnpm test:debug

# Run specific test file
pnpm test tests/api/[feature].spec.ts

# Run tests matching a pattern
pnpm test --grep "should create"

# Run tests in headed mode
pnpm test:headed

# Run with specific browser
pnpm test --project=chromium
```

## Row-Level Security (RLS) Test Patterns

Every collection/endpoint MUST include RLS tests to verify security at both application and database layers.

### RLS Test Structure

```
tests/api/
├── rls-users.spec.ts          # Users API security
├── rls-roles.spec.ts          # Roles API security
├── rls-policies.spec.ts       # Policies API security
├── rls-permissions.spec.ts    # Permissions API security
├── rls-fields.spec.ts         # Fields API security
├── rls-relations.spec.ts      # Relations API security
├── rls-items.spec.ts          # Items API security
└── rls-database.spec.ts       # Database-level enforcement
```

### RLS Test Pattern

```typescript
import { test, expect } from "@playwright/test";

test.describe("[Collection] RLS Security", () => {
  // 1. Authentication — verify 401 for unauthenticated
  test("should return 401 without authentication", async ({ request }) => {
    const response = await request.get("/api/[collection]", {
      headers: { Authorization: "" },
    });
    expect(response.status()).toBe(401);
  });

  // 2. Admin bypass — verify admins see everything
  test.describe("Admin Access", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin should access all resources", async ({ request }) => {
      const response = await request.get("/api/[collection]");
      expect(response.status()).toBe(200);
    });

    test("admin should perform all CRUD operations", async ({ request }) => {
      // POST, PATCH, DELETE all succeed
    });
  });

  // 3. Non-admin authorization — verify 403 for unauthorized ops
  test.describe("Non-Admin Access", () => {
    test.use({ storageState: "playwright/.auth/user.json" });

    test("should return 403 for admin-only operations", async ({ request }) => {
      const response = await request.delete("/api/[collection]/some-id");
      expect(response.status()).toBe(403);
    });

    test("should allow read when permission exists", async ({ request }) => {
      const response = await request.get("/api/[collection]");
      expect(response.status()).toBe(200);
    });
  });

  // 4. Self-access pattern
  test.describe("Self-Access", () => {
    test("user should only see own records with self-access filter", async ({ request }) => {
      // Use auth state with filter: { "email": { "_eq": "$CURRENT_USER" } }
      const response = await request.get("/api/users");
      const data = await response.json();
      expect(data.data.length).toBe(1); // Only own record
    });
  });

  // 5. Data isolation
  test("should not expose cross-user data", async ({ request }) => {
    // Verify user A cannot access user B's private records
  });

  // 6. SQL injection protection
  test("should reject SQL injection attempts", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?filter=" +
        encodeURIComponent('{"name":{"_eq":"\\'; DROP TABLE users;--"}}'),
    );
    expect(response.status()).not.toBe(500);
  });

  // 7. Performance
  test("should respond within 2 seconds", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/[collection]");
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
```

### Security Layers to Test

| Layer          | What to Verify                      | Expected Error      |
| -------------- | ----------------------------------- | ------------------- |
| Authentication | No token / invalid token            | 401                 |
| Authorization  | Missing permission for action       | 403                 |
| Admin Bypass   | Admin can access all resources      | 200                 |
| Self-Access    | User sees only own records          | 200 (filtered)      |
| Database RLS   | PostgreSQL policies enforced        | Filtered results    |
| Audit Logging  | Operations logged to activity table | Log entry exists    |
| Data Isolation | Cross-user access prevented         | 404 or filtered out |

## Item-Level Filtering Test Patterns

Test that permission filters correctly restrict data access.

### Test Structure

```
tests/api/item-level-filtering/
├── filter-operators.spec.ts     # Basic filter operators (_eq, _neq, _in, etc.)
├── dynamic-values.spec.ts       # Dynamic values ($CURRENT_USER, $CURRENT_ROLE)
├── filter-logic.spec.ts         # Complex OR/AND logic, nested conditions
└── admin-bypass.spec.ts         # Admin bypass verification
```

### Filter Test Pattern

```typescript
test.describe("Item-Level Filtering", () => {
  // Status filtering: { "status": { "_eq": "active" } }
  test("user with status filter sees only active items", async ({
    request,
  }) => {
    // Use auth state for user with status filter permission
    const response = await request.get("/api/users");
    const data = await response.json();
    data.data.forEach((user: any) => expect(user.status).toBe("active"));
  });

  // Self-access: { "email": { "_eq": "$CURRENT_USER" } }
  test("user with self-access sees only own record", async ({ request }) => {
    // Use auth state for user with self-access permission
    const response = await request.get("/api/users");
    const data = await response.json();
    expect(data.data.length).toBe(1);
    expect(data.data[0].email).toBe("self-access@example.com");
  });

  // Multiple permissions (OR logic)
  test("multiple permissions combine with OR", async ({ request }) => {
    // Permission 1: { "status": { "_eq": "active" } }
    // Permission 2: { "status": { "_eq": "invited" } }
    // → User sees active OR invited
    const response = await request.get("/api/users");
    const data = await response.json();
    data.data.forEach((user: any) => {
      expect(["active", "invited"]).toContain(user.status);
    });
  });

  // Filters work with other parameters
  test("filter + search works correctly", async ({ request }) => {
    const response = await request.get("/api/users?search=keyword");
    expect(response.status()).toBe(200);
  });

  test("filter + pagination works correctly", async ({ request }) => {
    const response = await request.get("/api/users?limit=5&offset=0");
    expect(response.status()).toBe(200);
  });
});
```

### Setup Script Pattern

Create test users with specific filter permissions via a setup script:

```javascript
// scripts/setup-filter-tests.mjs
// Creates:
// - Test roles with specific filter patterns
// - Test users assigned to those roles
// - Test policies with filter JSON (status, self-access, role-based)
// - Test permissions linking policies to collections
```

## Field-Level Permissions Test Patterns

Test that field access control correctly filters response data and validates writes.

### Test Structure

```
tests/api/field-permissions/
├── field-filtering-read.spec.ts    # Field filtering on GET
└── field-validation-write.spec.ts  # Field validation on POST/PATCH
```

### Field Permission Test Pattern

```typescript
import { test, expect } from "@playwright/test";
import { authHeaders, authTokens } from "../helpers/auth-tokens";

test.describe("Field-Level Permissions", () => {
  test.describe("Read Operations", () => {
    test("admin sees all fields including sensitive ones", async ({
      request,
    }) => {
      const response = await request.get("/api/users/some-id", {
        headers: authHeaders(authTokens.admin),
      });
      const data = await response.json();
      expect(Object.keys(data.data)).toContain("token");
    });

    test("limited user sees only allowed fields", async ({ request }) => {
      // User with fields: ['id', 'email', 'first_name', 'last_name', 'status']
      const response = await request.get("/api/users", {
        headers: authHeaders(authTokens.limitedUser),
      });
      const data = await response.json();
      const keys = Object.keys(data.data[0]);
      expect(keys).toContain("id");
      expect(keys).toContain("email");
      expect(keys).not.toContain("token");
    });

    test("wildcard user sees all fields", async ({ request }) => {
      // User with fields: ['*']
      const response = await request.get("/api/users");
      const data = await response.json();
      expect(Object.keys(data.data[0]).length).toBeGreaterThan(5);
    });

    test("multiple policies merge fields with OR logic", async ({
      request,
    }) => {
      // Policy 1 fields: ['id', 'email']
      // Policy 2 fields: ['id', 'first_name', 'status']
      // Merged: ['id', 'email', 'first_name', 'status']
    });
  });

  test.describe("Write Operations", () => {
    test("admin can update any field", async ({ request }) => {
      const response = await request.patch("/api/users/some-id", {
        data: { status: "suspended" },
        headers: authHeaders(authTokens.admin),
      });
      expect(response.status()).toBe(200);
    });

    test("limited user blocked from forbidden fields", async ({ request }) => {
      const response = await request.patch("/api/users/some-id", {
        data: { status: "active" },
        headers: authHeaders(authTokens.limitedUser),
      });
      expect(response.status()).toBe(403);
      const error = await response.json();
      // Error should list forbidden fields
      expect(JSON.stringify(error)).toContain("status");
    });

    test("empty fields user cannot create or update", async ({ request }) => {
      // User with fields: [] or null
      const response = await request.post("/api/users", {
        data: { email: "new@example.com" },
        headers: authHeaders(authTokens.noFieldsUser),
      });
      expect(response.status()).toBe(403);
    });
  });
});
```

### Setup Script Pattern

```typescript
// scripts/setup-field-permission-tests.ts
// Creates:
// - 5 test users with different field permission patterns
// - 5 test roles and policies
// - Permissions with field restrictions: limited, wildcard, empty, null, multi-policy
// Saves auth tokens to .env.test.local
```

## Permissions-Aware UI Test Patterns

Test that the frontend correctly shows/hides features based on the current user's permissions from `/api/permissions/me`.

### What to Test

| UI Element        | Admin       | Read-Only                 | No Permission           |
| ----------------- | ----------- | ------------------------- | ----------------------- |
| Navigation links  | All visible | Only readable collections | Hidden                  |
| Add/Create button | Visible     | Hidden                    | Hidden                  |
| Edit button       | Enabled     | Disabled                  | Hidden                  |
| Delete button     | Visible     | Hidden                    | Hidden                  |
| Table/List        | Renders     | Renders                   | "No access" or redirect |
| Menu button       | Visible     | Conditional               | Hidden                  |

### Patterns

```typescript
test.describe("[Collection] Permissions UI", () => {
  // Permissions API endpoint tests
  test.describe("Permissions API", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin gets full access", async ({ request }) => {
      const response = await request.get("/api/permissions/me");
      const data = await response.json();
      // Admin should have create, read, update, delete for all collections
      expect(data["daas_users"]).toMatchObject({
        create: true,
        read: true,
        update: true,
        delete: true,
      });
    });
  });

  // Navigation tests
  test.describe("Navigation - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows all navigation links", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Roles" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Policies" })).toBeVisible();
    });
  });

  test.describe("Navigation - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("shows links only for readable collections", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      // Read-only user should see links for collections they can read
    });
  });

  // Action button tests
  test.describe("Action Buttons - Admin", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("shows Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeVisible();
    });
  });

  test.describe("Action Buttons - Read-Only", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("hides Add button", async ({ page }) => {
      await page.goto("/[collection]");
      await expect(page.getByRole("button", { name: /add/i })).toBeHidden();
    });

    test("disables edit actions", async ({ page }) => {
      await page.goto("/[collection]");
      // Edit buttons disabled or hidden for read-only user
    });
  });
});
```

### Frontend Permission Pattern Reference

The frontend uses `useCollectionPermissions` hook:

```typescript
const { permissions } = useCollectionPermissions('daas_users');
// permissions = { create: boolean, read: boolean, update: boolean, delete: boolean }

{permissions.create && <button>Add User</button>}
{permissions.update && <button>Edit</button>}
{permissions.delete && <button>Delete</button>}
```

## DaaS Query Parameters Test Patterns

Test DaaS-compatible query parameters (Directus-style) for collection endpoints.

### Fields Parameter

```typescript
test.describe("Fields Parameter", () => {
  test("returns specific fields only", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?fields=id,email,first_name",
    );
    const data = await response.json();
    const keys = Object.keys(data.data[0]);
    expect(keys).toContain("id");
    expect(keys).toContain("email");
    expect(keys).not.toContain("password");
  });

  test("returns all fields with wildcard", async ({ request }) => {
    const response = await request.get("/api/[collection]?fields=*");
    const data = await response.json();
    expect(Object.keys(data.data[0]).length).toBeGreaterThan(3);
  });

  test("returns nested relation fields", async ({ request }) => {
    const response = await request.get(
      "/api/[collection]?fields=id,email,role.name,role.icon",
    );
    const data = await response.json();
    if (data.data[0].role) {
      expect(data.data[0].role).toHaveProperty("name");
    }
  });
});
```

### Filter Parameter

```typescript
test.describe("Filter Parameter", () => {
  test("filters with _eq operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _eq: "active" } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).toBe("active"));
  });

  test("filters with _neq operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _neq: "archived" } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).not.toBe("archived"));
  });

  test("filters with _in operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _in: ["active", "invited"] } });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => {
      expect(["active", "invited"]).toContain(item.status);
    });
  });

  test("filters with complex AND conditions", async ({ request }) => {
    const filter = JSON.stringify({
      _and: [{ status: { _eq: "active" } }, { first_name: { _neq: null } }],
    });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    expect(response.status()).toBe(200);
  });

  test("filters with complex OR conditions", async ({ request }) => {
    const filter = JSON.stringify({
      _or: [{ status: { _eq: "active" } }, { status: { _eq: "invited" } }],
    });
    const response = await request.get(`/api/[collection]?filter=${filter}`);
    expect(response.status()).toBe(200);
  });
});
```

### Sort, Pagination, Meta, Search Parameters

```typescript
test.describe("Sort Parameter", () => {
  test("sorts ascending by default", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=email");
    expect(response.status()).toBe(200);
  });

  test("sorts descending with - prefix", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=-date_created");
    expect(response.status()).toBe(200);
  });

  test("sorts by multiple fields", async ({ request }) => {
    const response = await request.get("/api/[collection]?sort=status,-email");
    expect(response.status()).toBe(200);
  });
});

test.describe("Pagination Parameters", () => {
  test("limits results", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=5");
    const data = await response.json();
    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  test("offsets results", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=5&offset=5");
    expect(response.status()).toBe(200);
  });

  test("paginates with page parameter", async ({ request }) => {
    const response = await request.get("/api/[collection]?limit=10&page=1");
    expect(response.status()).toBe(200);
  });
});

test.describe("Meta Parameter", () => {
  test("returns total_count", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=total_count");
    const data = await response.json();
    expect(data.meta.total_count).toBeDefined();
    expect(typeof data.meta.total_count).toBe("number");
  });

  test("returns filter_count", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=filter_count");
    const data = await response.json();
    expect(data.meta.filter_count).toBeDefined();
  });

  test("returns all meta with *", async ({ request }) => {
    const response = await request.get("/api/[collection]?meta=*");
    const data = await response.json();
    expect(data.meta).toBeDefined();
  });
});

test.describe("Search Parameter", () => {
  test("searches across text fields", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=keyword");
    expect(response.status()).toBe(200);
  });

  test("search is case-insensitive", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=KEYWORD");
    expect(response.status()).toBe(200);
  });

  test("partial match search", async ({ request }) => {
    const response = await request.get("/api/[collection]?search=key");
    expect(response.status()).toBe(200);
  });
});
```

## Form Change Detection Test Patterns

Test the edit-mode form change detection pattern (only submitting changed fields):

```typescript
test.describe("Form Change Detection", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("save button disabled when no changes", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("save button enabled after field change", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("dirty indicator shows modified field count", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    // Check for "1 field modified" or similar indicator
    await expect(page.getByText(/field.* modified/i)).toBeVisible();
  });

  test("reverting field removes it from edits", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");
    const input = page.getByRole("textbox", { name: "first_name" });
    const originalValue = await input.inputValue();
    await input.fill("Temporary");
    await input.fill(originalValue); // Revert
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("only changed fields sent in PATCH request", async ({ page }) => {
    await page.goto("/[collection]/item-id");
    await page.waitForLoadState("networkidle");

    // Intercept the PATCH request
    const patchPromise = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" && req.url().includes("/api/[collection]"),
    );
    await page.getByRole("textbox", { name: "first_name" }).fill("Updated");
    await page.getByRole("button", { name: "Save" }).click();

    const patchRequest = await patchPromise;
    const body = patchRequest.postDataJSON();
    // Only the changed field should be in the payload
    expect(Object.keys(body)).toContain("first_name");
    expect(Object.keys(body)).not.toContain("email");
  });
});
```

## Mantine / Buildpad UI Selector Strategies

### Login Page Selectors

```typescript
// ✅ RECOMMENDED: Role-based selectors (most reliable for Mantine)
await page.getByRole("textbox", { name: "Email" }).fill("admin@example.com");
await page.getByRole("textbox", { name: "Password" }).fill("password");
await page.getByRole("button", { name: "Sign In" }).click();

// ✅ For PasswordInput (Mantine), use role with exact match
await page
  .getByRole("textbox", { name: "Password", exact: true })
  .fill("password");
await page.getByRole("textbox", { name: "Confirm Password" }).fill("password");

// ❌ AVOID: Placeholder-based selectors (can change with UI updates)
await page.fill('input[placeholder="admin@example.com"]', "admin@example.com");

// ❌ AVOID: getByLabel for PasswordInput (may match multiple fields)
await page.getByLabel("Password").fill("password"); // May match both Password and Confirm Password!
```

### General Mantine Component Selectors

```typescript
// Buttons
await page.getByRole("button", { name: "Save Changes" }).click();
await page.getByRole("button", { name: /submit/i }).click(); // Regex for flexibility

// Text Inputs with labels
await page.getByRole("textbox", { name: "first_name" }).fill("John");
await page.getByRole("textbox", { name: "email" }).fill("john@example.com");

// Switches/Checkboxes
await page.getByRole("switch", { name: "notifications" }).check();

// Text elements
await expect(page.getByText("User created successfully")).toBeVisible();

// Required field indicator
await expect(page.getByText("Password *", { exact: true })).toBeVisible();

// Data test IDs (most reliable for complex components)
await page.getByTestId("submit-button").click();

// Mantine notifications
await expect(
  page.locator(".mantine-Notification-root").filter({ hasText: "Saved" }),
).toBeVisible();
```

### API Helpers with Page Request

When using API helper functions in tests, pass `page.request` for authenticated requests:

```typescript
test.beforeEach(async ({ page }) => {
  testRole = await createTestRoleViaAPI(page.request, "Test Role");
  testUser = await createTestUserViaAPI(page.request, "test@example.com");
});

test.afterEach(async ({ page }) => {
  await deleteUserViaAPI(page.request, testUser.id);
  await deleteRoleViaAPI(page.request, testRole.id);
});
```

## Load Testing with k6

For performance testing, use k6 to validate API can handle expected traffic.

### Setup

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt-get install k6 / choco install k6 / npm install -g k6

# Setup test environment (creates users, generates tokens)
pnpm load:setup

# Run tests
pnpm load:smoke    # Quick test (1 min, 1 VU)
pnpm load:test     # Standard load test (16 min, 10-20 VUs)
pnpm load:stress   # Stress test (23 min, 20-60 VUs)
pnpm load:spike    # Spike test (5 min, 5-100 VUs)
```

### Test Scenarios

| Scenario | Duration | Users    | p95 Threshold | Error Threshold |
| -------- | -------- | -------- | ------------- | --------------- |
| Smoke    | 1 min    | 1 VU     | < 500ms       | < 10%           |
| Load     | 16 min   | 10→20    | < 800ms       | < 5%            |
| Stress   | 23 min   | 20→40→60 | < 1500ms      | < 10%           |
| Spike    | 5 min    | 5→100→5  | < 2000ms      | < 20%           |

### Request Distribution

- **50%** GET list items (with pagination, filters, field selection)
- **25%** GET single item (random item from lists)
- **15%** POST create item (unique data generation)
- **10%** PATCH update item (partial updates)

### Key Metrics

| Metric                    | What It Measures              | Good        | Warning        | Critical         |
| ------------------------- | ----------------------------- | ----------- | -------------- | ---------------- |
| `checks`                  | Assertion pass rate           | 100%        | > 95%          | < 95%            |
| `http_req_duration p(95)` | 95th percentile response time | < threshold | 1.5x threshold | > 2x threshold   |
| `errors`                  | Error rate                    | 0%          | < 5%           | > 10%            |
| `http_reqs`               | Throughput (req/sec)          | High        | Declining      | Flat or dropping |

**Note:** Auth tokens expire after 1 hour. Re-run `pnpm load:setup` if tests fail with 401.

## Debugging Strategies

### Playwright Inspector

```bash
pnpm test:debug                          # Open Inspector for all tests
pnpm test tests/api/file.spec.ts --debug # Debug specific test
```

### Screenshots and Videos

```typescript
// playwright.config.ts
use: {
  screenshot: "only-on-failure",  // Auto screenshot on failure
  video: "retain-on-failure",     // Record video, keep on failure
  trace: "on-first-retry",        // Trace on retry
}

// Manual screenshot in test
await page.screenshot({ path: "screenshot.png" });
```

### Console and Network Logging

```typescript
// Listen to browser console
page.on("console", (msg) => console.log("Browser:", msg.text()));

// Watch network requests
page.on("request", (req) => console.log("→", req.method(), req.url()));
page.on("response", (res) => console.log("←", res.status(), res.url()));
```

### Interactive UI Mode

```bash
pnpm test:ui  # Visual test runner with time-travel debugging
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 24
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Test Reports

```bash
# Generate and open HTML report
pnpm exec playwright show-report

# Generate JSON report
pnpm test --reporter=json --output=test-results.json
```

## Required Coverage

For each feature implementation, ensure:

| Test Type             | Minimum Coverage                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| API Tests             | All CRUD operations, validation, error cases, query parameters (fields, filter, search, sort, pagination, meta) |
| Security/RLS Tests    | 401 unauthenticated, 403 unauthorized, admin bypass, self-access, data isolation                                |
| Field Permissions     | Admin full access, limited read, blocked writes (403), wildcard, merging                                        |
| Permissions UI        | Navigation links, action buttons (create/edit/delete), conditional rendering                                    |
| Page Tests            | List, detail, create, navigation, search/filter                                                                 |
| Component Tests       | Interactive components with forms/modals, form change detection                                                 |
| E2E Tests             | Critical user flows, workflow transitions                                                                       |
| Load Tests (optional) | Smoke test passes, p95 meets thresholds                                                                         |
