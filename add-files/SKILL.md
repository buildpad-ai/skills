---
name: add-files
description: Scaffold the Buildpad Files module — a ready-made /files library (FileManager) and /files/[id] detail view (FileDetail) with drag-and-drop upload, import-from-URL, folders, grid/list views, preview, metadata editing, and bulk delete. Backed by the useFiles/useFolders hooks and asset thumbnails. Use when the user says add files, file manager, file library, files module, uploads page, or wants a document/media library.
argument-hint: "[--cwd path/to/project]"
---

# Add the Files Module

A ready-made `/files` experience installed via the Buildpad CLI (Copy & Own — the code is copied into your project). It sits on top of the DaaS Files API and the `Upload` interface, so you never hand-build upload zones, folder navigation, previews, or bulk actions.

Two screens ship together:

- **`FileManager`** — the `/files` library: drag-and-drop upload, import-from-URL, folder navigation with breadcrumbs, grid/list views, search, multi-select, bulk delete.
- **`FileDetail`** — the `/files/[id]` page: a **Preview** tab (image/video/audio inline, PDF in an iframe) and a **Details** tab with an editable metadata form, plus single delete.

## CRITICAL: Never Create These Manually

Like all Buildpad UI, the Files module is CLI-installed and owned as source. Do **not** hand-write `components/ui/file-manager/*`, the `upload` component, or the `useFiles`/`useFolders` hooks in `lib/buildpad/hooks/` — scaffold them.

## Prerequisites Check

```bash
node --version && pnpm --version && npx --version
```

Requires Node.js v24 LTS and pnpm v10+ (see [add-buildpad](../add-buildpad/SKILL.md) for install guidance). The module **must** render under the authenticated layout (`buildpad init` generates `app/(authenticated)/` with a `DaaSProviderWrapper`) so `DaaSProvider` header injection is in scope — the hooks call your `/api/files/*`, `/api/folders/*`, and `/api/assets/*` proxy routes.

**DaaS CORS must be configured first.** `FileManager`/`FileDetail` fetch authenticated DaaS endpoints (`/users/me`, `/permissions/me`, file/folder items) from the browser with `credentials: 'include'`. DaaS's default `cors_origins: ["*"]` is **incompatible** with credentialed requests — the browser blocks every preflight (`Access-Control-Allow-Origin header must not be the wildcard '*'`). Set explicit origins before mounting the module (see [daas-platform](../daas-platform/SKILL.md) "CORS must use explicit origins" — Bugs 17+25 — and [debugging-and-error-recovery](../debugging-and-error-recovery/SKILL.md)). This is not Files-specific: it affects every authenticated Buildpad component.

## Installation

The Files module is **opt-in** — it is not part of `bootstrap`.

```bash
# 1. Add the module (copies app/files/ shells, components/ui/file-manager/,
#    the upload component, and the useFiles/useFolders hooks)
npx @buildpad/cli@latest add files-routes --cwd /path/to/project

# 2. Add the DaaS proxy routes it needs (if not already present)
npx @buildpad/cli@latest add api-routes --cwd /path/to/project
```

> The docs use the shorthand `buildpad add files-routes` when the CLI is installed globally; `npx @buildpad/cli@latest add …` is the equivalent no-install form used across these skills.

> **If the CLI command fails, `@buildpad/cli` IS published to npm** — verify with `npm view @buildpad/cli version` before assuming otherwise or reaching for a local clone. The CLI fetches its registry from `raw.githubusercontent.com`, so confirm the environment can reach **both** npm and the GitHub raw CDN. A local clone is only needed for CLI development, never to consume components.

`api-routes` includes exactly the routes this module needs: `app/api/files/route.ts`, `app/api/files/[id]/route.ts`, `app/api/files/import/route.ts`, `app/api/folders/route.ts`, `app/api/folders/[id]/route.ts`, and `app/api/assets/[id]/route.ts`.

## The Routes

```
app/files/
├── layout.tsx        # optional shell wrapper (centers content)
├── page.tsx          # /files       — FileManager library view
└── [id]/page.tsx     # /files/[id]  — FileDetail preview + metadata view
```

## Usage

### List view — `FileManager`

```tsx
// app/files/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { FileManager } from "@/components/ui/file-manager";

export default function FilesPage() {
  const router = useRouter();
  return <FileManager onFileClick={(file) => router.push(`/files/${file.id}`)} />;
}
```

| Prop | Type | Default | Purpose |
| ---------------- | ------------------------- | ------------ | ------------------------------------------------- |
| `onFileClick`    | `(file: FileUpload) => void` | —          | Open a file (e.g. navigate to its detail page)    |
| `pageSize`       | `number`                  | `24`         | Items per page                                    |
| `defaultView`    | `'grid' \| 'list'`        | `'grid'`     | Initial view mode                                 |
| `enableFolders`  | `boolean`                 | `true`       | Set `false` for a flat library with no folder UI  |
| `filesCollection`| `string`                  | `'daas_files'` | DaaS collection used for RBAC checks            |

### Detail view — `FileDetail`

```tsx
// app/files/[id]/page.tsx
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { FileDetail } from "@/components/ui/file-manager";

export default function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <FileDetail
      id={id}
      onBack={() => router.push("/files")}
      onDeleted={() => router.push("/files")}
    />
  );
}
```

`FileDetail` props: `id` (required), `onBack?`, `onDeleted?`, `filesCollection?` (default `'daas_files'`). Metadata edits, folder moves, focal point, and delete are all permission-gated.

## The Data Layer (reuse anywhere)

Both screens are thin wrappers over two hooks from `@/lib/buildpad/hooks`:

```tsx
import { useFiles, useFolders } from "@/lib/buildpad/hooks";
```

- **`useFiles()`** → `uploadFiles`, `fetchFiles`, `getFile`, `updateFile`, `replaceFile`, `getDownloadUrl`, `deleteFile`, `deleteFiles`, `importFromUrl` (+ `loading`, `error`). `updateFile` takes the full editable metadata set:

  ```tsx
  await updateFile(fileId, {
    title: "Cover image",
    description: "Homepage hero",
    tags: ["marketing", "hero"],
    location: "HQ",
    filename_download: "hero.png",
  });
  ```

- **`useFolders()`** → `fetchFolders`, `createFolder`, `updateFolder`, `deleteFolder` (+ `loading`, `error`). Pass `parent: null` for the root:

  ```tsx
  const rootFolders = await fetchFolders({ parent: null });
  const folder = await createFolder({ name: "Campaigns", parent: null });
  ```

### Thumbnails & downloads

Assets are served by `/api/assets/[id]`. Build transform URLs with `getAssetUrl` from `@/lib/buildpad/types`:

```tsx
import { getAssetUrl } from "@/lib/buildpad/types";

getAssetUrl(id, { width: 240, height: 240, fit: "cover" }); // grid thumbnail
getAssetUrl(id, { download: true });                         // download link
```

## Preview Behaviour (Details tab)

| MIME type | Rendering |
| ------------- | ----------------------- |
| Image         | `<img>` inline          |
| Video         | HTML5 `<video>` player  |
| Audio         | HTML5 `<audio>` player  |
| PDF           | Embedded `<iframe>`     |
| Anything else | Icon + download button  |

## Post-Install Validation

```bash
npx @buildpad/cli@latest status --cwd /path/to/project
npx @buildpad/cli@latest validate --cwd /path/to/project
cd /path/to/project && pnpm build
```

## See It Live

Files Storybook (port 6009): `pnpm --filter @buildpad/ui-files storybook`. The `FileManager (DaaS)` story connects to a real DaaS instance via the storybook-host proxy.

## Related

- [add-buildpad](../add-buildpad/SKILL.md) — the underlying CLI and the low-level `Upload` / `FileInterface` / `FileImage` field widgets.
- [buildpad-reference](../buildpad-reference/SKILL.md) — full component catalog.
