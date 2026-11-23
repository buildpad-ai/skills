---
name: worker-http
description: Give a Buildpad runtime worker its own HTTP endpoint (opt-in per worker in the Platform) and call it from the app. Covers when to use the endpoint instead of the RabbitMQ queue (streaming, long requests, webhooks, a small stateful API), the worker's code contract (listen on PORT, GET /health, optional GET /openapi.json with the x-buildpad-auth and x-buildpad-stream extensions), the three kinds of caller and how the worker checks each (a signed-in user's token, a server-side worker key, a provider-signed webhook), CORS, and the streaming rules (SSE, a ping every 15 seconds, stop work when the client leaves). Use when a worker must answer a request directly rather than consume a job.
argument-hint: "[what the endpoint serves, e.g. chat stream, stripe webhook]"
---

# Worker HTTP endpoint (call a Buildpad worker directly)

A Buildpad runtime worker is a long-running Node.js process. By default it has no address: work
reaches it through the project's RabbitMQ broker (the `worker-messaging` skill). When a member
switches on **HTTP endpoint** for that worker in the Platform, the worker also gets a public
HTTPS address:

```
https://w-<id8>-<projectId>.<daas domain>
```

`<id8>` is the first eight characters of the worker's id. Read the exact URL from the worker's
page in the Platform or from the Platform MCP (`get_project_detail`); never build it by hand in
the app. The endpoint is off until a member switches it on, and switching it off removes the
address.

## Step 1 — Endpoint or queue?

| The work… | Use |
|---|---|
| streams its answer to the browser as it is produced (an AI reply, a progress feed) | **Endpoint** |
| is one request that takes longer than the app's server route may run (about 30 seconds on Amplify) and the caller waits for the answer | **Endpoint** |
| is a webhook that another service calls (payment, Git, e-mail provider) | **Endpoint** |
| is a small stateful API: in-memory cache, open connections, a session that lives in the worker | **Endpoint** |
| runs in the background, needs retries, must outlive the request, or is chained to another worker | **Queue** (`worker-messaging`) |
| fans out to many jobs, or nobody waits for the result | **Queue** (`worker-messaging`) |

One worker may do both: consume its queue and serve HTTP in the same process. A webhook route
that must do slow work answers `200` quickly and publishes a job to the queue for the rest.

## Step 2 — The code contract

The Platform starts the worker with these environment variables when the endpoint is on:

| Variable | Meaning |
|---|---|
| `PORT` | The port to listen on. Listen on `process.env.PORT`, on all interfaces; never hard-code a port. |
| `DAAS_URL` | The project's data API address, used to check a user's token. |
| `WORKER_SERVICE_KEY` | The secret a trusted server presents as `X-Worker-Key`. |
| `ALLOWED_ORIGINS` | Comma-separated origins the browser may call from (the app's domains). |

Routes the worker must serve:

- **`GET /health`** returns `200` with no authentication and no slow work. The Platform and the
  load balancer use it; a worker that fails it is marked unhealthy and receives no traffic.
- **`GET /openapi.json`** (optional, no authentication) returns an OpenAPI 3 document of the
  worker's routes, so the Platform can list them on the worker's page. On each operation set:
  - `x-buildpad-auth`: `user`, `key`, `webhook` or `public` — who may call it (Step 3);
  - `x-buildpad-stream: true` on a route that answers with Server-Sent Events.

```json
{
  "openapi": "3.0.3",
  "info": { "title": "chat-worker", "version": "1.0.0" },
  "paths": {
    "/chat": { "post": { "summary": "Stream a reply", "x-buildpad-auth": "user", "x-buildpad-stream": true } },
    "/reindex": { "post": { "summary": "Rebuild the index", "x-buildpad-auth": "key" } },
    "/webhooks/stripe": { "post": { "summary": "Stripe events", "x-buildpad-auth": "webhook" } }
  }
}
```

The extensions only describe the routes. The worker itself enforces every check below.

## Step 3 — The three kinds of caller

Every route except `/health`, `/openapi.json` and a `public` route checks its caller first.

**`user` — a signed-in user of the app.** The browser sends the user's data-API access token as
`Authorization: Bearer <token>`. The worker checks it by calling `GET ${DAAS_URL}/api/users/me`
with that token; `200` means the token is valid and gives the user. Cache the answer by token
for about 60 seconds so a stream of calls does not hit the data API each time. Any data call the
worker then makes on the user's behalf carries **the user's own token**, so the user's
permissions apply; never widen access with another credential.

**`key` — a trusted server.** The app's server route or another worker sends `X-Worker-Key`;
the worker compares it with `WORKER_SERVICE_KEY` in constant time. The key is a server-side
secret: never put it in a `NEXT_PUBLIC_*` variable, the browser, or a mobile app.

**`webhook` — an outside service.** The route accepts no user token; it verifies the provider's
signature over the **raw** request body with the provider's signing secret (for example
Stripe's `Stripe-Signature`, GitHub's `X-Hub-Signature-256`) before it reads or acts on the
body, and answers `401` when the signature is wrong. A route with no signature to verify is
`public` and must do nothing that changes data.

```ts
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const DAAS_URL = process.env.DAAS_URL!;
const KEY = process.env.WORKER_SERVICE_KEY ?? '';
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const userCache = new Map<string, { user: unknown; until: number }>();

async function checkUser(req: http.IncomingMessage) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (!token) return null;
  const hit = userCache.get(token);
  if (hit && hit.until > Date.now()) return { token, user: hit.user };
  const res = await fetch(`${DAAS_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = (await res.json()).data;
  userCache.set(token, { user, until: Date.now() + 60_000 });
  return { token, user };
}

function checkKey(req: http.IncomingMessage) {
  const got = Buffer.from(String(req.headers['x-worker-key'] ?? ''));
  const want = Buffer.from(KEY);
  return KEY !== '' && got.length === want.length && timingSafeEqual(got, want);
}

function cors(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}
```

## Step 4 — CORS

Allow only the origins in `ALLOWED_ORIGINS`, echoing the request's `Origin` when it is listed,
and answer the `OPTIONS` preflight with `204`. Never answer `*` on a `user` route. `key` and
`webhook` routes are called server to server and need no CORS headers.

## Step 5 — Streaming

Stream with **Server-Sent Events** (`Content-Type: text/event-stream`, `Cache-Control:
no-cache`, `X-Accel-Buffering: no`), one `data:` line per event.

- **Send `: ping` every 15 seconds.** The load balancer closes a connection that has been idle
  for 60 seconds; a comment line keeps it open while the worker is thinking.
- **Stop the upstream work when the client leaves.** Listen for `close` on the request and
  abort the model call, the query or the loop (an `AbortController`), and clear the ping timer.

```ts
async function chat(req: http.IncomingMessage, res: http.ServerResponse, token: string) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const abort = new AbortController();
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', () => { clearInterval(ping); abort.abort(); });
  try {
    for await (const chunk of produceReply({ token, signal: abort.signal })) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('event: done\ndata: {}\n\n');
  } finally {
    clearInterval(ping);
    res.end();
  }
}
```

## Step 6 — Calling it from the app

- **Streaming and long `user` routes: the browser calls the worker URL directly**, with the
  signed-in user's access token as `Authorization: Bearer`. Do not pass a stream through the
  app's own server route: on Amplify a server route is buffered and cut off at about 30 seconds,
  so the stream never reaches the browser. Read the stream with `fetch` and a reader
  (`EventSource` cannot send an `Authorization` header).
- **`key` routes: call from the app's server route** with `X-Worker-Key`, the key held in a
  server-only environment variable.
- Keep the worker's URL in configuration (a `NEXT_PUBLIC_*` variable is fine for the URL; it is
  not a secret), taken from the Platform.

## Rules

1. The endpoint is opt-in per worker; switch it on in the Platform before calling it.
2. Listen on `process.env.PORT`; `GET /health` returns `200` without authentication.
3. Every route checks its caller: a user's token through `/api/users/me` (cached about 60
   seconds), `X-Worker-Key` against `WORKER_SERVICE_KEY`, or a verified webhook signature.
4. Act with the user's own token; never send `WORKER_SERVICE_KEY` to a browser.
5. CORS only from `ALLOWED_ORIGINS`.
6. SSE streams ping every 15 seconds and stop their work when the client disconnects.
7. Background, retried or chained work goes through the queue: see the `worker-messaging` skill.
