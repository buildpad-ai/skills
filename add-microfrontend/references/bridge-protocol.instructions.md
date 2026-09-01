# Bridge Protocol

Every message between the Main App and a micro-app uses this contract. The contract
lives in one file, `assets/shared/bridge-protocol.ts`. Copy that file to both sides.
Do not retype the message shapes.

## Envelope

Every message has three fixed fields.

| Field    | Value            | Purpose                                                        |
| -------- | ---------------- | -------------------------------------------------------------- |
| `source` | `'buildpad-mfe'` | Separates bridge messages from other `postMessage` traffic.     |
| `v`      | `1`              | Protocol version. A receiver ignores a version it does not know. |
| `type`   | see below        | The message name.                                              |

Build every message with `bridgeMessage(type, payload)`. Read every message through
`isBridgeMessage(event.data)` first.

## Messages

### Micro-app to host

| Type                  | Payload                        | Meaning                                                    |
| --------------------- | ------------------------------ | ---------------------------------------------------------- |
| `MICROAPP_LOADED`     | —                              | The frame is alive. The host hides its skeleton.            |
| `MICROAPP_NEEDS_AUTH` | —                              | The frame has no valid token, or its token expires soon.    |
| `QUERY_PARAMS_CHANGE` | `{ params }`                   | An allowlisted parameter changed inside the frame.          |
| `NAVIGATE`            | `{ path }`                     | The frame asks the host to navigate the whole page.         |
| `RESIZE`              | `{ height }`                   | Content height, for height-following embeds only.           |

### Host to micro-app

| Type               | Payload                                      | Meaning                                       |
| ------------------ | -------------------------------------------- | --------------------------------------------- |
| `SET_AUTH`         | `{ access_token, expires_at, resource_uri? }` | A fresh access token. Never a refresh token.   |
| `SET_SCOPE`        | `{ resource_uri }`                            | The active tenant changed.                     |
| `SET_QUERY_PARAMS` | `{ params }`                                  | The host URL changed from outside the frame.   |
| `SET_THEME`        | `{ colorScheme }`                             | The host color scheme changed.                 |
| `SET_LOCALE`       | `{ locale }`                                  | The host locale changed.                       |
| `LOGOUT`           | —                                             | The user signed out. Clear local cookies now.  |

There is no `AUTH_EXPIRED` message. A frame that loses its session sends
`MICROAPP_NEEDS_AUTH`. See [auth-bridge](auth-bridge.instructions.md).

## Sequence: first load and sign-in

```
Host page renders  ──> <iframe src="https://microapp/...">
                        │
                        ├─ micro-app middleware: no mfe_access_token cookie
                        │  redirect 307 -> /login?next=/users
                        │
                        ├─ /login renders LoginBridge
                        │  MICROAPP_NEEDS_AUTH ───────────────> host
                        │  (repeats every 500 ms, up to 15 s)
                        │
                        │  <────────── SET_AUTH { access_token, expires_at, resource_uri }
                        │
                        ├─ POST /api/auth/set-session
                        │  route validates the token with supabase.auth.getUser(token)
                        │  route sets mfe_access_token (httpOnly), mfe_expires_at,
                        │  daas_resource_uri
                        │
                        └─ window.location.replace('/users')
                           MicroappBridgeProvider mounts
                           MICROAPP_LOADED ─────────────────────> host hides skeleton
```

## Sequence: token renewal

The host owns refresh. The micro-app never holds a refresh token.

```
MicroappBridgeProvider sets a timer for expires_at - 60 s (clamped to >= 5 s)
        │
        ├─ MICROAPP_NEEDS_AUTH ──────────────────> host
        │                                          getSession(); if < 90 s left:
        │                                          refreshSession()  ← the host is
        │                                          the ONLY refresh client
        │  <──────────────────────────────────── SET_AUTH { new token }
        │     (a token whose expires_at does not
        │      advance is ignored — no loops)
        │
        └─ POST /api/auth/set-session -> new cookie, new timer
```

## Sequence: sign-out

```
User clicks Sign out in the host shell
        │
        ├─ await logoutAllMicroapps()
        │     LOGOUT ─────────────> every mounted frame
        │                           POST /api/auth/logout on its own origin
        │                           deletes mfe_access_token, mfe_expires_at,
        │                           daas_resource_uri            (pinned edit L1)
        │  (the host waits 300 ms — the drain)
        │
        └─ window.location.href = '/api/auth/logout'
           the CLI GET route: signOut(), scope cleanup, OAuth SLO
```

The `await` is not optional: the `location.href` assignment unloads the page, so an
unawaited broadcast loses the drain and the frames never finish their requests.

The order matters. The host cannot delete a cookie on a micro-app origin. If the host
signs out first and the page unloads, the frames never get the message and their
cookies survive until the access token expires.

## Adding a message

1. Add the type to `assets/shared/bridge-protocol.ts`.
2. Copy the file to the Main App and to every micro-app.
3. Handle the new type in `useMicroappHost.ts` or `MicroappBridgeProvider.tsx`.
4. Leave `BRIDGE_VERSION` at `1` for an additive change. Raise it only when you change
   or remove an existing payload, and deploy every app before you raise it.
