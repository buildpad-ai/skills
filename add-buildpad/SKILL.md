---
name: add-buildpad
description: Add Buildpad UI components to a DaaS project via CLI. Installs Copy & Own components from the registry including input, selection, boolean, datetime, media, rich-text, relations, layout, collection, and workflow components. Use when the user says add-buildpad, install components, or needs Buildpad UI.
argument-hint: "[component names or --all] [--cwd path/to/project]"
---

# Add Buildpad Components

Install Buildpad UI components using the CLI. Components are copied as source code to your project (Copy & Own model).

## Prerequisites Check (MANDATORY)

Before running any CLI commands, verify required tools:

```bash
node --version && pnpm --version && npx --version
```

| Tool    | Min Version | Install Guide                                                                                                                                     |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js | v24 LTS     | https://nodejs.org/en/download — macOS: `brew install node@24`; Linux: `fnm install 24`; Windows: installer or `winget install OpenJS.NodeJS.LTS` |
| pnpm    | v10+        | https://pnpm.io/installation — `corepack enable && corepack prepare pnpm@latest --activate`                                                       |
| npx     | (bundled)   | Comes with Node.js — reinstall Node if missing                                                                                                    |

**If any tool is missing, install it before proceeding.** See [create-project prerequisites](../create-project/references/prerequisites.instructions.md) for detailed OS-specific instructions.

## CRITICAL: Never Create Components Manually

```
❌ NEVER CREATE MANUALLY:
├── components/ui/*.tsx          # ALL UI components — from CLI only
├── lib/buildpad/              # ENTIRE folder — from CLI only
│   ├── services/                # api-request, items, fields, collections
│   ├── hooks/                   # useRelationM2M, useFiles, etc.
│   ├── types/                   # Field, Collection, File types
│   ├── utils/                   # utilities
│   └── ui-form/                 # VForm, FormField components
└── buildpad.json              # Created by CLI init
```

## Installation Commands

```bash
# Via npx (no local clone needed)
npx @buildpad/cli@latest add --all --with-api --cwd /path/to/project

# Individual components
npx @buildpad/cli@latest add input select-dropdown datetime toggle --cwd /path/to/project
```

## Component Categories

| Category        | Components                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input**       | input, textarea, input-code, input-block-editor, tags, map, map-with-real-map                                                                                             |
| **Selection**   | select-dropdown, select-radio, select-multiple-checkbox, select-multiple-checkbox-tree, select-multiple-dropdown, autocomplete-api, collection-item-dropdown, select-icon |
| **Boolean**     | boolean, toggle                                                                                                                                                           |
| **DateTime**    | datetime                                                                                                                                                                  |
| **Media**       | file, file-image, files, upload, color                                                                                                                                    |
| **Rich-text**   | rich-text-html, rich-text-markdown                                                                                                                                        |
| **Relations**   | list-m2m, list-m2o, list-o2m, list-m2a                                                                                                                                    |
| **Layout**      | divider, notice, group-detail, slider                                                                                                                                     |
| **Collections** | vform, collection-form, vtable, collection-list, filter-panel, content-navigation, content-layout, save-options                                                           |
| **Workflow**    | workflow-button                                                                                                                                                           |
| **Modules**     | `files-routes` (+ file-manager), `form-builder` `forms-routes` — full multi-screen experiences, scaffolded whole (see below)                                              |

## Opt-in Modules (whole experiences)

Beyond individual components, two ready-made modules install their own page shells, components, and hooks in one command. Use the dedicated skills — do not compose these by hand:

```bash
# Files library — /files (FileManager) + /files/[id] (FileDetail)
npx @buildpad/cli@latest add files-routes --cwd /path/to/project        # → /add-files

# Dynamic Form Builder — /forms author + fill (FormBuilder + DynamicForm)
npx @buildpad/cli@latest add form-builder forms-routes --cwd /path/to/project  # → /create-form-builder
```

Both also need the DaaS proxy routes: `npx @buildpad/cli@latest add api-routes --cwd /path/to/project`. See [add-files](../add-files/SKILL.md) and [create-form-builder](../create-form-builder/SKILL.md).

> The `ui.buildpad.ai` docs use the shorthand `buildpad add <targets>` (global install); `npx @buildpad/cli@latest add <targets>` is the equivalent no-install form.

## Post-Install Validation

```bash
# 1. Check installation status
npx @buildpad/cli@latest status --cwd /path/to/project

# 2. Fix any untransformed @buildpad/* imports
grep -r "from '@buildpad/" components/ lib/ 2>/dev/null

# 3. Run validation
npx @buildpad/cli@latest validate --cwd /path/to/project

# 4. Auto-fix common issues
npx @buildpad/cli@latest fix --cwd /path/to/project

# 5. Build to verify
cd /path/to/project && pnpm build
```

## Key Dependencies

If `pnpm install` doesn't resolve everything after CLI add:

```bash
pnpm add clsx tailwind-merge @mantine/core @mantine/hooks @mantine/dates @mantine/dropzone @mantine/tiptap @tabler/icons-react dayjs @supabase/ssr @supabase/supabase-js
```

## References

- [Buildpad component guide](references/buildpad.instructions.md)
