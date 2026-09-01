---
name: add-microfrontend
description: Set up a micro-frontend architecture using client-side iframe composition. Creates a Main App that hosts independent micro-apps via iframes with shared authentication (Supabase session cookies), browser URL syncing via postMessage, shared DaaS backend, and isolated rendering. Use when the user says add-microfrontend, micro-frontend, iframe composition, or needs to embed independent apps.
argument-hint: "[microapp name] [host route, e.g. /admin/dashboard]"
---

# Add Micro-Frontend (Iframe Composition)

Set up a **client-side composition** architecture where a **Main App** hosts independent **micro-apps** via sandboxed iframes. All apps share a **single DaaS backend** and **single Supabase Auth instance**. Each micro-app is a standalone Next.js application with its own SSR, routing, and state — composed at the browser level.

## Critical Rules

1. **Iframe-Based Composition**: Micro-apps are loaded via `<iframe>` elements. The Main App manages layout, navigation, and iframe `src` attributes. Each micro-app renders independently inside its iframe sandbox.
2. **Auth Token Bridge (the default)**: The Main App owns the session and owns token refresh. Each micro-app holds a short-lived **access token** in its own cookie, on its own origin, obtained over the postMessage bridge. Micro-apps never hold a refresh token and never implement their own login flow. The bridge is required on Amplify, on a custom domain, and in local development — `localhost:3000` and `localhost:3001` are different origins. A shared parent-domain cookie is an optional extra on a custom domain, never a replacement.
3. **No Direct DOM Access**: The Main App MUST NOT reach into iframe DOM, and micro-apps MUST NOT access `window.parent` DOM. Communication happens ONLY via `postMessage` with strict origin validation.
4. **URL Sync via postMessage**: When micro-app query params change (e.g., search, filters), the micro-app posts a message to the host. The host updates its own URL bar to keep URLs in sync. Only explicitly allowlisted params are synced.
5. **Independent Deployments**: Each micro-app is deployed independently (e.g., via AWS Amplify). Main App only holds the iframe `src` URLs — never bundles micro-app code.
6. **SSR for Both Layers**: Both Main App pages and micro-app pages use Next.js SSR. The Main App renders the shell layout server-side; the iframe triggers a separate SSR request for the micro-app.
7. **Auth Routes in Every App**: Both the Main App and each micro-app have their own `/api/auth/*` routes. Every micro-app additionally needs `set-session` (accepts a host token), `logout` (clears its own cookies), and `token` (hands the stored token to `DaaSProvider`). Each app validates independently in server-side middleware.
8. **Sandbox Security**: Iframes use `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` to restrict capabilities while allowing necessary functionality.
9. **Single Shared DaaS Backend**: All apps (Main App + micro-apps) MUST share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There is only ONE DaaS backend instance. **Buildpad UI components call DaaS directly** through `DaaSProvider` (which sends `Authorization: Bearer <supabase-jwt>` and `X-Resource-Uri`); **hand-written fetches go through a proxy route in the same app**. This is the same split as [authentication-proxy](../authentication-proxy/SKILL.md). Do not generate `/api/items/[collection]/route.ts` unless the app has hand-written data calls. Set `CORS_ORIGINS` in the DaaS `.env` to include all app origins.
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
│ own cookie  │  │ own cookie  │  │ own cookie  │
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
                  Micro-App components → Single shared DaaS Backend → Supabase DB
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
- **`microapps[]`** — list of existing micro-apps with `name`, `gitUrl`, `amplifyUrl`

**Validation:** If any critical value (`daasUrl`, `supabaseUrl`, `mainAmplifyUrl`) is null, report it to the user with a specific remediation step. Do NOT proceed with placeholder values.

The `microapps[].amplifyUrl` values are the iframe `src` URLs — these are the deployed Amplify URLs for each micro-app. The `project.mainAmplifyUrl` is the host origin for postMessage security.

See [Context Discovery reference](references/context-discovery.instructions.md) for the full response schema and derivation rules.

### Step 1: Create the MicroappIframe Component (Main App)

Create a reusable iframe wrapper component in the Main App:

```typescript
// components/MicroappIframe.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton, Alert, Button, Stack } from '@mantine/core';

interface MicroappIframeProps {
  /** Base URL of the micro-app (e.g., https://microapp.example.com) */
  src: string;
  /** Title for accessibility */
  title: string;
  /** Route path within the micro-app (e.g., /users) */
  path?: string;
  /** Query params that may cross the boundary in either direction */
  allowedParams?: string[];
  /** iframe sandbox permissions */
  sandbox?: string;
  /** Height of the iframe (default: 100%) */
  height?: string;
  /** Allowed origin for postMessage validation */
  allowedOrigin?: string;
  /** Show the error state if MICROAPP_LOADED has not arrived by then */
  loadTimeoutMs?: number;
}

/** Read the scope cookie that DaaSProvider.getHeaders forwards as X-Resource-Uri. */
function readScopeCookie(): string | undefined {
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('daas_resource_uri='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : undefined;
}

/** Keep only the allowlisted keys, dropping empty values. */
function pickParams(params: Record<string, string> | URLSearchParams, allowed: string[]) {
  const source = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  const out: Record<string, string> = {};
  for (const key of allowed) {
    if (source[key]) out[key] = source[key];
  }
  return out;
}

/** A stable string for a param set, used to compare two sets for equality. */
function serializeParams(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) search.set(key, params[key]);
  return search.toString();
}

export function MicroappIframe({
  src,
  title,
  path = '/',
  allowedParams = [],
  sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups',
  height = '100%',
  allowedOrigin,
  loadTimeoutMs = 15000,
}: MicroappIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const resolvedOrigin = allowedOrigin || new URL(src).origin;

  const allowedRef = useRef(allowedParams);
  allowedRef.current = allowedParams;

  // Freeze the params that were on the host URL at mount.
  const initialParamsRef = useRef<Record<string, string> | null>(null);
  if (initialParamsRef.current === null) {
    initialParamsRef.current = pickParams(new URLSearchParams(searchParams.toString()), allowedParams);
  }

  /**
   * CRITICAL: `src` depends on `src` and `path` ONLY.
   *
   * Never read `searchParams` here. Doing so creates a loop: the micro-app posts
   * QUERY_PARAMS_CHANGE, the host calls router.replace(), searchParams changes, the
   * computed src changes, React writes the new src attribute, and the browser reloads
   * the frame. Every debounced keystroke would remount the micro-app and drop focus.
   *
   * Host-side param changes travel as SET_QUERY_PARAMS messages instead.
   */
  const iframeSrc = useMemo(() => {
    const url = new URL(path, src);
    for (const [key, value] of Object.entries(initialParamsRef.current ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }, [src, path]);

  // The last param set that came UP from the micro-app, used to drop the echo.
  const lastFromMicroappRef = useRef(serializeParams(initialParamsRef.current ?? {}));
  const loadedRef = useRef(false);

  const sendToMicroapp = useCallback(
    (message: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(message, resolvedOrigin);
    },
    [resolvedOrigin],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // SECURITY: Validate origin
      if (event.origin !== resolvedOrigin) return;

      if (event.data?.type === 'MICROAPP_LOADED') {
        loadedRef.current = true;
        setIsLoading(false);
        setHasError(false);

        // The host URL may have moved while the frame was loading. The frame only
        // ever saw the params baked into its src.
        const current = pickParams(new URLSearchParams(window.location.search), allowedRef.current);
        if (serializeParams(current) !== lastFromMicroappRef.current) {
          sendToMicroapp({ type: 'SET_QUERY_PARAMS', params: current });
        }
      }

      if (event.data?.type === 'QUERY_PARAMS_CHANGE') {
        const params = event.data.params;
        if (typeof params !== 'object' || params === null) return;

        const filtered = pickParams(params as Record<string, string>, allowedRef.current);
        lastFromMicroappRef.current = serializeParams(filtered);

        const next = new URLSearchParams(window.location.search);
        for (const key of allowedRef.current) {
          if (filtered[key]) next.set(key, filtered[key]);
          else next.delete(key);
        }
        const queryString = next.toString();
        router.replace(window.location.pathname + (queryString ? `?${queryString}` : ''), {
          scroll: false,
        });
      }

      /**
       * Cross-domain auth bridge. The HOST OWNS REFRESH.
       *
       * SET_AUTH carries access_token + expires_at only. It must NEVER carry
       * refresh_token: Supabase rotates refresh tokens, and if the host and N
       * micro-apps each hold the same one, they each refresh independently. The
       * first wins and the rest reuse a consumed token, which Supabase treats as
       * possible theft and answers by revoking the whole session family — a forced
       * sign-out of every app about an hour after sign-in.
       *
       * There is no AUTH_EXPIRED message. A frame whose token expired sends
       * MICROAPP_NEEDS_AUTH again, and getSession() below refreshes on the host.
       */
      if (event.data?.type === 'MICROAPP_NEEDS_AUTH') {
        import('@/lib/supabase/client').then(({ createClient }) => {
          const supabase = createClient();
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              // Only the host losing its session is a reason to go to login.
              router.push('/auth/login');
              return;
            }
            sendToMicroapp({
              type: 'SET_AUTH',
              access_token: session.access_token,
              expires_at: session.expires_at ?? 0,
              // The scope cookie is set on the HOST origin, so the micro-app origin
              // never receives it. Without this, every micro-app call resolves at
              // root scope and DaaS answers 403 on any project using scopes.
              resource_uri: readScopeCookie(),
            });
          });
        });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resolvedOrigin, router, sendToMicroapp]);

  // Host URL changes travel DOWN as a message, never as a new src.
  useEffect(() => {
    const current = pickParams(new URLSearchParams(searchParams.toString()), allowedRef.current);
    if (serializeParams(current) === lastFromMicroappRef.current) return; // echo, skip
    if (!loadedRef.current) return; // the frame reads its own URL on first load
    sendToMicroapp({ type: 'SET_QUERY_PARAMS', params: current });
  }, [searchParams, sendToMicroapp]);

  /**
   * Load watchdog.
   *
   * `<iframe onError>` does NOT fire for HTTP errors, network failures, or a frame
   * blocked by CSP: a cross-origin load failure is opaque to the host. The only
   * reliable failure signal is the absence of MICROAPP_LOADED.
   */
  useEffect(() => {
    loadedRef.current = false;
    setIsLoading(true);
    setHasError(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) {
        setHasError(true);
        setIsLoading(false);
      }
    }, loadTimeoutMs);
    return () => clearTimeout(timer);
  }, [iframeSrc, loadTimeoutMs, attempt]);

  const retry = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = iframeSrc;
    setAttempt((value) => value + 1);
  }, [iframeSrc]);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      {isLoading && (
        <Skeleton height="100%" width="100%" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      )}
      {hasError && (
        <Alert color="red" title="This section did not load" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <Stack align="flex-start" gap="sm">
            <span>The embedded application did not respond.</span>
            <Button size="xs" variant="light" onClick={retry}>Try again</Button>
          </Stack>
        </Alert>
      )}
      {/* The iframe stays mounted in the error state so that retry can reuse the ref. */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title={title}
        sandbox={sandbox}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: isLoading || hasError ? 'none' : 'block',
        }}
      />
    </div>
  );
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

Each admin route page renders the iframe. Use the Amplify URL from `config/app-urls.ts` (committed to git, auto-generated from `get_project_detail` → `microapps[].amplifyUrl`):

```typescript
// app/admin/users/page.tsx
import { MicroappIframe } from '@/components/MicroappIframe';
import { MICROAPP_URLS } from '@/config/app-urls';

export default function AdminUsersPage() {
  return (
    <MicroappIframe
      src={MICROAPP_URLS['users-app']}
      path="/users"
      title="Users Management"
      allowedParams={['search', 'page', 'sort', 'status']}
      height="calc(100vh - 100px)"
    />
  );
}
```

**Agent rule:** When generating these pages, iterate over the actual `microapps[]` array from context. For each microapp, create a page under `app/admin/{{route}}/page.tsx` with the iframe pointing to that microapp's Amplify URL via env var.

### Step 4: Create the Bridge Provider and useQueryParamSync Hook (Micro-App)

**1. `components/MicroappBridgeProvider.tsx`** — mount this in the micro-app **root**
layout. It owns the MICROAPP_LOADED signal and applies host-to-micro-app messages.

Do not put the MICROAPP_LOADED sender in `useQueryParamSync`. A page that does not use
that hook would never report that it loaded, and the host would show its error state.

```typescript
// components/MicroappBridgeProvider.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HOST_ORIGIN } from '@/config/app-urls';

/** The last param set the host pushed down, so the hook does not echo it back. */
export const lastFromHostRef = { current: '' };

export function isFramed() {
  return typeof window !== 'undefined' && window.parent !== window;
}

export function postToHost(message: Record<string, unknown>) {
  if (!isFramed()) return;
  window.parent.postMessage(message, HOST_ORIGIN);
}

function serializeParams(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) search.set(key, params[key]);
  return search.toString();
}

export function MicroappBridgeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Tell the host this frame is alive. The host hides its skeleton on this message
  // and shows its error state if it never arrives.
  useEffect(() => {
    postToHost({ type: 'MICROAPP_LOADED' });
  }, []);

  useEffect(() => {
    if (!isFramed()) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== HOST_ORIGIN) return;

      if (event.data?.type === 'SET_QUERY_PARAMS') {
        const params = event.data.params;
        if (typeof params !== 'object' || params === null) return;

        lastFromHostRef.current = serializeParams(params as Record<string, string>);
        const queryString = new URLSearchParams(params as Record<string, string>).toString();
        // replace, not push: host-driven changes must not grow the joint history.
        router.replace(window.location.pathname + (queryString ? `?${queryString}` : ''), {
          scroll: false,
        });
      }

      if (event.data?.type === 'LOGOUT') {
        // The host cannot delete a cookie on this origin. Only this app can.
        void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  return <>{children}</>;
}
```

**2. `hooks/useQueryParamSync.ts`** — syncs one param set up to the host:

```typescript
// hooks/useQueryParamSync.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { lastFromHostRef, postToHost } from '@/components/MicroappBridgeProvider';

function serializeParams(params: Record<string, string>) {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) search.set(key, params[key]);
  return search.toString();
}

export function useQueryParamSync({ debounceMs = 300 }: { debounceMs?: number } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateQueryParams = useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }

      const queryString = next.toString();
      // replace, not push: every keystroke would otherwise add a history entry.
      router.replace(pathname + (queryString ? `?${queryString}` : ''), { scroll: false });

      const asRecord = Object.fromEntries(next.entries());
      // Drop the echo: this exact set arrived from the host a moment ago.
      if (serializeParams(asRecord) === lastFromHostRef.current) return;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        postToHost({ type: 'QUERY_PARAMS_CHANGE', params: asRecord });
      }, debounceMs);
    },
    [searchParams, pathname, router, debounceMs],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return { updateQueryParams, searchParams };
}
```


### Step 5: Auth Syncing Setup

> **⚠️ Cross-Domain Auth (Amplify Deployments)**
> On AWS Amplify every app gets a randomly-assigned subdomain like `main.d1a2b3.amplifyapp.com`. Because `amplifyapp.com` is a public suffix, **Supabase cookies set on the Main App domain are completely invisible to the micro-app domain**. The micro-app middleware sees no session and redirects to `/login` — the user appears to need to log in again even though they already authenticated in the Main App.
>
> **Fix: implement the postMessage auth token bridge** (see the full pattern in [auth-syncing.instructions.md](references/auth-syncing.instructions.md)):
> 1. Micro-app `/login` page detects it is inside an iframe → sends `MICROAPP_NEEDS_AUTH` to host
> 2. `MicroappIframe` responds with `SET_AUTH { access_token, expires_at, resource_uri }` (Step 1)
> 3. Micro-app calls `/api/auth/set-session` → its own `httpOnly` token cookie is established
> 4. Micro-app redirects to `DEFAULT_AUTHENTICATED_ROUTE` — no user action required
> 5. Before the token expires, the micro-app sends `MICROAPP_NEEDS_AUTH` again
>
> **The bridge is the default deployment model, not an Amplify workaround.** It is
> also required in local development: `localhost:3000` and `localhost:3001` are
> different origins. On a custom domain a shared parent-domain cookie can be added on
> top, but the bridge still works and stays the documented path.

**Set up the auth bridge in every micro-app:**

**1. Create `/api/auth/set-session/route.ts`:**

```typescript
// app/api/auth/set-session/route.ts
// The host owns refresh. This route never receives or stores a refresh token.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const MFE_TOKEN_COOKIE = 'mfe_access_token';
export const MFE_EXPIRES_COOKIE = 'mfe_expires_at';

export async function POST(request: NextRequest) {
  let body: { access_token?: string; expires_at?: number; resource_uri?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { access_token, expires_at, resource_uri } = body;
  if (!access_token || typeof expires_at !== 'number') {
    return NextResponse.json({ error: 'Missing access_token or expires_at' }, { status: 400 });
  }

  // This route is public: anything on the page can call it. Only a token the Auth
  // server accepts may set a cookie.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const maxAge = Math.max(Math.floor(expires_at - Date.now() / 1000), 0);

  // SameSite=None is required: these are set and read inside a cross-site frame.
  cookieStore.set(MFE_TOKEN_COOKIE, access_token, {
    httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge,
  });
  cookieStore.set(MFE_EXPIRES_COOKIE, String(expires_at), {
    httpOnly: false, secure: true, sameSite: 'none', path: '/', maxAge,
  });
  // Scope must cross the origin, or every call resolves at root scope → 403.
  if (resource_uri) {
    cookieStore.set('daas_resource_uri', resource_uri, {
      httpOnly: false, secure: true, sameSite: 'none', path: '/', maxAge,
    });
  }

  return NextResponse.json({ success: true });
}
```

**1b. Create `/api/auth/token/route.ts`** — the micro-app has no Supabase session, so
`DaaSProviderWrapper` cannot call `getSession()`. It reads the token from here instead.
Do NOT add this route to `PUBLIC_ROUTES`: the middleware must validate the cookie first.

```typescript
// app/api/auth/token/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('mfe_access_token')?.value;
  const expiresAt = Number(cookieStore.get('mfe_expires_at')?.value ?? 0);

  if (!accessToken) {
    return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
  }

  return NextResponse.json(
    { access_token: accessToken, expires_at: expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

**2. Define ONE route table in `lib/supabase/middleware.ts`:**

Every route name in the micro-app must come from this file. A redirect target that
does not match the file structure is the classic cause of a redirect loop inside the
frame.

```typescript
// lib/supabase/middleware.ts
export const LOGIN_ROUTE = '/login';

export const PUBLIC_ROUTES = [
  LOGIN_ROUTE,
  '/api/auth/set-session',
  '/api/auth/logout',
];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
```

The middleware matcher must exclude static assets only. Do NOT try to exclude auth
routes by prefix: `/api/auth/set-session` starts with `api`, not `auth`, so a prefix
rule lets the middleware run on the bridge call itself and redirect it.

**3. Update the micro-app login page (`app/login/page.tsx`) to handle iframe auth:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_AUTHENTICATED_ROUTE, HOST_ORIGIN } from '@/config/app-urls';
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

      const { access_token, expires_at, resource_uri } = event.data;
      try {
        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, expires_at, resource_uri }),
        });
        if (res.ok) {
          // replace, not href: the failed /login attempt must not stay in history.
          // DEFAULT_AUTHENTICATED_ROUTE comes from config/app-urls.ts. Set it to this
          // micro-app's own first route. Never hardcode a route here.
          window.location.replace(DEFAULT_AUTHENTICATED_ROUTE);
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

**Main App logout does NOT clear micro-app sessions on its own.**

On Amplify each micro-app sets its own cookie on its own origin. The Main App cannot
delete a cookie it does not own. `signOut()` revokes the refresh tokens server-side,
but the micro-app access tokens stay valid until they expire — up to one hour.

The host must broadcast `LOGOUT` to every mounted frame **before** it signs out, and
each micro-app must clear its own cookies.

**1. Main App: keep a registry of mounted frames and broadcast before signing out.**

```typescript
// components/MicroappIframe.tsx — module scope, alongside the component
type Frame = { window: Window; origin: string };
const frames = new Set<Frame>();

export function broadcastToMicroapps(message: Record<string, unknown>) {
  for (const frame of frames) frame.window.postMessage(message, frame.origin);
}

/** Push a new tenant/scope to every mounted micro-app. Call after a scope switch. */
export function broadcastScope(resourceUri: string) {
  broadcastToMicroapps({ type: 'SET_SCOPE', resource_uri: resourceUri });
}

export async function logoutAllMicroapps() {
  broadcastToMicroapps({ type: 'LOGOUT' });
  // Give each frame one tick to fire its own /api/auth/logout request.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// ...and inside the component, register the frame while it is mounted:
useEffect(() => {
  const target = iframeRef.current?.contentWindow;
  if (!target) return;
  const frame: Frame = { window: target, origin: resolvedOrigin };
  frames.add(frame);
  return () => { frames.delete(frame); };
}, [resolvedOrigin, iframeSrc]);
```

The logout button calls `logoutAllMicroapps()` first, then `POST /api/auth/logout`.
Never call the host logout route on its own.

```typescript
// Main App: app/api/auth/logout/route.ts
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Bug 20: a stale scope cookie is forwarded as X-Resource-Uri for the next user.
  (await cookies()).delete('daas_resource_uri');

  return NextResponse.json({ success: true });
}
```

**2. Every micro-app needs its own logout route** (public, and handled by
`MicroappBridgeProvider` on the `LOGOUT` message):

```typescript
// Micro-app: app/api/auth/logout/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MFE_EXPIRES_COOKIE, MFE_TOKEN_COOKIE } from '../set-session/route';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(MFE_TOKEN_COOKIE);
  cookieStore.delete(MFE_EXPIRES_COOKIE);
  // Bug 20: a stale scope cookie is forwarded as X-Resource-Uri for the next user
  // and causes an immediate 403 FORBIDDEN_SCOPE.
  cookieStore.delete('daas_resource_uri');

  return NextResponse.json({ success: true });
}
```

**3. Test it.** Sign out in the Main App, then load a micro-app route directly. If it
still renders authenticated content, the access token is still accepted by the Auth
server — shorten the JWT expiry for the project.

**Micro-app middleware checks session on every SSR request:**

```typescript
// Micro-app: middleware.ts
// The micro-app has no Supabase session of its own. It validates the access token
// that the host handed it over the bridge.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip the public routes from the ONE route table above.
  if (isPublic(pathname)) return NextResponse.next({ request });

  const token = request.cookies.get('mfe_access_token')?.value;
  if (token) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    // getUser, never getSession: getUser validates the token against the Auth server
    // on every request, so a sign-out that happened in the Main App is observed here.
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return NextResponse.next({ request });
  }

  const loginUrl = new URL(LOGIN_ROUTE, request.url);
  loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Static assets only. Never exclude auth routes by prefix here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Micro-app renews its token before it expires.**

There is no `AUTH_EXPIRED` message. Ejecting the user to the host login page was wrong:
only the micro-app's copy of the session had failed, while the host session was still
valid. A frame that needs a token simply asks for one again.

Add this to `MicroappBridgeProvider` (Step 4). It must run on a plain page load too,
because the handshake happens on `/login` and is followed by a full navigation.

```typescript
// components/MicroappBridgeProvider.tsx — inside the message effect
function scheduleRenewal(expiresAt: number) {
  clearTimeout(renewalTimerRef.current);
  const leadMs = expiresAt * 1000 - Date.now() - 60_000;
  if (leadMs <= 0) {
    postToHost({ type: 'MICROAPP_NEEDS_AUTH' });
    return;
  }
  renewalTimerRef.current = setTimeout(() => {
    postToHost({ type: 'MICROAPP_NEEDS_AUTH' });
  }, leadMs);
}

// On mount, pick up the deadline left by the previous page load.
const storedExpiry = Number(
  document.cookie.split('; ').find((r) => r.startsWith('mfe_expires_at='))?.split('=')[1] ?? 0,
);
if (storedExpiry) scheduleRenewal(storedExpiry);

// SET_AUTH handler: store the token, then re-arm.
if (event.data?.type === 'SET_AUTH') {
  const { access_token, expires_at, resource_uri } = event.data;
  const res = await fetch('/api/auth/set-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token, expires_at, resource_uri }),
  });
  if (res.ok) {
    scheduleRenewal(expires_at);
    router.refresh();
  }
}

// SET_SCOPE handler: the host switched tenant.
if (event.data?.type === 'SET_SCOPE') {
  document.cookie =
    `daas_resource_uri=${encodeURIComponent(event.data.resource_uri)}; path=/; SameSite=None; Secure`;
  router.refresh();
}
```

**Micro-app `DaaSProviderWrapper` reads the token from `/api/auth/token`**, not from a
Supabase browser client. Every other rule in
[daas-platform](../daas-platform/SKILL.md) still applies: put the wrapper in
`app/(authenticated)/layout.tsx`, pass `token` as a sync prop, gate `ready` on a
non-null token, and keep `getHeaders` reading the `daas_resource_uri` cookie.

> **Confirm the refresh model against your Supabase version.** Sign in, wait for the
> access token to expire, then use the host and two micro-apps. All three must stay
> signed in. If they do not, the bridge is still leaking a refresh token somewhere.

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

/** Microapp deployed URLs (used as iframe src in the Main App) */
export const MICROAPP_URLS = {
  {{#each microapps}}
  '{{name}}': process.env.NEXT_PUBLIC_{{UPPERCASE(name)}}_URL || '{{amplifyUrl}}',
  {{/each}}
} as const;

export type MicroappKey = keyof typeof MICROAPP_URLS;
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
> Write the actual resolved values into `config/app-urls.ts` as the default fallbacks, and write the actual infrastructure values into `.env.local`. The env var override name for microapps is `NEXT_PUBLIC_` + name uppercased with hyphens as underscores + `_URL` (e.g., `users-app` → `NEXT_PUBLIC_USERS_APP_URL`).

### Step 7: Proxy Routes for Your Own Code (Only If Needed)

Buildpad UI components (`CollectionList`, `VForm`) call DaaS **directly** from the
browser through `DaaSProvider`, which supplies the `Authorization: Bearer` and
`X-Resource-Uri` headers. They must not be proxied.

Hand-written `fetch` calls in your own code go through a Next.js proxy route in the
same app, exactly as in
[authentication-proxy](../authentication-proxy/SKILL.md).

**Do not generate `app/api/items/[collection]/route.ts` unless the app actually has
hand-written data calls.** Generating it by default adds a layer that the Buildpad
components never use, and it contradicts the direct-call rule.


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
│   │   └── items/[collection]/route.ts    # ONLY if this app has hand-written fetches
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
│   │   │   ├── set-session/route.ts       # Accepts the host access token
│   │   │   ├── token/route.ts             # Hands the token to DaaSProviderWrapper
│   │   │   └── logout/route.ts            # Clears THIS app's own cookies on LOGOUT
│   │   └── items/[collection]/route.ts    # ONLY if this app has hand-written fetches
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
git remote add origin {{microapp.gitUrl}}

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
1. get_project_detail → discover all context (URLs, credentials, microapps)
2. Validate critical values exist (daasUrl, supabaseUrl, mainAmplifyUrl)
3. Check if micro-app already exists in microapps[]
   ├── Exists → clone gitUrl, configure, continue development
   └── New → bootstrap project
4. Auto-generate .env.local from context (no placeholders)
5. Create MicroappIframe component (with MICROAPP_NEEDS_AUTH handler — always include)
6. Create host route pages in Main App for each microapp
7. Implement auth bridge in every micro-app (set-session + token + logout routes, iframe-aware login page, renewal timer)
8. Set up URL syncing (proxy routes only if the app has hand-written fetches)
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
| Auth                | Host-owned session; per-origin access token via bridge  |
| Data                | Single shared DaaS backend — access controlled via RBAC |
| Deployment          | Independent deployments (Amplify)                       |

## References

- [Context discovery & auto-configuration](references/context-discovery.instructions.md)
- [Iframe composition patterns](references/iframe-composition.instructions.md)
- [URL syncing deep dive](references/url-syncing.instructions.md)
- [Auth syncing patterns](references/auth-syncing.instructions.md)

````
`````
