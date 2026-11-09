---
name: add-mcp-server
description: Expose a Buildpad app's own data and actions as an MCP server, so Claude, Copilot, Kiro or Antigravity can call them as tools. Adds one Next.js route (`/api/mcp`, Streamable HTTP, stateless) built on the official MCP TypeScript SDK, where every tool forwards the caller's own access token to the data API, so the caller's permissions apply and no tool uses an elevated key. Covers tool design, input validation, the response shape, client configuration, OAuth sign-in for hosted connectors (claude.ai and ChatGPT), with their redirect URLs kept in the app's Amplify environment variables, and testing with the MCP Inspector. Use when the user says add an MCP server, expose my app to AI agents, make tools for an agent, or build an MCP endpoint in the app. Not for connecting an agent to the Buildpad Platform's own MCP.
argument-hint: "[tool, e.g. list_orders]"
---

# Add an MCP Server to a Buildpad App

<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

<!-- buildpad-backend: engine -->
On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

<!-- /buildpad-backend -->
An MCP server lets an AI agent call your app's operations as typed tools. In a Buildpad app the
server is one API route. Each tool calls the data API on behalf of the person who connected, with
that person's own token, so the agent can do exactly what that person may do and nothing more.

This skill builds a server **inside the app**. It is not the Buildpad Platform's MCP, which
manages the project itself (environment variables, workers, connectors); to use that one, follow
the Platform's own instructions.

## Rules

1. **Act as the caller; never use an elevated key to read or write data.** A tool reads the token
   from the request's `Authorization: Bearer <access token>` header and sends the same header to
   the data API. (When hosted connectors sign in with OAuth, step 6, the header carries the app's
   own MCP token instead, and the tool sends the data API token of the same person that the MCP
   token carries.) Do not read a service key, an administrator token or a stored credential in a
   tool. If the data API refuses the call, return its refusal as the tool's error; do not retry
   with more power.
2. **No token, no tools.** The route answers `401` with a `WWW-Authenticate: Bearer` header (with
   `resource_metadata` once step 6 is in) before it creates the server. Never list tools to an
   anonymous caller.
3. **Stateless.** Create a server and a transport per request (`sessionIdGenerator: undefined`).
   Amplify and other serverless hosts do not keep memory between requests, so a session map
   breaks.
4. **Validate every input with zod** and bound it: a `limit` has a maximum, a string has a maximum
   length, an enum lists its values. The agent writes these inputs, so treat them as untrusted.
5. **Small, named tools.** One tool is one operation with a verb name (`list_orders`,
   `create_order`). Do not add a tool that takes a raw path or a raw query and passes it through.
6. **Mark what changes data.** Give a read tool `annotations: { readOnlyHint: true }` and a delete
   tool `destructiveHint: true`, so the client can ask the person before it runs one.
7. **Return a short, structured answer.** Return only the fields the agent needs, as text of
   JSON. Never return tokens, headers or the raw upstream error body; return its message.
8. **Do not log the token** or the `Authorization` header.

## Steps

### 1. Install

```bash
pnpm add @modelcontextprotocol/sdk zod
```

Use the SDK's current documentation for the installed version if an import path below differs:
the Streamable HTTP transport for Web Standard `Request`/`Response` is the one to use in a
Next.js route.

### 2. Find how the app calls the data API

Read the app's existing server code for the helper that gives the data API's address and the
headers for a call (the one its API routes use; see [create-api-route](../create-api-route/SKILL.md)).
Reuse it. If the app has none, build the address from `NEXT_PUBLIC_BUILDPAD_DAAS_URL`. The MCP
route is a server route, so it needs no new environment variable.

### 3. Write the route

```ts
// app/api/mcp/route.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA_URL = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!;

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Send Authorization: Bearer <access token>' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
  });
}

// One call to the data API, as the caller. A refusal comes back as the tool's error.
async function callData(authorization: string, path: string, init?: RequestInit) {
  const res = await fetch(`${DATA_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers, Authorization: authorization },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.errors?.[0]?.message ?? `The data API answered ${res.status}`;
    return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(body?.data ?? body) }] };
}

function buildServer(authorization: string) {
  const server = new McpServer({ name: 'my-app', version: '1.0.0' });

  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description: 'List the most recent orders the signed-in user may see.',
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
      annotations: { readOnlyHint: true },
    },
    ({ limit }) => callData(authorization, `/api/items/orders?limit=${limit}&sort=-date_created`)
  );

  return server;
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return unauthorized();

  const server = buildServer(authorization);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// A stateless server has no stream to resume or session to end.
const notAllowed = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
export { notAllowed as GET, notAllowed as DELETE };
```

Replace `orders` with the app's own collection and add one `registerTool` per operation. Keep
the collection name and the allowed fields in the tool, not in the input.

### 4. Keep the route reachable and safe

- If the app's middleware redirects signed-out requests to a login page, exclude `/api/mcp` from
  that redirect: an agent cannot follow it, and the route does its own `401`.
- Do not add `/api/mcp` itself to a CORS allow-list for browsers. Agents call it server to server
  or from a desktop client, not from a page. (The OAuth endpoints of step 6 are different: they
  answer `Access-Control-Allow-Origin: *` because a connector's page may fetch them.)
- Add the route to the app's rate limiting if it has any.

### 5. Connect a client

The agent needs the route's address and a token to send. Give the person this block and
fill in the address:

```json
{
  "mcpServers": {
    "my-app": {
      "type": "http",
      "url": "https://<the app's address>/api/mcp",
      "headers": { "Authorization": "Bearer ${MY_APP_TOKEN}" }
    }
  }
}
```

The file name and exact keys differ by tool (for example `.mcp.json` for Claude Code,
`.vscode/mcp.json` for VS Code, a user-level file for Kiro). Check the tool's own documentation
rather than guessing. Never commit a real token: the client reads it from an environment
variable. A token is the person's own access token, so it expires; say so, and do not put it in a
file in the repository.

### 6. Let hosted connectors sign in (claude.ai, ChatGPT, Amazon Quick)

Claude Code, VS Code and the Inspector can send a fixed `Authorization` header (step 5). The
**custom connectors of claude.ai and ChatGPT cannot**: they sign the person in with OAuth 2.1
(authorization code with PKCE S256), find the endpoints by discovery, and register themselves
with Dynamic Client Registration. Skip this step if only header-based clients will connect.

#### The redirect URLs

After the person allows the connection, the app sends the browser back to the connector's own
**redirect URL**, carrying the authorization code. If the app sent it to any address the caller
asked for, anyone could register `https://evil.example` and receive a signed-in person's code
(an open redirect). So the app keeps an exact allow-list, checks it at registration and again at
authorize, and refuses everything else. Keep the list in an environment variable, not in code, so
a new connector is one variable change and a redeploy:

| Variable | What it holds | Secret? |
| --- | --- | --- |
| `MCP_ALLOWED_REDIRECT_URIS` | Comma-separated, exact redirect URLs the app may send a code to | No |
| `MCP_RESOURCE_URL` | The public address of the route, for example `https://<the app's address>/api/mcp` | No |
| `MCP_OAUTH_SECRET` | Signs the client ids, codes and tokens (HS256); at least 32 characters, from `openssl rand -base64 48` | **Yes** |

A value for `MCP_ALLOWED_REDIRECT_URIS` (confirm each against the vendor's current connector
documentation, because these are the vendors' addresses and can change):

```text
https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback,https://chatgpt.com/connector_platform_oauth_redirect,https://platform.openai.com/apps-manage/oauth
```

- Amazon Quick (Enterprise subscription; it registers through DCR) calls back on
  `https://<region>.quicksight.aws.amazon.com`, and AWS does not publish the exact path. Connect
  once, read the refused URI in the log, and add that exact URL. A custom MCP connector there picks
  up new or changed tools only after someone runs its **Sync**.
- Loopback (`http://localhost:<port>/...`, `127.0.0.1`, `[::1]`) is always accepted in code, for
  Claude Code and desktop clients. Do not put it in the variable.
- Matching is exact: no wildcard, no prefix match, no `https://claude.ai/*`.
- If the variable is empty, only loopback works. The route fails closed.
- ChatGPT can register a callback on `chatgpt.com` with a connector id in its path. If a
  registration is refused, the app logs the refused URI (step "register" below); add that exact URL
  to the variable.
- `MCP_RESOURCE_URL` exists so the discovery documents and the `WWW-Authenticate` header never
  use the request's `Host` header, which a client can forge.

Set them on the deployed app with the Buildpad platform's tools, then redeploy (see the
[amplify-env-vars](../amplify-env-vars/SKILL.md) skill):

```json
{ "name": "amplify_set_env_vars", "arguments": { "vars": {
  "MCP_RESOURCE_URL": "https://<the app's address>/api/mcp",
  "MCP_ALLOWED_REDIRECT_URIS": "https://claude.ai/api/mcp/auth_callback,...",
  "MCP_OAUTH_SECRET": "<generated, never printed>"
} } }
```

Amplify variables exist at build time only. Add them to the `printenv` line (or the `echo` lines)
in `amplify.yml` that writes `.env.production`, or the running app reads nothing:

```yaml
- printenv | grep -E '^(NEXT_PUBLIC_|MCP_RESOURCE_URL=|MCP_ALLOWED_REDIRECT_URIS=|MCP_OAUTH_SECRET=)' >> .env.production
```

For local development put the same three in `.env.local`. Never print or commit
`MCP_OAUTH_SECRET`. To add a connector later: `amplify_get_env_vars` (names only), then
`amplify_set_env_vars` with the full new list, then `amplify_redeploy`.

#### The endpoints

All under the app, stateless (no database): a client id, an authorization code and a token are
each a JWT signed with `MCP_OAUTH_SECRET`, each with its **own audience**, so one kind can never
be accepted as another. Use `jose`. The access and refresh tokens also carry the person's data
API tokens, so they are **encrypted** JWTs (`EncryptJWT`, `dir` + `A256GCM`, key = SHA-256 of
`MCP_OAUTH_SECRET`), never plain signed ones: a connector, a log or a proxy must not be able to
read a data API token out of them.

```ts
// lib/mcp/config.ts
export function resourceUrl(): string {
  const v = process.env.MCP_RESOURCE_URL;
  if (!v) throw new Error('MCP_RESOURCE_URL is not set');
  return v.replace(/\/$/, '');
}
/** RFC 9728: the well-known path is inserted between the origin and the path. */
export function protectedResourceMetadataUrl(): string {
  const u = new URL(resourceUrl());
  return `${u.origin}/.well-known/oauth-protected-resource${u.pathname}`;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export function isAllowedRedirect(uri: string): boolean {
  const exact = (process.env.MCP_ALLOWED_REDIRECT_URIS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (exact.includes(uri)) return true;
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && LOOPBACK.has(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}
```

| Route | Does |
| --- | --- |
| `app/.well-known/oauth-protected-resource/api/mcp/route.ts` | `GET`: `{ resource, authorization_servers: [resource], bearer_methods_supported: ['header'], scopes_supported: ['mcp'] }`, all from `resourceUrl()` |
| `app/.well-known/oauth-authorization-server/api/mcp/route.ts` | `GET`: `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `response_types_supported: ['code']`, `grant_types_supported: ['authorization_code','refresh_token']`, `code_challenge_methods_supported: ['S256']`, `token_endpoint_auth_methods_supported: ['none']` |
| `app/api/mcp/oauth/register/route.ts` | `POST`, dynamic registration (RFC 7591) |
| `app/api/mcp/oauth/authorize/route.ts` | `GET`, starts sign-in |
| `app/api/mcp/oauth/complete/route.ts` | `POST`, the person's Allow or Cancel |
| `app/api/mcp/oauth/token/route.ts` | `POST`, code and refresh grants |
| `app/[lang]/mcp/consent/page.tsx` | The page that asks the person to allow the connection |

**register**: refuse unless `redirect_uris` has 1 to 10 strings and every one passes
`isAllowedRedirect`. Log the refused URI (truncated), never anything else, and answer
`400 invalid_redirect_uri`. Otherwise return `201` with a `client_id` that is a JWT carrying the
redirect URIs (audience `mcp-client`), so the app stores nothing.

```ts
const bad = uris.find((u) => !isAllowedRedirect(u));
if (bad) {
  console.warn('[mcp-oauth] register refused redirect_uri', bad.slice(0, 200));
  return error(400, 'invalid_redirect_uri', 'That redirect URI is not allowed');
}
```

**authorize**: before anything else, verify the `client_id`, require
`redirect_uri` to be one of that client's registered URIs **and** to pass `isAllowedRedirect`
again, and until then never redirect anywhere (an unchecked `redirect_uri` is an open redirect).
Then require `response_type=code`, `code_challenge_method=S256` and a `code_challenge` of 43
base64url characters; keep the request (client, redirect, `state`, challenge) in a signed,
`httpOnly`, `sameSite: 'lax'` cookie of 10 minutes; send the browser to the consent page.

**consent page and complete**: show who is asking (the client name) and what the connector may
do. Consent is explicit: signing in is not consent. On Allow, check that the account may use the
app (not banned, not unknown), sign a code (audience `mcp-code`, 2 minutes, bound to the client,
the redirect, the PKCE challenge and the person's data API tokens for this connection, encrypted
as above), and redirect to the registered redirect URL with `code` and `state`. On Cancel,
redirect with `error=access_denied`. Refuse a `POST` whose `Origin` is not the app's own.

<!-- buildpad-backend: supabase -->
On a Supabase project the consent page uses the app's normal sign-in (send the person there with
the consent page as `next` if they are signed out). On Allow, the server makes the connection's
data API session with `auth.admin.generateLink` (type `magiclink`, no email is sent) and
`verifyOtp` on its `hashed_token`, as [add-external-oauth](../add-external-oauth/SKILL.md) does.
That is the only use of `SUPABASE_SERVICE_ROLE_KEY`, in server code outside the tools; add it to
the `printenv` pattern of `amplify.yml` above, and never to a `NEXT_PUBLIC_` name. Every data call
still runs under the person's own policies.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
On an Engine project the server cannot make a session for a user: there is no service-role key,
administration API or magic link. So the consent page signs the person in **again**, for this
connection only: the password sign-in (with `X-Tenant-Id`) or XAppHub (`signInWithIdToken`, see
[add-external-oauth](../add-external-oauth/SKILL.md)), called from the server, and its session is
never stored in the browser's cookies. Never give the connector the browser's session: the Engine
rotates refresh tokens as Supabase does, and a refresh token used more than about 10 seconds
after it was rotated ends the whole session, so the browser and the connector would sign each
other out. The Supabase client's default sign-out ends all of the user's sessions, the
connector's included; tell the person to connect again afterwards.

On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session.

In the mode `customer-tenants` the consent step signs in without `X-Tenant-Id`; when the session is unbound it asks the person to choose a customer and switches before it stores the session, so one connection acts in one customer.
<!-- /buildpad-backend -->

**token**: for `authorization_code`, check that the code's client and redirect equal the request's,
that the PKCE verifier matches the challenge (base64url of its SHA-256, compared with
`timingSafeEqual` on buffers of equal length), and that the account is still active; issue an
access token (audience `mcp-access`) that carries the data API access token and expires no later
than it (at most 1 hour), and a 30-day refresh token (audience `mcp-refresh`) that carries the
data API refresh token. For `refresh_token`, verify it, check the account is still active, refresh
the data API session once with the refresh token it carries, and issue both tokens again with the
new data API tokens. A connector that reuses an old refresh token ends the connection's data API
session; it then connects again. Log the outcome and reason only, never a code or a token. Answer
`Cache-Control: no-store`.

**the MCP route**: replace the plain header check of step 3. Decrypt and verify the access token
(audience `mcp-access`) and answer `401` with
`WWW-Authenticate: Bearer resource_metadata="<protectedResourceMetadataUrl()>"`, so the connector
knows where to start. Then call the data API **as that person**: use `Bearer <the data API access
token it carries>` as `authorization` in `callData`. Do not make a new data API session per
request.

Re-check the account on every request (cache it for a minute at most), so a banned or removed
person loses access within that minute instead of when the token expires.
Never log a data API token.

Also: the middleware must let `/.well-known/*` and `/api/mcp/*` through without a login redirect,
and the OAuth endpoints and the two well-known documents answer
`Access-Control-Allow-Origin: *` with an `OPTIONS` handler.

Then give the person the connector's address, `https://<the app's address>/api/mcp`, to paste into
claude.ai (Settings, Connectors, Add custom connector) or ChatGPT (Settings, Connectors, developer
mode); no header or token is needed, the connector signs the person in.

A signed token cannot be revoked one by one. The per-request account check above is what ends a
person's access; rotating `MCP_OAUTH_SECRET` ends everyone's.

### 7. Test

1. `curl -i -X POST <url>` with no header: expect `401`.
2. Run `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, set the URL and the
   `Authorization` header, list the tools and call one.
3. Call a tool as a user whose role may not read that collection: expect the data API's refusal
   as the tool's error, not data.
4. Call a tool with an out-of-range input (`limit: 5000`): expect a validation error.

If step 6 is in:

5. `curl -i -X POST <url>` with no header: the `WWW-Authenticate` header carries `resource_metadata`,
   and both well-known documents answer `200` with the addresses of `MCP_RESOURCE_URL`.
6. `POST` to `register` with `redirect_uris: ["https://evil.example/cb"]`: expect `400
   invalid_redirect_uri`. With `https://claude.ai/api/mcp/auth_callback`: expect `201`.
7. Call `authorize` with a registered client and a `redirect_uri` that client did not register:
   expect `400`, never a redirect.
8. Exchange a code with a wrong `code_verifier`, then with a different `redirect_uri`: expect
   `invalid_grant` both times.
9. Connect from claude.ai or ChatGPT, then ban the test person and call a tool: expect a refusal
   within a minute.

Add a Vitest test for the route that covers the `401`, one allowed call with `fetch` mocked, and
one refusal; with step 6, add tests for `isAllowedRedirect` (exact match, loopback, a lookalike
host such as `https://claude.ai.evil.example/api/mcp/auth_callback`, an empty variable). See [create-tests](../create-tests/SKILL.md).

## Checklist before you finish

- [ ] No tool reads a service key or an administrator token.
- [ ] A call with no token gets `401` and lists nothing.
- [ ] Every input has a bound; every tool has a verb name; changing tools carry the hints.
- [ ] No tool returns a token, a header or a raw upstream body.
- [ ] The token is not logged and not committed.
- [ ] A hosted connector registers only allowed redirect URIs and gets a data API session of its
  own at consent, never the browser's; its MCP tokens carry that session encrypted.
- [ ] The route has a test for the `401`, an allowed call and a refusal.
- [ ] With step 6: `MCP_ALLOWED_REDIRECT_URIS`, `MCP_RESOURCE_URL` and `MCP_OAUTH_SECRET` are set in
      Amplify and written to `.env.production` by `amplify.yml`; no redirect URL is matched by
      prefix or wildcard; `redirect_uri` is checked at register and at authorize; PKCE S256 is
      required; the person's account is checked on every call.
