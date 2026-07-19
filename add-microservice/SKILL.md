---
name: add-microservice
description: Set up a microservice architecture where one Main App and multiple micro-apps all share a single DaaS backend. Each micro-app owns a domain of collections within the shared DaaS, has its own API proxy routes, and is composed via iframe in the Main App. Use when the user says add-microservice, microservice, service boundary, or needs to split a large app into domain-focused micro-apps.
argument-hint: "[service name] [domain, e.g. users, billing, analytics]"
---

# Add Microservice

Set up a **microservice architecture** where one **Main App** and multiple **micro-apps** all share a **single DaaS backend**. Each micro-app is a standalone Next.js application that owns a domain of collections within the shared DaaS. Micro-apps are composed at the client level via the iframe micro-frontend pattern.

## Critical Rules

1. **Single Shared DaaS Backend**: All apps (Main App + micro-apps) connect to the **same** DaaS backend instance via the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`. There is only ONE DaaS backend. Collections for all domains live in this single instance.
2. **Shared Auth, Shared Data Layer**: All apps share the same Supabase Auth project AND the same DaaS backend. Authentication and data access go through the same infrastructure.
3. **Direct DaaS Calls**: Each app (Main App and micro-apps) calls DaaS **directly** from the browser using `Authorization: Bearer <supabase-jwt>` headers. CORS is handled on the DaaS side via `CORS_ORIGINS` env var. No Next.js proxy routes are needed for DaaS data.
4. **Collection-Based Domain Boundaries**: Each micro-app "owns" a logical domain of collections (e.g., Users service owns `profiles`, `roles`; Billing service owns `invoices`, `payments`). Ownership is a team/code convention — all collections physically live in the same DaaS instance.
5. **Independent Deployment**: Each micro-app deploys independently as a Next.js application. Schema changes in DaaS are shared — coordinate collection/field changes via the DaaS admin or MCP tools.
6. **Main App Is a Full App**: The Main App handles authentication, navigation, iframe composition, AND can have its own pages and collection data. It is not a thin shell.
7. **Shared Types via Contracts**: Cross-domain data access uses well-defined TypeScript interfaces. Publish shared types via a `packages/shared-types/` package or shared contract files.
8. **Backend-First Logic**: Use DaaS runtime extensions (filter/action hooks) for validation, audit logging, and business rules — not Next.js API routes. Extensions are configured once in the shared DaaS and apply regardless of which app triggers the request.
9. **Independent Testing**: Each micro-app has its own test suite (Playwright E2E + Vitest unit). Cross-service integration tests live in the Main App project.
10. **Shared RBAC**: Roles and permissions are managed centrally in the single DaaS backend. Each role defines access to specific collections. A user's roles (assigned via the `daas_user_roles` junction table) determine what they can do across ALL apps.
11. **No Native Browser Dialogs in Micro-Apps**: Since micro-apps run inside iframes, `window.confirm()`, `window.alert()`, and `window.prompt()` are **blocked by the browser sandbox**. Use Mantine `Modal` (or `modals.openConfirmModal`) for all confirmation dialogs.
12. **No Function Props from Server Components (React 19)**: In Next.js 16 / React 19, you cannot pass functions as props from Server Components to Client Components. Avoid patterns like `<Anchor component={Link}>` in Server Components — use plain `<Link>` from `next/link` instead.
13. **Verify Field Names Against DaaS Schema**: Before writing any query, sort, or filter parameter, **always check the actual field names** in the DaaS schema using `mcp_daas_schema` or `mcp_daas_fields`. Do NOT assume field names — they may differ from common conventions (e.g., `created_at` vs `date_created`). Using a non-existent field in `sort` or `filter` causes a DaaS **500 error** with no helpful message, which is hard to debug through the proxy layer.
14. **Cross-Domain Auth Bridge (Amplify — always required)**: On AWS Amplify, every app gets a random subdomain like `main.dXXXX.amplifyapp.com`. Because `amplifyapp.com` is a public suffix, **Supabase cookies cannot be shared between apps** — the micro-app sees no session and redirects to `/login`, forcing users to log in again. Fix: implement the postMessage token bridge in every micro-app — the login page sends `MICROAPP_NEEDS_AUTH`, the Main App's `MicroappIframe` responds with `SET_AUTH { access_token, refresh_token }`, and the micro-app calls `/api/auth/set-session` to establish local cookies. See [add-microfrontend auth-syncing](../add-microfrontend/references/auth-syncing.instructions.md) for the full implementation.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Main App  (my-app)                                            │
│  - Auth (login/logout)                                         │
│  - Navigation & iframe composition                             │
│  - Own pages (dashboard, settings, etc.)                       │
│  - /api/items/* → shared DaaS                                  │
└─────────┬──────────────────────┬───────────────────┬───────────┘
          │                      │                   │
          ▼                      ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Users App       │  │  Billing App     │  │  Analytics App   │
│  (micro-app)     │  │  (micro-app)     │  │  (micro-app)     │
│  ┌─────────────┐ │  │  ┌─────────────┐ │  │  ┌─────────────┐ │
│  │ Next.js App │ │  │  │ Next.js App │ │  │  │ Next.js App │ │
│  │ /api/items  │ │  │  │ /api/items  │ │  │  │ /api/items  │ │
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
- **`project.mainAmplifyUrl`** — Main App's deployed URL (used as `NEXT_PUBLIC_HOST_ORIGIN` in micro-apps)
- **`project.supabaseUrl`**, **`project.supabaseAnonKey`**, **`project.supabaseServiceRoleKey`** — shared auth credentials
- **`project.daasUrl`** — shared DaaS backend URL
- **`project.mainGitUrl`**, **`project.mainGitToken`** — git credentials for cloning/pushing
- **`microservices[]`** — list of existing micro-apps with `name`, `gitUrl`, `amplifyUrl`

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

Check if the microservice already exists in the `microservices[]` array from Step 0:

**If the microservice exists** (has `gitUrl`):
```bash
# Clone using the discovered git URL (includes credentials)
git clone {{microservice.gitUrl}} /path/to/{{microservice.name}}
cd /path/to/{{microservice.name}}
pnpm install
```

**If the microservice is new** — bootstrap it:
```bash
# Create the micro-app project
mkdir -p /path/to/{{serviceName}}-app
npx @buildpad/cli@latest bootstrap --cwd /path/to/{{serviceName}}-app
```

### Step 3: Auto-Configure Environment & URL Config (From Context — No User Input)

**ALL values come from `get_project_detail` response.** Never use placeholder URLs.

Configuration is split into two parts:
- **`.env.local`** — infrastructure secrets (Supabase, DaaS). Also set in Amplify console.
- **`config/app-urls.ts`** — application URLs, **committed to git**. Available at build time without Amplify env vars.

Each micro-app `.env.local` (auto-generated from context):

```env
# Auto-populated from get_project_detail → project.* (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}

# DaaS Backend (SAME URL for ALL apps — single shared instance)
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev override for host origin (overrides config/app-urls.ts default)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
```

Each micro-app `config/app-urls.ts` (**committed to git**):

```typescript
// config/app-urls.ts — committed to git, auto-generated from get_project_detail
// For local development, override via .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000

/** Main App URL (host origin for postMessage security validation) */
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || '{{project.mainAmplifyUrl}}';
```

Main App `.env.local` (auto-generated from context):

```env
# Auto-populated from get_project_detail → project.* (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}
SUPABASE_SERVICE_ROLE_KEY={{project.supabaseServiceRoleKey}}

# DaaS Backend (SAME URL as micro-apps)
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev overrides for app URLs (overrides config/app-urls.ts defaults)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

Main App `config/app-urls.ts` (**committed to git**):

```typescript
// config/app-urls.ts — committed to git, auto-generated from get_project_detail
// These URLs are baked into the build so Amplify deployments work without
// manually setting URL env vars in the Amplify console.
//
// For local development, override via .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
//   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001

/** Main App deployed URL */
export const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || '{{project.mainAmplifyUrl}}';

/** Microservice deployed URLs (used as iframe src in the Main App) */
export const MICROSERVICE_URLS = {
  {{#each microservices}}
  '{{name}}': process.env.NEXT_PUBLIC_{{UPPERCASE(name)}}_URL || '{{amplifyUrl}}',
  {{/each}}
} as const;

export type MicroserviceKey = keyof typeof MICROSERVICE_URLS;
```

> **⚠️ CRITICAL — `config/app-urls.ts` Generation Rules:**
>
> 1. The **hardcoded string literal** (right side of `||`) MUST be the **actual deployed Amplify URL** resolved from `get_project_detail`. NEVER use `localhost`, `127.0.0.1`, or any placeholder URL as the hardcoded default.
> 2. The **env var** (left side of `||`) is a **single** `process.env.NEXT_PUBLIC_*` override for local development. NEVER chain multiple env vars.
> 3. Each export line must have **exactly one** `process.env.*` and **exactly one** hardcoded URL string.
>
> ```typescript
> // ❌ WRONG — localhost as default, chained env vars
> process.env.NEXT_PUBLIC_HOST_ORIGIN || process.env.NEXT_PUBLIC_HOST_ORIGIN_MAIN || 'http://localhost:3000'
>
> // ❌ WRONG — localhost as default
> 'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'http://localhost:3001',
>
> // ✅ CORRECT — actual Amplify URL as default, single env var override
> process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com'
> 'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'https://main.d5678fghij.amplifyapp.com',
> ```
>
> Write the actual resolved values into `config/app-urls.ts` as the default fallbacks, and write the actual infrastructure values into `.env.local`. For example, if `project.daasUrl` is `https://acme.buildpad-daas.xtremax.com`, write exactly that string. The env var override name for microservices is `NEXT_PUBLIC_` + the service name uppercased with hyphens as underscores + `_URL` (e.g., `users-app` → `NEXT_PUBLIC_USERS_APP_URL`).

### Step 4: Auth Bridge for Cross-Domain Sessions (ALWAYS Required on Amplify)

Microservices are composed via iframes in the Main App. On Amplify, each app has a different `*.amplifyapp.com` subdomain — these are treated as completely separate origins by browsers, so **Supabase cookies from the Main App are invisible to the micro-app**. Without the auth bridge the user sees a login prompt every time they navigate to a micro-app section, even though they are already logged in to the Main App.

**In every micro-app, implement these three pieces:**

**1. Create `app/api/auth/set-session/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
```

**2. Allow the route in middleware public routes (`lib/supabase/middleware.ts`):**

```typescript
const publicRoutes = ['/login', '/api/auth/set-session'];
```

**3. Update `app/login/page.tsx` to detect iframe context:**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { HOST_ORIGIN } from '@/config/app-urls';
import { Center, Loader, Stack, Text } from '@mantine/core';

export default function LoginPage() {
  const [isInIframe, setIsInIframe] = useState(false);
  const [iframeAuthFailed, setIframeAuthFailed] = useState(false);

  useEffect(() => {
    const inIframe = window.parent !== window;
    setIsInIframe(inIframe);
    if (!inIframe) return;

    window.parent.postMessage({ type: 'MICROAPP_NEEDS_AUTH' }, HOST_ORIGIN);

    async function handleMessage(event: MessageEvent) {
      if (event.origin !== HOST_ORIGIN) return;
      if (event.data?.type !== 'SET_AUTH') return;
      const { access_token, refresh_token } = event.data;
      const res = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token, refresh_token }),
      });
      if (res.ok) {
        window.location.href = '/content'; // your default authenticated route
      } else {
        setIframeAuthFailed(true);
      }
    }

    window.addEventListener('message', handleMessage);
    const timeout = setTimeout(() => setIframeAuthFailed(true), 3000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  if (isInIframe && !iframeAuthFailed) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Authenticating…</Text>
        </Stack>
      </Center>
    );
  }

  return <div>{/* existing login form */}</div>;
}
```

**In the Main App's `MicroappIframe` component**, ensure the `MICROAPP_NEEDS_AUTH` handler is present (the add-microfrontend skill includes this automatically). If you are creating the Main App manually, add this inside the `handleMessage` function:

```typescript
if (event.data?.type === 'MICROAPP_NEEDS_AUTH') {
  import('@/lib/supabase/client').then(({ createClient }) => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'SET_AUTH', access_token: session.access_token, refresh_token: session.refresh_token },
          resolvedOrigin,
        );
      }
    });
  });
}
```

> See [auth-syncing.instructions.md](../add-microfrontend/references/auth-syncing.instructions.md) for the complete pattern with security checklist.

### Step 5: Configure Direct DaaS Access (Both Apps)

All apps call DaaS directly from the browser — no Next.js proxy routes needed for data. Wrap the root layout with `DaaSProvider` to supply the DaaS URL and Supabase JWT:

```typescript
// app/layout.tsx (in every app)
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

DaaS CORS configuration (in DaaS `.env.local` or deployment env):
```
CORS_ORIGINS="http://localhost:3000,http://localhost:3001,https://main-app.example.com,https://micro-app.example.com"
CORS_ALLOW_CREDENTIALS=false
```

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

Generate the service registry from the `microservices[]` returned by `get_project_detail`. **Do not hardcode service entries** — derive them dynamically. The registry imports URLs from the committed `config/app-urls.ts`:

```typescript
// my-app/lib/services.ts
// Auto-generated from get_project_detail → microservices[]
// URLs come from config/app-urls.ts (committed to git)

import { MICROSERVICE_URLS } from '@/config/app-urls';

export const MICRO_APPS = {
  // Example: if microservices[] contains { name: 'users-app', amplifyUrl: 'https://main.d123.amplifyapp.com' }
  'users-app': {
    url: MICROSERVICE_URLS['users-app'],
    label: 'Users',
    icon: 'users',
    routes: [
      { path: '/admin/users', microappPath: '/users', label: 'All Users' },
      { path: '/admin/users/roles', microappPath: '/roles', label: 'Roles' },
    ],
  },
  'billing-app': {
    url: MICROSERVICE_URLS['billing-app'],
    label: 'Billing',
    icon: 'credit-card',
    routes: [
      { path: '/admin/billing', microappPath: '/invoices', label: 'Invoices' },
      { path: '/admin/billing/plans', microappPath: '/plans', label: 'Plans' },
    ],
  },
} as const;
```

**Agent rule:** When generating `lib/services.ts`, iterate over the actual `microservices[]` array from context — do not use example entries. Import URLs from `config/app-urls.ts` rather than reading `process.env` directly.

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
│   │   └── auth/login/page.tsx      # Login page
│   ├── components/
│   │   └── MicroappIframe.tsx
│   ├── config/
│   │   └── app-urls.ts             # Deployed URLs (committed to git)
│   ├── lib/
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
│   │   │   └── auth/                # Own auth routes (Supabase SSR cookies)
│   │   └── ...
│   ├── config/
│   │   └── app-urls.ts             # Host origin URL (committed to git)
│   ├── hooks/
│   │   └── useQueryParamSync.ts
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
| API routes         | `/api/auth/*`, `/api/items/*` | `/api/items/*`, `/api/auth/*` |
| DaaS backend       | Shared (same URL)          | Shared (same URL)          |
| Deployment         | Independent (Amplify)      | Independent (Amplify)      |
| Testing            | Integration + E2E          | Unit + API + E2E           |
| RBAC               | Managed centrally in DaaS  | Enforced by DaaS on every request |

## Deployment Automation

### Automated Deploy via Git Push

After scaffolding and configuring a microservice, deploy it by pushing to git. Amplify triggers a build on push to `main`:

```bash
# Inside the micro-app directory
cd /path/to/{{serviceName}}-app

# Initialize git if not already a repo
git init
git remote add origin {{microservice.gitUrl}}

# Commit and push to trigger Amplify deployment
git add .
git commit -m "feat: initial {{serviceName}} microservice scaffold"
git push -u origin main
```

### Update Main App After New Microservice

When adding a new microservice, the Main App needs:
1. A new entry in `config/app-urls.ts` with the microservice's Amplify URL as default
2. An entry in `lib/services.ts` for the new service (importing from config)
3. A new page under `app/admin/{{route}}/page.tsx` with `MicroappIframe`

```bash
# Update Main App
cd /path/to/main-app

# 1. config/app-urls.ts already updated with the new microservice URL
# 2. lib/services.ts already updated with the new service entry
# 3. New page already created

# Commit and push — Amplify builds with URLs baked into codebase
git add .
git commit -m "feat: add {{serviceName}} microservice integration"
git push origin main
```

**Agent rule:** After pushing, note that Amplify deployments take 2-5 minutes. No manual Amplify console env var changes are needed — the microservice URL is baked into `config/app-urls.ts` in the codebase.

### Amplify Environment Variables

Only **infrastructure variables** (Supabase, DaaS) need to be set in the Amplify console. These are set once when the Amplify app is created:

```
NEXT_PUBLIC_SUPABASE_URL        — set once at app creation
NEXT_PUBLIC_SUPABASE_ANON_KEY   — set once at app creation
SUPABASE_SERVICE_ROLE_KEY       — set once at app creation (Main App only)
NEXT_PUBLIC_BUILDPAD_DAAS_URL   — set once at app creation
```

App URLs (Main App URL, microservice URLs) live in committed `config/app-urls.ts` — NOT as Amplify env vars.

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
1.  get_project_detail → discover all context (URLs, credentials, microservices)
2.  Validate critical values exist (daasUrl, supabaseUrl, mainAmplifyUrl)
3.  Check if microservice already exists in context
    ├── Exists → clone gitUrl, configure, continue development
    └── New → bootstrap project
4.  Auto-generate .env.local for infrastructure vars (no placeholders)
5.  Auto-generate config/app-urls.ts with deployed URLs (committed to git)
6.  Implement auth bridge in every micro-app (set-session route + login page)
7.  Auto-generate lib/services.ts importing from config/app-urls.ts
8.  Create domain collections in DaaS via MCP
9.  Set up RBAC for cross-domain access
10. Set up DaaSProvider in root layout (URL + getToken callback)
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
- [Deployment topology](references/deployment-topology.instructions.md)

````
`````
