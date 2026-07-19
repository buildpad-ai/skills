---
name: start-phase
description: Begin or continue a specific development phase (0-5) for a DaaS application. Defines deliverables, validates phase gates, and tracks progress in PHASES.md. Use when the user says start-phase, begin phase, or wants to work on a specific development phase.
argument-hint: "[phase number 0-5] [project path]"
---

# Start Development Phase

DaaS projects follow a mandatory phased approach. Never build entire applications at once.

## Phase Definitions

| Phase | Name            | Focus                                    | Exit Criteria              |
| ----- | --------------- | ---------------------------------------- | -------------------------- |
| **0** | Foundation      | Project setup, auth, test infrastructure | App runs, tests configured |
| **1** | Data Foundation | Schema, API routes, types                | All APIs tested            |
| **2** | Core UI         | List/detail pages, forms, navigation     | Pages render, tests pass   |
| **3** | Business Logic  | Validation, workflows, permissions       | Rules enforced             |
| **4** | Relations       | M2O, M2M, O2M, files, search             | Relations work             |
| **5** | Polish          | Errors, performance, a11y, docs, E2E     | Production ready           |

## Process

1. **Read current `PHASES.md`** (or create if missing) to check progress
2. **Verify previous phase gate** — all prior deliverables must be complete
3. **List phase deliverables** with checkboxes for the requested phase
4. **For role-gated features, run module-access preflight first**:
   - Register module keys
   - Grant keys on policies
   - Define UI/API check points
5. **Implement each deliverable** in sequence with tests
6. **Run phase gate checklist** before marking complete:
   - [ ] All deliverables complete
   - [ ] All tests passing
   - [ ] Documentation updated
   - [ ] Code reviewed (if applicable)
7. **Update `PHASES.md`** with completion status

## Phase 0 Details (Foundation)

- **Verify prerequisites** — `node --version && pnpm --version && git --version` (install if missing, see Rule 8 in copilot-instructions.md)
- Create project via `/create-project`
- Set up `.env.local` with Supabase + DaaS credentials
- Verify `pnpm dev` runs successfully
- Configure Playwright (`playwright.config.ts`)
- Write smoke test: home page loads
- Create `PHASES.md` tracking file

## Phase Rules

- **Complete each phase before the next** — no skipping
- **Tests are part of each phase** — not a separate activity
- **Document as you go** — not at the end
- **Track in PHASES.md** — single source of truth for progress

## Module Access Gate (Phase 3-5)

For Phase 3 (Business Logic), Phase 4 (Relations when gated), and Phase 5 (Polish):

- You MUST invoke `/grant-module-access` before implementing role-gated behavior
- You MUST avoid role-name checks (`role === 'admin'`, `isAdmin`, `roleName`)
- You MUST validate both UI and API enforcement paths
- You MUST run anti-pattern grep checks before phase completion

## References

- [Phased development methodology](references/phased-development.instructions.md)
- [Module access checklist](../../references/module-access-checklist.md)
