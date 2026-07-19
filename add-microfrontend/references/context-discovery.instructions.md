````markdown
# Context Discovery & Auto-Configuration

## Overview

Before creating or configuring any microservice, the agent MUST discover the full project context automatically using the `get_project_detail` platform MCP tool. This eliminates manual user input for URLs, credentials, and deployment targets.

## Step 0: Call `get_project_detail` (MANDATORY)

This is the **first action** in every microservice or microfrontend operation. The tool returns all project context from the authenticated MCP session:

```json
// Call the platform MCP tool — no arguments needed
{ "name": "get_project_detail", "arguments": {} }
```

### Response Schema

```typescript
interface ProjectDetail {
  success: boolean;
  message: string;
  organization: {
    id: string; // UUID
    name: string; // e.g., "Acme Corp"
  };
  project: {
    id: string; // UUID
    name: string; // e.g., "my-project"
    description: string | null;
    mainGitUrl: string | null; // Git repo URL for Main App (includes credentials)
    mainGitToken: string | null; // Git token for cloning/pushing
    mainAmplifyUrl: string | null; // Resolved Amplify URL for Main App (e.g., https://main.d1234abcde.amplifyapp.com)
    supabaseUrl: string | null; // Shared Supabase URL
    supabaseAnonKey: string | null; // Shared Supabase anon key
    supabaseServiceRoleKey: string | null; // Shared Supabase service role key
    daasUrl: string | null; // Shared DaaS backend URL
    daasVersion: string | null; // DaaS version
    daasAdminEmail: string; // DaaS admin email
    daasAdminPassword: string | null; // DaaS admin password
    createdAt: string;
    updatedAt: string;
  };
  microservices: Array<{
    id: string; // UUID
    name: string; // e.g., "users-app"
    description: string | null;
    gitUrl: string | null; // Git repo URL for this microservice
    gitToken: string | null; // Git token (same as project token)
    amplifyUrl: string | null; // Resolved Amplify URL (e.g., https://main.d5678fghij.amplifyapp.com)
    createdAt: string;
    updatedAt: string;
  }>;
}
```

## Deriving Configuration from Context

Configuration is split into two categories:

| Category                                                                        | Where It Lives                          | Why                                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| **Infrastructure secrets** (Supabase URL, anon key, service role key, DaaS URL) | `.env.local` + Amplify console env vars | Sensitive credentials — never committed to git                                         |
| **Application URLs** (Main App URL, microservice URLs)                          | `config/app-urls.ts` committed to git   | Dynamic URLs that must be available at Amplify build time without manual env var setup |

### Infrastructure Environment Variables (`.env.local` + Amplify Console)

Use the response to auto-populate `.env.local` for any app — **never ask the user for these values**:

#### Main App `.env.local`

```env
# Auto-populated from get_project_detail → project.* (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}
SUPABASE_SERVICE_ROLE_KEY={{project.supabaseServiceRoleKey}}
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev overrides for app URLs (overrides config/app-urls.ts defaults)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
# NEXT_PUBLIC_USERS_APP_URL=http://localhost:3001
```

#### Micro-App `.env.local`

```env
# Auto-populated — same shared backend for all apps (also set in Amplify console)
NEXT_PUBLIC_SUPABASE_URL={{project.supabaseUrl}}
NEXT_PUBLIC_SUPABASE_ANON_KEY={{project.supabaseAnonKey}}
NEXT_PUBLIC_BUILDPAD_DAAS_URL={{project.daasUrl}}

# Optional: local dev override for host origin (overrides config/app-urls.ts default)
# NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
```

### Application URL Config (Committed to Git — `config/app-urls.ts`)

App URLs (Main App + microservice Amplify URLs) are stored in a **committed TypeScript config file** rather than environment variables. This ensures URLs are available at Amplify build time without manual env var setup in the Amplify console.

Environment variables serve as **optional overrides** for local development (e.g., `localhost` URLs).

#### Main App `config/app-urls.ts`

```typescript
// config/app-urls.ts
// Auto-generated from get_project_detail. Committed to git.
//
// These URLs are baked into the build so Amplify deployments work without
// manually setting URL env vars in the Amplify console.
//
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

#### Micro-App `config/app-urls.ts`

```typescript
// config/app-urls.ts
// Auto-generated from get_project_detail. Committed to git.
//
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

> **Why this pattern?** Infrastructure variables (Supabase, DaaS) are static and set once when the Amplify app is created. But app URLs change whenever a microservice is added — storing them in committed code means a `git push` is all that's needed to propagate URL changes through Amplify builds.

### Service Registry (Auto-Generated `lib/services.ts`)

Generate the service registry from the microservices list, importing URLs from the committed config:

```typescript
// lib/services.ts — auto-generated from get_project_detail response
import { MICROSERVICE_URLS, type MicroserviceKey } from '@/config/app-urls';

export const MICRO_APPS = {
  {{#each microservices}}
  '{{name}}': {
    url: MICROSERVICE_URLS['{{name}}'],
    label: '{{titleCase(name)}}',
  },
  {{/each}}
} as const;

export type MicroAppKey = keyof typeof MICRO_APPS;
```

### Git Operations (Auto-Configured)

Clone microservice repos using the discovered git URL and token:

```bash
# Clone microservice — URL includes credentials from get_project_detail
git clone {{microservice.gitUrl}} /path/to/{{microservice.name}}

# Or if gitUrl doesn't include token, construct authenticated URL:
# git clone https://oauth2:{{project.mainGitToken}}@github.com/org/{{microservice.name}}.git
```

## Amplify URL Resolution

The `get_project_detail` tool resolves Amplify URLs from AWS Amplify app IDs stored in the platform database:

```
project.main_amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
microservice.amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
```

**Important:**

- If `amplifyUrl` is `null`, the Amplify app hasn't been created yet or the AWS credentials are not configured
- When `amplifyUrl` is null, the agent should note this and instruct the user to set up Amplify, or use a local dev URL as fallback
- Amplify URLs follow the pattern `https://main.d{random}.amplifyapp.com` for the default domain
- Custom domains may be configured separately in Amplify console

## Context-Aware Workflow

The complete automated workflow uses context discovery at every decision point:

```
1. Call get_project_detail
   ├── Extract project.daasUrl, project.supabaseUrl, etc. (shared infra)
   ├── Extract project.mainAmplifyUrl (Main App URL for HOST_ORIGIN)
   ├── Extract microservices[] (existing micro-apps)
   └── Extract mainGitUrl, mainGitToken (for git operations)

2. Determine what exists vs. what needs creation
   ├── Check if requested microservice name already exists in microservices[]
   ├── If exists: clone its gitUrl, configure env, continue development
   └── If new: bootstrap project, register microservice, set up Amplify

3. Auto-generate all configuration
   ├── .env.local for infrastructure vars (Supabase, DaaS — no user input)
   ├── config/app-urls.ts with deployed URLs (committed to git)
   ├── lib/services.ts importing from config/app-urls.ts
   └── amplify.yml (standard build spec)

4. Deploy via git push
   ├── Commit changes to microservice repo (includes config/app-urls.ts)
   ├── Push to main branch → triggers Amplify build
   └── Update Main App's config/app-urls.ts with new microservice URL → push → rebuild
```

## Validation Checklist

After context discovery, verify:

- [ ] `project.daasUrl` is not null (DaaS backend must exist)
- [ ] `project.supabaseUrl` is not null (Supabase must be configured)
- [ ] `project.supabaseAnonKey` is not null
- [ ] `project.mainAmplifyUrl` is not null (Main App must be deployed)
- [ ] Microservice `amplifyUrl` is resolved (or marked as pending if new)
- [ ] `project.mainGitToken` is available for git operations

If any critical value is missing, report it to the user with a specific remediation step rather than proceeding with placeholders.

## Anti-Patterns

| Anti-Pattern                              | Why It's Bad                                          | Correct Approach                                                               |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Asking user for DaaS URL                  | Already available via `get_project_detail`            | Auto-discover from context                                                     |
| Hardcoding `example.com` URLs             | Breaks in real deployments                            | Use `amplifyUrl` from context                                                  |
| Asking user for Supabase credentials      | Already in project context                            | Auto-populate from `get_project_detail`                                        |
| Skipping context discovery                | All subsequent steps use wrong/placeholder values     | Always call `get_project_detail` first                                         |
| Using placeholder env vars                | App won't connect to real backend                     | Derive all from context response                                               |
| Manually constructing Amplify URLs        | URL format may change                                 | Use resolved `amplifyUrl` from tool                                            |
| Putting app URLs only in Amplify env vars | URLs not available at build time without manual setup | Commit URLs in `config/app-urls.ts` so builds are self-contained               |
| Hardcoding URLs in `.env.local` only      | Not committed to git, not available in Amplify builds | Use `config/app-urls.ts` (committed) with `.env.local` overrides for local dev |
````
