---
name: Organisation Platform role assignment: the exact implementation
description: The build recipe for Automation > Role assignment on the Organisation Platform in a Supabase-backed Buildpad app, exactly as shipped in getFeedback and xWorkspace. Three custom screens (list, create and open a rule, Test rules drawer) on the package's headless builder-core, never the ready-made RulesBuilder; the rules store, ceiling, decision, placement and invariants; the real code in assets, the wiring patch, what to adapt and a checklist.
applyTo: "**/org-rules/**,**/role-assignment/**,**/automation/**"
---
<!-- buildpad-backend-file: supabase -->

# Automation > Role assignment: the exact implementation

This is the build recipe for **Automation > Role assignment** (the rule engine and its three screens) on top of the Organisation Platform. It describes what XAppHub, getFeedback and xWorkspace actually ship, and `assets/organization-platform/role-assignment/` holds the real code of getFeedback and xWorkspace, copied unchanged. **Copy that code and adapt only what the adaptation table in section 5 lists. Do not design your own.**

## Where the code is

The real getFeedback code (Mantine, multi-tenant, hint-cookie placement) is in `assets/organization-platform/role-assignment/`, with paths that mirror the app: copy each file to the same path in your app. `wiring.patch` is the diff of the **existing** files the feature touched (sign-in routes, sidebar and layout, help map, `amplify.yml`, `package.json`); follow it. The single-organisation variant used by xWorkspace (placement inside the SSO callback, global roles) is described in sections 4 and 5 and its code is in the Organisation Platform skill, not here. The people import and the offboarding review are in `assets/organization-platform/people-sync/` with their own guide, `organization-platform-people-sync.instructions.md`.

**This is Supabase-project code** (it writes `daas_user_roles` rows and reads the Supabase session), so the file set is marked for Supabase projects and left out of the kit of an Engine project. The rules in sections 0 to 3 and 6 to 9 are not backend-specific. The getFeedback tests are in the Organisation Platform skill.

## 0. The mistake this recipe exists to prevent

If an assistant is asked to "implement Automation > Role assignment" without this recipe, it reaches for the package's ready-made editor, `<RulesBuilder>` from `@xtremax/organisation-platform/react` (or `<org-rules-builder>`). That gives **one panel** where each rule is an expandable card with `Not valid` and `No outcome` badges and a toggle, `Include people who match`, `Exclude`, outcome cards and a `Fix before saving` box. It works, but it is **not** what the three apps ship, and it has none of their list, priority, test drawer or save behaviour.

**What the apps ship instead:** three separate screens built on the package's **headless** builder (`@xtremax/organisation-platform/builder-core`: `createRuleBuilder`, `createDescriber`, `BUILTIN_ATTRIBUTES`, `customAttribute`) and the app's own components. The engine and the validation are still the package's; only the screens are the app's.

- **Never mount `<RulesBuilder>`, `<org-rules-builder>` or `ConditionGroupEditor` for role assignment**, unless the user explicitly asks for the package's built-in screen. (getFeedback's plan kept it only as a fallback if porting the screens failed.)
- If the result shows rules as expandable cards with `Not valid` / `No outcome` badges, it is the wrong build. Start again from section 2.

## 1. The three screens (what it must look like)

Routes, in each app: `…/automation/role-assignment` (list), `…/new` and `…/[ruleId]` (the same form). Rules are the entries of **one JSON rule set** (not rows in a collection), so the list is **not** a collection list component, and its order is the data.

### 1a. List (`role-assignment-list.tsx`)

- **Header:** title **Role assignment**, a one-sentence description, and on the right a **Test rules** button (shown only when there are rules, disabled when the platform isn't configured) and a **Create rule** button (disabled unless editable).
- **Connection status** line for global administrators (see `connection-status.tsx`), then the **notices** (section 1d).
- **A table with these columns:** `Priority` (1, 2, 3, …) · `Rule` (name) · `When` (a one-line summary from `createDescriber(config).rule(rule)`) · `Assign role` (`describer.outcome(id)`, or "No decision" for a role that no longer exists) · `Enabled` (toggle) · move up and move down arrows.
- **Rows open the rule** (click or Enter). The toggle and the arrows **save immediately**, because each is one small change to the whole rule set. Order is priority: the first enabled rule that matches a job decides it.
- Empty state: "No role assignment rules yet. Nobody gets a role … from this automation. Use “Create rule” to add one."

### 1b. Create and open a rule (`rule-form-page.tsx`, one form for both)

- Back link **← Role assignment**, a title (**New rule** / **Edit rule**) and a subtitle, then the notices.
- Card **Rule name** (max 120 characters, placeholder e.g. "Product managers").
- Card **Include**: if the rule has no include group it shows "No include conditions: the rule applies to everyone except the people excluded below." and **+ Add inclusion**. Otherwise it shows the condition group titled **Include people who match** (with **Remove inclusion** when an exclusion exists).
- Card **Exclude**: "People who match these conditions never get this rule, even if they match above." with **+ Add exclusion**, or the group titled **Exclude people who match** (with **Remove exclusion**).
- A yellow **Check these conditions** alert for warnings (a designation, unit or option that no longer exists upstream).
- Card **Assign this role**: **radio cards**, one per outcome (label bold, description under it), **weakest first** so a new rule defaults to the safer role.
- Buttons: **Delete rule** (a muted link, only when editing, with a confirm modal "Delete this rule?"), **Cancel**, **Save rule**. Save is **disabled** (with the hint "To save, name the rule, give it at least one condition with a value, and choose a role.") unless: the screens are editable, the name is not blank, the outcome exists, at least one condition has a value, and the builder reports no blocking error.
- **Saving:** set the trimmed name, **drop conditions with no value** (and any group that leaves empty), then send the **whole rule set** with the version it was loaded at. On success a toast and back to the list. Delete sends the saved set without the rule.
- The builder holds the whole rule set but is only ever asked about this one rule (`builder.openRule(id)` or `builder.addRule()`); the page is **remounted with a key** when data reloads, so the form starts again from what is now saved.

### 1c. A condition group (`rule-conditions.tsx`)

`When  [OU Path | System | Attribute]  [attribute]  [operator]  [value]  ✕`, `and …`, `+ Add condition`. Every edit goes through the builder store, so the package's validation decides what is allowed. The controls come from what the store says about the attribute: its operators, and its values (a live list of designations or units chosen **by name and stored by id**, a fixed list of choices, or free text). The group header has two **All** and **Any** pills (the mode of the group), and each condition row ends with a **✕** that is disabled when removing it would take the group below its minimum. The package's built-in screen instead says **All of these / Any of these** and has a **Remove** button on the group: another sign of the wrong build.

### 1d. Notices and the tester

- **Notices** (`notices.tsx`) say why the rules cannot safely be edited, so the controls never just fail silently: *not set up here yet* (the collections don't exist), *connection not configured* (no platform address or key), *editing is paused* (the live lists could not be read), *the saved rules were set aside* (stored rules were untrusted), and the `409` reload prompt ("Someone else changed the rules").
- **Test rules** (`test-rules-drawer.tsx`) is a **right-hand drawer**: look a person up **live by email** (nothing about people is stored), run the **saved** rules against them, and show per job (a designation held at a unit) the role given and **which rule decided, by its position in the list** ("Rule 2: Product managers"). It writes nothing. A failed lookup is an error, never "no designations".

## 2. The data flow

```
Admin ─► /…/automation/role-assignment (list · new · [ruleId] · Test rules)
              │  the browser never sees the platform key
              ▼
   GET/PUT  /api/org-rules          ◄── authorised caller, then the service credential
   POST     /api/org-rules/test         the server re-validates every save, rebuilds the payload, 409 on a stale version
              │
              ▼
        org_rule_sets (versioned; no generic write path)

A person signs in ─► placement (section 4) ─► people?email= (live) ─► evaluate rules ─► reconcile
                                              roles written ⇄ a grants collection (provenance)
```

**The pieces, in the order they were built** (paths are in the assets):

| Piece | Files | Role |
|---|---|---|
| Platform door | `lib/org-platform/client.ts` | The only place that talks to the platform: server-only, read-only key read on every request, `isKnownPerson` |
| Rules store | `lib/org-rules/store.ts`, `parse.ts`, `constants.ts` | One versioned row; reads set aside anything untrusted; 403/404 means "not provisioned"; 5xx throws |
| The ceiling | `lib/org-rules/outcomes.ts` | The roles a rule may give, strongest first. Enforced on save, on evaluation and at grant time |
| The decision | `lib/org-rules/decide.ts` | One function shared by sign-in, the tester and any preview. `null` means "no decision" |
| System attributes | `system-attributes.ts`, `system-defs.ts`, `account.ts` | Facts only this app holds (section 6) |
| Catalogs | `lib/org-rules/catalog.ts` | Live designations, units and custom attributes; any failed read makes the editor read-only; briefly cached |
| Builder config | `lib/org-rules/builder-config.ts` | Turns outcomes, catalogs and System attributes into the headless builder's config |
| Access | `lib/org-rules/access.ts` | Who may read and write rules; the scope is always the session's, never a request body |
| Routes | `app/api/org-rules/route.ts` + `test/route.ts` (getFeedback), `app/api/automation/role-rules/…` (xWorkspace) | GET/PUT and the tester |
| Placement | getFeedback: `lib/org-platform/onboard.ts`, `sync-hint.ts`, `app/api/org-platform/sync/route.ts`. xWorkspace: `lib/org-rules/apply.ts`, `sign-in.ts` | Section 4 |
| Screens | `components/role-assignment/*` (getFeedback), `components/automation/role-assignment/*` (xWorkspace) | Section 1 |
| Pages | `app/dashboard/automation/role-assignment/{page,new/page,[ruleId]/page}.tsx` | Three thin pages that render the screens |
| Cleanup and help | `lib/org-rules/cleanup.ts`, `content/role-assignment.mdx` | Delete a tenant's rows with the tenant; a help article |

`wiring.patch` in each app's folder is the diff of the **existing** files the feature touched (sign-in routes, sidebar, layout, help map, `amplify.yml`, `package.json`). Apply or follow it.

## 3. The decision, and why it is safe

- **The ceiling.** A fixed list of the roles a rule may give, strongest first (getFeedback: Tenant Admin, Tenant Member from environment ids; xWorkspace: Administrator, User; XAppHub: its four organisation roles). Never an application-wide administrator role the app does not already allow, and never editable by whoever writes rules. Checked three times: `allowedOutcomeIds` on save, in `decideByRules`, and when a role row is written.
- **Each job is checked on its own.** A job is one designation held at one unit. `decideByRules` keeps only results that carry both a designation and a unit and an outcome inside the ceiling, and where several rules match one job it keeps the strongest role.
- **A person with no designation is never matched,** not even by an attribute-only rule, because a result needs a designation and a unit. That is accepted (most Xtremax staff hold a designation); the plans record it.
- **"No decision" is the safe answer.** No enabled rule, an unreadable or untrusted rule set, an unknown person, a lookup that failed, a designation no rule decided, or a job with no resolved unit: none of them grants anything, and **all block revocation**. A missing or broken rule can never take access away.
- **Revoking needs a complete picture:** the platform answered with a person it knows (`isKnownPerson`: has a name, an attribute or a role, because `roles: []` alone means both "no designations" and "unknown person"), the rules were readable and enabled, and no job is undecided or unresolved (`orgUnitId: null` is unresolved, never "none"). The last administrator is never removed or demoted.
- **A human placement always wins.** A role row the placement did not write (the creator, an invite, an admin's edit) is a person's decision; the placement writes nothing there. Anything unreadable counts as "placed".
- **Provenance.** Every row placement writes is recorded in a grants collection, and only a recorded row that still has the role it was written with may be changed or removed. An admin-edited row is released, not reverted.

## 4. Placement: when it runs

Two designs exist. They share the decision above and differ in **when** the platform is asked.

- **getFeedback (recommended for a multi-tenant app, or any app where a slow platform must never hold a login up).** Placement runs on the person's **first page load after sign-in**, never inside a sign-in. The sign-in paths (OAuth callback, the Supabase fallback, email login) only set a short-lived **hint cookie** (`org_sync_pending`) and only when placement is switched on and the platform is configured. The dashboard shell sees it, calls `POST /api/org-platform/sync`, and shows a brief "Setting up your workspaces" state. The endpoint takes no input and always acts for the session's user, so a tampered cookie changes nothing. It runs one placement per person at a time (an in-flight map shares one answer between two tabs), clears the cookie on success, and keeps it on a failed lookup, capped at 3 attempts (`MAX_SYNC_ATTEMPTS`). Paths with no dashboard load (the Claude connector's OAuth completion) call the same function directly **before** auto-creating a tenant. A feature flag (`ORG_ROLE_ASSIGNMENT_ENABLED`) keeps the whole path inert until a pilot.
- **xWorkspace (a single-organisation app with one default role).** Placement runs **inside the SSO callback** right after the default role is ensured (`applyRoleRulesAtSignIn`), with a 3 second platform lookup and a hard 8 second deadline raced against it, and everything caught, so it can never fail a sign-in. It is **additive on top of the default role**: everyone keeps the default role; rules can add Administrator and take back one they added.

Either way: one `people?email=` call, short timeout, **no retry**, email lower-cased and trimmed. If it fails, nothing changes anywhere.

## 5. What to adapt for a new host (and nothing else)

| Concern | getFeedback | xWorkspace | Adapt by |
|---|---|---|---|
| Unit of rules | One rule set per **tenant** (`tenant_uri`) | **One** rule set (`ORGANIZATION = 'xtremax'`) | Key the store by whatever your app's unit of ownership is |
| Roles a rule may give | Tenant Admin, Tenant Member (env ids) | Administrator, User (seeded ids) | Write the ceiling list and the labels and descriptions shown on the outcome cards |
| Who may write rules | Tenant Admin at the exact scope, or global Administrator | `automation:manage` module key | `access.ts` |
| Service credential | `SERVICE_ACCOUNT_KEY` | `asSystem` | `store.ts` reads and writes |
| Where roles live | Scoped `daas_user_roles` rows, `X-Resource-Uri` per tenant | Global `daas_user_roles` rows | The placement function |
| System attributes | Email domain, Sign-in method (`attributes.getfeedback.*`) | Email, Email domain | Decide from real rows (section 6) |
| Sign-in trigger | Hint cookie + sync endpoint | Inline in the SSO callback | Section 4 |
| UI kit and styles | Mantine + `tokens.ts` / `styles.ts` | The app's own shell + `role-assignment.css` | Restyle; keep the structure of section 1 |
| Sidebar | `navItems` entry gated by the module key `role-assignment:manage` | Shell entry | `wiring.patch` |
| Cleanup | Delete a tenant's rows with the tenant | Not needed | `cleanup.ts` |

**Everything else is copied as it is.** In particular: the three screens and their wording, the `useRuleBuilder` and `useRuleBook` hooks, the store and parse logic, `decide`, the routes' shapes, the notices, and the tester.

## 6. System attributes

The platform says nothing about the person's account in your app, so conditions that need "how do they sign in" or "what is their email domain" use facts the app supplies, namespaced (`attributes.<app>.*`), added to the person before the engine runs, and **overwriting** anything the platform sent under that name. Decide them from real rows, not the schema: getFeedback offers Email domain and Sign-in method; xWorkspace found that `provider` is `email` for every account and `status` is always `active`, so it offers Email and Email domain only. The builder groups them as **System** beside the platform's **Attribute** and **OU Path**. An unreadable account writes nothing at sign-in and fails the tester with `502`; "no account yet" is an answer.

## 7. Invariants and tests to carry

- A tenant (or the app) with no enabled rule decides nothing: nobody gains or loses a role.
- A human placement is never touched; unreadable existing roles mean write nothing.
- Only recorded rows are changed or removed; an admin-edited row is released.
- Only roles inside the ceiling can be granted, checked on save, on evaluation and at grant time.
- A corrupt, unreadable or unknown-version rule set means "no decision" and revokes nothing.
- An unresolved unit, a platform timeout or a rejected key revokes nothing.
- The last administrator is never removed or demoted.
- A rule set is only read or written for the caller's own scope; a stale `version` is `409`; a rule can only give a role in its own scope.
- A person the platform does not recognise never loses a role.
- The sync endpoint takes no user input; a tampered hint cookie changes nothing.
- The platform key never reaches a browser, a log or a URL.

The assets include the suites (`decide.test.ts`, `onboard.test.ts`, `sync-hint.test.ts`, the route tests; xWorkspace: `apply.test.ts`, `rules.test.ts`, `store.test.ts`, `routes.test.ts`). A port that passes them keeps the safety properties.

## 8. Setup and rollout

1. Create the two collections (not scope-registered, no policy grant to anyone but the service credential): `org_rule_sets` (`tenant_uri` or key, `schema_version`, `rules` json, `version`, `updated_by`) and the grants collection (`org_role_grants`: `user_id`, `tenant_uri`, `role_id`, `role_row_id`; xWorkspace: `role_rule_grants`). Until they exist the screens say "not set up here yet" and nothing decides anything.
2. Register the module access key (getFeedback `role-assignment:manage`; xWorkspace `automation:manage`) and grant it to the policy that should see the sidebar entry. The key only drives visibility; the API checks the real authority.
3. Set the server variables (server-only): `ORG_PLATFORM_URL`, `ORG_PLATFORM_API_KEY` (the read-only key from the connector is enough), and, for the hint-cookie design, `ORG_ROLE_ASSIGNMENT_ENABLED` (leave `false` until the pilot). **Add them to `amplify.yml`** so they reach the server (`wiring.patch` shows how).
4. Pilot with one internal scope and test accounts: grant, change, revoke, hands off, platform down, two scopes. Then switch it on.
5. Switching off: unset the flag or the key (no code deploy) and everything stops; roles already granted stay and are recorded in the grants collection.

## 9. Checklist: did you build the same thing?

- [ ] **Not** `<RulesBuilder>`: three screens on `builder-core` with `useRuleBuilder` and `useRuleBook`
- [ ] List with the columns Priority, Rule, When, Assign role, Enabled and the arrows; toggle and arrows save immediately
- [ ] One form for create and open, with the Include and Exclude cards, outcome radio cards weakest first, and Delete, Cancel and Save rule
- [ ] Save is disabled until the rule is named, has an outcome and at least one condition with a value; blank conditions are dropped on save
- [ ] The whole rule set is saved with its version; `409` shows the reload prompt
- [ ] The Test rules drawer looks a person up live and names the deciding rule
- [ ] The notices cover not set up, not configured, editing paused, rules set aside, and the reload prompt
- [ ] The ceiling is enforced three times; "no decision" never revokes; the last administrator is never removed
- [ ] Placement never delays a sign-in and never throws into it
- [ ] The platform key is server-only and listed in `amplify.yml`
