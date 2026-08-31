# Security

## Sandbox

```
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
```

| Flag                             | Status                        | Reason                                                                        |
| -------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `allow-scripts`                  | required                      | The micro-app is a Next.js app.                                               |
| `allow-same-origin`              | required                      | Cookies and storage on the micro-app origin.                                  |
| `allow-forms`                    | required                      | Form submission.                                                              |
| `allow-popups`                   | required                      | External links and OAuth windows.                                             |
| `allow-downloads`                | required                      | CSV export, and any download from the Files module.                           |
| `allow-popups-to-escape-sandbox` | only with `add-external-oauth` | A popup inherits this sandbox otherwise, and the OAuth flow fails.            |
| `allow-modals`                   | forbidden                     | Its absence is what blocks `window.confirm`. Micro-apps use Mantine `Modal`.  |
| `allow-top-navigation`           | forbidden                     | It lets a micro-app replace the host page.                                    |

Native dialogs are blocked by the missing `allow-modals` flag, not by a browser policy.
Do not add the flag to make a dialog work.

## Message validation

Every handler runs three checks before it reads a payload.

```ts
if (event.origin !== expectedOrigin) return;
if (event.source !== iframeRef.current?.contentWindow) return;  // host side
if (event.source !== window.parent) return;                     // micro-app side
if (!isBridgeMessage(event.data) || event.data.v !== BRIDGE_VERSION) return;
```

The origin check alone is not enough. Two frames of the same micro-app on one page each
pass an origin check for the other's messages. A same-origin popup or a nested frame
passes it too.

Validate the payload shape after the envelope. `typeof params !== 'object'` and
`typeof access_token !== 'string'` are not optional.

Never pass `'*'` as the target origin of a `postMessage` call.

## Clickjacking

A micro-app that holds a valid cookie can otherwise be framed by any site.
`X-Frame-Options` cannot list more than one origin, so use CSP. Both values come from
`config/app-urls.ts`, so generate them from the same context.

```ts
// Micro-app next.config.ts
async headers() {
  return [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      // AGENT: HOST_ORIGIN, from config/app-urls.ts.
      value: "frame-ancestors 'self' https://main.d1234abcde.amplifyapp.com",
    }],
  }];
}
```

```ts
// Main App next.config.ts
async headers() {
  return [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      // AGENT: one entry per origin in MICROAPP_URLS.
      value: "frame-src 'self' https://main.d5678fghij.amplifyapp.com https://main.d9012klmno.amplifyapp.com",
    }],
  }];
}
```

Add every local development origin to `frame-ancestors` and `frame-src` as well, or the
frame is blocked locally.

A `frame-ancestors` mismatch is invisible to the host: the load failure is opaque. The
load watchdog in `useMicroappHost` is what surfaces it.

## Cookies

Micro-app cookies are set inside a cross-site frame, so they need
`SameSite=None; Secure`.

| Cookie              | httpOnly | Read by                                       |
| ------------------- | -------- | --------------------------------------------- |
| `mfe_access_token`  | yes      | middleware, `/api/auth/token`                 |
| `mfe_expires_at`    | no       | client code, to schedule renewal              |
| `daas_resource_uri` | no       | `DaaSProvider.getHeaders`                     |

`SUPABASE_SERVICE_ROLE_KEY` never reaches client code, in any app.

Some browsers block third-party cookies entirely. When the frame cannot keep a cookie,
the handshake repeats on every navigation. Test the target browsers before launch.

## CORS

Set `CORS_ORIGINS` in the DaaS configuration to every origin that calls it: the Main
App, every micro-app, and every local development port.

```json
{
  "cors_origins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://main.d1234abcde.amplifyapp.com",
    "https://main.d5678fghij.amplifyapp.com"
  ],
  "cors_allow_credentials": true,
  "cors_allowed_headers": ["Content-Type","Authorization","Origin","X-Requested-With","Accept","X-Resource-Uri"],
  "cors_max_age": 0
}
```

`X-Resource-Uri` must be in `cors_allowed_headers`, or every scoped call from a
micro-app is blocked at preflight. See Bugs 17 and 25 in
[daas-platform](../../daas-platform/SKILL.md).

## Checklist

- [ ] The sandbox matches `DEFAULT_SANDBOX`, with no `allow-modals` and no `allow-top-navigation`.
- [ ] Every handler checks origin, `event.source`, `source`, and `v`.
- [ ] Every payload field is type-checked before use.
- [ ] The micro-app sets `frame-ancestors` for the host origin only.
- [ ] The Main App sets `frame-src` for the micro-app origins only.
- [ ] Cookies use `SameSite=None; Secure`.
- [ ] `CORS_ORIGINS` lists every deployed origin and every local port.
