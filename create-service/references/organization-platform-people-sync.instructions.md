---
name: Organisation Platform people import and offboarding review
description: How a Supabase-backed Buildpad app imports people from the Organisation Platform as sign-in-less accounts (so they can be mentioned, shared with or assigned before their first sign-in) and runs an offboarding review that suspends people the platform no longer knows. The exact, tested getFeedback code, the invariants, the org_platform_people collection, routes, sign-in guard and host adaptation table.
applyTo: "**/org-platform/**,**/admin/users/**"
---
<!-- buildpad-backend-file: supabase -->

# People import and offboarding review

Two admin tools that keep an application's own user directory in step with the Organisation Platform. Both live on the app's **Admin > Users** screen and were built, tested and run in two Xtremax apps: **xWorkspace** (`llm-workspace-starter`) and **getFeedback** (`get-feedback-starter`). The code described here is those apps' real code, copied unchanged into `assets/organization-platform/people-sync/` (each file only gains a one-line backend marker at the top). **Copy the code and adapt only what section 9 lists. Do not design the dialogs, the batching or the safety checks yourself:** most of the care in this code is in the failure cases.

| Tool | What it does | Where it shows |
|---|---|---|
| **Import from Organisation Platform** | Creates a sign-in-less account for every person the platform lists who has none yet, so they can be @mentioned, shared with or assigned before their first sign-in | Button on Admin > Users, opens a dialog |
| **Offboarding review** | Finds people the platform once listed and no longer knows, and lets an administrator suspend the ones they choose | Button on Admin > Users, opens a dialog |

They are two halves of one design: **the import is also what makes the review safe**, because it records who the platform has listed.

## Where the code is

The real getFeedback code (Mantine), copied to the same relative paths it has in the app. Copy each file to the same path in your app.

| Under `assets/organization-platform/people-sync/` | What it holds |
|---|---|
| `lib/org-platform/` | `people-import.ts`, `leavers.ts`, `provenance.ts`. They use the platform client in `assets/organization-platform/role-assignment/lib/org-platform/client.ts`, the same one role assignment uses |
| `lib/` | `admin-user-create.ts`, `admin-users.ts`, `admin-user-status.ts` |
| `app/api/admin/users/` | `import/route.ts`, `leavers/route.ts`, `status/route.ts` (Reactivate) |
| `ui/` | `OrgPeopleImport.tsx` and `OrgLeaversReview.tsx` (Mantine) |
| `sign-in-guard.patch`, `users-page-wiring.patch` | The existing files these features touched: the three sign-in routes (section 7), and the Admin > Users page and its users route that add the two buttons and the Reactivate control |

**Host helpers the code imports but this skill does not ship** (replace them with your app's equivalents, keeping the signatures): `requireGlobalAdmin` (`lib/api/admin-guard`), `isExcludedEmail` (`lib/mentionable-users`: system, service and sample addresses), `getDaasUrl` (`lib/api/auth-headers`), and `serviceToken` (`lib/org-rules/store`, shipped in the role-assignment assets).

**This is Supabase-project code** (it creates accounts through the Supabase admin API), so the file set is marked for Supabase projects and left out of the kit of an Engine project. The rules in sections 2 to 8 are not backend-specific. xWorkspace's variant, which differs only in the host wiring, and both apps' tests are in the Organisation Platform skill.

## 1. Why they exist, and the one idea behind both

- **Import.** A mention picker, a share dialog or an assignment list can only offer people who have an account. Without an import, a colleague appears only after they sign in once. The import creates the account (an email and a name, no password, no role). Their first single sign-on later attaches to the same account because sign-in finds the auth user by email.
- **Offboarding.** The platform has **no "this person left" signal**. If someone loses every designation, they vanish from its assignment list, but so does anyone who simply never had one. So "the platform has no record of X" proves nothing on its own.

The idea that makes the review safe: **only ever look at people the platform has listed to this app before.** Every import run records, in `org_platform_people`, the people it created *and* the listed people who already had accounts. The review considers only those. A colleague who was never on the platform can never be flagged.

## 2. Invariants (do not weaken these)

1. **The server is the authority.** Both tools take a list of emails from the browser, and treat it as a *request*. The server re-reads the platform's list and the directory on every call. A tampered request can create nobody the platform doesn't list and suspend nobody it still knows.
2. **Preview first, then act in small batches.** Nothing changes until an administrator confirms. The browser sends 10 emails per request (`IMPORT_BATCH_SIZE`, `LEAVERS_BATCH_SIZE`) so a run fits in one request, and the screens can stop between batches.
3. **Idempotent.** Re-running is the recovery path for every failure. People who exist are reported as existing; people already recorded are left alone.
4. **A failed read changes nothing.** If the platform or the directory can't be read, the answer is an error and nothing is written. A lookup that failed *flags nobody*. A platform that lists **nobody** is treated as a platform problem, not an empty company, and nobody is reviewed.
5. **Only an explicit "unknown person" flags someone.** A person the platform still knows (they lost a designation) is not listed.
6. **Least data.** The import reads email and name. It never reads, keeps or logs mobile, date of birth or attributes, and grants no role.
7. **Suspend, never delete.** Comments, feedback, shares and history stay. Reactivating is one click on the Users page.
8. **Hard refusals on suspend:** never the caller, never a system or test account, never someone outside the company's own email domains, never the last real administrator (counting those suspended earlier in the same request).
9. **The administrator ticks each person.** There is no "select all" and nothing is pre-ticked.

## 3. The data: `org_platform_people`

One collection, one row per recorded person. Not scope-partitioned, no policy grant to anyone but the service account, read and written only with the service credential.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, primary key | |
| `user_id` | uuid, required, unique | the directory account |
| `email` | string, required | lower-cased |
| `first_seen_at` | timestamp | |

- Until it exists (403/404) nobody is recorded, so the review finds nobody and nothing else is affected. The code treats "not provisioned" as "empty".
- The DaaS tool cannot enforce a unique constraint, so the code does: `recordSeen` reads before it writes, and `listTracked` collapses duplicates by `user_id`. A unique index is a bonus, not a requirement.
- `listTracked` pages (1000 rows) and **stops rather than loops** if the server ignores the `page` parameter.

## 4. Talking to the platform

Both tools use the platform client from `@xtremax/organisation-platform/client`, server-side, read-only key, in `lib/org-platform/client.ts` (the one door). What they call:

| Call | Used for | Notes |
|---|---|---|
| `orgRoleAssignments({ timeoutMs: 30_000 })` | The list of everyone who holds a designation | The heaviest call the platform serves. One call per import, **cached for 2 minutes** so the ~20 batches of a run share it. A preview always reads fresh. The review shares the same read |
| `people(email, …)` | Names (older platforms only) and the "does the platform know this person?" check | Retries what the platform marks worth repeating (`429`, `502`), honours `Retry-After`, never retries `401`/`404`. Timeout 15 to 20 seconds, 3 to 4 attempts, concurrency **3** |

- **Names ride on the list.** From 26 October 2026 the platform's `GET /org-role-assignments` carries `assignee.firstName` and `assignee.lastName` for each holder (account name, else the organisation's record, else `null`), so one call names everyone. The package's published type does not have those fields yet, so the code reads them through a widened type. On an **older platform** the list carries no names and the import falls back to one `people` call per person, a few at a time.
- **Why that matters.** Each `people` call re-reads the platform's whole assignment subtree. Doing one per holder for hundreds of holders overloaded the platform and caused timeouts and rate limits. That is why the list carries names now, why name lookups are capped at 3 at once, and why failures carry a reason ("busy, run the import again").
- **`isKnownPerson(person)`.** `roles: []` means both "no designations left" and "unknown person". The platform only returns names and attributes for someone it knows, so "known" is: has a name, or any attribute, or any role. This function is the *only* test the review uses for "left".

## 5. Import from Organisation Platform

**Flow.** The button opens a dialog:

1. **Preview** (`mode: 'preview'`): reads the list fresh and the directory, changes nothing, and shows how many are listed, how many would be added, how many already exist, and what was skipped.
2. **Run**: the browser sends `toCreate` in batches of 10 (`mode: 'run'`). A progress bar shows created, already existed and failed. "Stop after this batch" is available. A failure keeps its reason so the administrator can act on it.
3. **Record**: at the end of a run the browser calls `mode: 'record-existing'` (best effort), which records the listed people who *already* had accounts. If there is nothing to create but people exist, the dialog offers **Record N people as listed** on its own.

**Planning (`planImport`, pure).** For each assignment: no email counts as `withoutEmail`; emails are lower-cased; one person appears once per designation, so it de-duplicates; then it classifies as `invalid`, `system-or-test` (never imported), `existing` (already in the directory), or `toCreate`. Names are taken from whichever of a person's rows carries them.

**Running (`importPeople`).**
- Takes at most 10 emails. Anything not in the platform's *current* list is `not-listed` and refused; anyone already in the directory is `existing`.
- Names come from the list; only when it carries none is each looked up (concurrency 3). A person whose lookup fails is `failed` and **not** created, so a repeat run picks them up. A person the platform simply has no name for is created with their email as the name.
- Accounts are created a few at a time (xWorkspace: 5 concurrently; getFeedback: one after another). One failure never stops the rest, and each person gets their own outcome: `created`, `existing`, `not-listed` or `failed` with a message.
- After a run, the people it **created** are recorded (`recordSeen`). A failure to record is logged and is never the import's failure.

**Creating the account.** Two variants, both give a person with a confirmed address, no password and no role:
- *getFeedback* (`createDirectoryUser`): Supabase auth user with `email_confirm: true`, and `app_metadata: { provider: 'oauth', providers: ['oauth'] }`, then an upsert into the directory table with `provider: 'oauth'`. The `app_metadata` matters: without it Supabase records them as email accounts, and a role-assignment rule on "Sign-in method" would misjudge them after their first single sign-on. If the directory row fails, the auth user is deleted again so nothing half-made is left.
- *xWorkspace* (`createPerson`): auth user with `email_confirm: true` and `imported_from: 'organisation-platform'` metadata. The directory row follows from the platform, so it **waits up to 4 seconds** (poll every 400 ms) for it, then writes the row itself with the same id so a late arrival merges, and fills in a blank name. An auth account that already exists with no directory row counts as `existing`.

## 6. Offboarding review

**Step 1, candidates** (`loadCandidates`, no per-person calls). A directory account is a candidate only if **all** hold:
- it is in `org_platform_people` (recorded by an import);
- it is not the caller;
- its status is active;
- its address is real (valid, not a system or test account, not a reserved domain such as `example.com`);
- it is on one of the company's own email domains (getFeedback: `ORG_COMPANY_DOMAINS`, default `xtremax.com`; xWorkspace: `INVITE_DOMAINS`);
- the platform's designation list no longer covers it.

It throws (and so flags nobody) if the platform's list is empty. Each candidate also carries `holdsAdmin` and a `similar` hint: if a person listed under a *different* address has the same name (letters only, case-insensitive), the platform may simply hold a new address for them, and the screen says so.

**Step 2, check** (`checkLeavers`). The browser sends the candidates in batches of 10. The server re-derives the candidates (a non-candidate is `not-a-candidate`, and the platform is not even asked), then asks the platform about each one, 3 at a time. The state is `left` (platform doesn't know them), `on-platform` (it does, they just lack a designation, so they are not listed), or `error` (the lookup failed, so nothing is flagged and **Check again** retries).

**Step 3, suspend** (`suspendLeavers`). The administrator ticks people, confirms in a second dialog (which names how many are Administrators), and the browser sends them in batches. For each person the server re-verifies live: not a candidate, or the platform still knows them, or the lookup failed → refused or failed with a reason, nothing changed. The last real administrator is never suspended. The result per person is `suspended`, `refused` (with a reason) or `failed`.

**Suspend means status `suspended`.** In getFeedback that is `setUserStatus(supabase, id, 'suspended')`; in xWorkspace it is the same call the Users page makes (`PATCH /users/{id}` with `status: 'suspended'`). The person leaves the @mention list (it lists active users only) and can no longer sign in. **Roles held inside tenants or spaces are not changed**: say so in the confirm dialog, and ask the administrator to review the Members page of any tenant the person belonged to.

## 7. The sign-in guard (required for the review to mean anything)

A suspended account must actually be unable to get in, and signing in must never quietly set it back to active. In getFeedback this needed three changes (`assets/organization-platform/people-sync/sign-in-guard.patch`):

- `findOrCreateUser` (the provider sign-in path): before the step that sets the directory row `active`, `if (!isNewUser && (await isAccountBlocked(supabase, user.id))) throw new Error(ACCOUNT_SUSPENDED_MESSAGE)`. This also fixed a latent bug where signing in reactivated suspended accounts.
- The Supabase-native callback and the password login route: after authentication, check `isAccountBlocked`, sign the session out and refuse with `Your account has been suspended. Contact an administrator.`
- `isAccountBlocked` blocks `suspended` and `terminated`, and **treats an unreadable status as "may sign in"**: a lookup problem must never lock anyone out.

xWorkspace has **no app-level guard** in the code it was copied from: it sets the status through the DaaS users API and relies on the DaaS treating a suspended user as unable to sign in. That was not verified there. In any new host, suspend a test account and try to sign in by every route (single sign-on, password, magic link). If any route lets it in, add the guard.

A **Reactivate** control (getFeedback: `POST /api/admin/users/status { id, status }`, which refuses to suspend the caller and ignores system and test accounts) is how an administrator undoes a review.

## 8. Routes

Both are admin-only `POST` routes taking `{ mode, emails? }` and answering `{ data }` or `{ error }`:

| Route | Modes | Notes |
|---|---|---|
| `/api/admin/users/import` | `preview`, `run`, `record-existing` | `run` needs 1 to 10 email strings. The preview strips the server-only `existingEmails` and `names` before answering |
| `/api/admin/users/leavers` | `candidates`, `check`, `suspend` | `check` and `suspend` need 1 to 10 email strings |

Shared behaviour: `401`/`403` if not an administrator (getFeedback: `requireGlobalAdmin`; xWorkspace: `getCapabilities().canAdmin`), `400` for a bad body or mode, **`409` if the platform connection isn't configured**, and **`502` with a "nothing was changed" or "people already created are skipped" message** when the platform or the directory can't be read. Never log the key or an email address.

### 8b. Wiring on the Users page

- **Two buttons next to Add user:** **Import from Organisation Platform** and **Offboarding review**: `<OrgPeopleImport onImported={load} />` and `<OrgLeaversReview onChanged={load} />` in a group before the Add user button.
- **A Reactivate button** on rows whose status is `suspended` or `terminated` (a table column that posts to `/api/admin/users/status`).
- **One way to create an account.** Refactor the existing manual **Add user** route to call the same `createDirectoryUser` the import uses, so the form and the import make identical accounts.
- The exact changes are `assets/organization-platform/people-sync/users-page-wiring.patch`.

## 9. What a new host must supply

The core (`people-import`, `leavers`, `provenance`) takes everything that touches the network as a parameter, so it is testable without one. A new host supplies:

| Need | In getFeedback | In xWorkspace |
|---|---|---|
| Admin check | `requireGlobalAdmin()` | `getCapabilities().canAdmin` |
| Directory read (id, email, names, status) | `daas_users` through the admin Supabase client, paged 1000, capped 20,000 | same |
| Create an account | `createDirectoryUser` | `createPerson` |
| Set status | `setUserStatus` | `PATCH /users/{id}` with the service call |
| Service DaaS call for `org_platform_people` | `serviceCall` (`SERVICE_ACCOUNT_KEY`) | `asSystem` |
| System or test address test | `isExcludedEmail` (`lib/mentionable-users.ts`) | `isSystemOrTestEmail` (`lib/org-rules/accounts.ts`) |
| Administrator role id | `ADMINISTRATOR_ROLE_ID` in `leavers.ts`, root scope only | `ADMINISTRATOR_ROLE_ID` from `org-rules/outcomes` |
| Company email domains | `ORG_COMPANY_DOMAINS` | `INVITE_DOMAINS` |
| Platform connection | `ORG_PLATFORM_URL`, `ORG_PLATFORM_API_KEY` (read-only, server-only, read on every request) | same |
| UI kit | Mantine (`Modal`, `Progress`, `Checkbox`) | the app's own `Dialog` and `ConfirmDialog` |

## 10. Tests to carry over

The assets include the suites. They pin the behaviour, so a port that passes them has the same safety properties:

- **Planning:** de-duplication ignoring case, system and test and invalid skipped, names from whichever row has them, older platform with no names, directory read past one page, failing loudly rather than comparing half a directory.
- **Import:** creates only people the platform lists, uses the list's names with no per-person lookups, refuses unlisted emails and system accounts, is idempotent, treats an auth account with no directory row as existing, keeps going after one failure, looks names up only when the list has none and does not create someone whose lookup failed, caps a request at the batch size, reads the list once per run but fresh for a preview, writes nothing when the platform is down.
- **Recording:** records created people with their new ids, not the refused, failed or already existing, a recording failure never fails the import, records listed people who already had accounts but never system accounts or unlisted people.
- **Review:** never offers, checks or suspends someone who was never recorded however the platform answers; reviews nobody when nobody is recorded; lists only active company-domain accounts the list doesn't cover; never offers the caller, other domains, system or test accounts or people already suspended; flags nobody when the platform lists nobody; flags only a person the platform doesn't know; flags nobody when the lookup fails; doesn't even ask about a non-candidate; refuses someone the platform knows even if the request named them; may suspend an administrator while another real one remains; never suspends the last real administrator, counting earlier suspends in the same request; doesn't count a service or test account as an administrator.
- **Provenance:** records new people lower-cased with a timestamp and skips existing, idempotent and de-duplicates, a unique refusal is fine but a real failure is an error, more people than one chunk, pages, stops rather than loops when `page` is ignored, empty when not provisioned and throws (reviews nobody) when unreadable.
- **Routes:** admin only, bad body or mode, `409` unconfigured, preview never sends server-side lists to the browser, bad run requests, `502` messages.
- **Sign-in guard (getFeedback):** a suspended account is refused on every route and sign-in never sets it back to active; an unreadable status never locks anyone out.

## 11. Rollout

1. Create `org_platform_people` (additive; nothing else changes until the buttons are used).
2. Make sure the sign-in guard is in place **before** anyone is suspended.
3. Set `ORG_PLATFORM_URL` and `ORG_PLATFORM_API_KEY` (server-only) and the company-domain setting. The key can be the read-only key from the Buildpad connector; the import never needs onboarding or personal data.
4. Run **Import from Organisation Platform**. Check that people appear and can be mentioned.
5. Later, run **Offboarding review**. Expect nobody on the first run: it only looks at people an import has recorded.
6. For a production deployment, do the DaaS setup on the same DaaS the app uses (there is often no separate DEV DaaS).

## 12. Pitfalls and limits

- **Only people with a designation are ever listed.** Someone with no designation is never imported, and a recorded person who loses their last designation shows up as a candidate and is then correctly *not* flagged, because the platform still knows them.
- **The platform may hold a new address** for someone: the `similar` hint is the guard, and the confirm dialog says to check with the person's manager first.
- **Don't call `people` once per holder** from anywhere new. Use the list's names.
- **Keep the 2-minute list cache** per server instance. Another instance simply misses it and reads for itself.
- **Don't widen the read.** If a feature needs mobile or date of birth, that is a separate decision with a key that carries the personal-data scope.
- **Line endings.** Some starter files have Windows line endings (`lib/supabase/admin.ts` in getFeedback does). Edit them in a way that preserves them, or the diff becomes the whole file.
- **Roles inside tenants or spaces are untouched by a suspend.** Say so in the UI.

## 13. How the two implementations differ

| | xWorkspace | getFeedback |
|---|---|---|
| Wiring | Dependency injection (`ImportDeps`, `LeaversDeps`) with the cache holding the list | Same logic, `SupabaseClient` and the platform client passed to the functions, a hooks object for recording |
| Account creation | `createPerson`, waits for the platform-created directory row | `createDirectoryUser`, upserts the row, sets `provider: 'oauth'` |
| Account creation concurrency | 5 at a time | one at a time |
| Domains | `INVITE_DOMAINS` | `ORG_COMPANY_DOMAINS` (default `xtremax.com`) |
| Admin role lookup | all rows with the role | root-scope rows only (an Administrator role at a tenant confers no admin) |
| UI | Own dialog components | Mantine |
| Sign-in guard | None in the app code; relies on the DaaS user status (not verified) | Added in the same change (three places) |
| Extra | | `POST /api/admin/users/status` and a Reactivate button |

getFeedback's offboarding review was **ported from xWorkspace** the same day, so xWorkspace is the original.

## 14. Adoption checklist

- [ ] The platform connection is configured server-side with a read-only key
- [ ] `org_platform_people` exists and only the service account can use it
- [ ] Import: preview, batches of 10, idempotent re-run, names from the list, system and test addresses skipped
- [ ] Import records the people it creates and the listed people who already exist
- [ ] Review looks only at recorded people, in active company-domain accounts, not covered by the list
- [ ] Every flagged person is re-verified live at suspend time; a failed lookup flags nobody; an empty list flags nobody
- [ ] The caller, system accounts, other domains and the last administrator can't be suspended
- [ ] Suspended accounts can't sign in by any route, and signing in never reactivates them
- [ ] Reactivate exists; nothing is deleted
- [ ] The confirm dialog says tenant or space roles aren't changed
- [ ] The tests above pass in the host
