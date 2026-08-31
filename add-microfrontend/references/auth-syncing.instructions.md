````markdown
# Auth Syncing Patterns

## Overview

In the iframe micro-frontend architecture, the **Main App owns the session and owns token refresh**. Each micro-app holds a short-lived **access token** in its own cookie, on its own origin, obtained over the postMessage bridge. Micro-apps never hold a refresh token, never run a login form, and re-request a token before the current one expires. All apps share a **single DaaS backend** — auth decides what collections and records the user can reach.

## Rule: the host owns refresh

`SET_AUTH` carries `access_token` and `expires_at`. It must **never** carry `refresh_token`.

Supabase rotates refresh tokens. A consumed refresh token is accepted again only inside the reuse interval (default 10 seconds). A later reuse is treated as possible theft, and Supabase can revoke the whole session family.

If the host and three micro-apps each hold the same refresh token, each refreshes on its own when the access token expires. The first wins; the others present a consumed token. The result is a forced sign-out of every app about an hour after sign-in.

With host-owned refresh there is exactly one refresh client: the Main App browser client.

> **Confirm this against your Supabase version.** Sign in, wait for the access token to expire, then use the host and two micro-apps. All three must stay signed in.

## Rule: the scope header must cross the origin

`DaaSProvider.getHeaders` reads the `daas_resource_uri` cookie and sends it as `X-Resource-Uri`. That cookie is set on the **host** origin, so the micro-app origin never receives it on its own. Without the fix, every micro-app call on a project using `manage-scope` or `add-multitenancy` resolves at root scope and returns **403**.

1. The host reads its own `daas_resource_uri` cookie and puts the value in `SET_AUTH.resource_uri`.
2. `/api/auth/set-session` writes `daas_resource_uri` on the micro-app origin.
3. On a tenant switch the host broadcasts `SET_SCOPE`; each micro-app rewrites the cookie and calls `router.refresh()`.

The cookie must use `SameSite=None; Secure`. A `Lax` cookie is not sent inside a cross-site frame.

## ⚠️ Cross-Domain Auth Problem (Amplify Deployments)

> **This is the #1 cause of "why do I need to login again?" issues.**

When apps are deployed on **AWS Amplify**, each app gets a randomly assigned subdomain such as `main.d1a2b3c4.amplifyapp.com`. Since `amplifyapp.com` is a **public suffix** (like `github.io` or `vercel.app`), browsers treat every subdomain as a completely separate origin. Supabase cookies set on `main.do1a6erm.amplifyapp.com` are **not readable** by `main.dx9f3hqz.amplifyapp.com`, even though they share the same `amplifyapp.com` root.

```
Main App:   main.do1a6erm66nv9.amplifyapp.com   ← Supabase cookie set here
Micro-app:  main.dx9f3hqz1234.amplifyapp.com     ← Cannot read that cookie ❌

Result: micro-app middleware sees no session → redirects to /login
```

**The fix: postMessage-based auth token bridge.** The micro-app login page detects it is inside an iframe, asks the host for session tokens via postMessage, receives them, and calls `supabase.auth.setSession()` to establish its own cookie. No user interaction required.

```
1. Micro-app loads in iframe → middleware: no session → redirect to /login
2. Micro-app /login detects window.parent !== window → sends MICROAPP_NEEDS_AUTH to host
3. Main App MicroappIframe receives MICROAPP_NEEDS_AUTH → calls supabase.auth.getSession()
4. Main App sends SET_AUTH { access_token, expires_at, resource_uri } back to iframe
5. Micro-app receives SET_AUTH → POST /api/auth/set-session with the token
6. /api/auth/set-session validates it with getUser(token) → sets its own httpOnly cookie
7. Micro-app redirects to DEFAULT_AUTHENTICATED_ROUTE → fully authenticated ✅
8. Before expiry the micro-app sends MICROAPP_NEEDS_AUTH again; the host refreshes
```

### Cross-Domain Auth Bridge Implementation

**Micro-app: `/api/auth/set-session/route.ts`** (new route — must be public):

```typescript
// app/api/auth/set-session/route.ts
// The host owns refresh. This route never receives or stores a refresh token.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const MFE_TOKEN_COOKIE = "mfe_access_token";
export const MFE_EXPIRES_COOKIE = "mfe_expires_at";

export async function POST(request: NextRequest) {
  let body: { access_token?: string; expires_at?: number; resource_uri?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { access_token, expires_at, resource_uri } = body;
  if (!access_token || typeof expires_at !== "number") {
    return NextResponse.json(
      { error: "Missing access_token or expires_at" },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const maxAge = Math.max(Math.floor(expires_at - Date.now() / 1000), 0);

  // SameSite=None is required inside a cross-site frame.
  cookieStore.set(MFE_TOKEN_COOKIE, access_token, {
    httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge,
  });
  cookieStore.set(MFE_EXPIRES_COOKIE, String(expires_at), {
    httpOnly: false, secure: true, sameSite: "none", path: "/", maxAge,
  });
  if (resource_uri) {
    cookieStore.set("daas_resource_uri", resource_uri, {
      httpOnly: false, secure: true, sameSite: "none", path: "/", maxAge,
    });
  }

  return NextResponse.json({ success: true });
}
```

**Micro-app: `lib/supabase/middleware.ts`** — define ONE route table:

Every route name in the micro-app must come from this file. A redirect target that does
not match the file structure is the classic cause of a redirect loop inside the frame.

```typescript
// lib/supabase/middleware.ts
export const LOGIN_ROUTE = "/login";

export const PUBLIC_ROUTES = [
  LOGIN_ROUTE,
  "/api/auth/set-session",
  "/api/auth/logout",
];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// ...and in the middleware body:
if (isPublic(request.nextUrl.pathname)) return response;

const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
}
```

The matcher must exclude static assets only. Do NOT exclude auth routes by prefix:
`/api/auth/set-session` starts with `api`, not `auth`, so a prefix rule lets the
middleware run on the bridge call itself and redirect it.

```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Micro-app: `app/login/page.tsx`** — detect iframe context, request auth from host:

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

    // Ask the host app for session tokens
    window.parent.postMessage({ type: 'MICROAPP_NEEDS_AUTH' }, HOST_ORIGIN);

    // Listen for the host's SET_AUTH response
    async function handleMessage(event: MessageEvent) {
      if (event.origin !== HOST_ORIGIN) return;
      if (event.data?.type !== 'SET_AUTH') return;

      const { access_token, expires_at, resource_uri } = event.data;

      try {
        const response = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, expires_at, resource_uri }),
        });

        if (response.ok) {
          // replace, not href: the failed /login attempt must not stay in history.
          // DEFAULT_AUTHENTICATED_ROUTE comes from config/app-urls.ts. Never hardcode.
          window.location.replace(DEFAULT_AUTHENTICATED_ROUTE);
        } else {
          setIframeAuthFailed(true);
        }
      } catch {
        setIframeAuthFailed(true);
      }
    }

    window.addEventListener('message', handleMessage);

    // Fallback: after 3s with no response, show login form
    const fallbackTimeout = setTimeout(() => setIframeAuthFailed(true), 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Show spinner while waiting for host auth handshake
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

  // Fall through to your normal login form JSX for non-iframe or fallback
  return (
    // ... your existing login form ...
    <div>Login form</div>
  );
}
```

**Main App: `MicroappIframe.tsx`** — respond to `MICROAPP_NEEDS_AUTH`:

```typescript
// Add this inside the handleMessage useEffect in MicroappIframe
if (event.data?.type === "MICROAPP_NEEDS_AUTH") {
  import("@/lib/supabase/client").then(({ createClient }) => {
    const supabase = createClient();
    // getSession() refreshes here, on the host, when the access token is stale.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/auth/login"); // only the HOST losing its session goes to login
        return;
      }
      sendToMicroapp({
        type: "SET_AUTH",
        access_token: session.access_token,
        expires_at: session.expires_at ?? 0,
        resource_uri: readScopeCookie(), // never a refresh_token
      });
    });
  });
}
```

## Optional: Custom Domain (Shared Parent Cookie)

> **The bridge above is the default and works everywhere, including on a custom domain.** This section is an optional extra, not a replacement. Do not design around it: every Buildpad deployment in this skill uses Amplify, where it does not apply.

When apps are deployed on a **custom domain** (e.g., `my-app.example.com` and `microapp.example.com`), cookies can additionally be shared across subdomains by setting the cookie domain to `.example.com`.

```
Main App:   my-app.example.com
Micro-app:  microapp.example.com
Supabase:   your-project.buildpad-supabase.xtremax.com
DaaS:       your-project.buildpad-daas.xtremax.com  (shared by all)

Cookie domain: .example.com (shared)
```

## Auth Flow

### Login (Main App Only)

```
1. User navigates to /auth/login on Main App
2. User submits email/password
3. Main App POST /api/auth/login → Supabase Auth
4. Supabase sets session cookie (.example.com)
5. Main App redirects to /admin/dashboard
6. Iframe loads micro-app → session cookie sent automatically
7. Micro-app SSR validates session → renders authenticated page
8. Micro-app calls DaaS directly with Bearer token (CORS handled on DaaS side via CORS_ORIGINS)
```

### Logout (broadcast first, then sign out)

> **A Main App logout does NOT clear micro-app sessions on its own.** Each micro-app
> sets its own cookie on its own origin, and the host cannot delete a cookie it does
> not own. `signOut()` revokes the refresh tokens server-side, but the micro-app
> access tokens stay valid until they expire — up to one hour.

```
1. User clicks logout in Main App
2. Host broadcasts LOGOUT to every mounted MicroappIframe
3. Each micro-app POSTs its own /api/auth/logout
   → signOut({ scope: 'local' }) + delete daas_resource_uri (Bug 20)
4. Host waits ~300ms, then POST /api/auth/logout → Supabase Auth
5. Main App redirects to its login route
```

The order matters. If the host signs out first and the page unloads, the frames never
receive the message and their cookies survive until the token expires.

The micro-app middleware must use `supabase.auth.getUser()`, not `getSession()`.
`getUser()` validates the token against the Auth server on every request, so a
sign-out that happened elsewhere is observed. Test it: sign out in the host, then load
a micro-app route directly. If it still renders, shorten the project JWT expiry.

### Session Validation (Both Apps)

Both Main App and micro-apps validate sessions server-side on every SSR request:

The **Main App** validates its own Supabase session cookie. A **micro-app** has no Supabase session; it validates the access token the host handed it:

```typescript
// Micro-app middleware.ts
const token = request.cookies.get('mfe_access_token')?.value;
if (token) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  // getUser, never getSession: getUser validates against the Auth server on every
  // request, so a sign-out that happened in the Main App is observed here.
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) return NextResponse.next({ request });
}

return NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
```

## Token Renewal (no AUTH_EXPIRED)

There is no `AUTH_EXPIRED` message. Redirecting the host to login was wrong: only the micro-app's copy of the session had failed, while the host session was usually still valid.

The micro-app re-requests instead, one minute before its token expires, and again on any 401:

```typescript
// Micro-app: MicroappBridgeProvider
function scheduleRenewal(expiresAt: number) {
  clearTimeout(renewalTimerRef.current);
  const leadMs = expiresAt * 1000 - Date.now() - 60_000;
  if (leadMs <= 0) {
    postToHost({ type: "MICROAPP_NEEDS_AUTH" });
    return;
  }
  renewalTimerRef.current = setTimeout(
    () => postToHost({ type: "MICROAPP_NEEDS_AUTH" }),
    leadMs,
  );
}
```

This must also run on a plain page load: the handshake happens on `/login` and is followed by a full navigation, so the provider that scheduled the first renewal is gone by the time the real page renders. Read the deadline back from the `mfe_expires_at` cookie on mount.

Redirect to login only when the **host** `getSession()` returns null.

## Main App Auth Routes

The Main App provides the standard auth proxy routes:

```
POST /api/auth/login     → Supabase signInWithPassword
POST /api/auth/logout    → Supabase signOut
GET  /api/auth/user      → Supabase getUser
GET  /api/auth/callback  → OAuth callback handler
```

These are installed via `npx @buildpad/cli@latest add --with-api`.

## Micro-App Auth Routes

Each micro-app also has auth routes, primarily for:

- **Token intake**: `/api/auth/set-session` stores the host's access token; `/api/auth/token` hands it to `DaaSProviderWrapper`; `/api/auth/logout` clears it
- **Auth routes**: The micro-app's API routes (`/api/auth/*`) manage Supabase SSR cookies — these remain as Next.js server routes
- **Data access**: Buildpad components call DaaS directly via `buildUrl('/api/items/...')` + `getHeaders()` from `useDaaSContext()`. Hand-written fetches use a proxy route in the same app.

```typescript
// Micro-app: app/api/auth/user/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
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

  return NextResponse.json({ data: user });
}
```

## Cookie Configuration for Subdomains

If Main App and micro-app are on different subdomains, ensure cookies are set for the parent domain:

```typescript
// lib/supabase/server.ts
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, {
            ...options,
            domain: ".example.com", // Share across subdomains
          });
        });
      },
    },
  },
);
```

## Data Access with Shared DaaS

All apps share one DaaS backend, so the auth token decides what the user can reach.
DaaS enforces collection-level and record-level permissions by role, regardless of
which app made the request.

The call path follows the same split as
[authentication-proxy](../../authentication-proxy/SKILL.md):

| Caller                                            | Path                                          |
| ------------------------------------------------- | --------------------------------------------- |
| Buildpad UI components (`CollectionList`, `VForm`) | Direct to DaaS, through `DaaSProvider`.       |
| Your own hand-written fetches                      | Through a proxy route in the same app.        |

Do not create `/api/items/[collection]/route.ts` unless the app has hand-written data
calls. `DaaSProvider.getHeaders` is what sends `X-Resource-Uri` on the direct path;
a proxy route in front of a Buildpad component only adds a layer it never uses.

## Security Checklist

**Same-domain / custom domain deployments:**

- [ ] Main App and micro-apps share the same Supabase project URL and anon key
- [ ] All apps share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`
- [ ] Session cookies are set on a shared domain (or parent domain for subdomains)
- [ ] Micro-app middleware validates session on every SSR request
- [ ] Micro-app re-requests a token via MICROAPP_NEEDS_AUTH on 401 and before expiry
- [ ] The host redirects to login only when its OWN getSession() returns null
- [ ] `postMessage` origin is validated against allowlist
- [ ] Micro-apps never implement their own login form
- [ ] Host logout broadcasts `LOGOUT` to every mounted frame BEFORE it signs out
- [ ] Every micro-app has its own `/api/auth/logout` that deletes `daas_resource_uri`
- [ ] Micro-app middleware uses `getUser()`, never `getSession()`
- [ ] Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) are NEVER exposed to client code
- [ ] All API calls use `credentials: 'include'` for cookie forwarding
- [ ] DaaS RBAC controls which collections/records each role can access

**Amplify / cross-domain deployments (additional checks):**

- [ ] Micro-app login page detects iframe context (`window.parent !== window`) and sends `MICROAPP_NEEDS_AUTH` instead of showing the login form
- [ ] Main App `MicroappIframe` handles `MICROAPP_NEEDS_AUTH` and responds with `SET_AUTH` containing session tokens
- [ ] Micro-app has `/api/auth/set-session` route that calls `supabase.auth.setSession()`
- [ ] `/api/auth/set-session` and `/api/auth/logout` are in `PUBLIC_ROUTES`
- [ ] The middleware matcher excludes static assets only, never auth routes by prefix
- [ ] `DEFAULT_AUTHENTICATED_ROUTE` points at a route that exists in `app/`
- [ ] `SET_AUTH` postMessage validates the origin against `HOST_ORIGIN` from `config/app-urls.ts`
- [ ] Micro-app login page falls back to the standard login form after 3s if no `SET_AUTH` arrives (handles host-not-configured edge case)
- [ ] `SET_AUTH` carries `access_token` + `expires_at` only — never a refresh token
- [ ] `/api/auth/set-session` validates the token with `getUser(token)` before setting a cookie
- [ ] Token cookies use `httpOnly`, `Secure`, and `SameSite=None`
- [ ] `SET_AUTH` carries `resource_uri` on any project that uses scopes
- [ ] A tenant switch in the host broadcasts `SET_SCOPE` to every mounted frame
- [ ] `access_token` is never logged
````
