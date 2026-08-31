# Troubleshooting

## The frame asks the user to sign in again

The middleware found no valid session and the handshake did not complete.

1. Open the browser console on the host page. A blocked `postMessage` target origin
   means `HOST_ORIGIN` in the micro-app `config/app-urls.ts` is not the host's real
   origin.
2. Check the Network tab for `POST /api/auth/set-session`. A 403 means the origin
   check rejected it (is the page proxied so `publicOrigin` disagrees with the
   browser?). A 401 means the token did not validate. A 307 means the CLI middleware
   no longer treats `/api/auth` as public — restore its route table (pinned edits
   M1–M3 add to it, never replace it).
3. **`set-session` returns 200 but the next request still redirects to `/login`** →
   the browser dropped the third-party cookie. Check all three cookie attributes
   (`SameSite=None; Secure; Partitioned`) and test in the same browser profile the
   user reported. Safari and Incognito are the usual reporters.
4. Check that `app/login/page.tsx` still renders `LoginBridge` (pinned edit P1) — a
   `buildpad upgrade` may have restored the plain form.

## The micro-app redirects to the HOST's login page inside its own frame

`NEXT_PUBLIC_HOST_ORIGIN` (or `HOST_ORIGIN`) is set in the micro-app's environment.
Those names are reserved by the CLI's `lib/origin.ts` and mean *this app's own*
origin — the middleware builds its login redirect from them, so the frame is sent to
another app's `/login`, which `frame-ancestors` then blocks (blank frame, watchdog
error). Unset them; the Main App origin travels in `NEXT_PUBLIC_MICROAPP_URL_MAIN`
(SKILL Rule 17).

## Every micro-app signs the user out about an hour after sign-in

`SET_AUTH` is carrying a refresh token. Remove it. Supabase revoked the session family
after two apps reused the same rotated token. See
[auth-bridge](auth-bridge.instructions.md).

## The frame and host loop MICROAPP_NEEDS_AUTH / SET_AUTH

The host is answering with an unchanged `expires_at`. Its handler must call
`refreshSession()` when the session has under 90 s left — `getSession()` alone
returns the same token. The frame side must also be the shipped version: it clamps
retries to ≥ 5 s and ignores a token that does not advance expiry.

## The micro-app reloads on every keystroke

The iframe `src` is being computed from the host `searchParams`. Freeze it. See
[url-and-history](url-and-history.instructions.md). Confirm with the spec's
*search reaches the host URL without reloading the frame* test.

## Data is empty everywhere, DaaS calls blocked before any response

Look at the console: a CORS error naming `Access-Control-Allow-Origin: *` with
`credentials: 'include'` means Step 6 was never run — the DaaS default blocks every
credentialed call. Run the `mcp_daas_cors-settings` update and re-verify with the
Step 6 `curl`.

## The Files module / permissions / profile menu 401 inside the frame

Pinned edit H1 is missing: the CLI's `lib/api/auth-headers.ts` reads only the
Supabase session, which does not exist on the frame origin. Apply H1 (read
`mfe_access_token` first). If module access is in use, apply the same fallback in
`lib/module-access/enforce.ts`.

## DaaS returns 403 FORBIDDEN_SCOPE from inside the frame

Scope projects only. The `daas_resource_uri` cookie is missing on the micro-app
origin, so the request resolved at root scope.

1. Confirm the host puts `resource_uri` in `SET_AUTH`.
2. Confirm `set-session` writes the cookie (Partitioned).
3. Confirm `X-Resource-Uri` is in the DaaS `cors_allowed_headers`.

A 403 immediately after a second user signs in means a stale cookie survived the
previous sign-out — pinned edit L1 deletes it.

## The host shows "This section did not load" but the micro-app works on its own

The load watchdog fired because `MICROAPP_LOADED` never arrived.

1. Confirm `MicroappBridgeProvider` is in the micro-app **root** layout.
2. Check the console for a CSP violation — a `frame-ancestors` value that omits the
   host origin blocks the frame, and the failure is opaque to the host. In dev, the
   micro-app's `next.config.ts` must include `http://localhost:3000` under the
   `NODE_ENV` gate.
3. Raise `loadTimeoutMs` if a cold Amplify SSR start takes longer than 15 seconds.

## Clicking Sign out lands on a blank error page

The micro-app's `app/api/auth/logout/route.ts` lost its GET handler — the shell
navigates to that route with a plain GET. Pinned edit L1 *adds* the cookie deletes to
the CLI route; it never replaces the file.

## The user signs out in the host, but a micro-app still renders data

1. Confirm the shell's sign-out control `await`s `logoutAllMicroapps()` **before**
   the `location.href` navigation (pinned edit S1) — the assignment unloads the page,
   so an unawaited call loses the 300 ms drain.
2. Confirm the micro-app middleware validates via `getMfeUser` (Auth-server
   `getUser`, not a local decode).
3. If both hold, the token is simply still valid. That window is bounded by the JWT
   lifetime.

## `pnpm build` fails after adding the tests

`@playwright/test` is not installed — the spec is inside tsconfig's `**/*.ts`
include, so `next build` type-checks it. Run the Step 7 installs. Never "fix" this by
excluding `tests/` from tsconfig; the suite stops type-checking with the app.

## A confirmation dialog does nothing

The code calls `window.confirm` / `window.prompt` — the sandbox omits `allow-modals`,
deliberately. Replace the call with a Mantine `Modal`. The CLI's
`rich-text-markdown.tsx` link button is a known instance (SKILL Step 4 audit).

## A download does nothing

`allow-downloads` is missing from the sandbox attribute.

## The frame shows its own sidebar, header, and profile menu (chrome inside chrome)

Pinned edit E1 is missing: the micro-app's `app/(authenticated)/layout.tsx` still
wraps every page in `AuthenticatedShell`. Inside the host frame that renders a second
shell — and its nav lets the user move the frame to a page the host section does not
match (the host says Files while the frame shows the micro-app's Home). Apply E1: the
layout skips the shell when the document request carries `Sec-Fetch-Dest: iframe`
(bridge-cookie fallback), and keeps it for direct visits.

## Two scrollbars

The host page and the frame both scroll. Set `overflow: hidden` on the host container
and let the micro-app scroll inside the frame.

## It works locally but not deployed (or the reverse)

Local and deployed differ by construction:

- Locally, all apps are the same *site* (localhost), so partitioned-cookie failures
  and third-party-cookie blocking never reproduce — test those deployed, in Safari.
- Deployed, `request.url` names the server process — every redirect must come from
  `publicOrigin()`, which is why the CLI middleware is merged, never replaced.
- Local dev needs the `NODE_ENV`-gated localhost entries in both CSP headers and the
  localhost ports in `CORS_ORIGINS`.
