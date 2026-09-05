# Pinned edits for CLI-owned files (Multi-Zones)

A `@buildpad/cli` app is not greenfield. It already ships the files a zone
composition has to touch, each with an `@buildpad-origin` header. Never
overwrite them and never replace them with a skill-owned file: the CLI's
`--overwrite` upgrade path would silently drop the change, and the files carry
behaviour the composition must keep (the Supabase cookie refresh, the
`publicOrigin()` redirect that is correct behind Amplify, the `Cache-Control:
private, no-store` header on every page response).

Apply the edits below **verbatim**, in the order given, and add this banner on
line 10 of every touched file, right after the CLI header:

```ts
// ⚠️ LOCAL MODIFICATION (add-microfrontend-zones): re-apply pinned edit <ID> after buildpad upgrade
```

If the app was composed with the iframe skill before, restore every file in
the "Migration" table of `SKILL.md` to its CLI stock version **first**
(`git show <bootstrap-commit>:<path>` or `npx @buildpad/cli add <origin> --overwrite`),
then apply the zone edits. Stacking zone edits on iframe edits does not work.

Every edit was verified on `@buildpad/cli` 1.11.1 / Next.js 16.3.3 in the
2026-09-04 field trial (three apps, production builds, 10/10 acceptance).

| ID | File | App | What it does |
| --- | --- | --- | --- |
| Z1 | `components/layout/AuthenticatedShell.tsx` | all | Sidebar links through `ZoneLink`; active state from the public pathname |
| Z-M1 | `lib/supabase/middleware.ts` | zone | Unauthenticated → Main App `/login?next=<public path>` |
| Z-M1h | `lib/supabase/middleware.ts` | Main App | Unauthenticated → `/login?next=<path+query>` (deep links into zones survive) |
| Z-M2 | `middleware.ts` | Main App | Matcher skips `<prefix>/_next/static` and `<prefix>/_next/image` |
| Z-P1 | `app/login/page.tsx` | Main App | After sign-in, hard-navigate to `?next=` (guarded) |
| Z-W1 | `components/DaaSProviderWrapper.tsx` | zone | URL-state writer strips `basePath` before `router.replace` |

---

## Z1 — `components/layout/AuthenticatedShell.tsx` (every app, byte-identical)

The CLI shell renders nav entries with `next/link` and compares them to
`usePathname()`. Both are wrong across zones: a `<Link>` to another zone
soft-navigates into a different app's RSC tree, and `usePathname()` has no
`basePath`, so a public href never matches.

**Z1a** — replace the two imports:

```diff
 import { NAV_ITEMS } from "./navigation";
-import Link from "next/link";
-import { usePathname } from "next/navigation";
+// Pinned edit Z1 (add-microfrontend-zones Rule 4): nav hrefs are PUBLIC paths.
+// ZoneLink renders <Link> for the zone that owns the page and <a> for every
+// other zone (a cross-zone <Link> soft-navigates into another app's RSC tree).
+// usePublicPathname() puts basePath back so the active-state comparison holds.
+import { ZoneLink } from "@/lib/shell/ZoneLink";
+import { usePublicPathname } from "@/lib/shell/usePublicPathname";
```

**Z1b** — the pathname:

```diff
-  const pathname = usePathname();
+  const pathname = usePublicPathname(); // Z1: includes this zone's basePath
```

**Z1c** — the nav loop (the only `<Link>` in the file):

```diff
-                    <Link
+                    <ZoneLink
                       key={item.href}
                       href={item.href}
                       className={`bp-nav-link ${
                         isActive ? "bp-nav-link-active" : ""
                       }`}
                       onClick={closeMobile}
                     >
                       <Icon size={18} stroke={1.8} />
                       <span>{item.label}</span>
-                    </Link>
+                    </ZoneLink>
```

The logout item needs no change: `window.location.href = "/api/auth/logout"`
resolves on the public origin, which is the Main App's route in every zone.

---

## Z-M1 — `lib/supabase/middleware.ts` (zone)

```diff
 import { createServerClient } from '@supabase/ssr';
 import { NextResponse, type NextRequest } from 'next/server';
-import { publicOrigin } from '@/lib/origin';
+import { MAIN_APP_URL } from '@/config/app-urls';
```

```diff
   if (!user && !isPublicRoute && !isApiRoute) {
-    // Built from the resolved public origin, not `request.nextUrl`: behind a
-    // proxy the latter names the server process (localhost), and middleware
-    // redirects emit an absolute Location header. See lib/origin.ts.
-    const url = new URL('/login', publicOrigin(request));
-    url.search = request.nextUrl.search;
+    // Pinned edit Z-M1 (add-microfrontend-zones Rule 6): the login page lives in
+    // the Main App only. Redirect to it on the PUBLIC origin (never request.url —
+    // behind the Main App rewrite that is this zone's own domain, which has no
+    // usable login) and carry the public path back: basePath + path + query.
+    const url = new URL('/login', MAIN_APP_URL);
+    const publicPath = `${request.nextUrl.basePath}${request.nextUrl.pathname}${request.nextUrl.search}`;
+    url.searchParams.set('next', publicPath);
     return NextResponse.redirect(url);
   }
```

`request.nextUrl.pathname` never contains `basePath`; `request.nextUrl.basePath`
does. Keep `getUser()` — see Rule 12 on `getClaims()`.

---

## Z-M1h — `lib/supabase/middleware.ts` (Main App)

Zone requests hit the Main App middleware first (rewrites run after it), so
this is the redirect an unauthenticated deep link into a zone actually gets.
The stock code forwards the query but drops the path.

```diff
     const url = new URL('/login', publicOrigin(request));
     url.search = request.nextUrl.search;
+    // Pinned edit Z-M1h (add-microfrontend-zones Step 5): carry the requested
+    // path as `next` so a deep link into a zone (/iam/roles) survives the login
+    // bounce. Zone requests hit THIS middleware first — the rewrite runs after it.
+    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
     return NextResponse.redirect(url);
```

---

## Z-M2 — `middleware.ts` (Main App)

The stock matcher excludes only the Main App's own `_next/static`. A zone's
chunks live under its prefix (`/iam/_next/static/...`) and match, so every
chunk costs a `getUser()` round-trip and — because the CLI middleware stamps
`Cache-Control: private, no-store, must-revalidate` on everything it handles —
the browser can never cache a zone bundle. Observed before the fix: an
unauthenticated request for a zone chunk answered `307` to `/login?next=%2Fiam%2F_next%2F...`.

```diff
   matcher: [
-    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
+    // Pinned edit Z-M2 (add-microfrontend-zones): zone assets live under the zone
+    // prefix (/iam/_next/static/...), which the stock pattern does not exclude —
+    // every zone chunk would cost a getUser() round-trip AND be stamped
+    // `Cache-Control: private, no-store`, so the browser could never cache it.
+    '/((?!_next/static|_next/image|favicon.ico|.*/_next/static|.*/_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
   ],
```

The matcher must stay a literal (Next.js reads it statically), so it cannot be
generated from `zones.json`; the `.*/_next/...` alternatives cover every prefix.
Verify after the edit: a zone chunk fetched through the Main App must answer
`200` with `cache-control: public, max-age=31536000, immutable`.

---

## Z-P1 — `app/login/page.tsx` (Main App)

```diff
-import { useRouter } from 'next/navigation';
 import { IconMail, IconLock, IconCheck, IconShield } from '@tabler/icons-react';
+import { safeRelativePath } from '@/lib/origin';

 export default function LoginPage() {
-  const router = useRouter();
   const [loading, setLoading] = useState(false);
```

```diff
-      router.push('/');
-      router.refresh();
+      // Pinned edit Z-P1 (add-microfrontend-zones Step 5): honor ?next= with a
+      // HARD navigation. The target may live in another zone, which the App
+      // Router cannot soft-navigate into; safeRelativePath rejects off-origin
+      // targets ("//evil.example", absolute URLs) so this is not an open redirect.
+      const next = safeRelativePath(new URLSearchParams(window.location.search).get('next'), '/');
+      window.location.assign(next);
```

`safeRelativePath` is the CLI's own helper in `lib/origin.ts`; its `next/server`
import is type-only, so it is safe in a client component.

---

## Z-W1 — `components/DaaSProviderWrapper.tsx` (zone)

Buildpad's list managers persist search/sort/page in the URL through
`useUrlListParams`, which needs a router writer registered by the app. The hook
hands the writer the **browser** path — `window.location.pathname`, which
includes `basePath` — and `router.replace()` prepends `basePath` again, so an
unstripped writer lands every search on `/iam/iam/users?search=...`.

```diff
 import { DaaSProvider } from "@/lib/buildpad/services";
 import { createClient } from "@/lib/supabase/client";
-import { useMemo, type ReactNode } from "react";
+import { registerUrlStateWriter } from "@/lib/buildpad/hooks";
+import { OWN_PREFIX } from "@/config/app-urls";
+import { useRouter } from "next/navigation";
+import { useEffect, useMemo, type ReactNode } from "react";

 export function DaaSProviderWrapper({ children }: { children: ReactNode }) {
+  // Route the URL-state writes of Buildpad's list managers through the App
+  // Router: native replaceState is invisible to useSearchParams AND re-asserted
+  // away by the router's stale state.
+  //
+  // Pinned edit Z-W1 (add-microfrontend-zones): the hook hands us the BROWSER
+  // path, which carries this zone's basePath, and router.replace() adds basePath
+  // itself — strip it first or every write lands on /iam/iam/users.
+  const router = useRouter();
+  useEffect(() => {
+    registerUrlStateWriter((url) => {
+      const inZone =
+        OWN_PREFIX && url.startsWith(OWN_PREFIX) ? url.slice(OWN_PREFIX.length) || "/" : url;
+      router.replace(inZone, { scroll: false });
+    });
+    return () => registerUrlStateWriter(null);
+  }, [router]);
+
   const config = useMemo(
```

If the wrapper already registers a writer (CLI ≥ the URL-state release), only
add the strip. The Main App needs this edit only if it hosts list managers of
its own (it has `OWN_PREFIX = ''`, so the strip is a no-op there).

---

## Verification checklist (per app, after the edits)

- `npx tsc --noEmit` clean.
- Unauthenticated `GET {{prefix}}/users` through the Main App → `307` to `/login?next=%2F...`.
- Unauthenticated `GET {{prefix}}/_next/static/<chunk>` through the Main App → `200`, immutable cache header (Z-M2).
- Authenticated: type in a list search box → the address bar shows `{{prefix}}/users?search=...` exactly once-prefixed (Z-W1).
- Sidebar: cross-zone entry replaces the document, in-zone entry does not (Z1) — `assets/tests/zones.spec.ts` checks both.
