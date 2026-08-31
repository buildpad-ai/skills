# Troubleshooting

## The frame asks the user to sign in again

The micro-app middleware found no valid `mfe_access_token` cookie, and the handshake
did not complete.

1. Open the browser console on the host page. Look for a message about a blocked
   `postMessage` target origin. A mismatch means `HOST_ORIGIN` in the micro-app
   `config/app-urls.ts` is not the host's real origin.
2. Check the Network tab for `POST /api/auth/set-session`. A 307 means the route is
   missing from `PUBLIC_ROUTES`. A 401 means the token did not validate.
3. Check that the browser is not blocking third-party cookies.
4. Check that `LOGIN_ROUTE` matches the file at `app/login/page.tsx`. A redirect to a
   route that does not exist produces a loop.

## Every micro-app signs the user out about an hour after sign-in

`SET_AUTH` is carrying a refresh token. Remove it. Supabase revoked the session family
after two apps reused the same rotated token. See
[auth-bridge](auth-bridge.instructions.md).

## The micro-app reloads on every keystroke

The iframe `src` is being computed from the host `searchParams`. Freeze it. See
[url-and-history](url-and-history.instructions.md).

Confirm with the test `a synced parameter change does not reload the frame`.

## DaaS returns 403 FORBIDDEN_SCOPE from inside the frame

The `daas_resource_uri` cookie is missing on the micro-app origin, so the request
resolved at root scope.

1. Confirm the host puts `resource_uri` in `SET_AUTH`.
2. Confirm `/api/auth/set-session` writes the cookie.
3. Confirm the cookie uses `SameSite=None; Secure`.
4. Confirm `X-Resource-Uri` is in the DaaS `cors_allowed_headers`.

A 403 immediately after a second user signs in means a stale cookie survived the
previous sign-out. The micro-app logout route must delete `daas_resource_uri`.

## The host shows "This section did not load" but the micro-app works on its own

The load watchdog fired because `MICROAPP_LOADED` never arrived.

1. Confirm `MicroappBridgeProvider` is in the micro-app root layout, not only in the
   authenticated layout.
2. Check for a CSP violation in the console. A `frame-ancestors` value that omits the
   host origin blocks the frame, and the failure is opaque to the host.
3. Raise `loadTimeoutMs` if a cold Amplify SSR start takes longer than 15 seconds.

## The host back button steps through states the user cannot see

Something is calling `push` where it must call `replace`. Check the table in
[url-and-history](url-and-history.instructions.md).

## A confirmation dialog does nothing

The code calls `window.confirm`. The sandbox omits `allow-modals`. Replace the call
with a Mantine `Modal`. Do not add the flag.

## A download does nothing

`allow-downloads` is missing from the sandbox attribute.

## The user signs out in the host, but a micro-app still renders data

1. Confirm the logout button calls `logoutAllMicroapps()` before it signs out.
2. Confirm the micro-app middleware calls `getUser`, not `getSession`.
3. If both are correct, the access token is still valid and the Auth server still
   accepts it. Shorten the project JWT expiry.

## Two scrollbars

The host page and the frame both scroll. Set `overflow: hidden` on the host container
and let the micro-app scroll inside the frame.

## It works when deployed but not locally

`localhost:3000` and `localhost:3001` are different origins, so the bridge is required
locally too.

1. Set `NEXT_PUBLIC_HOST_ORIGIN` and the micro-app URL overrides in each `.env.local`.
2. Add every local port to `CORS_ORIGINS` in DaaS.
3. Add every local origin to `frame-ancestors` and `frame-src`.
4. Cookies with `Secure` are accepted on `http://localhost`, but not on other plain
   HTTP hosts.
