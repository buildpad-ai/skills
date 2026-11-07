# `config/app-urls.ts`

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

This is the single description of the app URL config. `add-microapp` and
`add-microfrontend` both point here. Do not copy these rules into a skill file.

## Why a committed file, not environment variables

<!-- buildpad-backend: supabase -->
Infrastructure values (Supabase, DaaS) are set once when the Amplify app is created.
App URLs change every time a micro-app is added. A committed TypeScript file means a
`git push` propagates a URL change through the Amplify build, with no console work.

| Value                                    | Where it lives                        |
| ---------------------------------------- | ------------------------------------- |
| Supabase URL, anon key, service role key | `.env.local` and the Amplify console  |
| DaaS URL                                 | `.env.local` and the Amplify console  |
| Main App URL, micro-app URLs             | `config/app-urls.ts`, committed       |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
Infrastructure values (the Engine_URL, the fixed anon value and the project's tenant id) are
set once when the Amplify app is created. App URLs change every time a micro-app is added. A
committed TypeScript file means a `git push` propagates a URL change through the Amplify build,
with no console work.

| Value                                                      | Where it lives                        |
| ---------------------------------------------------------- | ------------------------------------- |
| Engine_URL (both address variables), anon value, tenant id | `.env.local` and the Amplify console  |
| Main App URL, micro-app URLs                               | `config/app-urls.ts`, committed       |
<!-- /buildpad-backend -->

## Generation rules

1. The hardcoded string on the right of `||` must be the real deployed URL from
   `get_project_detail`. It must never be `localhost`, `127.0.0.1`, or a placeholder.
2. The left of `||` is exactly one `process.env.NEXT_PUBLIC_*` override for local
   development. Never chain two environment variables.
3. Each export has exactly one `process.env.*` and exactly one URL string.
4. The override name for a micro-app is `NEXT_PUBLIC_` + the name uppercased with
   hyphens replaced by underscores + `_URL`. `users-app` becomes
   `NEXT_PUBLIC_USERS_APP_URL`.

```typescript
// ❌ localhost as the default, and chained variables
process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || process.env.NEXT_PUBLIC_MAIN_URL || 'http://localhost:3000'

// ❌ localhost as the default
'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'http://localhost:3001',

// ❌ a name the CLI reserves for THIS app's own origin (lib/origin.ts)
process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com'

// ✅ the real deployed URL as the default, the CLI-populated override
process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || 'https://main.d1234abcde.amplifyapp.com'
```

## Reserved names

<!-- buildpad-backend: supabase -->
`NEXT_PUBLIC_HOST_ORIGIN` and `HOST_ORIGIN` (the env vars) are **reserved by the
CLI's `lib/origin.ts`** and mean *this app's own* public origin — the middleware
login redirect, the OAuth `redirect_uri`, and the post-logout URI are all built from
them. Setting either to another app's URL redirects this app's users to that app.
The exported TypeScript symbol `HOST_ORIGIN` in `config/app-urls.ts` is fine — only
the environment variable names are reserved.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
`NEXT_PUBLIC_HOST_ORIGIN` and `HOST_ORIGIN` (the env vars) are **reserved by the
CLI's `lib/origin.ts`** and mean *this app's own* public origin — the middleware
login redirect and the post-logout URI are built from them. Setting either to another
app's URL redirects this app's users to that app. The exported TypeScript symbol
`HOST_ORIGIN` in `config/app-urls.ts` is fine — only the environment variable names are
reserved.
<!-- /buildpad-backend -->

Bootstrap already writes `NEXT_PUBLIC_MICROAPP_URL_MAIN=<mainAmplifyUrl>` into every
`.env.local`. Use it as the one override for the Main App origin — do not invent a
second convention.

**Where overrides live matters.** `next build` loads `.env.local`, so any localhost
value in it is baked into the production build (including the CSP headers generated
from `config/app-urls.ts`). Deployed values stay in `.env.local`; every localhost
override goes in **`.env.development.local`**, which only `next dev` loads. Verify
with `jq '.headers' .next/routes-manifest.json` after a build — no `http://localhost`
may appear.

## Main App

The example below is fully rendered. Write real values in the same shape. Do not emit
template syntax such as `{{#each}}` into a TypeScript file.

<!-- buildpad-backend: supabase -->
```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Localhost overrides for local development go
// in .env.development.local (NEVER .env.local — `next build` loads .env.local, so a
// localhost value there ends up inside the production CSP header):
//   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000
//   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001

/** Main App deployed URL. */
export const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || 'https://main.d1234abcde.amplifyapp.com';

/** Micro-app deployed URLs. Used as the iframe src in the Main App. */
export const MICROAPP_URLS = {
  // AGENT: replace this block with one line per entry in microapps[].
  // Keep the shape exactly: '<name>': process.env.<OVERRIDE> || '<amplifyUrl>',
  'users-app':
    process.env.NEXT_PUBLIC_USERS_APP_URL || 'https://main.d5678fghij.amplifyapp.com',
  'billing-app':
    process.env.NEXT_PUBLIC_BILLING_APP_URL || 'https://main.d9012klmno.amplifyapp.com',
} as const;

export type MicroappKey = keyof typeof MICROAPP_URLS;
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Localhost overrides for local development go
// in .env.development.local (NEVER .env.local — `next build` loads .env.local, so a
// localhost value there ends up inside the production CSP header):
//   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000
//   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001

/** Main App deployed URL. */
export const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || 'https://main.d1234abcde.amplifyapp.com';

/** Micro-app deployed URLs. The Main App links to them. */
export const MICROAPP_URLS = {
  // AGENT: replace this block with one line per entry in microapps[].
  // Keep the shape exactly: '<name>': process.env.<OVERRIDE> || '<amplifyUrl>',
  'users-app':
    process.env.NEXT_PUBLIC_USERS_APP_URL || 'https://main.d5678fghij.amplifyapp.com',
  'billing-app':
    process.env.NEXT_PUBLIC_BILLING_APP_URL || 'https://main.d9012klmno.amplifyapp.com',
} as const;

export type MicroappKey = keyof typeof MICROAPP_URLS;
```
<!-- /buildpad-backend -->

## Micro-app

<!-- buildpad-backend: supabase -->
```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Localhost override for local development goes
// in .env.development.local (NEVER .env.local — see above):
//   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000

/** Main App origin. Used to validate and target every postMessage call. */
// The env override is NEXT_PUBLIC_MICROAPP_URL_MAIN — bootstrap already writes it
// into every .env.local with the correct value. NEVER use NEXT_PUBLIC_HOST_ORIGIN
// here: that name is reserved (see below).
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || 'https://main.d1234abcde.amplifyapp.com';

/** The first real route in this micro-app. The auth bridge redirects here. */
// AGENT: replace with this micro-app's own first route. Never leave a route that
// does not exist in app/.
export const DEFAULT_AUTHENTICATED_ROUTE = '/users';
```

`DEFAULT_AUTHENTICATED_ROUTE` is required by
[add-microfrontend](../../add-microfrontend/references/auth-bridge.instructions.md).
Omit it only in a micro-app that is never framed.

## `.env.local`

Infrastructure secrets only. Set the same values in the Amplify console.

```env
# Main App
NEXT_PUBLIC_SUPABASE_URL=<project.supabaseUrl>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<project.supabaseAnonKey>
SUPABASE_SERVICE_ROLE_KEY=<project.supabaseServiceRoleKey>
NEXT_PUBLIC_BUILDPAD_DAAS_URL=<project.daasUrl>

# Bootstrap writes NEXT_PUBLIC_MICROAPP_URL_MAIN here with the DEPLOYED Main App
# URL — leave it. Localhost overrides go in .env.development.local instead:
# `next build` loads .env.local, so a localhost value here is baked into the
# production CSP header. Example .env.development.local:
#   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000
#   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

A micro-app `.env.local` is the same file without `SUPABASE_SERVICE_ROLE_KEY`.

Write the resolved values, not the angle-bracket names. If `project.daasUrl` is
`https://acme.buildpad-daas.xtremax.com`, write exactly that string.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Localhost override for local development goes
// in .env.development.local (NEVER .env.local — see above):
//   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000

/** Main App origin. Used for the links back to the Main App. */
// The env override is NEXT_PUBLIC_MICROAPP_URL_MAIN — bootstrap already writes it
// into every .env.local with the correct value. NEVER use NEXT_PUBLIC_HOST_ORIGIN
// here: that name is reserved (see Reserved names above).
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_MICROAPP_URL_MAIN || 'https://main.d1234abcde.amplifyapp.com';
```

On an Engine project the micro-app config holds no `DEFAULT_AUTHENTICATED_ROUTE`: that
constant serves the auth bridge of [add-microfrontend](../../add-microfrontend/SKILL.md),
and iframe composition with that bridge is not available on an Engine project yet.

## `.env.local`

Infrastructure values only. Set the same values in the Amplify console.

On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

```env
# Main App and every micro-app: the same four values
NEXT_PUBLIC_SUPABASE_URL=<project.engineUrl>
NEXT_PUBLIC_BUILDPAD_DAAS_URL=<project.daasUrl>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<project.publicAnonKey>
NEXT_PUBLIC_BUILDPAD_TENANT_ID=<project.projectTenantId>

# Bootstrap writes NEXT_PUBLIC_MICROAPP_URL_MAIN here with the DEPLOYED Main App
# URL — leave it. Localhost overrides go in .env.development.local instead:
# `next build` loads .env.local, so a localhost value here is baked into the
# production CSP header. Example .env.development.local:
#   NEXT_PUBLIC_MICROAPP_URL_MAIN=http://localhost:3000
#   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

`project.tenantVariable` names the tenant variable (`NEXT_PUBLIC_BUILDPAD_TENANT_ID`), and
`project.publicAnonKey` holds the fixed anon value. A micro-app `.env.local` is the same file:
there is no variable for the Main App only.

Write the resolved values, not the angle-bracket names. If `project.engineUrl` is
`https://engine.example.com`, write exactly that string in both address variables.
<!-- /buildpad-backend -->
