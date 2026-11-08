# Requirements Document

> **This is the skills repository's part of a change that spans three repositories.** The other
> two parts were written the same day, requirements only, neither approved:
>
> - the Engine's `buildpad-daas-go` ledger entry 204 `customer-self-onboarding` (branch
>   `spec/customer-self-onboarding`): an Onboarding_Key, server-only, that admits an app's server to
>   sign a person up (in no tenant, unverified), verify the address with a code the app mails
>   itself, and create one customer for that verified person, who becomes its Administrator.
>   Cited as **E-n** (Decisions) and **E n.m** (criteria);
> - the Platform's `buildpad-platform` `.kiro/specs/customer-self-onboarding` (branch
>   `spec/customer-self-onboarding`): the premium flag and the project Admin's switch, the key's
>   issue, rotation and revocation, the quota, Adoption of self-made customers into the Customers
>   page, abuse controls, and the kit's `selfOnboarding` signal. Cited as **P-n** and **P n.m**.
>
> Decisions of this document are written **K-n**. Rows it needs from elsewhere are `TD-n`,
> continuing `customer-tenant-skills`' numbering, in [Dependencies](#dependencies).
>
> Status: **draft, not approved.** Written 2026-11-08, before any change to a skill. Decisions K-1
> to K-9 are OPEN, each with options and a recommendation. design.md and tasks.md follow approval.
>
> Read, not observed:
> - this repository at `origin/main` `0f667fb` (v9.1.0, `customer-tenant-skills` S1), and
>   `feat/customer-tenant-skills-s2` `905fe81` (S2's gate reconciled and approved);
> - the Engine at `origin/main` `6011cf29`; the Platform at `origin/main` `c6ed1830`.
>
> No request was sent to any Engine, no database was read, and no agent was run against a skill.
>
> **Builds on, and does not reopen,** `customer-tenant-skills` (TS-1 to TS-7, its design and its
> Tenancy_Statements). That spec's task 12.2 waits for "a spec of its own that words the steps the
> dependency opens" before TS-N1 retires; this is that spec.

## Introduction

**Who has the problem.** An agent that builds an app on an Engine_Project with Customer_Tenants,
and the developer who wants that app to let a stranger create their own company: sign up with an
email, verify it, get a customer, become its administrator and land in it.

**What the skills say today** (at `0f667fb`).

- **TS-N1** (until TD-7): customers that sign themselves up are not available; only a Platform
  member creates a customer; "Tell the developer so and stop: never put the host administrator's
  credential or a call to the Engine's tenant routes in the application." It stands in
  `add-multitenancy/SKILL.md`, `add-users/SKILL.md` and the Mode_Guide
  `add-multitenancy/references/engine-customer-tenants.instructions.md` §4
  (`tools/repo-check/tenancy-statements.json:175-186`; `CONTRIBUTING.md:206`).
- **TD-7** is recorded as settled by the Platform's Decision 20 (a), not offered
  (`.kiro/specs/customer-tenant-skills/requirements.md:450`); task 12.2 is deferred and blocked on
  a later Platform spec (`tasks.md:658-661`).
- **ES-5** says sign-up, magic link, one-time code and password recovery are not available on an
  Engine project (`CONTRIBUTING.md:142`), and `security-and-hardening` checks that no sign-up flow
  is offered (`security-and-hardening/SKILL.md:83`, `:223`).
- **The Mode_Guide §3** says never create a customer from code
  (`engine-customer-tenants.instructions.md:81-86`).
- **TS-B** (from S2) already teaches the password sign-in with no tenant, the unbound session, the
  tenant list and `POST /api/auth/tenant`; the app takes its tenant from the session only.
- No skill sends mail, checks a captcha, or holds a server-only key other than the session cookie.

**What following them would do once the companions ship:** refuse a flow the project's owner has
turned on and paid for, and leave the developer to build it unguided, which is exactly where a key
ends up in a `NEXT_PUBLIC_` variable.

**What changes.** When TD-7 is met, TS-N1 retires and a new statement takes its place. A new skill
builds the flow in the app: a sign-up page with a bot check, a server route that calls the
Engine's sign-up with the key and mails the code through the app's own provider, a verify page, a
"create your company" page for a signed-in person with no customer, and the switch into the new
customer. Everything that reads the key runs on the server.

## Glossary

- **Tenancy_Mode**, **Tenancy_Signal**, **Mode_Guide**, **Tenancy_Statement**, **Gate**,
  **Unbound_Session**, **Current_Tenant**: as `customer-tenant-skills` defines them.
- **Self_Onboarding**, **Onboarding_Key**, **Self_Made_Tenant**, **Verification_Code**: as Engine
  entry 204 and the Platform's companion define them.
- **Onboarding_Signal**: what tells a skill that the project's Self_Onboarding is on (K-3).
- **Onboarding_Flow**: the pages and server routes Requirement 3 builds.
- **Mail_Sender**: the app's own function that sends one message through the app's mail provider
  (K-4).

## Decisions

All are **OPEN**. The last column is the drafter's recommendation, not a settlement.

| # | Question | Options | Recommended |
|---|---|---|---|
| K-1 | Where the flow is taught | **(a)** A new skill `add-customer-onboarding`, behind the Gate and the Tenancy check, which the Mode_Guide names. **(b)** A new section of the Mode_Guide and of `add-users`. **(c)** `authentication-proxy` | **(a)**. It installs pages and server routes the way `add-users` does, and it has its own preconditions (mode, signal, mail provider, bot check); a section would load all of it into every customer-tenants task |
| K-2 | What replaces TS-N1 | **(a)** TS-N1 retires when TD-7 is met (its `until`), and one new statement **TS-O1** takes its three places plus the new skill: it says the flow exists only while Self_Onboarding is on, how to tell, what to do when it is off (tell the developer a project Admin turns it on, and stop), and that the key is server-only. **(b)** Two statements, one for on and one for off. **(c)** TS-N1 retires with no replacement | **(a)**. Whether it is on is per project, read at the agent's runtime, so one statement must carry both branches; (b) splits one rule over two texts the check keeps apart; (c) leaves an agent on a project with it off free to build a substitute |
| K-3 | How an agent learns that Self_Onboarding is on | **(a)** The Onboarding_Signal `selfOnboarding` in `.buildpad/project.json` (P 8.1), else `get_project_detail` (P 8.2), else ask the developer once and record the answer beside the tenancy answer. **(b)** Whether `BUILDPAD_ONBOARDING_KEY` is set. **(c)** Always ask | **(a)**, by the Tenancy check's own pattern. (b) needs an environment file, which a skill may not open (TS-1); (c) asks every time |
| K-4 | How the verification mail is sent | **(a)** Through the app's own provider, behind one server function `sendMail({to, subject, text, html})` the skill writes or finds; the skill asks which provider and stops if there is none. **(b)** One named vendor, prescribed. **(c)** A Platform mail service | **(a)**. The Engine sends nothing (E-4 (a)), no Platform service exists, and the app's sender, domain and reputation are the developer's. The skill names what a provider needs (a verified sending domain, an API key in the server environment) and builds nothing for one |
| K-5 | A bot check on the sign-up page | **(a)** Required: a captcha the developer chooses, its token checked by the app's server route before it calls the Engine. **(b)** Optional. **(c)** None; the Engine's limits only | **(a)**. Every Engine request comes from the app's server, so the Engine cannot tell a person from a script (E-7); the bot check is the only layer that can, and without it a script spends the key's hourly budget and the mail provider's reputation |
| K-6 | How the person reaches a session after verifying | **(a)** The verify page confirms and asks them to sign in; sign-in answers an Unbound_Session (no tenant yet), and the app sends them to "create your company". **(b)** The app keeps the password from sign-up (an encrypted cookie) and signs in for them after verification | **(a)**. The Engine answers no session at verification (E 3.3), and holding a password between two requests is a credential store the app does not need. One extra step, once |
| K-7 | How the key's handling is checked | **(a)** A new Repository_Check rule R16: a skill file that names `NEXT_PUBLIC_BUILDPAD_ONBOARDING_KEY`, or reads `BUILDPAD_ONBOARDING_KEY` in a file it marks as client code, fails. **(b)** Text only | **(a)**. A misplaced prefix is the likeliest way this key leaks, and R15 already checks text this way |
| K-8 | ES-5's "not available: sign-up" in this mode | **(a)** ES-5 is unchanged; TS-O1 replaces its sign-up clause for a project with Customer_Tenants and Self_Onboarding on, as TS-A replaces ES-3 to ES-9, and the `security-and-hardening` checklist names the exception. **(b)** Amend ES-5 | **(a)**. ES-5 holds for every other Engine project, and the replacement pattern already exists |
| K-9 | How it ships | **(a)** One MINOR release, stage S4, once TD-7 is met (TD-14, TD-15 and TD-16), after S2 (TD-1). **(b)** Ship the skill early, held behind the Gate | **(a)**. A skill that directs routes the Engine does not serve fails on its first call; `customer-tenant-skills` ships each stage when its dependency is met |

## Boundary Context

- **In scope:**
  - TS-N1's retirement, TS-O1's wording and places, and the check's register;
  - the `add-customer-onboarding` skill: the sign-up page and route, the bot check, the mail, the
    verify page and route, the resend, "create your company" for a signed-in person with no
    customer, the switch, and what each page shows on each refusal;
  - the Mode_Guide's paragraph that points to it; `add-users`, `security-and-hardening` and
    `authentication-proxy` where they speak of sign-up;
  - rule R16;
  - the Dependencies rows TD-7 (restated) and TD-14 to TD-16.
- **Out of scope:**
  - every Engine and Platform change (the companions);
  - inviting further people into a customer (`add-users`, unchanged);
  - a password reset for app users (not offered by the Engine; ES-5 stands);
  - XAppHub sign-up (TS-N3, TD-9); a public page per customer (TS-N2, TD-8);
  - choosing a mail or captcha vendor for the developer.
- **Adjacent expectations:** `customer-tenant-skills` owns the Tenancy check, TS-A, TS-B, the
  Mode_Guide and rule R15; this spec adds to them and changes none of their rules. The kit's
  signal and its example environment line are the Platform's (P Requirement 8).

## Requirements

### Requirement 1: TS-N1 retires and TS-O1 replaces it

**Objective:** As an agent on a project whose owner turned Self_Onboarding on, I want to be told
how to build it, and on one where it is off, to be told who turns it on.

#### Acceptance Criteria

1. When TD-7 is recorded as met in this repository's Dependencies (a dated, approved amendment),
   `tools/repo-check/tenancy-statements.json` shall add TD-7 to `met`, which retires TS-N1 from
   every file (R15 `ts-retired`).
2. The register shall add TS-O1, "From S4 (TD-7 met)", in `add-multitenancy/SKILL.md`,
   `add-users/SKILL.md`, the Mode_Guide §4's place of TS-N1 and `add-customer-onboarding/SKILL.md`,
   worded, until the design words it, as: "On an Engine project with Customer_Tenants customers
   sign themselves up only while the project's Self_Onboarding is on, which `selfOnboarding` in
   `.buildpad/project.json` says. While it is off, tell the developer that a project Admin turns
   it on from the Platform's Customers page, and stop. While it is on, build it with the
   `add-customer-onboarding` skill: the application's own server routes call the Engine's sign-up,
   verification and customer routes with `BUILDPAD_ONBOARDING_KEY`, read on the server only and
   never sent to a browser. Never put the host administrator's credential or a call to
   `/api/tenants` in the application."
3. The Mode_Guide §3 "Never create a customer from code" shall gain "except through the
   `add-customer-onboarding` skill's route, with the person's own session".
4. The line after TS-O1 in the Mode_Guide shall name who turns it on (the project Admin) and what
   gates it (the Platform's premium flag), in place of TS-N1's "Who could offer it later".
5. Until TD-7 is met, TS-N1 shall stay exactly as it is, and TS-O1 shall be in no file
   (R15 `ts-held-back`).

### Requirement 2: The skill establishes its preconditions first

#### Acceptance Criteria

1. `add-customer-onboarding` shall begin with the Gate and the Tenancy check; in the mode `scope`,
   or on a Supabase project, it shall say the flow needs Customer_Tenants and stop.
2. It shall then read the Onboarding_Signal as K-3 settles; while it is off, it shall say TS-O1's
   "off" branch and stop.
3. It shall then establish a Mail_Sender (K-4): find one in the app, or ask the developer which
   provider; with none, it shall say that verification mail needs one and stop.
4. It shall establish a bot check (K-5) the same way.
5. It shall tell the developer that `BUILDPAD_ONBOARDING_KEY` is set in the app's server
   environment by the Platform (or by them, from the Customers page) and never in a
   `NEXT_PUBLIC_` variable, and shall never open an environment file to check (TS-1).
6. It shall tell the developer that the project needs a published Release before any customer can
   be made (E 4.3; P-7), and that the Engine answers 409 until then.

### Requirement 3: The Onboarding_Flow the skill builds

**Objective:** As a stranger, I want to sign up, verify my address, create my company and land in
it, in one sitting.

#### Acceptance Criteria

1. The skill shall build every Engine call in one server-only module that reads
   `BUILDPAD_ONBOARDING_KEY`, sends it as `X-Buildpad-Onboarding-Key`, sends
   `X-Onboarding-Client-Address` with the end user's address where E-7 (b) is taken, sends no
   `Origin` header, and is imported by server routes only.
2. **Sign-up.** The sign-up page shall post email, password and the bot-check token to the app's
   own route; the route shall check the token, call `POST /api/auth/signup`, and mail either a
   verification link carrying the code (`existing: false`) or a "you already have an account, sign
   in" message (`existing: true`), and the page shall show the same "check your mail" text in both
   cases (E-5).
3. The link shall open the app's verify page, which posts the code to the app's route and removes
   it from the address bar; the page shall send no referrer.
4. **Verify.** The route shall call `POST /api/auth/signup/verify`; on success the page shall ask
   the person to sign in (K-6 (a)); on `INVALID_TOKEN` it shall offer to resend, which calls
   `POST /api/auth/signup/resend`.
5. **Sign-in.** The sign-in shall be TS-B's, unchanged; an Unbound_Session whose tenant list is
   empty shall be sent to "create your company"; a list of one or more to TS-B's chooser, with
   "create another company" offered where the project's `per_identity` allows it.
6. **Create your company.** The page shall take a company name; the app's route shall call
   `POST /api/onboarding/customers` with the key and the person's own access token as bearer, a
   UUID it chose as `id` so a retry is safe (E 4.8), and on 201 switch the session with
   `POST /api/auth/tenant` and replace the session's tokens with the pair the switch answers, as
   TS-B does.
7. The route shall send no administrator, email or template (E 4.4); the person is the
   administrator because the session is theirs.
8. The pages shall say, without the Engine's wording: an unverified sign-in ("confirm your
   address first", with resend); the company limit (409); the project's limit (403
   `QUOTA_EXCEEDED`: "sign-ups are full, contact the app's owner"); sign-ups turned off (403); no
   Release yet (409); too many attempts (429); a timeout on creation (503: retry with the same
   `id`).
9. After the switch, the app shall take the Current_Tenant from the session (TS-5 (a)) and show the
   new company's name.
10. The skill shall add no other route that sends the key, and no client component that imports
    the module of criterion 1.

### Requirement 4: The skills that speak of sign-up know the mode

#### Acceptance Criteria

1. `security-and-hardening` shall keep its "no sign-up flow" check for every Engine project, with
   one exception for a project with Customer_Tenants and Self_Onboarding on, built by
   `add-customer-onboarding`, and shall add checks: the key only on the server, the bot check
   before the Engine call, the same page text for new and existing addresses.
2. `authentication-proxy` and `add-users` shall name `add-customer-onboarding` where they say that
   sign-up is not available, in that mode only.
3. `buildpad-debug`'s table shall gain the flow's refusals and their causes (E Requirements 2 to 7).

### Requirement 5: The check knows the key

#### Acceptance Criteria

1. Where K-7 (a) is taken, a Repository_Check rule R16 shall fail any checked file that names
   `NEXT_PUBLIC_BUILDPAD_ONBOARDING_KEY`, or reads `BUILDPAD_ONBOARDING_KEY` in a block it marks as
   client code, with tests written first.
2. R15's register shall carry TS-O1 with its `in` list, and its tests the retirement of TS-N1.

### Requirement 6: Release

#### Acceptance Criteria

1. The change shall ship as one MINOR release, stage S4, after TD-7 is met (K-9), with a
   CHANGELOG entry naming TS-N1's retirement and the new skill, and the skill map's row for it.
2. `customer-tenant-skills` task 12.2 shall be ticked by this release, citing it.

## Dependencies

| ID | Owner | What it is | Needed by | Status when read |
|---|---|---|---|---|
| TD-1 | Platform | `project-tenants` Wave 1 switched on (its task 12.3) | every requirement | Unmet: deployed to dev and production, `CUSTOMER_TENANTS_ENABLED` unset |
| TD-7 | Platform, Engine | Restated: an app's server can create a customer for a verified person, with a credential that is not the host's. **Met when TD-14 and TD-15 are met** | 1, 3 | Unmet. Was "settled as Decision 20 (a), not offered"; the companions are its later spec |
| TD-14 | Engine | Entry 204 applied and released; its Decisions settled as this spec assumes (E-1 (a), E-2 (a), E-4 (a), E-6 (a), E-10 (a), E-11 (a)); the version the Platform gates on | 3 | Unmet: requirements only, not approved |
| TD-15 | Platform | `customer-self-onboarding` shipped and switched on: the flag, the switch, the key in the app's environment, Adoption | 2, 3 | Unmet: requirements only, not approved |
| TD-16 | Platform | The Onboarding_Signal: `selfOnboarding` in `.buildpad/project.json` and `get_project_detail` (P Requirement 8) | 2.2 | Unmet: requirements only |

Where a companion settles a Decision otherwise than this spec assumes (for instance E-4 (b), a
webhook, or E-10 (b), a session from creation), Requirement 3 is restated before design.

## Traceability

| Need | Here |
|---|---|
| What the skills tell an app developer | K-1, K-3, K-8; Requirements 2, 4 |
| TS-N1's retirement | K-2; Requirement 1; `customer-tenant-skills` task 12.2 |
| The sign-up, create-customer and switch flow | K-4 to K-6; Requirement 3 |
| The key stays on the server | K-7; Requirements 3.1, 3.10, 5 |
| Shipping | K-9; Requirement 6; Dependencies |
