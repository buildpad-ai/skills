# Requirements Document

> **This is the skills repository's part of a change that spans three repositories.** The other
> two parts are drafts written on 26 October 2026, requirements only, neither approved:
>
> - the Platform's `buildpad-platform` `.kiro/specs/project-tenants` (branch `spec/project-tenants`,
>   `009ca176`), which adds a premium **Customer_Tenants** feature to an Engine_Project: a Customers
>   page that creates, suspends, resumes and deletes one Engine tenant per customer of the
>   project's app, copied from the project's tenant (the Blueprint). Its Requirement 11 asks for
>   the kit's guidance and its Requirement 12 for documents; this document is what those are in this
>   repository, because this repository owns the references a kit carries (the Platform's
>   `engine-backed-project-provisioning` Decision AB, settled 15 October 2026, option (b));
> - the Engine's `buildpad-daas-go` ledger entry 192 `tenant-schema-fan-out` (branch
>   `spec/tenant-schema-fan-out`, `e88512d3`), which publishes the Blueprint's configuration as a
>   numbered Release and rolls it out to every Customer_Tenant.
>
> Decisions of this document are written `TS-n`. Rows it needs from elsewhere are `TD-n`, in
> [Dependencies](#dependencies). [What the companion drafts must take in](#what-the-companion-drafts-must-take-in)
> lists what has changed in the other two repositories since they were written.
>
> Status: **requirements approved** 2026-11-07 by the maintainer ("Approve and design"). Written
> 2026-11-07 at the maintainer's request ("Draft cross-repo spec"), before any change to a skill.
> design.md was generated the same day and is not yet approved; tasks.md follows its approval.
>
> Read, not observed:
> - this repository at `docs/xcrm-engine-mcp-lessons` `fbcde74` (`origin/main` `3cb4a00`, the
>   v9.0.0 release merge);
> - the Engine at `origin/main` `cf2da226` (ledger entries 129, 135, 154, 191, 199 and 200 applied);
> - the Platform at `origin/main` `423f7d3d`, and `docs/project-roles-live` for `data-service-roles`;
> - the two companion drafts at the commits named above.
>
> No request was sent to any Engine, no database was read, and no agent was run against a skill.
>
> **Approval-gated:** Decisions TS-1 to TS-7 were settled by the maintainer on 7 November 2026,
> each as recommended, together with the companions' Decisions (Platform 1–21, its 18 matched to Engine 192's 15 (c);
> Engine 192 1–16). The companions took in rows TD-2, TD-4, TD-5, TD-7 and TD-9 as Decisions of their own, now
> settled. The requirements themselves were approved on 7 November 2026.

## Introduction

**Who has the problem.** An agent that builds or changes an app on an Engine_Project whose owner
has turned on Customer_Tenants, and the developer who directs it. Each customer of that app is an
Engine tenant of its own: its own PostgreSQL schema, people, roles and administrators (ADR-008).
Every skill in this repository teaches the opposite.

**What the skills say today** (at `fbcde74`).

- **ES-9:** "On an Engine project the project is one tenant." Every scope hierarchy is to begin
  below the project's tenant node. The sentence is copied into 9 folders, and "the project's
  tenant" appears in 20.
- **ES-3** gives the app `NEXT_PUBLIC_BUILDPAD_TENANT_ID`, the project's tenant.
- **ES-4 and ES-5** have the password sign-in send that id as `X-Tenant-Id`, and refuse an account
  with no role there. 11 folders carry the variable, and 14 the header.
- **ES-7:** an administrator gives each user "a role in the project's tenant".
- **ES-14n:** a worker presents the project's one Worker_Token.
- `add-multitenancy` delegates to `manage-scope`, which offers only scope nodes inside that one
  tenant.

**What following them would do in a Customer_Tenants project.**

- Every sign-in would name the Blueprint. Each customer's people hold no role there, so every one
  of them would be refused (ES-5; the Platform's criterion 7.24).
- Scope URIs would be composed from the environment's tenant, not the signed-in customer's, so
  every scoped write would be refused.
- The agent, whose MCP token is bound to the Blueprint, would look for a customer's data or
  structure where it cannot reach.
- Nothing would tell anyone that a structure change reaches customers only through a Release.

**What the Engine already does** (at `cf2da226`; citations are to that tree).

- **Credentials are global, profiles are per tenant.** Email, password and status live in
  `daas_platform.daas_identities`. A tenant's administrator adds an existing person with
  `POST /api/users`, which attaches the identity (`identity_credentials.go:188-277`). The new
  profile is not yet entered (`accepted: false`). The person enters it by signing in naming that
  tenant, or by switching to it (entry 129).
- **Sign-in when no tenant is named** (`tenant_binding.go:30-133`):
  - the host, if the person has an entered role there;
  - otherwise their one entered tenant;
  - with two or more entered tenants, an **unbound** pair;
  - otherwise an entered host profile.
  - Only entered memberships count, and suspended tenants are skipped.
  - So a person whose only membership is not yet entered gets an unbound pair on their first
    sign-in.
  - An unbound token is answered 403 everywhere except the identity routes: "This token is not
    bound to a tenant. Switch to a tenant first."
- **Identity routes:**
  - `GET /api/auth/tenants` lists `{id, name, uri_path, current, kind, accepted, state}`.
  - `POST /api/auth/tenant` with `{"tenant": "<id>"}` answers a new
    `{access_token, refresh_token, expires}`, or 403 `FORBIDDEN`, 403 `TENANT_SUSPENDED` or 503.
  - `DELETE /api/auth/tenants/:id` declines a profile not yet entered (`tenant_switch.go`,
    `tenant_handler.go:37-132`).
- **Each token is bound to one tenant.** That includes every static token, so the MCP token and a
  worker's `data` token too (`static_token_resolver.go:65-70`).
- **Tenant states the app can meet** (`tenant_binder.go:207-270`):
  - suspended: 401 `TENANT_SUSPENDED`;
  - deleting or deleted: 401 `TOKEN_INVALID`;
  - not serving (migrating, or behind the Engine's version): 503 `SERVICE_UNAVAILABLE`;
  - an anonymous `X-Tenant-Id` naming a tenant that is not served: 403.
- **Only a host administrator creates a tenant.** No narrower permission exists: the only module
  keys are `system:logs`, `workflow:approve` and `workflow:reject`. A template is copied once, at
  creation. Its cron jobs arrive **inactive** (entry 135). The schema diff and apply routes act on
  the caller's tenant alone, and cover collections, fields and relations only.
- **A tenant's administrator manages its own scope types and nodes** beneath its first-level node
  (entry 115). CORS is host-only. SMTP and the other settings are per tenant.

**What changes.**

- The skills learn a second **Tenancy_Mode**. The skills find it before directing anything that
  differs, as they find the backend.
- `add-multitenancy` becomes the place where the developer chooses between three things: scopes
  inside one tenant, Customer_Tenants, or one project per customer.
- In Customer_Tenants mode, the skills that would otherwise direct one-tenant code say what to do
  instead, in a few statements worded once, and point to one guide for the whole mode.
- What the feature does not yet offer is said, and not built.

## Glossary

- **Engine_Project**, **Project_Tenant**, **Host_Administrator**, **Handoff**, **Starter_Kit**,
  **Raw_Install**: as `engine-backed-project-provisioning` and `backend-aware-skills` define them.
- **Customer_Tenant**, **Customer_Administrator**, **Blueprint**, **Release**, **Rollout**,
  **Customer_Slug**: as the Platform's `project-tenants` defines them. The Blueprint is the
  Project_Tenant unless that document's Decision 4 says otherwise.
- **Tenancy_Mode**: how an Engine_Project's app separates its customers. `scope` means scope nodes
  inside the Project_Tenant, and is the default and today's only mode. `customer-tenants` means one
  Customer_Tenant per customer. A Supabase project has `scope` only.
- **Tenancy_Signal**: what tells a Skill the Tenancy_Mode (Decision TS-1).
- **Current_Tenant**: the tenant the app's current access token is bound to.
- **Unbound_Session**: a session whose access token is bound to no tenant.
- **Mode_Guide**: one reference file holding everything the `customer-tenants` mode directs
  (Decision TS-2).
- **Tenancy_Statements**: the Engine statements this document adds, worded once in `CONTRIBUTING.md`
  and copied verbatim, as ES-1 to ES-16 are.

## Decisions

All are **SETTLED**: chosen by the maintainer on 7 November 2026 from the cross-spec decision
sheet, each as recommended.

**TS-1: the Tenancy_Signal.**
- (a) A member `tenancy` in `.buildpad/project.json` (`"scope"` or `"customer-tenants"`). The
  Platform writes it when it assembles a Kit. It cannot rewrite it when the project's
  `customer_tenants` flag changes, because a Kit is a zip the member has already downloaded
  (`buildpad-platform` `src/lib/starter-pack/kit-assembler.ts:14-17`). The Platform's draft
  Decision 19 also reports the value in `get_project_detail`.
- (b) The environment variable `BUILDPAD_TENANCY`, which the Platform's draft criterion 11.1 names.
- (c) (a), and where it is absent, ask the developer once and record the answer in
  `.buildpad/tenancy-answer.json`, as SD-1 does for the backend.

**Settled: (c)**, as recommended. (b) cannot be the signal for an agent: the backend gate already forbids a
Skill to open an environment file, and a Kit written before the flag was turned on holds neither.
(b) may still exist for the app's runtime code. Needs TD-2.

**TS-2: how the mode reaches the Skills.**
- (a) Tenancy passages marked in place in every affected folder, like the backend passages, with
  their own markers.
- (b) One Mode_Guide (`add-multitenancy/references/engine-customer-tenants.instructions.md`), plus
  a few Tenancy_Statements copied into the Engine passages that would otherwise direct one-tenant
  code. Each statement points to the guide.

**Settled: (b)**, as recommended. About 25 folders mention the one tenant. Most need one sentence that
redirects, not a second body of text. (a) would double the marking work of `backend-aware-skills`,
and the Platform would have nothing to strip.

**TS-3: when the change lands.**
- (a) All of it once the Platform's Wave 1 and Engine entry 192 have shipped.
- (b) Now, the chooser and the "not available" text only (Requirements 1, 2 and 7). The rest lands
  when TD-1 and TD-3 are met, each passage behind its dependency.

**Settled: (b)**, as recommended. Today an agent asked for "one schema per customer" has nothing to stop it
building a substitute, such as a host credential in the app, a project per customer by hand, or a
fake tenant column.

**TS-4: what the app does with an Unbound_Session.**
- (a) It lists `GET /api/auth/tenants`, then acts on what it finds:
  - one tenant: it switches to it without asking;
  - several: it asks the person to choose;
  - none: it signs the person out and says they belong to no customer.
- (b) It always shows the chooser.

**Settled: (a)**, as recommended. A newly invited person has exactly one tenant, not yet entered. Asking them
to choose from a list of one is friction, and the switch is what enters the profile.

**TS-5: where the app keeps the Current_Tenant.**
- (a) It reads it from the session (`current` in `GET /api/auth/tenants`, or the token's tenant
  claim). The app keeps the last choice only as a preference for the chooser.
- (b) It stores the chosen id in its own cookie or storage and sends it on requests.

**Settled: (a)**, as recommended. The Engine takes the tenant from the token alone. A second copy can only
disagree with it.

**TS-6: an app that wants customers to sign themselves up ("create your company").**
- (a) Not available. The Skills say so and stop. A Platform member creates each customer on the
  Customers page.
- (b) A Skill directs a call to a Platform API that the app's server may call with a project-scoped
  credential.

**Settled: (a) now, and raise TD-7**, as recommended. Neither companion draft offers (b). The only Engine door
is the host credential, which the Platform's draft criterion 6.3 keeps from every app.

**TS-7: role identifiers across customers.**
- (a) The Skills may name a role by the identifier it has in the Blueprint.
- (b) The Skills look a role up by name in the Current_Tenant.

**Settled: (a)**, as recommended. The two seeded roles and the two project roles have fixed identifiers in
every tenant (entries 72 and 199). A template copy keeps the identifier of every role, policy,
permission rule and grant (Engine `src/domain/governance/feature/tenant/template/document.go:235-245`,
`rows.go:262-283`), and entry 192's draft Decision 9 has a Release match them by identifier. A
name is weaker: a Customer_Administrator may rename a role in their own customer.

## Boundary Context

- **In scope:**
  - the Tenancy_Signal and how a Skill establishes the mode;
  - `add-multitenancy` as the chooser;
  - the Mode_Guide;
  - the Tenancy_Statements and their copies in Engine passages;
  - what each affected Skill directs in `customer-tenants` mode, and what it says is not available;
  - the Repository_Check rules for the new statements;
  - a release.
- **Out of scope:**
  - every Engine and Platform change, which the companion drafts carry;
  - the SDK and command-line templates (`buildpad-ui`, TD-6);
  - moving an existing `scope`-mode app's customers into Customer_Tenants;
  - a Supabase project.
- **Adjacent expectations:**
  - `backend-aware-skills` owns the backend gate and ES-1 to ES-16, and stays true: every
    Tenancy_Statement lives inside an Engine passage;
  - the Platform owns the Customers page, Releases and Rollouts;
  - the Engine owns every tenant rule.

## Requirements

### Requirement 1: A Skill establishes the Tenancy_Mode before it directs anything that differs

**Objective:** As a developer on an Engine_Project with Customer_Tenants, I want every Skill to know
that each customer is a tenant, so that no Skill writes one-tenant code into my app.

#### Acceptance Criteria

1. Before a Skill directs anything that differs between the two modes, it shall establish the
   Tenancy_Mode by the Tenancy_Signal (TS-1). It shall do so only after the backend gate has found
   an Engine_Project.
2. Where the Tenancy_Signal is absent, the Skill shall act as `scope` mode unless the developer's
   request names separate customers with their own data, people or administrators. In that case it
   shall ask once, as TS-1 (c) says.
3. A Skill shall not open an environment file, call a tool that returns credentials, or call
   `GET /api/tenants` to establish the mode.
4. In `scope` mode every Skill shall direct exactly what it directs today.

### Requirement 2: `add-multitenancy` is where the developer chooses

**Objective:** As a developer whose app serves many customers, I want to be told plainly which of
the three separations fits, so that I do not discover the limits of one after building on it.

#### Acceptance Criteria

1. `add-multitenancy` shall describe three separations, and when each fits:
   - **scope nodes inside one tenant**: shared structure, reporting across customers, no
     per-customer administrators of the data service;
   - **Customer_Tenants on one project**: isolation enforced by the database, per-customer people,
     roles and administrators, every customer on the same structure through Releases;
   - **one project per customer**: the cases the Platform's Decision 15 (b) lists, namely its own
     region, Engine version, backups, SSO issuer or capacity, or more customers than the quota.
2. It shall state the limits of Customer_Tenants:
   - about 1,000 to 2,000 tenants per database (ADR-008);
   - one Engine, connection pool and upgrade window for all of them;
   - project backups that restore every customer at once;
   - Engine-only.
3. When the developer chooses Customer_Tenants and the project is not in that mode, the Skill shall
   tell the developer that a Platform member turns the feature on for the project, and shall stop.
4. A Skill shall never direct the Host_Administrator credential, a host session or
   `/api/tenants` into an app, a worker, a test or an agent's tool call. It shall never direct
   creating a Customer_Tenant from code (TS-6).
5. In `scope` mode `add-multitenancy` shall keep delegating to `manage-scope` as it does today.

### Requirement 3: Sign-in and the Current_Tenant in app code

**Objective:** As a person who belongs to one or more customers, I want to sign in once and land in
my customer, so that I never see another customer's data or a blank screen.

#### Acceptance Criteria

1. In `customer-tenants` mode the password sign-in shall send no `X-Tenant-Id`. The Mode_Guide
   shall say this replaces ES-4's and ES-5's sign-in for that mode.
2. When a sign-in or a refresh answers an Unbound_Session, the app shall read
   `GET /api/auth/tenants` and act as TS-4 says.
3. To switch, the app shall send `POST /api/auth/tenant` from its server route with the current
   session. It shall replace both tokens of the client's session with the answer, and shall send
   no request with the old access token after that.
4. The app shall take the Current_Tenant from the session (TS-5). It shall send no tenant id on a
   request that carries a session.
5. The app shall show the Current_Tenant's name, and shall offer a switch when the person holds
   more than one tenant.
6. When a request answers 401 `TENANT_SUSPENDED`, 401 `TOKEN_INVALID` or 503
   `SERVICE_UNAVAILABLE`, the app shall show the cause the Mode_Guide gives for each, in words the
   person can act on. It shall retry only the 503.
7. `NEXT_PUBLIC_BUILDPAD_TENANT_ID` shall stay the Blueprint's id, for the developer's own sign-in
   and anonymous reads. The Mode_Guide shall say that a public page of one customer is not
   available until TD-8 is met.
8. XAppHub sign-in in `customer-tenants` mode shall be stated as not available until TD-9 is met.

### Requirement 4: Scopes inside a Customer_Tenant

**Objective:** As a developer, I want scopes to keep working inside each customer, so that a
customer can still have departments or regions.

#### Acceptance Criteria

1. In `customer-tenants` mode every scope URI shall begin with the Current_Tenant's node, read as
   `uri_path` from `GET /api/auth/tenants`, and never with the Blueprint's.
2. Scope types the app needs in every customer shall be created in the Blueprint, and shall reach
   customers as entry 192 decides for the tenant's own scope types (its Decision 2). Until that is
   settled, the Mode_Guide shall say a scope type made in the Blueprint after a customer's creation
   does not reach it.
3. A customer's administrator may create scope types and nodes beneath their own tenant. A Skill
   shall direct no root type and no first-level node.

### Requirement 5: Structure is built in the Blueprint and released

**Objective:** As a developer, I want my agent to know where it builds and how customers receive
it, so that customers do not drift from the app or lose data.

#### Acceptance Criteria

1. In `customer-tenants` mode the Skills that create or change structure shall build it in the
   Blueprint only, through the MCP token or an administrator session bound there. This covers
   collections, fields, relations, roles, policies, permissions, workflows, cron jobs, hooks and
   custom services: `create-collection`, `create-rbac`, `create-workflow`, `add-cron`,
   `hooks-extensions`, `add-i18n`, `add-comments`, `add-files`, `create-form-builder`,
   `grant-module-access` and `daas-platform`.
2. Those Skills shall state that a change reaches customers only when a Platform member publishes
   a Release and rolls it out. An agent shall never call a Customer_Tenant's schema routes to
   change its structure.
3. The Mode_Guide shall direct expand–release–contract for removing or renaming a field: add, roll
   out, migrate, roll out, then remove. It shall also say that a Rollout refuses or skips a
   customer with Drift unless the member overrides it (entry 192 Decisions 4 and 6, as settled).
4. `add-cron` shall say that a customer created from the Blueprint receives its cron jobs inactive
   (entry 135). It shall also say a Release leaves them inactive unless the member rolls it out with
   `cron_status: "as_template"`, which gives every managed job the Blueprint's status (entry 192
   Decision 14 (d)), so a job meant to run in every customer is started that way after the canaries
   pass.
5. `create-rbac` shall name a role made in the Blueprint by its identifier, which every customer
   created from the Blueprint shares (TS-7 (a)), never by its name, which a customer may change.
6. `spec-driven-development`, `create-feature` and `idea-refine` shall say, where they plan
   tenancy, that in this mode a plan names what is per customer (rows, people, settings) and what
   is shared through the Blueprint (structure, access model, automation).

### Requirement 6: People belong to customers

**Objective:** As a customer's administrator, I want to add my people to my customer, so that
nobody outside the customer is involved.

#### Acceptance Criteria

1. In `customer-tenants` mode, ES-7's role "in the project's tenant" shall read "in the customer's
   tenant". The Mode_Guide shall say the Customer_Administrator adds people there with
   `POST /api/users`, signed in to that tenant.
2. The Mode_Guide shall say that a person who already has an account elsewhere on the Engine is
   attached, not duplicated. Their password is unchanged. The profile is not entered until they
   switch to the customer, which the app's chooser does (TS-4).
3. The Mode_Guide shall say each customer's user list holds the Platform's own accounts, which a
   member's Handoff or a server call uses (the Platform's draft criterion 3.8, and
   `data-service-roles`). It shall also say how an app tells them apart, as TD-5 answers.
4. `add-users` and `create-rbac` shall direct an app's people screens to act in the Current_Tenant
   only.

### Requirement 7: What the mode does not offer is said, not built

**Objective:** As a developer, I want to hear what is not available, so that my agent does not
build a substitute that breaks isolation.

#### Acceptance Criteria

1. In `customer-tenants` mode the Skills shall state as not available, and stop, each of the
   following while its dependency is unmet:
   - customers that sign themselves up (TS-6, TD-7);
   - a public page per customer (TD-8);
   - XAppHub sign-in (TD-9);
   - a worker that acts in a customer (the Platform's draft Decision 13; TD-10);
   - a backup or restore of one customer;
   - Open Studio into a customer (the Platform's Wave 2);
   - moving an existing `scope`-mode app into Customer_Tenants.
2. `worker-messaging` shall say that a worker acts in the Blueprint only, and that per-customer
   work runs as stored code (cron jobs, hooks) released to every customer.
3. `create-tests` shall say that tests sign in to the Blueprint (ES-12), and that a test of a
   customer's path needs a Customer_Tenant made on the Customers page, whose credentials the
   pipeline holds as secrets.

### Requirement 8: Debugging and review know the mode

#### Acceptance Criteria

1. `debugging-and-error-recovery` shall add the symptoms of this mode, each with its cause:
   - 403 "not bound to a tenant": an Unbound_Session that was never switched;
   - a sign-in that works but shows nothing: a profile not yet entered;
   - 401 `TENANT_SUSPENDED`;
   - 503 during a Rollout or an upgrade;
   - a field present in the Blueprint and absent in a customer: not yet released.
2. `security-and-hardening`, `references/security-checklist.md` and the `security-auditor` and
   `test-engineer` agents shall add these checks:
   - no tenant id is taken from user input outside the switch;
   - no host credential is present;
   - no request crosses customers with one token;
   - no cache in the app is keyed without the Current_Tenant.

### Requirement 9: The statements are worded once and checked

#### Acceptance Criteria

1. `CONTRIBUTING.md` shall add the Tenancy_Statements next to ES-1 to ES-16, each opening "On an
   Engine project with Customer_Tenants". Each shall say when it applies, as ES-14n and ES-14m do,
   so a statement held back by a dependency is named.
2. The Repository_Check shall check that each copied statement matches its register text
   verbatim, as it does for ES-1 to ES-16. It shall also refuse a Tenancy_Statement outside an
   Engine passage.
3. ES-3, ES-4, ES-5, ES-7 and ES-9 shall stay verbatim. Each folder that copies one of them shall
   also copy the statement that names the Mode_Guide (draft text TS-A below), so that an agent
   reading ES-9 reads next to it that the mode replaces it.
4. The change shall be released under a new minor version with a CHANGELOG entry per folder, and
   the Platform's sync shall vendor it as `backend-aware-skills` Requirement 6 says.

Draft texts, to be fixed in design:

- **TS-A:** On an Engine project with Customer_Tenants each customer of the application is a tenant
  of its own, and the project's tenant is the Blueprint every customer is copied from. Establish the
  tenancy mode as the `add-multitenancy` skill says. In that mode its guide
  `engine-customer-tenants` replaces what ES-3, ES-4, ES-5, ES-7 and ES-9 say about the project's
  tenant.
- **TS-B:** On an Engine project with Customer_Tenants the password sign-in names no tenant. An
  unbound session is switched with `POST /api/auth/tenant`, and the application takes its current
  tenant from the session, never from the environment or the request.
- **TS-C:** On an Engine project with Customer_Tenants collections, fields, relations, roles,
  policies, permissions, workflows, cron jobs, hooks and custom services are built in the Blueprint.
  A customer receives them only when a Release is rolled out from the Platform's Customers page.

## Dependencies

What this repository needs from elsewhere before a criterion can hold. Statuses as read on
7 November 2026.

| ID | Owner | What it is | Needed by | Status when read |
|---|---|---|---|---|
| TD-1 | Platform | `project-tenants` approved, and its Wave 1 shipped: the flag, the Customers page and the creation of Customer_Tenants | 2.3, 3, 4, 5, 6 | Unmet. Requirements only, Decisions 1–21 settled 7 November; requirements not approved |
| TD-2 | Platform | The Tenancy_Signal written into every Kit (`.buildpad/project.json` `tenancy`) and reported by `get_project_detail` (TS-1) | 1.1 | Unmet. Taken into the draft on 7 November as its Decision 19, settled (b), and its criterion 11.1 no longer names `BUILDPAD_TENANCY=schema`. A Kit already downloaded keeps the value it was written with |
| TD-3 | Engine | Entry 192 applied: Releases, Rollouts, Drift, and destructive changes behind `allow_destructive` | 4.2, 5.2, 5.3 | Unmet. Requirements only, Decisions 1–16 settled 7 November; requirements not approved |
| TD-4 | Engine | Whether a Release activates cron jobs that a creation from the template copied inactive | 5.4 | Settled as entry 192's Decision 14 (d). Entry 135 copies cron jobs inactive (`template/document.go:169-172`). New jobs stay inactive unless a Rollout asks for `cron_status: "as_template"` |
| TD-5 | Engine, Platform | Whether a template copy keeps a custom role's identifier (TS-7), and a mark by which an app can tell the Platform's own accounts in a customer from the customer's people | 5.5, 6.3 | Half met. A copy keeps role identifiers (see TS-7). The mark is settled as the Platform draft's Decision 17 (a): `provider = 'platform'` plus the fixed `admin@example.com`; `data-service-roles`, whose Platform slice has not shipped, is what would write that provider |
| TD-6 | `buildpad-ui` | SDK and templates that, in `customer-tenants` mode, send no `X-Tenant-Id` at sign-in, switch an Unbound_Session and replace the client's session with the switched pair | 3.1–3.4 | Unmet. No issue or spec found. `backend-aware-skills` PP-34 is the one-tenant counterpart, also unmet |
| TD-7 | Platform | A way for an app's server to create a customer with a project-scoped credential, if wanted (TS-6) | 7.1 | Settled as the Platform draft's Decision 20 (a): not offered now. Its criterion 6.3 keeps every host credential from apps |
| TD-8 | Platform, Engine | Mapping a host name to a Customer_Tenant, so anonymous reads name the right tenant | 3.7, 7.1 | Planned as the Platform draft's Wave 2 (Decision 11 (b)) |
| TD-9 | Platform, Engine | Which tenant an XAppHub first sign-in creates its account in, when a project has Customer_Tenants | 3.8, 7.1 | Settled as the Platform draft's Decision 21 (a): not available while a project has customers. The Engine's `id_token` grant creates the first profile in the tenant `X-Tenant-Id` names (`external_sign_in.go:66-67`, `:98-100`), and only the Project_Tenant trusts the client id |
| TD-10 | Platform | Per-customer workers | 7.1, 7.2 | Out of scope of the draft (Decision 13 (a), Wave 3). The Engine already allows a `data` token per tenant (`docs/OPERATOR_UNATTENDED_SETUP.md:92-123`) |
| TD-11 | Engine | That a refresh of a switched session stays bound to the tenant it was switched to | 3.3 | Met in code, untested: the switch issues a session in the named tenant and its refresh record keeps it through rotation (`tenant_switch.go:223`, `auth_service.go:383-387`, `refresh_rotation.go:183-193`). No route test switches and then refreshes |

## What the companion drafts must take in

Both drafts were read on 26 October 2026. The items below were taken into both on 7 November 2026,
uncommitted on their branches: the Platform draft's Decisions 16 to 21 and criteria 3.9, 10.2,
10.3, 11.1 and 11.4; and entry 192's Decisions 14 to 16 and criteria 1.9, 3.13, 3.14 and 7.4. The list
is kept as the record of why. Since 26 October:

**Platform `project-tenants`** (read at `release/dev` `9bc9c13c`):

1. **The host password no longer reaches the detail response.** Criteria 4.7 and 4.9 were amended
   on 26 October:
   - no response carries the host password;
   - an Owner, an Admin or the creator reveals it through
     `POST …/host-admin-password` (`canRevealHostAdminPassword`, `src/lib/permissions/project.ts:106`);
   - each reveal is audited.

   The draft's Introduction bullet "The Host_Administrator password reaches the browser" and the
   options of its Decision 3 should be restated against that.
2. **`data-service-roles` was approved on 2 November.** Once its Platform slice ships, a member's
   Handoff signs them in as themselves, and ensure-account creates their Person_Account in the
   Project_Tenant through `withProjectAdminSession`. That slice is not on `origin/main` `423f7d3d`
   or `release/dev` `64a55085`: `signHandoff` still signs `admin@example.com`
   (`src/lib/daas/handoff.ts:64-67`), and tasks 3.1–3.7 are unchecked. Only project roles apply
   since 7 November (`docs-app/src/app/projects/page.mdx:541`). The draft's Decision 6 (b), criteria 3.3
   and 3.8, and Requirement 10 (Open Studio into a customer) should say:
   - which account a member uses in a Customer_Tenant;
   - whether ensure-account runs per customer;
   - how a customer recognises those accounts (TD-5).
3. **Engine entry 199 seeds Project Developer and Project Viewer in the tenant template**, so every
   Customer_Tenant holds them. The draft should say whether a Release may change them.
4. **Add TD-2, TD-7 and TD-9** as questions of its own. Its Requirement 11 should point to this
   document for the kit's guidance.

**Engine entry 192 `tenant-schema-fan-out`** (read at `55394076`):

1. **Entries 193 to 200 have landed.**
   - Entry 199 seeds two roles at fixed identifiers in every tenant.
   - Entry 200 gives the MCP server write tools for field indexes, unique constraints, renames and
     workflows, so an agent builds more of the Blueprint through MCP. A Template_Revision should
     carry what those tools make.
2. **TD-4 (cron jobs copied inactive) and TD-5 (a custom role's identifier in a copy)** should be
   answered in its requirements.
3. **Its Requirement 7 (documentation and the contract)** should name this document as the
   skills-side consumer.

## Skill map

The treatment each folder needs. Most folders below were found by searching for the one-tenant
texts (`project is one tenant`, `the project's tenant`, `NEXT_PUBLIC_BUILDPAD_TENANT_ID`,
`X-Tenant-Id`, `DAAS_TOKEN`). The structure folders `add-cron`, `add-comments` and
`create-workflow` mention no tenant, and are listed because they build structure (TS-C).
`add-mobile-app` is listed because the Platform's mobile environment carries the tenant id.
Design confirms the list folder by folder.

- **Mode_Guide:** in `add-multitenancy` (a new reference, and the chooser in `SKILL.md`).
- **TS-A plus specifics:**
  - sign-in and session: `authentication-proxy`, `create-api-route`, `create-project`,
    `add-buildpad`, `buildpad-reference`, `add-mobile-app`, `add-microapp`, `add-mcp-server`;
  - scopes: `manage-scope`;
  - structure: `create-collection`, `create-rbac`, `create-workflow`, `add-cron`,
    `hooks-extensions`, `add-i18n`, `add-comments`, `add-files`, `create-form-builder`,
    `grant-module-access`, `daas-platform`;
  - people: `add-users`;
  - planning: `spec-driven-development`, `create-feature`, `idea-refine`;
  - workers and tests: `worker-messaging`, `create-tests`;
  - debugging and review: `debugging-and-error-recovery`, `security-and-hardening`, `references`,
    `agents`.
- **"Not available" only:** `add-external-oauth` (TD-9) and `migrate-to-engine` (moving a `scope`
  app into Customer_Tenants).
- **Unchanged:** every folder not named, and every Supabase passage.

## Traceability

| Question | Here |
|---|---|
| How a Skill knows the mode | TS-1; Requirement 1; TD-2 |
| What to choose, and its limits | Requirement 2; TS-6 |
| App code: sign-in, switch, current tenant | TS-4, TS-5; Requirement 3; TD-6, TD-11 |
| Structure and Releases | Requirement 5; TS-7; TD-3, TD-4, TD-5 |
| People | Requirement 6 |
| What is not available | Requirement 7; TD-7 to TD-10 |
| Keeping the wording true | TS-2; Requirement 9 |
