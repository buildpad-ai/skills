# Implementation Plan

> Phase 3 of the gated spec `customer-tenant-skills`, from the approved `requirements.md`
> (9 requirements, 39 criteria; Decisions TS-1 to TS-7 settled) and the approved `design.md`
> (approved 2026-11-07, "Approve as recommended": the nine folders replanned `RW` to `BP` with the
> Gate, amending `backend-aware-skills`' Skill map rows; every stage a MINOR release). Generated
> and approved 2026-11-07.
>
> **Names.** Stages S1, S2, S3 (design T3); statements TS-A, TS-B, TS-Cn, TS-Cm, TS-N0 to TS-N7
> (T4); insertion points I-A(n), I-G, I-P(a–b), I-F (T7); Mode_Guide sections §1 to §12; rule R15
> and its codes (Repository_Check: rule R15); contract rows P-, E-, X- (Companion contract assumed).
> Line numbers are the design's, at `3cb4a00`. They hold at this branch's base too: since
> `3cb4a00` only `.kiro/` changed. If `main` moves before a task starts, find each place by its
> anchor text (T7), not by its line number.
>
> **Stages.** Tasks 1 to 9 are S1, written now (Requirements 1, 2, 7, 9). Task 10 is S2 and
> task 11 is S3. Each starts with a gate sub-task, and none of its other sub-tasks starts before
> that gate is met. Task 12 lists the later dependencies as deferred items, each with its blocker.
>
> **Merge order (binding) for S1.** S1 lands on `main` as **one pull request** from an integration
> branch (`feat/customer-tenant-skills-s1`, cut from `origin/main`). R15 runs by default, and it
> has no per-folder switch like `converted/<folder>`. So `node tools/repo-check/check.mjs` exits 0
> only once every copy is in place, and `check` is a required status on `main`. Within the
> branch: 1, then 2, then 3, then 4, then 5 to 8 in any order or in parallel, then 9. Sub-pull
> requests into the integration branch do not run CI, because CI runs only on pull requests to
> `main`. Each sub-task therefore proves itself locally with the commands in its Done-when line.
>
> **Cross-repository order.**
> - **S1** needs nothing from the companions.
> - **S2** needs, from `buildpad-platform` `.kiro/specs/project-tenants`:
>   - the task that ships the kit's `tenancy` member: Requirement 11, Decision 19 (b) (criterion
>     11.1; this spec's TD-2, contract rows P-1 and P-2);
>   - its Wave 1 shipped: the flag, the Customers page, the creation of Customer_Tenants (TD-1).
> - **S3** needs `buildpad-daas-go` ledger entry 192 `tenant-schema-fan-out` applied (TD-3), and
>   the Platform's `project-tenants` Requirement 9 (Releases on the Customers page) shipped.
>
> Reconciled on 2026-11-07 with the companions' task lists: the kit's `tenancy` member is
> `project-tenants` task 10.1 (and `get_project_detail` 10.3, which the skills never call); its
> Wave 1 on production is task 12.3; Requirement 9 on production is task 13.8. Entry 192 completes
> its companion contract at its task 11 and is recorded applied at its task 19. A task id is a
> pointer only: the gate is the requirement, as above.
>
> **Rules for every folder sub-task of S1 (3.x, 5.x to 8.x), and later stages as they apply.**
> - **T-1. Statements.** Copy each statement verbatim from `tools/repo-check/tenancy-statements.json`
>   (task 2.2), each as a paragraph of its own: blank lines around it, not in a list item, a table
>   cell or a fence. Never write the reserved opening "On an Engine project with Customer_Tenants"
>   in any other sentence. Mode-specific prose says "In the mode `customer-tenants`".
> - **T-2. Engine only.** Every new text stands in Engine-only text:
>   - in a new or an existing `engine` passage;
>   - in a file marked `engine`;
>   - or in an `engine-only` folder.
>
>   Nothing new is shared or `supabase` text. A new passage replaces nothing (no `supabase` partner).
>   It follows the S6 authoring rules of `backend-aware-skills` (`straddles-fence`, `marker-in-table`,
>   `gap-between-passages`).
> - **T-3. TS-A placement.** TS-A goes in every section (T7) whose Engine view holds an anchor of
>   ES-3, ES-4, ES-5, ES-7 or ES-9. One copy serves the section. TS-A also goes in the `SKILL.md`
>   of every changed Skill (I-G where the file has no anchor). ES-3, ES-4, ES-5, ES-7 and ES-9 stay
>   byte for byte as they are (9.3).
> - **T-4. Gate.** The Gate is added only where the design says so: 12 files in the 9 replanned
>   folders, and the new Mode_Guide. Each is a byte copy of `tools/repo-check/gate.md`, placed by S4
>   of `backend-aware-skills`. Links from new text into another Skill go to that Skill's `SKILL.md`
>   only (S6).
> - **T-5. No Supabase-view change.** A folder sub-task writes no
>   `tools/repo-check/supabase-view-changes/*.json` entry and no `converted/` file: all 34 folders
>   are converted already. It edits no front-matter `description`, no `README.md`, no
>   `CHANGELOG.md` and no `skill-map.json`.
> - **FT (folder done).** Each of these holds on the integration branch:
>   - `node --test "tools/repo-check/test/*.test.mjs"` passes;
>   - `node tools/repo-check/check.mjs --only R1,R2,R3,R4,R5,R6a,R6b,R7,R8,R9,R10,R11,R12,R14`
>     exits 0;
>   - `node tools/repo-check/check.mjs --only R15 | grep ' <folder>/'` prints nothing;
>   - `git diff --stat origin/main -- tools/repo-check/supabase-view-changes tools/repo-check/converted`
>     is empty;
>   - a read-through of `node tools/repo-check/check.mjs --render <out>` (Testing Strategy, manual
>     read-through) passes. It covers `<out>/engine/<folder>` (each statement next to its anchor,
>     every not-available text ends in stopping, no step offers what S1 does not) and that folder's
>     hunks of `<out>/supabase-vs-baseline.diff` (unchanged, or Gate hunks only for a replanned
>     folder). Reader, date and commit go in the commit message or the sub-pull request.

## Tasks

### Stage S1 (now: Requirements 1, 2, 7, 9; release provisionally `v9.1.0`)

- [x] 1. Replan the nine folders `RW` to `BP` (design "Skill map confirmed"; first, because R4 refuses a marker in a `wording only` folder)
- [x] 1.1 Change the nine rows of `tools/repo-check/skill-map.json`, test first
  - In `tools/repo-check/test/map.test.mjs`, first change the expected plan counts to
    `{ BP: 33, EF: 3, US: 1, NY: 2, RW: 8, 'RW+G': 2, UC: 20 }` (69 rows). The test then fails.
  - Then, in `skill-map.json`, set `"dependence": "partial"`, `"plan": "BP"` and
    `"treatment": "both paths, chosen by backend; Engine passages for Customer_Tenants (customer-tenant-skills)"`
    on the rows `add-multitenancy`, `create-form-builder`, `idea-refine`, `spec-driven-development`,
    `add-comments`, `add-users`, `authentication-proxy`, `buildpad-reference` and `create-feature`.
    Keep `size` and the row order.
  - Done when: `node --test tools/repo-check/test/map.test.mjs` passes, and
    `node tools/repo-check/check.mjs` still exits 0 (no folder holds a new marker yet).
  - _Requirements: 9.2_
  - _Boundary: tools/repo-check/skill-map.json, tools/repo-check/test/map.test.mjs_
- [x] 1.2 Amend the same rows of `backend-aware-skills`' Skill map
  - In `.kiro/specs/backend-aware-skills/requirements.md`, section `## Skill map`, change the
    *Dependence* and *Treatment* cells of the nine rows to match 1.1. That table has no plan column.
  - Add a dated note to the section's preface: "Amended 2026-11-xx by `customer-tenant-skills`
    (its design, Skill map confirmed; accepted by the maintainer 2026-11-07)". The note gives the
    dependence and treatment counts as the amended table reads. The existing Counts line predates
    the Skills added after `v2.0.0` (it says 64 folders; the table now has 69 rows): leave it as
    the record, and let the note give the current figures. CONTRIBUTING "Add a skill" keeps the two
    maps equal.
  - Done when: a script comparing the table with `skill-map.json` finds every
    `folder`/`dependence`/`treatment` equal for the nine rows, and the note is present.
  - _Requirements: 9.2_
  - _Boundary: .kiro/specs/backend-aware-skills/requirements.md_

- [x] 2. Word the canonical texts once: the Tenancy check, the machine copy and the register (design T2, T4, T6)
- [x] 2.1 Write `tools/repo-check/tenancy-check.md`
  - The T2 block byte for byte, from `<!-- tenancy-check:begin v1 -->` to
    `<!-- tenancy-check:end -->`. UTF-8, LF, and a trailing newline.
  - Done when: the file holds exactly the two sentinels, no `buildpad-backend` token and no
    reserved opening; `scanView` of `lib/guard.mjs` over it returns no finding; and a byte compare
    with the design's fenced block (extracted by script) is equal.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: tools/repo-check/tenancy-check.md_
- [x] 2.2 Write `tools/repo-check/tenancy-statements.json`
  - Write it whole, as in Data Models, with every placeholder written out:
    - `register`, `opening`, `dependencies` (TD-1, TD-3, TD-7, TD-8, TD-9, TD-10, TD-12, TD-13),
      `"met": []`, the five `anchors`, `tenancyCheck`;
    - the 12 `statements` with their T4 texts.
  - `in` lists:
    - **TS-A:** the `SKILL.md` of the 32 changed Skills (`add-multitenancy`, `manage-scope`,
      `authentication-proxy`, `create-api-route`, `create-project`, `add-buildpad`,
      `buildpad-reference`, `add-microapp`, `add-mcp-server`, `create-collection`, `create-rbac`,
      `create-workflow`, `add-cron`, `create-cron`, `hooks-extensions`, `create-service`,
      `add-i18n`, `add-comments`, `add-files`, `create-form-builder`, `grant-module-access`,
      `daas-platform`, `add-users`, `spec-driven-development`, `create-feature`, `idea-refine`,
      `worker-messaging`, `create-tests`, `debugging-and-error-recovery`, `security-and-hardening`,
      `add-external-oauth`, `migrate-to-engine`), plus `agents/test-engineer.md`,
      `agents/security-auditor.md`, `references/security-checklist.md` and the Mode_Guide.
    - **TS-B:** the 12 files of Data Models.
    - **TS-Cn and TS-Cm:** the 13 structure `SKILL.md` files and the Mode_Guide.
    - **TS-N0 to TS-N7:** as Data Models.
  - Done when: `node -e "JSON.parse(require('fs').readFileSync('tools/repo-check/tenancy-statements.json','utf8'))"`
    succeeds; each statement's text equals its T4 row (script); and no `<…>` placeholder remains.
  - _Requirements: 9.1, 9.2, 9.3, 7.1_
  - _Boundary: tools/repo-check/tenancy-statements.json_
- [x] 2.3 Register the statements in `CONTRIBUTING.md`, test first
  - Extend `tools/repo-check/test/docs.test.mjs` first (Testing Strategy). `CONTRIBUTING.md` must
    hold:
    - `## Tenancy statements`;
    - a row `| TS-… |` for every statement of the JSON, whose text equals the JSON's character for
      character;
    - the path `tools/repo-check/tenancy-check.md`;
    - a row `| R15 |` in "What the check runs".

    The test now fails.
  - Then add the section **Tenancy statements** after the "Engine runtime (ES-10)" table (T6). It
    holds:
    - one paragraph on what the mode is;
    - the reserved opening. Unlike ES-1 to ES-16, a Tenancy_Statement never stands in shared text
      (`ts-outside-engine`);
    - the T4 table (Id, When, Text);
    - the Tenancy check: its canonical file and the two files that carry it;
    - the TS-A placement rule (T7) with the five anchors.

    Add the row R15 to "What the check runs", with its codes from the design's Rule table.
  - Done when: `node --test tools/repo-check/test/docs.test.mjs` passes, and `CONTRIBUTING.md`
    stays outside the checked set (no rule reports it).
  - _Requirements: 9.1, 9.2_
  - _Boundary: CONTRIBUTING.md, tools/repo-check/test/docs.test.mjs_

- [x] 3. Write the chooser and the Mode_Guide's S1 sections in `add-multitenancy` (design "The Mode_Guide", "The chooser"; after task 2)
- [x] 3.1 Add the Gate and the chooser to `add-multitenancy/SKILL.md`
  - Put the Gate directly after `# Add Multitenancy` (line 7). The blockquote (lines 9–15, which
    holds ES-9) and the "See `/manage-scope` …" line stay byte for byte. The design says line 16;
    at `3cb4a00` it is line 17, after a blank line 16.
  - Between them goes the new Engine passage as the design prints it:
    - TS-A, before `## Choose how customers are separated`, so that it shares the section of the
      ES-9 anchor;
    - the Tenancy check, copied from `tools/repo-check/tenancy-check.md`;
    - the three-row table and the limits paragraph;
    - the three bullets and the "Never" paragraph;
    - TS-N0 and TS-N1, each a paragraph of its own.
  - The front-matter `description` does not change.
  - Done when: FT holds for the file, and `<out>/supabase/add-multitenancy/SKILL.md` equals the
    same render made on `origin/main`, apart from the Gate.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 9.3_
  - _Boundary: add-multitenancy/SKILL.md_
- [x] 3.2 Add the Gate and TS-A to `add-multitenancy/references/multitenancy.instructions.md`
  - Gate by S4. At I-A(11), in a new Engine passage: TS-A, and then "To choose between scopes,
    Customer_Tenants and a project per customer, see the skill's `SKILL.md`." (a link to
    `../SKILL.md`).
  - Done when: FT holds for the file.
  - _Requirements: 1.1, 9.3_
  - _Boundary: add-multitenancy/references/multitenancy.instructions.md_
- [x] 3.3 Write the Mode_Guide `add-multitenancy/references/engine-customer-tenants.instructions.md` (S1 sections)
  - Lines in order:
    - first line `<!-- buildpad-backend-file: engine -->`;
    - the Gate;
    - `# Customer_Tenants on an Engine project`;
    - the Tenancy check.
  - Sections, numbered as the design numbers them. S1 holds only these; a later section is absent,
    never present with a warning (T5):
    - **§1 Status:** TS-N0, and a pointer to §4.
    - **§2 What the mode is:** TS-A and the design's facts (ADR-008; the Blueprint is the project's
      tenant; the MCP and worker tokens are bound to the Blueprint; a Platform member creates
      customers).
    - **§3 Never:** 2.4 and 8.2's "no tenant id from user input outside the switch".
    - **§4 Not available:** TS-N1 to TS-N7, each followed by its own one-line paragraph naming who
      could offer it later (a separate paragraph, or `ts-altered` fires).
    - **§9 Workers and tests:** TS-N4, and the design's 7.3 text ("In the mode `customer-tenants`
      tests sign in to the Blueprint …").
  - Links go out to other Skills' `SKILL.md` only.
  - Done when: FT holds for the folder. In `--render`, the file is absent from `supabase/**` and
    present in `engine/**`.
  - _Requirements: 1.1, 2.4, 7.1, 7.2, 7.3, 8.2 (the §3 sentence only; 8.2 closes in 10.7)_
  - _Boundary: add-multitenancy/references/engine-customer-tenants.instructions.md_

- [x] 4. Add rule R15 to the Repository_Check, tests first (design "Repository_Check: rule R15"; after task 3)
- [x] 4.1 Write `tools/repo-check/test/tenancy.test.mjs` before the rule exists
  - Fixture texts only; no `SKILL.md` is committed under `tools/`. Cases, as the Testing Strategy
    lists them:
    - **`ts-altered`:** one character changed; a sentence added to the paragraph; wrapped over
      lines or inside a blockquote (passes); inside a fence (ignored).
    - **`ts-outside-engine`:** in shared text, in a `supabase` passage and in a file marked
      `supabase` (each fails); in an `engine` passage, a file marked `engine` and an `engine-only`
      folder (each passes).
    - **`ts-a-missing`:**
      - an anchor in an Engine passage without TS-A (fails);
      - an anchor in shared text with TS-A in the same section (passes);
      - TS-A only in the next `## ` section (fails);
      - two anchors with one TS-A (passes);
      - an adapted ES-4 copy (detected);
      - an anchor in a `supabase` passage (ignored).
    - **`ts-held-back`, `ts-retired`, `ts-required-missing`:** with `met` `[]`, `["TD-1"]` and
      `["TD-1","TD-3"]`; TS-Cn after TD-3; TS-N0 after TD-1.
    - **`tenancy-check-altered`, `-missing`, `-misplaced`:** one byte changed; a CRLF copy
      (passes); a third copy.
    - **The repository's data file:**
      - every statement opens with `opening`, and ids are unique;
      - every `requires` and `until` is a key of `dependencies`;
      - every `in` path exists;
      - `tenancy-check.md` holds both sentinels and no marker token.
  - Done when: `node --test tools/repo-check/test/tenancy.test.mjs` fails only because
    `lib/tenancy.mjs` does not exist yet (red).
  - _Requirements: 9.1, 9.2, 9.3, 1.1_
  - _Boundary: tools/repo-check/test/tenancy.test.mjs_
- [x] 4.2 Extend `guard.test.mjs` and `cli.test.mjs` before the rule exists
  - `guard.test.mjs`:
    - `DESIGN_TEXTS` gains the 12 TS texts and the Tenancy check;
    - the count assertion keeps 18 `ES-` keys and adds 12 `TS-` keys;
    - none matches a guard pattern, bare or fenced.
  - `cli.test.mjs`:
    - `--only R15` is accepted, and `--only R16` exits 2;
    - a fixture repository with one altered statement exits 1 with
      `R15 <path>:<line> ts-altered`;
    - the existing fixture (`FIXTURE`, "a clean fixture passes every rule") gains its own minimal
      `tools/repo-check/tenancy-statements.json` (statements with empty `in` lists) and
      `tools/repo-check/tenancy-check.md`, so that every-rule runs on fixtures stay green (see
      4.4).
  - Done when: the guard test passes, and the new CLI cases fail only for want of R15.
  - _Requirements: 9.2_
  - _Boundary: tools/repo-check/test/guard.test.mjs, tools/repo-check/test/cli.test.mjs_
- [x] 4.3 Implement `tools/repo-check/lib/tenancy.mjs`
  - Interface as Components: `TENANCY`, `TENANCY_CHECK_TEXT`, `paragraphs(text)`,
    `sections(text)`, `tenancyFindings(files, data?)`.
  - `files` is `[{path, text, views: {engine, supabase}}]` from the views `check.mjs` already
    computes. `data` defaults to `TENANCY` and lets the CLI pass the checked root's copy.
  - The nine codes of the Rule table. Line numbers are the raw file's, through `rawLineOf`.
  - It uses Node 22's standard library, `passages.mjs` and `markdown.mjs` only.
  - Done when: `node --test tools/repo-check/test/tenancy.test.mjs` passes.
  - _Requirements: 9.2, 9.3, 1.1, 7.1_
  - _Boundary: tools/repo-check/lib/tenancy.mjs_
- [x] 4.4 Wire R15 into `tools/repo-check/check.mjs`
  - `RULES` gains `R15`, and `if (want('R15')) add(tenancyFindings(textFiles, data))` is added.
  - The data comes from `<root>/tools/repo-check/tenancy-statements.json` and `tenancy-check.md`,
    as `skill-map.json` does (`dataDir`). A missing or non-JSON file exits 2 with its path when R15
    is wanted (Error Handling).
  - R15 runs by default and with `--only R15`. The `baseline` job (`--only R4,R5,R6a`) does not
    run it. The usage line does not change.
  - Done when:
    - `node --test "tools/repo-check/test/*.test.mjs"` passes;
    - `node tools/repo-check/check.mjs --only R16` exits 2;
    - `--only R1,…,R14` exits 0 on the tree;
    - `node tools/repo-check/check.mjs --only R15` reports no finding under `add-multitenancy/`.
      The findings left are only `ts-required-missing` and `ts-a-missing` in the folders of tasks
      5 to 8.
  - _Requirements: 9.2_
  - _Boundary: tools/repo-check/check.mjs_

- [x] 5. S1 in the sign-in and session Skills (per-folder plan "Sign-in and session"; after task 4; parallel with 6, 7, 8)
- [x] 5.1 (P) `authentication-proxy` (replanned)
  - Gate in `SKILL.md` and in `references/authentication-proxy.instructions.md`.
  - `SKILL.md`: TS-A at I-A(18) §CRITICAL RULE, and at I-A(32) §Auth Routes.
  - Reference: TS-A at I-A(57) §Auth Routes, and at I-A(310–318) §Environment Variables (one copy
    after the block that holds 310 and 317).
  - Done when: FT holds for `authentication-proxy`.
  - _Requirements: 1.1, 9.2, 9.3_
  - _Boundary: authentication-proxy/_
- [x] 5.2 (P) `create-api-route`
  - `SKILL.md`: I-G, TS-A.
  - `references/engine-api-routes.instructions.md` (a whole-file Engine file): I-F after line 127
    (§Sign-in Routes), with TS-A and TS-N2 as plain paragraphs.
  - Done when: FT holds for `create-api-route`.
  - _Requirements: 1.1, 3.7, 7.1, 9.3_
  - _Boundary: create-api-route/_
- [x] 5.3 (P) `create-project`
  - `SKILL.md`: TS-A at I-A(401–413) §Critical Rules, and at I-A(427–434) §Required Environment
    Variables.
  - `references/environment.instructions.md`: TS-A at I-A(101), and at I-A(109–116).
  - Done when: FT holds for `create-project`.
  - _Requirements: 1.1, 9.3_
  - _Boundary: create-project/_
- [x] 5.4 (P) `add-buildpad`, `add-mcp-server`
  - `add-buildpad/SKILL.md` and `add-mcp-server/SKILL.md`: I-G, TS-A each.
  - Done when: FT holds for both folders.
  - _Requirements: 1.1_
  - _Boundary: add-buildpad/SKILL.md, add-mcp-server/SKILL.md_
- [x] 5.5 (P) `buildpad-reference` (replanned)
  - Gate in `SKILL.md`; I-G, TS-A.
  - Done when: FT holds for `buildpad-reference`.
  - _Requirements: 1.1, 9.2_
  - _Boundary: buildpad-reference/_
- [x] 5.6 (P) `add-microapp`
  - `SKILL.md`: TS-A at I-A(345) §Implementation Steps (engine@331-409), and at I-A(1057)
    §Deployment Automation (engine@1022-1060).
  - `references/app-urls-config.instructions.md`: TS-A at I-A(248).
  - `references/deployment-topology.instructions.md`: TS-A at I-A(274).
  - Done when: FT holds for `add-microapp`.
  - _Requirements: 1.1, 9.3_
  - _Boundary: add-microapp/_

- [x] 6. S1 in the scope and structure Skills (per-folder plan "Mode_Guide and chooser" (`manage-scope`) and "Structure"; after task 4; parallel with 5, 7, 8)
- [x] 6.1 (P) `manage-scope` (separate Engine file set)
  - `SKILL.md`:
    - I-A(797), in §"Using `mcp_daas_items` with Scope" (engine@794-1433): TS-A, then TS-N0;
    - I-A(1092), in §Steps: TS-A.
  - `references/engine-scope-management.instructions.md`: I-F after the ES-9 paragraph (line 41),
    TS-A.
  - Done when: FT holds for `manage-scope`.
  - _Requirements: 1.1, 2.3, 7.1, 9.3_
  - _Boundary: manage-scope/_
- [x] 6.2 (P) `create-collection`
  - `SKILL.md`: TS-A at I-A(162) §Standard Field Groups (engine@155-166), and at I-A(403) §Scope
    (engine@400-442).
  - `references/standard-fields.instructions.md`: TS-A at I-A(392).
  - Done when: FT holds for `create-collection`.
  - _Requirements: 1.1, 9.3_
  - _Boundary: create-collection/_
- [x] 6.3 (P) TS-A after the Gate in eight structure Skills with no anchor
  - In the `SKILL.md` of `create-rbac`, `create-workflow`, `add-cron`, `create-cron`,
    `hooks-extensions`, `create-service`, `add-files` and `grant-module-access`: I-G, TS-A, each in
    a new Engine passage directly after the existing Gate.
  - Done when: FT holds for each of the eight folders.
  - _Requirements: 1.1_
  - _Boundary: the eight SKILL.md files named_
- [x] 6.4 (P) `add-i18n`
  - `SKILL.md`: TS-A at I-A(203–209) §Step 7.
  - `references/content-translations.instructions.md`: TS-A at I-A(834).
  - Done when: FT holds for `add-i18n`.
  - _Requirements: 1.1, 9.3_
  - _Boundary: add-i18n/_
- [x] 6.5 (P) `add-comments` (replanned)
  - Gate in `SKILL.md`; I-G, TS-A.
  - Done when: FT holds for `add-comments`.
  - _Requirements: 1.1, 9.2_
  - _Boundary: add-comments/_
- [x] 6.6 (P) `create-form-builder` (replanned)
  - Gate in `SKILL.md` and in `references/form-builder.instructions.md`.
  - `SKILL.md`: I-G, TS-A.
  - Reference: TS-A at I-A(95–97) §Multi-Tenancy / Scopes.
  - Done when: FT holds for `create-form-builder`.
  - _Requirements: 1.1, 9.2, 9.3_
  - _Boundary: create-form-builder/_
- [x] 6.7 (P) `daas-platform`
  - `SKILL.md`: TS-A at I-A(92–105) §Environment Variables (engine@69-108).
  - `references/builtin-features.instructions.md`: TS-A at I-A(341).
  - `references/daas-api.instructions.md`: TS-A at I-A(151–155) §Authentication.
  - `references/daas-mcp-tools.instructions.md`: TS-A at I-A(1799) §Tool: `scope`.
  - Done when: FT holds for `daas-platform`.
  - _Requirements: 1.1, 9.3_
  - _Boundary: daas-platform/_

- [x] 7. S1 in the people, planning, worker, test, debugging and review Skills (per-folder plan "People, planning, …"; after task 4; parallel with 5, 6, 8)
- [x] 7.1 (P) `add-users` (replanned)
  - Gate in `SKILL.md`. At I-A(142) §The Data Layer: TS-A, then TS-N1.
  - Done when: FT holds for `add-users`.
  - _Requirements: 1.1, 2.4, 6.1 (TS-A's half; the rest in 10.6), 7.1, 9.2, 9.3_
  - _Boundary: add-users/_
- [x] 7.2 (P) `spec-driven-development`, `create-feature`, `idea-refine` (replanned)
  - The Gate goes in each `SKILL.md`.
  - `spec-driven-development`: TS-A at I-A(47–54) §DaaS-Specific Considerations.
  - `create-feature`: TS-A at I-A(39–45) §Planning Process, and at I-A(110) §Scope-Aware Context
    Pattern.
  - `idea-refine`: at I-A(75–84), after the table in §DaaS Platform Check: TS-A, then "Customers
    with their own data, people and administrators: the `add-multitenancy` skill chooses between
    scopes, Customer_Tenants and a project per customer." (a link to `../add-multitenancy/SKILL.md`).
  - Done when: FT holds for the three folders.
  - _Requirements: 1.1, 9.2, 9.3_
  - _Boundary: spec-driven-development/, create-feature/, idea-refine/_
- [x] 7.3 (P) `worker-messaging`
  - `SKILL.md`: I-G, TS-A. At I-P(213-218), directly after ES-14n: TS-N4.
  - Done when: FT holds for `worker-messaging`, and ES-14n is unchanged.
  - _Requirements: 1.1, 7.1, 7.2_
  - _Boundary: worker-messaging/_
- [x] 7.4 (P) `create-tests` and `agents`
  - `create-tests/SKILL.md`: at I-A(159) §Authentication Setup (engine@154-208): TS-A, then the
    design's 7.3 text. One copy serves the anchor at 180, which is in the same section.
  - `agents/test-engineer.md`: at I-A(92–103) §DaaS-Specific Testing: TS-A and the 7.3 text.
  - `agents/security-auditor.md`: at I-P(77-85) §5. DaaS-Specific: TS-A.
  - Done when: FT holds for `create-tests` and `agents`.
  - _Requirements: 1.1, 7.3, 9.3_
  - _Boundary: create-tests/, agents/test-engineer.md, agents/security-auditor.md_
- [x] 7.5 (P) `debugging-and-error-recovery`, `security-and-hardening`, `references`
  - `debugging-and-error-recovery/SKILL.md`: I-G, TS-A.
  - `security-and-hardening/SKILL.md`: TS-A at I-A(154–166) §DaaS-Specific Security
    (engine@141-171).
  - `references/security-checklist.md`: TS-A at I-A(55–62) §Authentication (engine@52-62).
  - Done when: FT holds for the three folders.
  - _Requirements: 1.1, 9.3_
  - _Boundary: debugging-and-error-recovery/SKILL.md, security-and-hardening/SKILL.md, references/security-checklist.md_

- [x] 8. S1 in the "not available only" Skills (per-folder plan "Not available only"; after task 4; parallel with 5, 6, 7)
- [x] 8.1 (P) `add-external-oauth`
  - In §On an Engine project: XAppHub sign-in only (engine@40-231), directly after its first
    paragraph (line 48) and before Step 1: TS-A, then TS-N3. This copy also serves the anchor at
    77, which is in the same section.
  - Done when: FT holds for `add-external-oauth`.
  - _Requirements: 1.1, 3.8, 7.1, 9.3_
  - _Boundary: add-external-oauth/_
- [x] 8.2 (P) `migrate-to-engine`
  - `SKILL.md`:
    - at I-P(55-257), directly after the paragraph at lines 56–63: TS-A, then TS-N7;
    - at I-A(176) §Part B: TS-A (one copy serves 179, 188 and 200).
  - `references/app-code.instructions.md` (I-F): TS-A at I-A(47–53) §1. Environment, and at
    I-A(103–106) §2. Sign-in.
  - Done when: FT holds for `migrate-to-engine`.
  - _Requirements: 1.1, 7.1, 9.3_
  - _Boundary: migrate-to-engine/_

- [x] 9. Prove S1 whole and release it (design Release plan, S1; after tasks 1 to 8)
- [x] 9.1 Run the whole-tree check and the S1 read-through on the integration branch
  - Run `node --test "tools/repo-check/test/*.test.mjs"`, `node tools/repo-check/check.mjs` (R15
    included) and the `baseline` job's command.
  - Then `node tools/repo-check/check.mjs --render <out>`, and the manual read-through for the 34
    changed folders.
  - Install check: `npx skills@1.7.1 add <local checkout> --all` into a scratch folder.
  - Done when:
    - all three commands exit 0;
    - R15 reports nothing, which means:
      - TS-A is in all 41 anchor sections and in the 32 `SKILL.md` files plus the three Shared_Guidance files;
      - TS-N0 to TS-N7 are where their `in` lists say;
      - TS-B, TS-Cn and TS-Cm are copied nowhere;
      - the Tenancy check is in exactly its two files;
    - `git grep -l "On an Engine project with Customer_Tenants" -- ':!.kiro' ':!tools' ':!CONTRIBUTING.md'`
      lists only files of the 34 folders;
    - `git diff --stat origin/main -- tools/repo-check/supabase-view-changes tools/repo-check/converted`
      is empty;
    - `<out>/supabase-vs-baseline.diff` differs from the same render on `origin/main` only by the
      Gate hunks of the 12 files in the 9 replanned folders;
    - every Skill installs, and the installed files equal the tree;
    - reader, date and candidate commit are noted for 9.2.
  - _Requirements: 1.1, 1.4, 2.5, 9.2, 9.3, 9.4_
- [x] 9.2 Write the release: `CHANGELOG.md` and the README's install tag, then merge S1
  - Done 2026-11-08: pull request buildpad-ai/skills#66, `check` and `baseline` green, merged as
    `0f667fb`. `check.mjs --tag v9.1.0` exits 0 on that commit.
  - Add a `v9.1.0` section above `v9.0.0`. If another release takes `v9.1.0` first, use the next
    MINOR; S1 is MINOR in every case (design Issue 3, settled).
  - The section holds:
    - one bullet per changed folder (34);
    - the new rule R15;
    - a **Supabase projects** subsection with the design's sentence on the Gate added to 12 files
      of 9 skills;
    - a "Read through by" line from 9.1.
  - In `README.md`, change the install commands from `#v9.0.0` to the new tag, as the `v9.0.0`
    release did. No change-file entry exists to release.
  - Open the one S1 pull request to `main`.
  - Done when:
    - `node tools/repo-check/check.mjs --tag v9.1.0` exits 0 (R10, R13);
    - CI's `check` and `baseline` jobs are green on the pull request;
    - the pull request is merged.
  - _Requirements: 9.4_
  - _Boundary: CHANGELOG.md, README.md_
- [x] 9.3 Tag `v9.1.0` and publish the GitHub Release (maintainer)
  - Done 2026-11-08: annotated tag `v9.1.0` on `0f667fb`, tag-push `repo-check` green, Release
    published (Latest). `npx skills@1.7.1 add buildpad-ai/skills#v9.1.0 --all` installed 67 Skills
    whose 243 files equal `git ls-tree -r v9.1.0`; `#v9.1.0@add-multitenancy` installed its 3 files,
    equal. `v9.0.0` was never tagged; left to the maintainer.
  - Create the annotated tag on the merge commit of 9.2, push it, and publish the Release with the
    CHANGELOG section.
  - Then install `#v9.1.0 --all` and `#v9.1.0@add-multitenancy` into a scratch folder.
  - Done when: the tag-push `repo-check` run is green, the release page exists, and the installed
    files equal `git ls-tree -r v9.1.0`.
  - External, not a task here: the Platform vendors the tag with `pnpm sync:skills --ref v9.1.0`.
    Its KitAssembler strips the new Engine passages and the Mode_Guide from Supabase Kits
    (`backend-aware-skills` Requirement 6). S1 asks nothing else of the Platform.
  - _Requirements: 9.4_

### Stage S2 (when TD-1 is met)

- [ ] 10. S2: sign-in, scopes, structure built in the Blueprint, people, planning, debugging and review (design T3 S2; Release plan S2)
- [x] 10.0 Gate: TD-1 met, and the companions reconciled
  - **Blocked until** the requirements' Dependencies record TD-1 as met, by a dated amendment the
    maintainer approves. TD-1 is met when `buildpad-platform` `project-tenants` is approved and its
    Wave 1 is on production: the flag, the Customers page and the creation of Customer_Tenants.
  - The S2 text tells a developer to "set `tenancy` in `.buildpad/project.json` or download the
    kit again" (T2 step 1, P-1, P-2). So the same amendment records the status of the Platform task
    that ships the kit's `tenancy` member (`project-tenants` Requirement 11, Decision 19 (b);
    TD-2). Design T3 says TD-2 opens no stage, because the record file covers a Kit without the
    member. If Wave 1 ships without it, the maintainer decides whether S2 waits.
  - **Reconcile:** read the approved `project-tenants` design and re-verify rows X-1 to X-12 at the
    Engine's `origin/main` (the identity routes, the binding rules, the binder's answers). A row
    that differs is a Revalidation Trigger: the design is revised and approved before 10.1. Also
    record, from the Platform's design, the answers to Issue 17 (a Platform account removed in a
    customer) and to row P-9.
  - Done when: the amendment is approved, and the design is either confirmed or revised.
  - 8 November 2026: reconciled (design "Reconciliation of 8 November 2026"); design revised and
    criterion 8.1 amended, approved by the maintainer the same day. TD-1 still unmet: Platform task 12.3 not run.
  - 10 November 2026: TD-1 met (Platform 12.3 done 9 November, `01a8f25e`); rows X- re-read at
    Engine `2d58083f` and hold for S2 (design "Re-read of 10 November 2026"). Amendment approved by
    the maintainer the same day ("Approve and continue"). Gate open.
  - _Requirements: none closed (gate)_
- [ ] 10.1 Move the data to S2
  - In `tenancy-statements.json`, set `"met": ["TD-1"]`.
  - R15 then forces:
    - TS-N0 out of `add-multitenancy/SKILL.md`, `manage-scope/SKILL.md` and the Mode_Guide
      (`ts-retired`);
    - TS-B and TS-Cn into their `in` files (`ts-required-missing`, cleared by 10.2 to 10.5).
  - Done when: `node --test "tools/repo-check/test/*.test.mjs"` passes, and
    `node tools/repo-check/check.mjs --only R15` reports only those findings, before 10.2 to 10.7
    clear them.
  - _Requirements: 2.3, 9.1, 9.2_
- [ ] 10.2 Mode_Guide S2 sections
  - Restate §1: "Available: sign-in, scopes, structure built in the Blueprint, people. Not yet:
    Releases".
  - Add these sections:
    - **§5 Signing in and the current customer:**
      - TS-B;
      - the four app routes and `lib/auth/tenants.ts` (`listTenants`, `switchTenant`,
        `settleTenant`) as the design prints them;
      - the chooser, switch, current-customer, `NEXT_PUBLIC_BUILDPAD_TENANT_ID` (with TS-N2) and
        XAppHub (with TS-N3) rules;
      - the answers table, of which only the 503 is retried;
      - the TD-6 sentence;
      - caches after a switch.
    - **§6 Scopes inside a customer:** the five bullets.
    - **§7.1 to §7.3:** TS-Cn; roles by id with the four seeded ids; 7.3's S2 cron text.
    - **§8 People:** the four bullets.
    - **§10 Planning:** 5.6.
    - **§11 When something goes wrong:** the 8.1 rows, the last with its S2 cause.
    - **§12 Review checks:** 8.2.
  - Done when: FT holds for `add-multitenancy`, and `add-multitenancy/SKILL.md` no longer holds
    TS-N0.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 5.1, 5.4 (creation half), 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 8.1, 8.2_
- [x] 10.3 Sign-in and session folders, S2 column
  - `authentication-proxy` (both files), `create-api-route` (the "### In the mode
    `customer-tenants`" section after the Login route; the answers table in the forwarder section,
    lines 60–120), `create-project` (both files), `add-buildpad` (`SKILL.md` §CRITICAL and
    `references/buildpad.instructions.md` §DaaSProvider), `buildpad-reference`, `add-microapp`,
    `add-mcp-server`, `daas-platform/references/daas-api.instructions.md` and `create-tests` (the
    script sign-in at 180). Each gets TS-B and the specifics of the per-folder plan's S2 column.
  - Done when: FT holds for each folder; R15 finds TS-B in all 12 files.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.2_
  - Done 2026-11-10: TS-B in all 12 files; FT holds for the nine folders.
- [x] 10.4 Scope folders, S2 column (the URI rule 4.1, and 4.3)
  - `manage-scope`: `SKILL.md` at 797 (§6 bullets, linking `../add-multitenancy/SKILL.md`),
    `references/engine-scope-management.instructions.md` and
    `references/scope-client.instructions.md` I-P(56-69).
  - `create-collection` at 403 and `references/standard-fields.instructions.md` at 392.
  - `add-i18n/references/content-translations.instructions.md` at 834.
  - `create-form-builder/references/form-builder.instructions.md` at 95–97.
  - `daas-platform/references/builtin-features.instructions.md` at 341.
  - `create-feature` at 110.
  - Done when: FT holds for each folder.
  - _Requirements: 4.1, 4.2, 4.3_
  - Done 2026-11-10: TS-N0 out of `manage-scope/SKILL.md`; the URI rule in all eight spots; FT holds.
- [x] 10.5 Structure folders, S2 column
  - TS-Cn goes in the 13 structure `SKILL.md` files at the per-folder plan's points, with these
    specifics:
    - **`create-rbac`:** 7.2 roles by id at I-P(61-71); the `scope_config` rule at I-P(117-149);
      people screens in the current customer at I-P(207-223).
    - **`add-cron` and `create-cron`:** 7.3's S2 text.
    - **`add-i18n`:** `languages` rows are data.
    - **`add-files`:** folders are rows.
    - **`create-form-builder`:** a form definition is a row.
    - **`grant-module-access`:** keys are released with the structure.
    - **`daas-platform`:** §Backend-First Rule TS-Cn; 3.7 at 92–105; `daas-mcp-tools` §System
      Tools ("no tool reaches a customer").
  - Done when: FT holds for each folder; R15 finds TS-Cn in all 14 files.
  - _Requirements: 5.1, 5.2 (S2 half: no Release yet, said by TS-Cn), 5.4 (creation half), 5.5, 6.4_
  - Done 2026-11-10: TS-Cn in all 13 structure `SKILL.md` files; FT holds.
- [ ] 10.6 People and planning folders, S2 column
  - `add-users`: the §8 bullets next to TS-A.
  - `spec-driven-development`, `create-feature` at 39–45, and `idea-refine`: the 5.6 text.
  - Done when: FT holds for each folder.
  - _Requirements: 5.6, 6.1, 6.2, 6.3, 6.4_
- [ ] 10.7 Debugging and review folders, S2 column
  - `debugging-and-error-recovery`: the 8.1 rows in the fence at 180–196 (S2 cause in the last
    row).
  - The 8.2 checks go in:
    - `security-and-hardening`, I-P(60-62) and I-P(263-265);
    - `references/security-checklist.md`, I-P(185-192);
    - `agents/security-auditor.md`, I-P(77-85);
    - `agents/test-engineer.md`, engine@99-103.
  - Done when: FT holds for each folder.
  - _Requirements: 8.1, 8.2_
- [ ] 10.8 Release S2 (MINOR)
  - Run the 9.1 checks, with S2's statement placement in place of S1's. Write the CHANGELOG
    section: one bullet per changed folder, and a Supabase projects subsection saying nothing a
    Supabase agent reads changes. Update the README's install tag. Then the maintainer tags and
    publishes the Release.
  - Done when: `node tools/repo-check/check.mjs --tag <tag>` exits 0, the tag-push run is green,
    and the release page exists.
  - _Requirements: 9.4_

### Stage S3 (when TD-3 is met)

- [ ] 11. S3: Releases and Rollouts (design T3 S3; Release plan S3; after task 10)
- [ ] 11.0 Gate: TD-3 met, and entry 192 reconciled
  - **Blocked until** the requirements' Dependencies record TD-3 as met, by a dated amendment the
    maintainer approves. That needs both:
    - `buildpad-daas-go` ledger entry 192 `tenant-schema-fan-out` applied;
    - the Platform's `project-tenants` Requirement 9 (Releases on the Customers page) on
      production.
  - **Reconcile** rows E-1 to E-14 and P-11, P-12 with entry 192 as applied and with the
    Platform's Rollout dialog: `cron_status: "as_template"`, `overwrite_drift`,
    `allow_destructive`, the outcome names, `scope_type_unmapped`. A difference is a Revalidation
    Trigger, so the design is revised first. Also record the Engine's answer to Issue 18 (a route
    test for switch-then-refresh, TD-11).
  - Done when: the amendment is approved, and the design is either confirmed or revised.
  - _Requirements: none closed (gate)_
- [ ] 11.1 Move the data to S3
  - `"met": ["TD-1", "TD-3"]`. R15 then forces TS-Cn out of its 14 files (`ts-retired`) and TS-Cm
    in (`ts-required-missing`).
  - Done when: the tests pass, and `--only R15` reports only those findings, before 11.2 and 11.3
    clear them.
  - _Requirements: 9.2_
- [ ] 11.2 Mode_Guide S3 sections
  - Restate §1 ("Available: all of the above and Releases").
  - In §7: TS-Cm replaces TS-Cn in §7.1; 7.3's S3 text is added; §7.4 Releases and Rollouts and
    §7.5 Expand, release, contract (with Drift and Conflicts) are added.
  - Restate §11's last row with its S3 cause.
  - Done when: FT holds for `add-multitenancy`.
  - _Requirements: 5.2, 5.3, 5.4 (Rollout half), 8.1_
- [ ] 11.3 Folders, S3 column
  - TS-Cm replaces TS-Cn in the 13 structure `SKILL.md` files.
  - `create-collection`: "To remove or rename a field, use expand, release, contract (the
    `add-multitenancy` skill)".
  - `add-cron` and `create-cron`: 7.3's S3 text.
  - `debugging-and-error-recovery`: the last row's S3 cause.
  - Done when: FT holds for each folder; R15 finds TS-Cm in all 14 files and TS-Cn in none.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1_
- [ ] 11.4 Release S3 (MINOR)
  - As in 10.8.
  - Done when: `check.mjs --tag <tag>` exits 0, the tag-push run is green, and the release page
    exists.
  - _Requirements: 9.4_

### Later: deferred, one release per dependency

- [ ] 12. Retire each not-available statement when its dependency is met (design T3 "Later"; none starts before its blocker)
  - Each sub-task:
    1. waits until its row is recorded as met in the requirements' Dependencies (a dated,
       approved amendment);
    2. waits for a spec of its own that words the steps the dependency opens (design Non-Goals);
    3. adds the row to `met`, which makes R15 `ts-retired` force the statement out of every file;
    4. is released as a MINOR release.

    TS-N7 has no dependency and stays.
- [ ] 12.1 TD-6 (`buildpad-ui`: the SDK and CLI templates know the mode)
  - **Blocked:** no spec or issue exists in `buildpad-ui`. `backend-aware-skills` PP-34 is its
    one-tenant counterpart, also unmet.
  - No statement retires. Mode_Guide §5 and the sign-in folders of 10.3 swap the hand-written
    routes for the SDK's functions, and the TD-6 sentence is removed. That needs a design revision.
  - _Requirements: 3.1, 3.2, 3.3, 3.4 (met by hand-written routes from S2; this item only changes their form)_
- [ ] 12.2 TD-7: customers that sign themselves up
  - **Blocked:** Platform Decision 20 (a) means it is not offered; it needs a later Platform spec.
  - Retires TS-N1 from `add-multitenancy/SKILL.md`, `add-users/SKILL.md` and the Mode_Guide.
  - _Requirements: 7.1_
- [ ] 12.3 TD-8: a public page per customer (a host name mapped to a customer)
  - **Blocked:** Platform Decision 11 (b), Wave 2, with an Engine part.
  - Retires TS-N2 from `create-api-route/references/engine-api-routes.instructions.md` and the
    Mode_Guide.
  - _Requirements: 3.7, 7.1_
- [ ] 12.4 TD-9: XAppHub sign-in in a customer
  - **Blocked:** Platform Decision 21 (b), Wave 2, with an Engine part
    (`external_sign_in.go:66-67`).
  - Retires TS-N3 from `add-external-oauth/SKILL.md` and the Mode_Guide.
  - _Requirements: 3.8, 7.1_
- [ ] 12.5 TD-10: workers per customer
  - **Blocked:** Platform Decision 13, Wave 3.
  - Retires TS-N4 from `worker-messaging/SKILL.md` and the Mode_Guide (§4, §9). Check how it
    interacts with `backend-aware-skills` task 10.2 (ES-14n to ES-14m) at that time.
  - _Requirements: 7.1, 7.2_
- [ ] 12.6 TD-12: a backup or restore of one customer
  - **Blocked:** Platform Decision 14, Wave 3.
  - Retires TS-N5 from the Mode_Guide.
  - _Requirements: 7.1_
- [ ] 12.7 TD-13: Open Studio into a customer
  - **Blocked:** Platform Requirement 10, Wave 2.
  - Retires TS-N6 from the Mode_Guide.
  - _Requirements: 7.1_

## Open questions carried, not tasks

- **Issue 1 (ask, maintainer):** whether a later change brings the copies of ES-1 to ES-16 to
  verbatim and checks them, as R15 checks the Tenancy_Statements.
- **Issue 17 (ask, Platform design):** what happens when a customer's administrator removes a
  Platform account. 10.0 records the answer, and §8 tells apps not to offer it until then.
- **Issue 18 (answered):** a route test that switches and then refreshes exists on the Engine
  (`src/api/tenant_token_route_test.go`, `TestAPersonListsAndSwitchesTheirTenants`); entry 192's
  task 18.2 runs a negative control against it. S2 relies on it (X-9).
- **TD-2, TD-4, TD-5, TD-11** open no stage (design T3). TD-2's status is recorded in 10.0.

## Requirements coverage

| Criterion | Task(s) | Stage |
|---|---|---|
| 1.1 | 2.1, 3.1 to 3.3, 4.1, 4.3, 5.x to 8.x, 9.1 | S1 |
| 1.2, 1.3 | 2.1, 3.1 | S1 |
| 1.4 | 2.1, 3.1, 9.1 | S1 |
| 2.1, 2.2, 2.5 | 3.1 (2.5 also 9.1) | S1 |
| 2.3 | 3.1, 6.1 (TS-N0); 10.1 (retired) | S1, S2 |
| 2.4 | 3.1, 3.3, 7.1 | S1 |
| 3.1 to 3.6 | 10.2, 10.3 (form changed by deferred 12.1) | S2 |
| 3.7 | 5.2 (TS-N2); 10.2, 10.3; deferred 12.3 | S1, S2 |
| 3.8 | 8.1 (TS-N3); 10.2; deferred 12.4 | S1, S2 |
| 4.1 to 4.3 | 10.2, 10.4 | S2 |
| 5.1 | 10.2, 10.5; 11.3 | S2, S3 |
| 5.2 | 10.5 (TS-Cn); 11.2, 11.3 (TS-Cm) | S2, S3 |
| 5.3 | 11.2, 11.3 | S3 |
| 5.4 | 10.2, 10.5 (creation half); 11.2, 11.3 (Rollout half) | S2, S3 |
| 5.5 | 10.2, 10.5 | S2 |
| 5.6 | 10.2, 10.6 | S2 |
| 6.1 | 7.1 (TS-A); 10.2, 10.6 | S1, S2 |
| 6.2, 6.3 | 10.2, 10.6 | S2 |
| 6.4 | 10.2, 10.5, 10.6 | S2 |
| 7.1 | 2.2, 3.1, 3.3, 5.2, 6.1, 7.1, 7.3, 8.1, 8.2; deferred 12.2 to 12.7 | S1 |
| 7.2 | 3.3, 7.3; deferred 12.5 | S1 |
| 7.3 | 3.3, 7.4 | S1 |
| 8.1 | 10.2, 10.7; 11.2, 11.3 | S2, S3 |
| 8.2 | 3.3 (§3 sentence); 10.2, 10.3, 10.7 | S1, S2 |
| 9.1 | 2.2, 2.3, 4.1; 10.1 | S1 |
| 9.2 | 1.1, 1.2, 2.2, 2.3, 4.1 to 4.4, 9.1; 10.1, 11.1 | S1 |
| 9.3 | 2.2, 4.1, 4.3, 5.x to 8.x, 9.1 | S1 |
| 9.4 | 9.1 to 9.3; 10.8; 11.4 | S1, S2, S3 |
