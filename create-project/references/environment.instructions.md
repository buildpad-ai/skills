---
name: Environment Setup
description: Instructions for configuring environment variables
applyTo: "**/.env*"
---

# Environment Configuration Instructions

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

## Prerequisites

Before configuring environment or running any project commands, verify required tools:

```bash
node --version && pnpm --version && git --version
```

If missing, see [prerequisites.instructions.md](prerequisites.instructions.md) for installation by OS.

<!-- buildpad-backend: supabase -->
## Architecture Overview

Generated DaaS applications use a **two-tier architecture** with a **server-side proxy**:

1. **Frontend App** (this project) - Next.js application with proxy API routes
2. **DaaS Backend** (DaaS) - DaaS-compatible API server

```
┌─────────────────┐      ┌─────────────────────────┐      ┌──────────────┐
│  Frontend App   │ ──── │  DaaS   │ ──── │   Supabase   │
│  (Next.js)      │ API  │  (DaaS Backend)         │      │  (Database)  │
└─────────────────┘      └─────────────────────────┘      └──────────────┘
     Same-origin            Cross-origin (proxied)
     /api/* routes           Server-side only
```

**All browser requests go to `/api/*` proxy routes on the same origin.**
**The proxy routes forward requests to the DaaS backend server-side (no CORS).**

## Required Environment Variables

### For Frontend Apps (main-nextjs pattern)

```env
# Supabase - For client-side auth only
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# DaaS Backend - The API server
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Architecture Overview

On an Engine project the application has two tiers:

1. **Frontend App** (this project) - Next.js application with proxy API routes
2. **Buildpad Engine** - the data API, sign-in and file storage, with its own database, at the Engine_URL. This project runs no backend server and holds no database credentials.

```
┌─────────────────┐      ┌─────────────────────────┐
│  Frontend App   │ ──── │  Buildpad Engine        │
│  (Next.js)      │ API  │  (Engine_URL)           │
└─────────────────┘      └─────────────────────────┘
```

On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

On an Engine project the data API serves no request without a session; only the sign-in, `GET /api/server/info` and the Engine's password routes (which an application does not use: password recovery is not available on an Engine project) are served without one. The requests that take their tenant from the header `X-Tenant-Id` are the password sign-in, XAppHub sign-in and anonymous reads of public files. A browser can send `X-Tenant-Id` to the Engine from another origin, without cookies or credentials: the Engine allows that header from any origin and allows no credentialed cross-origin request. Even so, the request that names the tenant is the sign-in made through the application's own server route, which sends `X-Tenant-Id` with the value of `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. A public file shown in a browser is loaded through a signed URL from `/api/files/signed-url`, not by an anonymous read. A request without a session that names no tenant is served from the Engine's host plane, not from the project. A request with a session takes its tenant from the session.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

On an Engine project with Customer_Tenants the password sign-in names no tenant: the application's own server route sends it without `X-Tenant-Id`. When the session it answers is bound to no tenant, the same route lists the person's tenants with `GET /api/auth/tenants`, switches with `POST /api/auth/tenant`, and replaces the session's access and refresh tokens with the pair the switch answers. The application takes its current tenant from the session, never from the environment or from the request, and sends no tenant id on a request that carries a session.

In the mode `customer-tenants` the `create-api-route` skill writes the login route without the header and the three tenant routes (list, switch, decline).

**Sign-in goes through the app's own `/api/auth/login` route**, which names the tenant. Every other call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the app's `/api/*` proxy routes or from the SDK; the Engine accepts no cookie session on its data API.

## Required Environment Variables

### For Frontend Apps (main-nextjs pattern)

On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

In the mode `customer-tenants`, `NEXT_PUBLIC_BUILDPAD_TENANT_ID` stays the Blueprint's id, the project's own tenant. It labels the application's own tenant in the customer chooser and names the tenant of a request without a session. It never names the current customer, which the application takes from the session, and no customer's tenant id goes into the environment.

```env
NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>
NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key
NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>
```

Use the project's own Engine_URL and tenant id; if you do not have them, ask the developer. A local Engine runs on port 8080, so its Engine_URL is `http://localhost:8080`.

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
### For DaaS Backend (DaaS)

```env
# Supabase - Full access for backend operations
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# MCP Server (optional)
MCP_ENABLED=true
```

<!-- /buildpad-backend -->
<!-- buildpad-backend: supabase -->
## Setup Steps

1. **Start the DaaS Backend first**:

   ```bash
   cd DaaS
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   pnpm dev
   ```

2. **Configure Frontend App**:
   ```bash
   cd your-app
   cp .env.local.example .env.local
   # Set NEXT_PUBLIC_BUILDPAD_DAAS_URL to the backend URL
   pnpm dev
   ```

## Common Issues

### CORS errors when calling DaaS backend

- The browser must NEVER call the DaaS backend directly
- All requests go through `/api/*` proxy routes (same-origin)
- Verify login page uses `fetch('/api/auth/login')` not `supabase.auth.signInWithPassword()`
- See [authentication-proxy.instructions.md](../../authentication-proxy/references/authentication-proxy.instructions.md)

### "Unauthorized" or 401 errors

- Check that the DaaS backend is running
- Verify NEXT_PUBLIC_BUILDPAD_DAAS_URL is correct
- Ensure user is authenticated

### "Connection refused" errors

- Start the DaaS backend server first
- Check the port matches the URL

### Auth not working

- Verify Supabase URL and anon key are set
- Check Supabase project has auth enabled
- Ensure redirect URLs are configured in Supabase dashboard
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Setup Steps

1. **Check that the Engine answers first**:

   ```bash
   curl <Engine_URL>/api/health
   # a local Engine: curl http://localhost:8080/api/health
   curl -H "X-Tenant-Id: <the project's tenant id>" <Engine_URL>/api/server/info
   ```

   Both routes answer without a session. If neither answers, ask the developer to start the Engine or to give the right Engine_URL.

   `/api/health` says only that the Engine is up; it answers 200 before the Engine serves the project. `/api/server/info` with `X-Tenant-Id` says whether the Engine serves the project's tenant: `200` when it does, `403` (`FORBIDDEN`) when that tenant is not served yet or the id is wrong (the two give the same answer), and `503` when the Engine cannot read its tenants. On a `403`, check `NEXT_PUBLIC_BUILDPAD_TENANT_ID` against the project's tenant id, then wait and ask again. Without the header, `/api/server/info` answers for the Engine itself, not for the project.

2. **Configure Frontend App**:
   ```bash
   cd your-app
   cp .env.local.example .env.local
   # Set the four Engine values of "Required Environment Variables"
   pnpm dev
   ```

## Common Issues

### CORS errors when calling the Engine

- On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.
- Send no cookie session and no `credentials` mode that sends cookies; send the user's access token as `Authorization: Bearer <access token>`
- The sign-in goes through the server route: verify login page uses `fetch('/api/auth/login')` not `supabase.auth.signInWithPassword()`, so the server route names the tenant
- See the [authentication-proxy](../../authentication-proxy/SKILL.md) skill

### "Unauthorized" or 401 errors

- Check that the Engine serves the project: `GET <Engine_URL>/api/server/info` with the header `X-Tenant-Id: <the project's tenant id>` answers `200` (Setup Steps, step 1)
- Verify `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` both hold the Engine_URL
- Ensure user is authenticated: the data API serves no request without a session. The code `UNAUTHENTICATED` means no token was sent; check that `DaaSProvider` has the token
- The code `TOKEN_INVALID` means the token sent did not verify, for example a session that went stale: sign in again

### "Connection refused" errors

- Check that the Engine is running at the Engine_URL; a local Engine listens on port 8080 (`http://localhost:8080`)
- Check the port matches the URL

### Auth not working

- Verify the four values of "Required Environment Variables" are set
- The account must hold a role in the project's tenant: an account that holds no role in the project's tenant is refused at password sign-in, and an XAppHub sign-in of such an account ends on the pending-access page. An administrator gives it one in the Studio's Users module or through `POST /api/users/:id/roles` with `role_id` (see the [add-users](../../add-users/SKILL.md) skill)
- Sign-up, OAuth sign-in with any provider other than XAppHub, magic link, one-time code and password recovery are not available on an Engine project, so there are no redirect URLs to configure for them. The Platform registers XAppHub sign-in's redirect URLs when the project's XAppHub connector is connected (see the [add-external-oauth](../../add-external-oauth/SKILL.md) skill)
<!-- /buildpad-backend -->
