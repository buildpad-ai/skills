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

## Rule: the host owns refresh

`SET_AUTH` carries `access_token` and `expires_at`. It must never carry
`refresh_token`.

Supabase rotates refresh tokens. A consumed refresh token is accepted again only
inside the reuse interval, which defaults to 10 seconds. A later reuse is treated as
possible theft, and Supabase can revoke the whole session family.

If the host and three micro-apps each hold the same refresh token, each one refreshes
on its own when the access token expires. The first app wins. The others present a
consumed token. The result is a forced sign-out of every app about one hour after
sign-in.

With host-owned refresh there is exactly one refresh client: the Main App browser
client. Each micro-app asks for a new access token before its current one expires.

> **Confirm this against your Supabase version.** Sign in, wait for the access token
> to expire, then use the host and two micro-apps. All three must stay signed in.

## Rule: validate every token before you store it

`POST /api/auth/set-session` is a public route. Anything on the page can call it. The
route must call `supabase.auth.getUser(access_token)` and reject the request when the
Auth server does not accept the token. See `assets/microapp/set-session.route.ts`.

## Rule: the micro-app middleware uses `getUser`, never `getSession`

`getUser(token)` validates the token against the Auth server on every request.
`getSession()` only decodes it locally. Only `getUser` observes a sign-out that
happened somewhere else.

An unexpired access token can still outlive a global sign-out. Test it: sign out in
the host, then reload a micro-app route directly. If the micro-app still renders,
shorten the JWT expiry for the project.

## Rule: one route table

Every route name comes from `PUBLIC_ROUTES` and `LOGIN_ROUTE` in
`assets/microapp/middleware.ts`. Do not write a route name anywhere else.

| Route                    | Public | Why                                                    |
| ------------------------ | ------ | ------------------------------------------------------ |
| `/login`                 | yes    | Runs the handshake. The middleware sends users here.    |
| `/api/auth/set-session`  | yes    | The handshake target. It has no cookie yet.             |
| `/api/auth/logout`       | yes    | The caller has just lost its session.                   |
| `/api/auth/token`        | no     | The middleware must validate the cookie first.          |
| everything else          | no     | —                                                       |

The middleware matcher excludes static assets only. Do not exclude auth routes by
prefix: `/api/auth/set-session` starts with `api`, not `auth`, so a prefix rule lets
the middleware run on the bridge call and redirect it.

Set `DEFAULT_AUTHENTICATED_ROUTE` in the micro-app `config/app-urls.ts` to the
micro-app's first real route. Do not hardcode `/content`.

## Rule: the scope header must cross the origin

Buildpad components call DaaS directly from the browser. `DaaSProvider.getHeaders`
reads the `daas_resource_uri` cookie and sends it as `X-Resource-Uri`. That cookie is
set on the host origin, so the micro-app origin never receives it on its own.

Without the fix, every micro-app call on a project that uses `manage-scope` or
`add-multitenancy` resolves at root scope and returns 403.

1. The host reads its own `daas_resource_uri` cookie and puts the value in
   `SET_AUTH.resource_uri`.
2. `/api/auth/set-session` writes `daas_resource_uri` on the micro-app origin.
3. On a tenant switch, the host calls `broadcastScope(resourceUri)`. Each micro-app
   rewrites the cookie and calls `router.refresh()`.

The cookie must use `SameSite=None; Secure`. A `Lax` cookie is not sent inside a
cross-site frame.

## DaaSProvider in a micro-app

The micro-app has no Supabase session, so `DaaSProviderWrapper` cannot call
`supabase.auth.getSession()`. It reads the token from `/api/auth/token` instead.
Every other rule in [daas-platform](../../daas-platform/SKILL.md) still applies:
place the wrapper in `app/(authenticated)/layout.tsx`, pass `token` as a sync prop,
gate `ready` on a non-null token, and never null the global config on unmount.

```tsx
// components/DaaSProviderWrapper.tsx (micro-app variant)
'use client';

const [token, setToken] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;

  async function load() {
    const response = await fetch('/api/auth/token', { credentials: 'include' });
    if (!response.ok) {
      // The cookie expired between renders. Ask the host for a new token.
      postToHost(bridgeMessage('MICROAPP_NEEDS_AUTH'));
      return;
    }
    const { access_token } = await response.json();
    if (!cancelled) setToken(access_token);
  }

  void load();
  // Re-read after MicroappBridgeProvider stores a new token.
  const unsubscribe = onAuthApplied(() => void load());

  return () => {
    cancelled = true;
    unsubscribe();
  };
}, []);
```

Keep `getHeaders` exactly as `daas-platform` specifies. It reads the same
`daas_resource_uri` cookie that `/api/auth/set-session` wrote.

## Sign-out

Follow the sequence in [bridge-protocol](bridge-protocol.instructions.md). The host
button must call `logoutAllMicroapps()` before `POST /api/auth/logout`.

Every micro-app logout route deletes `daas_resource_uri` as well as its token
cookies. A stale scope cookie is forwarded as `X-Resource-Uri` for the next user and
causes an immediate 403 FORBIDDEN_SCOPE. See Bug 20 in
[authentication-proxy](../../authentication-proxy/SKILL.md).

## Direct calls and proxy routes

The split is the same as in [authentication-proxy](../../authentication-proxy/SKILL.md).

| Caller                                            | Path                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| Buildpad UI components (`CollectionList`, `VForm`) | Direct to DaaS, through `DaaSProvider`.            |
| Your own hand-written fetches                      | Through a Next.js proxy route in the same app.     |

Do not generate `/api/items/[collection]/route.ts` unless the app has hand-written
data calls. When you do generate it, `getAuthHeaders` reads the token from
`mfe_access_token` in a micro-app, not from a Supabase session.

## Checklist

- [ ] `SET_AUTH` carries no refresh token.
- [ ] `/api/auth/set-session` validates the token with `getUser` before it sets a cookie.
- [ ] Token cookies use `httpOnly`, `Secure`, and `SameSite=None`.
- [ ] The micro-app middleware calls `getUser`, not `getSession`.
- [ ] `PUBLIC_ROUTES` is the only place a route name is written.
- [ ] `DEFAULT_AUTHENTICATED_ROUTE` points at a route that exists.
- [ ] `SET_AUTH` carries `resource_uri` on any project that uses scopes.
- [ ] The host logout broadcasts `LOGOUT` before it signs out.
- [ ] Every micro-app logout route deletes `daas_resource_uri`.
- [ ] The expiry test passes: host and two micro-apps stay signed in past the access token lifetime.
