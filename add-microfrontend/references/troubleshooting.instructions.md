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
*in-frame state reaches the host URL without reloading the frame* test.

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

`allow-downloads` **or** `allow-popups` is missing from the sandbox attribute. The
Files module downloads with `window.open` to a signed cross-origin URL, so the download
runs in a popup that inherits the frame sandbox and needs both flags. Read the browser
console: it names the missing flag.

Reproduce this headed. Headless Chromium drops the popup download and reports zero
files whether or not the flags are present.

## The Download button in the file preview opens the file instead of saving it

Not a composition defect — it behaves the same standalone. The CLI's asset proxy
(`app/api/assets/[id]/route.ts`) builds its response headers from scratch and forwards
only `Content-Type` and `Cache-Control`, so the `Content-Disposition: attachment` that
DaaS returns is stripped. `file-preview.tsx` renders a plain `<a href>` with no
`download` attribute and depends on that header.

The route carries `@buildpad-origin`. Do not edit it (Rule 9). Report it upstream: the
proxy must forward `Content-Disposition` and `Content-Length`. The row-menu and
file-detail downloads use the `window.open` signed-URL path and are unaffected.

## A framed confirmation dialog is dismissed by a click in the host

Working as built, and it is the reason destructive confirmations must not live in the
frame. The Mantine overlay and the focus trap end at the frame edge, so the host
sidebar stays lit and clickable and one click navigates the host away, discarding the
dialog and the selection behind it. Route any destructive or unsaved-state confirmation
to the host with `NAVIGATE` or an `OPEN_MODAL` message. See
[url-and-history](url-and-history.instructions.md).

## An in-frame click changes nothing in the host URL, and Back leaves the app

The parameter is allowlisted on one side only. `pickParams()` filters both directions,
so a parameter the micro-app posts and the host's `allowedParams` omits is dropped in
silence. Reconcile the two lists (SKILL Step 4).

If the parameter is right on both sides, the frame is changing its **path**, not its
query string. The bridge has no path-change message. Give the host a route for every
framed page the module can reach, and send `NAVIGATE` on cross-section links.

## A scope value breaks every DaaS call and survives a reload

The host sent a `resource_uri` the DaaS rejects, and `SET_SCOPE` stored it verbatim in
the `daas_resource_uri` cookie, from which `getHeaders` injects it as `X-Resource-Uri`
on every direct call. The symptom reads as data or permissions
(`Invalid resource URI: …`), not as a bridge fault, and clearing the cookie is the only
recovery inside the micro-app. Validate `resource_uri` in the `SET_SCOPE` handler before
you write the cookie (see [auth-bridge](auth-bridge.instructions.md)).

## The frame shows its own sidebar, header, and profile menu (chrome inside chrome)

Pinned edit E1 is missing: the micro-app's `app/(authenticated)/layout.tsx` still
wraps every page in `AuthenticatedShell`. Inside the host frame that renders a second
shell — and its nav lets the user move the frame to a page the host section does not
match (the host says Files while the frame shows the micro-app's Home). Apply E1.

## The double chrome appears only on a fresh load, a renewal, or a tenant switch

E1 is present but tests `Sec-Fetch-Dest` alone. Only the **first** document request
inside a frame carries `iframe`. An RSC fetch (`GET /files?_rsc=…`) and every
`router.refresh()` — the bridge provider calls it at the end of `applyAuth` and on
`SET_SCOPE` — re-render the same layout on the server with `Sec-Fetch-Dest: empty`, so
a condition written for `'iframe'` or a missing header is false and the shell mounts
over the content-only tree.

Make the bridge cookie the primary signal:
`dest === 'iframe' || (dest !== 'document' && cookies().has(MFE_TOKEN_COOKIE))`. The
full edit is in [auth-bridge](auth-bridge.instructions.md), E1. It self-corrects on a
later client-side host navigation, so reproduce it on a **fresh** load of the section.

## The framed module says "Not authenticated", or shows an empty list over real data

The module mounted before the bridge token arrived. Its first list fetch went out with
no `Authorization` header, DaaS answered 401, and the module does not retry — its data
effects depend on its own filter state, not on the DaaS config identity.

1. Check the network log inside the frame: a `daas/api/*` request with no
   `Authorization` header, followed by `GET /api/auth/token` **200 later**, is this.
2. Apply the second half of pinned edit W1 (W1b): `useMfeToken` returns
   `{ token, ready }`, and `DaaSProviderWrapper` renders a placeholder while `ready` is
   false.

The Users module shows the error text. The Files module swallows the 401 and renders
"Drag files here or click to select", which reads as an empty backend. Confirm with a
direct `curl` carrying a bearer token before you believe an empty state.

## The framed module hangs on "Loading" and DaaS requests have no responses yet

Backend latency, not the bridge. This DaaS answers list endpoints in about 13 seconds.
A 15-second observation window reports "no DaaS traffic" and a frozen frame, which
looks exactly like a broken handshake.

Confirm with a direct `curl` to the DaaS endpoint carrying a bearer token, and read the
elapsed time, before you touch any auth wiring. **A bridge failure is a fast 401, not a
hang.** Raise module-data waits in the specs to at least 90 s, and assert on response
status rather than rendered text.

## Two scrollbars

The host page and the frame both scroll. Set `overflow: hidden` on the host container
and let the micro-app scroll inside the frame.

## It works locally but not deployed (or the reverse)

Local and deployed differ by construction:

- Locally, all apps are the same *site* (localhost), so partitioned-cookie failures
  and third-party-cookie blocking never reproduce — test those deployed, in Safari.
- Cookies ignore the port, so `:3000` and `:3002` share **one** cookie jar. The host
  page can read the frame's `mfe_expires_at`, and the micro-app origin can read and
  delete the host's Supabase session cookie. Session isolation is real only on the
  deployed cross-site origins. Re-verify it there.
- A cold framed load logs several `GET /api/auth/token` 401s before the handshake
  completes. That is the designed `MICROAPP_NEEDS_AUTH` path, and it self-heals.
  StrictMode doubles the count in development. Do not chase it.
- Deployed, `request.url` names the server process — every redirect must come from
  `publicOrigin()`, which is why the CLI middleware is merged, never replaced.
- Local dev needs the `NODE_ENV`-gated localhost entries in both CSP headers and the
  localhost ports in `CORS_ORIGINS`.
