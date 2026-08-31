---
name: add-microfrontend
description: Compose independent Next.js micro-apps into one Main App with sandboxed iframes and a postMessage bridge. Covers the host component, the message contract, auth token bridging, URL and scope syncing, sandbox flags, and CSP. Load add-microapp first to decide domain boundaries and bootstrap the repos, then load this skill to wire the composition. Use when the user says add-microfrontend, micro-frontend, iframe composition, or needs to embed an independent app in another app.
argument-hint: "[microapp name] [host route, e.g. /admin/users]"
---

# Add Micro-Frontend (Iframe Composition)

This skill owns the **composition mechanism**: the host component, the bridge
protocol, auth and URL and scope syncing, sandbox flags, and CSP.

[add-microapp](../add-microapp/SKILL.md) owns domain boundaries, collection ownership,
RBAC, and repo bootstrap. Load it first. Come back here to wire the apps together.

All apps share **one** DaaS backend and **one** Supabase project. Each micro-app is a
standalone Next.js app with its own SSR, routing, and deployment. The browser composes
them.

## When to use iframes

Use this skill when at least two of these are true:

- Separate teams own separate parts of the product.
- Parts must deploy on their own schedule.
- A part must not be able to read the host DOM, CSS, or memory.
- A part already exists as a deployed app.

Do not use this skill when:

- One team owns everything. Use routes in a single app.
- The parts share layout, modals, or a scroll container. See the limits in
  [url-and-history](references/url-and-history.instructions.md).
- You want code reuse. Iframes share nothing. Use a package.
- The section is a widget, not a page.

The cost is real. Iframe composition adds an auth bridge, a message contract, echo
suppression, history rules, dialog limits, and two CSP headers. Isolation is complete;
complexity is not low. `add-microapp` without iframes is often the better answer.

## Critical Rules

1. Micro-apps load in `<iframe>` elements. The Main App owns layout, navigation, and
   the frame `src`.
2. The Main App must not read the frame DOM. The micro-app must not read
   `window.parent` DOM. All communication uses `postMessage`.
3. Copy `assets/shared/bridge-protocol.ts` to every app. Do not retype the message
   shapes. See [bridge-protocol](references/bridge-protocol.instructions.md).
4. Every message handler must check `event.origin`, then `event.source`, then the
   `source` and `v` envelope fields.
5. The iframe `src` must depend on the micro-app origin and the route path only. It
   must never depend on the host query string.
6. The Main App owns token refresh. `SET_AUTH` carries `access_token` and `expires_at`.
   It must never carry `refresh_token`.
7. Each micro-app stores its own access token in its own cookie, on its own origin.
   The bridge is required on Amplify, on a custom domain, and in local development.
8. The micro-app middleware must call `supabase.auth.getUser(token)`. It must not call
   `getSession()`.
9. Every route name in a micro-app comes from `PUBLIC_ROUTES` and `LOGIN_ROUTE` in one
   file. Do not write a route name anywhere else.
10. The host logout must broadcast `LOGOUT` to every mounted frame before it signs out.
    The host cannot delete a cookie on a micro-app origin.
11. `SET_AUTH` must carry `resource_uri` on any project that uses `manage-scope` or
    `add-multitenancy`. Without it every micro-app call resolves at root scope and
    returns 403.
12. Buildpad UI components call DaaS directly through `DaaSProvider`. Hand-written
    fetches go through a proxy route in the same app. Do not generate
    `/api/items/[collection]/route.ts` unless the app has hand-written data calls.
13. The sandbox attribute must omit `allow-modals` and `allow-top-navigation`. It must
    include `allow-downloads`.
14. Micro-apps must not call `window.confirm`, `window.alert`, or `window.prompt`. Use
    Mantine `Modal` or `modals.openConfirmModal`.
15. Micro-apps must not render their own login form inside the frame.
16. All apps must use the same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`,
    `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
17. Verify field names with `mcp_daas_schema` or `mcp_daas_fields` before you write any
    `sort`, `fields`, or `filter` parameter. A wrong name returns a 500 that is hard to
    trace through the frame.

## Architecture

```
Main App (host)                      Micro-App A            Micro-App B
┌───────────────────────────┐        ┌────────────┐         ┌────────────┐
│ AppShell: nav + layout    │        │ own SSR    │         │ own SSR    │
│ ┌───────────────────────┐ │        │ own routes │         │ own routes │
│ │ MicroappIframe        │◀┼───────▶│ own cookie │         │ own cookie │
│ │  postMessage bridge   │ │        └─────┬──────┘         └─────┬──────┘
│ └───────────────────────┘ │              │                      │
│ owns: session, refresh,   │              │                      │
│ scope, theme, navigation  │              │                      │
└─────────────┬─────────────┘              │                      │
              └─────────────────┬──────────┴──────────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │ one DaaS backend      │──▶ Supabase (Auth + DB)
                    └───────────────────────┘
```

## Workflow

### Step 0: Discover the project context (always first)

Call `get_project_detail` on the platform MCP server. Take every URL and credential
from the response. Never ask the user for them.

Tool naming in this repo: platform tools have no prefix (`get_project_detail`). DaaS
tools use the `mcp_daas_*` prefix (`mcp_daas_schema`, `mcp_daas_fields`).

Read `project.mainAmplifyUrl` (host origin), `project.daasUrl`,
`project.supabaseUrl`, `project.supabaseAnonKey`, and `microapps[]` (each with `name`
and `amplifyUrl`).

Stop and report to the user if `daasUrl`, `supabaseUrl`, or `mainAmplifyUrl` is null.
Do not continue with a placeholder.

Full response schema:
[add-microapp context discovery](../add-microapp/references/context-discovery.instructions.md).

### Step 1: Write `config/app-urls.ts` in every app

This file is committed to git. Amplify builds it with no console configuration.

Generation rules and the failure modes:
[add-microapp app-urls config](../add-microapp/references/app-urls-config.instructions.md).

### Step 2: Install the bridge contract

Copy `assets/shared/bridge-protocol.ts` to `lib/bridge/bridge-protocol.ts` in the Main
App and in every micro-app. Copy it unchanged.

### Step 3: Wire the host

| Copy from                        | Copy to                        |
| -------------------------------- | ------------------------------ |
| `assets/host/useMicroappHost.ts` | `lib/bridge/useMicroappHost.ts` |
| `assets/host/MicroappIframe.tsx` | `components/MicroappIframe.tsx` |

Set the Main App login route in `useMicroappHost.ts`, at the line marked `AGENT`.
Change nothing else.

Create one host page per micro-app route:

```tsx
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
      height="calc(100vh - 60px)"
    />
  );
}
```

Iterate over the real `microapps[]` array from Step 0. Do not invent routes.

The navigation must be a client component. A `<NavLink href>` in a server component
renders a plain anchor, and every click reloads the host shell.

```tsx
// components/AdminNav.tsx
'use client';
import { NavLink } from '@mantine/core';
import Link from 'next/link';

export function AdminNav() {
  return <NavLink component={Link} href="/admin/users" label="Users" />;
}
```

Call `logoutAllMicroapps()` from the host logout button before `POST /api/auth/logout`.
Call `broadcastScope(uri)` after a tenant switch. Both come from `useMicroappHost.ts`.

### Step 4: Wire each micro-app

| Copy from                                    | Copy to                                    |
| -------------------------------------------- | ------------------------------------------ |
| `assets/microapp/MicroappBridgeProvider.tsx` | `components/MicroappBridgeProvider.tsx`    |
| `assets/microapp/LoginBridge.tsx`            | `components/LoginBridge.tsx`               |
| `assets/microapp/useQueryParamSync.ts`       | `hooks/useQueryParamSync.ts`               |
| `assets/microapp/middleware.ts`              | `lib/supabase/middleware.ts`               |
| `assets/microapp/middleware.root.ts`         | `middleware.ts`                            |
| `assets/microapp/set-session.route.ts`       | `app/api/auth/set-session/route.ts`        |
| `assets/microapp/logout.route.ts`            | `app/api/auth/logout/route.ts`             |
| `assets/microapp/token.route.ts`             | `app/api/auth/token/route.ts`              |

Mount `MicroappBridgeProvider` in the micro-app **root** layout, inside
`MantineProvider`. A page that is not wrapped never reports that it loaded, and the
host shows its error state.

Render `LoginBridge` from `app/login/page.tsx`, with the normal login form as its
`fallback`.

Add `DEFAULT_AUTHENTICATED_ROUTE` to the micro-app `config/app-urls.ts`. Set it to the
micro-app's first real route.

Point `DaaSProviderWrapper` at `/api/auth/token`. See
[auth-bridge](references/auth-bridge.instructions.md).

### Step 5: Add the CSP headers

Add `frame-ancestors` to each micro-app `next.config.ts`. Add `frame-src` to the Main
App `next.config.ts`. Generate both from `config/app-urls.ts`. See
[security](references/security.instructions.md).

### Step 6: Configure CORS

Add every deployed origin and every local development port to `CORS_ORIGINS` in DaaS.
Add `X-Resource-Uri` to `cors_allowed_headers`.

### Step 7: Add the tests

Copy `assets/tests/iframe-composition.spec.ts` to
`tests/microfrontend/iframe-composition.spec.ts`. Replace the values marked `AGENT`.

### Step 8: Deploy

Push each micro-app first, then the Main App. Amplify builds on push to `main` and
takes two to five minutes. No console environment variable changes are needed: the
URLs live in `config/app-urls.ts`.

## File Structure

```
main-app/
├── app/admin/{route}/page.tsx        # one page per micro-app route
├── components/MicroappIframe.tsx
├── components/AdminNav.tsx           # 'use client'
├── config/app-urls.ts                # committed
├── lib/bridge/bridge-protocol.ts
├── lib/bridge/useMicroappHost.ts
└── next.config.ts                    # frame-src

{name}-microapp/
├── app/login/page.tsx                # renders LoginBridge
├── app/api/auth/set-session/route.ts
├── app/api/auth/logout/route.ts
├── app/api/auth/token/route.ts
├── components/MicroappBridgeProvider.tsx
├── components/LoginBridge.tsx
├── config/app-urls.ts                # committed, holds HOST_ORIGIN
├── hooks/useQueryParamSync.ts
├── lib/bridge/bridge-protocol.ts
├── lib/supabase/middleware.ts        # PUBLIC_ROUTES, LOGIN_ROUTE
├── middleware.ts
└── next.config.ts                    # frame-ancestors
```

## Before You Call It Done

- [ ] Typing in a micro-app search box updates the host URL and does not reload the frame.
- [ ] A signed-in user reaches a micro-app section with no login form and no extra click.
- [ ] Host, and two micro-apps, are all still signed in after the access token expires.
- [ ] Sign-out in the host clears the cookies on every micro-app origin.
- [ ] A scoped DaaS call from inside a frame carries `X-Resource-Uri`.
- [ ] The host back button does not step through invisible frame states.
- [ ] A deliberately wrong `frame-ancestors` value produces the host error state, not a blank frame.

## References

- [Bridge protocol and sequences](references/bridge-protocol.instructions.md)
- [Auth bridge, refresh, scope, sign-out](references/auth-bridge.instructions.md)
- [URL, history, layout limits](references/url-and-history.instructions.md)
- [Sandbox, CSP, message validation](references/security.instructions.md)
- [Troubleshooting](references/troubleshooting.instructions.md)
- [add-microapp](../add-microapp/SKILL.md) — domain boundaries and repo bootstrap
- [daas-platform](../daas-platform/SKILL.md) — DaaSProvider and CORS rules
- [authentication-proxy](../authentication-proxy/SKILL.md) — direct calls and proxy routes
