# `config/app-urls.ts`

This is the single description of the app URL config. `add-microapp` and
`add-microfrontend` both point here. Do not copy these rules into a skill file.

## Why a committed file, not environment variables

Infrastructure values (Supabase, DaaS) are set once when the Amplify app is created.
App URLs change every time a micro-app is added. A committed TypeScript file means a
`git push` propagates a URL change through the Amplify build, with no console work.

| Value                                    | Where it lives                        |
| ---------------------------------------- | ------------------------------------- |
| Supabase URL, anon key, service role key | `.env.local` and the Amplify console  |
| DaaS URL                                 | `.env.local` and the Amplify console  |
| Main App URL, micro-app URLs             | `config/app-urls.ts`, committed       |

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
process.env.NEXT_PUBLIC_HOST_ORIGIN || process.env.NEXT_PUBLIC_HOST_ORIGIN_MAIN || 'http://localhost:3000'

// ❌ localhost as the default
'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'http://localhost:3001',

// ✅ the real deployed URL as the default, one override
process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com'
```

## Main App

The example below is fully rendered. Write real values in the same shape. Do not emit
template syntax such as `{{#each}}` into a TypeScript file.

```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Override for local development in .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
//   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001

/** Main App deployed URL. */
export const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com';

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

## Micro-app

```typescript
// config/app-urls.ts — committed to git.
// Generated from get_project_detail. Override for local development in .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000

/** Main App origin. Used to validate and target every postMessage call. */
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com';

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

# Optional local overrides
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

A micro-app `.env.local` is the same file without `SUPABASE_SERVICE_ROLE_KEY`.

Write the resolved values, not the angle-bracket names. If `project.daasUrl` is
`https://acme.buildpad-daas.xtremax.com`, write exactly that string.
