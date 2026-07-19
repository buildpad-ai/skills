---
name: create-project
description: Initialize a new DaaS (Data-as-a-Service) application with Next.js, Supabase, and Buildpad UI. Creates Phase 0 foundation including project scaffolding, authentication proxy, test infrastructure, and phased development plan. Use when the user wants to start a new project, create a new app, or bootstrap a DaaS application.
argument-hint: "[project name] [description]"
---

# Create DaaS Project

Initialize a new Data-as-a-Service application with **phased development plan**.

> **BEFORE generating ANY `.tsx` files** (pages, layouts, components), you MUST `read_file` the Buildpad component reference at `.github/skills/buildpad-reference/SKILL.md`. This loads the full 40+ component catalog with import paths and usage patterns. Skipping this step leads to raw Mantine usage violations.

## Architecture

DaaS apps use a **two-tier architecture**:

```
Frontend (Next.js) → DaaS Backend (DaaS-compatible API) → Supabase (PostgreSQL)
```

## Step 0: Verify Prerequisites (MANDATORY)

Before creating any project, **automatically check** that all required tools are installed:

```bash
node --version && pnpm --version && git --version && npx --version
```

| Tool    | Min Version | Install Guide                                                                                                                                     |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js | v24 LTS     | https://nodejs.org/en/download — macOS: `brew install node@24`; Linux: `fnm install 24`; Windows: installer or `winget install OpenJS.NodeJS.LTS` |
| pnpm    | v10+        | https://pnpm.io/installation — `corepack enable && corepack prepare pnpm@latest --activate`                                                       |
| Git     | v2.30+      | https://git-scm.com/downloads — macOS: `xcode-select --install`; Linux: `sudo apt-get install git`; Windows: `winget install Git.Git`             |
| npx     | (bundled)   | Comes with Node.js — reinstall Node if missing                                                                                                    |

**If any tool is missing, install it before proceeding.** See [Prerequisites reference](references/prerequisites.instructions.md) for detailed installation instructions per OS.

> **Do NOT skip prerequisites.** Commands like `npx`, `pnpm dev`, and `create-next-app` will fail without them.

## Project Creation (Choose ONE approach)

### Recommended: Bootstrap (single command)

```bash
mkdir -p /path/to/my-project
npx @buildpad/cli@latest bootstrap --cwd /path/to/my-project
```

Bootstrap creates: Next.js skeleton + 40+ Buildpad components + installs ALL npm deps.

### Alternative: create-next-app + CLI add (empty directory only)

```bash
npx create-next-app@latest my-project --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --use-pnpm --turbopack
npx @buildpad/cli@latest add --all --with-api --cwd /path/to/my-project
cd /path/to/my-project && pnpm install
```

**Never mix both approaches.**

## Phased Development (MANDATORY)

| Phase | Name            | Focus                                    |
| ----- | --------------- | ---------------------------------------- |
| **0** | Foundation      | Project setup, auth, test infrastructure |
| **1** | Data Foundation | Schema, API routes, types                |
| **2** | Core UI         | List/detail pages, forms, navigation     |
| **3** | Business Logic  | Validation, workflows, permissions       |
| **4** | Relations       | M2O, M2M, O2M, files, search             |
| **5** | Polish          | Errors, performance, a11y, docs, E2E     |

## Phase 0 Deliverables

1. Project scaffolding (Next.js + TypeScript + Mantine v8)
2. Environment config (`.env.local` with Supabase + DaaS URLs)
3. Auth proxy routes (login, logout, user, callback) — installed by CLI
4. **`app/(authenticated)/layout.tsx`** with `DaaSProviderWrapper` + `ScopeProvider` (NOT in root layout)
5. **`DaaSProviderWrapper`** using `onAuthStateChange` (not `getSession`) + `getHeaders` wired to scope cookie
6. **Logout route** clears `daas_resource_uri` cookie
7. **DaaS CORS** configured with explicit origins + `cors_allow_credentials: true` + `X-Resource-Uri` in allowed headers
8. Base layout and navigation with Mantine provider
9. Test infrastructure (Playwright + Vitest)
10. `PHASES.md` tracking file
11. README with setup instructions

## Post-Bootstrap Steps (MANDATORY — run after `bootstrap` every time)

> **Gap 9:** If the workspace had an existing `node_modules` (e.g. from `npm install`), bootstrap's internal install silently fails. Always run a clean install after bootstrap:

```bash
Remove-Item -Recurse -Force node_modules  # Windows
rm -rf node_modules                       # macOS/Linux
pnpm install
```

## DaaSProviderWrapper Pattern (REQUIRED)

> **Bug 19 + Bug 27:** Always use `onAuthStateChange`, NEVER `getSession` — `getSession` can return `null` before cookies are parsed, causing 401 on first mount. Also pass `token` as a sync prop AND only set `ready = true` when the token is non-null — `INITIAL_SESSION` can fire with `session = null` when the access token is expired and Supabase is performing a silent refresh.  
> **Bug 16:** Always wire `getHeaders` to forward the active scope cookie on every DaaS call.

```tsx
// components/DaaSProviderWrapper.tsx
"use client";
import { DaaSProvider } from "@/lib/buildpad/services/daas-context";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export function DaaSProviderWrapper({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION after cookies are fully parsed —
    // never use getSession() which can return null before cookie parsing finishes.
    // Only set ready when tok is non-null: INITIAL_SESSION can fire with null
    // session when the access token is expired and Supabase is doing a silent refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const tok = session?.access_token ?? null;
      tokenRef.current = tok;
      setTokenState(tok);
      if (tok) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const config = useMemo(
    () => ({
      url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? "",
      token: tokenState ?? undefined, // sync prop so DaaSProvider has token on first render
      getToken: async () => tokenRef.current,
      // Forward the active scope cookie on every DaaS call so scoped collections
      // return data for the correct tenant (required for scope-based RBAC)
      getHeaders: async () => {
        const raw = document.cookie
          .split("; ")
          .find((r) => r.startsWith("daas_resource_uri="))
          ?.split("=")[1];
        return raw ? { "X-Resource-Uri": decodeURIComponent(raw) } : {};
      },
    }),
    [tokenState],
  ); // re-create config when token refreshes

  if (!ready) return null; // block children until auth is fully initialised
  return <DaaSProvider config={config}>{children}</DaaSProvider>;
}
```

**Authenticated layout structure** (Bug 22 — providers MUST NOT be in root layout):

```tsx
// app/(authenticated)/layout.tsx
import { DaaSProviderWrapper } from "@/components/DaaSProviderWrapper";
import { ScopeProvider } from "@/lib/contexts/ScopeContext";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DaaSProviderWrapper>
      <ScopeProvider>{children}</ScopeProvider>
    </DaaSProviderWrapper>
  );
}
```

## CORS Configuration (MANDATORY after project creation)

> **Bug 25 + Bug 17:** The DaaS default `cors_origins: ["*"]` + Buildpad's `credentials: 'include'` = every browser request blocked. Also `X-Resource-Uri` is not in the default allowed headers and must be added.

Run **immediately after project creation**, before wiring any frontend:

```json
// mcp_daas_cors-settings — action: update
{
  "cors_origins": [
    "http://localhost:3000",
    "http://localhost:3001",
    "<mainAmplifyUrl from get_project_detail>"
  ],
  "cors_allow_credentials": true,
  "cors_allowed_headers": [
    "Content-Type",
    "Authorization",
    "Origin",
    "X-Requested-With",
    "Accept",
    "X-Resource-Uri"
  ],
  "cors_max_age": 0
}
```

Never leave `cors_origins: ["*"]` in place — the browser will block every API call.

## Buildpad-First Component Rule (MANDATORY — applies to ALL code generated during and after Phase 0)

**EVERY form, input, list, and filter component MUST use Buildpad.** The CLI bootstrap installs 40+ components — use them. Never fall back to raw Mantine form/input components.

| ❌ NEVER Use Directly                                   | ✅ ALWAYS Use Buildpad Instead                        |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `<TextInput>` / `<Textarea>` from @mantine/core         | `Input`, `Textarea` from `@/components/ui`            |
| `<Select>` from @mantine/core                           | `SelectDropdown` from `@/components/ui`               |
| `<DatePicker>` / `<DateTimePicker>` from @mantine/dates | `DateTime` from `@/components/ui`                     |
| `<Switch>` / `<Checkbox>` from @mantine/core            | `Toggle`, `Boolean`, `SelectMultipleCheckbox`         |
| `<Dropzone>` from @mantine/dropzone                     | `Upload`, `Files`, `FileImage` from `@/components/ui` |
| `useForm` from @mantine/form                            | `VForm` or `CollectionForm` from `@/components/ui`    |
| Custom `<Table>` for collection data                    | `CollectionList` from `@/components/ui`               |
| Custom filter builder                                   | `FilterPanel` from `@/components/ui`                  |
| `<NumberInput>` from @mantine/core                      | `Input` (with type="number") from `@/components/ui`   |
| `<ColorInput>` from @mantine/core                       | `Color` from `@/components/ui`                        |

**Allowed raw Mantine**: `Stack`, `Group`, `Button`, `Modal`, `Table` (for non-collection data), `Tabs`, `Paper`, `Text`, `Title`, `Badge`, `ActionIcon`, `Menu`, `Loader`, `Alert`.

**When generating ANY `.tsx` file** (pages, components, forms, lists), check this table first. If the UI element has a Buildpad equivalent, you MUST use it.

### Quick Reference: Common Patterns

```tsx
// ✅ List page → CollectionList (NEVER custom table)
import { CollectionList } from "@/components/ui";
<CollectionList
  collection="tasks"
  enableSearch
  enableFilter
  enableCreate
  enableDelete
/>;

// ✅ Form page → CollectionForm (NEVER useForm)
import { CollectionForm } from "@/components/ui/collection-form";
<CollectionForm
  collection="tasks"
  onSuccess={(item) => router.push(`/tasks/${item.id}`)}
/>;

// ✅ Individual field → Buildpad component (NEVER raw Mantine input)
import { Input } from "@/components/ui/input";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { DateTime } from "@/components/ui/datetime";
import { Toggle } from "@/components/ui/toggle";
```

## Post-Generation Validation (MANDATORY)

After generating ANY `.tsx` files, run this check to catch Buildpad-First violations:

```bash
# Scan for forbidden raw Mantine form/input imports
grep -rn "from '@mantine/form'\|from '@mantine/dates'\|from '@mantine/dropzone'\|<TextInput\|<NumberInput\|<Select \|<Switch \|<Checkbox \|<DatePicker\|<Dropzone" app/ components/ 2>/dev/null
```

If any matches are found, **replace them with Buildpad equivalents before proceeding**.

## Critical Rules

- **Buildpad-First**: All UI components come from Buildpad CLI — never create custom Input, Select, DateTime, Toggle, File upload, or Relations
- **Auth via Proxy**: Login MUST call `/api/auth/login`, NEVER `supabase.auth.signInWithPassword()` directly
- **No Direct DaaS Calls from Browser**: All API calls go through Next.js API routes
- **NEVER create files manually** in `components/ui/` or `lib/buildpad/` — CLI only
- **DaaSProvider in authenticated layout only**: NEVER place `DaaSProviderWrapper` or `ScopeProvider` in the root `app/layout.tsx`. Always place them in `app/(authenticated)/layout.tsx` so they fully unmount on logout and remount fresh on next login (Bug 22)
- **Mantine components require `'use client'`**: ANY page or component that renders Mantine must have `'use client'` — Mantine compound components (`Table.Tbody`, `Modal`, `Tabs.Panel`) are `undefined` in React Server Components (Bug 10)

## Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BUILDPAD_DAAS_URL=http://localhost:3000
```

## After Phase 0

Use `/start-phase` with phase 1 to continue building.

## References

- [Prerequisites check](references/prerequisites.instructions.md)
- [Project creation details](references/project-creation.instructions.md)
- [Environment setup](references/environment.instructions.md)
