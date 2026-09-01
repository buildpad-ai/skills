# Context Discovery & Auto-Configuration

## Overview

Before creating or configuring any microapp, the agent MUST discover the full project context automatically using the `get_project_detail` platform MCP tool. This eliminates manual user input for URLs, credentials, and deployment targets.

## Step 0: Call `get_project_detail` (MANDATORY)

This is the **first action** in every microapp or microfrontend operation. The tool returns all project context from the authenticated MCP session:

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
  microapps: Array<{
    id: string; // UUID
    name: string; // e.g., "users-app"
    description: string | null;
    gitUrl: string | null; // Git repo URL for this microapp
    gitToken: string | null; // Git token (same as project token)
    amplifyUrl: string | null; // Resolved Amplify URL (e.g., https://main.d5678fghij.amplifyapp.com)
    createdAt: string;
    updatedAt: string;
  }>;
}
```

## Deriving Configuration from Context

Configuration is split in two:

| Category                                                          | Where it lives                            | Why                                                             |
| ----------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Infrastructure secrets (Supabase URL, keys, DaaS URL)             | `.env.local` and the Amplify console      | Sensitive. Never committed.                                      |
| Application URLs (Main App URL, micro-app URLs, host origin)      | `config/app-urls.ts`, committed to git    | Must exist at Amplify build time with no console configuration.  |

The file shapes, the generation rules, and the failure modes are in one place:
[app-urls config](app-urls-config.instructions.md).


### Service Registry (Auto-Generated `lib/services.ts`)

Generate the service registry from the microapps list, importing URLs from the committed config:

```typescript
// lib/services.ts — generated from the get_project_detail response.
import { MICROAPP_URLS } from '@/config/app-urls';

export const MICRO_APPS = {
  // AGENT: replace this block with one entry per item in microapps[].
  // Keep the shape exactly. Do not emit template syntax into a TypeScript file.
  'users-app': { url: MICROAPP_URLS['users-app'], label: 'Users' },
  'billing-app': { url: MICROAPP_URLS['billing-app'], label: 'Billing' },
} as const;

export type MicroAppKey = keyof typeof MICRO_APPS;
```

### Git Operations (Auto-Configured)

Clone microapp repos using the discovered git URL and token:

```bash
# Clone microapp — URL includes credentials from get_project_detail
git clone {{microapp.gitUrl}} /path/to/{{microapp.name}}

# Or if gitUrl doesn't include token, construct authenticated URL:
# git clone https://oauth2:{{project.mainGitToken}}@github.com/org/{{microapp.name}}.git
```

## Amplify URL Resolution

The `get_project_detail` tool resolves Amplify URLs from AWS Amplify app IDs stored in the platform database:

```
project.main_amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
microapp.amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
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
   ├── Extract microapps[] (existing micro-apps)
   └── Extract mainGitUrl, mainGitToken (for git operations)

2. Determine what exists vs. what needs creation
   ├── Check if requested microapp name already exists in microapps[]
   ├── If exists: clone its gitUrl, configure env, continue development
   └── If new: bootstrap project, register microapp, set up Amplify

3. Auto-generate all configuration
   ├── .env.local for infrastructure vars (Supabase, DaaS — no user input)
   ├── config/app-urls.ts with deployed URLs (committed to git)
   ├── lib/services.ts importing from config/app-urls.ts
   └── amplify.yml (standard build spec)

4. Deploy via git push
   ├── Commit changes to microapp repo (includes config/app-urls.ts)
   ├── Push to main branch → triggers Amplify build
   └── Update Main App's config/app-urls.ts with new microapp URL → push → rebuild
```

## Validation Checklist

After context discovery, verify:

- [ ] `project.daasUrl` is not null (DaaS backend must exist)
- [ ] `project.supabaseUrl` is not null (Supabase must be configured)
- [ ] `project.supabaseAnonKey` is not null
- [ ] `project.mainAmplifyUrl` is not null (Main App must be deployed)
- [ ] Microapp `amplifyUrl` is resolved (or marked as pending if new)
- [ ] `project.mainGitToken` is available for git operations

If any critical value is missing, report it to the user with a specific remediation step rather than proceeding with placeholders.

## Anti-Patterns

| Anti-Pattern                         | Why It's Bad                                      | Correct Approach                        |
| ------------------------------------ | ------------------------------------------------- | --------------------------------------- |
| Asking user for DaaS URL             | Already available via `get_project_detail`        | Auto-discover from context              |
| Hardcoding `example.com` URLs        | Breaks in real deployments                        | Use `amplifyUrl` from context           |
| Asking user for Supabase credentials | Already in project context                        | Auto-populate from `get_project_detail` |
| Skipping context discovery           | All subsequent steps use wrong/placeholder values | Always call `get_project_detail` first  |
| Using placeholder env vars           | App won't connect to real backend                 | Derive all from context response        |
| Manually constructing Amplify URLs   | URL format may change                             | Use resolved `amplifyUrl` from tool     |
