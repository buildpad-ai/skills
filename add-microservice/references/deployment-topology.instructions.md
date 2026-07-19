````markdown
# Deployment Topology

## Overview

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
- `microservices[].amplifyUrl` — Each micro-app's deployed Amplify URL
- `microservices[].gitUrl` — Each micro-app's Git repo URL
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

| Category                                           | Where It Lives                          | Available At Build Time?                                      |
| -------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Infrastructure secrets** (Supabase, DaaS, keys)  | `.env.local` + Amplify console env vars | Yes — set once when Amplify app is created                    |
| **Application URLs** (Main App, microservice URLs) | `config/app-urls.ts` committed to git   | Yes — baked into the codebase, no manual Amplify setup needed |

### Infrastructure Env Vars (`.env.local` + Amplify Console)

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

### Application URL Config (`config/app-urls.ts` — Committed to Git)

App URLs are NOT stored as Amplify env vars. Instead, they are committed to the codebase so Amplify builds are self-contained. Environment variables serve as optional overrides for local development.

#### Main App `config/app-urls.ts`

```typescript
// config/app-urls.ts — committed to git, auto-generated from get_project_detail
// For local development, override via .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
//   NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001

/** Main App deployed URL */
export const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || '{{project.mainAmplifyUrl}}';

/** Microservice deployed URLs (used as iframe src in the Main App) */
export const MICROSERVICE_URLS = {
  {{#each microservices}}
  '{{name}}': process.env.NEXT_PUBLIC_{{UPPERCASE(name)}}_URL || '{{amplifyUrl}}',
  {{/each}}
} as const;

export type MicroserviceKey = keyof typeof MICROSERVICE_URLS;
```

#### Each Micro-App `config/app-urls.ts`

```typescript
// config/app-urls.ts — committed to git, auto-generated from get_project_detail
// For local development, override via .env.local:
//   NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000

/** Main App URL (host origin for postMessage security validation) */
export const HOST_ORIGIN =
  process.env.NEXT_PUBLIC_HOST_ORIGIN || "{{project.mainAmplifyUrl}}";
```

> **⚠️ CRITICAL — `config/app-urls.ts` Generation Rules:**
>
> 1. The **hardcoded string literal** (right side of `||`) MUST be the **actual deployed Amplify URL** resolved from `get_project_detail`. NEVER use `localhost`, `127.0.0.1`, or any placeholder URL as the hardcoded default.
> 2. The **env var** (left side of `||`) is a **single** `process.env.NEXT_PUBLIC_*` override for local development. NEVER chain multiple env vars.
> 3. Each export line must have **exactly one** `process.env.*` and **exactly one** hardcoded URL string.
>
> ```typescript
> // ❌ WRONG — localhost as default, chained env vars
> process.env.NEXT_PUBLIC_HOST_ORIGIN || process.env.NEXT_PUBLIC_HOST_ORIGIN_MAIN || 'http://localhost:3000'
>
> // ❌ WRONG — localhost as default
> 'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'http://localhost:3001',
>
> // ✅ CORRECT — actual Amplify URL as default, single env var override
> process.env.NEXT_PUBLIC_HOST_ORIGIN || 'https://main.d1234abcde.amplifyapp.com'
> 'users-app': process.env.NEXT_PUBLIC_USERS_APP_URL || 'https://main.d5678fghij.amplifyapp.com',
> ```
>
> When generating `config/app-urls.ts`, substitute actual resolved values from the `get_project_detail` response as the default fallbacks. The env var override name for microservices follows the pattern `NEXT_PUBLIC_` + name uppercased with hyphens as underscores + `_URL` (e.g., `users-app` → `NEXT_PUBLIC_USERS_APP_URL`).

> **Why committed to git?** Infrastructure variables (Supabase, DaaS) are static — set once in the Amplify console when the app is created. But app URLs change whenever a microservice is added. Storing URLs in committed code means adding a new microservice only requires: (1) update `config/app-urls.ts`, (2) `git push` → Amplify rebuilds with the new URL. No manual Amplify console env var changes needed.

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

```
users-app/ code change
  → git push to {{microservice.gitUrl}}
  → Amplify builds users-app
  → Deployed at {{microservice.amplifyUrl}}
  → Main App unchanged (only iframe src URL matters)
  → DaaS backend unchanged (no deployment needed)
```

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

**Note:** DaaS schema and configuration changes (collections, fields, permissions, hooks) are managed via the DaaS admin UI or MCP tools — they don't require app redeployment.

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

1. **Independent app scaling**: Each Next.js app scales based on its own traffic patterns
2. **Shared DaaS scales centrally**: The DaaS backend scales independently of the Next.js apps
3. **Single database**: One Supabase DB — optimize with indexes and DaaS query optimization
4. **CDN caching**: Static assets from each app cached independently at the edge
5. **SSR caching**: Next.js ISR/PPR can be configured per-app based on data freshness needs
6. **Cost tracking**: App hosting costs are per-team; DaaS/Supabase costs are shared infrastructure

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
````
