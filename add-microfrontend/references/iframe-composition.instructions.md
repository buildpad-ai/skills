````markdown
# Iframe Composition Patterns

## Overview

Client-side composition via iframes provides the strongest isolation guarantees for micro-frontends. The Main App manages layout, navigation, and authentication while each micro-app runs independently inside a sandboxed iframe. All apps share a **single DaaS backend**.

## Why Iframes?

| Approach           | Isolation | Complexity | Independence |
| ------------------ | --------- | ---------- | ------------ |
| **Iframe**         | Full      | Low        | Full         |
| Module Federation  | Partial   | High       | Medium       |
| Web Components     | Partial   | Medium     | Medium       |
| Build-time compose | None      | Low        | None         |

Iframes provide **complete isolation** of DOM, CSS, JavaScript, and rendering lifecycle — ideal when micro-apps are developed by different teams or need fully independent deployment.

## MicroappIframe Component Design

### Props Interface

```typescript
interface MicroappIframeProps {
  /** Base URL of the micro-app deployment */
  src: string;
  /** Route path within the micro-app */
  path?: string;
  /** Accessible title for the iframe */
  title: string;
  /** Query params to forward between host and micro-app */
  allowedParams?: string[];
  /** Iframe sandbox attribute */
  sandbox?: string;
  /** CSS height (default: 100%) */
  height?: string;
  /** Allowed origin for postMessage (default: derived from src) */
  allowedOrigin?: string;
}
```

### Sandbox Permissions

The `sandbox` attribute restricts iframe capabilities:

```
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
```

| Flag                             | Status                         | Reason                                                                       |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `allow-scripts`                  | required                       | The micro-app is a Next.js app.                                              |
| `allow-same-origin`              | required                       | Cookies and storage on the micro-app origin.                                 |
| `allow-forms`                    | required                       | Form submission.                                                             |
| `allow-popups`                   | required                       | External links and OAuth windows.                                            |
| `allow-downloads`                | required                       | CSV export, and any download from the Files module (`add-files`).            |
| `allow-popups-to-escape-sandbox` | only with `add-external-oauth` | A popup inherits this sandbox otherwise, and the OAuth flow fails.           |
| `allow-modals`                   | **forbidden**                  | Its absence is what blocks `window.confirm`. Micro-apps use Mantine `Modal`. |
| `allow-top-navigation`           | **forbidden**                  | It lets a micro-app replace the host page.                                   |

Native dialogs are blocked by the missing `allow-modals` flag — a deliberate choice here, not a browser policy. Do not add the flag to make a dialog work.

## Clickjacking Protection

A micro-app that holds a valid cookie can otherwise be framed by any site. `X-Frame-Options` cannot list more than one origin, so use CSP. Generate both values from `config/app-urls.ts`.

- Micro-app `next.config.ts`: `Content-Security-Policy: frame-ancestors 'self' <HOST_ORIGIN>`
- Main App `next.config.ts`: `Content-Security-Policy: frame-src 'self' <each MICROAPP_URLS origin>`

Add every local development origin to both, or the frame is blocked locally. A `frame-ancestors` mismatch is invisible to the host: the load failure is opaque, so the load watchdog is what surfaces it.

### Loading States

Always show a loading skeleton while the iframe content loads:

```typescript
{isLoading && <Skeleton visible height="100%" />}
<iframe
  style={{ display: isLoading ? 'none' : 'block' }}
  onLoad={() => setIsLoading(false)}
/>
```

### Error Handling

> **`<iframe onError>` is dead code.** It does not fire for HTTP errors, network failures, or a frame blocked by CSP. A cross-origin load failure is opaque to the host, so an `onError` handler never runs and the error `Alert` never shows.

The only reliable failure signal is the **absence** of `MICROAPP_LOADED`. Use a watchdog:

```typescript
useEffect(() => {
  loadedRef.current = false;
  setIsLoading(true);
  setHasError(false);
  const timer = setTimeout(() => {
    if (!loadedRef.current) {
      setHasError(true);
      setIsLoading(false);
    }
  }, loadTimeoutMs); // default 15000, for a cold Amplify SSR start
  return () => clearTimeout(timer);
}, [iframeSrc, loadTimeoutMs, attempt]);
```

`MICROAPP_ERROR` only helps when the micro-app already loaded, which is the case that is not an error. Send `MICROAPP_LOADED` from `MicroappBridgeProvider` in the micro-app **root layout**, not from `useQueryParamSync`: a page that does not use that hook would otherwise never report that it loaded.

## Navigation Patterns

### Main App-Driven Navigation

The Main App owns the navigation sidebar/header. When the user clicks a nav link, the Main App renders a **different page** that includes a `MicroappIframe` pointed at a different micro-app route.

```
/admin/users    → <MicroappIframe src={MICROAPP_URL} path="/users" />
/admin/settings → <MicroappIframe src={MICROAPP_URL} path="/settings" />
```

Each Main App page is a server component — the iframe `src` is set at render time.

### Micro-App Internal Navigation

Within the iframe, the micro-app can use its own `next/navigation` for sub-routes (e.g., `/users` → `/users/123`). These internal navigations are invisible to the Main App.

If the micro-app needs to trigger a Main App-level navigation (e.g., navigate to a different section), use postMessage:

```typescript
// Micro-app: Request Main App navigation
window.parent.postMessage(
  { type: "NAVIGATE", path: "/admin/settings" },
  hostOrigin,
);
```

```typescript
// Main App: Handle navigation request from micro-app
if (event.data?.type === "NAVIGATE") {
  router.push(event.data.path);
}
```

## Multiple Micro-Apps

Each Main App route can point to a **different** micro-app deployment. All micro-apps connect to the same shared DaaS backend. URLs are imported from `config/app-urls.ts` (committed to git):

```typescript
// config/app-urls.ts (committed to git, auto-generated from get_project_detail)
// Hardcoded defaults are ACTUAL deployed Amplify URLs from get_project_detail.
// Env vars are optional overrides for local development only.
export const MICROAPP_URLS = {
  "users-app":
    process.env.NEXT_PUBLIC_USERS_APP_URL ||
    "https://main.d1234users.amplifyapp.com",
  "billing-app":
    process.env.NEXT_PUBLIC_BILLING_APP_URL ||
    "https://main.d5678billing.amplifyapp.com",
  "analytics-app":
    process.env.NEXT_PUBLIC_ANALYTICS_APP_URL ||
    "https://main.d9012analytics.amplifyapp.com",
} as const;
```

> **⚠️ CRITICAL:** The hardcoded string (right side of `||`) MUST be the actual deployed Amplify URL from `get_project_detail` — NEVER `localhost` or placeholder URLs. The env var (left side) is a single optional override for local dev.

```typescript
// app/admin/users/page.tsx
import { MICROAPP_URLS } from '@/config/app-urls';
<MicroappIframe src={MICROAPP_URLS['users-app']} path="/users" ... />

// app/admin/billing/page.tsx
import { MICROAPP_URLS } from '@/config/app-urls';
<MicroappIframe src={MICROAPP_URLS['billing-app']} path="/invoices" ... />
```

## Performance Considerations

1. **Lazy Loading**: Use `loading="lazy"` on iframes that are below the fold
2. **Preconnect**: Add `<link rel="preconnect" href="https://microapp.example.com">` in the Main App's `<head>`
3. **Cache Headers**: Micro-apps should return proper cache headers for static assets
4. **Skeleton UI**: Show loading state immediately while iframe initializes SSR

## Deployment Topology

```
┌─────────────────────┐     ┌─────────────────────┐
│  Main App (Amplify)  │     │  Micro-App (Amplify) │
│  my-app.example.com  │────▶│  microapp.example.com│
│  - AdminShell        │     │  - Users pages        │
│  - Navigation        │     │  - Own API proxy       │
│  - Auth login/logout │     │  - Own SSR             │
│  - Own pages & data  │     │                        │
└──────────┬───────────┘     └──────────┬────────────┘
           │                            │
           └────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │  Single DaaS     │
              │  Backend (shared)│
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Supabase        │
              │  (Auth + DB)     │
              └──────────────────┘
```

Both apps are deployed independently. The only coupling is:

1. Shared Supabase project (auth cookies on same domain)
2. Shared DaaS backend (same `NEXT_PUBLIC_BUILDPAD_DAAS_URL`)
3. postMessage contract (message types and payload shapes)
4. Iframe `src` URL configured in Main App's `config/app-urls.ts` (committed to git)

## Iframe Restrictions & Pitfalls

### Native Browser Dialogs Do Nothing

`window.confirm()`, `window.alert()`, and `window.prompt()` do nothing inside the frame **because the `sandbox` attribute omits `allow-modals`**. This is a deliberate choice, not a browser policy — and it is why `allow-modals` must never be added.

**Bad** — will fail inside iframe:

```typescript
// ❌ This is blocked by the iframe sandbox
const confirmed = window.confirm("Are you sure you want to delete this item?");
if (confirmed) {
  await deleteItem(id);
}
```

**Good** — use Mantine Modal instead:

```typescript
"use client";

import { useState } from "react";
import { Modal, Button, Group, Text, Stack } from "@mantine/core";

function DeleteButton({ itemId, onDelete }: { itemId: string; onDelete: (id: string) => Promise<void> }) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button color="red" onClick={() => setOpened(true)}>Delete</Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Confirm Delete">
        <Stack>
          <Text>Are you sure you want to delete this item?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>Cancel</Button>
            <Button color="red" onClick={async () => { await onDelete(itemId); setOpened(false); }}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
```

Or use `@mantine/modals` for a shorter declarative approach:

```typescript
import { modals } from "@mantine/modals";

modals.openConfirmModal({
  title: "Confirm Delete",
  children: <Text>Are you sure you want to delete this item?</Text>,
  labels: { confirm: "Delete", cancel: "Cancel" },
  confirmProps: { color: "red" },
  onConfirm: () => deleteItem(id),
});
```

### React 19 / Next.js 16: No Function Props from Server Components

In React 19, **functions cannot be passed as props** from a Server Component to a Client Component. This affects patterns like Mantine's `component` prop:

**Bad** — fails in Server Components:

```typescript
// ❌ Server Component — Link is a function, can't be passed as prop
import { Anchor } from "@mantine/core";
import Link from "next/link";

export default function UsersPage() {
  return <Anchor component={Link} href="/users/123">View User</Anchor>;
}
```

**Good** — use plain `<Link>` in Server Components:

```typescript
// ✅ Server Component — use next/link directly
import Link from "next/link";

export default function UsersPage() {
  return <Link href="/users/123" style={{ textDecoration: "underline" }}>View User</Link>;
}
```

**Also Good** — `component={Link}` works in Client Components:

```typescript
// ✅ Client Component — function props are allowed
"use client";
import { Anchor } from "@mantine/core";
import Link from "next/link";

export default function UserLink() {
  return <Anchor component={Link} href="/users/123">View User</Anchor>;
}
```
````
