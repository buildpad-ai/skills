# Phased Development Approach

This instruction file defines the **mandatory phased development methodology** for all DaaS RAD Platform projects. Every generated application MUST follow this structured approach to ensure quality, testability, and incremental delivery.

## 🔴 CRITICAL: All Development MUST Be Phased

**NEVER** attempt to build an entire application in one go. Always break work into phases with clear deliverables and validation checkpoints.

## Development Phases

### Phase 0: Foundation (Required First)

**Goal:** Establish project infrastructure before any feature work.

**Step 0: Verify Prerequisites (ALWAYS FIRST)**

Before anything else, check that all required development tools are installed:

```bash
node --version && pnpm --version && git --version && npx --version
```

| Tool    | Min Version | Install Guide                                                                                                                                     |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js | v24 LTS     | https://nodejs.org/en/download — macOS: `brew install node@24`; Linux: `fnm install 24`; Windows: installer or `winget install OpenJS.NodeJS.LTS` |
| pnpm    | v10+        | https://pnpm.io/installation — `corepack enable && corepack prepare pnpm@latest --activate`                                                       |
| Git     | v2.30+      | https://git-scm.com/downloads — macOS: `xcode-select --install`; Linux: `sudo apt-get install git`; Windows: `winget install Git.Git`             |
| npx     | (bundled)   | Comes with Node.js                                                                                                                                |

If any tool is missing, install it before proceeding. See `create-project/references/prerequisites.instructions.md` for detailed OS-specific instructions.

| Deliverable         | Description                          | Validation                     |
| ------------------- | ------------------------------------ | ------------------------------ |
| **Prerequisites**   | **Node.js, pnpm, Git installed**     | **All version checks pass**    |
| Project scaffolding | Next.js + TypeScript + Mantine setup | `pnpm dev` runs without errors |
| Environment config  | `.env.local` with DaaS connection    | API health check passes        |
| Auth integration    | Supabase Auth configured             | Login/logout flow works        |
| Base layout         | App shell, navigation, theme         | Visual inspection              |
| Test infrastructure | Playwright + Vitest configured       | `pnpm test` runs               |
| CI/CD pipeline      | GitHub Actions (optional)            | Pipeline executes              |
| Buildpad setup      | All UI components installed via CLI  | `pnpm cli status` shows all    |
| **API routes**      | **Proxy routes for DaaS backend**    | **`pnpm build` succeeds**      |

**Required API Routes (MUST CREATE):**

Create these proxy routes to connect to the DaaS backend:

```
app/api/
├── fields/[collection]/route.ts    # GET - fetch field schema
├── items/[collection]/route.ts     # GET/POST - list/create items
├── items/[collection]/[id]/route.ts # GET/PATCH/DELETE - single item
└── permissions/me/route.ts         # GET - current user permissions
```

Use templates from `.github/templates/api/` (or `.kiro/` equivalent) for these routes.

**Required Files Checklist:**

```
✅ app/layout.tsx                    # Root layout with MantineProvider
✅ app/page.tsx                      # Home page
✅ app/login/page.tsx                # Login page with Supabase Auth
✅ lib/supabase/server.ts            # Server-side Supabase client
✅ lib/supabase/client.ts            # Browser Supabase client
✅ lib/supabase/middleware.ts        # Session refresh utility
✅ middleware.ts                     # Route protection middleware
✅ package.json                      # WITH scripts section (dev, build, start)
✅ tsconfig.json                     # TypeScript config
✅ next.config.ts                    # Next.js config
✅ types/editorjs.d.ts               # Type declarations for EditorJS
```

**Exit Criteria:**

- App runs locally with authentication
- Test framework configured and sample test passes
- DaaS backend connection verified
- **All Buildpad components installed and validated (`pnpm build` succeeds)**

**Component Installation Validation:**

After installing Buildpad components in Phase 0, verify:

```bash
# Check installed components
cd /path/to/buildpad-ui
pnpm cli status --cwd /path/to/project

# Verify no module resolution errors
cd /path/to/project
pnpm build

# If errors like "Can't resolve '../upload'", add missing deps:
cd /path/to/buildpad-ui
pnpm cli add upload --cwd /path/to/project
```

---

### Phase 1: Data Foundation

**Goal:** Establish all data models and backend infrastructure.

| Deliverable         | Description                        | Validation               |
| ------------------- | ---------------------------------- | ------------------------ |
| Schema design       | Complete ERD with all entities     | Schema documented        |
| Database migrations | SQL migration files                | Migrations apply cleanly |
| API routes          | CRUD endpoints for all collections | API tests pass           |
| Type definitions    | TypeScript types for all entities  | No type errors           |
| Seed data           | Development/test data              | Data loads correctly     |

**Exit Criteria:**

- All API endpoints operational
- API tests covering CRUD for each collection
- Types exported and working

---

### Phase 2: Core UI

**Goal:** Build essential UI components and pages.

| Deliverable     | Description                           | Validation            |
| --------------- | ------------------------------------- | --------------------- |
| List pages      | Table/grid views for each collection  | Page tests pass       |
| Detail pages    | Read-only views for items             | Navigation works      |
| Form components | Create/edit forms for each collection | Form validation works |
| Navigation      | App routing and menus                 | All routes accessible |
| Loading states  | Skeletons, spinners, error states     | UX tested             |

**Exit Criteria:**

- All pages render correctly
- Navigation flows work
- Page tests passing

---

### Phase 3: Business Logic

**Goal:** Implement domain-specific features and workflows.

| Deliverable      | Description                    | Validation             |
| ---------------- | ------------------------------ | ---------------------- |
| Validation rules | Business validation logic      | Edge cases tested      |
| Computed fields  | Derived data, calculations     | Calculations verified  |
| Workflows        | State machines (if applicable) | Transitions work       |
| Permissions      | Role-based access control      | RBAC tests pass        |
| Integrations     | External APIs, webhooks        | Integration tests pass |

**Exit Criteria:**

- All business rules enforced
- Workflow transitions validated
- Permission checks working

---

### Phase 4: Relations & Advanced

**Goal:** Implement relationships and advanced features.

| Deliverable     | Description                       | Validation               |
| --------------- | --------------------------------- | ------------------------ |
| M2O relations   | Many-to-one dropdowns/links       | Relations save correctly |
| M2M relations   | Many-to-many management           | Junction records work    |
| O2M relations   | One-to-many lists                 | Nested items work        |
| File management | Upload, display, manage files     | Files upload/display     |
| Search & filter | Full-text search, faceted filters | Search returns results   |

**Exit Criteria:**

- All relations functional
- Files upload and display
- Search working

---

### Phase 5: Polish & Production

**Goal:** Production readiness.

| Deliverable     | Description                         | Validation                |
| --------------- | ----------------------------------- | ------------------------- |
| Error handling  | Comprehensive error boundaries      | Errors handled gracefully |
| Performance     | Lazy loading, caching, optimization | Core Web Vitals pass      |
| Accessibility   | WCAG 2.1 AA compliance              | Accessibility audit       |
| Documentation   | README, API docs, user guides       | Docs complete             |
| E2E tests       | Complete user journey tests         | All E2E tests pass        |
| Security review | OWASP checklist                     | Security audit            |

**Exit Criteria:**

- All tests passing (>80% coverage)
- Documentation complete
- Production deployment successful

---

## Phase Tracking

### Using Phase Gates

Each phase has a **gate** that must be passed before proceeding:

```markdown
## Phase Gate: [Phase Name]

### Checklist

- [ ] All deliverables complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Code reviewed

### Sign-off

- Date: \***\*\_\_\_\*\***
- Status: PASS / FAIL
- Notes: \***\*\_\_\_\*\***
```

### Phase Status File

Maintain a `PHASES.md` file in the project root:

```markdown
# Project Phases

## Current Phase: 2 - Core UI

| Phase              | Status         | Started    | Completed  |
| ------------------ | -------------- | ---------- | ---------- |
| 0. Foundation      | ✅ Complete    | 2025-01-20 | 2025-01-20 |
| 1. Data Foundation | ✅ Complete    | 2025-01-20 | 2025-01-21 |
| 2. Core UI         | 🔄 In Progress | 2025-01-21 | -          |
| 3. Business Logic  | ⏳ Pending     | -          | -          |
| 4. Relations       | ⏳ Pending     | -          | -          |
| 5. Polish          | ⏳ Pending     | -          | -          |

## Phase 2 Tasks

- [x] List pages for products
- [ ] Detail pages for products
- [ ] Create/edit forms
- [ ] Navigation menu
```

---

## Agent Responsibilities by Phase

| Phase              | Primary Agent             | Supporting Agents      |
| ------------------ | ------------------------- | ---------------------- |
| 0. Foundation      | `@scaffold`               | `@architect`           |
| 1. Data Foundation | `@database`, `@scaffold`  | `@tester`              |
| 2. Core UI         | `@scaffold`, `@implement` | `@tester`              |
| 3. Business Logic  | `@implement`              | `@tester`, `@reviewer` |
| 4. Relations       | `@implement`              | `@tester`              |
| 5. Polish          | `@implement`, `@tester`   | `@reviewer`            |

---

## Sprint/Iteration Mapping

For Agile teams, map phases to sprints:

| Sprint     | Phase(s) | Focus          |
| ---------- | -------- | -------------- |
| Sprint 0   | Phase 0  | Foundation     |
| Sprint 1   | Phase 1  | Data Model     |
| Sprint 2-3 | Phase 2  | Core UI        |
| Sprint 4-5 | Phase 3  | Business Logic |
| Sprint 6   | Phase 4  | Relations      |
| Sprint 7   | Phase 5  | Polish         |

---

## Phased Feature Development

When adding a new feature to an existing app, apply a mini-phase approach:

### Feature Phases

1. **Design** (30 min - 2 hrs)
   - Requirements gathering
   - Data model design
   - UI wireframes

2. **Schema** (1-2 hrs)
   - Database migration
   - API endpoint
   - Type definitions
   - API tests

3. **UI** (2-4 hrs)
   - List/detail pages
   - Form components
   - Page tests

4. **Logic** (1-3 hrs)
   - Validation rules
   - Business logic
   - Integration tests

5. **Polish** (1-2 hrs)
   - Error handling
   - Loading states
   - Documentation

### Feature Checklist Template

```markdown
## Feature: [Name]

### Phase 1: Design ⏳

- [ ] Requirements documented
- [ ] Data model designed
- [ ] API contract defined
- [ ] UI wireframe sketched

### Phase 2: Schema ⏳

- [ ] Migration created
- [ ] API route implemented
- [ ] Types defined
- [ ] API tests written and passing

### Phase 3: UI ⏳

- [ ] List page created
- [ ] Detail page created
- [ ] Form created
- [ ] Page tests passing

### Phase 4: Logic ⏳

- [ ] Validation implemented
- [ ] Business rules enforced
- [ ] Integration tested

### Phase 5: Polish ⏳

- [ ] Error handling complete
- [ ] Loading states added
- [ ] Documentation updated
```

---

## Anti-Patterns to Avoid

### ❌ Big Bang Development

**Problem:** Building entire app before testing
**Solution:** Deliver working increments each phase

### ❌ UI Before Data

**Problem:** Building UI without stable API
**Solution:** Phase 1 (Data) before Phase 2 (UI)

### ❌ Skipping Tests

**Problem:** No tests until the end
**Solution:** Tests are part of each phase, not separate

### ❌ Premature Optimization

**Problem:** Performance tuning before features work
**Solution:** Optimization in Phase 5, not earlier

### ❌ Scope Creep

**Problem:** Adding features mid-phase
**Solution:** New features go to backlog for future phases

---

## Validation Commands

Run these at each phase gate:

```bash
# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint

# Unit tests
pnpm test:unit

# API tests (Phase 1+)
pnpm test tests/api/

# Page tests (Phase 2+)
pnpm test tests/pages/

# E2E tests (Phase 5)
pnpm test tests/e2e/

# All tests
pnpm test
```

---

## Phase Estimation Guidelines

| Phase             | Small Project | Medium Project | Large Project |
| ----------------- | ------------- | -------------- | ------------- |
| 0. Foundation     | 2-4 hrs       | 4-8 hrs        | 1-2 days      |
| 1. Data           | 2-4 hrs       | 1-2 days       | 3-5 days      |
| 2. Core UI        | 4-8 hrs       | 2-4 days       | 1-2 weeks     |
| 3. Business Logic | 2-4 hrs       | 2-4 days       | 1-2 weeks     |
| 4. Relations      | 2-4 hrs       | 1-2 days       | 3-5 days      |
| 5. Polish         | 2-4 hrs       | 1-2 days       | 3-5 days      |

**Total Estimates:**

- Small: 1-2 days
- Medium: 1-2 weeks
- Large: 4-6 weeks
