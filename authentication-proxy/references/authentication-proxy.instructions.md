---
name: Authentication & Proxy Pattern
description: Authentication architecture using server-side proxy to avoid CORS issues
applyTo: "**/*.{ts,tsx}"
---

# Authentication & Proxy Pattern Instructions

<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

## 🔴 CRITICAL: All Auth Must Go Through Server-Side Proxy

Generated DaaS applications use a **two-tier architecture**. The browser MUST NOT call
the DaaS backend or Supabase Auth directly — all requests go through the app's own
Next.js API routes (same-origin proxy).

```
Browser (localhost:3001)            Next.js API Routes (localhost:3001)         DaaS Backend (localhost:3000)
      │                                      │                                        │
      │  POST /api/auth/login ───────────►   │  supabase.auth.signInWithPassword  ──► │
      │  ◄── { session cookie set }          │  ◄── { session }                       │
      │                                      │                                        │
      │  GET /api/auth/user ─────────────►   │  supabase.auth.getUser + DaaS ────────►│
      │  ◄── { user data }                   │  ◄── { user profile }                  │
      │                                      │                                        │
      │  POST /api/auth/logout ──────────►   │  supabase.auth.signOut ───────────────►│
      │  ◄── { success }                     │  ◄── { success }                       │
      │                                      │                                        │
      │  GET /api/items/todos ───────────►   │  fetch(DAAS_URL/api/items/todos) ─────►│
      │  ◄── { data: [...] }                 │  ◄── { data: [...] }                   │
```

The diagram shows a Supabase project, where the right-hand column is the DaaS backend and Supabase Auth. On an Engine project the right-hand column is the Engine at the Engine_URL (a local Engine answers on `localhost:8080`): the Supabase client in the API routes signs in, refreshes the session, reads the user and signs out at the Engine, and the data routes forward the user's token to the Engine. On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

### Why This Matters

- **CORS**: The DaaS backend runs on a different port/domain. Browser requests to
  cross-origin servers trigger CORS preflight checks and cookie restrictions. On an Engine
  project the data API accepts requests from any origin but never with cookies. A browser may
  send the tenant header `X-Tenant-Id` to it, without credentials, but the sign-in that names the
  tenant is still made by the app's own server route, which sends `X-Tenant-Id` with the value of
  `NEXT_PUBLIC_BUILDPAD_TENANT_ID`.
- **Security**: Server-side proxy routes can forward auth tokens securely without
  exposing them to the browser.
- **Cookies**: Session cookies set via the proxy have `SameSite=Lax` by default,
  which works because the proxy is same-origin.

## Auth Routes (Installed by CLI)

The Buildpad CLI installs these proxy routes automatically with `--all` or `--with-api`:

| Route                | Method | Purpose                                     |
| -------------------- | ------ | ------------------------------------------- |
| `/api/auth/login`    | POST   | Login with email/password via Supabase Auth (via the Supabase client to the Engine, on an Engine project) |
| `/api/auth/logout`   | POST   | Sign out and clear session cookies          |
| `/api/auth/user`     | GET    | Get current authenticated user profile      |
| `/api/auth/callback` | GET    | Handle OAuth/email-confirm redirects (on an Engine project, the XAppHub sign-in redirect only) |

On an Engine project the Supabase client is kept for sign-in only. Password sign-in, session refresh, reading the signed-in user and sign-out work through it, and its default sign-out ends the user's sessions on every device. An account that holds no role in the project's tenant is refused at password sign-in. XAppHub sign-in also works through it while the project's XAppHub connector is connected: the application's server gives the ID token from XAppHub to `signInWithIdToken` with the provider `my-apps`, and ends the session of an account that holds no role yet (the `add-external-oauth` skill). Not available on an Engine project: sign-up; OAuth sign-in with any provider other than XAppHub; magic link and one-time code; password recovery; changing a password, an email or a profile through the Supabase client; the Supabase client's code exchange; and the Supabase administration API. The Platform's password-less handoff opens the Studio; it is not a way for an application to sign a user in.

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session.

In the mode `customer-tenants` the application holds these four auth routes in place of the CLI's login route (the `create-api-route` skill writes them, and the [`add-multitenancy`](../../add-multitenancy/SKILL.md) skill's guide `engine-customer-tenants` gives the chooser and the switch):

| App route | Engine call | Answer to the browser |
|---|---|---|
| `POST /api/auth/login` | Supabase client `signInWithPassword` against the Engine_URL **with no `X-Tenant-Id` header**; then `settleTenant` | `{data: {tenant}}`, `{data: {choose: [...]}}`, or 403 with "Your account does not belong to any customer of this application" |
| `GET /api/auth/tenants` | `GET <Engine_URL>/api/auth/tenants`, `Authorization: Bearer <access token>` | the entries of `kind: "tenant"`, each with `blueprint: id === NEXT_PUBLIC_BUILDPAD_TENANT_ID` |
| `POST /api/auth/tenant` | `POST <Engine_URL>/api/auth/tenant`, body `{"tenant": "<id>"}`, `Authorization: Bearer <access token>`; then `supabase.auth.setSession` with the answered pair | `{data: {tenant}}`; the browser then reloads the page (`window.location.assign("/")`) |
| `DELETE /api/auth/tenants/[id]` | `DELETE <Engine_URL>/api/auth/tenants/:id` (decline an invitation not yet entered) | 204, or the Engine's 409 or 404 |

<!-- /buildpad-backend -->
## ❌ WRONG: Direct Supabase Auth from Browser

```tsx
// ❌ WRONG: Calling Supabase directly from client component
"use client";
import { createClient } from "@/lib/supabase/client";

function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    // This calls Supabase directly → may cause CORS issues with DaaS
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    // Session cookie may not be properly set for DaaS proxy routes
  };
}
```

## ✅ CORRECT: Login Through Proxy Route

```tsx
// ✅ CORRECT: Login through same-origin proxy route
"use client";

function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include", // Include cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || "Login failed");
    }

    // Session cookie is set server-side by the proxy route
    router.push("/");
    router.refresh(); // Refresh to pick up new session
  };
}
```

## ✅ CORRECT: Logout Through Proxy Route

```tsx
// ✅ CORRECT: Logout through proxy
const handleLogout = async () => {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  router.push("/login");
  router.refresh();
};
```

## ✅ CORRECT: Get Current User Through Proxy

```tsx
// ✅ CORRECT: Get user through proxy (or use useAuth hook which does this)
const response = await fetch("/api/auth/user", {
  credentials: "include",
});
const { data: user } = await response.json();

// Or use the useAuth hook (recommended):
import { useAuth } from "@/lib/buildpad/hooks";
const { user, isAdmin, isAuthenticated } = useAuth();
```

## Data API Calls Also Use Proxy

The same proxy pattern applies to ALL data operations:

```tsx
// ❌ WRONG: Direct call to DaaS backend
// (localhost:3000 is a local DaaS backend; a local Engine answers on localhost:8080)
const response = await fetch("http://localhost:3000/api/items/todos");

// ✅ CORRECT: Same-origin proxy route
const response = await fetch("/api/items/todos");

// ✅ CORRECT: Using Buildpad services (auto-uses proxy)
import { ItemsService } from "@/lib/buildpad/services";
const items = new ItemsService("todos");
const data = await items.readByQuery({ limit: 50 });
```

## Login Page Template

When creating a login page, use this pattern:

```tsx
"use client";
import { useState } from "react";
import {
  Button,
  TextInput,
  PasswordInput,
  Stack,
  Paper,
  Container,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || "Login failed");
      }

      notifications.show({
        title: "Success",
        message: "Logged in",
        color: "green",
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Login failed",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420}>
      <Paper withBorder shadow="md" p={30} radius="md">
        <Stack>
          <TextInput
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button fullWidth loading={loading} onClick={handleLogin}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
```

## Protected Route Layout Pattern

```tsx
// app/(protected)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

## App Shell with Sign Out

```tsx
"use client";
import { AppShell, Button, Group, Text } from "@mantine/core";
import { useAuth } from "@/lib/buildpad/hooks";
import { useRouter } from "next/navigation";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  };

  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>My App</Text>
          {isAuthenticated && (
            <Group>
              <Text size="sm">{user?.email}</Text>
              <Button variant="subtle" onClick={handleLogout}>
                Sign out
              </Button>
            </Group>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

## Environment Variables

The proxy routes use these environment variables:

```env
# Frontend app (.env.local), on a Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none.

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

In the mode `customer-tenants`, `NEXT_PUBLIC_BUILDPAD_TENANT_ID` stays the Blueprint's id, the project's own tenant. It labels the application's own tenant in the customer chooser and names the tenant of a request without a session. It never names the current customer, and no customer's tenant id goes into the environment.

On an Engine project with Customer_Tenants a public page of one customer is not available: a request without a session acts in the tenant `X-Tenant-Id` names, and nothing maps a host name to a customer yet. A page without a session reads the Blueprint only, through `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. Tell the developer so and stop: do not put a customer's tenant id in the application or let a visitor choose it.

<!-- /buildpad-backend -->
```env
# Frontend app (.env.local), on an Engine project
NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>
NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key
NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>
```

The middleware (`middleware.ts`) handles session refresh automatically.
Auth proxy routes use `@/lib/supabase/server` client for server-side auth operations.
Data proxy routes use `@/lib/api/auth-headers` to forward the JWT to the data API at
`NEXT_PUBLIC_BUILDPAD_DAAS_URL` (the DaaS backend on a Supabase project, the Engine_URL on an
Engine project).
