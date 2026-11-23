# Customers in Production — requirements and design (lightweight spec)

> Status: **approved for implementation** 2026-11-23. Written the same day, before any skill change,
> by a session the Platform's `production-customers` work started, from its companion brief
> `companion-skills.md`. The brief fixes what changes. The choices it leaves open are D-1 to D-7
> below, each settled as recommended. The user reviews them in the pull request.
>
> This is the skills repository's part of the Platform spec `production-customers` (P-7 (a) and
> P-9 (a)). It builds on `customer-hosts` (v10.3.0) and `xapphub-customer-sign-in` (v10.4.0).
>
> Read, not observed:
> - this repository at `origin/main` `4cd99e6` (v10.4.0);
> - the Platform's spec `production-customers` (requirements and design) and its
>   `amplify_set_env_vars` tool, on the worktree `production-customers`. That tool refuses
>   `BUILDPAD_ONBOARDING_KEY` and `BUILDPAD_SIGNUP_MAIL`, and refuses `BUILDPAD_CUSTOMER_HOSTS`
>   where the Customers page manages it;
> - the companion brief for the CLI's `external-oauth-engine` module (`companion-cli.md`, a parallel
>   session in `buildpad-ui`);
> - xLMS commit `eabb04f` (`config/customer-hosts.ts`), an application that already reads the
>   variable.
>
> No request was sent to any Engine, Platform or Amplify app, and no agent was run against a skill.

## Context

An Engine project with a ready Production can now have customers in Production too. They are
separate from Development's, with their own quota and slugs; the same slug in both Environments is
expected. `get_project_detail` lists them as `productionCustomers` (id, name, slug, state) beside
`customers`, which stays Development's. `productionCustomers` is absent while the Platform does not
offer the feature or Production is not ready.

The Platform now writes the customer host map itself, as a server variable on each Amplify branch of
the main app: `BUILDPAD_CUSTOMER_HOSTS`, JSON `{ "<slug>": "<tenant id>" }`. `main` holds
Development's ready and suspended customers, `production` holds Production's. A member writes it,
and redeploys the app, with **Update and redeploy** on the Customers page, which says when the map
is out of date. The value holds slugs and tenant ids only.

The `production` branch also gets `BUILDPAD_ONBOARDING_KEY=off`. Amplify drops an empty value, so
`off` is the value that means "no key". Self-onboarding is Development's only.

What the skills say today is wrong for Production:
- section 14 of the Mode_Guide `engine-customer-tenants`, and TS-H1 in three files, tell the
  application to commit a map copied from `customers[]`. That map holds Development's tenant ids, so
  Production's app would send people to Development's tenants. It also needs a commit for each new
  customer;
- `add-customer-onboarding` treats any set value as a key. With `off`, Production's app would show
  the sign-up page and send `off` to the Engine, which answers 401 (`onboarding.key_invalid`).

The customer domain moves as a whole between Environments (the Platform's domain move), so one
committed `CUSTOMER_HOST_SUFFIX` still serves both branches. Only the map differs per branch.

## Decisions (settled 2026-11-23 as recommended)

| # | Question | Options | Settled |
|---|---|---|---|
| D-1 | TS-H1 says "a committed map … copied from `customers[]`" | **(a)** Amend it in place (same id, same *When*): the map is the one the Platform writes as `BUILDPAD_CUSTOMER_HOSTS`, read on the server and never committed. **(b)** Retire TS-H1 and add TS-H2 | **(a)**, as `xapphub-customer-sign-in` D-3 did. Its *When* (TD-18) does not change, and no new dependency is involved |
| D-2 | How the value reaches the running app, the Edge middleware included | **(a)** The `amplify.yml` line that writes server variables into `.env.production`, as the onboarding key's and the CLI module's are. **(b)** `next.config.ts` `env` (what xLMS did) | **(a)**. It is the same line the CLI module adds, so a CLI install and a hand-built app agree, and `env` would inline the value into any bundle that names it, a client bundle included. Either way the value is the one the last build saw, and Update and redeploy builds again |
| D-3 | The variable has no display names, but section 14 shows "Your account does not belong to <name>." | **(a)** The name is the slug, unless the app keeps an optional committed table of display names by slug (names only, never ids). **(b)** Read names from `get_project_detail` at run time | **(a)**. An app has no Platform token at run time, and a name is not a mapping |
| D-4 | A value in development | **(a)** The developer puts a value in `.env.local`, copied from `customers[]` (Development's). **(b)** A committed fallback map outside production builds (what xLMS did) | **(a)**. A committed fallback would be the committed map again |
| D-5 | What the parser keeps | **(a)** As the CLI companion: a JSON object; keys that are exactly one lower-case DNS label, values that are non-empty strings. Missing, empty, unparsable or not an object → the empty map, logged once without the value. **(b)** Also require a UUID | **(a)**. It matches the CLI module byte for byte in behaviour; the Engine checks every id anyway |
| D-6 | `BUILDPAD_ONBOARDING_KEY=off`, and what "no key" does | **(a)** Unset, empty or `off` (trimmed, any case) is no key. With no key the sign-in page offers no sign-up link, the sign-up page is not found, and the four onboarding routes answer 404 "Sign-up is not available right now." with `onboarding.not_configured` in the log. **(b)** Only `off` gives 404; unset keeps today's 503 | **(a)**. The brief says `off` is the same as no key. Today the guide answers 503 without a key and still shows the page. One behaviour is simpler, and a page that is not offered answers 404 (the brief's "as it does today" holds for the Platform's own reading, not this guide's code). The log line still tells a developer on Development that the `amplify.yml` line is missing |
| D-7 | Where "variables the Platform manages" is written | **(a)** A section of `CONTRIBUTING.md` naming `BUILDPAD_ONBOARDING_KEY`, `BUILDPAD_SIGNUP_MAIL` and `BUILDPAD_CUSTOMER_HOSTS`, plus a sentence in the agent-facing text that uses each (section 14, the onboarding skill's step 7). **(b)** Also `amplify-env-vars/SKILL.md` and `backend-contract.json` | **(a)**. `amplify-env-vars` is `UC` (R7 refuses any change to it), and `backend-contract.json` is pinned to the Platform's design (R12): changing it needs a Platform change, which this spec does not make |

## Draft statement text

**TS-H1**, amended (D-1 (a)); only the first sentence changes, from "…with a committed map from each
customer's `slug` to its `id` copied from `customers[]` of `get_project_detail`." to:

> …with a map from each customer's `slug` to its `id` that the Platform writes as the server
> variable `BUILDPAD_CUSTOMER_HOSTS`, one value per Environment, and that the application reads on
> the server and never commits.

## Requirements (EARS)

1. **Registry.** TS-H1's amended text shall stand in each of its three files, in
   `tenancy-statements.json`, in `CONTRIBUTING.md`'s register and in the guard test's texts.
2. **Section 14 of the Mode_Guide.**
   2.1 The application shall read the map from `process.env.BUILDPAD_CUSTOMER_HOSTS` on the server
       (the Edge middleware included), parse it once, keep only keys that are one DNS label and
       non-empty string values, and treat a missing, empty, unparsable or non-object value as the
       empty map, logged once without the value.
   2.2 No example shall commit a map of slugs to tenant ids; the guide shall say to remove one an
       application already has.
   2.3 The guide shall say that one piece of code serves both Environments, because each branch has
       its own value: `main` Development's customers, `production` Production's.
   2.4 The guide shall say that `get_project_detail` lists Development's customers as `customers` and
       Production's as `productionCustomers` (absent while the Platform does not offer it or
       Production is not ready), and that the application reads neither for the map.
   2.5 A new customer shall be served after a member presses **Update and redeploy** on the
       Customers page, in its Environment; the page says when the map is out of date.
   2.6 The `amplify.yml` line (D-2), the variable never with `NEXT_PUBLIC_` and never in a client
       component, the display name (D-3), and development (D-4).
   2.7 The variable is managed by the Platform: an agent never sets, changes or removes it with
       `amplify_set_env_vars`, which refuses it where the Customers page manages it.
   2.8 Sections 11 (symptoms), 12 (review checks) and 15 (its pointer to the map) follow.
3. **`add-external-oauth/SKILL.md`** (Engine passage only): its troubleshooting row for an unknown
   host says the map comes from `BUILDPAD_CUSTOMER_HOSTS` and Update and redeploy.
4. **`add-customer-onboarding`** (D-6):
   4.1 the module reads the key as no key when it is unset, empty or `off` (trimmed, any case);
   4.2 with no key the sign-in page offers no sign-up link, the sign-up page is not found, and the
       routes answer 404 before they do anything else;
   4.3 the skill says self-onboarding is Development's only, and that `off` on `production` is the
       Platform's;
   4.4 the key is managed by the Platform (D-7).
5. **`debugging-and-error-recovery`**: its customer-host row follows 2.5.
6. **`CONTRIBUTING.md`** (D-7): a section naming the variables the Platform manages.
7. **Tests in this repository** (`tools/repo-check/test/production-customers.test.mjs`):
   7.1 the guide's map block, types stripped, parses a value; drops a non-label key and a non-string
       or empty value; gives the empty map for a missing, empty, unparsable or array value; and logs
       without the value;
   7.2 no ts block of the guide holds a literal slug-to-id entry, and the guide names
       `productionCustomers`;
   7.3 the onboarding module's key reader, run, gives null for unset, empty, `off`, `OFF` and
       ` Off `, and the key otherwise; the sign-up page block calls `notFound()`;
   7.4 no text file names the variable with the `NEXT_PUBLIC_` prefix;
   7.5 the `add-external-oauth` pointer names `BUILDPAD_CUSTOMER_HOSTS`; `CONTRIBUTING.md` names the
       three managed variables;
   7.6 the existing XAppHub test still runs section 14.1's matcher against its host cases.
8. **Release.** No text a Supabase project's agent reads changes: a MINOR release, v10.5.0, with
   its changelog section and the README's install tag. No tag or Release here.

## Not in scope

- The CLI module (the parallel `buildpad-ui` session); this guide points at it.
- Self-onboarding in Production (the Platform's P-9 (b)), a second customer domain for Development,
  and an Engine-side resolver (P-7 (c)).
- `amplify-env-vars` and `backend-contract.json` (D-7).
- Tagging and releasing: the user does that after the merge. Then the Platform syncs the release
  into its starter kit (still on v10.1.0).
