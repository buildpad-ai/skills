# Design Document: Customer self-onboarding (skills repository part)

> **Amended 2026-11-09: decision [S-3](#s-3-settled-b-a-built-in-sender-for-the-verification-mail)
> (a built-in sender for the verification mail, and a demo mode for the bot check) was added, and
> the user settled it as (b) the same day ("Choose (b)"): the Engine sends the code. The rest of the
> approved text is unchanged. Until Engine entry 205 `onboarding-verification-mail` is released (its
> requirements are drafted, not approved), (a) stands and stage S4 is built as approved. Group 10 of
> tasks.md holds this repository's part, gated on that release.**
>
> **Amended again 2026-11-14, awaiting approval:** Engine entry 205 and the Platform's group 13 are
> merged, so "S-3 (b) as built" (under S-3) reconciles this part with them, and adds **decision
> S-4** (how the demo's skipped bot check stays in demo). **The user settled S-4 as (b) on
> 2026-11-14 ("(b) as recommended")**: a pass-through guarded at run time by
> `BUILDPAD_SIGNUP_MAIL`. tasks.md group 10 is written in full on it and awaits approval. The
> approved text above and below is unchanged.
>
> **Status.** **Approved by the user on 9 November 2026 ("Approve as recommended"), with S-1 and S-2
> settled as recommended; S-2 (b) amends criterion 1.2 (dated note there). tasks.md follows.**
> Generated 2026-11-09. Phase 2 of a gated spec, written against the
> requirements the user approved on 8 November 2026 (`7bb864e`; Decisions K-1 to K-10 settled as
> recommended). No skill folder, `CONTRIBUTING.md`, test or tool is changed by this document.
> Requirement 3.11 (workspaces as scope nodes) waits for TD-17, so its branch is designed only as
> the statement that says it is not available ([The mode `scope`](#the-mode-scope-k-10-requirement-311)).
> Two questions the requirements do not settle are listed as **open decisions S-1 and S-2**, each
> with a recommendation; the design is written on the recommendations.
>
> **Revisions read (read, not run).**
> - This repository at `origin/main` `0f667fb` (v9.1.0, `customer-tenant-skills` S1). Every line
>   number below is that tree's. `customer-tenant-skills` S2 is designed and approved but **not
>   built** (`feat/customer-tenant-skills-s2` `905fe81` holds its reconciled gate only). Where this
>   design changes an S2 text (Mode_Guide §5, `settleTenant`, the debugging rows), it names the
>   text as S2's design states it (`.kiro/specs/customer-tenant-skills/design.md:353-458`, `:559-576`).
> - The Engine's entry 204 **as built**: `buildpad-daas-go` branch `spec/customer-self-onboarding`
>   `7ad36743` (applied in the ledger, not merged, not released). Where the build differs from the
>   Engine's design.md, this design follows the build: verify has no per-address limit, and a
>   self-made tenant's `origin.created_by` carries the person's address.
> - The Platform's companion design: `buildpad-platform` `spec/customer-self-onboarding`
>   `221dbdd7` (generated 2026-11-09, not approved). What this design reads from it is in
>   [Companion contract relied on](#companion-contract-relied-on).
>
> No request was sent to any Engine, and no agent was run against a skill.

## Overview

**Purpose.** On an Engine project with Customer_Tenants whose owner has turned Self_Onboarding on,
an agent builds the app's sign-up, verification, "create your company" and switch flow. Everything
that holds the Onboarding_Key runs on the app's server. On any other project the agent is told who
turns the flow on, and stops. The statement TS-N1 ("customers that sign themselves up are not
available") retires, and TS-O1 takes its places.

**Users.**
- The agent, which reads the skills.
- The developer, who chooses the mail provider and the bot check.
- The stranger, who uses the pages the skill builds.

**Impact (stage S4, one MINOR release).**
- A new skill folder, `add-customer-onboarding`, Engine-only.
- TS-O1 replaces TS-N1 in three files and appears in the new skill.
- The Mode_Guide gains §13 (S-2 (b)), and its §1, §3 and §5 change.
- `add-users`, `authentication-proxy`, `security-and-hardening`, `references/security-checklist.md`,
  `agents/security-auditor.md` and `debugging-and-error-recovery` each gain a mode-specific passage.
- A new Engine statement, ES-17n, for the mode `scope`.
- A new Repository_Check rule, R16, with tests written first.
- The register, the skill map, the README catalogue, `CHANGELOG.md`, and `customer-tenant-skills`
  task 12.2.

### Goals
- The key is read in one server-only module, never in a client component. No skill text names it
  with a `NEXT_PUBLIC_` prefix, and R16 checks both.
- An agent on a project where the flow is off builds nothing and says who turns it on.
- The app survives the Engine's limits as built: the per-address budgets, the template-copy lock's
  503 with a same-id retry, and the 429s.
- Each refusal the Engine answers has a person-facing sentence, and none repeats the Engine's
  wording.

### Non-Goals
- Every Engine and Platform change (the companions).
- Choosing a mail or bot-check vendor (K-4, K-5).
- A password reset for app users (ES-5 stands).
- Inviting people into a customer (`add-users`).
- A mobile app's sign-up (the Platform's Issue 6).
- Workspaces as scope nodes, until TD-17.

## Boundary Commitments

### This Spec Owns
- `add-customer-onboarding/` (its `SKILL.md` and its reference file).
- TS-O1 and ES-17n, their register rows and their places.
- R16 and its tests.
- The Mode_Guide's §13, and its changes to §1, §3 and §5.
- The mode-specific passages in the folders named under Impact.

### Out of Boundary
- **The Engine:** the routes, the budgets, the lock and the key (entry 204).
- **The Platform:** the flag, the switch, the key's issue and its Amplify variable, Adoption and the
  kit's `selfOnboarding` (its design).
- **`customer-tenant-skills`:** the Tenancy check, TS-A, TS-B, R15, the Mode_Guide §1 to §12, and
  `settleTenant`. This spec adds to S2's texts in the places named, and changes none of their rules
  except the empty-list branch of `settleTenant` and the list of routes an unbound session reaches.
  The Mode_Guide's §5 is where that list lives.

### Allowed Dependencies
- The Gate (`tools/repo-check/gate.md`), the Tenancy check (`tools/repo-check/tenancy-check.md`),
  and the register (`CONTRIBUTING.md` "Tenancy statements", `tools/repo-check/tenancy-statements.json`).
- `tools/repo-check/lib/markdown.mjs`, which finds fenced blocks, as R1 and R15 use it, and
  `checked-set.mjs`.
- S2's `lib/auth/tenants.ts` (`listTenants`, `switchTenant`, `settleTenant`) and its login route, as
  S2's design writes them.

### Revalidation Triggers
- Entry 204 changes, when merged, any route, member, code or budget in
  [Companion contract relied on](#companion-contract-relied-on).
- The Platform's design changes the signal member, the variable name or the `amplify.yml` line.
- S2's design changes `settleTenant`, the login route, the forwarder's answer table or the
  Mode_Guide §5.
- TD-17 becomes met: the `scope` branch is designed then, in a spec of its own.

## Decisions S-1 and S-2

**Both SETTLED 2026-11-09 by the user, as recommended ("Approve as recommended"):** S-1 (a),
S-2 (b). S-2 (b) amends requirements criterion 1.2.

### S-1. `get_project_detail` as a source of the Onboarding_Signal

**The gap.** K-3 (a) reads the signal in this order: `.buildpad/project.json`, else
`get_project_detail`, else ask the developer once. The Tenancy check, which this spec must not
change, forbids an agent "a tool that returns project credentials" while it finds the mode
(`tools/repo-check/tenancy-check.md`, last paragraph; `customer-tenant-skills` design T1).
`get_project_detail` is such a tool: it returns the project's credentials to a token that may view
them. Read literally, K-3 makes the agent call a tool its own skills forbid in the step before.

| Option | Order |
|---|---|
| **(a) Leave the tool out** | `.buildpad/project.json` `selfOnboarding`; else `.buildpad/onboarding-answer.json`; else ask once and record the answer there |
| (b) Keep K-3 as written | As (a), with `get_project_detail`'s `project.self_onboarding` before the question; the skill names only that member, and says to use nothing else of the answer |
| (c) Read the tool only | No record file; ask each time the tool is unavailable |

**SETTLED (a)**, 2026-11-09, as recommended. It keeps one rule for every mode question, and the question costs one answer
per repository. A kit assembled after the Platform's change always carries `selfOnboarding`, so the
question arises only for an older kit, or a repository written by Fix_App. Under (b) the skill would
be the first to call a credential-returning tool on a fact the kit already holds.

### S-2. Where TS-O1 stands in the Mode_Guide

**The gap.** Criterion 1.2 puts TS-O1 at "the Mode_Guide §4's place of TS-N1". §4 is titled
"Not available", and every other statement there says something is not available. TS-O1 says the
flow is available while it is on. An agent reading §4 for what it may not build would meet a
paragraph that tells it what to build.

| Option | Where |
|---|---|
| (a) As written | TS-O1 in §4 where TS-N1 stood, followed by criterion 1.4's line |
| **(b) A section of its own** | A new §13 "Customers who sign themselves up", holding TS-O1, 1.4's line and a pointer to the skill. §4 loses TS-N1 and gains nothing. §1 names §13. |

**SETTLED (b)**, 2026-11-09, as recommended. R15 requires TS-O1 in the file, not in a given section, so (b) needs no rule
change, and §4 keeps one meaning. This changes the place criterion 1.2 names, so it needs the user's
approval as a requirements amendment. The criterion's other places stand.

### S-3 (SETTLED (b)). A built-in sender for the verification mail

**Added 2026-11-09 at the user's request ("Add the decision"). SETTLED (b) by the user the same day
("Choose (b)"): the Engine sends the code.** The Engine part is entry 205
`onboarding-verification-mail` (requirements only, none approved); the Platform's is its D-5 (b) and
its tasks.md group 13.

**What (b) settles here** (the names follow entry 205's recommendations, and are revalidated when it
is approved):
- **Reading the delivery.** The Onboarding check reads the delivery from the kit
  (`selfOnboardingMail`: `app`, `demo` or `relay`), or from `get_project_detail`
  (`project.self_onboarding_mail`). A kit without the member is `app`.
- **Under `demo` and `relay`**, step 5 (Mail_Sender) is skipped. The verify page sits at the
  Platform's fixed verify path, and reads the code from the link the Engine sends.
- **Under `demo`**, step 6 writes a pass-through `verifyHuman` marked "demo only", and the page says
  that sign-up mail reaches the project's members only. R16, or a rule beside it, refuses the
  pass-through outside `demo`.
- **Under `app`, and for any project until entry 205 is released**, steps 5 and 6 are as approved.

#### S-3 (b) as built (added 2026-11-14; group 10's tasks await approval)

**Read 2026-11-14, nothing run:** `buildpad-daas-go` `origin/main` with entry 205 merged (PR #44,
`2d58083f`); `buildpad-platform` `origin/main` with group 13 merged (PR #286, `4b6359c6`).

**What the two built** (the names above are confirmed, with one change: S-3's table said `engine`
where both say `relay`):
- **The delivery** is the Platform's choice per project: `app` (the default), `demo` or `relay`.
  The kit states it as `selfOnboardingMail` in `.buildpad/project.json`, only while self-onboarding
  is on or stopped and the Engine may send the mail; `get_project_detail` as
  `project.self_onboarding_mail`. A kit without the member is `app`.
- **Sign-up and resend in `demo` and `relay`** answer `{existing: false, mail: {sent}}` and never a
  code. `existing: true` is unchanged. `sent: false` means the relay did not take the message; the
  sign-up stands and resend may be tried.
- **The link** is the Platform's `verify_url` plus `#code=<code>`. The Platform sets `verify_url` to
  the app's address plus **`/verify-email`**: this skill's own verify page, unchanged.
- **Demo's refusals:** 403 `RECIPIENT_NOT_ALLOWED` ("This demo sends sign-up mail to the project
  team's addresses only.") for an address outside the project's members; 429 `REQUESTS_EXCEEDED`
  with the message "This demo has sent as much sign-up mail as it may for now; try again later."
  at the cap (20 an hour, 100 a day), refused before anything is written.
- **The Platform offers `demo` and `relay` only for a key written to a deployed BuildPad app**, so
  an app on another host is always `app`.

**How the skill uses it:**
- **The answer decides, not the build.** The sign-up and resend routes branch on the Engine's
  answer: `verification` → the app mails the code (`app`); `mail` → the Engine mailed it. So an app
  built for one delivery keeps working when the Platform's setting changes, with one exception: an
  app built without a mail sender that meets `app` answers 503 "Sign-up mail is not set up for this
  app." and logs `onboarding.mail_sender_missing`, telling the developer to rebuild with step 5.
- **The delivery read at build** only decides what the skill writes: under `demo` and `relay`, no
  `lib/mail/send.ts` (step 5 is skipped); under `demo` only, step 6 per S-4. The Onboarding check
  reads it from the kit only, as S-1 (a) reads `selfOnboarding`; a kit without the member, or no
  kit, builds `app` (both steps), which works under every delivery. It is never asked: a wrong
  guess costs a mail sender the app does not use, never a broken sign-up.
- **The pages:** under `demo`, the sign-up page adds "Demo: sign-up mail reaches this project's
  members only." The verify page is unchanged in every delivery.
- **The refusals table** gains `RECIPIENT_NOT_ALLOWED` ("This demo only signs up the project team's
  addresses.") and the demo cap's 429, told apart from the other 429s by the Engine's message
  prefix "This demo has sent", as the create route's 409s are told apart (Issue 5).

#### S-4 (settled (b), 2026-11-14). How the demo's skipped bot check stays in demo

**Settled by the user on 2026-11-14 ("(b) as recommended").** The pass-through is guarded at run
time by `BUILDPAD_SIGNUP_MAIL`, which the Platform writes beside the key (a Platform task after its
group 13, owned by the Platform's spec); R16 gains a code refusing an unguarded pass-through. The
options are kept below as written.

S-3 (b) settled "no captcha in demo". The skill would write `verifyHuman` as a pass-through under
`demo`. But the delivery can change on the Platform after the app is built, and a pass-through left
in place under `relay` lets a script mail anyone through the project's own relay. A Repository_Check
rule reads this repository's text, never an app, so it cannot see a project's delivery.

| | How | Holds when the delivery changes | Costs |
|---|---|---|---|
| **(a) Keep the bot check always** | Step 6 as approved in every delivery; demo removes only the mail provider question | Nothing to hold: there is no pass-through | A demo still needs a captcha account (Turnstile is free and quick). Reverses S-3 (b)'s "no captcha in demo" |
| **(b) A pass-through guarded at run time** | The Platform writes a second server variable, `BUILDPAD_SIGNUP_MAIL`, with the delivery whenever it writes the key or the delivery changes, and removes it on turn-off; the skill's `amplify.yml` step writes it into `.env.production` as it does the key. The pass-through returns true only while `BUILDPAD_SIGNUP_MAIL === "demo"`, and otherwise refuses sign-up with 503 "The human check is not set up for this app." R16 gains a code refusing a pass-through block without that guard | Yes, at the app's next deployment (the variable is read at build on Amplify, as the key is); until then the old build runs | A Platform change (write and remove one more variable beside the key: a task after group 13) and one more `amplify.yml` line |
| **(c) A pass-through guarded by the skill's text only** | The pass-through is marked "demo only"; the skill's review step and the security checks tell the agent to replace it when the delivery is not `demo` | Only when an agent next runs the skill or a review | No runtime guard: a deployed app keeps skipping the check |

**Recommended (b).** It keeps S-3 (b)'s "no captcha in demo" as the user settled it, and the
pass-through cannot outlive the demo past one deployment. (a) is the safe fallback if the Platform
change is not wanted. (c) leaves the gap S-4 exists to close.

**Earlier text, kept as written.** The paragraphs below laid out the options, as written when S-3
was open. It is the Platform
design's D-5, which holds the options' full comparison: sender reputation, the from address,
abuse, cost, and the limits already built. It needs an Engine entry under (b): gap 5 of the Engine
gaps (tasks.md, Deferred). This section says what the skill would do under each option.

**Today (K-4 (a), K-5 (a)).** Steps 5 and 6 of the order of work ask for a mail provider and a bot
check, and stop without either. A demo therefore needs a provider account and a verified sending
domain before anyone can sign up. Hosted Supabase's built-in sender, which mails the team's
addresses only, a few messages an hour, is what the user compared this with.

| | What the skill does |
|---|---|
| **(a) The app always brings its own provider** | As designed: steps 5 and 6 unchanged |
| **(b) The Engine mails the code** | The Onboarding check also reads the delivery: a kit member beside `selfOnboarding` (say `"selfOnboardingMail": "demo" \| "engine" \| "app"`), or `project.self_onboarding_mail` from `get_project_detail`. With `demo` or `engine`, step 5 is skipped: no `lib/mail/send.ts`. The sign-up route then answers "Check your email" without sending, because the Engine answers no code. The verify page sits at the fixed path the Platform registers as `verify_url` (for example `/onboarding/verify`), and its code is read from the link the Engine sends. With `demo`, step 6 writes `verifyHuman` as a pass-through marked "demo only", and the page says "Demo: sign-up mail reaches this project's members only." With `app`, steps 5 and 6 are as today. R16 (or a rule beside it) refuses the pass-through outside `demo` |
| **(c) The Platform supplies a default sender** | Step 5 writes `lib/mail/send.ts` against the Platform's mail endpoint with a new server variable for its credential, instead of asking. Step 6 is unchanged, because mail reaches anyone |

**The bot check in demo.** Under (b)'s demo, mail reaches project members only and is capped, so a
script can make unverified identities (purged after 7 days, bounded by entry 204's budgets) but
cannot verify an outsider. Skipping the captcha there is safe; leaving the demo brings it back.

**Recommendation: (b), with the skill skipping step 5 under `demo` and `engine` and step 6 under
`demo` only.** It removes both questions for a demo, and keeps production's path as designed. It
waits for the Engine entry and the Platform's signal member; until both ship, (a) stands and stage
S4 is built as approved.

**What changes here under (b), if settled.**
- K-4 and K-5 gain dated amendment notes.
- O1 gains the delivery member.
- Steps 5 and 6 gain the branches above.
- Sign-up (3.2) and Verify (3.3) gain the engine-delivery path.
- R16 gains the pass-through check.
- The dev run gains a demo case.

## Contracts used and names fixed here

### O1 The Onboarding_Signal and its record (K-3, S-1 (a))

| Source | File | Member | Values | Read when |
|---|---|---|---|---|
| Signal | `.buildpad/project.json` (the Platform writes it) | `selfOnboarding` | `true`, `false` | first |
| Record | `.buildpad/onboarding-answer.json` (the agent writes it) | `selfOnboarding` | as above | when the signal has no boolean `selfOnboarding` |

- **Record content:** exactly `{"buildpadOnboardingAnswer": 1, "selfOnboarding": true}` (or
  `false`), UTF-8, LF, a trailing newline. It is a file of its own: the Tenancy check writes
  `.buildpad/tenancy-answer.json` byte for byte, so a member added there would be lost.
- **Reading rule:** as T1's. If the file is not JSON, or the member is missing or not a boolean,
  there is no answer.
- **Disagreement:** the signal wins. The developer is told that a kit downloaded before sign-up
  was turned on says `false`, and that they download it again or set the member. This is the
  Platform's `KitSignalNotice` sentence.
- **Never read for it:** an environment file (so not `BUILDPAD_ONBOARDING_KEY`, K-3 (b));
  `get_project_detail` (S-1 (a)); any Engine route.

### O2 The Onboarding check (Requirement 2)

The procedure `add-customer-onboarding/SKILL.md` follows after the Gate and the Tenancy check. It is
written once, in that file only (no sentinels, no copies):

```markdown
**Establish whether customers may sign themselves up.** Find it with these steps, in order, and
stop at the first step that answers:

1. Read `.buildpad/project.json`. If its field `selfOnboarding` is `true` or `false`, that is the
   answer. If `.buildpad/onboarding-answer.json` says otherwise, tell the developer the two files
   disagree and follow `.buildpad/project.json`: a kit downloaded before sign-up was turned on says
   `false`, and the developer downloads the kit again or sets the field.
2. Otherwise read `.buildpad/onboarding-answer.json` in the same way.
3. Otherwise ask the developer once: "Has a project Admin turned on customer sign-up (Self-onboarding)
   for this project on the Buildpad platform's Customers page?" Write the answer to
   `.buildpad/onboarding-answer.json` as `{"buildpadOnboardingAnswer": 1, "selfOnboarding": true}`
   or `{"buildpadOnboardingAnswer": 1, "selfOnboarding": false}`, and ask the developer to commit
   that file. Never write `.buildpad/project.json`.

Do not open an environment file to find it, and do not call a tool that returns project credentials.
```

### O3 TS-O1 (Requirement 1, K-2)

It is registered in `CONTRIBUTING.md` "Tenancy statements" and in `tenancy-statements.json`:
`requires: ["TD-7"]`, `until: []`, `in` as below. TS-N1's row is unchanged: its `until: ["TD-7"]`
retires it on the same edit that adds `TD-7` to `met` (1.1, 1.5).

| Id | When | Text |
|---|---|---|
| TS-O1 | From S4 (TD-7 met) | On an Engine project with Customer_Tenants customers sign themselves up only while the project's Self_Onboarding is on, which `selfOnboarding` in `.buildpad/project.json` says. While it is off, tell the developer that a project Admin turns it on from the Platform's Customers page, and stop. While it is on, build it with the `add-customer-onboarding` skill: the application's own server routes call the Engine's sign-up, verification and customer routes with `BUILDPAD_ONBOARDING_KEY`, read on the server only and never sent to a browser. Never put the host administrator's credential or a call to `/api/tenants` in the application. |

The text is criterion 1.2's draft. Two checks were made against it:
- It opens with the reserved opening.
- It holds no §C20 guard pattern and no marker token (guard test).

The check found nothing to change. Under S-1 (a), "which `selfOnboarding` in
`.buildpad/project.json` says" stays true: the record file stands in for the signal only when the
signal is silent, as the Tenancy check's record does.

**`in`:**
- `add-multitenancy/SKILL.md` (TS-N1's place, `:109`);
- `add-users/SKILL.md` (TS-N1's place, `:178`);
- `add-multitenancy/references/engine-customer-tenants.instructions.md` (§13, under S-2 (b));
- `add-customer-onboarding/SKILL.md` (after the Onboarding check).

Every one of these files already carries TS-A, except the new skill, which carries it after its
Gate (T7's I-G).

**The line after it in the Mode_Guide (1.4):** "Who turns it on: a project Admin, from the
Platform's Customers page, once a host administrator has turned on the premium flag Customer
self-onboarding for the project."

### O4 ES-17n (K-10, Requirement 3.11 while TD-17 is unmet)

The `scope` branch cannot be a Tenancy statement: that opening is fixed to Customer_Tenants
(`tenancy-statements.json` `opening`). It is therefore an Engine statement, registered in
`CONTRIBUTING.md` "Engine statements" after ES-16:

| Id | When | Text |
|---|---|---|
| ES-17n | Until workspaces as scope nodes are available (TD-17) | On an Engine project in the mode `scope` a workspace that a person creates for themselves, as a scope node they own in the project's one tenant, is not available: no route lets a person who is not an administrator create a scope node or give roles at one. Tell the developer so and stop: build no substitute, and never give the application an administrator's credential to create one. Customers that sign themselves up, each a tenant of its own, are available in the mode `customer-tenants`, with the `add-customer-onboarding` skill. |

Its places:
- `add-customer-onboarding/SKILL.md`: the Tenancy check's `scope` branch;
- `add-multitenancy/SKILL.md`: the chooser's new guide row (below);
- `manage-scope/SKILL.md`: after the TS-A that follows ES-9's copy (`:797-799`).

ES statements are not machine-checked (no register file). The docs test that keeps the Tenancy
register equal to its JSON does not cover it, and a manual read-through check covers it
([Testing](#testing-strategy)). The ES-n rule says an `…n` statement retires by an `…m` successor.
When TD-17 is met, ES-17n is retired with a dated row and a spec of its own words its successor.

### O5 Rule R16 (Requirement 5, K-7 (a))

`tools/repo-check/lib/onboarding-key.mjs`, run over the checked set (the raw file and both views,
as R1):

| Code | Fails |
|---|---|
| `onboarding-key-public` | A file whose text contains `NEXT_PUBLIC_BUILDPAD_ONBOARDING_KEY`, anywhere, fenced or not |
| `onboarding-key-client` | A fenced code block whose first line that is neither blank nor a comment is `'use client'`, `"use client"`, `'use client';` or `"use client";` and that contains `BUILDPAD_ONBOARDING_KEY` or an import of `lib/onboarding/engine` |

- Each finding carries `rule: 'R16'`, the path and the line, as R15's do.
- The skills' own warnings say "never with a `NEXT_PUBLIC_` prefix", so no skill text needs the
  forbidden name.
- `CONTRIBUTING.md` is outside the checked set, so its R16 row may name it.
- `RULES` in `check.mjs` gains `'R16'`.
- `CONTRIBUTING.md` "What the check runs" gains the row: "R16 | A file that names the onboarding
  key with the `NEXT_PUBLIC_` prefix (`onboarding-key-public`); a fenced block marked
  `'use client'` that reads the key or imports the module that sends it (`onboarding-key-client`)".

### O6 Stage S4

| Stage | Opens when | Lands |
|---|---|---|
| **S4** | S2 released (TD-1), **and** TD-7 met (TD-14 and TD-15), **and** TD-16 met | `met` gains `TD-7`, which retires TS-N1 and makes TS-O1 live; the new skill; ES-17n; the Mode_Guide §13 and the changes to §1, §3 and §5; the folder passages; R16; the release |

S3 (TD-3) is not a condition. The flow works whether or not Releases exist on the Platform, and a
customer is created from the latest published Release in either case.

**R16 lands at S4 with its tests**, not before. Before S4, no file names the key, so the rule would
check nothing. Landing it with the skill keeps one MINOR release.

## The skill `add-customer-onboarding`

### Folder

| File | Kind | Holds |
|---|---|---|
| `add-customer-onboarding/SKILL.md` | front matter; the Gate; then Engine-only text | the Supabase stop (2.1); TS-A; the Tenancy check pointer; ES-17n in the `scope` branch; the Onboarding check (O2); TS-O1; the preconditions (2.3 to 2.6); the steps; the refusal table; links to the reference |
| `add-customer-onboarding/references/engine-customer-onboarding.instructions.md` | whole-file Engine (`<!-- buildpad-backend-file: engine -->`, then the Gate) | the code of [The Onboarding_Flow](#the-onboarding_flow-requirement-3) |

**Front matter:**
- `name: add-customer-onboarding`.
- `description: "Let strangers sign up, verify their email, create their own customer and land in
  it, on an Engine project with Customer_Tenants and Self-onboarding on."` It is true for both kinds
  of project because it names the kind (R11).

**Skill map row:** `{ folder: "add-customer-onboarding", dependence: "core", treatment: "Engine
only: on Supabase it says the flow needs an Engine project and stops; in the mode scope it says
workspaces are not available yet (ES-17n) and stops; in the mode customer-tenants it builds the flow
while Self-onboarding is on", size: "medium", plan: "EF" }`. The same row is added to
`.kiro/specs/backend-aware-skills/requirements.md`'s Skill map. A converted file and a change file
list the two new files (`"kind": "new-file"`), as "Add a skill" requires.

### `SKILL.md` order of work (Requirement 2)

1. **The Gate.** On Supabase, the shared text after the Gate says: "Customers that sign themselves
   up need a Buildpad Engine project with Customer tenants. Tell the developer so and stop." (2.1).
   Everything below is in one Engine passage.
2. **TS-A**, then: "Establish the tenancy mode with the `add-multitenancy` skill's Tenancy check."
   - In the mode `scope`: ES-17n; stop (2.1, 3.11).
   - In the mode `customer-tenants`: continue.
3. **The Onboarding check** (O2), then TS-O1. While the answer is `false`, TS-O1's off branch applies:
   tell the developer, and stop (2.2).
4. **Sign-in comes first.** If the app has no `lib/auth/tenants.ts` with `settleTenant`, build S2's
   sign-in first, with the `add-multitenancy` guide §5, then come back.
5. **Mail_Sender** (2.3, K-4). Look for a server function that sends one message (`sendMail`,
   `sendEmail`, a provider SDK client under `lib/`).
   - **Found:** wrap it as `sendMail({to, subject, text, html})` in `lib/mail/send.ts`.
   - **Not found:** ask: "Which mail provider sends this app's email (for example Amazon SES, Resend,
     Postmark, SendGrid)? It needs a verified sending domain, and its API key set in the app's server
     environment." With an answer, write `lib/mail/send.ts` for that provider with `import
     "server-only"`, reading its key from a server variable the developer names.
   - **No provider:** say "Verification mail needs a mail provider; this flow cannot be built without
     one" and stop.
6. **Bot check** (2.4, K-5).
   - **Found:** use the app's existing captcha.
   - **Not found:** ask which one the developer uses (for example Cloudflare Turnstile, hCaptcha,
     reCAPTCHA). Then write `lib/onboarding/human-check.ts` (`import "server-only"`) with
     `verifyHuman(token, address): Promise<boolean>` against that vendor's verify endpoint. Its
     secret goes in a server variable; its public site key may carry `NEXT_PUBLIC_`.
   - **No captcha:** stop with "The sign-up page needs a bot check; without one a script spends the
     project's sign-up budget and your mail provider's reputation".
7. **The key** (2.5): "The Buildpad platform sets `BUILDPAD_ONBOARDING_KEY` in the app's hosting
   when a project Admin turns sign-up on, or shows it once on the Customers page for another host.
   It is a server variable: never give it a `NEXT_PUBLIC_` prefix and never read it in a client
   component." The skill never opens an environment file to check it (TS-1).
8. **`amplify.yml`** (the Platform's A3 step). If the repository has an `amplify.yml` whose build
   commands lack `BUILDPAD_ONBOARDING_KEY`, add the Platform's exact line before the build command:

   ```yaml
           # Self-onboarding: the app's server reads the onboarding key at run time. Server only; never NEXT_PUBLIC_.
           - '[ -z "$BUILDPAD_ONBOARDING_KEY" ] || echo "BUILDPAD_ONBOARDING_KEY=$BUILDPAD_ONBOARDING_KEY" >> .env.production'
   ```

   Tell the developer that the app reads the key only after the next deployment. On another host,
   tell the developer to set it there as a server-only variable. `amplify.yml` is not an environment
   file, so TS-1 allows opening it.
9. **The Release and the Engine version** (2.6): "No customer can be created until the project has
   a published Release; the Engine answers 409 until then. Sign-up also needs the Engine release
   the Platform names on the Customers page; the Platform turns sign-up on only for a project that
   runs it." The skill reads neither fact. The refusal table maps the Engine's answers when either
   is missing.
10. **Build** the flow, as the reference file says.
11. **Review** against the `security-and-hardening` checks of [Folder passages](#folder-passages-requirements-1-and-4).

## The Onboarding_Flow (Requirement 3)

The guide is for the Next.js App Router with `@supabase/ssr` session cookies, as S2's sign-in is.

### Files the skill writes

| File | Server only | Holds |
|---|---|---|
| `lib/onboarding/engine.ts` | yes (`import "server-only"`) | the only reader of `BUILDPAD_ONBOARDING_KEY`; `signUp`, `resend`, `verify`, `createCustomer`; the answer mapping |
| `lib/onboarding/client-address.ts` | yes | `clientAddress(request)` |
| `lib/onboarding/human-check.ts` | yes | `verifyHuman` (step 6) |
| `lib/onboarding/mail.ts` | yes | the three messages, built with the app's URL |
| `lib/mail/send.ts` | yes | `sendMail` (step 5) |
| `app/api/onboarding/signup/route.ts` | route | 3.2 |
| `app/api/onboarding/resend/route.ts` | route | 3.4 |
| `app/api/onboarding/verify/route.ts` | route | 3.4 |
| `app/api/onboarding/customers/route.ts` | route | 3.6, 3.7 |
| `app/(auth)/sign-up/page.tsx` + `SignUpForm.tsx` (`'use client'`) | page | 3.2 |
| `app/(auth)/verify-email/page.tsx` + `VerifyEmail.tsx` (`'use client'`) | page | 3.3, 3.4 |
| `app/(auth)/create-company/page.tsx` + `CreateCompanyForm.tsx` (`'use client'`) | page | 3.6, 3.9 |
| `lib/auth/tenants.ts`, `app/api/auth/login/route.ts` (S2's) | changed | 3.5 |

No client component imports anything under `lib/onboarding/` except the plain text of
`lib/onboarding/messages.ts`, which holds no secret (3.10). R16 checks the guide's own blocks.

### The module that holds the key (3.1)

```ts
// lib/onboarding/engine.ts — server only. The one place that reads BUILDPAD_ONBOARDING_KEY.
import "server-only";

const ENGINE = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!; // the Engine_URL (ES-1)

function key(): string {
  const k = process.env.BUILDPAD_ONBOARDING_KEY;
  if (!k) throw new OnboardingError("not_configured", 500);
  return k;
}

export class OnboardingError extends Error {
  constructor(public kind: OnboardingErrorKind, public status: number, public retryAfter?: number) {
    super(kind);
  }
}

async function call(path: string, body: unknown, opts: { address?: string | null; bearer?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Buildpad-Onboarding-Key": key(),
  };
  if (opts.address) headers["X-Onboarding-Client-Address"] = opts.address;
  if (opts.bearer) headers["Authorization"] = `Bearer ${opts.bearer}`;
  // No Origin header (the Engine refuses one), no X-Tenant-Id (the key names the project).
  const r = await fetch(`${ENGINE}${path}`, {
    method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error",
  });
  if (r.ok) return { status: r.status, data: (await r.json()).data };
  throw await mapRefusal(path, r);
}

export const signUp = (email: string, password: string, address: string | null) =>
  call("/api/auth/signup", { email, password }, { address });
export const resend = (email: string, address: string | null) =>
  call("/api/auth/signup/resend", { email }, { address });
export const verify = (code: string, address: string | null) =>
  call("/api/auth/signup/verify", { code }, { address });
export const createCustomer = (accessToken: string, name: string, id: string) =>
  call("/api/onboarding/customers", { name, id }, { bearer: accessToken });
```

- **Answer shapes** (C-3 to C-5, C-7):
  - `signUp` and `resend` → `{existing: false, verification: {code, expires_at}}` or
    `{existing: true}`.
  - `verify` → `{identity: {id, email}}`.
  - `createCustomer` → `{id, name, state}`, 201, or 200 for the same person's retry.
- **`mapRefusal`** reads the status and `errors[0].extensions.code`, and gives one
  `OnboardingErrorKind` per row of [Refusals](#refusals-requirement-38). It reads the message only
  for the create route's 409s, which share a code. It records 429's `Retry-After` seconds.
- **Logs.** The module logs only the path, the status and the kind. It never logs the key, the
  code, the address, the email or the body.

### The client address (3.1, E-7 (b))

The Engine limits sign-up and resend to 5 per 15 minutes per reported address and key. **Without
the header, every request of the app shares one bucket of 5** (E 7.2 as built: "one shared address
of the key"), so a real app must send it.
- `clientAddress(request)` answers the address the hosting platform appended, never an entry the
  browser could have set.
- On Amplify Hosting, that is the last entry of `X-Forwarded-For` (assumption A-S1, checked in the
  dev run).
- It answers `null` unless the value is an IPv4 or IPv6 literal (C-9). With `null` the header is not
  sent, and the shared bucket applies.

The guide states this rule and the cost of skipping it.

### Sign-up (3.2)

`POST /api/onboarding/signup` takes `{email, password, humanToken}`:
1. Check that the body holds exactly these three strings, and that the password is 8 to 72 bytes,
   else 400.
   - 72 is the Engine's only rule (bcrypt).
   - 8 is the app's own floor. The Engine stores and enforces no policy (Issue 4 of entry 204).
2. Run `verifyHuman(humanToken, address)`; false → 400 "Please complete the check".
3. Call `signUp(email, password, address)`.
4. Mail, through `lib/onboarding/mail.ts`:
   - **`existing: false`:** "Confirm your email". The link is
     `${NEXT_PUBLIC_MICROAPP_URL_MAIN}/verify-email#code=${encodeURIComponent(code)}`, and the
     mail says it expires in 24 hours.
   - **`existing: true`:** "You already have an account". It links to the sign-in page and holds no
     code.
5. Answer `200 {ok: true}` in both cases. The page shows the same text either way: "Check your
   email. We sent a message to <address>." (E-5).

Rules the guide states:
- The link's base is the configured app URL (`NEXT_PUBLIC_MICROAPP_URL_MAIN`, the kit's), never the
  request's `Host`, so a forged host cannot point the mail elsewhere.
- The code travels in the fragment, so it reaches no server log and no `Referer`.
- If the mail fails, the route answers 502 "We could not send the email. Try again." The person
  retries with resend.

### Verify (3.3, 3.4)

- **The page** (`'use client'`):
  - It reads `location.hash` once, then calls `history.replaceState(null, "", "/verify-email")`, so
    the code leaves the address bar (3.3).
  - It posts `{code}` to `/api/onboarding/verify`.
  - Its `layout` or `metadata` sets `referrer: "no-referrer"`.
- **The route** calls `verify(code, address)`. On 200 the page says "Your email is confirmed. Sign
  in to create your company." and links to the sign-in page (K-6 (a)).
- **On `INVALID_TOKEN`** the page says "This link has expired or was already used." It offers a
  resend form (email only), which posts to `/api/onboarding/resend` and shows the same "Check your
  email" text whatever the answer.
- **Limits.** Verify has no per-address limit as built. Its only limit is 10 failures per 15
  minutes per key and reported address, refused before the code is checked. Sending the address
  keeps one person's typos from spending another's failures.

### Sign-in (3.5): two changes to S2's code

S2's login route and `settleTenant` stay as S2's design writes them, with two changes, written into
the Mode_Guide §5 and the reference file at S4:

1. **An unverified sign-in.** `signInWithPassword` answers the GoTrue error code
   `email_not_confirmed` (C-6; the Engine's `/auth/v1/token` answer). The login route maps it to
   403 `{error: "EMAIL_NOT_CONFIRMED"}`. The page says "Confirm your email first." and offers resend.
2. **An empty tenant list.** In an app that has this flow, `settleTenant`'s branch for
   `tenants.length === 0` no longer signs out with `NO_CUSTOMER`. It keeps the unbound session and
   answers `{create: true}`, and the login route sends the browser to `/create-company`. S2's
   `NO_CUSTOMER` answer stays for apps without the flow.

```ts
  if (tenants.length === 0) {                                     // belongs to no customer yet
    if (SELF_ONBOARDING) return { create: true as const };        // add-customer-onboarding
    await supabase.auth.signOut();
    return { error: "NO_CUSTOMER" as const };
  }
```

- `SELF_ONBOARDING` is a constant the skill sets to `true` in `lib/auth/tenants.ts` when it builds
  the flow. It is never read from the environment or the request.
- The chooser (several tenants) gains a "Create another company" link to `/create-company`. The app
  cannot read the project's `per_identity`, so the link is always shown, and a 409 at the limit
  explains itself (3.5, 3.8).
- **The unbound session's routes.** S2's rule names four app routes that may use an unbound
  session: login, tenants, switch and decline. S4 adds a fifth, `/api/onboarding/customers`, which
  sends the unbound session's access token to `POST /api/onboarding/customers` only. The Engine
  admits an unbound token there (the route is in its `unboundTokenRoutes`).

### Create your company (3.6, 3.7, 3.9) and the template-copy lock

- **The page** (`/create-company`, a server component):
  - With no session, it redirects to sign-in.
  - With a session already bound to a customer, it shows "Create another company".
  - Otherwise it renders `CreateCompanyForm`.
- **The form** keeps one `requestId` (`crypto.randomUUID()`) in `sessionStorage` for the name it
  submits. The id is reused until the creation succeeds or the name changes, so a reload or a
  second click retries the same creation.
- **The route** `POST /api/onboarding/customers` takes `{name, id}`:
  1. The body must be exactly two strings: `name` of 1 to 100 characters after trimming, and `id` a
     UUID. Otherwise 400.
  2. It reads the person's access token from the session (`supabase.auth.getSession()`). With none,
     it answers 401.
  3. It calls `createCustomer(token, name, id)`. It sends no administrator, email or template
     (3.7, E 4.4): the person is the administrator because the token is theirs.
  4. **On 503** (C-11) it waits 2 seconds and calls again once with the same `id`. A second 503
     answers `503 {retry: true, id}`.
  5. On 201 or 200, it runs `switchTenant(token, created.id)`, then `supabase.auth.setSession` with
     the answered pair, as TS-B says. It answers `{tenant: {id, name}}`.
- **The form on `503 {retry: true}`** says "Creating your company is taking longer than usual…" It
  posts again with the same `id` after 5 seconds, then after 10 seconds. After three tries in all it
  shows "We are busy creating other companies. Try again in a minute." and keeps the id and the
  name for the person's own retry.
- **Bounds.** The longest the person waits is about 30 seconds of retries, plus the Engine's 10
  second deadline per attempt. No single route call exceeds about 25 seconds: two Engine attempts
  and one 2-second wait. That stays within a hosted route's time limit.
- **Why the same id is safe.** The Engine answers 200 with the existing customer when the same
  person retries the same `id` with the same name, and 409 for anyone else's (E 4.8). A retry can
  therefore neither make two companies nor take someone else's.
- **After success** the browser loads `/` (`window.location.assign`), so every cache starts in the
  new customer, as S2's switch does. The layout shows the customer's name from the session (3.9,
  TS-5).

**Why the app retries:** the Engine copies every customer from the Blueprint under one engine-wide
lock, at about one a second. A burst of sign-ups queues behind it, and a creation that waits past
10 seconds answers 503 without creating anything half-way. The per-key creation budget (20 an hour
by default) keeps an ordinary app far below the lock's rate. The guide says this in two sentences,
so the developer does not mistake the 503 for an outage.

**The Mode_Guide §3 exception (1.3):** "Never create a customer from code, except through the
`add-customer-onboarding` skill's route, with the person's own session." The same sentence in
`add-multitenancy/SKILL.md` (`:102-104`, "and never create a customer from code") gains the same
exception: the requirements name only the Mode_Guide, and the chooser repeats it. The §3 rule
"never take a tenant id from user input" gains: "the id a person's own creation chose, which the
Engine accepts only for that person's own retry, is not such an input".

### Refusals (Requirement 3.8)

The guide's table, keyed by the Engine's status and code. The person-facing text never repeats the
Engine's message.

| Route | Engine answer | Cause | The page says | Next |
|---|---|---|---|---|
| any | 401 `TOKEN_INVALID` | The key is missing, unknown or revoked (on the create route it may also be an expired session: the route refreshes the session once and retries before treating it as the key) | "Sign-up is not available right now." | Log `onboarding.key_invalid` for the developer; no retry |
| any | 403 `FORBIDDEN` on sign-up, resend or verify | Sign-ups are turned off (Stop sign-ups or turned off) | "Sign-ups are closed right now." | No retry |
| any | 404 | The project's Engine is older than the release that serves sign-up | "Sign-up is not available right now." | Log `onboarding.engine_too_old`; the developer asks the project Admin |
| any | 429 `REQUESTS_EXCEEDED` | A budget: per key, per address, resend per person, or verify failures | "Too many attempts. Try again in N minutes." (from `Retry-After`) | After `Retry-After` |
| signup, resend | 400 `INVALID_PAYLOAD` | A malformed address or a password over 72 bytes | "Enter a valid email address." / "Use a shorter password." | The person corrects it |
| verify | 400 `INVALID_TOKEN` | The code is unknown, used or expired | "This link has expired or was already used." | Resend |
| login | GoTrue `email_not_confirmed` | Not yet verified | "Confirm your email first." | Resend |
| customers | 401 `UNAUTHENTICATED` | No session | (redirect) | Sign in |
| customers | 403 `FORBIDDEN` | Sign-ups are off (or, rarely, the person is not verified) | "Creating companies is closed right now." | No retry |
| customers | 403 `QUOTA_EXCEEDED` | The project's customer limit is reached | "Sign-ups are full right now. Contact <app>'s team." | No retry |
| customers | 409 `CONFLICT`, message `MsgOnboardingNoRelease` | No published Release yet | "Companies cannot be created yet. Try again later." | Log `onboarding.no_release` |
| customers | 409 `CONFLICT`, message `MsgOnboardingPerIdentity` | The person's company limit (`per_identity`) | "You have reached the number of companies you can create." | No retry |
| customers | 409 `CONFLICT`, message `MsgOnboardingIDTaken` | The id belongs to another tenant | (never seen by a person: the form makes a new id and resubmits once) | New id, once |
| customers | 503 `SERVICE_UNAVAILABLE` | The template-copy lock's deadline | "Creating your company is taking longer than usual…" | Same id: 2 s (route), 5 s, 10 s (form) |
| any | 5xx other, or no answer | The Engine is down | "Something went wrong. Try again." | The person retries |

- The three 409s on the create route share the code `CONFLICT` and carry no `extensions`
  (`customer_handler.go:74-81` as built). The module tells them apart by the Engine's message:
  - "This project has no published release yet" → no Release (`MsgOnboardingNoRelease`);
  - "You have reached the limit of" → the company limit (`MsgOnboardingPerIdentity`);
  - "Another customer already has that id." → the id (`MsgOnboardingIDTaken`).

  Each is matched by a fixed prefix. Any other 409 shows "We could not create your company. Try
  again later." The message is never shown to the person.
- This is the one place the guide reads an Engine message, and the guide says why (Issue 5).

## The mode `scope` (K-10, Requirement 3.11)

While TD-17 is unmet:
- the skill's `scope` branch is ES-17n, and the agent stops;
- the chooser in `add-multitenancy/SKILL.md` gains, after its table, the scale-and-isolation guide
  K-10 promised. Its first sentence is: "Many small workspaces (thousands), where shared tables are
  acceptable and each workspace's owner manages only their own people, fit scope nodes; customers
  that need their data kept apart, their own administrators, or fewer than the project's quota fit
  Customer_Tenants." ES-17n follows it.

When TD-17 is met, a spec of its own designs 3.11:
- "create your workspace" on `POST /api/onboarding/workspaces`;
- the owner's member screen over the Engine's scoped administration;
- the current workspace read from the person's role at the node.

## The Mode_Guide

| § | Change at S4 |
|---|---|
| 1 Status | Adds: "Customers that sign themselves up: available while the project's Self-onboarding is on (section 13)." |
| 3 Never | The two exceptions above (1.3) |
| 4 Not available | TS-N1 and its "Who could offer it later" line removed (`ts-retired`); nothing added (S-2 (b)) |
| 5 Signing in | The two changes to sign-in (`email_not_confirmed`; `settleTenant`'s empty branch); the fifth unbound route |
| 11 Debugging (S2) | The rows of [Debugging](#folder-passages-requirements-1-and-4) |
| 12 Review (S2) | The security checks of 4.1 |
| **13 Customers who sign themselves up** (new) | TS-O1; the line of 1.4; "Build it with the [`add-customer-onboarding`](../../add-customer-onboarding/SKILL.md) skill." |

Under S-2 (a), §13's text would stand in §4 instead, and §1 would point to §4.

## Folder passages (Requirements 1 and 4)

Each passage is Engine-only text, inside the existing Engine passage or a new one directly after
it. Mode-specific prose says "In the mode `customer-tenants`" and never uses the reserved opening.

| File | Place (`0f667fb`) | Change |
|---|---|---|
| `add-multitenancy/SKILL.md` | `:109` (TS-N1) | TS-O1 in its place; the chooser's guide and ES-17n after the limits paragraph (`:92-94`); the exception at `:102-104` |
| `add-users/SKILL.md` | `:178` (TS-N1) | TS-O1 in its place; then "In the mode `customer-tenants` with Self-onboarding on, people who sign themselves up are built with the `add-customer-onboarding` skill; inviting further people into a customer stays here." (4.2) |
| `authentication-proxy/SKILL.md` | after the ES-5 copy (`:67`) | "In the mode `customer-tenants` with Self-onboarding on, sign-up is available through the `add-customer-onboarding` skill, which replaces ES-5's 'sign-up' for that project only (K-8)." (4.2) |
| `authentication-proxy/references/authentication-proxy.instructions.md` | after the ES-5 copy (`:88`) | the same sentence |
| `security-and-hardening/SKILL.md` | Ask First (`:83`); Authentication checklist (`:223`) | `:83` gains "(except, in the mode `customer-tenants` with Self-onboarding on, the `add-customer-onboarding` skill's flow)". `:223` gains the same exception, and three checks after it: "- [ ] `BUILDPAD_ONBOARDING_KEY` is read only in one server-only module, never with a `NEXT_PUBLIC_` prefix and never in a client component"; "- [ ] The sign-up route checks the bot-check token before it calls the Engine"; "- [ ] The sign-up page shows the same text for a new and an existing address" (4.1) |
| `references/security-checklist.md` | §DaaS-Specific Security Engine passage (S2's place, engine@185-192) | the same three checks |
| `agents/security-auditor.md` | `:84` (the ES-5 list) and §5 (S2's place) | the exception; the three checks |
| `debugging-and-error-recovery/SKILL.md` | the Engine tree (S2's place, `:180-196`) | rows (4.3): "signs up but no email → the app's Mail_Sender failed or the provider's domain is not verified → the mail provider's logs"; "every sign-up 401 TOKEN_INVALID → the key is missing, revoked, or not in `.env.production` → the Customers page's key list (last use) and the `amplify.yml` line"; "sign-ups 429 after five → no `X-Onboarding-Client-Address`, so all share one bucket → send the address"; "create 503 → the template-copy lock → retry with the same id"; "create 409 before creating → no published Release → the Platform's Releases panel" |

**Criterion 4.3 names `buildpad-debug`'s table.** At `0f667fb`, `buildpad-debug/SKILL.md` has no
table of Engine answers: its only table is "Rationalization | Reality" (`:132-137`). The Engine's
answers and their causes live where S2 put them, in `debugging-and-error-recovery`'s Engine tree
and the Mode_Guide §11, and in the new skill's own Refusals table. The rows therefore go there.
`buildpad-debug` is unchanged (Issue 2).

## Repository_Check

### R15 at S4
- `tenancy-statements.json`:
  - `met` gains `"TD-7"`;
  - `dependencies["TD-7"]` is restated as "An app's server can create a customer for a verified
    person (Engine entry 204 and the Platform's customer-self-onboarding)";
  - TS-O1 is added (O3).
- R15 then fails any file still holding TS-N1 (`ts-retired`), and any file of TS-O1's `in` lacking it
  (`ts-required-missing`).
- `CONTRIBUTING.md` "Tenancy statements" gains the TS-O1 row. TS-N1's row stays, with its *When*
  unchanged, as TS-N0's does after S2.
- `docs.test.mjs` keeps the JSON and the register equal.

### R16
As O5. `check.mjs` imports `onboardingKeyFindings` and adds it after R15.

## Companion contract relied on

**Engine entry 204, as built** (`7ad36743`):

| Row | Contract | Used by |
|---|---|---|
| C-2 | Header `X-Buildpad-Onboarding-Key`; a request with an `Origin` header is 403; no CORS; a key in the query string is 401 | `engine.ts` |
| C-3 | `POST /api/auth/signup` `{email, password}` (exactly) → 200 `{existing: false, verification: {code, expires_at}}` or `{existing: true}`. The code is 32 random bytes in base64url (43 characters) and lives 24 hours | Sign-up; the link |
| C-4 | `POST /api/auth/signup/verify` `{code}` → 200 `{identity: {id, email}}`; 400 `INVALID_TOKEN` | Verify |
| C-5 | `POST /api/auth/signup/resend` `{email}` → as C-3; earlier codes are spent | Resend |
| C-6 | Password sign-in of an unverified identity → 400 `EMAIL_NOT_CONFIRMED` (`/api/auth/login`) or GoTrue `email_not_confirmed` (`/auth/v1/token`); once verified, an unbound session with no tenant | Sign-in |
| C-7 | `POST /api/onboarding/customers` `{name, id?}`, the key and the person's bearer → 201 `{id, name, state}`, 200 for the same person's retry; refusals as in [Refusals](#refusals-requirement-38) | Create |
| C-8 | `POST /api/auth/tenant` `{tenant}` switches, unchanged | Create |
| C-9 | `X-Onboarding-Client-Address`: an IP literal, optional; without it, one shared address per key | `client-address.ts` |
| C-11 | One engine-wide template-copy lock; 503 past 10 s, safe to retry with the same id | Create |
| E 7.x | Sign-up and resend: 5 per 15 minutes per address each. Resend: 3 an hour per identity. **Verify: no per-address limit; 10 failures per 15 minutes per key and address** (criterion 7.2 amended, confirmed 2026-11-09). Per key: 200 sign-ups and resends an hour; 20 creations an hour, 200 a day | Refusals; client address |
| Routes | The sign-up routes take no bearer: an unbound session sent there is 403 from the tenant binder. Only `/api/onboarding/customers` takes the person's session | `engine.ts` (no bearer on three routes) |

**The Platform's design** (`221dbdd7`):

| Row | Contract | Used by |
|---|---|---|
| P-S1 | `.buildpad/project.json` gains `selfOnboarding: true\|false` in every Engine kit after the change. `true` means the Platform's state is `on` or `stopped` | O1, O2 |
| P-S2 | `get_project_detail` → `project.self_onboarding` | Not used (S-1 (a)) |
| P-S3 | The variable `BUILDPAD_ONBOARDING_KEY`, written by the Platform into the chosen Amplify app (its D-3), never `NEXT_PUBLIC_` | Step 7 |
| P-S4 | The kit's `amplify.yml` carries the guarded line; older repositories need it added; the panel shows it | Step 8 |
| P-S5 | The Engine kit's `.env.local` carries `BUILDPAD_ONBOARDING_KEY=` empty under a server-only comment | Step 7 |
| P-S6 | Sign-up is offered only for a project whose Engine is at least `ENGINE_SELF_ONBOARDING_MIN_VERSION` | Step 9; the 404 row |

## Release plan

**S4, one MINOR release** (K-9; 6.1). The version is the next MINOR after S2's release, or after
S3's if that comes first.
1. **Gate task:**
   - S2 released;
   - entry 204 merged and released, its contract rows reconciled with the released build;
   - the Platform's change shipped and switched on in one environment (TD-15);
   - `selfOnboarding` present in a kit downloaded there (TD-16).

   Each is recorded as a dated, approved amendment of the Dependencies.
2. R16 and its tests, test first.
3. The register (TS-O1, `met`), so R15 names every file to change.
4. The new skill folder, the Mode_Guide, the folder passages.
5. Skill map row, README catalogue, converted file and change file.
6. `CHANGELOG.md`: "TS-N1 retired: customers can sign themselves up on an Engine project with
   Customer tenants and Self-onboarding on. New skill `add-customer-onboarding`. New check R16."
7. `customer-tenant-skills` task 12.2 ticked, citing the release (6.2).

## Requirements Traceability

| Criterion | Where |
|---|---|
| 1.1 | R15 at S4 (`met`); O6 |
| 1.2 | O3 (text and `in`); S-2 |
| 1.3 | Create your company (the §3 exception and its copy) |
| 1.4 | O3 (the line after it); The Mode_Guide §13 |
| 1.5 | O3 (TS-N1 unchanged until `met`); O6 |
| 2.1 | Skill order of work 1 and 2; ES-17n |
| 2.2 | O1, O2; order of work 3; S-1 |
| 2.3 | Order of work 5 |
| 2.4 | Order of work 6 |
| 2.5 | Order of work 7 |
| 2.6 | Order of work 9 |
| 3.1 | The module that holds the key; the client address |
| 3.2 | Sign-up |
| 3.3, 3.4 | Verify |
| 3.5 | Sign-in: two changes |
| 3.6, 3.7, 3.9 | Create your company |
| 3.8 | Refusals |
| 3.10 | Files the skill writes; R16 |
| 3.11 | The mode `scope` (ES-17n until TD-17) |
| 4.1 | Folder passages (`security-and-hardening`, checklist, auditor) |
| 4.2 | Folder passages (`authentication-proxy`, `add-users`) |
| 4.3 | Folder passages (debugging); Issue 2 |
| 5.1 | O5; Testing |
| 5.2 | R15 at S4 |
| 6.1, 6.2 | Release plan |

## Testing Strategy

### Repository_Check tests (`node --test "tools/repo-check/test/*.test.mjs"`), written first
- **`onboarding.test.mjs`** (new):
  - the public name in prose fails, and in a fenced block fails;
  - `'use client'` blocks fail when they read the key, with each of the four spellings, and with a
    leading comment line;
  - a `'use client'` block that imports `lib/onboarding/engine` fails;
  - a server block that reads the key passes, and a client block without the key passes;
  - the finding names R16, the path and the line.
- **`tenancy.test.mjs`** (extended):
  - with `TD-7` in `met`, a file holding TS-N1 fails `ts-retired`;
  - each file of TS-O1's `in` without it fails `ts-required-missing`;
  - TS-O1 altered by one word fails `ts-altered`;
  - without `TD-7`, TS-O1 anywhere fails `ts-held-back`.
- **`docs.test.mjs`:** the TS-O1 row equals its JSON text.
- **`guard.test.mjs`:** TS-O1, ES-17n, the Onboarding check and the reference file's code hold no
  §C20 pattern and no marker token.
- **`map.test.mjs` and `readme.test.mjs`:** the new folder's row and catalogue entry.
- **Whole check at the S4 commit:** `node tools/repo-check/check.mjs` reports nothing.

### Manual read-through (no agent is run)
- As a Supabase agent: the skill stops at its first paragraph.
- In the mode `scope`: ES-17n, then stop.
- With `selfOnboarding: false`: TS-O1's off branch, then stop.
- With it true and no mail provider: stop at step 5.
- With everything present: the pages and routes are built, and no client file names the key.
- ES-17n is word for word in its three places (not machine-checked).

### Dev run (with the Platform's dev run and a dev Engine serving entry 204)
1. Download a kit after turning sign-up on, and check `selfOnboarding: true`.
2. Have an agent follow the skill on a fresh Next.js kit with a test mail provider and a test
   captcha.
3. Deploy, and confirm the `amplify.yml` line made the key readable: the key shows a last use on the
   Platform.
4. Sign up, receive the mail, open the link (the code leaves the address bar), sign in, create a
   company, and land in it.
5. Sign up again with the same address: the same page text, and a "you already have an account"
   mail.
6. Sign in unverified: "Confirm your email first".
7. Create a burst of companies from several accounts at once: some answer 503 and complete on retry
   with the same id. No company is made twice.
8. **A-S1:** compare `X-Forwarded-For` on Amplify Hosting with the real client address. If the last
   entry is not the client, correct `clientAddress` and the guide before release.

## Design choices

- **A record file of its own** (O1), not a member of `tenancy-answer.json`: the Tenancy check
  rewrites that file byte for byte.
- **The code in the URL fragment**, not the query: it reaches no server log, proxy log or `Referer`.
- **The app's URL from configuration**, not the `Host` header: a forged host cannot redirect the
  link.
- **Retries split between the route and the form:** this keeps every route call under a hosted
  route's time limit while still covering a 30-second queue.
- **`SELF_ONBOARDING` as a constant in code:** the app's runtime never reads the kit's signal or the
  environment to decide a branch about its own customers.
- **R16 lands with the skill** at S4, not before.

## Issues found

1. **S-1:** K-3's `get_project_detail` step against the Tenancy check's rule.
2. **Criterion 4.3's `buildpad-debug` table does not exist.** The rows go to
   `debugging-and-error-recovery` and the Mode_Guide §11, where S2 put the Engine's answers.
3. **The shared address bucket.** Without `X-Onboarding-Client-Address`, an app's sign-ups are
   limited to 5 per 15 minutes in total. The header is optional in the Engine's contract and
   practically required. The guide says so, and A-S1 must hold on Amplify Hosting.
4. **The app cannot read `per_identity`,** so "Create another company" is always shown, and the 409
   explains the limit (3.5 asked for it "where the project's `per_identity` allows it").
5. **The create route's three 409s share one code and carry no `extensions`.** The module tells
   them apart by fixed prefixes of the Engine's messages, which makes those messages part of the
   contract. An Engine code (or an `extensions.reason`) per refusal would remove this. It is
   recorded for a later Engine entry, and the gate task reconciles the three prefixes against the
   released build.
6. **No password strength rule** exists in the Engine (entry 204's Issue 4). The app keeps its own
   floor of 8 characters on sign-up only.
