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
Verify the handshake on the deployed origins, in Safari or an Incognito window, before
calling the bridge done.

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
Supabase path is what standalone mode uses). Three edits, anchored on the real shape:

1. Add the import: `import { useMfeToken } from '@/lib/bridge/useMfeToken';`
2. First line of the component body: `const mfeToken = useMfeToken();`
3. In the existing `config` memo, change the `getToken` return to fall back to the
   bridge token, and add `mfeToken` to the dependency array — **both**:

```ts
const mfeToken = useMfeToken();

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

`useMfeToken` reads `/api/auth/token`, treats a redirect or non-JSON response as
unauthenticated (a redirect to `/login` returns 200 text/html — `response.ok` alone
lies), re-requests through the bridge on failure, and re-reads whenever
`MicroappBridgeProvider` stores a fresh token. All other `daas-platform` rules stand:
wrapper in `(authenticated)/layout.tsx`, never null the global config on unmount,
`getHeaders` reads the scope cookie.

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

### S2 · `components/layout/AuthenticatedShell.tsx` (micro-app)

The CLI shell renders its own Sign out menu item, which Rule 15 forbids inside the
frame — clicking it clears only this app's cookies and `SET_AUTH` signs the user
straight back in. Do not delete it (standalone mode needs it): render it
conditionally. In the component body add

```ts
const [framed, setFramed] = useState(false);
useEffect(() => { setFramed(window.parent !== window); }, []);
```

and wrap the sign-out `Menu.Item` in `{!framed && ( … )}`. Standalone keeps the
control; the frame hides it.

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

## Checklist

- [ ] `SET_AUTH` carries no refresh token, and the host calls `refreshSession()`
      inside the 90 s window.
- [ ] `set-session` rejects cross-site callers *before* validating the token.
- [ ] All bridge cookies use `SameSite=None; Secure; Partitioned` via
      `framedCookieOptions`.
- [ ] M1–M3, L1, P1, W1, S2, H1 applied; every merged file carries the
      LOCAL MODIFICATION banner; no `@buildpad-origin` file was replaced.
- [ ] L1 expires cookies via `framedCookieOptions(0, …)` — grep the logout route for
      `cookieStore.delete(MFE` and fail on any hit.
- [ ] W1's config memo lists `mfeToken` in its dependency array.
- [ ] `/api/auth/token` answers 401 JSON to an unauthenticated caller — never a
      redirect.
- [ ] Standalone mode still works: `/login` shows the form outside a frame, and
      sign-in through it succeeds.
- [ ] The renewal test (expiry cookie → now+70 s) completes a second round trip.
