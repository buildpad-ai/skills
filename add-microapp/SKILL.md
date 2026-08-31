---
name: add-microapp
description: Split an app into a Main App plus domain-focused micro-apps that share one DaaS backend. Covers domain boundaries, collection ownership, shared RBAC, cross-domain contracts, and repo bootstrap. Load this skill FIRST to decide the split, then load add-microfrontend to wire the iframe composition and the auth bridge. Use when the user says add-microapp, microapp, service boundary, or needs to split a large app into domain-focused micro-apps.
argument-hint: "[service name] [domain, e.g. users, billing, analytics]"
---

# Add Microapp

Set up a **microapp architecture** where one **Main App** and multiple **micro-apps** all share a **single DaaS backend**. Each micro-app is a standalone Next.js application that owns a domain of collections within the shared DaaS. Micro-apps are composed at the client level via the iframe micro-frontend pattern.

## Critical Rules

1. **Single Shared DaaS Backend**: All apps (Main App + micro-apps) connect to the **same** DaaS backend instance via the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`. There is only ONE DaaS backend. Collections for all domains live in this single instance.
2. **Shared Auth, Shared Data Layer**: All apps share the same Supabase Auth project AND the same DaaS backend. Authentication and data access go through the same infrastructure.
3. **Direct Calls for Components, Proxy Routes for Your Own Code**: Buildpad UI components (`CollectionList`, `VForm`) call DaaS **directly** from the browser through `DaaSProvider`, which supplies the `Authorization: Bearer <supabase-jwt>` and `X-Resource-Uri` headers. Hand-written fetches go through a Next.js proxy route in the same app. Do not generate `/api/items/[collection]/route.ts` unless the app has hand-written data calls. CORS for the direct path is handled on the DaaS side via `CORS_ORIGINS`. See [authentication-proxy](../authentication-proxy/SKILL.md).
4. **Collection-Based Domain Boundaries**: Each micro-app "owns" a logical domain of collections (e.g., Users service owns `profiles`, `roles`; Billing service owns `invoices`, `payments`). Ownership is a team/code convention — all collections physically live in the same DaaS instance.
5. **Independent Deployment**: Each micro-app deploys independently as a Next.js application. Schema changes in DaaS are shared — coordinate collection/field changes via the DaaS admin or MCP tools.
6. **Main App Is a Full App**: The Main App handles authentication, navigation, iframe composition, AND can have its own pages and collection data. It is not a thin shell.
7. **Shared Types via Contracts**: Cross-domain data access uses well-defined TypeScript interfaces. Publish shared types via a `packages/shared-types/` package or shared contract files.
8. **Backend-First Logic**: Use DaaS runtime extensions (filter/action hooks) for validation, audit logging, and business rules — not Next.js API routes. Extensions are configured once in the shared DaaS and apply regardless of which app triggers the request.
9. **Independent Testing**: Each micro-app has its own test suite (Playwright E2E + Vitest unit). Cross-service integration tests live in the Main App project.
10. **Shared RBAC**: Roles and permissions are managed centrally in the single DaaS backend. Each role defines access to specific collections. A user's roles (assigned via the `daas_user_roles` junction table) determine what they can do across ALL apps.
11. **Iframe Constraints Apply to Every Micro-App**: A framed micro-app cannot use native dialogs, cannot paint a modal outside its frame, and cannot rely on the host cookie. Design domains with that in mind. The rules and their fixes live in [add-microfrontend](../add-microfrontend/SKILL.md).
12. **No Function Props from Server Components (React 19)**: In Next.js 16 / React 19, you cannot pass functions as props from Server Components to Client Components. Avoid patterns like `<Anchor component={Link}>` in Server Components — use plain `<Link>` from `next/link` instead. The `component={...}` pattern is safe inside a `'use client'` component.
13. **Verify Field Names Against DaaS Schema**: Before writing any query, sort, or filter parameter, **always check the actual field names** in the DaaS schema using `mcp_daas_schema` or `mcp_daas_fields`. Do NOT assume field names — they may differ from common conventions (e.g., `created_at` vs `date_created`). Using a non-existent field in `sort` or `filter` causes a DaaS **500 error** with no helpful message, which is hard to debug through the proxy layer.
14. **Cross-Domain Auth Bridge (Amplify — always required)**: Supabase cookies cannot be shared between `*.amplifyapp.com` subdomains, so every micro-app needs the postMessage auth bridge. The bridge is owned by [add-microfrontend](../add-microfrontend/SKILL.md). Load that skill and copy the files it ships. Never send a refresh token across the bridge — see [auth-bridge](../add-microfrontend/references/auth-bridge.instructions.md).

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Main App  (my-app)                                            │
│  - Auth (login/logout), session and token refresh              │
│  - Navigation & iframe composition                             │
│  - Own pages (dashboard, settings, etc.)                       │
│  - Components → shared DaaS directly                           │
└─────────┬──────────────────────┬───────────────────┬───────────┘
          │                      │                   │
          ▼                      ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Users App       │  │  Billing App     │  │  Analytics App   │
│  (micro-app)     │  │  (micro-app)     │  │  (micro-app)     │
│  ┌─────────────┐ │  │  ┌─────────────┐ │  │  ┌─────────────┐ │
│  │ Next.js App │ │  │  │ Next.js App │ │  │  │ Next.js App │ │
│  │ own cookie  │ │  │  │ own cookie  │ │  │  │ own cookie  │ │
│  └──────┬──────┘ │  │  └──────┬──────┘ │  │  └──────┬──────┘ │
└─────────┼────────┘  └─────────┼────────┘  └─────────┼────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                  ┌──────────────────────────┐
                  │  Single DaaS Backend     │
                  │  (shared by ALL apps)    │
                  │                          │
                  │  Collections:            │
                  │  - profiles, roles       │  ← Users domain
                  │  - invoices, payments    │  ← Billing domain
                  │  - events, reports       │  ← Analytics domain
                  │  - settings, dashboard   │  ← Main App domain
                  └────────────┬─────────────┘
                               ▼
                  ┌──────────────────────────┐
                  │  Supabase                │
                  │  (Auth + single DB)      │
                  └──────────────────────────┘
```

## Implementation Steps

### Step 0: Discover Project Context (MANDATORY — ALWAYS FIRST)

Before any code or configuration, call the `get_project_detail` platform MCP tool to auto-discover the full project context. **Never ask the user for URLs or credentials — they are all in the context.**

```json
// Call the platform MCP tool — no arguments needed
{ "name": "get_project_detail", "arguments": {} }
```

This returns:
- **`project.mainAmplifyUrl`** — Main App's deployed URL (the `HOST_ORIGIN` default in each micro-app's `config/app-urls.ts`; override via `NEXT_PUBLIC_MICROAPP_URL_MAIN`, never `NEXT_PUBLIC_HOST_ORIGIN` — that name is reserved by `lib/origin.ts`)
- **`project.supabaseUrl`**, **`project.supabaseAnonKey`**, **`project.supabaseServiceRoleKey`** — shared auth credentials
- **`project.daasUrl`** — shared DaaS backend URL
- **`project.mainGitUrl`**, **`project.mainGitToken`** — git credentials for cloning/pushing
- **`microapps[]`** — list of existing micro-apps with `name`, `gitUrl`, `amplifyUrl`

**Validation:** If any critical value (`daasUrl`, `supabaseUrl`, `mainAmplifyUrl`) is null, report it to the user with a specific remediation step. Do NOT proceed with placeholder values.

See [Context Discovery reference](references/context-discovery.instructions.md) for the full response schema and derivation rules.

### Step 1: Define Collection Domain Boundaries

Before creating any code, map out which collections belong to which app's domain. All collections live in the **same DaaS instance**:

| App / Domain | Collections                         | Owned By Team |
| ------------ | ----------------------------------- | ------------- |
| Main App     | `settings`, `dashboard_widgets`     | Core team     |
| Users        | `profiles`, `roles`, `preferences`  | Users team    |
| Billing      | `invoices`, `plans`, `payments`     | Billing team  |
| Analytics    | `events`, `reports`, `dashboards`   | Analytics team|

**Important**: Any app can _read_ any collection (subject to RBAC). Ownership means the team is responsible for that collection's schema, hooks, and business logic.

### Step 2: Create or Clone the Micro-App Project

Check if the microapp already exists in the `microapps[]` array from Step 0:

**If the microapp exists** (has `gitUrl`):
```bash
# Clone using the discovered git URL (includes credentials)
git clone {{microapp.gitUrl}} /path/to/{{microapp.name}}
cd /path/to/{{microapp.name}}
pnpm install
```

**If the microapp is new** — bootstrap it:
```bash
# Create the micro-app project
mkdir -p /path/to/{{serviceName}}-app
npx @buildpad/cli@latest bootstrap --cwd /path/to/{{serviceName}}-app
```

> The directory name is a local choice and is NOT the platform `microapps[].name` —
> existing repos may be called `<name>-starter`, `<name>-app`, or anything else.
> Config keys and env-var names always derive from the platform `name`; routes come
> from the micro-app's own `DEFAULT_AUTHENTICATED_ROUTE`. Write the mapping table
> from [add-microfrontend Step 3](../add-microfrontend/SKILL.md) before creating
> pages.

### Step 3: Auto-Configure Environment & URL Config (From Context — No User Input)

**ALL values come from the `get_project_detail` response.** Never use placeholder URLs.

Configuration is split in two:

- `.env.local` — infrastructure secrets (Supabase, DaaS). Also set in the Amplify console.
- `config/app-urls.ts` — application URLs, committed to git, available at build time.

Write both files for the Main App and for every micro-app. The file shapes, the
generation rules, and the failure modes are in one place:
[app-urls config](references/app-urls-config.instructions.md).

### Step 4: Auth Bridge for Cross-Domain Sessions (ALWAYS Required on Amplify)

On Amplify each app gets a different `*.amplifyapp.com` subdomain. `amplifyapp.com` is
a public suffix, so the browser treats each subdomain as a separate site and Supabase
cookies from the Main App are invisible to the micro-app. Without the bridge, the user
sees a login prompt in every micro-app section.

The bridge is owned by
[add-microfrontend](../add-microfrontend/SKILL.md). Load that skill and copy the files
it ships. Do not reimplement the bridge here.

Two rules matter while you bootstrap the repos:

1. Every micro-app needs `app/api/auth/set-session/route.ts`,
   `app/api/auth/logout/route.ts`, and `app/api/auth/token/route.ts`.
2. Every micro-app `config/app-urls.ts` needs `HOST_ORIGIN` and
   `DEFAULT_AUTHENTICATED_ROUTE`.

Full implementation and the security checklist:
[auth-bridge](../add-microfrontend/references/auth-bridge.instructions.md).

### Step 5: Configure Direct DaaS Access (Both Apps)

Buildpad UI components call DaaS directly from the browser. Hand-written fetches use a proxy route in the same app (Rule 3). Supply the DaaS URL and the Supabase JWT with `DaaSProvider`:

In a Buildpad starter the CLI already installs `components/DaaSProviderWrapper.tsx`
mounted from `app/(authenticated)/layout.tsx` — keep that. Never move the provider to
the root layout: root layouts never unmount, so a logout → login cycle delivers a
stale token (daas-platform Bug 22). The hand-rolled shape, for reference:

```typescript
// app/(authenticated)/layout.tsx-style wiring — NEVER app/layout.tsx (Bug 22)
import { DaaSProvider } from '@/lib/buildpad/services';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DaaSProvider
          config={{
            url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!,
            getToken: () => supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null),
          }}
        >
          {children}
        </DaaSProvider>
      </body>
    </html>
  );
}
```

DaaS CORS is a **settings singleton**, not env vars, and the default
(`cors_origins: ["*"]`, `cors_allow_credentials: false`) blocks every credentialed
browser call. Configure it with the runnable `mcp_daas_cors-settings` update in
[add-microfrontend Step 6](../add-microfrontend/SKILL.md) — origins must be explicit
and `cors_allow_credentials` must be `true`.

In client components, use `useDaaSContext()` to get `buildUrl` and `getHeaders`:

```typescript
import { useDaaSContext } from '@/lib/buildpad/services';

export function OrdersList() {
  const { buildUrl, getHeaders } = useDaaSContext();

  useEffect(() => {
    fetch(buildUrl('/api/items/orders'), { headers: getHeaders() })
      .then(r => r.json())
      .then(data => setOrders(data.data));
  }, []);
}
```

### Step 6: Main App with Service Routing (Auto-Generated from Context)

Generate the service registry from the `microapps[]` returned by `get_project_detail`. **Do not hardcode service entries** — derive them dynamically. The registry imports URLs from the committed `config/app-urls.ts`:

```typescript
// my-app/lib/services.ts
// Auto-generated from get_project_detail → microapps[]
// URLs come from config/app-urls.ts (committed to git)

import { MICROAPP_URLS } from '@/config/app-urls';

export const MICRO_APPS = {
  // Example: if microapps[] contains { name: 'users-app', amplifyUrl: 'https://main.d123.amplifyapp.com' }
  'users-app': {
    url: MICROAPP_URLS['users-app'],
    label: 'Users',
    icon: 'users',
    routes: [
      { path: '/admin/users', microappPath: '/users', label: 'All Users' },
      { path: '/admin/users/roles', microappPath: '/roles', label: 'Roles' },
    ],
  },
  'billing-app': {
    url: MICROAPP_URLS['billing-app'],
    label: 'Billing',
    icon: 'credit-card',
    routes: [
      { path: '/admin/billing', microappPath: '/invoices', label: 'Invoices' },
      { path: '/admin/billing/plans', microappPath: '/plans', label: 'Plans' },
    ],
  },
} as const;
```

**Agent rule:** When generating `lib/services.ts`, iterate over the actual `microapps[]` array from context — do not use example entries. Import URLs from `config/app-urls.ts` rather than reading `process.env` directly.

`MicroappIframe` ships with [add-microfrontend](../add-microfrontend/SKILL.md). Copy it
from there. Do not write your own.

```typescript
// my-app/app/admin/users/page.tsx
import { MicroappIframe } from '@/components/MicroappIframe';
import { MICRO_APPS } from '@/lib/services';

export default function AdminUsersPage() {
  return (
    <MicroappIframe
      src={MICRO_APPS.users.url}
      path="/users"
      title="Users Management"
      allowedParams={['search', 'page', 'sort', 'role']}
      height="calc(100vh - 100px)"
    />
  );
}
```

### Step 7: Cross-Domain Data Access

Since all apps share the same DaaS backend, a micro-app can query **any collection** it has RBAC access to — even collections "owned" by another domain. No API-to-API calls needed:

```typescript
// billing-app needs to display user name on an invoice
// It queries the 'profiles' collection directly from the shared DaaS
// using buildUrl/getHeaders from DaaSProvider — no proxy needed

export async function getInvoiceWithUser(invoiceId: string) {
  // Both calls go directly to the same DaaS backend
  const { buildUrl, getHeaders } = useDaaSContext(); // or use buildApiUrl from services
  const invoice = await fetch(buildUrl(`/api/items/invoices/${invoiceId}`), { headers: getHeaders() }).then(r => r.json());
  const profile = await fetch(buildUrl(`/api/items/profiles/${invoice.data.user_id}`), { headers: getHeaders() }).then(r => r.json());

  return {
    ...invoice.data,
    user_display_name: profile.data.display_name,
  };
}
```

**When cross-domain access is common**, use DaaS **relational fields** to fetch related data in a single request:

```typescript
// Fetch invoice with related user profile in one DaaS call
const response = await fetch(
  buildUrl('/api/items/invoices/inv-001?fields=*,user_id.display_name,user_id.email'),
  { headers: getHeaders() }
);
// Returns invoice with nested user data — no extra API calls
```

### Step 8: Shared Type Contracts

Define shared interfaces for cross-domain data:

```typescript
// packages/shared-types/src/users.ts
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

// packages/shared-types/src/billing.ts
export interface Invoice {
  id: string;
  user_id: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  created_at: string;
}
```

Publish as a shared package or copy to each app's `types/contracts/` directory.

### Step 9: DaaS Collections Setup (via MCP)

All collections are created in the **same DaaS instance** via MCP tools:

```json
// mcp_daas_collections -> action: create (all in SAME DaaS instance)

// Users domain
{ "collection": "profiles", "meta": { "icon": "person", "note": "User profiles — owned by Users team" } }
{ "collection": "roles", "meta": { "icon": "shield", "note": "User roles — owned by Users team" } }

// Billing domain
{ "collection": "invoices", "meta": { "icon": "receipt", "note": "Billing invoices — owned by Billing team" } }
{ "collection": "payments", "meta": { "icon": "credit_card", "note": "Payments — owned by Billing team" } }

// Analytics domain
{ "collection": "events", "meta": { "icon": "timeline", "note": "Analytics events — owned by Analytics team" } }
{ "collection": "reports", "meta": { "icon": "assessment", "note": "Reports — owned by Analytics team" } }
```

Use collection `meta.note` to document domain ownership.

### Step 10: Shared RBAC Configuration

Roles and permissions are defined once in the single DaaS backend and apply across all apps:

```json
// mcp_daas_roles -> action: create
{ "name": "admin", "description": "Full access to all collections" }
{ "name": "billing_manager", "description": "CRUD on billing collections, read-only on profiles" }
{ "name": "viewer", "description": "Read-only access to all collections" }

// mcp_daas_permissions -> action: create
// Admin: full access
{ "role": "admin", "collection": "profiles", "action": "read", "fields": ["*"] }
{ "role": "admin", "collection": "profiles", "action": "create", "fields": ["*"] }
{ "role": "admin", "collection": "invoices", "action": "read", "fields": ["*"] }
{ "role": "admin", "collection": "invoices", "action": "create", "fields": ["*"] }

// Billing manager: full billing, read-only profiles
{ "role": "billing_manager", "collection": "invoices", "action": "read", "fields": ["*"] }
{ "role": "billing_manager", "collection": "invoices", "action": "create", "fields": ["*"] }
{ "role": "billing_manager", "collection": "invoices", "action": "update", "fields": ["*"] }
{ "role": "billing_manager", "collection": "profiles", "action": "read", "fields": ["display_name", "email"] }
```

### Step 11: Add Tests

**Per-app tests (in each micro-app):**

```typescript
// users-app/tests/api/users.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Users App API', () => {
  test('GET /api/items/profiles returns profiles', async ({ request }) => {
    const response = await request.get('/api/items/profiles');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data).toBeDefined();
  });

  test('POST /api/items/profiles creates profile', async ({ request }) => {
    const response = await request.post('/api/items/profiles', {
      data: { display_name: 'Test User', email: 'test@example.com' },
    });
    expect(response.status()).toBe(200);
  });
});
```

**Cross-app integration tests (in Main App):**

```typescript
// my-app/tests/integration/cross-app.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Cross-App Integration', () => {
  test('Main App renders users micro-app iframe', async ({ page }) => {
    await page.goto('/admin/users');
    const iframe = page.locator('iframe[title="Users Management"]');
    await expect(iframe).toBeVisible();
  });

  test('Main App renders billing micro-app iframe', async ({ page }) => {
    await page.goto('/admin/billing');
    const iframe = page.locator('iframe[title="Billing"]');
    await expect(iframe).toBeVisible();
  });

  test('navigation switches between micro-apps', async ({ page }) => {
    await page.goto('/admin/users');
    let iframe = page.locator('iframe');
    let src = await iframe.getAttribute('src');
    expect(src).toContain('users');

    await page.click('a[href="/admin/billing"]');
    await page.waitForURL('/admin/billing');
    iframe = page.locator('iframe');
    src = await iframe.getAttribute('src');
    expect(src).toContain('billing');
  });
});
```

## File Structure (Multi-App Workspace)

```
workspace/
├── my-app/                          # Main App
│   ├── app/
│   │   ├── admin/
│   │   │   ├── layout.tsx           # AdminShell
│   │   │   ├── dashboard/page.tsx   # Main App's own page
│   │   │   ├── settings/page.tsx    # Main App's own page
│   │   │   ├── users/page.tsx       # → Users micro-app iframe
│   │   │   ├── billing/page.tsx     # → Billing micro-app iframe
│   │   │   └── analytics/page.tsx   # → Analytics micro-app iframe
│   │   ├── api/
│   │   │   └── auth/                # Auth routes (Supabase SSR cookies)
│   │   └── login/page.tsx           # Login page
│   ├── components/
│   │   └── MicroappIframe.tsx       # from add-microfrontend
│   ├── config/
│   │   └── app-urls.ts             # Deployed URLs (committed to git)
│   ├── lib/
│   │   ├── bridge/                  # from add-microfrontend
│   │   └── services.ts             # Micro-app registry (imports from config)
│   ├── .env.local                   # Infrastructure secrets only
│   └── tests/
│       └── integration/
│           └── cross-app.spec.ts
│
├── users-app/                        # Users Micro-App
│   ├── app/
│   │   ├── users/                   # Users pages
│   │   ├── roles/                   # Roles pages
│   │   ├── api/
│   │   │   └── auth/                # set-session, logout, token, user
│   │   ├── login/page.tsx           # renders LoginBridge
│   │   └── ...
│   ├── components/                  # MicroappBridgeProvider, LoginBridge
│   ├── config/
│   │   └── app-urls.ts             # HOST_ORIGIN + DEFAULT_AUTHENTICATED_ROUTE
│   ├── hooks/
│   │   └── useQueryParamSync.ts
│   ├── lib/bridge/                  # bridge-protocol.ts
│   ├── .env.local                   # Infrastructure secrets only
│   └── tests/
│
├── billing-app/                      # Billing Micro-App
│   ├── app/
│   │   ├── invoices/
│   │   ├── plans/
│   │   ├── api/
│   │   │   └── auth/
│   │   └── ...
│   │   └── ...
│   ├── config/
│   │   └── app-urls.ts             # Host origin URL (committed to git)
│   ├── .env.local                   # Infrastructure secrets only
│   └── tests/
│
├── analytics-app/                    # Analytics Micro-App
│   ├── ...
│   ├── config/
│   │   └── app-urls.ts             # Host origin URL (committed to git)
│   ├── .env.local                   # Infrastructure secrets only
│   └── tests/
│
└── packages/
    └── shared-types/                 # Shared TypeScript contracts
        └── src/
            ├── users.ts
            ├── billing.ts
            └── events.ts
```

## Domain Ownership Matrix

| Concern            | Main App                   | Micro-App (each)           |
| ------------------ | -------------------------- | -------------------------- |
| Authentication     | Login/logout flows         | Session validation only    |
| Navigation         | Sidebar, header, tabs      | Internal routes only       |
| Layout             | AppShell wrapper           | Page content only          |
| Data collections   | Own domain collections     | Own domain collections     |
| API routes         | `/api/auth/*` (+ `/api/items/*` only for hand-written fetches) | `/api/auth/*` incl. `set-session`, `logout`, `token` (+ `/api/items/*` only for hand-written fetches) |
| DaaS backend       | Shared (same URL)          | Shared (same URL)          |
| Deployment         | Independent (Amplify)      | Independent (Amplify)      |
| Testing            | Integration + E2E          | Unit + API + E2E           |
| RBAC               | Managed centrally in DaaS  | Enforced by DaaS on every request |

## Deployment Automation

### Automated Deploy via Git Push

After scaffolding and configuring a microapp, deploy it by pushing to git. Amplify triggers a build on push to `main`:

```bash
# Inside the micro-app directory
cd /path/to/{{serviceName}}-app

# Initialize git if not already a repo
git init
git remote add origin {{microapp.gitUrl}}

# Commit and push to trigger Amplify deployment
git add .
git commit -m "feat: initial {{serviceName}} microapp scaffold"
git push -u origin main
```

### Update Main App After New Microapp

When adding a new microapp, the Main App needs:
1. A new entry in `config/app-urls.ts` with the microapp's Amplify URL as default
2. An entry in `lib/services.ts` for the new service (importing from config)
3. A new page under `app/admin/{{route}}/page.tsx` with `MicroappIframe`

```bash
# Update Main App
cd /path/to/main-app

# 1. config/app-urls.ts already updated with the new microapp URL
# 2. lib/services.ts already updated with the new service entry
# 3. New page already created

# Commit and push — Amplify builds with URLs baked into codebase
git add .
git commit -m "feat: add {{serviceName}} microapp integration"
git push origin main
```

**Agent rule:** After pushing, note that Amplify deployments take 2-5 minutes. No manual Amplify console env var changes are needed — the microapp URL is baked into `config/app-urls.ts` in the codebase.

### Amplify Environment Variables

Only **infrastructure variables** (Supabase, DaaS) need to be set in the Amplify console. These are set once when the Amplify app is created:

```
NEXT_PUBLIC_SUPABASE_URL        — set once at app creation
NEXT_PUBLIC_SUPABASE_ANON_KEY   — set once at app creation
SUPABASE_SERVICE_ROLE_KEY       — set once at app creation (Main App only)
NEXT_PUBLIC_BUILDPAD_DAAS_URL   — set once at app creation
```

App URLs (Main App URL, microapp URLs) live in committed `config/app-urls.ts` — NOT as Amplify env vars.

```yaml
# amplify.yml (included in every micro-app)
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm build
  artifacts:
    baseDirectory: .next
    files:
      - "**/*"
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

## End-to-End Automated Workflow Summary

The complete agent workflow with zero user input for URLs/credentials:

```
1.  get_project_detail → discover all context (URLs, credentials, microapps)
2.  Validate critical values exist (daasUrl, supabaseUrl, mainAmplifyUrl)
3.  Check if microapp already exists in context
    ├── Exists → clone gitUrl, configure, continue development
    └── New → bootstrap project
4.  Auto-generate .env.local for infrastructure vars (no placeholders)
5.  Auto-generate config/app-urls.ts with deployed URLs (committed to git)
6.  Load add-microfrontend and copy the bridge files into every app
7.  Auto-generate lib/services.ts importing from config/app-urls.ts
8.  Create domain collections in DaaS via MCP
9.  Set up RBAC for cross-domain access
10. Set up DaaSProvider in (authenticated)/layout.tsx (URL + token + getHeaders)
11. Write tests
12. git push → Amplify deploys automatically
13. Update Main App with new service integration → push → deploy
```

## Key Differences from Multi-DaaS Architecture

| Aspect                    | Single Shared DaaS (this pattern)       | Multi-DaaS (NOT this pattern)            |
| ------------------------- | --------------------------------------- | ---------------------------------------- |
| DaaS instances            | 1 shared by all                         | 1 per service                            |
| `NEXT_PUBLIC_BUILDPAD_DAAS_URL` | Same everywhere                  | Different per service                    |
| Cross-domain data access  | Direct (same DaaS, RBAC-controlled)     | API-to-API calls between services        |
| RBAC                      | Centralized (one set of roles)          | Per-service (separate role sets)          |
| Schema coordination       | Shared — coordinate changes             | Independent — no coordination needed     |
| Relations between domains | DaaS relational fields work natively    | Not possible (separate databases)        |
| Complexity                | Lower (one backend to manage)           | Higher (N backends to manage)            |

## References

- [Context discovery & auto-configuration](references/context-discovery.instructions.md)
- [Service boundary patterns](references/service-boundaries.instructions.md)
- [Cross-domain data access](references/cross-service-communication.instructions.md)
- [App URL config (`config/app-urls.ts`)](references/app-urls-config.instructions.md)
- [Deployment topology](references/deployment-topology.instructions.md)
- [add-microfrontend](../add-microfrontend/SKILL.md) — iframe composition and the auth bridge

