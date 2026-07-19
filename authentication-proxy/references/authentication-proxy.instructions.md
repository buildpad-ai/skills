---
name: Authentication & Proxy Pattern
description: Authentication architecture using server-side proxy to avoid CORS issues
applyTo: "**/*.{ts,tsx}"
---

# Authentication & Proxy Pattern Instructions

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

### Why This Matters

- **CORS**: The DaaS backend runs on a different port/domain. Browser requests to
  cross-origin servers trigger CORS preflight checks and cookie restrictions.
- **Security**: Server-side proxy routes can forward auth tokens securely without
  exposing them to the browser.
- **Cookies**: Session cookies set via the proxy have `SameSite=Lax` by default,
  which works because the proxy is same-origin.

## Auth Routes (Installed by CLI)

The Buildpad CLI installs these proxy routes automatically with `--all` or `--with-api`:

| Route                | Method | Purpose                                     |
| -------------------- | ------ | ------------------------------------------- |
| `/api/auth/login`    | POST   | Login with email/password via Supabase Auth |
| `/api/auth/logout`   | POST   | Sign out and clear session cookies          |
| `/api/auth/user`     | GET    | Get current authenticated user profile      |
| `/api/auth/callback` | GET    | Handle OAuth/email-confirm redirects        |

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
# Frontend app (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

The middleware (`middleware.ts`) handles session refresh automatically.
Auth proxy routes use `@/lib/supabase/server` client for server-side auth operations.
Data proxy routes use `@/lib/api/auth-headers` to forward the JWT to the DaaS backend.
