---
name: create-tests
description: Generate comprehensive Playwright E2E and Vitest unit tests for DaaS features, API routes, pages, components, security (RLS), permissions, and load tests. Creates test files with proper setup, cleanup, and coverage. Use when the user needs tests, testing, E2E tests, API tests, security tests, load tests, or wants to test a feature.
argument-hint: "[target file or feature] [type: api|page|component|e2e|unit|security|load|permissions]"
---

# Create Tests

Generate comprehensive tests using Playwright (E2E/API/Page/Security) and Vitest (unit). Optionally generate k6 load tests.

> **Delegate large test work.** For coverage-gap analysis or authoring a big suite in parallel with feature work, hand it to the `test-engineer` subagent (see `subagent-delegation`), then run and verify the tests on the main thread.

## Two-Tier Testing Strategy

| Tier                  | Purpose                                | Auth Required | Command                                       |
| --------------------- | -------------------------------------- | ------------- | --------------------------------------------- |
| **Tier 1: Storybook** | Isolated component testing             | No            | `pnpm storybook:form` / `pnpm test:storybook` |
| **Tier 2: DaaS E2E**  | Full integration testing with real API | Yes           | `pnpm test` / `pnpm test:e2e`                 |

## Test File Location

```
tests/
├── auth.setup.ts                    # Global auth setup (auto-provisions test users)
├── setup-test-users.ts              # Legacy test user setup helper (optional)
├── helpers/
│   ├── test-utils.ts               # Shared test utilities
│   ├── test-fixtures.ts            # Database fixtures
│   └── auth-tokens.ts              # Auth token helpers (Bearer tokens for API)
├── api/                            # API endpoint tests → [endpoint].spec.ts
│   ├── rls-*.spec.ts               # Row-Level Security tests
│   ├── field-permissions/          # Field-level permission tests
│   ├── item-level-filtering/       # Item filtering tests
│   └── data-model/                 # Schema/field/relation tests
├── pages/                          # Page tests → [page].spec.ts (permissions-aware UI)
├── ui/                             # UI E2E tests → [feature].spec.ts
├── components/                     # Component tests → [component].spec.ts
├── e2e/                            # User flow tests → [flow].spec.ts
├── security/                       # Security-specific tests
└── load/                           # k6 Load testing
    ├── items-load-test.js          # Main k6 test script
    └── README.md                   # Load testing guide
```

## Process

1. **Analyze the target** — read the code, identify HTTP methods, UI elements, user flows, permissions
2. **Determine test types needed** — API, Page, Component, Security/RLS, Permissions, E2E, Load
3. **Create test file(s)** in the correct directory
4. **Write tests** with proper setup/cleanup following the patterns below
5. **Run tests** — `pnpm test tests/[type]/[name].spec.ts`
6. **Ensure all pass** before reporting completion

## Authentication Setup

Tests use Playwright's storage state for reusable auth across different user types. The `auth.setup.ts` file auto-provisions test users via Supabase admin API.

**Auto-provisioned users (created by auth.setup.ts):**

| Auth File                        | User                      | Permissions                                              |
| -------------------------------- | ------------------------- | -------------------------------------------------------- |
| `admin.json`                     | `admin@example.com`       | Full access (policy grants admin_access)                 |
| `user.json`                      | `e2e-basic-user@test.com` | Non-admin, no special permissions                        |
| `readonly.json`                  | `e2e-readonly@test.com`   | Read permission on core collections                      |
| `user-with-read-permission.json` | `e2e-read-perm@test.com`  | Read permission on daas_users, daas_roles, daas_policies |

**Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

**Run auth setup:**

```bash
pnpm exec playwright test --project=setup
```

**For custom permission test users** (item-level filtering, field permissions), create dedicated setup scripts:

```bash
node scripts/setup-filter-tests.mjs      # Item-level filtering users
pnpm tsx scripts/setup-field-permission-tests.ts  # Field permission users
```

## API Test Pattern

```typescript
import { test, expect } from "@playwright/test";

test.describe("[Feature] API", () => {
  let createdIds: string[] = [];

  test.afterEach(async () => {
    for (const id of createdIds) {
      await deleteTestDataViaAPI(`/api/[endpoint]/${id}`);
    }
    createdIds = [];
  });

  test("GET returns all items", async ({ request }) => {
    const response = await request.get("http://localhost:3000/api/[endpoint]");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test("POST creates with valid data", async ({ request }) => {
    const response = await request.post(
      "http://localhost:3000/api/[endpoint]",
      { data: { name: "Test" } },
    );
    expect(response.status()).toBe(201);
    const data = await response.json();
    createdIds.push(data.data.id);
  });

  test("POST validates required fields", async ({ request }) => {
    const response = await request.post(
      "http://localhost:3000/api/[endpoint]",
      { data: {} },
    );
    expect(response.status()).toBe(400);
  });
});
```

## DaaS Query Parameters Test Pattern

Test DaaS-compatible query parameters for every collection endpoint:

```typescript
test.describe("Query Parameters", () => {
  // Fields parameter
  test("should return specific fields only", async ({ request }) => {
    const response = await request.get("/api/[endpoint]?fields=id,name,status");
    const data = await response.json();
    const keys = Object.keys(data.data[0]);
    expect(keys).toContain("id");
    expect(keys).not.toContain("password");
  });

  // Filter parameter
  test("should filter with _eq operator", async ({ request }) => {
    const filter = JSON.stringify({ status: { _eq: "active" } });
    const response = await request.get(`/api/[endpoint]?filter=${filter}`);
    const data = await response.json();
    data.data.forEach((item: any) => expect(item.status).toBe("active"));
  });

  // Search parameter
  test("should search across text fields", async ({ request }) => {
    const response = await request.get("/api/[endpoint]?search=keyword");
    expect(response.status()).toBe(200);
  });

  // Sort parameter
  test("should sort descending with - prefix", async ({ request }) => {
    const response = await request.get("/api/[endpoint]?sort=-date_created");
    expect(response.status()).toBe(200);
  });

  // Pagination parameters
  test("should paginate with limit and offset", async ({ request }) => {
    const response = await request.get("/api/[endpoint]?limit=10&offset=0");
    const data = await response.json();
    expect(data.data.length).toBeLessThanOrEqual(10);
  });

  // Meta parameter
  test("should return total_count in meta", async ({ request }) => {
    const response = await request.get("/api/[endpoint]?meta=total_count");
    const data = await response.json();
    expect(data.meta.total_count).toBeDefined();
  });
});
```

## Security / RLS Test Pattern

Every collection/endpoint must include Row-Level Security tests:

```typescript
import { test, expect } from "@playwright/test";

test.describe("[Feature] RLS Security", () => {
  // Test authentication (401)
  test("should return 401 without authentication", async ({ request }) => {
    const response = await request.get("/api/[endpoint]", {
      headers: { Authorization: "" },
    });
    expect(response.status()).toBe(401);
  });

  // Test authorization (403)
  test.describe("Non-Admin Access", () => {
    test.use({ storageState: "playwright/.auth/user.json" });

    test("should return 403 for admin-only operations", async ({ request }) => {
      const response = await request.delete("/api/[endpoint]/some-id");
      expect(response.status()).toBe(403);
    });
  });

  // Test admin bypass
  test.describe("Admin Access", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("admin should access all resources", async ({ request }) => {
      const response = await request.get("/api/[endpoint]");
      expect(response.status()).toBe(200);
    });
  });

  // Test self-access pattern
  test("user should only see own records when filtered", async ({
    request,
  }) => {
    // Use auth state for a user with self-access filter
    // Verify only their records are returned
  });

  // Test data isolation
  test("should not expose cross-user data", async ({ request }) => {
    // Verify user A cannot access user B's records
  });
});
```

## Permissions-Aware UI Test Pattern

Test that the frontend correctly shows/hides features based on user permissions:

```typescript
test.describe("[Feature] Permissions UI", () => {
  test.describe("Admin User", () => {
    test.use({ storageState: "playwright/.auth/admin.json" });

    test("should show all action buttons", async ({ page }) => {
      await page.goto("/[feature]");
      await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
      // Edit and Delete buttons visible in table rows
    });
  });

  test.describe("Read-Only User", () => {
    test.use({ storageState: "playwright/.auth/readonly.json" });

    test("should hide create button", async ({ page }) => {
      await page.goto("/[feature]");
      await expect(page.getByRole("button", { name: "Add" })).toBeHidden();
    });

    test("should disable edit actions", async ({ page }) => {
      await page.goto("/[feature]");
      // Edit buttons disabled or hidden
    });
  });

  test.describe("No-Permission User", () => {
    test.use({ storageState: "playwright/.auth/noperm.json" });

    test("should redirect or show no access", async ({ page }) => {
      await page.goto("/[feature]");
      // Should redirect or show "No access" message
    });
  });
});
```

## Field-Level Permissions Test Pattern

Test that field access control correctly filters responses and validates writes:

```typescript
test.describe("Field-Level Permissions", () => {
  test("admin should see all fields", async ({ request }) => {
    const response = await request.get("/api/[endpoint]/item-id");
    const data = await response.json();
    expect(Object.keys(data.data)).toContain("sensitive_field");
  });

  test("limited user should see only allowed fields", async ({ request }) => {
    // Use limited-user auth
    const response = await request.get("/api/[endpoint]/item-id");
    const data = await response.json();
    expect(Object.keys(data.data)).not.toContain("sensitive_field");
  });

  test("should block writes to forbidden fields", async ({ request }) => {
    // Use limited-user auth
    const response = await request.patch("/api/[endpoint]/item-id", {
      data: { forbidden_field: "value" },
    });
    expect(response.status()).toBe(403);
  });
});
```

## Page Test Pattern

```typescript
test.describe("[Page] List", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("displays page title", async ({ page }) => {
    await page.goto("/[path]");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("displays data table", async ({ page }) => {
    await page.goto("/[path]");
    await expect(page.locator("table")).toBeVisible();
  });

  test("navigates to detail on row click", async ({ page }) => {
    await page.goto("/[path]");
    await page.waitForSelector("tbody tr", { timeout: 10000 });
    await page.locator("tbody tr").first().click();
    await page.waitForURL(/\/\[path\]\/[a-f0-9-]+/, { timeout: 5000 });
  });

  test("filters when searching", async ({ page }) => {
    await page.goto("/[path]");
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="Search"]')
      .first();
    await searchInput.fill("search term");
    await page.waitForTimeout(800); // Debounce
    expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(1);
  });
});
```

## Mantine / Buildpad UI Selector Strategies

Use these selector patterns for Mantine v8 / Buildpad components:

```typescript
// ✅ RECOMMENDED: Role-based selectors (most reliable)
await page.getByRole("textbox", { name: "Email" }).fill("test@example.com");
await page.getByRole("button", { name: "Sign In" }).click();

// ✅ For PasswordInput (Mantine), use role with exact match
await page
  .getByRole("textbox", { name: "Password", exact: true })
  .fill("password");

// ✅ Data test IDs (most reliable for complex components)
await page.getByTestId("submit-button").click();

// ✅ Text content
await expect(page.getByText("User created successfully")).toBeVisible();

// ❌ AVOID: Placeholder-based selectors (fragile)
await page.fill('input[placeholder="Your password"]', "password");

// ❌ AVOID: getByLabel for PasswordInput (may match multiple)
await page.getByLabel("Password").fill("password");
```

## Load Testing (k6)

For performance testing, generate k6 test scripts:

```bash
# Install k6
brew install k6  # macOS

# Setup test environment
pnpm load:setup  # Creates users, generates tokens

# Run tests
pnpm load:smoke    # Quick test (1 min, 1 VU)
pnpm load:test     # Standard load test (16 min, 10-20 VUs)
pnpm load:stress   # Stress test (23 min, 20-60 VUs)
pnpm load:spike    # Spike test (5 min, 5-100 VUs)
```

**Key metrics to validate:**

- `http_req_duration p(95)` < threshold (500ms smoke, 800ms load)
- `errors` rate < threshold (10% smoke, 5% load)
- `checks` pass rate > 95%
- Custom metrics: `get_items_duration`, `create_item_duration`, etc.

**Request distribution:** 50% GET list, 25% GET single, 15% POST create, 10% PATCH update.

## Coverage Checklist

**API Routes:** GET all (200), GET single (200/404), POST valid (201), POST invalid (400), PATCH (200/404), DELETE (200/404), query params (fields, filter, search, sort, pagination, meta)

**Security/RLS:** 401 unauthenticated, 403 unauthorized, admin bypass, self-access, data isolation, SQL injection protection

**Field Permissions:** Admin full access, limited field read, forbidden field write (403), wildcard permissions, field merging (OR logic)

**Permissions UI:** Admin sees all actions, read-only hides create/delete, no-permission redirects, navigation links conditional, action buttons gated

**Pages:** Load correctly, title visible, data displays, navigation works, empty state, search/filter

**Components:** Renders, modal open/close, form validation, form submission, loading/error states, form change detection (dirty indicator, modified badge, revert)

**E2E Flows:** Complete CRUD journey, auth flow, admin vs non-admin access, workflow transitions

**Load (optional):** Smoke test passes, standard load meets p95 thresholds, error rate acceptable

## Debugging Tests

```bash
pnpm test:debug                          # Playwright Inspector
pnpm test tests/[file].spec.ts --debug   # Debug specific test
pnpm test:ui                             # Interactive UI mode
pnpm test:headed                         # See browser
```

**Screenshots:** Auto-captured on failure (`screenshot: 'only-on-failure'` in config).  
**Videos:** `video: 'retain-on-failure'` saves to `test-results/`.  
**Console/Network logs:**

```typescript
page.on("console", (msg) => console.log("Browser:", msg.text()));
page.on("request", (req) => console.log("Request:", req.url()));
```

## Test Commands

```bash
pnpm test                              # All Playwright tests
pnpm test tests/[type]/[name].spec.ts  # Specific test
pnpm test -g "pattern"                 # Tests matching pattern
pnpm test tests/api/rls-*.spec.ts      # All RLS tests
pnpm test:ui                           # UI mode
pnpm test:unit                         # Vitest unit tests
pnpm test:headed                       # Headed browser
pnpm test --project=chromium           # Specific browser
pnpm load:smoke                        # k6 smoke test
pnpm load:test                         # k6 standard load test
```

## CI/CD Integration

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

## References

- [Playwright testing guide](references/playwright-testing.instructions.md)
