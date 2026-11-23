# Customers in Production — tasks

> Approved for implementation 2026-11-23 with `requirements.md` (D-1 to D-7 as recommended).

- [x] 1. Tests first: `tools/repo-check/test/production-customers.test.mjs` (7.1 to 7.5); they fail
      until tasks 2 to 6.
- [x] 2. Registry: TS-H1 amended in `tenancy-statements.json`, `CONTRIBUTING.md`, the guard test
      and its three files.
- [x] 3. Mode_Guide: section 14 (the map from the variable, both Environments, `productionCustomers`,
      `amplify.yml`, names, development, Update and redeploy); sections 11, 12 and 15 follow.
- [x] 4. `add-external-oauth/SKILL.md`: the troubleshooting row.
- [x] 5. `add-customer-onboarding`: `off` is no key; no link, no page, 404; Development's only.
- [x] 6. `debugging-and-error-recovery` row; `CONTRIBUTING.md` section on Platform-managed
      variables.
- [x] 7. `node --test` and `check.mjs` with no finding; Supabase views unchanged.
- [x] 8. CHANGELOG v10.5.0 and README install tag (no tag or Release).

Not done here: merge, tag `v10.5.0` and Release, each by the user; then the Platform syncs the
skills into its starter kit.
