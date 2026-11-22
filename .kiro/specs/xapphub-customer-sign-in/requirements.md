# XAppHub sign-in at customers — requirements and design (lightweight spec)

> Status: **approved** 2026-11-22 by the user ("Approve as recommended"). Written the same day,
> before any skill change. Decisions D-1 to D-5 SETTLED as recommended.
>
> This is the skills repository's part of the Platform spec `xapphub-customer-sign-in`
> (`buildpad-platform`, Decision 21 (b) of `project-tenants`), from its companion brief
> `companion-skills.md`. It is task 12.4 of `customer-tenant-skills` (TD-9).
>
> Read, not observed:
> - this repository at `origin/main` `56ce3bf` (v10.3.0, customer hosts). The brief was written
>   against `8b4f363` (v10.2.0); v10.3.0 added section 14 of the Mode_Guide and TS-H1, which this
>   spec builds on (see D-3);
> - the Platform's spec (requirements and design approved 2026-11-22), its `get_project_detail`
>   schema (`externalSignIn.customers.reached` is true when the project's gate is `open`) and the
>   starter kit's Customer tenants bullet, on the worktree `xapphub-customer-sign-in`;
> - the companion brief for the CLI's `external-oauth-engine` module (a parallel session in
>   `buildpad-ui`).
>
> No request was sent to any Engine, Platform or XAppHub, and no agent was run against a skill.

## Context

Since 22 November 2026 (dev on, production off) the Platform lets XAppHub sign-in and customers
be on together. Once a project Admin has confirmed on the Customers page that the application names
each customer's tenant at sign-in from its host name, the Platform makes every ready customer whose
switch is on trust the XAppHub client. An agent learns it from `get_project_detail`: the `my-apps`
connector's `externalSignIn.customers` is `{ reached, on, total }`. It is absent where the Platform
does not offer the feature (production today, or a project without customers), and `reached` is
false until the confirmation.

The skills still say "not available" without condition: TS-N3 in `add-external-oauth/SKILL.md` and
in section 4 of the Mode_Guide `engine-customer-tenants`, with section 5.3's bullet and section 4's
"Who could offer it later".

What the application must do is the Platform's Decisions X-1 (a), X-5 (a), X-7 (a) and X-8 (a):
the application owns the resolver (section 14's committed map), the host label is the customer's
`slug`, the bare host stays the Blueprint for the developers' own sign-in, and a person who signs
in at two customers' hosts gets an account in each.

## Decisions (settled 2026-11-22 by the user, each as recommended)

| # | Question | Options | Settled (as recommended) |
|---|---|---|---|
| D-1 | Is TD-9 met? | **(a)** Met 22 November 2026: the condition per project is read at run time from `get_project_detail`, and an absent `externalSignIn.customers` (production today) still stops. **(b)** Not met until production switches the feature on | **(a)**. The statement carries the condition, so it is right on dev and on production alike; waiting for production would keep the skills wrong for the projects where it is on |
| D-2 | How TS-N3 is replaced | **(a)** As `customer-hosts` D-2 did: retire TS-N3 (TD-9 in `met`), add **TS-N3m** (the condition: stop where `reached` is absent or false) and **TS-X1** (the how-to's rules where it is true). **(b)** One new statement holding both | **(a)**. It keeps the repository's pattern (a "not available" statement and a rules statement), and each stays short enough to copy |
| D-3 | TS-H1 says "nothing without a session uses the map", which XAppHub sign-in contradicts | **(a)** Amend TS-H1's text in place (same id, same *When*): the map's only use without a session is the XAppHub sign-in of section 15. **(b)** Retire TS-H1 and add TS-H2 with the new text | **(a)**. Its *When* does not change, and it is one day old; (b) adds an id for a wording change |
| D-4 | Where the how-to lives | **(a)** A new section 15 of the Mode_Guide, "XAppHub sign-in at customers", holding TS-N3m and TS-X1; section 4 keeps a one-line pointer. **(b)** Inside section 14 | **(a)**, as `customer-self-onboarding` S-2 put TS-O1 in a section of its own. Section 14 is for every app with customer hosts; section 15 only for those with XAppHub sign-in |
| D-5 | How the guide's host rules are tested | **(a)** A test that takes the guide's own code blocks (section 14.1's matcher and section 15's helper), strips their types with Node's `stripTypeScriptTypes`, runs them against host cases, and checks the route blocks' order and inputs as text. **(b)** Text checks only | **(a)**. The rules are code; running the guide's code is the closest this repository gets to observing them. Node 22.13 and later (CI uses 22) has the function |

## Draft statement texts

**TS-N3m** (requires TD-9; in `add-external-oauth/SKILL.md` and the Mode_Guide):

> On an Engine project with Customer_Tenants XAppHub sign-in is available only where
> `get_project_detail` reports the `my-apps` connector's `externalSignIn.customers.reached` as true:
> a project Admin has then confirmed on the Platform's Customers page that the application names each
> customer's tenant at sign-in from its host name. Where `externalSignIn.customers` is absent or
> `reached` is false, XAppHub sign-in is not available: its first sign-in would create the person's
> account in the Blueprint, outside every customer. Tell the developer so and stop: people sign in
> with a password, as the `add-multitenancy` skill's guide says. Where `reached` is true, build it as
> that guide `engine-customer-tenants` says in its section 15.

**TS-X1** (requires TD-9; same two files):

> On an Engine project with Customer_Tenants an XAppHub sign-in acts in the customer that the
> request's host name names. The sign-in start route and the callback each resolve the host with the
> application's customer host map: a customer's host sends that customer's `id` as `X-Tenant-Id` to
> `signInWithIdToken`, a subdomain the map does not name answers 404 before any redirect to XAppHub,
> and the bare host signs in to the Blueprint with `NEXT_PUBLIC_BUILDPAD_TENANT_ID`. The
> `redirect_uri` is the request's own checked origin followed by `/api/auth/callback`, and the
> tenant is never read from `state`, a query parameter or a cookie. Build it as the
> `add-multitenancy` skill's guide `engine-customer-tenants` says in its section 15, and tell the
> developer the three facts listed there.

**TS-H1**, amended (D-3 (a)); only the middle sentence changes, from "The map only chooses which
entry of the signed-in person's own `GET /api/auth/tenants` list to enter: the password sign-in
still sends no `X-Tenant-Id`, and nothing without a session uses the map." to:

> At a password sign-in the map only chooses which entry of the signed-in person's own
> `GET /api/auth/tenants` list to enter, and sends no `X-Tenant-Id`; its only use without a session
> is the XAppHub sign-in of section 15 of that guide.

(TS-H1 ends "Build it as … section 14", so "that guide" reads after it; the final wording is checked
when it is copied.)

## Requirements (EARS)

1. **Registry.** When TD-9 is met, the registry shall retire TS-N3 (TD-9 in `met`), and make TS-N3m
   and TS-X1 (each requires TD-9) live in `add-external-oauth/SKILL.md` and the Mode_Guide; TS-H1's
   amended text shall stand in each of its three files. `CONTRIBUTING.md`'s register, the machine
   copy and the guard test's texts shall agree.
2. **The condition.** Both statements, and every passage that repeats them, shall say: `reached`
   absent or false → not available, tell the developer and stop; `reached` true → build it as
   section 15 says. When it is false, the passage shall say who gives the confirmation (a project
   Admin, on the Platform's Customers page).
3. **Section 15** of the Mode_Guide shall say how to build it, on top of section 14 (built first if
   it is not):
   3.1 check `get_project_detail` and tell the developer `on` of `total` customers;
   3.2 the host: the first `x-forwarded-host` entry, else `host`, lower case, port dropped; a
       customer's host is exactly one DNS label in front of the customer domain, and the label is
       the customer's `slug`; the map is section 14.1's, from `customers[]`; a new customer is served
       once its entry is added and the app deployed;
   3.3 one helper, beside section 14.1's, that gives the sign-in's tenant: `customer` (its `id`),
       `blueprint` (the bare host, the hosting's default domain, `localhost`:
       `NEXT_PUBLIC_BUILDPAD_TENANT_ID`), or `unknown`;
   3.4 the start route: `unknown` answers 404 before any redirect; `redirect_uri` is
       `publicOrigin(request)` (section 14.4, the checked customer origin on a customer's host)
       followed by `/api/auth/callback`, and the code exchange sends the same value;
   3.5 the callback: resolves the host again, never from `state`, a query parameter or a cookie;
       `X-Tenant-Id` is the helper's tenant id; `unknown` answers 404; the flow cookie stays
       host-only, so a flow ends on the host it began on;
   3.6 after the sign-in: an account with no role goes to the pending-access page, as today; a
       customer's starting role is set per customer on the Platform's Customers page, where it is
       offered, not with the `external-sign-in` tool, which acts in the Blueprint;
   3.7 the redirect URLs: one per customer host, listed on the Platform's Connectors page, added in
       XAppHub by hand; a development host `<slug>.localhost:<port>` needs its own;
   3.8 a new use of the map: before, it only chose among a signed-in person's own customers; now its
       tenant id is sent before any session. A forged host changes only which tenant that person's
       own sign-in targets, and the Engine accepts the token only in a tenant that trusts the client;
   3.9 the three facts to tell the developer: a person who signs in at two customers' addresses gets
       an account in each; anyone with an XAppHub account for this app can get an account (no role,
       or the customer's starting role) in a customer whose XAppHub sign-in is on, by opening its
       address, and a project Admin turns it off per customer on the Customers page; a customer
       administrator never signs in with XAppHub, they use their password;
   3.10 the CLI: the `external-oauth-engine` module, in a release that knows the mode
       `customer-tenants`, does 3.3 to 3.5 itself; the agent checks that the installed start route
       and callback do, and otherwise updates the CLI or changes the two routes as the section shows.
       It points the module at the application's one map, never a second copy. No file name of the
       module is relied on;
   3.11 tests the application adds: the helper's cases, the start route's 404 before the redirect,
       the callback's `X-Tenant-Id` per host, and that a `tenant` query parameter changes nothing.
4. **The rest of the Mode_Guide.** Section 1 (status), section 4 (TS-N3 and its "Who could offer it
   later" replaced by a pointer to section 15), section 5.3's bullet, section 11 (symptoms: 404 at
   the sign-in start on a customer host; `sign_in_refused` for everyone at one customer's host;
   XAppHub's "redirect_uri does not match" on a customer host) and section 12 (review checks).
5. **`add-external-oauth/SKILL.md`** (Engine passage only): TS-N3m and TS-X1 in place of TS-N3; Step
   1 says that a customer host's callback is added by hand from the Connectors page; step 4 of "How
   the sign-in works" and "Accounts and roles" name the host's customer in the mode
   `customer-tenants`; two troubleshooting rows.
6. **Tests in this repository** (`tools/repo-check/test/`):
   6.1 the registry: with TD-9 in `met`, a file holding TS-N3 fails `ts-retired`, each file of
       TS-N3m's and TS-X1's `in` without it fails `ts-required-missing`; without TD-9, TS-N3m or
       TS-X1 anywhere fails `ts-held-back`;
   6.2 the condition: TS-N3m's text names `reached` absent, false (stop) and true (section 15);
   6.3 the guide's host rules, by running section 14.1's and section 15's code (D-5 (a)): one label
       only, the port dropped, upper case lowered, lookalikes and two labels refused, a mapped slug
       → its tenant, an unmapped one → `unknown`, the bare host and `localhost` → the Blueprint;
   6.4 the route blocks of section 15: the start route's 404 for `unknown` comes before its
       redirect, and neither block takes the tenant from `searchParams`, `state` or a cookie.
7. **Release.** No text a Supabase project's agent reads changes: a MINOR release, v10.4.0, with
   its changelog section and the README's install tag. `customer-tenant-skills` task 12.4 is marked
   done with a note.

## Not in scope

- A public page of one customer (TD-8; TS-N2m unchanged).
- A resolver service (Platform X-1 (c), a later Engine entry).
- Changing the CLI module (the parallel `buildpad-ui` session).
- Text a Supabase project reads, and the `add-external-oauth` description.
- Pushing, tagging, releasing: only with the user's explicit OK. After the tag, the Platform vendors
  the skills from it and syncs them into its starter kit.
