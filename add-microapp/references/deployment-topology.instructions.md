# Deployment Topology

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

## Overview

<!-- buildpad-backend: supabase -->
All micro-apps and the Main App deploy independently as separate Next.js applications. They all share a **single DaaS backend** and a **single Supabase instance** (Auth + DB). The DaaS backend is managed separately and does not need redeployment when apps change.

## Context-Aware Deployment

All deployment URLs and credentials are discovered automatically via the `get_project_detail` platform MCP tool. **Never hardcode URLs or ask the user for deployment targets.**

```json
// Call first — returns all deployment context
{ "name": "get_project_detail", "arguments": {} }
```

The response provides:

- `project.mainAmplifyUrl` — Main App's deployed Amplify URL
- `project.mainGitUrl` — Git repo URL for Main App (with credentials)
- `microapps[].amplifyUrl` — Each micro-app's deployed Amplify URL
- `microapps[].gitUrl` — Each micro-app's Git repo URL
- `project.mainGitToken` — Shared git token for all repos

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Amplify                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │  Main App         │  │  users-app       │  │  billing-app    ││
│  │  {{mainAmplifyUrl}}│  │  {{ms[0].url}}   │  │  {{ms[1].url}} ││
│  │  Next.js SSR      │  │  Next.js SSR     │  │  Next.js SSR   ││
│  └────────┬──────────┘  └────────┬─────────┘  └───────┬────────┘│
│           │                      │                     │         │
│           └──────────────────────┼─────────────────────┘         │
│                                  ▼                               │
│              ┌──────────────────────────────┐                    │
│              │  Single DaaS Backend          │                    │
│              │  {{project.daasUrl}}           │                    │
│              │  (all collections)             │                    │
│              └──────────┬───────────────────┘                    │
│                         ▼                                        │
│              ┌──────────────────────────────┐                    │
│              │  Supabase                     │                    │
│              │  {{project.supabaseUrl}}       │                    │
│              │  (Auth + single DB)            │                    │
│              └──────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

## Domain Strategy

All apps must be on the **same domain** (or subdomains) for cookie sharing:

```
Main App:    my-app.example.com
Users:       users.example.com
Billing:     billing.example.com
Analytics:   analytics.example.com
DaaS:        your-project.buildpad-daas.xtremax.com
Supabase:    your-project.buildpad-supabase.xtremax.com
```

**Cookie domain:** `.example.com` (shared across all subdomains)

### Alternative: Path-Based (Single Domain)

If subdomains are not available, use a reverse proxy to route by path:

```
example.com/admin/*     → Main App
example.com/users/*     → Users micro-app
example.com/billing/*   → Billing micro-app
```

This requires a CDN or load balancer (e.g., CloudFront, ALB) to route traffic.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
All micro-apps and the Main App deploy independently as separate Next.js applications. They all share a **single Engine**, which serves the data API and signs users in for every app. The Engine is managed separately and does not need redeployment when apps change.

## Context-Aware Deployment

All deployment URLs and credentials are discovered automatically via the `get_project_detail` platform MCP tool. **Never hardcode URLs or ask the user for deployment targets.**

```json
// Call first — returns all deployment context
{ "name": "get_project_detail", "arguments": {} }
```

The response provides:

- `project.mainAmplifyUrl` — Main App's deployed Amplify URL
- `project.mainGitUrl` — Git repo URL for Main App (with credentials)
- `project.engineUrl` — the Engine_URL every app's data calls and sign-in go to
- `microapps[].amplifyUrl` — Each micro-app's deployed Amplify URL
- `microapps[].gitUrl` — Each micro-app's Git repo URL
- `project.mainGitToken` — Shared git token for all repos

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Amplify                              │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│
│  │  Main App         │  │  users-app       │  │  billing-app    ││
│  │  {{mainAmplifyUrl}}│  │  {{ms[0].url}}   │  │  {{ms[1].url}} ││
│  │  Next.js SSR      │  │  Next.js SSR     │  │  Next.js SSR   ││
│  └────────┬──────────┘  └────────┬─────────┘  └───────┬────────┘│
│           │                      │                     │         │
└───────────┼──────────────────────┼─────────────────────┼─────────┘
            └──────────────────────┼─────────────────────┘
                                   ▼
               ┌──────────────────────────────┐
               │  Single Engine                │
               │  {{project.engineUrl}}         │
               │  (data API + sign-in,          │
               │   all collections, one DB)     │
               └──────────────────────────────┘
```

On an Engine project the data API's address is the Engine_URL, which both `NEXT_PUBLIC_BUILDPAD_DAAS_URL` and `NEXT_PUBLIC_SUPABASE_URL` hold. The Studio's address is an administration interface: send no data call to it.

## Domain Strategy

On an Engine project the apps need no common domain:

- On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.
- Sharing one session between apps is not available on an Engine project yet, so a common parent domain gives the apps no shared sign-in.

Each app may keep its own Amplify address or take a custom domain:

```
Main App:    my-app.example.com
Users:       users.example.com
Billing:     billing.example.com
Analytics:   analytics.example.com
Engine:      the Engine_URL (project.engineUrl)
```

### Alternative: Path-Based (Single Domain)

Routing several apps under one domain by path, so that they appear as one app, is the
composition that [add-microfrontend-zones](../../add-microfrontend-zones/SKILL.md) covers,
and it is not available on an Engine project yet. If the developer asks for it, tell them so
and stop for that part; keep each app on its own address.
<!-- /buildpad-backend -->

## Amplify Configuration Per App

Each app has its own `amplify.yml`:

```yaml
# my-app/amplify.yml (Main App)
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm build
  artifacts:
    baseDirectory: .next
    files:
      - "**/*"
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

```yaml
# users-app/amplify.yml (Micro-App — same structure)
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm build
  artifacts:
    baseDirectory: .next
    files:
      - "**/*"
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

## Configuration Per Deployment (Auto-Derived from Context)

All values come from `get_project_detail`. **Never use placeholder URLs.**

Configuration is split into two categories:

<!-- buildpad-backend: supabase -->
| Category                                           | Where It Lives                          | Available At Build Time?                                      |
| -------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Infrastructure secrets** (Supabase, DaaS, keys)  | `.env.local` + Amplify console env vars | Yes — set once when Amplify app is created                    |
| **Application URLs** (Main App, microapp URLs) | `config/app-urls.ts` committed to git   | Yes — baked into the codebase, no manual Amplify setup needed |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Category                                                              | Where It Lives                          | Available At Build Time?                                      |
| --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Infrastructure values** (Engine_URL, fixed anon value, tenant id)   | `.env.local` + Amplify console env vars | Yes — set once when Amplify app is created                    |
| **Application URLs** (Main App, microapp URLs)                        | `config/app-urls.ts` committed to git   | Yes — baked into the codebase, no manual Amplify setup needed |
<!-- /buildpad-backend -->

### Infrastructure Env Vars (`.env.local` + Amplify Console)

<!-- buildpad-backend: supabase -->
These are set in the Amplify console when the app is created and don't change:

#### All Apps (Main App + Micro-Apps)

```env
# Set in Amplify console during app creation — same for all apps
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}
```

#### Main App Only (additional)

```env
SUPABASE_SERVICE_ROLE_KEY={{project.supabaseServiceRoleKey}}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
These are set in the Amplify console when the app is created and don't change:

#### All Apps (Main App + Micro-Apps)

On an Engine project the environment is: `NEXT_PUBLIC_SUPABASE_URL=<Engine_URL>`, `NEXT_PUBLIC_BUILDPAD_DAAS_URL=<Engine_URL>`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=buildpad-engine-public-anon-key` (a fixed value that is not a secret; the Engine does not read it, the Supabase client needs one), and `NEXT_PUBLIC_BUILDPAD_TENANT_ID=<the project's tenant id>`. There is no service-role key on an Engine project: add none.

On an Engine project with Customer_Tenants each customer of the application is a tenant of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the tenancy mode as the `add-multitenancy` skill says: from the field `tenancy` of `.buildpad/project.json`, else from `.buildpad/tenancy-answer.json`. In the mode `customer-tenants` that skill's guide `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's tenant; in the mode `scope` they hold as written.

```env
# Set in Amplify console during app creation — same for all apps
NEXT_PUBLIC_SUPABASE_URL={{project.engineUrl}}
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.publicAnonKey}}
NEXT_PUBLIC_BUILDPAD_TENANT_ID={{project.projectTenantId}}
```

There is no variable for the Main App only on an Engine project.
<!-- /buildpad-backend -->

### Application URL Config (`config/app-urls.ts` — Committed to Git)

App URLs live in a committed TypeScript file, not in Amplify environment variables, so
that an Amplify build has them with no console configuration. Environment variables are
optional local development overrides.

File shapes and generation rules: [app-urls config](app-urls-config.instructions.md).


## CI/CD Pipeline (Automated via Git Push)

Each app has its own CI/CD pipeline triggered by git push. Git URLs and tokens come from `get_project_detail`:

```bash
# Deploy a micro-app (git URL from context)
cd /path/to/users-app
git add .
git commit -m "feat: users service update"
git push origin main
# → Amplify builds and deploys automatically
```

A change in one micro-app triggers only that app's deployment:

<!-- buildpad-backend: supabase -->
```
users-app/ code change
  → git push to {{microapp.gitUrl}}
  → Amplify builds users-app
  → Deployed at {{microapp.amplifyUrl}}
  → Main App unchanged (only iframe src URL matters)
  → DaaS backend unchanged (no deployment needed)
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```
users-app/ code change
  → git push to {{microapp.gitUrl}}
  → Amplify builds users-app
  → Deployed at {{microapp.amplifyUrl}}
  → Main App unchanged (it only links to the micro-app's URL)
  → Engine unchanged (no deployment needed)
```
<!-- /buildpad-backend -->

### Deployment Independence Matrix

| Change In                    | Redeploy Main App?  | Redeploy Users?  | Redeploy Billing? | Redeploy DaaS?   |
| ---------------------------- | ------------------- | ---------------- | ----------------- | ---------------- |
| Main App navigation          | Yes                 | No               | No                | No               |
| Users app UI                 | No                  | Yes              | No                | No               |
| Billing app pages            | No                  | No               | Yes               | No               |
| Shared auth config           | Yes                 | Yes              | Yes               | No               |
| New micro-app added          | Yes (add nav + env) | No               | No                | No               |
| New collection added in DaaS | No                  | Maybe (if using) | Maybe (if using)  | N/A (DaaS admin) |
| RBAC permission change       | No                  | No               | No                | N/A (DaaS admin) |
| DaaS hook/extension change   | No                  | No               | No                | N/A (DaaS admin) |

<!-- buildpad-backend: supabase -->
**Note:** DaaS schema and configuration changes (collections, fields, permissions, hooks) are managed via the DaaS admin UI or MCP tools — they don't require app redeployment.
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
**Note:** Engine schema and configuration changes (collections, fields, permissions, hooks) are made through the Studio, the Engine's API or its MCP tools — they don't require app redeployment. Hooks are stored through `POST /api/extensions` with an administrator's session, or by an administrator with the MCP tool `extensions`.
<!-- /buildpad-backend -->

## Health Checks

Each app should expose a health endpoint:

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    status: "ok",
    app: process.env.APP_NAME || "unknown",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "dev",
    daas: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL, // Confirm shared DaaS URL
  };

  return NextResponse.json(checks);
}
```

The Main App can monitor micro-app health:

```typescript
// my-app/lib/health.ts
export async function checkMicroAppHealth(appUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${appUrl}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

## Scaling Considerations

<!-- buildpad-backend: supabase -->
1. **Independent app scaling**: Each Next.js app scales based on its own traffic patterns
2. **Shared DaaS scales centrally**: The DaaS backend scales independently of the Next.js apps
3. **Single database**: One Supabase DB — optimize with indexes and DaaS query optimization
4. **CDN caching**: Static assets from each app cached independently at the edge
5. **SSR caching**: Next.js ISR/PPR can be configured per-app based on data freshness needs
6. **Cost tracking**: App hosting costs are per-team; DaaS/Supabase costs are shared infrastructure
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
1. **Independent app scaling**: Each Next.js app scales based on its own traffic patterns
2. **Shared Engine scales centrally**: The Engine scales independently of the Next.js apps
3. **Single database**: One Engine database for every app — keep queries narrow (`fields`, `filter`, `limit`) and use relational fields instead of repeated calls
4. **CDN caching**: Static assets from each app cached independently at the edge
5. **SSR caching**: Next.js ISR/PPR can be configured per-app based on data freshness needs
6. **Cost tracking**: App hosting costs are per-team; the Engine is shared infrastructure
<!-- /buildpad-backend -->

## Rollback Strategy

Since apps are independent, rollback is per-app:

1. Identify which app has the issue
2. Revert that app's deployment (Amplify rollback or redeploy previous commit)
3. Other apps continue running normally
4. DaaS schema changes may require separate rollback via MCP tools

**DaaS schema rollback:**

- Field additions are generally safe (additive)
- Field removals or type changes need coordination across apps
- Use DaaS field versioning or soft-deprecation patterns
