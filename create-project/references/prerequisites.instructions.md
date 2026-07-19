---
name: Prerequisites Check
description: Instructions for verifying and installing required development tools before project creation
applyTo: "**/*.{ts,tsx,md,json}"
---

# Prerequisites Check Instructions

## 🔴 CRITICAL: Always Check Before Project Work

Before running ANY project creation, bootstrap, component installation, or `pnpm`/`npx` command, **automatically verify** that all required development tools are installed.

**Do NOT ask the user** — run the checks silently and install missing tools automatically.

## Required Software

| Tool        | Minimum Version | Check Command    | Official Install Guide         |
| ----------- | --------------- | ---------------- | ------------------------------ |
| **Node.js** | v24 LTS         | `node --version` | https://nodejs.org/en/download |
| **pnpm**    | v10+            | `pnpm --version` | https://pnpm.io/installation   |
| **Git**     | v2.30+          | `git --version`  | https://git-scm.com/downloads  |
| **npx**     | (bundled)       | `npx --version`  | Comes with Node.js             |

## Verification Script

Run this single command to check all prerequisites at once:

```bash
echo "=== Prerequisites Check ===" && \
node --version 2>/dev/null && echo "✅ Node.js installed" || echo "❌ Node.js NOT found" && \
pnpm --version 2>/dev/null && echo "✅ pnpm installed" || echo "❌ pnpm NOT found" && \
git --version 2>/dev/null && echo "✅ Git installed" || echo "❌ Git NOT found" && \
npx --version 2>/dev/null && echo "✅ npx installed" || echo "❌ npx NOT found"
```

## OS Detection

The agent must detect the user's operating system before installing anything:

```bash
# Detect OS
OS="$(uname -s 2>/dev/null || echo "Windows")"
case "$OS" in
  Darwin)  echo "macOS detected" ;;
  Linux)   echo "Linux detected" ;;
  MINGW*|MSYS*|CYGWIN*) echo "Windows (Git Bash/MSYS) detected" ;;
  *)       echo "Unknown OS: $OS" ;;
esac
```

On Windows PowerShell, `uname` may not exist — check `$env:OS` or `systeminfo` instead.

---

## Installation by OS

### macOS

**Step 1: Install Homebrew (if not installed)**

```bash
which brew >/dev/null 2>&1 || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Step 2: Install Node.js (v24 LTS)**

```bash
# Option A: Via Homebrew (simplest)
brew install node@24

# Option B: Via fnm (recommended for multiple Node versions)
brew install fnm
eval "$(fnm env --use-on-cd --shell zsh)"
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
fnm install 24
fnm use 24

# Option C: Via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc
nvm install 24
nvm use 24

# Option D: Official installer — https://nodejs.org/en/download
```

**Step 3: Install pnpm (see https://pnpm.io/installation)**

```bash
# Option A: Via corepack (recommended — bundled with Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate

# Option B: Via npm
npm install -g pnpm

# Option C: Via Homebrew
brew install pnpm
```

**Step 4: Install Git (usually pre-installed on macOS)**

```bash
# Git comes with Xcode Command Line Tools
xcode-select --install
# Or via Homebrew
brew install git
```

---

### Linux (Ubuntu/Debian)

```bash
# Node.js v24 LTS via fnm (recommended)
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 24
fnm use 24

# Or download from https://nodejs.org/en/download (prebuilt binaries or package manager setup)

# pnpm (see https://pnpm.io/installation)
corepack enable
corepack prepare pnpm@latest --activate

# Git
sudo apt-get update && sudo apt-get install -y git
```

### Linux (Fedora/RHEL)

```bash
# Node.js v24 LTS via fnm
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 24

# pnpm (see https://pnpm.io/installation)
corepack enable
corepack prepare pnpm@latest --activate

# Git
sudo dnf install -y git
```

---

### Windows

**Recommended: Use WSL2 for the best DaaS development experience.**

```powershell
# Install WSL2 (from PowerShell as Admin):
wsl --install

# Then inside WSL2 Ubuntu, follow Linux (Ubuntu/Debian) instructions above
```

**Native Windows (without WSL2):**

```powershell
# Option A: Via winget (Windows Package Manager — built into Windows 11)
winget install OpenJS.NodeJS.LTS
winget install Git.Git

# Option B: Via official installers
# Node.js: Download from https://nodejs.org/en/download
# Git: Download from https://git-scm.com/downloads

# After Node.js is installed, open a NEW terminal and install pnpm:
corepack enable
corepack prepare pnpm@latest --activate

# Or install pnpm via npm:
npm install -g pnpm

# See https://pnpm.io/installation for Windows-specific options
```

**Important Windows notes:**

- Use PowerShell or Windows Terminal (not cmd.exe)
- After installing Node.js, **close and reopen the terminal** so `node`, `npm`, and `npx` are in PATH
- If `corepack` is not recognized, ensure Node.js v16.13+ is installed and try `npm install -g corepack` first
- WSL2 is strongly recommended — native Windows may have path and permission issues with some tools

---

## Agent Behavior: Automated Prerequisites Flow

When the agent is about to run a command that requires prerequisites (e.g., `npx`, `pnpm`, `create-next-app`, `bootstrap`), follow this exact flow:

```
┌─────────────────────────────────────────┐
│ 0. Detect OS: uname -s (or $env:OS)     │
├─────────────────────────────────────────┤
│ 1. Run: node --version                   │
│    ✅ Found v24+ → Continue              │
│    ❌ Not found or too old → Install     │
│       macOS:   brew install node@24      │
│       Linux:   fnm install 24            │
│       Windows: winget install            │
│                OpenJS.NodeJS.LTS         │
├─────────────────────────────────────────┤
│ 2. Run: pnpm --version                   │
│    ✅ Found v10+ → Continue              │
│    ❌ Not found → Install                │
│       All OS: corepack enable &&         │
│       corepack prepare pnpm@latest       │
│       --activate                         │
├─────────────────────────────────────────┤
│ 3. Run: git --version                    │
│    ✅ Found v2.30+ → Continue            │
│    ❌ Not found → Install                │
│       macOS:   xcode-select --install    │
│       Linux:   sudo apt-get install git  │
│       Windows: winget install Git.Git    │
├─────────────────────────────────────────┤
│ 4. Run: npx --version                    │
│    ✅ Found → Continue                   │
│    ❌ Not found → Comes with Node.js     │
│       (reinstall Node if missing)        │
├─────────────────────────────────────────┤
│ 5. All checks pass → Proceed with       │
│    project creation/bootstrap            │
└─────────────────────────────────────────┘
```

### Decision Logic for Installing Node.js

```
Detect OS:
├── macOS
│   ├── Is brew available?
│   │   └── Yes → brew install node@24
│   └── No → Install brew first, then node@24
│            (or use fnm/nvm, or download from nodejs.org/en/download)
├── Linux
│   └── Use fnm: curl -fsSL https://fnm.vercel.app/install | bash && fnm install 24
│       (or download from nodejs.org/en/download)
└── Windows
    ├── Is winget available?
    │   └── Yes → winget install OpenJS.NodeJS.LTS
    └── No → Download from https://nodejs.org/en/download
```

### Decision Logic for Installing pnpm

```
Is corepack available? (Node.js 16.13+)
├── Yes → corepack enable && corepack prepare pnpm@latest --activate
└── No
    ├── Is npm available?
    │   └── npm install -g pnpm
    └── See https://pnpm.io/installation for standalone install
```

---

## Version Validation

After installation, verify minimum versions:

```bash
# Check Node.js version (must be v24+)
node -e "const v = parseInt(process.versions.node.split('.')[0]); if (v < 24) { console.error('Node.js v24 LTS required, found ' + process.version); process.exit(1); } else { console.log('Node.js ' + process.version + ' ✅'); }"

# Check pnpm version (must be 10+)
pnpm -v | awk -F. '{if ($1 < 10) {print "pnpm 10+ required, found "$0; exit 1} else {print "pnpm "$0" ✅"}}'

# Check Git version (must be 2.30+)
git --version | awk '{split($3,a,"."); if (a[1] < 2 || (a[1] == 2 && a[2] < 30)) {print "Git 2.30+ required"; exit 1} else {print $0" ✅"}}'
```

---

## Common Issues

### `command not found: node`

Node.js is not installed or not in PATH.

- macOS: `brew install node@24`
- Linux: `fnm install 24`
- Windows: `winget install OpenJS.NodeJS.LTS` or download from https://nodejs.org/en/download

### `command not found: pnpm`

pnpm is not installed. See https://pnpm.io/installation or run:

```bash
corepack enable && corepack prepare pnpm@latest --activate
```

### `command not found: npx`

npx comes bundled with Node.js. If Node.js is installed but npx is missing, try reinstalling Node.js.

### `corepack: command not found`

Corepack requires Node.js 16.13+. Upgrade Node.js or install pnpm via `npm install -g pnpm` instead.

### `EACCES: permission denied` when installing globally

Use `sudo` for global installs (Linux/macOS), or better, use a version manager (fnm/nvm) that installs to user space. On Windows, run the terminal as Administrator.

### Node.js version too old

If `node --version` shows a version below v24, upgrade:

```bash
# Via fnm (macOS/Linux)
fnm install 24 && fnm use 24
# Via nvm (macOS/Linux)
nvm install 24 && nvm use 24
# Via brew (macOS)
brew upgrade node
# Via winget (Windows)
winget upgrade OpenJS.NodeJS.LTS
# Or download latest LTS from https://nodejs.org/en/download
```

### pnpm version too old

```bash
# Upgrade via corepack
corepack prepare pnpm@latest --activate
# Or via npm
npm install -g pnpm@latest
# See https://pnpm.io/installation
```

### Windows: `node` not recognized after install

Close and reopen the terminal. If still not working, add Node.js to PATH:

```powershell
# Check if Node.js is in Program Files
ls "C:\Program Files\nodejs\node.exe"
# Add to PATH for current session
$env:PATH += ";C:\Program Files\nodejs"
```

### Windows: permission errors with global installs

Run PowerShell or Windows Terminal as Administrator, or use a Node version manager like `fnm` or `nvm-windows` which installs to user space.
