---
name: Client-Side Scope Integration
description: Patterns for integrating DaaS scope into frontend apps — ScopeProvider context, scope selection UI, making scoped REST API calls directly to DaaS, and handling 400/403 scope errors.
applyTo: "**/*.{ts,tsx}"
---

# Client-Side Scope Integration

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

The DaaS scope system is purely server-side — the frontend's only job is to communicate the **active scope URI** with every request and handle scope-related errors gracefully.

<!-- buildpad-backend: supabase -->
The Next.js UI calls DaaS **directly** (no proxy routes for data). `DaaSProvider` supplies the base URL and auth token via `useDaaSContext()`. Scope is stored in the `daas_resource_uri` cookie and forwarded as `X-Resource-Uri` header in cross-origin requests.

---

## How Scope Context Is Sent

| Method | When to use |
|---|---|
| `daas_resource_uri` cookie | Set by the scope UI; read client-side to extract the URI |
| `X-Resource-Uri` header | **Required for cross-origin requests** to DaaS — send with every scoped fetch |

> **Note:** Cookies are `SameSite=Lax` and will NOT be sent automatically to a different origin. Always read `daas_resource_uri` from `document.cookie` and send it as `X-Resource-Uri` header.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
On an Engine project the UI calls the Engine directly through the SDK — `DaaSProvider` supplies the Engine's address and the signed-in user's access token via `useDaaSContext()` — or through the app's own server routes, which forward the user's token. The Engine accepts no cookie session, and a cookie on the app's origin never reaches it: the scope is stored in the app's own `daas_resource_uri` cookie and sent as the `X-Resource-Uri` header with every request to a scoped collection.

---

## How Scope Context Is Sent

| Method | When to use |
|---|---|
| `daas_resource_uri` cookie | Set by the scope UI on the app's own origin; read to build the header. It is never sent to the Engine |
| `X-Resource-Uri` header | **Required on every request to a scoped collection** — from the browser through the SDK, and from every server route that forwards a call |

> **Note:** A request to a scoped collection without the header is refused with 403 `MISSING_SCOPE` for any user who does not reach every scope. Always read `daas_resource_uri` from `document.cookie` (or from the request, in a server route) and send it as `X-Resource-Uri`.

In the mode `customer-tenants` the scope root is the current customer's node: the `uri_path` of the `current` entry of `GET /api/auth/tenants`, never a configured id and never one built from `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. The `ScopeProvider`'s root and every `X-Resource-Uri` begin with it, and a stored `daas_resource_uri` that does not begin with it is not sent.
<!-- /buildpad-backend -->

---

## ScopeProvider — App-Wide Scope State

Wrap the root layout so all components can read and change the active scope:

```tsx
// lib/contexts/ScopeContext.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const COOKIE_NAME = 'daas_resource_uri';
const COOKIE_MAX_AGE = 30 * 24 * 3600; // 30 days

interface ScopeContextValue {
  resourceUri: string | null;
  setScope: (uri: string | null) => void;
}

const ScopeContext = createContext<ScopeContextValue>({
  resourceUri: null,
  setScope: () => {},
});

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [resourceUri, setResourceUriState] = useState<string | null>(null);

  // Hydrate from cookie on mount (client only)
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)daas_resource_uri=([^;]*)/);
    setResourceUriState(match ? decodeURIComponent(match[1]) : null);
  }, []);

  const setScope = (uri: string | null) => {
    if (uri) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(uri)}; path=/; max-age=${COOKIE_MAX_AGE}`;
    } else {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    }
    setResourceUriState(uri);
  };

  return (
    <ScopeContext.Provider value={{ resourceUri, setScope }}>
      {children}
    </ScopeContext.Provider>
  );
}

export const useScope = () => useContext(ScopeContext);
```

**Usage in layout:**

```tsx
// app/layout.tsx
import { ScopeProvider } from '@/lib/contexts/ScopeContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ScopeProvider>{children}</ScopeProvider>
      </body>
    </html>
  );
}
```

---

## Scope Selection UI

### Pre-built: ScopeSwitcher

Drop-in component that fetches available scopes and sets the cookie:

```tsx
import ScopeSwitcher from '@/components/ScopeSwitcher';

// In header/navbar:
<ScopeSwitcher />
```

<!-- buildpad-backend: supabase -->
`ScopeSwitcher` calls `GET /api/scope/available` which returns:
- Items where `selectable: true` — the user can switch to these
- Items where `selectable: false` — ancestor nodes shown only as breadcrumb labels

### Custom scope selector

```tsx
// components/ScopeSelector.tsx
'use client';
import { useEffect, useState } from 'react';
import { useScope } from '@/lib/scope/context';
import { useDaaSContext } from '@/lib/buildpad/services';

interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  type_name: string;
  selectable?: boolean;
}

export function ScopeSelector() {
  const { resourceUri, setScope } = useScope();
  const { buildUrl, getHeaders } = useDaaSContext();
  const [options, setOptions] = useState<ScopeItem[]>([]);

  useEffect(() => {
    fetch(buildUrl('/api/scope/available'), { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const selectable = (data.data ?? []).filter((s: ScopeItem) => s.selectable !== false);
        setOptions(selectable);
      });
  }, []);

  return (
    <select
      value={resourceUri ?? ''}
      onChange={(e) => setScope(e.target.value || null)}
    >
      <option value="">— Select scope —</option>
      {options.map((s) => (
        <option key={s.id} value={s.uri_path}>
          {s.type_name}: {s.name}
        </option>
      ))}
    </select>
  );
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
`ScopeSwitcher` calls `GET /api/scope/available`, which answers `{ data: [...], root_access }`:
- Items where `selectable: true` — the user can switch to these
- Items where `selectable: false` — ancestor nodes shown only as breadcrumb labels

Each item carries `id`, `name`, `uri_path`, `scope_type_id`, `scope_type` (`{ id, name }`) and `parent_item_id`.

### Custom scope selector

```tsx
// components/ScopeSelector.tsx
'use client';
import { useEffect, useState } from 'react';
import { useScope } from '@/lib/scope/context';
import { useDaaSContext } from '@/lib/buildpad/services';

interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  scope_type: { id: string; name: string } | null;
  selectable?: boolean;
}

export function ScopeSelector() {
  const { resourceUri, setScope } = useScope();
  const { buildUrl, getHeaders } = useDaaSContext();
  const [options, setOptions] = useState<ScopeItem[]>([]);

  useEffect(() => {
    fetch(buildUrl('/api/scope/available'), { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const selectable = (data.data ?? []).filter((s: ScopeItem) => s.selectable !== false);
        setOptions(selectable);
      });
  }, []);

  return (
    <select
      value={resourceUri ?? ''}
      onChange={(e) => setScope(e.target.value || null)}
    >
      <option value="">— Select scope —</option>
      {options.map((s) => (
        <option key={s.id} value={s.uri_path}>
          {s.scope_type?.name}: {s.name}
        </option>
      ))}
    </select>
  );
}
```
<!-- /buildpad-backend -->

---

## User Onboarding — No Scope Assigned

When a user has no scoped role assignments, `GET /api/scope/available` returns an empty list. Detect this and redirect. Use the pre-built template from `scope-routes` (`app/select-scope/page.tsx`) or create a custom page:

```tsx
// app/select-scope/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDaaSContext } from '@/lib/buildpad/services';

interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  selectable?: boolean;
}

export default function SelectScopePage() {
  const [scopes, setScopes] = useState<ScopeItem[] | null>(null); // null = loading
  const router = useRouter();
  const { buildUrl, getHeaders } = useDaaSContext();

  useEffect(() => {
    fetch(buildUrl('/api/scope/available'), { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const selectable = (data.data ?? []).filter((s: ScopeItem) => s.selectable !== false);

        // Auto-select when only one option
        if (selectable.length === 1) {
          document.cookie = `daas_resource_uri=${encodeURIComponent(selectable[0].uri_path)}; path=/; max-age=${30 * 24 * 3600}`;
          router.replace('/');
          return;
        }

        setScopes(selectable);
      });
  }, [router]);

  if (scopes === null) return <p>Loading...</p>;

  if (scopes.length === 0) {
    return (
      <div>
        <h2>No access</h2>
        <p>You have not been assigned to any scope. Contact your administrator.</p>
      </div>
    );
  }

  return (
    <ul>
      {scopes.map((s) => (
        <li key={s.id}>
          <button
            onClick={() => {
              document.cookie = `daas_resource_uri=${encodeURIComponent(s.uri_path)}; path=/; max-age=${30 * 24 * 3600}`;
              router.push('/');
            }}
          >
            {s.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

**Redirect logic in middleware or layout:** Check for empty scope early and redirect to `/select-scope`:

```tsx
// app/layout.tsx (server component)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Only enforce on protected routes, not on /login or /select-scope
const resourceUri = (await cookies()).get('daas_resource_uri')?.value;
if (!resourceUri && !isPublicRoute(pathname)) {
  redirect('/select-scope');
}
```

---

<!-- buildpad-backend: supabase -->
## Making Scoped API Requests

Since the UI calls DaaS directly (cross-origin), the scope cookie is NOT sent automatically. Always read the scope from `document.cookie` and attach it as `X-Resource-Uri` header:

```ts
import { useDaaSContext } from '@/lib/buildpad/services';
import { useScope } from '@/lib/scope/context';

// In a client component:
const { buildUrl, getHeaders } = useDaaSContext();
const { resourceUri } = useScope();

// ✅ Correct — send scope as header for direct DaaS calls
const res = await fetch(buildUrl('/api/items/orders'), {
  headers: { ...getHeaders(), 'X-Resource-Uri': resourceUri ?? '' },
});
const { data } = await res.json();
```

### Explicit scope override

Use when you need to query a different scope than the active one (e.g., admin viewing another branch):

```ts
const res = await fetch(buildUrl('/api/items/orders'), {
  headers: { ...getHeaders(), 'X-Resource-Uri': '/<type-uuid>:<item-uuid>' },
});
```

---

## Handling 400 and 403 Errors

### Error codes returned by the API

| HTTP | `extensions.code` | Meaning |
|---|---|---|
| `403` | `FORBIDDEN` | User is authenticated but their role doesn't grant access in this scope |
| `403` | `FORBIDDEN_SCOPE` | User has no role assigned at or above the active scope URI |
| `400` | `INVALID_SCOPE` | The `resource_uri` in the cookie/header is malformed or refers to a deleted scope item |
| `401` | `UNAUTHENTICATED` | No valid session — redirect to login |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Making Scoped API Requests

The Engine takes the scope from the header, and a cookie on the app's origin never reaches it. Always read the scope from `document.cookie` (through `useScope()`) and attach it as `X-Resource-Uri`:

```ts
import { useDaaSContext } from '@/lib/buildpad/services';
import { useScope } from '@/lib/scope/context';

// In a client component:
const { buildUrl, getHeaders } = useDaaSContext();
const { resourceUri } = useScope();

// ✅ Correct — send scope as header for direct Engine calls
const res = await fetch(buildUrl('/api/items/orders'), {
  headers: { ...getHeaders(), 'X-Resource-Uri': resourceUri ?? '' },
});
const { data } = await res.json();
```

### Explicit scope override

Use when you need to query a different scope than the active one (e.g., admin viewing another branch):

```ts
const res = await fetch(buildUrl('/api/items/orders'), {
  headers: { ...getHeaders(), 'X-Resource-Uri': '/<tenant-type-id>:<tenant-id>/<type-id>:<item-id>' },
});
```

---

## Handling 400 and 403 Errors

### Error codes returned by the API

| HTTP | `extensions.code` | Meaning |
|---|---|---|
| `403` | `FORBIDDEN` | User is authenticated but their roles at this scope don't grant the action |
| `403` | `FORBIDDEN_SCOPE` | User has no role assigned at or above the active scope URI |
| `403` | `MISSING_SCOPE` | The request named no scope, and the collection needs one for this user |
| `400` | `INVALID_SCOPE` | The `X-Resource-Uri` names no scope node: malformed, or a deleted node |
| `401` | `UNAUTHENTICATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED` | No valid session — redirect to login |
<!-- /buildpad-backend -->

### Centralised fetch wrapper

```ts
// lib/scope/api.ts
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';
import { ScopeError } from '@/lib/scope/use-scope-error';

export async function scopedFetch(url: string, resourceUri: string | null, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    headers: { ...getApiHeaders(), 'X-Resource-Uri': resourceUri ?? '', ...((options?.headers as Record<string,string>) ?? {}) },
    ...options,
  });

  if (res.ok) return res.json();

  const body = await res.json().catch(() => ({}));
  const code: string = body?.errors?.[0]?.extensions?.code ?? '';

  switch (res.status) {
    case 401:
      throw new ScopeError('unauthenticated');

    case 403:
      // FORBIDDEN_SCOPE: user has no role in the current scope
      // FORBIDDEN: user's role exists but doesn't cover this collection/action
      throw new ScopeError('forbidden');

    case 400:
      if (code === 'INVALID_SCOPE') {
        // Stale or deleted scope item in cookie — clear and force re-selection
        document.cookie = 'daas_resource_uri=; path=/; max-age=0';
        throw new ScopeError('invalid_scope');
      }
      throw new Error(`Bad request: ${body?.errors?.[0]?.message}`);

    default:
      throw new Error(`Request failed: ${res.status}`);
  }
}
```

### React error handler hook

```tsx
// lib/hooks/useScopeError.ts
'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { ScopeError } from '@/lib/api';

export function useScopeErrorHandler() {
  const router = useRouter();

  return useCallback((error: unknown) => {
    if (!(error instanceof ScopeError)) return false; // not a scope error

    switch (error.type) {
      case 'unauthenticated':
        router.push('/login');
        break;
      case 'forbidden':
        // User switched to a scope they don't have access to
        router.push('/select-scope?error=access_denied');
        break;
      case 'invalid_scope':
        // Cookie was stale — already cleared by scopedFetch, re-select scope
        router.push('/select-scope?error=invalid_scope');
        break;
    }
    return true;
  }, [router]);
}
```

**Using the handler in a component:**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useDaaSContext } from '@/lib/buildpad/services';
import { useScope } from '@/lib/scope/context';
import { scopedFetch } from '@/lib/scope/api';
import { useScopeErrorHandler } from '@/lib/scope/use-scope-error';

export function OrdersList() {
  const [orders, setOrders] = useState([]);
  const { buildUrl } = useDaaSContext();
  const { resourceUri } = useScope();
  const handleScopeError = useScopeErrorHandler();

  useEffect(() => {
    scopedFetch(buildUrl('/api/items/orders'), resourceUri)
      .then((data: any) => setOrders(data.data))
      .catch((err) => {
        if (!handleScopeError(err)) {
          console.error('Unexpected error', err);
        }
      });
  }, [handleScopeError, resourceUri]);

  return <ul>{orders.map((o: any) => <li key={o.id}>{o.id}</li>)}</ul>;
}
```

---

## Clearing Scope on Logout

Always clear the scope cookie when the user logs out to prevent stale scope state on the next login:

```ts
const handleLogout = async () => {
  document.cookie = 'daas_resource_uri=; path=/; max-age=0';
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  router.push('/login');
};
```

---

## Complete Flow Summary

```
1. User logs in → check GET /api/scope/available (direct DaaS call via `buildUrl`)
   ├── empty list  → redirect to /select-scope (show "contact admin" message)
   ├── one item    → auto-set cookie, proceed
   └── many items  → show ScopeSwitcher/ScopeSelector, user picks

2. Cookie set: daas_resource_uri=<uri_path>
   → client reads cookie and sends as X-Resource-Uri header with every DaaS call

3. API returns 403:
   ├── FORBIDDEN_SCOPE → redirect to /select-scope?error=access_denied
   └── FORBIDDEN       → show in-page error ("You don't have permission")

4. API returns 400 INVALID_SCOPE:
   → clear cookie → redirect to /select-scope?error=invalid_scope

5. User switches scope via ScopeSwitcher:
   → setScope(uri) updates cookie → page re-fetches data in new scope

6. User logs out:
   → clear daas_resource_uri cookie → redirect to /login
```
