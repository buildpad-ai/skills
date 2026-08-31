# Auth Bridge

The Main App owns the session. Each micro-app holds a short-lived copy of the access
token in its own cookie, on its own origin.

## Why a bridge is always necessary

On AWS Amplify every app gets a random subdomain, for example
`main.d1a2b3c4.amplifyapp.com`. `amplifyapp.com` is on the Public Suffix List, so the
browser treats each subdomain as a separate site. A Supabase cookie set on the Main App
domain is invisible to the micro-app domain.

The bridge is also necessary in local development. `localhost:3000` and
`localhost:3001` are different origins.

The bridge works on a custom domain too. Use it there as well. A shared parent-domain
cookie is an optional extra, not a replacement.

## Rule: the host owns refresh — actively

`SET_AUTH` carries `access_token` and `expires_at`. It must never carry
`refresh_token`.

Supabase rotates refresh tokens. A consumed refresh token is accepted again only
inside the reuse interval, which defaults to 10 seconds. A later reuse is treated as
possible theft, and Supabase can revoke the whole session family. If the host and
three micro-apps each hold the same refresh token, each refreshes on its own; the
first wins and the rest present a consumed token — a forced sign-out of every app
about an hour after sign-in.

"Owns refresh" needs code behind it. When a frame asks for a token and the host
session is inside the renewal window, `getSession()` returns the **same**
`expires_at`, the frame's lead timer fires again, and the two loop. The host handler
in `useMicroappHost.ts` therefore calls `refreshSession()` when less than 90 s
remains — 90 s > the frame's 60 s lead, so the windows always overlap. The frame side
clamps its retry to ≥ 5 s and ignores a `SET_AUTH` whose `expires_at` does not
advance, so even a misbehaving host cannot drive an unbounded loop.

> **Confirm this against your Supabase version** with the renewal test in Step 7 —
> overwrite `mfe_expires_at` to now+70 s and watch a second
> `MICROAPP_NEEDS_AUTH → SET_AUTH → set-session` round trip complete.

## Rule: a valid token is not authorization

`POST /api/auth/set-session` is reachable by anything on the page. Validating the
token with `getUser(access_token)` proves the token is *valid* — not that it belongs
to the current user or came from the host frame. Without an origin check, an attacker
page can POST **its own** valid token as a CORS-simple request (no preflight) and log
the victim's frame into the attacker's account, planting an attacker `resource_uri`
with it.

`assets/microapp/set-session.route.ts` therefore rejects any request whose
`Sec-Fetch-Site` is not `same-origin`, whose `Origin` does not match
`publicOrigin(request)`, or whose `Content-Type` is not `application/json` — and only
then validates the token with `getUser`.

## Rule: bridge cookies are third-party cookies

Every cookie `set-session` writes lives inside a cross-site frame, so it needs
`SameSite=None; Secure; Partitioned` — all three. Without `Partitioned` (CHIPS), the
write is silently dropped by Safari (default), Chrome/Edge Incognito, Brave, and any
block-third-party-cookies profile. `lib/bridge/mfe-cookies.ts` is the single source
for the names and the option set; never write either as a literal.

localhost hides this failure class completely: two localhost ports are the same
*site*, so every local check passes and only the deployed cross-site build breaks.

localhost also erases origin isolation, which is a second failure class. Cookies ignore
the port, so `:3000` and `:3002` share **one** cookie jar. Measured from the host page
at `http://localhost:3000`, `document.cookie` returned `mfe_expires_at` written by the
frame at `:3002`, and the micro-app origin could read — and delete — the host's
Supabase session cookie and the scope cookie. A local pass therefore proves nothing
about session isolation between the two apps.

Verify the handshake, the cookie scoping, and the isolation on the deployed origins, in
Safari or an Incognito window, before calling the bridge done.

## Pinned edits — merging into CLI-owned files

Never overwrite a file carrying `@buildpad-origin` (SKILL Rule 9). Anchor each edit on
the named line, not on a line number. After each merge, add under the CLI header:
`// ⚠️ LOCAL MODIFICATION (add-microfrontend): re-apply pinned edits after buildpad upgrade`.

### M1–M3 · `lib/supabase/middleware.ts` (micro-app)

The CLI file already treats `/login`, `/signup`, `/auth`, and `/api/auth` as public
and passes every `/api` path through. Keep all of that — it is what keeps standalone
sign-in, sign-up, and the OAuth callback working. Three additions:

**M1 — import the bridge helpers** (top of file):

```ts
import { getMfeUser, isProtectedApiRoute } from '@/lib/bridge/mfe-middleware';
```

**M2 — accept the bridge token as a second session source.** Directly after the line
`const { data: { user } } = await supabase.auth.getUser();` add:

```ts
// Framed micro-app: no Supabase session exists on this origin. Accept the
// bridge access token, validated against the Auth server on every request.
const effectiveUser = user ?? (await getMfeUser(request));
```

…and use `effectiveUser` in the redirect condition below it (in place of `user`).

**M3 — gate the token route with 401 JSON, never a redirect.** Directly before the
`if (!effectiveUser && !isPublicRoute && !isApiRoute)` redirect block add:

```ts
// /api/auth/token must NOT ride the blanket /api pass — it hands out the bridge
// token. Answer JSON, never redirect: a redirect lands on /login, returns
// 200 text/html, and silently breaks every fetch() caller.
if (isProtectedApiRoute(request.nextUrl.pathname) && !effectiveUser) {
  return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
}
```

Leave the CLI's redirect exactly as it is — it is built from `publicOrigin(request)`,
which is correct behind Amplify/CloudFront where `request.url` names the server
process, not the browser's address.

### L1 · `app/api/auth/logout/route.ts` (micro-app)

Inside `performLogout()`, **before** `await supabase.auth.signOut();` (signOut can
error and return early inside the frame, which would strand the cookies):

```ts
// Bridge cookies live on THIS origin; the host cannot delete them.
// A stale daas_resource_uri is forwarded as X-Resource-Uri for the next
// user and causes an immediate 403 FORBIDDEN_SCOPE (Bug 20).
//
// Expire with the SAME attribute set the write used — never cookieStore.delete().
// A bare delete emits Set-Cookie without Secure/SameSite=None/Partitioned; the
// browser rejects the defaulted-Lax expiry in the cross-site frame, and under
// CHIPS an unpartitioned expiry addresses a DIFFERENT cookie anyway, so the
// bridge cookie survives sign-out. Invisible on localhost (same-site).
const { MFE_TOKEN_COOKIE, MFE_EXPIRES_COOKIE, SCOPE_COOKIE, framedCookieOptions } =
  await import('@/lib/bridge/mfe-cookies');
cookieStore.set(MFE_TOKEN_COOKIE, '', framedCookieOptions(0, true));
cookieStore.set(MFE_EXPIRES_COOKIE, '', framedCookieOptions(0, false));
cookieStore.set(SCOPE_COOKIE, '', framedCookieOptions(0, false));
```

Keep everything else: the **GET handler** (the shell navigates to it), the OAuth SLO
logic, and the `oauth_provider` cleanup.

### P1 · `app/login/page.tsx` (micro-app)

Rename the CLI page's default export to `LoginForm` (change nothing inside it), then
add a new default export. `LoginBridge` reads `useSearchParams`, so the page needs a
`Suspense` boundary:

```tsx
import { Suspense } from 'react';
import { LoginBridge } from '@/components/LoginBridge';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginBridge fallback={<LoginForm />} />
    </Suspense>
  );
}
```

Framed: `LoginBridge` runs the handshake and never shows the form. Standalone: the
untouched CLI form renders and its `/api/auth/login` POST works, because M1–M3 kept
that route public.

### W1 · `components/DaaSProviderWrapper.tsx` (micro-app)

The CLI wrapper (1.11.1) builds one `config` in a `useMemo(…, [])` whose `getToken`
reads `supabase.auth.getSession()` — which is always null in a framed micro-app,
because no Supabase session exists on this origin. Do not replace the wrapper (the
Supabase path is what standalone mode uses).

W1 has **two halves**. The token fallback makes an authenticated call possible. The
readiness gate makes it happen before the module's first fetch. Applying only the first
half ships a broken frame that passes every other check in this skill.

**W1a — the token fallback.** Three edits, anchored on the real shape:

1. Add the import: `import { useMfeToken } from '@/lib/bridge/useMfeToken';`
2. First line of the component body: `const { token: mfeToken, ready } = useMfeToken();`
3. In the existing `config` memo, change the `getToken` return to fall back to the
   bridge token, and add `mfeToken` to the dependency array — **both**:

```ts
const { token: mfeToken, ready } = useMfeToken();

const config = useMemo(
  () => ({
    url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? '',
    getToken: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      // Framed: the bridge token IS the session.
      return data.session?.access_token ?? mfeToken ?? null;
    },
    getHeaders: /* … keep the CLI scope-header block unchanged … */,
  }),
  [mfeToken],  // ← REQUIRED. DaaSProvider's refreshToken is useCallback([config])
               //   behind a one-shot effect: with [], it runs once at mount,
               //   BEFORE the bridge delivers a token, and dynamicToken stays
               //   null forever — every direct call and /api/users/me 401s,
               //   while the H1 proxy routes keep working, which hides it.
);
```

Do NOT capture `mfeToken` in a ref inside a `[]` memo — the ref updates but the
memoized `getToken` already ran and `refreshToken` never re-fires. The dependency
array is the mechanism, not a style choice.

**W1b — the readiness gate.** The CLI wrapper has no readiness state of its own.
**Create one.** Do not skip this step because there is nothing to modify:

Add `import { Center, Loader } from '@mantine/core';` to the wrapper's imports (the
CLI file does not import them), then:

```tsx
  // Pinned edit W1b: hold the children until the bridge token exists.
  // A module that mounts token-less fires its list fetches with no Authorization
  // header, receives 401, and does NOT retry — its data effects depend on its own
  // filter state, not on the DaaS config identity.
  const { token: mfeToken, resolved: mfeResolved } = useMfeToken();
  // ...
  if (!mfeResolved) {
    return (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    );
  }
```

`useMfeToken` therefore returns `{ token, resolved }`, not a bare string: `resolved`
flips true immediately when standalone, and in the frame only once the token question
is settled. Verified in production on both micro-apps — before the gate, the deployed
frame showed "Failed to load users — Not authenticated" and a silently empty file list
over a backend holding a file; after it, zero 401/403 responses inside the frame.

`ready` is `false` on the server and on the first client render, so there is no
hydration mismatch. Standalone it flips true in the first effect, which costs one
skeleton frame and no request.

Measured without the gate, on the deployed origins:

```
+4288ms  REQ  daas/api/users   Authorization: NONE   ← module mount fetch
+5116ms  RESP 200 /api/auth/token                    ← bridge token, 828 ms late
         RESP 401 daas/api/users
frame:   "Failed to load users — Not authenticated"   (terminal, never retries)
```

The Files module is worse: it swallows the same 401 and renders its empty state over a
backend that holds files. Both modules work standalone, so only an in-frame check finds
this.

`useMfeToken` reads `/api/auth/token`, treats a redirect or non-JSON response as
unauthenticated (a redirect to `/login` returns 200 text/html — `response.ok` alone
lies), re-requests through the bridge on failure, and re-reads whenever
`MicroappBridgeProvider` stores a fresh token. It returns `{ token, ready }`, and
`ready` turns true on **both** outcomes — a token and a genuine sign-out — so an
unauthenticated frame still renders instead of hanging on the skeleton. All other
`daas-platform` rules stand: wrapper in `(authenticated)/layout.tsx`, never null the
global config on unmount, `getHeaders` reads the scope cookie.

Cold-start note: the first framed load logs several `GET /api/auth/token` 401s before
the handshake completes. That is the designed `MICROAPP_NEEDS_AUTH` path, not a fault.
React StrictMode doubles the count in development.

### H1 · `lib/api/auth-headers.ts` (both micro-apps)

The CLI installs ~16 proxy routes (`/api/items`, `/api/files`, `/api/folders`,
`/api/collections`, `/api/fields`, `/api/permissions/me`, `/api/assets`,
`/api/relations`, `/api/auth/user`, …) that all build their `Authorization` header
here from `supabase.auth.getSession()` — which is empty inside the frame, so all 16
answer 401 and the Files module, permission gates, and profile menu die. One edit
fixes all of them. Where the helper resolves the token:

```ts
import { cookies } from 'next/headers';
import { MFE_TOKEN_COOKIE } from '@/lib/bridge/mfe-cookies';

// Framed micro-app: the bridge token is the session.
const mfeToken = (await cookies()).get(MFE_TOKEN_COOKIE)?.value;
const token = mfeToken ?? session?.access_token;
```

`lib/module-access/enforce.ts` and `app/api/auth/user/route.ts` call
`supabase.auth.getUser()` directly — apply the same fallback there if the project uses
module access or the shell's profile fetch.

**H1 does not cover a direct-call module.** A CLI module whose hooks import
`lib/buildpad/services/api-request.ts` sends its requests to the DaaS origin, not to a
Next route, so `auth-headers.ts` is never in its path. The Users module is one: every
`useUsers`, `useRoles`, `usePolicies`, and permissions call goes through
`api-request.ts` and is authenticated by W1 alone. Identify the path before you debug
an empty module:

```bash
grep -rl "services/api-request" components lib   # → W1 is load-bearing
grep -rn "fetch('/api/" components lib           # → H1 is load-bearing
```

Apply both edits in every micro-app. A perfect H1 with a missing W1 gate looks like a
permissions failure and reads like a backend fault.

### E1 · `app/(authenticated)/layout.tsx` (micro-app)

Rule 15: a framed micro-app renders **content only** — the host already provides the
sidebar, header, breadcrumb, and profile menu. Without this edit the frame shows a
second copy of all of them, and the inner nav can move the frame to a different page
than the section the host has open.

The framed/standalone decision is made **server-side, per server render**. The trap is
that one framed page produces several server renders, and only the first one is a
document load.

`Sec-Fetch-Dest` alone is not enough. Measured on a live pair of apps:

| Request | `Sec-Fetch-Dest` | Bridge cookie sent |
| --- | --- | --- |
| The iframe document load | `iframe` | no (first load) |
| An RSC fetch, `GET /files?_rsc=…` | `empty` | yes |
| `router.refresh()` from the bridge provider | `empty` | yes |
| A direct top-level visit | `document` | no |

A condition written as `dest === 'iframe' || (dest === null && cookie)` is **false**
for `empty`. The RSC render therefore mounts `AuthenticatedShell` and replaces the
content-only tree with a second sidebar, header, and profile footer inside the host's.
`MicroappBridgeProvider` calls `router.refresh()` at the end of `applyAuth` and on
`SET_SCOPE`, so this fires on the first cold frame, on every token renewal, and on
every tenant switch. It self-corrects on a later client-side host navigation, which is
why it survives a casual check.

Make the bridge cookie the primary signal and the header the fallback. A standalone
visitor never holds `mfe_access_token`, because only the frame handshake writes it:

```tsx
import { cookies, headers } from 'next/headers';
import { MFE_TOKEN_COOKIE } from '@/lib/bridge/mfe-cookies';

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Pinned edit E1 (add-microfrontend Rule 15): content only inside the frame.
  // Sec-Fetch-Dest is 'iframe' only on the FIRST document load; every RSC render
  // and every router.refresh() sends 'empty'. Read the marker for those.
  const dest = (await headers()).get('sec-fetch-dest');
  const framed =
    dest === 'iframe' ||
    (dest !== 'document' && (await cookies()).has(FRAMED_COOKIE));
  return (
    <DaaSProviderWrapper>
      {framed ? children : <AuthenticatedShell>{children}</AuthenticatedShell>}
    </DaaSProviderWrapper>
  );
}
```

Notes:
- `headers()` makes these routes render dynamically. They already sit behind auth
  middleware, so nothing cacheable is lost.
- **Use a dedicated marker cookie (`FRAMED_COOKIE` in `mfe-cookies.ts`), never the
  token cookie.** The token cookie lives on the micro-app's own origin for ~1 h, so a
  direct visit inside that window would be misread as framed. The marker is written by
  the middleware (E1b) on the `iframe` document load and **deleted** on a `document`
  load, so a direct visit self-corrects on its first request.
- `dest !== 'document'` keeps a top-level visit on the shell path. On localhost every
  port shares one cookie jar, so this branch matters even in dev.

**E1b — the middleware writes the marker.** The layout cannot set cookies; the
middleware can, and it already runs on every request:

```ts
function markFramed(request: NextRequest, response: NextResponse) {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest === 'iframe') {
    response.cookies.set(FRAMED_COOKIE, '1', {
      httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/',
    });
  } else if (dest === 'document') {
    response.cookies.delete(FRAMED_COOKIE);
  }
  return response;
}
```

Wrap **every** response the middleware returns. Without E1b, `router.refresh()` (fired
by `applyAuth` and `SET_SCOPE`) re-runs the layout with `dest: 'empty'`, the shell
returns mid-session, and it stays: two sidebars, two headers, and an in-frame nav that
can steer the frame off the host's section. Verified in production on both apps.
- E1 supersedes the earlier S2 edit (hiding just the sign-out item): with no shell
  in the frame, there is no in-frame sign-out to hide. Micro-apps leave
  `AuthenticatedShell.tsx` itself untouched.
- Verify E1 on a **fresh** load of the section, not after a client-side host
  navigation. Assert that the frame body contains no `MAIN MENU` label, no nav links,
  and no profile e-mail.

### S1 · `components/layout/AuthenticatedShell.tsx` (host)

See SKILL Step 3: make the sign-out `onClick` async, `await logoutAllMicroapps()`
first, then the existing `window.location.href = '/api/auth/logout'` navigation. The
await matters — the assignment unloads the page, and the broadcast's 300 ms drain is
what lets each frame finish its own logout request.

## Sign-out order

1. Shell sign-out control: `await logoutAllMicroapps()` — broadcasts `LOGOUT` to every
   mounted frame, waits 300 ms.
2. Each frame POSTs its own `/api/auth/logout`, which deletes its three bridge
   cookies (L1) on its own origin.
3. The host then navigates to its CLI `GET /api/auth/logout` — Supabase `signOut()`,
   scope-cookie cleanup, OAuth SLO if applicable.

The order is not optional: sign the host out first and the page unloads before the
frames hear anything, leaving their cookies alive until token expiry.

A micro-app never renders its own sign-out control inside the frame (SKILL Rule 15) —
it would clear only its own cookies, and the next `MICROAPP_NEEDS_AUTH` signs the user
straight back in.

## Scope across the origin

`DaaSProvider.getHeaders` reads the `daas_resource_uri` cookie and sends it as
`X-Resource-Uri`. That cookie is set on the host origin; the micro-app origin never
receives it on its own. On a project using `manage-scope` or `add-multitenancy`:

1. The host reads its own scope cookie into `SET_AUTH.resource_uri`.
2. `set-session` writes the cookie on the micro-app origin (Partitioned, like the
   token cookies).
3. On a tenant switch the host calls `broadcastScope(uri)`; each frame rewrites the
   cookie and calls `router.refresh()`.

On a project using neither, nothing writes that cookie anywhere — no header is
expected, and none of the scope checks apply (SKILL Rule 11).

**Validate `resource_uri` before you store it.** The `SET_SCOPE` handler must check the
value against the shape the project uses, ignore a value that fails, and clear the
cookie instead of persisting a rejected one. A type check for `string` is not enough:
sending `resource_uri: '/'` turned a working framed users list into
`Failed to load users — Invalid resource URI: /`, and the state survived every reload,
because the bad value lives in a cookie and rides `X-Resource-Uri` on every direct DaaS
call. There is no recovery path inside the micro-app. Report a rejected scope to the
host as a bridge error, not as a module error state.

## Checklist

- [ ] `SET_AUTH` carries no refresh token, and the host calls `refreshSession()`
      inside the 90 s window.
- [ ] `set-session` rejects cross-site callers *before* validating the token.
- [ ] All bridge cookies use `SameSite=None; Secure; Partitioned` via
      `framedCookieOptions`.
- [ ] M1–M3, L1, P1, W1, E1, H1 applied; every merged file carries the
      LOCAL MODIFICATION banner; no `@buildpad-origin` file was replaced.
- [ ] Framed: no sidebar/header/profile chrome inside the frame, on a **fresh** load of
      the section and after a `SET_SCOPE`. Standalone: the full shell renders. Compare
      all four header values — `iframe`, `empty` with the bridge cookie, `document`,
      and absent — not only `iframe` against absent.
- [ ] W1b is present: the wrapper renders a placeholder while `resolved` is false. Grep
      the wrapper for `ready` and fail on a wrapper that only added the token fallback.
- [ ] Zero 401 and zero 403 DaaS responses inside the frame, recorded from the network
      log. Rendered text is not evidence: the Files module renders its empty state on a
      401.
- [ ] L1 expires cookies via `framedCookieOptions(0, …)` — grep the logout route for
      `cookieStore.delete(MFE` and fail on any hit.
- [ ] W1's config memo lists `mfeToken` in its dependency array.
- [ ] `/api/auth/token` answers 401 JSON to an unauthenticated caller — never a
      redirect.
- [ ] Standalone mode still works: `/login` shows the form outside a frame, and
      sign-in through it succeeds.
- [ ] The renewal test (expiry cookie → now+70 s) completes a second round trip.
