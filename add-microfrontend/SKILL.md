---
name: add-microfrontend
description: Set up a micro-frontend architecture using client-side iframe composition. Creates a Main App that hosts independent micro-apps via iframes with shared authentication (Supabase session cookies), browser URL syncing via postMessage, shared DaaS backend, and isolated rendering. Use when the user says add-microfrontend, micro-frontend, iframe composition, or needs to embed independent apps.
argument-hint: "[microapp name] [host route, e.g. /admin/dashboard]"
---

# Add Micro-Frontend (Iframe Composition)

Set up a **client-side composition** architecture where a **Main App** hosts independent **micro-apps** via sandboxed iframes. All apps share a **single DaaS backend** and **single Supabase Auth instance**. Each micro-app is a standalone Next.js application with its own SSR, routing, and state — composed at the browser level.

## Critical Rules

1. **Iframe-Based Composition**: Micro-apps are loaded via `<iframe>` elements. The Main App manages layout, navigation, and iframe `src` attributes. Each micro-app renders independently inside its iframe sandbox.
2. **Shared Session Cookie**: Authentication is shared between Main App and micro-apps via Supabase session cookies (same domain). The Main App handles login/logout; micro-apps inherit the session automatically. Never implement separate auth flows in micro-apps.
3. **No Direct DOM Access**: The Main App MUST NOT reach into iframe DOM, and micro-apps MUST NOT access `window.parent` DOM. Communication happens ONLY via `postMessage` with strict origin validation.
4. **URL Sync via postMessage**: When micro-app query params change (e.g., search, filters), the micro-app posts a message to the host. The host updates its own URL bar to keep URLs in sync. Only explicitly allowlisted params are synced.
5. **Independent Deployments**: Each micro-app is deployed independently (e.g., via AWS Amplify). Main App only holds the iframe `src` URLs — never bundles micro-app code.
6. **SSR for Both Layers**: Both Main App pages and micro-app pages use Next.js SSR. The Main App renders the shell layout server-side; the iframe triggers a separate SSR request for the micro-app.
7. **Auth Proxy in Every App**: Both the Main App and each micro-app must have their own `/api/auth/*` proxy routes. They share the same Supabase project but each app validates sessions independently via server-side middleware.
8. **Sandbox Security**: Iframes use `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` to restrict capabilities while allowing necessary functionality.
9. **Single Shared DaaS Backend**: All apps (Main App + micro-apps) MUST share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There is only ONE DaaS backend instance. Each app calls the shared DaaS backend **directly** using `Authorization: Bearer <supabase-jwt>` headers — no Next.js proxy routes needed for data. Set `CORS_ORIGINS` in the DaaS `.env` to include all app origins.
10. **Fallback UI**: Always show a loading skeleton inside the iframe container while the micro-app loads, and display an error boundary if the iframe fails to load.
11. **Main App Is a Full App**: The Main App is NOT just a thin shell — it can have its own pages, collections, and data. It additionally serves as the host for micro-app iframes.
12. **No Native Browser Dialogs in Micro-Apps**: `window.confirm()`, `window.alert()`, and `window.prompt()` are **blocked inside iframes** by the browser sandbox. Micro-apps MUST use Mantine `Modal` (or `modals.openConfirmModal` from `@mantine/modals`) for confirmation dialogs, alerts, and user input prompts. Never rely on native browser dialogs in any micro-app code.
13. **No Function Props from Server Components (React 19 / Next.js 16)**: In React 19, you cannot pass functions (including React components) as props from a Server Component to a Client Component. This means patterns like `<Anchor component={Link}>` will fail in Server Components because `Link` is a function. Use plain `<Link href="...">` from `next/link` instead. The `component={...}` prop pattern is only safe inside `'use client'` components.
14. **Verify Field Names Against DaaS Schema**: All apps share the same DaaS backend, so field name mismatches cause 500 errors that are hard to trace through iframe + proxy layers. **Always verify field names** via `mcp_daas_schema` or `mcp_daas_fields` before writing `sort`, `fields`, or `filter` parameters. Never assume names like `date_created` — the actual column may be `created_at`.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Main App  (my-app)                                  │
│  ┌────────────────────────────────────────────────┐  │
│  │  AdminShell (layout + navigation)              │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │  MicroappIframe                          │  │  │
│  │  │  src="https://microapp.example.com/users"│  │  │
│  │  │  ┌────────────────────────────────────┐  │  │  │
│  │  │  │  Micro-App (independent Next.js)   │  │  │  │
│  │  │  │  Own SSR, routing, state            │  │  │  │
│  │  │  └────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘

All apps connect to the SAME backend:

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Main App   │  │  Micro-App  │  │  Micro-App  │
│  (Next.js)  │  │  A (Next.js)│  │  B (Next.js)│
│  /api/items │  │  /api/items │  │  /api/items │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌──────────────────┐
              │  Single DaaS     │
              │  Backend         │
              │  (all collections│
              │   in one place)  │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Supabase        │
              │  (Auth + DB)     │
              └──────────────────┘
```

**Request flow:**

```
User → Main App (SSR) → Render AdminShell with <iframe src>
                         ↓
                  Browser loads iframe → Micro-App (SSR) → Render page inside iframe
                                         ↓
                  Micro-App /api/items/* → Single shared DaaS Backend → Supabase DB
```

## Implementation Steps

### Step 0: Discover Project Context (MANDATORY — ALWAYS FIRST)

Before any code or configuration, call the `get_project_detail` platform MCP tool to auto-discover the full project context. **Never ask the user for URLs or credentials — they are all in the context.**

```json
// Call the platform MCP tool — no arguments needed
{ "name": "get_project_detail", "arguments": {} }
```

This returns:
- **`project.mainAmplifyUrl`** — Main App's deployed URL (used as host origin in micro-apps' `config/app-urls.ts`, and for postMessage origin validation)
- **`project.supabaseUrl`**, **`project.supabaseAnonKey`**, **`project.supabaseServiceRoleKey`** — shared auth credentials
- **`project.daasUrl`** — shared DaaS backend URL
- **`project.mainGitUrl`**, **`project.mainGitToken`** — git credentials for cloning/pushing
- **`microservices[]`** — list of existing micro-apps with `name`, `gitUrl`, `amplifyUrl`

**Validation:** If any critical value (`daasUrl`, `supabaseUrl`, `mainAmplifyUrl`) is null, report it to the user with a specific remediation step. Do NOT proceed with placeholder values.

The `microservices[].amplifyUrl` values are the iframe `src` URLs — these are the deployed Amplify URLs for each micro-app. The `project.mainAmplifyUrl` is the host origin for postMessage security.

See [Context Discovery reference](references/context-discovery.instructions.md) for the full response schema and derivation rules.

### Step 1: Create the MicroappIframe Component (Main App)

Create a reusable iframe wrapper component in the Main App:

```typescript
// components/MicroappIframe.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton, Alert } from '@mantine/core';

interface MicroappIframeProps {
  /** Base URL of the micro-app (e.g., https://microapp.example.com) */
  src: string;
  /** Title for accessibility */
  title: string;
  /** Route path within the micro-app (e.g., /users) */
  path?: string;
  /** Query params to forward from host URL to micro-app */
  allowedParams?: string[];
  /** iframe sandbox permissions */
  sandbox?: string;
  /** Height of the iframe (default: 100%) */
  height?: string;
  /** Allowed origin for postMessage validation */
  allowedOrigin?: string;
}

export function MicroappIframe({
  src,
  title,
  path = '',
  allowedParams = [],
  sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups',
  height = '100%',
  allowedOrigin,
}: MicroappIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Build full iframe src with forwarded query params
  const iframeSrc = buildIframeSrc(src, path, searchParams, allowedParams);

  // Determine allowed origin from src if not explicitly provided
  const resolvedOrigin = allowedOrigin || new URL(src).origin;

  // Listen for postMessage from micro-app (URL sync)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // SECURITY: Validate origin
      if (event.origin !== resolvedOrigin) return;

      if (event.data?.type === 'QUERY_PARAMS_CHANGE') {
        const params = event.data.params as Record<string, string>;
        const currentParams = new URLSearchParams(searchParams.toString());

        // Only sync allowed params
        for (const [key, value] of Object.entries(params)) {
          if (allowedParams.includes(key)) {
            if (value) {
              currentParams.set(key, value);
            } else {
              currentParams.delete(key);
            }
          }
        }

        const queryString = currentParams.toString();
        const newPath = window.location.pathname + (queryString ? `?${queryString}` : '');
        router.replace(newPath, { scroll: false });
      }

      if (event.data?.type === 'MICROAPP_LOADED') {
        setIsLoading(false);
      }

      if (event.data?.type === 'MICROAPP_ERROR') {
        setHasError(true);
        setIsLoading(false);
      }

      // Handle auth expiration from micro-app
      if (event.data?.type === 'AUTH_EXPIRED') {
        router.push('/auth/login');
      }

      // Handle cross-domain auth bridge (Amplify deployments)
      // Micro-app login page cannot share cookies with the host on Amplify, so it
      // sends MICROAPP_NEEDS_AUTH.  The host responds with the current session tokens,
      // which the micro-app uses to call /api/auth/set-session and establish its own cookie.
      if (event.data?.type === 'MICROAPP_NEEDS_AUTH') {
        import('@/lib/supabase/client').then(({ createClient }) => {
          const supabase = createClient();
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  type: 'SET_AUTH',
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                },
                resolvedOrigin,
              );
            }
          });
        });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resolvedOrigin, allowedParams, searchParams, router]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {isLoading && (
        <Skeleton
          visible
          height="100%"
          width="100%"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        />
      )}
      {hasError && (
        <Alert color="red" title="Failed to load micro-app">
          The embedded application could not be loaded. Please try refreshing the page.
        </Alert>
      )}
      {!hasError && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={title}
          sandbox={sandbox}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: isLoading ? 'none' : 'block',
          }}
        />
      )}
    </div>
  );
}

function buildIframeSrc(
  base: string,
  path: string,
  searchParams: URLSearchParams,
  allowedParams: string[],
): string {
  const url = new URL(path, base);
  for (const param of allowedParams) {
    const value = searchParams.get(param);
    if (value) url.searchParams.set(param, value);
  }
  return url.toString();
}
```

### Step 2: Create the AdminShell Layout (Main App)

The Main App manages top-level layout and navigation. Each route renders either a Main App page or a micro-app in an iframe:

```typescript
// app/admin/layout.tsx
import { AppShell, NavLink, Group, Title } from '@mantine/core';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>My App</Title>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <NavLink href="/admin/dashboard" label="Dashboard" />
        <NavLink href="/admin/users" label="Users" />
        <NavLink href="/admin/settings" label="Settings" />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

### Step 3: Create Host Route Pages (Main App)

Each admin route page renders the iframe. Use the Amplify URL from `config/app-urls.ts` (committed to git, auto-generated from `get_project_detail` → `microservices[].amplifyUrl`):

```typescript
// app/admin/users/page.tsx
import { MicroappIframe } from '@/components/MicroappIframe';
import { MICROSERVICE_URLS } from '@/config/app-urls';

export default function AdminUsersPage() {
  return (
    <MicroappIframe
      src={MICROSERVICE_URLS['users-app']}
      path="/users"
      title="Users Management"
      allowedParams={['search', 'page', 'sort', 'status']}
      height="calc(100vh - 100px)"
    />
  );
}
```

**Agent rule:** When generating these pages, iterate over the actual `microservices[]` array from context. For each microservice, create a page under `app/admin/{{route}}/page.tsx` with the iframe pointing to that microservice's Amplify URL via env var.

### Step 4: Create useQueryParamSync Hook (Micro-App)

Inside each micro-app, create a hook that syncs query params to the host via postMessage:

```typescript
// hooks/useQueryParamSync.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface UseQueryParamSyncOptions {
  /** The host/Main App origin to post messages to */
  hostOrigin: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

export function useQueryParamSync({ hostOrigin, debounceMs = 300 }: UseQueryParamSyncOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Notify host that micro-app has loaded
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MICROAPP_LOADED' }, hostOrigin);
    }
  }, [hostOrigin]);

  const updateQueryParams = useCallback(
    (params: Record<string, string | null>) => {
      const currentParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === '') {
          currentParams.delete(key);
        } else {
          currentParams.set(key, value);
        }
      }

      const queryString = currentParams.toString();
      const newPath = pathname + (queryString ? `?${queryString}` : '');

      // Update micro-app URL
      router.replace(newPath, { scroll: false });

      // Debounce postMessage to host
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'QUERY_PARAMS_CHANGE',
              params: Object.fromEntries(currentParams.entries()),
            },
            hostOrigin,
          );
        }
      }, debounceMs);
    },
    [searchParams, pathname, router, hostOrigin, debounceMs],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { updateQueryParams, searchParams };
}
```

### Step 5: Auth Syncing Setup

> **⚠️ Cross-Domain Auth (Amplify Deployments)**
> On AWS Amplify every app gets a randomly-assigned subdomain like `main.d1a2b3.amplifyapp.com`. Because `amplifyapp.com` is a public suffix, **Supabase cookies set on the Main App domain are completely invisible to the micro-app domain**. The micro-app middleware sees no session and redirects to `/login` — the user appears to need to log in again even though they already authenticated in the Main App.
>
> **Fix: implement the postMessage auth token bridge** (see the full pattern in [auth-syncing.instructions.md](references/auth-syncing.instructions.md)):
> 1. Micro-app `/login` page detects it is inside an iframe → sends `MICROAPP_NEEDS_AUTH` to host
> 2. `MicroappIframe` responds with `SET_AUTH { access_token, refresh_token }` (handled in Step 1's component)
> 3. Micro-app calls `/api/auth/set-session` with the tokens → local Supabase cookie established
> 4. Micro-app redirects to authenticated content — no user action required
>
> Always implement this bridge whenever micro-apps are deployed on Amplify or any other platform that assigns distinct random-subdomain URLs.

**Set up the auth bridge in every micro-app:**

**1. Create `/api/auth/set-session/route.ts`:**

```typescript
// app/api/auth/set-session/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing access_token or refresh_token' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
```

**2. Add `/api/auth/set-session` to public routes in `lib/supabase/middleware.ts`:**

```typescript
const publicRoutes = ['/login', '/api/auth/set-session'];
```

**3. Update the micro-app login page (`app/login/page.tsx`) to handle iframe auth:**

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
      try {
        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token }),
        });
        if (res.ok) {
          window.location.href = '/content'; // redirect to your default authenticated route
        } else {
          setIframeAuthFailed(true);
        }
      } catch {
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

  return (
    // ... your existing login form ...
    <div />
  );
}
```

The `MicroappIframe` component (Step 1) already handles `MICROAPP_NEEDS_AUTH` and sends `SET_AUTH` back.

**Main App logout clears session for all apps** because they share the same Supabase session cookie on the same domain:

```typescript
// Main App: app/api/auth/logout/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
```

**Micro-app middleware checks session on every SSR request:**

```typescript
// Micro-app: middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // If no valid session, notify host
  if (!user) {
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth).*)'],
};
```

**Micro-app notifies host on auth expiration (client-side):**

```typescript
// Micro-app: lib/auth-guard.ts
'use client';

export function notifyAuthExpired(hostOrigin: string) {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'AUTH_EXPIRED' }, hostOrigin);
  }
}
```

### Step 6: Auto-Configure Environment & URL Config (From Context — No User Input)

**ALL values come from `get_project_detail` response.** Never use placeholder URLs like `example.com`.

All apps share the SAME DaaS backend and Supabase instance.

Configuration is split into two parts:
- **`.env.local`** — infrastructure secrets (Supabase, DaaS). Also set in Amplify console.
- **`config/app-urls.ts`** — application URLs, **committed to git**. Available at build time without Amplify env vars.

**Main App (`.env.local`)** — infrastructure secrets only:

```env
# Auto-populated from get_project_detail → project.* (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}
SUPABASE_SERVICE_ROLE_KEY={{project.supabaseServiceRoleKey}}

# DaaS Backend (SAME for all apps)
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev overrides for app URLs (overrides config/app-urls.ts defaults)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

**Main App (`config/app-urls.ts`)** — committed to git:

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

**Micro-app (`.env.local`)** — infrastructure secrets only:

```env
# Auto-populated from get_project_detail → project.* (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}

# DaaS Backend (SAME URL as Main App — single shared backend)
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev override for host origin (overrides config/app-urls.ts default)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
```

**Micro-app (`config/app-urls.ts`)** — committed to git:

```typescript
// config/app-urls.ts — committed to git, auto-generated from get_project_detail
// For local development, override via .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000

/** Main App URL (host origin for postMessage security validation) */
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || '{{project.mainAmplifyUrl}}';
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
> Write the actual resolved values into `config/app-urls.ts` as the default fallbacks, and write the actual infrastructure values into `.env.local`. The env var override name for microservices is `NEXT_PUBLIC_` + name uppercased with hyphens as underscores + `_URL` (e.g., `users-app` → `NEXT_PUBLIC_USERS_APP_URL`).

### Step 7: API Proxy Routes (Both Apps)

Both Main App and micro-apps use the same proxy pattern pointing to the same DaaS:

```typescript
// app/api/items/[collection]/route.ts  (same in Main App and each micro-app)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '@/lib/api/auth-headers';

const DAAS_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!;

type RouteParams = { params: Promise<{ collection: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  const headers = await getAuthHeaders();
  const { searchParams } = new URL(request.url);

  const response = await fetch(
    `${DAAS_URL}/items/${collection}?${searchParams.toString()}`,
    { headers },
  );

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  const headers = await getAuthHeaders();
  const body = await request.json();

  const response = await fetch(`${DAAS_URL}/items/${collection}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
```

### Step 8: Add Playwright Tests

```typescript
// tests/microfrontend/iframe-composition.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Micro-Frontend Iframe Composition', () => {
  test('Main App renders iframe with correct src', async ({ page }) => {
    await page.goto('/admin/users');
    const iframe = page.locator('iframe[title="Users Management"]');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toContain('/users');
  });

  test('iframe loads micro-app content', async ({ page }) => {
    await page.goto('/admin/users');
    const iframe = page.locator('iframe[title="Users Management"]');
    const frame = iframe.contentFrame();
    // Wait for micro-app to render
    await expect(frame!.locator('body')).toBeVisible();
  });

  test('URL syncs from micro-app to host', async ({ page }) => {
    await page.goto('/admin/users');
    const iframe = page.locator('iframe[title="Users Management"]');
    const frame = iframe.contentFrame();

    // Simulate search in micro-app
    await frame!.locator('[data-testid="search-input"]').fill('john');
    // Wait for debounced URL sync
    await page.waitForTimeout(500);
    expect(page.url()).toContain('search=john');
  });

  test('navigation changes iframe src', async ({ page }) => {
    await page.goto('/admin/users');
    const iframe = page.locator('iframe');

    // Navigate to different section
    await page.click('a[href="/admin/settings"]');
    await page.waitForURL('/admin/settings');

    const newSrc = await iframe.getAttribute('src');
    expect(newSrc).toContain('/settings');
  });

  test('logout in Main App clears session for all', async ({ page }) => {
    await page.goto('/admin/users');
    // Trigger logout in Main App
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('/auth/login');
  });
});
```

## File Structure (Main App)

```
my-app/                                    # Main App
├── app/
│   ├── admin/
│   │   ├── layout.tsx                     # AdminShell (nav + shell)
│   │   ├── dashboard/
│   │   │   └── page.tsx                   # Main App's own dashboard page
│   │   ├── users/
│   │   │   └── page.tsx                   # MicroappIframe → Users micro-app
│   │   └── billing/
│   │       └── page.tsx                   # MicroappIframe → Billing micro-app
│   ├── api/
│   │   ├── auth/                          # Auth proxy routes
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── user/route.ts
│   │   │   └── callback/route.ts
│   │   └── items/[collection]/route.ts    # DaaS proxy (same backend)
│   └── auth/
│       └── login/page.tsx                 # Login page
├── components/
│   └── MicroappIframe.tsx                 # Reusable iframe wrapper
├── config/
│   └── app-urls.ts                        # Deployed URLs (committed to git)
├── middleware.ts                           # Auth middleware
├── .env.local                             # Infrastructure secrets only
└── tests/
    └── microfrontend/
        └── iframe-composition.spec.ts
```

## File Structure (Micro-App)

```
users-microapp/                            # Independent micro-app
├── app/
│   ├── users/
│   │   ├── page.tsx                       # Users list page
│   │   └── [id]/page.tsx                  # User detail page
│   ├── api/
│   │   ├── auth/                          # Own auth proxy routes
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── user/route.ts
│   │   │   └── set-session/route.ts       # Cross-domain auth bridge (Amplify)
│   │   └── items/[collection]/route.ts    # DaaS proxy (SAME backend as Main App)
├── hooks/
│   └── useQueryParamSync.ts               # URL sync via postMessage
├── config/
│   └── app-urls.ts                        # Host origin URL (committed to git)
├── lib/
│   └── auth-guard.ts                      # Auth expiration notifier
├── middleware.ts                           # Session validation
├── .env.local                             # Infrastructure secrets only
└── tests/
    └── users.spec.ts
```

## Deployment Automation

### Automated Deploy via Git Push

After scaffolding and configuring a micro-app, deploy it by pushing to git. Amplify triggers a build on push to `main`:

```bash
# Inside the micro-app directory
cd /path/to/{{microappName}}

# Initialize git if not already a repo
git init
git remote add origin {{microservice.gitUrl}}

# Commit and push to trigger Amplify deployment
git add .
git commit -m "feat: initial {{microappName}} microfrontend scaffold"
git push -u origin main
```

### Update Main App After New Micro-App

When adding a new micro-app, the Main App needs:
1. A new entry in `config/app-urls.ts` with the micro-app's Amplify URL as default
2. A new page under `app/admin/{{route}}/page.tsx` with `MicroappIframe` (importing URL from config)
3. A new nav entry in `AdminShell`

```bash
cd /path/to/main-app
# config/app-urls.ts already updated with the new micro-app URL
# Commit and push — Amplify builds with URLs baked into codebase
git add .
git commit -m "feat: add {{microappName}} microfrontend integration"
git push origin main
```

**Agent rule:** After pushing, note that Amplify deployments take 2-5 minutes. No manual Amplify console env var changes are needed — the micro-app URL is baked into `config/app-urls.ts` in the codebase.

### Amplify Build Spec

Every micro-app includes an `amplify.yml`:

```yaml
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

### End-to-End Automated Workflow Summary

The complete agent workflow with zero user input for URLs/credentials:

```
1. get_project_detail → discover all context (URLs, credentials, microservices)
2. Validate critical values exist (daasUrl, supabaseUrl, mainAmplifyUrl)
3. Check if micro-app already exists in microservices[]
   ├── Exists → clone gitUrl, configure, continue development
   └── New → bootstrap project
4. Auto-generate .env.local from context (no placeholders)
5. Create MicroappIframe component (with MICROAPP_NEEDS_AUTH handler — always include)
6. Create host route pages in Main App for each microservice
7. Implement auth bridge in every micro-app (set-session route + iframe-aware login page)
8. Set up URL syncing, API proxy routes
9. Write tests
10. git push micro-app → Amplify deploys automatically
11. Update Main App with new iframe integration → push → deploy
```

## Security Boundaries

| Boundary            | Implementation                                         |
| ------------------- | ------------------------------------------------------ |
| DOM isolation       | iframe sandbox — Main App cannot access micro-app DOM   |
| CSS isolation       | iframe — styles do not leak between apps                |
| JS isolation        | Separate execution contexts per iframe                  |
| Communication       | `postMessage` with origin validation only               |
| Auth                | Shared Supabase session cookie (same domain)            |
| Data                | Single shared DaaS backend — access controlled via RBAC |
| Deployment          | Independent deployments (Amplify)                       |

## References

- [Context discovery & auto-configuration](references/context-discovery.instructions.md)
- [Iframe composition patterns](references/iframe-composition.instructions.md)
- [URL syncing deep dive](references/url-syncing.instructions.md)
- [Auth syncing patterns](references/auth-syncing.instructions.md)

````
`````
