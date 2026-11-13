# Implementation Plan

> Phase 3 of the gated spec `customer-self-onboarding` (skills repository part), from the approved
> `requirements.md` (6 requirements; K-1 to K-10 settled; criteria 1.2 and 2.2 amended 2026-11-09 by
> S-2 (b) and S-1 (a)) and the approved `design.md` (approved 2026-11-09, "Approve as
> recommended"). **Generated 2026-11-09; approved by the user on 2026-11-09 ("Approve tasks").**
>
> **Names.** Stage S4 (design O6). Statements TS-O1 (O3) and ES-17n (O4). The Onboarding check (O2)
> and its record `.buildpad/onboarding-answer.json` (O1). Rule R16 and its codes (O5). Mode_Guide
> §1 to §13. Contract rows C-n (Engine entry 204 as built, `7ad36743`) and P-Sn (the Platform's
> design, `221dbdd7`). Line numbers are the design's, at `0f667fb`. If `main` moves before a task
> starts, and S2 will move it, find each place by its anchor text, not by its line number.
>
> **One stage, one gate.** Every task below is S4. Task 1 is its gate, and no other task starts on
> the integration branch before it is met. Writing tests (task 2) may start earlier on a branch of
> its own, because R16's tests touch no skill text.
>
> **Merge order (binding).** S4 lands on `main` as **one pull request** from an integration branch
> (`feat/customer-self-onboarding-s4`, cut from `origin/main` after S2's release). The order is:
> 1, then 2, then 3, then 4, then 5 to 7 in any order, then 8 and 9. Adding `TD-7` to `met` (task
> 3.1) makes R15 fail every file that still holds TS-N1 and every file of TS-O1's `in` that lacks
> it, until tasks 4 to 6 are done. So `node tools/repo-check/check.mjs` exits 0 only at the end of
> the branch, as with S1. Each sub-task proves itself locally with the commands in its Done-when
> line.
>
> **Rules for every text sub-task (4.x to 7.x).** These are `customer-tenant-skills`' T-1 to T-5 as
> they apply here:
> - **T-1. Statements.** Copy TS-O1 verbatim from `tools/repo-check/tenancy-statements.json`, and
>   ES-17n verbatim from `CONTRIBUTING.md`. Each stands as a paragraph of its own, not in a list
>   item, a table cell or a fence. Never write the reserved opening "On an Engine project with
>   Customer_Tenants" in any other sentence; mode-specific prose says "In the mode
>   `customer-tenants`".
> - **T-2. Engine only.** Every new text stands in Engine-only text: an `engine` passage, a file
>   marked `engine`, or the new skill's Engine passage. The new skill's Supabase stop (design, order
>   of work 1) is its one shared sentence.
> - **T-3. TS-A.** The new `SKILL.md` carries TS-A after its Gate (I-G). The changed folders already
>   carry it.
> - **T-4. Never the key's public name.** No text writes the onboarding key's name with the
>   `NEXT_PUBLIC_` prefix. Warnings say "never with a `NEXT_PUBLIC_` prefix" (R16).
> - **T-5. Supabase views.** Only task 7.1 adds files to `converted/` and `supabase-view-changes/`
>   (the new skill). Every other text sub-task leaves both unchanged.
> - **FT (folder done):**
>   - `node --test "tools/repo-check/test/*.test.mjs"` passes;
>   - `node tools/repo-check/check.mjs --only R1,R2,R3,R4,R5,R6a,R6b,R7,R8,R9,R10,R11,R12,R14,R16`
>     exits 0;
>   - `node tools/repo-check/check.mjs --only R15 | grep ' <folder>/'` prints nothing;
>   - a read-through of `node tools/repo-check/check.mjs --render <out>` for that folder's Engine
>     view, recorded with reader, date and commit.

## Tasks

- [ ] 1. Gate: S4 opens
- [ ] 1.1 Dependencies met and reconciled
  - Each holds, and is recorded as a dated, approved amendment of `requirements.md`'s Dependencies:
    - **TD-1:** `customer-tenant-skills` S2 released (its task 10.8), so TS-B, Mode_Guide §5,
      `settleTenant` and the S2 debugging and review places exist on `main`.
    - **TD-14:** Engine entry 204 merged and released. Contract rows C-2 to C-9, C-11 and E 7.x are
      reconciled against the released build, including the three 409 message prefixes the
      Refusals table matches (design Issue 5) and the GoTrue `email_not_confirmed` answer.
    - **TD-15:** the Platform's `customer-self-onboarding` shipped and switched on in at least one
      environment (its task 12.2).
    - **TD-16:** `selfOnboarding` is present in a kit downloaded there (P-S1), and the kit's
      `amplify.yml` line is exactly the text task 5.2 copies (P-S4).
  - Done when the amendment is committed and names each release, commit and kit checked. **If a
    contract row differs**, amend design.md (dated) and the task it changes before going on.
  - **Blocked until** all four hold.
  - **Where they stand, 2026-11-14:**
    - TD-1: met. S2 was released as v9.2.0 (its task 10.8 box on `main` is not ticked).
    - TD-14: entry 204 merged (`buildpad-daas-go` PR #43, `da47c362`). Released, as far as can be
      read here: v9.3.0 names Engine 0.1.0-dev.25 (data service `2026.11.13`), which carries
      entry 207, merged after 204 and 205. Its contract rows are still to be reconciled.
    - TD-15: not met. The Platform's self-onboarding is merged to `main` and `release/dev`, and
      dev was deploying on 2026-11-14, but `ENGINE_SELF_ONBOARDING_MIN_VERSION` is set nowhere.
    - TD-16: not met (follows TD-15).
  - _Requirements: 6.1; Dependencies_
- [ ] 1.2 A-S1 on Amplify Hosting
  - On the Platform's dev app (or any Amplify Hosting Next.js app), log `X-Forwarded-For` on a
    server route against the caller's known address, with a client that sends a forged
    `X-Forwarded-For` of its own.
  - Done when the design names which entry is the client's as the host appended it, and task 5.2's
    `clientAddress` text matches. If no entry is reliable, the design says to send no header, and
    the guide states the shared budget's cost (design Issue 3).
  - _Requirements: 3.1_

- [x] 2. Rule R16 (tests first)
- [x] 2.1 R16's tests
  - New `tools/repo-check/test/onboarding.test.mjs`, written before the rule, as the design's
    Testing Strategy lists:
    - the public name in prose fails, and in a fence fails;
    - a `'use client'` block reading the key fails, for each of the four spellings and with a
      leading comment line;
    - a `'use client'` block importing `lib/onboarding/engine` fails;
    - a server block reading the key passes, and a client block without it passes;
    - each finding names R16, the path and the line.
  - Done when the tests run and fail for the missing rule.
  - _Requirements: 5.1_
- [x] 2.2 R16
  - `tools/repo-check/lib/onboarding-key.mjs` (`onboardingKeyFindings(textFiles)`), using
    `lib/markdown.mjs` for fenced blocks. `check.mjs`: `RULES` gains `'R16'`, and the rule runs
    after R15. `CONTRIBUTING.md` "What the check runs" gains the R16 row (O5); its header says
    "R1 to R16".
  - Done when `node --test tools/repo-check/test/onboarding.test.mjs` passes and
    `node tools/repo-check/check.mjs --only R16` exits 0 on the branch.
  - **Built 2026-11-14** on `feat/customer-self-onboarding-r16` (cut from `origin/main` `5bd3425`,
    with the spec branch merged in), held for the S4 integration pull request as O6 says. The CLI
    test that named R16 as unknown now names R17, and a CLI test for R16 is added. All 241
    repo-check tests pass; the full check exits 0. `CONTRIBUTING.md` has no "R1 to R15" header to
    change; the rule table gains R16's row.
  - _Requirements: 5.1_

- [ ] 3. Register
- [ ] 3.1 TS-O1 and `met`
  - `tools/repo-check/tenancy-statements.json`: TS-O1 with `requires: ["TD-7"]`, `until: []`, its
    text (O3) and its `in` (O3's four files); `dependencies["TD-7"]` restated as the design says;
    `met` gains `"TD-7"`.
  - `CONTRIBUTING.md` "Tenancy statements": the TS-O1 row. TS-N1's row is unchanged.
  - `tenancy.test.mjs`, tests first:
    - with `TD-7` met, a file holding TS-N1 fails `ts-retired`;
    - each `in` file without TS-O1 fails `ts-required-missing`;
    - TS-O1 changed by one word fails `ts-altered`;
    - without `TD-7`, TS-O1 anywhere fails `ts-held-back`.
  - Done when `node --test tools/repo-check/test/tenancy.test.mjs tools/repo-check/test/docs.test.mjs`
    passes. `check.mjs --only R15` then lists exactly TS-N1's three files and TS-O1's four files,
    which tasks 4 to 6 clear.
  - _Requirements: 1.1, 1.2, 1.5, 5.2_
- [ ] 3.2 ES-17n
  - `CONTRIBUTING.md` "Engine statements": the ES-17n row after ES-16 (O4).
  - `guard.test.mjs` gains TS-O1 and ES-17n: no §C20 pattern and no marker token.
  - Done when `node --test tools/repo-check/test/guard.test.mjs` passes.
  - _Requirements: 2.1, 3.11 (until TD-17)_

- [ ] 4. The Mode_Guide (`add-multitenancy/references/engine-customer-tenants.instructions.md`)
- [ ] 4.1 §1, §3, §4 and §13
  - §1 Status: the sentence pointing to §13.
  - §3 Never: the two exceptions. "Never create a customer from code, except through the
    `add-customer-onboarding` skill's route, with the person's own session" (1.3), and the
    sentence about the id a person's own creation chose.
  - §4: TS-N1 and its "Who could offer it later" line removed.
  - New §13 "Customers who sign themselves up": TS-O1, the 1.4 line, and the link to the skill's
    `SKILL.md` (S-2 (b), criterion 1.2 as amended).
  - Done when FT holds for `add-multitenancy`, and R15 lists nothing for this file.
  - _Requirements: 1.2 to 1.4_
- [ ] 4.2 §5 sign-in, §11 debugging, §12 review (S2's sections)
  - §5:
    - the login route's `email_not_confirmed` → 403 `EMAIL_NOT_CONFIRMED` mapping, with resend;
    - `settleTenant`'s empty-list branch with `SELF_ONBOARDING`, exactly as the design's block;
    - the chooser's "Create another company" link;
    - the fifth route an unbound session may use.
  - §11: the five debugging rows of the design's Folder passages.
  - §12: the three security checks.
  - Done when FT holds for `add-multitenancy`.
  - _Requirements: 3.5, 4.1, 4.3_

- [ ] 5. The new skill `add-customer-onboarding`
- [ ] 5.1 `SKILL.md`
  - Front matter as the design's Folder section. Then:
    - the Gate (byte copy of `tools/repo-check/gate.md`);
    - the Supabase stop;
    - one Engine passage holding TS-A, the Tenancy check pointer, ES-17n for the mode `scope`, the
      Onboarding check (O2, written once here), TS-O1, and the order of work steps 4 to 11 with
      their exact sentences;
    - the Refusals table;
    - a link to the reference file.
  - Done when FT holds for `add-customer-onboarding` (R5 and R14 for its front matter; R15 lists
    nothing for it).
  - _Requirements: 1.2, 2.1 to 2.6, 3.8, 3.11_
- [ ] 5.2 `references/engine-customer-onboarding.instructions.md`
  - `<!-- buildpad-backend-file: engine -->`, the Gate, then the flow as the design writes it:
    - the files table;
    - `lib/onboarding/engine.ts` (the block of "The module that holds the key", with `mapRefusal`'s
      table);
    - `clientAddress` as task 1.2 settled it;
    - `verifyHuman`'s interface, and `sendMail`'s;
    - the four routes and three pages, each with its `'use client'` marking where it is client
      code;
    - the code in the fragment, and the app URL from `NEXT_PUBLIC_MICROAPP_URL_MAIN`;
    - the two changes to S2's sign-in;
    - the create route's same-id retry (once after 2 s in the route; 5 s and 10 s in the form), and
      the two sentences on the template-copy lock;
    - the `amplify.yml` line, copied from the Platform's template (task 1.1).
  - Done when FT holds, `check.mjs --only R16` exits 0 (no client block reads the key or imports the
    module), and a read-through confirms every Engine path and member against task 1.1's
    reconciliation.
  - _Requirements: 3.1 to 3.10_
- [ ] 5.3 Folder registration
  - `tools/repo-check/skill-map.json`: the design's row. The same row goes in
    `.kiro/specs/backend-aware-skills/requirements.md`'s Skill map, with its Counts line updated.
  - `tools/repo-check/converted/add-customer-onboarding`.
  - `tools/repo-check/supabase-view-changes/add-customer-onboarding.json`: two `new-file` entries,
    `"release": "unreleased"` until task 9.
  - README catalogue: one entry with the front matter's description.
  - Done when `node --test tools/repo-check/test/map.test.mjs tools/repo-check/test/readme.test.mjs`
    passes and `check.mjs --only R4,R7,R11,R13` exits 0.
  - _Requirements: 6.1_

- [ ] 6. TS-O1 in the chooser and `add-users`
- [ ] 6.1 `add-multitenancy/SKILL.md`
  - TS-N1 (`:109`) replaced by TS-O1.
  - The "never create a customer from code" sentence (`:102-104`) gains the 1.3 exception.
  - After the limits paragraph (`:92-94`): the scale-and-isolation guide (K-10), then ES-17n.
  - The Tenancy check copy is untouched (R15 `tenancy-check-altered`).
  - Done when FT holds for `add-multitenancy`.
  - _Requirements: 1.2, 1.3, 3.11_
- [ ] 6.2 `add-users/SKILL.md`
  - TS-N1 (`:178`) replaced by TS-O1, then the 4.2 sentence.
  - Done when FT holds for `add-users`.
  - _Requirements: 1.2, 4.2_
- [ ] 6.3 `manage-scope/SKILL.md`
  - ES-17n after the TS-A that follows ES-9's copy (`:797-799`).
  - Done when FT holds for `manage-scope`.
  - _Requirements: 3.11 (until TD-17)_

- [ ] 7. The skills that speak of sign-up
- [ ] 7.1 `authentication-proxy` (both files)
  - After each ES-5 copy (`SKILL.md:67`, `references/authentication-proxy.instructions.md:88`): the
    K-8 sentence naming `add-customer-onboarding`, in the mode `customer-tenants` only.
  - Done when FT holds for `authentication-proxy`.
  - _Requirements: 4.2_
- [ ] 7.2 `security-and-hardening`, `references/security-checklist.md`, `agents/security-auditor.md`
  - The exception at `security-and-hardening/SKILL.md:83` and `:223`, and at
    `agents/security-auditor.md:84`. The three checks in the checklist places the design names (the
    S2 places in the checklist and the auditor).
  - Done when FT holds for each of the three.
  - _Requirements: 4.1_
- [ ] 7.3 `debugging-and-error-recovery`
  - The five rows in the Engine tree (S2's place). `buildpad-debug` is unchanged (design Issue 2).
  - Done when FT holds for `debugging-and-error-recovery`.
  - _Requirements: 4.3_

- [ ] 8. Whole-branch check
- [ ] 8.1 The check and the read-through
  - `node tools/repo-check/check.mjs` exits 0 on the integration branch (every rule, R15 and R16
    included).
  - Run the design's manual read-through: the Supabase stop; the `scope` stop at ES-17n; the
    `selfOnboarding: false` stop; the stop without a mail provider; the full path. Check ES-17n
    word for word in its three places.
  - Done when both are recorded in the pull request with reader, date and commit.
  - _Requirements: 1.1 to 5.2_
- [ ] 8.2 Dev run
  - With the Platform's dev run (its task 12.2): steps 1 to 8 of the design's dev run, with an
    agent following the skill on a fresh Next.js kit.
  - Done when each step's outcome is recorded. A finding amends design.md (dated) and the text task
    it changes before task 9.
  - _Requirements: 3.1 to 3.10_

- [ ] 9. Release S4 (MINOR)
- [ ] 9.1 Release
  - `CHANGELOG.md`: the design's entry. The change file's `release` becomes the tag. The tag is the
    next MINOR after the latest release on `main`.
  - Done when the tag's CI (R10, R13) passes and the release is published.
  - _Requirements: 6.1_
- [ ] 9.2 `customer-tenant-skills` task 12.2
  - Tick it in `.kiro/specs/customer-tenant-skills/tasks.md`, citing this release and this spec.
  - Done when committed in the release's pull request or the one after it.
  - _Requirements: 6.2_

- [ ] 10. Engine-sent verification mail (S-3 (b)), **gated** on Engine entry 205 being released and
  on the Platform's group 13 shipping the delivery member
  - **Added 2026-11-09 when S-3 was settled (b). This group is an outline, not approved tasks:**
    it is written in full and put to the user for approval once entry 205's design is approved.
  - 10.1 Reconcile with entry 205 and the Platform's group 13: the delivery names, the verify path,
    the link's shape, and what sign-up answers under `demo` and `relay`.
  - 10.2 R16's tests first: the `demo only` pass-through is refused outside `demo`; in `demo`, no
    `lib/mail/send.ts` is needed.
  - 10.3 The Onboarding check reads the delivery (O1 and O2 gain the member), and the skill's
    steps 5 and 6 gain the branches of S-3 (b).
  - 10.4 Sign-up (3.2), resend and Verify (3.3): the engine-delivery path, where the answer carries
    no code and the verify page reads the link's code. The page shows the demo sentence.
  - 10.5 K-4 and K-5's dated amendment carried into the folder passages and the Mode_Guide. The dev
    run gains a demo case, with no provider and no captcha, a member's address signed up, verified
    and created.
  - 10.6 Release (MINOR), after the Engine and Platform parts are live on dev.

## Deferred, not in this plan

- **Requirement 3.11's `scope` branch beyond ES-17n:** waits for TD-17 (the Engine entry that
  takes over entry 204's Requirement 10, and the Platform's Requirement 10). A spec of its own
  designs it, and ES-17n retires then.
- **Engine gaps, for a later Engine entry (not opened now):**
  1. no `created_at` on the tenant summary;
  2. the create route's three 409s share `CONFLICT` with no `extensions` (the guide matches
     message prefixes until then);
  3. without `X-Onboarding-Client-Address`, all of an app's sign-ups share one budget of 5 per
     15 minutes;
  4. `max_linked_tenants` counts self-service creations only (the Platform's D-2).
  5. ~~The Engine mailing the verification code itself~~: **moved 2026-11-09** into Engine entry 205
     `onboarding-verification-mail` (S-3 settled (b); requirements drafted, not approved). This
     repository's part is group 10 below.

  Entry 204's own open item on password policy (no strength rule in any Engine door) also stands.
  The app keeps a floor of 8 characters on sign-up until then.
- **Mobile apps' sign-up** (the Platform's Issue 6).

## Requirements coverage

| Criterion | Task(s) |
|---|---|
| 1.1 | 3.1 |
| 1.2 | 3.1, 4.1, 5.1, 6.1, 6.2 |
| 1.3 | 4.1, 6.1 |
| 1.4 | 4.1 |
| 1.5 | 3.1 (held back until `met`) |
| 2.1 | 3.2, 5.1 |
| 2.2 to 2.6 | 5.1 |
| 3.1 | 1.2, 5.2 |
| 3.2 to 3.4 | 5.2 |
| 3.5 | 4.2, 5.2 |
| 3.6, 3.7, 3.9, 3.10 | 5.2 |
| 3.8 | 5.1, 5.2 |
| 3.11 | 3.2, 5.1, 6.1, 6.3 (ES-17n until TD-17) |
| 4.1 | 4.2, 7.2 |
| 4.2 | 6.2, 7.1 |
| 4.3 | 4.2, 7.3 |
| 5.1 | 2.1, 2.2 |
| 5.2 | 3.1 |
| 6.1 | 1.1, 5.3, 9.1 |
| 6.2 | 9.2 |
