# XAppHub sign-in at customers — tasks

> Approved 2026-11-22 by the user with `requirements.md` (Decisions D-1 to D-5 as recommended).

- [x] 1. Tests first: the registry cases (6.1, 6.2) and the guide's code (6.3, 6.4) in a new
      `tools/repo-check/test/xapphub-customers.test.mjs`; they fail until tasks 2 and 3.
- [x] 2. Registry: TD-9 met; TS-N3 retired; TS-N3m and TS-X1 registered; TS-H1 amended. In
      `tenancy-statements.json`, `CONTRIBUTING.md`, the guard test's texts and the statement count.
- [x] 3. Mode_Guide: section 15 (TS-N3m, TS-X1, the helper, the two routes, redirect URLs, the
      facts, the CLI, tests); sections 1, 4, 5.3, 11, 12; TS-H1's new text in section 14.
- [x] 4. `add-external-oauth/SKILL.md`: TS-N3m and TS-X1 in place of TS-N3; Step 1, step 4, Accounts
      and roles, two troubleshooting rows.
- [x] 5. TS-H1's new text in `create-api-route` (Engine routes) and `authentication-proxy` (reference).
- [x] 6. `customer-tenant-skills` task 12.4: done, with a note.
- [x] 7. `node --test` and `check.mjs` with no finding; Supabase views unchanged.
- [x] 8. CHANGELOG v10.4.0 and README install tag (drafted; no tag, push or release without the
      user's OK).

Not done here: push, pull request, merge, tag `v10.4.0` and Release, each on the user's OK; then the
Platform vendors the skills from the tag and syncs them into its starter kit.
