# Module-Level Access — Checklist

Work through this whenever a feature needs a capability gate that collection
CRUD permissions cannot express. Referenced from
[grant-module-access](../grant-module-access/SKILL.md) and
[create-rbac](../create-rbac/SKILL.md).

---

## 1. Is this actually a module access key?

| Need | Mechanism |
|---|---|
| "Can this user read/create/update/delete rows in collection X?" | **Record-Level Access** — `daas_permissions` (see `create-rbac`) |
| "Can this user see this button / page / nav item?" | **Module-Level Access** — a key |
| "Can this user execute this workflow transition?" | **Module-Level Access** — `command.module_access_keys` |
| "Can this user only see *their own* rows?" | Record-Level Access with an item filter — **not** a key |
| "Is this user an admin?" | `isAdmin` from `usePermissions()` — never a key, never a role name |

A key is a **global boolean per user**. Anything that depends on *which row* is
being touched belongs in a `daas_permissions` filter instead.

- [ ] The gate is not expressible as collection CRUD
- [ ] The gate does not depend on the specific item being accessed

## 2. Name the key

- [ ] Format `<domain>:<capability>` — e.g. `reports:export`, `tickets:approve`
- [ ] Matches `^[a-z][a-z0-9_:./-]*$` (lowercase; the DB CHECK rejects anything else)
- [ ] Not under the reserved `system:` or `workflow:` namespaces
- [ ] Globally unique — the registry enforces `UNIQUE` on `key`
- [ ] Names the *capability*, not the role that happens to hold it
      (`reports:export`, not `manager:stuff`)

## 3. Register it

- [ ] Created via MCP `module_access_keys` (`action: "create"`) or the
      `/module-access-keys` page
- [ ] Grouped under a folder node (`key: null`) when it belongs with siblings
- [ ] `description` explains what the key grants — it shows in the Policy editor

## 4. Grant it

- [ ] Set `true` on the relevant policies via MCP `policies` (`action: "update"`,
      `data.module_access`) or the **Module-Level Access** tab at `/policies/<id>`
- [ ] Granted on a *policy*, not a role — roles reach keys through their policies
- [ ] Understood that grants OR-merge: any policy granting the key is enough
- [ ] Multi-tenant: the granting policy is assigned at the right scope. Keys
      resolve against the active Resource URI, so a grant at `/tenant:A` does not
      apply at `/tenant:B`

## 5. Guard the UI (UX only)

- [ ] `const { hasModuleAccess } = usePermissions();` from `@/lib/buildpad/hooks`
- [ ] Every conditional render for this capability goes through it
- [ ] Nav items hidden too, not just the target page
- [ ] **No role-name checks anywhere.** Run the grep gate:

```bash
grep -rn "role === \|roleName\|user\.role\|is_manager\|is_admin\|isManager\b" app/ components/
grep -rn "detectAdminFromMe\|checkAdmin\|roleObj\.name === 'Administrator'" app/ components/
```

- [ ] Understood that `hasModuleAccess` **fails closed** — `false` while loading
      and on error. If flicker matters, render a skeleton while `loading`; never
      render the gated control optimistically

## 6. Guard the server (the real boundary)

- [ ] Every API route performing the gated action calls
      `await enforceModuleAccess('domain:capability')`
- [ ] Installed via `npx @buildpad/cli add services` → `lib/module-access/enforce.ts`
- [ ] Collection access still guarded separately where the route also touches data:

```ts
await enforceModuleAccess('reports:export');                          // capability
await enforcePermission({ collection: 'reports', action: 'read' });   // data
```

- [ ] Workflow transitions gated with `module_access_keys` on the command, not
      with bespoke policy IDs

## 7. Capability matrix (STOP-SHIP)

Produce this before calling the feature done — `create-rbac` treats a missing
matrix as incomplete work.

| Key | Granted policies | UI guard location(s) | API guard location(s) |
|---|---|---|---|
| `reports:export` | Manager Policy | `app/reports/page.tsx:42`, `components/LayoutShell.tsx:88` | `app/api/reports/export/route.ts:12` |

- [ ] Every registered key has at least one guard location — a key nothing checks
      is a grantable no-op
- [ ] Every guard location names a registered key — nothing validates keys on
      write, so a typo is silently accepted and never matches

## 8. Verify

- [ ] Granted user can use the gated action
- [ ] Ungranted user does not see the control
- [ ] Ungranted user gets **403** calling the API directly with the UI bypassed
- [ ] Admin bypass works on **both** client and server
- [ ] Multi-tenant: switching scope updates the available capabilities, and the
      permission cache is not serving the previous tenant's keys

---

## Common mistakes

| Mistake | Why it bites |
|---|---|
| UI check only | Anyone can call the API directly |
| Server check only | Users see controls that always fail |
| Admin bypass on the client but not the server | Admins see the button, get a 403 |
| Free-text key entry on the policy editor | Nothing validates keys against the registry — typos are accepted and never match |
| Adding a `custom_permissions` column | Superseded; `module_access` is built in |
| Role-name checks | Break the moment roles are renamed or a second role needs the capability |
| Caching permissions without the scope | A tenant switch serves the previous tenant's keys |
