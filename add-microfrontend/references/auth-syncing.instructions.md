````markdown
# Auth Syncing Patterns

## Overview

In the iframe micro-frontend architecture, authentication is shared between the Main App and all micro-apps via **Supabase session cookies**. The Main App owns the login/logout flows; micro-apps validate the session on each request and notify the Main App if auth expires. All apps share a **single DaaS backend** — auth determines what collections and records the user can access.

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
4. Main App sends SET_AUTH { access_token, refresh_token } back to iframe
5. Micro-app receives SET_AUTH → POST /api/auth/set-session with the tokens
6. /api/auth/set-session calls supabase.auth.setSession() → sets auth cookies on micro-app domain
7. Micro-app redirects to the protected content → fully authenticated ✅
```

### Cross-Domain Auth Bridge Implementation

**Micro-app: `/api/auth/set-session/route.ts`** (new route — must be public):

```typescript
// app/api/auth/set-session/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "Missing access_token or refresh_token" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
```

**Micro-app: `middleware.ts`** — add `/api/auth/set-session` to public routes:

```typescript
// In lib/supabase/middleware.ts (or wherever publicRoutes is defined)
const publicRoutes = ["/login", "/api/auth/set-session"];
```

**Micro-app: `app/login/page.tsx`** — detect iframe context, request auth from host:

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

    // Ask the host app for session tokens
    window.parent.postMessage({ type: 'MICROAPP_NEEDS_AUTH' }, HOST_ORIGIN);

    // Listen for the host's SET_AUTH response
    async function handleMessage(event: MessageEvent) {
      if (event.origin !== HOST_ORIGIN) return;
      if (event.data?.type !== 'SET_AUTH') return;

      const { access_token, refresh_token } = event.data;

      try {
        const response = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token }),
        });

        if (response.ok) {
          // Session established — redirect to content
          window.location.href = '/content'; // or your default authenticated route
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
  // Get current Supabase session and send tokens to the micro-app
  import("@/lib/supabase/client").then(({ createClient }) => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "SET_AUTH",
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          resolvedOrigin,
        );
      }
    });
  });
}
```

## How It Works (Same-Domain / Custom Domain Setup)

When apps are deployed on a **custom domain** (e.g., `my-app.example.com` and `microapp.example.com`), cookies can be shared across subdomains by setting the cookie domain to `.example.com`. Supabase Auth sets HTTP-only cookies that are automatically sent with every request to same-origin endpoints.

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

### Logout (Main App Only)

```
1. User clicks logout in Main App
2. Main App POST /api/auth/logout → Supabase Auth
3. Supabase clears session cookie
4. Main App redirects to /auth/login
5. Any iframe refresh → no session → micro-app redirects to login
```

### Session Validation (Both Apps)

Both Main App and micro-apps validate sessions server-side on every SSR request:

```typescript
// middleware.ts (both Main App and micro-app)
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { getAll: () => request.cookies.getAll(), setAll: ... } },
);

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
```

## Auth Expiration Handling

When a micro-app detects that the session has expired during a client-side API call, it notifies the Main App via postMessage:

### Micro-App: Detect and Notify

```typescript
// lib/api-client.ts (micro-app)
export async function apiClient(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (response.status === 401) {
    // Session expired — notify Main App
    if (window.parent !== window) {
      // HOST_ORIGIN is imported from config/app-urls.ts
      window.parent.postMessage({ type: "AUTH_EXPIRED" }, HOST_ORIGIN);
    }
    throw new Error("Session expired");
  }

  return response;
}
```

### Main App: Handle Auth Expiration

```typescript
// Inside MicroappIframe component
useEffect(() => {
  function handleMessage(event: MessageEvent) {
    if (event.origin !== resolvedOrigin) return;

    if (event.data?.type === "AUTH_EXPIRED") {
      // Redirect to login
      router.push("/auth/login");
    }
  }

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, [resolvedOrigin, router]);
```

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

- **Session refresh**: The micro-app's middleware refreshes the token when calling `getUser()`
- **Auth routes**: The micro-app's API routes (`/api/auth/*`) manage Supabase SSR cookies — these remain as Next.js server routes
- **Data access**: The micro-app calls DaaS directly using `buildUrl('/api/items/...')` + `getHeaders()` from `useDaaSContext()` — no proxy routes for data

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

Since all apps share the same DaaS backend, the auth token determines access:

```typescript
// Both Main App and micro-app proxy to the SAME DaaS URL
// app/api/items/[collection]/route.ts
const DAAS_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // Same URL everywhere

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  const headers = await getAuthHeaders(); // Extract token from Supabase session

  // DaaS RBAC determines which records the user can see
  const response = await fetch(
    `${DAAS_URL}/items/${collection}?${searchParams.toString()}`,
    { headers },
  );

  return NextResponse.json(await response.json(), { status: response.status });
}
```

The DaaS backend enforces collection-level and record-level permissions based on the authenticated user's role, regardless of which app (Main or micro) made the request.

## Security Checklist

**Same-domain / custom domain deployments:**

- [ ] Main App and micro-apps share the same Supabase project URL and anon key
- [ ] All apps share the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`
- [ ] Session cookies are set on a shared domain (or parent domain for subdomains)
- [ ] Micro-app middleware validates session on every SSR request
- [ ] Micro-app notifies Main App via postMessage on 401 responses
- [ ] Main App handles AUTH_EXPIRED messages and redirects to login
- [ ] `postMessage` origin is validated against allowlist
- [ ] Micro-apps never implement their own login form
- [ ] Logout in Main App clears session for all apps (shared cookie)
- [ ] Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) are NEVER exposed to client code
- [ ] All API calls use `credentials: 'include'` for cookie forwarding
- [ ] DaaS RBAC controls which collections/records each role can access

**Amplify / cross-domain deployments (additional checks):**

- [ ] Micro-app login page detects iframe context (`window.parent !== window`) and sends `MICROAPP_NEEDS_AUTH` instead of showing the login form
- [ ] Main App `MicroappIframe` handles `MICROAPP_NEEDS_AUTH` and responds with `SET_AUTH` containing session tokens
- [ ] Micro-app has `/api/auth/set-session` route that calls `supabase.auth.setSession()`
- [ ] `/api/auth/set-session` is in the public routes list (middleware bypass)
- [ ] `SET_AUTH` postMessage validates the origin against `HOST_ORIGIN` from `config/app-urls.ts`
- [ ] Micro-app login page falls back to the standard login form after 3s if no `SET_AUTH` arrives (handles host-not-configured edge case)
- [ ] `access_token` and `refresh_token` are never logged or stored beyond the duration of the `setSession()` call
````
