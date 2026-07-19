````instructions
---
name: Project Creation
description: Instructions for creating new projects without errors
applyTo: "**/*.{ts,tsx,md}"
---

# Project Creation Instructions

## 🔴 Common Failure: `create-next-app` in Non-Empty Directory

`npx create-next-app` will REFUSE to run in a directory that already has files. This is the #1 failure mode during app generation.

### Symptoms

- Error: "The directory ... contains files that could conflict"
- Error: "The directory is not empty"
- Terminal hangs waiting for user input about overwriting files
- Agent gets stuck in a retry loop

### Root Cause

The AI agent often:
1. Tries to run `create-next-app .` inside the workspace root (which has many projects)
2. Creates a directory, copies `.github/` (or `.kiro/`) files, THEN tries to run `create-next-app` (now non-empty)
3. Runs `create-next-app` inside an existing project directory

### Prevention Rules

1. **ALWAYS create projects as a NEW child directory from the parent**:
   ```bash
   cd /path/to/parent-directory
   npx create-next-app@latest project-name --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --use-pnpm --turbopack
````

2. **NEVER run `create-next-app .` (with dot)** — this tries to scaffold IN the current directory

3. **NEVER create any files before running `create-next-app`** — do all file creation AFTER

4. **Use `--use-pnpm` flag** to avoid npm/pnpm conflicts in workspaces

5. **Use `--turbopack` flag** for faster dev server

### Recovery: Use Bootstrap Instead

If `create-next-app` fails for ANY reason, use the Buildpad CLI bootstrap:

```bash
# This works in any directory, empty or not
mkdir -p /path/to/project

# Option A: npx (no local clone needed)
npx @buildpad/cli@latest bootstrap --cwd /path/to/project

# Option B: local clone
cd /path/buildpad-ui && pnpm cli bootstrap --cwd /path/to/project
```

Bootstrap creates a complete project skeleton:

- `package.json` with all dependencies
- `tsconfig.json` with path aliases
- `next.config.ts`
- `app/layout.tsx` and `app/page.tsx`
- All 40+ Buildpad UI components
- API proxy routes
- Supabase auth utilities

### Correct Phase 0 Sequence

**Step 0: Prerequisites Check (ALWAYS FIRST)**

Before ANY project creation, verify required tools are installed:

```bash
node --version && pnpm --version && git --version && npx --version
```

If any tool is missing, install it automatically based on the user's OS:

- **Node.js missing (v24 LTS):** macOS: `brew install node@24`; Linux: `fnm install 24`; Windows: download from https://nodejs.org/en/download or `winget install OpenJS.NodeJS.LTS`
- **pnpm missing (v10+):** All OS: `corepack enable && corepack prepare pnpm@latest --activate` (or see https://pnpm.io/installation)
- **Git missing:** macOS: `xcode-select --install`; Linux: `sudo apt-get install git`; Windows: `winget install Git.Git`

See [prerequisites.instructions.md](prerequisites.instructions.md) for full details.

**Option A: Using bootstrap (RECOMMENDED — single command, works on empty or non-empty dirs)**

```
1. ✅ Prerequisites verified             (Step 0 above)
2. Create directory                → mkdir -p /path/to/project
3. Run bootstrap                   → npx @buildpad/cli@latest bootstrap --cwd /path/to/project
   (or from local clone: pnpm cli bootstrap --cwd /path/to/project)
   (creates Next.js skeleton, installs ALL components, installs ALL npm deps)
4. Create .env.local               → Only NOW create project-specific files
5. Create app pages                → app/login/page.tsx, etc.
6. Create .github/ & .kiro/ folders → Copy AI tools LAST (not first!)
7. Run Buildpad-First validation   → grep for forbidden Mantine imports (see below)
```

**Option B: Using create-next-app (only for empty directories)**

```
1. ✅ Prerequisites verified             (Step 0 above)
2. Create EMPTY directory          → mkdir -p /path/to/project
3. Run create-next-app from PARENT → cd /path/to && npx create-next-app project-name ...
4. Add Buildpad components       → npx @buildpad/cli@latest add --all --with-api --cwd /path/to/project-name
   (or from local clone: pnpm cli add --all --with-api --cwd /path/to/project-name)
5. Install dependencies            → cd /path/to/project-name && pnpm install
6. Create .env.local               → Only NOW create project-specific files
7. Create app pages                → app/login/page.tsx, etc.
8. Create .github/ & .kiro/ folders → Copy AI tools LAST (not first!)
9. Run Buildpad-First validation   → grep for forbidden Mantine imports (see below)
```

> **Do NOT mix Option A and B.** If you use bootstrap, you do NOT need create-next-app or separate `pnpm add` commands.

### Post-Generation Buildpad-First Validation (MANDATORY after EVERY code generation step)

After creating any `.tsx` files, run this check:

```bash
grep -rn "from '@mantine/form'\|from '@mantine/dates'\|from '@mantine/dropzone'\|<TextInput\|<NumberInput\|<Select \|<Switch \|<Checkbox \|<DatePicker\|<Dropzone" app/ components/ 2>/dev/null
```

If matches are found, **replace with Buildpad equivalents** before proceeding. See the Buildpad-First rule table in `create-project/SKILL.md` for the mapping.

## 🔴 Common Failure: Missing Prerequisites (Node.js, pnpm, Git)

Running `npx`, `pnpm`, or `create-next-app` without the required tools installed causes cryptic errors or `command not found`.

### Symptoms

- `command not found: node` or `command not found: npx`
- `command not found: pnpm`
- `npm ERR! engine` — Node.js version too old
- `npx: command not found` — Node.js not installed
- `create-next-app` hangs or errors silently

### Prevention

**ALWAYS run the prerequisites check before any project creation:**

```bash
node --version && pnpm --version && git --version
```

### Recovery

If prerequisites are missing, install them in order:

1. **Node.js first** (provides `node`, `npm`, `npx`, and `corepack`)
2. **pnpm second** (via `corepack enable && corepack prepare pnpm@latest --activate`)
3. **Git** (usually pre-installed on macOS/Linux)

See [prerequisites.instructions.md](prerequisites.instructions.md) for OS-specific installation commands.

**After installing, verify the installation succeeded before retrying the project creation:**

```bash
node --version   # Expect v24+
pnpm --version   # Expect v10+
git --version    # Expect v2.30+
```

## 🔴 Common Failure: Interactive Prompts Hang AI Agents

`create-next-app` and `pnpm cli init` have interactive prompts that cause the terminal to hang when run by AI agents.

### Prevention

- Use `--yes` or `-y` flags on all interactive commands
- Use `pnpm cli init -y` for non-interactive init
- Use `npx @buildpad/cli@latest bootstrap` or `pnpm cli bootstrap` which is fully non-interactive
- Use all flags explicitly with `create-next-app` to avoid prompts:
  ```bash
  npx create-next-app@latest name --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --use-pnpm --turbopack
  ```

## 🔴 Common Failure: Missing Dependencies After CLI Add

The Buildpad CLI `add` command copies source files but may not install all npm dependencies automatically.

### Prevention

Use `bootstrap` instead of `init` + `add` — bootstrap runs `pnpm install` automatically after adding all components.

If using manual steps (`init` + `add --all`):

```bash
# After pnpm cli add --all, ALWAYS run:
cd /path/to/project && pnpm install
```

> **Do NOT run `pnpm add @mantine/...` manually after bootstrap. Bootstrap already handles all dependency installation.**

## 🔴 Common Failure: Building Before Components Are Installed

Running `pnpm build` or `pnpm dev` before Buildpad components exist causes mass import errors.

### Correct Order

```
1. Create Next.js project
2. Install Buildpad (bootstrap)   ← Components + deps installed here
3. Create .env.local
4. Create app pages
5. pnpm dev                          ← Only NOW try to run
```

```

```
