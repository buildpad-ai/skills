---
name: authentication-proxy
description: Authentication proxy pattern reference. All browser-to-backend communication MUST go through Next.js API proxy routes. Never call Supabase auth or DaaS backend directly from client components. Automatically loaded as background context.
user-invokable: false
---

# Authentication Proxy Pattern

## CRITICAL RULE

```
❌ Browser → DaaS Backend directly       (CORS error!)
❌ Browser → supabase.auth.signIn()      (session cookie not set for proxy)
✅ Browser → /api/auth/login → Supabase  (same-origin, no CORS)
✅ Browser → /api/items/* → DaaS Backend (proxied server-side)
```

## Auth Routes

| Action         | Route                        | Method                                         |
| -------------- | ---------------------------- | ---------------------------------------------- |
| Login          | `/api/auth/login`            | POST `{ email, password }`                     |
| Logout         | `/api/auth/logout`           | POST                                           |
| Get user       | `/api/auth/user`             | GET                                            |
| OAuth callback | `/api/auth/callback`         | GET (handles both Supabase and external OAuth) |
| External OAuth | `/api/auth/oauth/[provider]` | GET (initiates external SSO)                   |

These routes are installed by the CLI (`pnpm cli add --all` or `--with-api`).

## Login Pattern

```tsx
// ✅ CORRECT: Via proxy route
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
  credentials: "include",
});

// ❌ WRONG: Direct Supabase client
const supabase = createClient();
await supabase.auth.signInWithPassword({ email, password });
```

## Logout Pattern

```tsx
// ✅ CORRECT — clears both the Supabase session AND the scope cookie
await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
router.push("/login");
router.refresh();
```

> **Bug 20:** The logout route **must** clear the `daas_resource_uri` cookie. This cookie persists after logout and contains the previous user’s scope URI. When the next user logs in, the stale URI is forwarded as `X-Resource-Uri`, causing an immediate 403 FORBIDDEN_SCOPE.
>
> In `app/api/auth/logout/route.ts`, inside `performLogout`, always add:
> ```ts
> cookieStore.delete('daas_resource_uri');
> ```

Additionally, `ScopeContext` should validate the cookie against the user’s actual available scopes after loading — if the stored URI is not in the user’s list, clear it (defensive second layer).

## Data API Pattern

```tsx
// ✅ CORRECT: Through proxy route
const res = await fetch("/api/items/todos?filter[status][_eq]=active");

// ❌ WRONG: Direct to DaaS backend from browser
const res = await fetch("http://localhost:3000/api/items/todos");
```

## Server-Side Auth Headers

In API routes, use the auth-headers helper to forward the user's JWT:

```tsx
import { getAuthHeaders } from "@/lib/api/auth-headers";

export async function GET(request: Request) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${DAAS_URL}/api/items/todos`, { headers });
  return Response.json(await response.json());
}
```

## External OAuth (SSO)

For external identity providers (Azure AD, Okta, Auth0, Google, custom OIDC):

```tsx
// ✅ CORRECT: Via OAuth initiation route
const handleSSOLogin = () => {
  window.location.href = "/api/auth/oauth/generic";
  // Or with return URL:
  window.location.href = "/api/auth/oauth/azure?returnTo=/dashboard";
};

// ❌ WRONG: Supabase's signInWithOAuth (not configured for self-hosted)
await supabase.auth.signInWithOAuth({ provider: "azure" });
```

See [add-external-oauth](../add-external-oauth/SKILL.md) for full implementation details.

Key points:

- Next.js acts as OAuth client (not Supabase)
- Session set via `supabase.auth.setSession()` (not manual cookies)
- Claims extracted from access_token, id_token, AND userinfo endpoint

## References

- [Authentication proxy details](references/authentication-proxy.instructions.md)
- [External OAuth implementation](../add-external-oauth/SKILL.md)
