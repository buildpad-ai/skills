---
name: Organisation Platform Reference
description: How to integrate with the Organisation Platform once it is connected via the Buildpad platform's Connectors page — the @xtremax/organisation-platform package first (typed client, rule engine, rule builder), the raw external API only where the package does not apply — including the Automation > Role assignment (rules) feature for the admin domain
applyTo: "**/*.{ts,tsx,js}"
---

# Organisation Platform, via `@xtremax/organisation-platform` (first choice) or its external API

**Identity check — read this first if you arrived here from a user request like "show our org chart", "use the job titles from the Organisation Platform", or "assign roles from designations":** "Organisation Platform" is the `displayName` of a specific connector on this project's Connectors page (`provider: "organization-platform"` in `connectors[]`). If `connectors[]` contains that entry, that is what the user means — proceed with this doc, do not ask whether they want a custom-built org structure in DaaS instead. Only if `connectors[]` has no such entry: tell the user to connect it on the Connectors page, or ask whether they want a self-contained org model built in this app's own collections (don't silently build the latter).

This doc assumes the Organisation Platform is already connected for this project (check `get_project_detail`'s `connectors[]` before writing any of this). `connectors[]` guarantees exactly two env vars — `ORG_PLATFORM_API_KEY` and `ORG_PLATFORM_URL` — always read the exact names from `connectors[]`, don't hardcode them.

**What was connected:** `ORG_PLATFORM_API_KEY` is an `orgapi_…` key for **one org unit**. If the user chose auto-provision, Buildpad issued it: it is **read-only** and reaches the organisation root, with no onboarding or personal-data scope. If they pasted their own, a platform admin or Organization Unit Admin issued it for the organisation root or any unit beneath it. Either way it reaches that unit's whole subtree — nothing above it, nothing beside it, and an auto-provisioned key is revoked when the project disconnects. `ORG_PLATFORM_URL` is the Organisation Platform deployment for this environment.

**The API key is a secret.** Unlike a publishable widget key, it is a bearer credential with no expiry, and the platform stores it in plain text, so the key value is the whole credential. Use it only in server-side code (API routes, server components, DaaS extensions). Never put it in a client component, a `NEXT_PUBLIC_*` variable, a URL, or a log line.

**Running locally (`pnpm dev`):** the `connectors[]` entry carries `envVars` — the actual decrypted values. Write them into `.env.local` (don't commit them) and restart `pnpm dev`.

**Deploying:** connecting only stores the credential in Buildpad — it does **not** push the env vars to the deployed app's Amplify environment. Push the `envVars` map with `amplify_set_env_vars` and follow with `amplify_redeploy` (see the `amplify-env-vars` skill). These are **server-only** variables, so the app's `amplify.yml` must also write both into `.env.production` during the build, or the deployed server code can't read them (the generated `amplify.yml` doesn't list any connector variables by default):

```yaml
        - echo "ORG_PLATFORM_API_KEY=$ORG_PLATFORM_API_KEY" >> .env.production
        - echo "ORG_PLATFORM_URL=$ORG_PLATFORM_URL" >> .env.production
```

Put them before `pnpm build`. Keep the file's existing line endings.

## Use the package first

**Default to `@xtremax/organisation-platform` for every integration with the Organisation Platform.** It is the standard way to read the organisation, to decide with rules, and to give admins the rule-builder screen. Reach for the raw `external/v1` API (sections below) only where the package genuinely does not apply — for example a non-Node/TypeScript backend, or a sandboxed runtime that cannot import an npm package (such as a DaaS cron or extension, which would use `services.fetch`). Even then, the rules below still apply, and you can still use the package's `/contract` types for the shapes.

```bash
pnpm add @xtremax/organisation-platform@~0.2.2   # Node 18+, public on npm, no token needed
```

- **Licence is fine for Buildpad apps:** the package's licence covers every app generated through Buildpad. No token or registry setup is needed.
- **Pin a minor** (`~0.2.2`) while the package is below 1.0, since a rule-format or export change is a minor bump. Never `*` or `latest`, and don't confuse it with `0.1.0` of the same name, an unrelated earlier prototype.
- `react` and `vue` are optional peers; install only the one you import. Every entry point works with `import` and `require` and ships types.

| You need to... | Use |
|---|---|
| Call any endpoint (units, designations, people, attributes, changes, onboarding) | `/client` → `createClient(...)`, **server code only** (it throws in a browser and is hidden from browser bundles on purpose) |
| Type a response | `/contract` → `PersonLookup`, `OrgRole`, `OrgUnit`, `PersonAttribute`, `OnboardingRequest`, ... (types only) |
| Turn a person into engine input, or lists into builder lists | `/adapter` → `toSubject`, `toCatalogs`, `unresolvedRoles`, `fromDesignationMappings` |
| Decide "which outcome does this person get?" | `/engine` → `evaluate`, `validateRuleSet`, `migrate` (pure, no network) |
| Give admins an editor for rules | The **headless** store in `/builder-core` (`createRuleBuilder`, `createDescriber`), behind your own three screens. **Not** the ready-made `<RulesBuilder>` / `<org-rules-builder>` |

### First shot: build Automation > Role assignment in the admin domain

When the Organisation Platform is connected and the app has people with roles, **build Automation > Role assignment (rules) in the app's first pass, in its admin domain**, unless the user says otherwise. Don't ask whether they want a one-to-one designation mapping instead; rules are the standard, and a plain mapping is just a rule set of "Designation is X gives Y". The minimum first-shot slice:

1. **Install the package** and add the server-only client module (next section).
2. **Provision the rule storage**: one versioned row per organisation (see "What the app owns" §2), through the normal DaaS collection/migration skills, plus a sign-in grant-tracking collection if sign-in will grant roles.
3. **Server routes** under the admin API: `GET` (rules, version, live catalogs, the grantable outcomes), `PUT` (validate again, versioned save), `POST …/test` (the tester).
4. **The screen**: an **Automation > Role assignment** page in the app's admin area, gated by an admin check **plus** a dedicated capability (see `grant-module-access`; `create-rbac` for the roles), built as **three screens on the headless `builder-core` exactly as `organization-platform-role-assignment.instructions.md` describes** (never the package's ready-made `<RulesBuilder>`). Add the nav entry beside the app's other admin screens.
5. **The sign-in decision** that applies the rules (§ "At sign-in"), with "no decision" as the safe default.
6. **Ask the user only one thing**: which of the app's roles rules may grant (the outcome list, strongest first, never an administrator role). If they haven't said, propose the app's non-administrator roles.

Everything the engine needs is below. Don't hand-write a rule engine, a rule editor, or a retrying client.

## The one rule

The app talks to organisation data **only** through `{ORG_PLATFORM_URL}/api/external/v1/*`. Never call the Organisation Platform's own DaaS or database, never store its `uri_path` values (no endpoint returns one, and they mean nothing outside that deployment), and never author org units, designations or assignments in this app's collections as a second source of truth. Join on **id** and **email** only; names are display text and can be renamed without notice.

Almost every endpoint is `GET`. The single write, `POST /onboarding`, needs a separate key scope (see "Key scopes").

## Designation is not an access role

- A **designation** is a business title a person holds at a unit ("Branch Manager"). The API paths and fields still say `org-roles` / `orgRoleId` — same thing.
- An **access role** (`ou_admin`, `ou_member`) is system permission inside the Organisation Platform itself. The read API does not expose it, and you almost never need it.
- Which buttons or pages a person sees *in this app* is your own mapping: designation **id** → your own role or module access. Never gate on a designation name.

## Client: one server-only module

Put every call behind a single module; nothing else in the app builds these requests. With the package, that module is a few lines around its server-only `createClient`, which already pages `/org-units` internally, times out, retries `502` and `429` (never `401`/`404`) and throws a typed `OrgPlatformError` (branch on `error.code`, never the message; it never carries the email or the key):

```ts
// lib/org-platform/client.ts — server-side only
import { createClient } from '@xtremax/organisation-platform/client';

export const platform = createClient({
  baseUrl: process.env.ORG_PLATFORM_URL!,
  apiKey: () => process.env.ORG_PLATFORM_API_KEY!, // a function: rotation needs no restart
});
// platform.people(email, { timeoutMs: 3000, retry: false })   on the sign-in path
// platform.orgUnits(), orgRoles(), orgRoleAssignments(), personAttributes(), changes({ cursor }), snapshot(), onboard(...)
```

`baseUrl` must be `https` (plain `http` is refused outside localhost), and the key is read through a function so a rotated key needs no restart.

**Only if the package does not apply** (see above), write the thin module below instead:

```ts
// lib/org-platform/client.ts — server-side only
export interface OrgPlatformResult<T> {
  ok: boolean;
  status: number;
  body: T;
}

export async function orgPlatformFetch<T = unknown>(
  path: string,
  timeoutMs = 10_000
): Promise<OrgPlatformResult<T>> {
  const base = process.env.ORG_PLATFORM_URL?.replace(/\/$/, '');
  const apiKey = process.env.ORG_PLATFORM_API_KEY;
  if (!base || !apiKey) throw new Error('Organisation Platform is not configured');

  const res = await fetch(`${base}/api/external/v1${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}
```

Browser components call **your own** API route, which calls this module:

```
browser → this app's API route → Organisation Platform external/v1
```

Responses are `{ "data": ... }` (with optional `meta`) on success and `{ "errors": [{ "message": "..." }] }` on failure.

## Endpoints (what the client wraps)

| Path | Returns |
|---|---|
| `GET /org-units?unitId=&limit=&offset=` | The key's unit plus its full subtree: `{ id, name, parentId }`. Paged: `limit` default 100, max 500; `meta` is `{ limit, offset, total }`. With `?unitId=` the answer is **one object** in `data`, not an array. |
| `GET /org-roles` | The designation catalog: `{ id, name, description, status, orgUnit: { id, name } }`. `orgUnit` is the unit that owns it, at any depth. Not paginated, and **returns at most 500 designations**. |
| `GET /org-role-assignments` | Every assignment in the subtree: `{ id, orgRoleId, orgUnitId, assignee, createdAt }`. `assignee` is `{ userId, email, firstName, lastName, attributes }` plus the person's system fields (`firstName` and `lastName` from a platform updated on 2026-10-26; absent on an older one). **Not paginated.** |
| `GET /people?email=` | One person: `roles`, `firstName`, `lastName`, `attributes`, plus system fields. |
| `GET /person-attributes` | The catalog behind `attributes`: `{ key, name, type, options, orgUnit }`. |
| `GET /changes?cursor=&limit=` | Pull-based change feed for units, designations and assignments. No webhooks exist. |
| `POST /onboarding` | The one write. Needs the `onboarding:write` key scope. |

**The top unit.** The key's own unit comes back with `parentId: null`, even if it has a real parent in the platform. You can't see, and must not infer, anything above it.

**Hierarchy has no fixed depth and no per-level type.** Walk `parentId` up to `null`, or use a person's `orgUnitPath`; never hardcode "the department is at depth 2". Unit names are unique among siblings (case-insensitively), which makes a name a safe label within one level — but still not an identity: the same name recurs freely in different branches, and names can be renamed. Key on `id`.

**Pagination.** `/org-units` is paged server-side. If you need the whole tree, loop `offset` until you have `meta.total` rows, inside your server module. Never expose upstream paging to your own callers, or a large tree is silently truncated.

### `GET /people?email=`

One person's designations, each with the unit path back to the key's top unit, plus who they are.

```ts
interface PersonLookup {
  email: string;                  // exactly as you asked for it
  roles: Array<{
    orgRoleId: string;
    orgRoleName: string | null;   // null only if the designation's owner is outside the key's scope
    orgUnitId: string | null;     // null = could not be resolved
    orgUnitName: string | null;
    orgUnitPath: Array<{ id: string; name: string }>; // key's top unit first, holding unit last; any length
  }>;
  firstName: string | null;
  lastName: string | null;
  attributes: Record<string, string | string[]>;
  country: string | null;         // ISO 3166-1 alpha-2
  timezone: string | null;        // the country's default IANA zone; derived, never stored
  reportsTo: { email: string; firstName: string | null; lastName: string | null } | null;
  mobile?: string | null;         // only with the personal-data:read scope; ABSENT otherwise
  dateOfBirth?: string | null;    // only with the personal-data:read scope; ABSENT otherwise
}
```

- Matching is a **case-insensitive exact match on the holder's email**, however the assignment was recorded (by typed email, or by the account that resolves to one).
- **Zero matches is `200` with `roles: []`**, not a 404, and cannot be told apart from "no such person". A person recorded with no designation left still returns their names and attributes.
- `firstName` / `lastName` come from the holder's platform account when it has a name, else the organisation's record, else `null`.
- `attributes` holds the person's custom attributes **owned at or below the key's scope**, keyed by attribute `key`. A single-choice or free-text value is a string; a multiple-choice value is an array (treat it as a set). An unset attribute is **absent**, not `null` or `""`. `{}` means none.
- `country`, `timezone` and `reportsTo` are always present (`null` when nothing is recorded). For a key scoped **below the organisation root**, `reportsTo` is `null` unless the manager holds a designation inside the key's scope.
- A failure reading attributes or the manager's names is a `502`, never empty values that would read as "this person has none".
- Roles resolve their unit from the full subtree, so `orgUnitId` is reliable here even on a very large tree.

### `GET /org-role-assignments`

Not paginated. `assignee.email` is filled for both ways an assignment can name its holder; `assignee.userId` is the Organisation Platform's own account id — **opaque, never resolve it against your own users**. `assignee.attributes` and the same system fields as `/people` are added to each `assignee` (including the personal-data rule above).

Unit resolution on this endpoint is capped at about 1000 units, so a very large tree can return `orgUnitId: null` on some rows. Treat `null` as "unresolved" — never as "no unit" or "organisation-wide". When you need every row reliably, resolve the unit from your own copy of `/org-units`, or use `/people` for the person you care about.

### `GET /person-attributes`

`{ key, name, type: 'single_choice' | 'multiple_choice' | 'free_text', options, orgUnit }`, only for attributes owned at or below the key's scope — the same rule as the values in `people`. `key` is unique in the organisation and never changes, so it is the only safe thing to store. `options` is `[]` for free text. A `502` is never an empty list. A deployment from before this endpoint answers `404`; treat that as "none".

Custom attribute keys can't be `email`, `first_name`, `last_name`, `mobile`, `reports_to`, `date_of_birth`, `country` or `timezone`; those are the system fields above. An older custom attribute that already used one of those keys still appears inside `attributes` and is a different thing from the system field.

### The designation catalog

A designation applies at the unit that owns it and every unit beneath it. A unit-scoped key sees only designations, assignments, people and attributes owned at or below its own unit, so a designation defined higher up the tree is invisible to it. Never gate on `name`; key on `id`. Check `status`: only `active` designations can be newly assigned.

`/org-roles` returns at most 500 designations in one response and has no paging. If the catalog could be larger, don't treat the list as complete, and resolve a name from `people` (`orgRoleName`) instead.

## Key scopes

Keys are read-only by default. Two optional scopes, switched on per key by a platform admin or by an Organization Admin of that organisation (an admin of one department can't) — never assume either:

| Scope | Unlocks |
|---|---|
| `onboarding:write` | `POST /onboarding`. Without it: `403 SCOPE_REQUIRED`. |
| `personal-data:read` | `mobile` and `dateOfBirth` on `/people` and on each `/org-role-assignments` assignee. Without it the two properties are **absent**, so a key can't even tell whether they exist. |

Two keys on the same organisation can differ. Don't cache "this organisation's keys can do X". Don't ask for, store, or show `mobile` or `dateOfBirth` unless the feature needs it and the user knows the key carries that scope.

### A key Buildpad auto-provisioned can do neither

Assume the connected key is **read-only** unless the user says they pasted one with scopes. A key issued by auto-provision never carries `onboarding:write` or `personal-data:read`, and nothing in this project can add them: only an Organisation Platform administrator can (a platform admin, or the Organization Admin of that organisation).

When the feature you are building needs one of them — **onboarding** (creating a person or placing them at a unit with `POST /onboarding`) or **personal data** (a person's `mobile` or `dateOfBirth`) — do this:

1. **Build to the documented behaviour, don't work around it.** Handle `403 SCOPE_REQUIRED` from `POST /onboarding` with a clear message, and treat an absent `mobile` / `dateOfBirth` as "not permitted", never as "this person has none". Don't fake the data, don't ask for a wider key in code, and don't call the Organisation Platform's own DaaS or database.
2. **Tell the user plainly, in your reply, before they find out at run time.** Say what the feature needs, that the key Buildpad created for the project is read-only, and who can change that. For example:

   > This feature needs the Organisation Platform key to be allowed to **onboard people** / **read personal data (mobile, date of birth)**. The key Buildpad created for this project is read-only. Ask an administrator of the Organisation Platform (a platform admin, or the Organization Admin of your organisation) to turn on **Allow onboarding** / **Allow personal data** for the key named `Buildpad · {organization} / {project} (by {the person who connected it})`, from the API keys panel of the organisation root (the shield icon for onboarding, the person icon for personal data). The key stays the same, so there is nothing to reconnect or redeploy, and the change applies from its next request.

3. **Offer the alternative**: the user can instead reconnect with **Bring your own key** using a key an administrator already issued with the scope, and then push the new `ORG_PLATFORM_API_KEY` to Amplify and redeploy (see the `amplify-env-vars` skill).
4. Note the dependency where the next person will see it (the PR or commit description, or a code comment next to the call), so the feature isn't mistaken for a bug when it returns `SCOPE_REQUIRED`.

Don't ask for either scope "just in case". Ask only when the feature needs it.

## Reading a person's designations (the common case)

Call `/people?email=` **live** whenever you need to know what someone holds — at sign-in, or on an admin screen. Do not cache assignments in a local table: who holds what changes quickly and is sensitive. Caching the *shape* (units) and the *catalog* (designation id → name) is fine.

```ts
import { isOrgPlatformError } from '@xtremax/organisation-platform/client';
import type { PersonLookup } from '@xtremax/organisation-platform/contract';
import { platform } from '@/lib/org-platform/client';

export async function getPersonDesignations(email: string): Promise<PersonLookup | null> {
  try {
    // Short timeout, no retry: this runs on the sign-in path and must never block login.
    return await platform.people(email, { timeoutMs: 3_000, retry: false });
  } catch (error) {
    if (isOrgPlatformError(error)) console.warn({ code: error.code, status: error.status, endpoint: error.endpoint });
    return null; // unknown — distinct from "has none"
  }
}
```

- **Never gate sign-in on `roles` being non-empty.** Empty means "no designations" or "unknown person", and the API can't say which.
- A `null` `orgUnitId` means the unit could not be resolved, not "organisation-wide". Skip such a row.
- Join on **email**. Not on `assignee.userId`.

### Turning designations into app roles

**Use rule-based role assignment** (next section), not a one-to-one table. A table (designation id → local role) can't say "managers, but not contractors", "anyone under this unit" or "people with this attribute", and "Designation is X gives Y" is just one kind of rule. If the user explicitly wants only a plain mapping, the same safety rules apply to it: map ids, never names; only the local-role side is editable by a person; grant additively; a human placement always wins; an unmapped designation grants nothing; and put a ceiling on the roles it can grant, enforced in code.

## Automation > Role assignment (rules)

Rule-based role assignment lets an admin write "include these people, exclude these people, give this role", and the app applies the result at sign-in. It is how the reference consumer (MyApps / XAppHub) works, where it *replaced* its designation mapping outright. It lives in the app's **admin domain**. The rule engine, the rule-builder screen and the typed client all come from the package; do not write a rule engine or editor by hand.

The package (install, pinning, entry points) and the first-shot slice are described under "Use the package first" above.

### What a rule looks like

A `RuleSet` is plain JSON: `{ version: 1, strategy, rules: [...] }`. Each rule has `name`, `enabled`, `outcomeId`, an `include` group (or `null` for everyone) and an optional `exclude` group (excluding always wins). A group has `mode: 'all' | 'any'` and conditions `{ attr, op, value }`.

- `strategy: 'first-match'` (default; rule order is priority) or `'all-matches'` (every matching rule adds its outcome).
- Attributes: `email`, `firstName`, `lastName`, `attributes.<key>` (a custom attribute's key), `designation` (a designation **id**), `orgUnit` (a unit **id**, with `isUnder`). Operators: `is`, `isNot`, `contains`, `isOneOf`; `isUnder` for units. Designations and units compare **ids**, never names.
- **Each job is checked on its own.** A job is one designation held at one unit. "Manager" held at one unit can't combine with "under Sales" held at another. Email, names and custom attributes are shared by all of a person's jobs.
- `isNot` is true of a missing value; a rule that can't be valid is skipped, never half-applied (a broken rule can only give less). A person with no designations is checked once with no unit, so only person rules can match.
- `evaluate(rules, toSubject(person))` returns `results: [{ ruleId, outcomeId, unitId, designationId }]` and a `trace` that explains each rule (`matched`, `not-included`, `excluded`, `disabled`, `invalid`, `skipped`).
- `toSubject` drops a role whose `orgUnitId` is `null` (unresolved), never widening it to "everywhere"; log those with `unresolvedRoles`.

### What the app owns

The package decides *whether a rule matches*. The app owns everything around it:

1. **The outcomes, with a hard ceiling.** `outcomeId` is one of the app's own roles, strongest first. Pass the list as `allowedOutcomeIds` to `validateRuleSet` on **save**, drop non-grantable outcomes when **evaluating**, and check again when **granting**. Never include a platform-administrator role, and don't make the list editable by whoever authors rules. Where several rules give roles at one organisation, grant the strongest by that fixed order.
2. **Storage.** One versioned row per organisation (for example `org_rule_sets`: `organization_uri` unique, `schema_version`, `rules` JSON, `version`, `updated_by`). No generic write path: a save route validates, rebuilds the payload itself and never forwards a request body. The save quotes the `version` it started from and is refused with `409` if someone saved since. The organisation is always the one the caller's session names, never one the request claims. Don't scope-register it.
3. **Reading it back safely.** Run the stored JSON through `migrate`, then through the same validation a save runs. Anything unreadable, of an unknown schema version, or invalid is treated as **no rules** (it decides nothing) and reported to admins. A missing collection (403/404) means "not provisioned", i.e. no rules; a 5xx or network error means the sign-in writes nothing that time.
4. **The authority.** Only a whole-organisation admin who also holds a dedicated capability may read or write the rules (for example a module access key; see `grant-module-access`).
5. **The catalogs.** The builder's lists (designations, units, custom attributes) are read **live** from `/org-roles`, `/org-units` and `/person-attributes` for the organisation's own key, and passed through `toCatalogs`. Never store names in rules, only ids. If any live read fails, report the catalogs as unavailable and make the editor **read-only** rather than offering a partial list.
6. **The admin screen.** **Do not mount `<RulesBuilder>`.** Build **Automation > Role assignment** as the apps do: a list (Priority, Rule, When, Assign role, Enabled, move arrows; toggle and arrows save immediately), one form for create and open-a-rule (Include and Exclude cards, outcome radio cards, Save rule disabled until valid), and a Test rules drawer, all on `createRuleBuilder` from `/builder-core`. Set `limits` (for example 100 rules, 20 conditions per group) and `readOnly` when catalogs are unavailable. Each screen saves the whole set with the version it loaded. Re-validate on the server whatever the browser reported. For a single-tenant app, keep one row for the root the key reaches; for a multi-tenant one, one row per organisation (see `manage-scope`).
7. **A tester.** An admin-only route that looks a person up **live** by email, runs the draft or saved rules, and returns which rule decided each placement. It writes nothing, can wait out a slow platform, and answers `502` — never "no designations" — when the lookup failed.

### At sign-in

Use one decision function for sign-in, any "can this person be placed?" preview, and the admin tester, so what an admin is told is what sign-in does.

- Ask `people?email=` live with a short timeout and no retry (`timeoutMs: 3000`, `retry: false`); a slow or failing platform changes nothing and the person catches up next time.
- Decide per placement (a designation held at a unit) in the organisation the designation belongs to, found from the unit's crosswalk link, or from its root's link when the unit has not been created locally yet. A designation can be decided only in an organisation its platform root is linked to.
- **"No decision" is the safe answer.** No enabled rule, an unreadable or invalid rule set, or a placement no rule matched: grant nothing **and block revocation**. So a missing or broken rule can never take access away. An organisation with no enabled rule decides nothing.
- A human placement always wins: if the person already holds any role in that organisation that sign-in didn't write (an invite, an admin's edit), write nothing there.
- Record every grant sign-in makes (for example a `designation_grants` collection) so only rows it wrote are ever changed or revoked. Revoke only when every lookup succeeded: the platform answered, the units resolved, the rules were readable.
- If the person's designations change upstream, a changed rule changes the role and a designation gone upstream removes the row, on the next sign-in. No sync in between.

### "System" attributes: facts only this app holds

The platform's answer holds what *it* knows: designations, units, names and custom attributes. It knows nothing about the person's account **in this app**. A rule may need those facts (how they sign in, whether the account is active), so the list is owned by the app, not by the package or the platform.

- **Decide them from real data.** For each candidate fact (sign-in method, email domain, account status, the app's own names), check the real rows, not just the schema. Offer a fact only if it is set by your server, is **settled at evaluation time** (the same value at sign-in, in a preview and in the tester), and is meaningful to an outcome. Don't offer the thing the rule gives (the current role), and offer values at the fidelity the record really has (if every SSO writes one provider string, "Single sign-on / Email and password" are the only two values).
- **Namespace them** (`attributes.myapp.<name>` to the builder, `myapp.<name>` as person attributes), and **overwrite, never merge**: whatever the platform sent under that namespace is discarded before the engine runs. Group them as "System" in the editor beside the platform's "Attribute".
- **The platform already supplies email, first name and last name.** If the app also offers its own versions, give them separate keys and qualify the labels where they'd otherwise clash ("First name (MyApp)" and "First name (Organisation Platform)"). An invited account's name is often blank or just the email.
- **A missing value is not "not that".** `isNot` is true of no value. If the app's own record can't be read, write nothing at sign-in, say "unknown" in a preview and fail the tester. "No such account yet" is an answer: no value for those facts, and say so wherever you show a result.
- Read the account only when a switched-on rule asks about an account fact; derived facts (an email domain) need no read.
- Suggestions (the email domains in use) come from **this organisation's** people only, never every account on the deployment, and never limit what can be typed.
- If a fact moves from one side to the other, keep the old key evaluating and shown while any rule uses it.
- When a platform read fails, evaluate only the rules that don't need it (`withoutRulesNeeding`-style): a rule such as "Designation is not Intern" is true of a person whose designations are unknown.

### Moving from a plain mapping to rules

`fromDesignationMappings(mappings, { nameFor })` generates the rule set that decides exactly what the mapping decided (one rule per designation, "Designation is [id] gives [role]"), so switching changes nobody's access. Convert once per organisation: dry run first, skip an organisation that already has rules, report (don't convert) a mapping onto a role rules may not give or onto a designation that no longer exists, save with the same versioned save the editor uses, and refuse to write anywhere but the intended environment. Do it **before** deploying the code that stops reading the mapping: deploying first leaves every organisation with no rules, which grants nobody a new role at sign-in (nobody loses one). Leave the old table in place, unused. Optionally run the rules alongside the mapping first and record the differences before letting rules decide.

### Other uses of the same engine

The engine is not limited to roles. MyApps also uses it for **dashboard assignment**: rules place people on dashboard breadcrumbs, with `strategy: 'all-matches'` so every matching rule applies and the placements are merged. Keep each kind of rule set in its own collection so one can never be mistaken for the other. A rule for "everyone" is stored as an include on `email contains "@"`, because the engine refuses a rule with neither group.

## People import and offboarding review (admin tools)

If the app has its own user directory and people should be mentionable, shareable or assignable before they have ever signed in, build two tools on the admin Users screen. They are a matched pair and are built.

- **Import from Organisation Platform.** One read of `GET /org-role-assignments` lists everyone who holds a designation, with their email and (platform from 2026-10-26) their first and last name, in a single call. Preview, then create an account (email and name, no password, no role) for each person who has none, in batches of 10. **Never call `/people` once per holder:** each call re-reads the whole assignment subtree and overloads the platform. The server re-derives who to create on every request, so the browser's list is only a request. Record, in a collection such as `org_platform_people`, the people the run created and the listed people who already had accounts.
- **Offboarding review.** The platform has no "this person left" signal, and many colleagues never had a designation, so absence proves nothing. Only people an import recorded can ever be reviewed. A recorded, active account on a company email domain that the list no longer covers is a candidate; each candidate is then asked about individually, and only "the platform does not know this person" lists them. A failed lookup flags nobody, and an empty platform list flags nobody. The administrator ticks each person (no select-all); the server re-verifies each one live before **suspending** (never deleting). It never suspends the caller, a system or test account, someone outside the company domains, or the last real administrator. Suspended accounts must also be refused at sign-in by every route, and signing in must never set them back to active.
- **Least data.** Email and name only. Never read, keep or log mobile, date of birth or attributes. The read-only key is enough.
- **Where the code is.** For a Supabase-backed project, read `organization-platform-people-sync.instructions.md` next to this file; the exact code is under `assets/organization-platform/people-sync/`. An Engine project has no such code yet; the rules above still hold.

**Automation > Role assignment has its own exact recipe, `organization-platform-role-assignment.instructions.md`, with the real code in `assets/organization-platform/role-assignment/`. For a Supabase-backed project, follow it instead of designing the screens or the rule store; an Engine project has no such code yet, and the rules above still hold.**

## Keeping a local copy of the unit tree

Only needed if the app partitions its own data by org unit. Rebuild locally from a crosswalk of upstream unit id ↔ local record, created parent-first, holding ids only (no names, no assignments, no `uri_path`). Prefer an admin-triggered "Sync units" action that downloads `/org-units`, creates what is missing, renames what changed (not the organisation root's own local name), and **reports** — never auto-applies — a unit that moved or vanished upstream. Reconciling at sign-in is the other trigger. A scheduled job is optional and must call the same sync logic.

Using `/changes`:

- The first call with no `cursor` returns no data and mints a starting cursor. Store it **before** downloading `/org-units`, so nothing changed mid-download is missed.
- `data` is always the record's **current** state, never a diff, and applying an entry twice is safe. `data` is `null` only for `deleted`. Entries appear a few seconds after the change. Gaps in `seq` are other organisations' entries, never a missed change.
- Persist `meta.nextCursor` after every page, even an empty one: once you're caught up it jumps ahead to the global high-water mark.
- The cursor is bound to the key's scope unit. `400` means it came from a different key; `410` means it is older than the 30-day retention window. For either, drop the cursor and do a full refresh. That is a designed recovery, not an incident.
- Only `org_unit` entries change local state. An `org_role` entry needs nothing stored (read the catalog live). An `org_role_assignment` entry is only a hint that someone's access may have changed; re-read `/people?email=` and never persist its payload.
- Person attributes and system fields are **not** in the feed; edits to them produce no entry. Read them live.

## Errors and retries

| Status | Meaning | Do |
|---|---|---|
| 400 | Missing or invalid parameter, or a cursor from another key | Fix the request |
| 401 | Key missing, unknown, revoked, or its unit was deleted — deliberately indistinguishable | **Do not retry.** Treat as a dead credential and alert an operator |
| 403 | `SCOPE_REQUIRED` on `POST /onboarding` | The key lacks that scope |
| 404 | Not found *or* outside the key's scope — deliberately indistinguishable | Do not retry or use it to probe for existence |
| 410 | `/changes` cursor expired | Full refresh |
| 429 | Not returned today | Handle defensively with backoff |
| 502 | The platform could not reach its own backend, or could not read attributes | Retry with backoff |
| 500 | Bug on the platform side | Report; don't retry forever |

A rotated or revoked key takes effect immediately with no grace period: issue a new key, reconnect it on the Connectors page, push the env vars and redeploy.

## One key, one scope

A key reaches exactly one org unit's subtree. Never merge results from two keys into one list: two keys on different organisations, or even on different units of one organisation, are separate feeds with separate cursors. If the app needs two, it needs two connections, with every flow run twice, independently.

## Push-onboarding (rare — only with `onboarding:write`)

`POST /onboarding` creates or finds a person's account, places them at a unit inside the key's scope, and can email an invitation. Most apps never need it; reading designations at sign-in (above) is the common case. Don't build on it unless the user confirms the key carries the scope. An auto-provisioned key does not: see "A key Buildpad auto-provisioned can do neither" above and tell the user to ask an Organisation Platform administrator.

- Body: `email`, `orgUnitId` (required, inside the key's scope), optional `firstName`, `lastName`, `accessRole` (`ou_admin` | `ou_member`), `designationId` (must be active and owned by that unit or an ancestor), `sendInvitation` (default `true`, new accounts only). **At least one of `accessRole` / `designationId` is required.**
- `201` when something was created, `200` when the person already held exactly this; both are success.
- It is **idempotent**: retry the identical body on any `502`. `502 PARTIAL_FAILURE` means retry to finish a half-done onboarding.
- Other codes: `400 INVALID_REQUEST`, `404 ORG_UNIT_NOT_FOUND` / `DESIGNATION_NOT_FOUND`, `409 USER_INACTIVE` (resolve on the platform, not by retrying), `409 DESIGNATION_INACTIVE`, `409 ACCOUNT_CONFLICT` (report it).
- `warnings: INVITATION_NOT_SENT` is an operational alert, not a failure: the person was onboarded and an admin must resend the email.

## What this connector is not

- It is not sign-in. For SSO use the My Apps connector; this one only supplies organisation data about people who sign in some other way.
- It does not push changes to the app. Everything is pulled.
- It is not the Organisation Platform's MCP endpoint (`/api/mcp`), which works as a signed-in user and doesn't accept this key.
- It does not write people, attributes or units, apart from the optional onboarding above.
