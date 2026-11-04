// buildpad-backend-file: supabase
/**
 * Placing a person in tenants from the Organisation Platform.
 *
 * Asks the platform ONCE who this person is and what they hold (`people?email=`, live),
 * runs the rules of every tenant that has any, and brings the person's role in each of
 * those tenants in line. Two small local collections finish the translation and neither
 * copies anything upstream owns: `org_rule_sets` (a tenant's rules, a decision made here)
 * and `org_role_grants` (which `daas_user_roles` rows this code wrote, so it knows which
 * ones it may change).
 *
 * **Live, bounded, best-effort.** The platform is the source of truth, so a designation
 * assigned, changed or removed upstream takes effect at the next placement with no sync
 * in between. The price is one remote call, bounded by `PLACEMENT_TIMEOUT_MS`, which is
 * why this never runs inside a sign-in callback: it runs on the person's first page load
 * (see /api/org-platform/sync). A slow or failing platform changes nothing, anywhere.
 *
 * **A human placement always wins, per tenant.** A role row in a tenant that this code did
 * not write (the tenant's creator, an invite, an admin's edit) is a person's decision, and
 * this code writes nothing in that tenant. Anything unreadable counts as "placed".
 *
 * **Only rows in `org_role_grants` are ever changed or removed**, and only while the live
 * row still matches what was written. A role an admin has since edited is released.
 *
 * **Revoking needs a complete picture.** Only when the platform answered with a person it
 * knows, that tenant's rules were readable and enabled, and no job is undecided or
 * unresolved. "No decision" grants nothing and blocks revocation, so a missing or broken
 * rule can never take access away. A tenant's last Tenant Admin is never removed.
 *
 * Tenants are decided and reconciled independently: one person can be placed in several in
 * one run. Nothing here throws into the caller.
 */

import { getDaasUrl } from '@/lib/api/auth-headers';
import { ROLE_GRANTS_COLLECTION } from '@/lib/org-rules/constants';
import { decideForTenant, mayRevoke, type TenantDecision } from '@/lib/org-rules/decide';
import { isAdminRole, isGrantableRole } from '@/lib/org-rules/outcomes';
import { hasEnabledRules } from '@/lib/org-rules/parse';
import { notProvisioned, readAllRuleStates, serviceToken } from '@/lib/org-rules/store';
import { withSystemAttributes, type AccountFacts } from '@/lib/org-rules/system-attributes';
import { fetchPerson, isKnownPerson, isPlacementEnabled, isPlatformConfigured } from './client';

export interface ReconcileInput {
  userId: string;
  email: string;
  /** What the account's auth record says (sign-in method). `null` when it says nothing usable. */
  account: AccountFacts | null;
}

export interface ReconcileOutcome {
  granted: number;
  changed: number;
  revoked: number;
  /** Tenants where a human placement exists, so nothing was written. */
  skippedAlreadyPlaced: string[];
  /** Tenants where the person's jobs decided no role (so nothing was granted or removed). */
  undecidedTenants: string[];
  /** Why nothing was attempted, when that is the case. */
  skipped: 'disabled' | 'no-rules' | null;
  /** True when a lookup or a read could not run (platform down or slow, DaaS read failed). Nothing was changed because of it. */
  lookupFailed: boolean;
  /** True when it is worth trying again at the next page load (a lookup failed, or a write was refused). */
  retry: boolean;
}

const empty = (): ReconcileOutcome => ({
  granted: 0,
  changed: 0,
  revoked: 0,
  skippedAlreadyPlaced: [],
  undecidedTenants: [],
  skipped: null,
  lookupFailed: false,
  retry: false,
});

/** A `daas_user_roles` row this person holds in one tenant. */
interface RoleRow {
  id: string;
  role_id: string;
  resource_uri: string;
}

/** An `org_role_grants` row: a role this code wrote. */
interface TrackedGrant {
  id: string;
  user_id: string;
  tenant_uri: string;
  role_id: string;
  role_row_id: string;
}

interface DaasReply<T> {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
}

async function daas<T>(path: string, init: { method?: string; body?: unknown; tenantUri?: string } = {}): Promise<DaasReply<T>> {
  const res = await fetch(`${getDaasUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${serviceToken()}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      // Scope-registered collections treat a request without this as root scope and silently return nothing.
      ...(init.tenantUri ? { 'X-Resource-Uri': init.tenantUri } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = (JSON.parse(text) as { data?: T }).data ?? null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

const filterOf = (filter: unknown) => encodeURIComponent(JSON.stringify(filter));

/** Every tenant that exists, so a rule set left behind by a deleted tenant is never acted on. */
async function existingTenantUris(): Promise<Set<string> | null> {
  const typeId = process.env.TENANT_SCOPE_TYPE_ID;
  if (!typeId) return null;
  const res = await daas<{ uri_path?: string }[]>(
    `/items/daas_scope_items?filter=${filterOf({ scope_type_id: { _eq: typeId } })}&fields[]=uri_path&limit=1000`
  );
  if (!res.ok || !Array.isArray(res.data)) return null;
  return new Set(res.data.map((r) => r.uri_path).filter((u): u is string => typeof u === 'string'));
}

/**
 * Every role this person holds in this tenant, whoever wrote it.
 *
 * Reading MUST send `X-Resource-Uri: <tenant>` (see lib/api/tenant-role.ts): without it
 * `daas_user_roles` returns zero rows and a human placement becomes invisible.
 *
 * Null when unreadable. Callers treat that as "a person placed them" and write nothing,
 * because a missed change is recoverable by an admin while an unwanted one is a silent escalation.
 */
async function rolesIn(userId: string, tenantUri: string): Promise<RoleRow[] | null> {
  try {
    const res = await daas<{ id?: unknown; role_id?: unknown; resource_uri?: unknown }[]>(
      `/items/daas_user_roles?filter=${filterOf({ user_id: { _eq: userId }, resource_uri: { _eq: tenantUri } })}&fields[]=id&fields[]=role_id&fields[]=resource_uri&limit=100`,
      { tenantUri }
    );
    if (!res.ok || !Array.isArray(res.data)) return null;
    return res.data.map((row) => ({ id: String(row.id), role_id: String(row.role_id), resource_uri: typeof row.resource_uri === 'string' ? row.resource_uri : tenantUri }));
  } catch {
    return null;
  }
}

/** How many Tenant Admins the tenant has, or null when that cannot be told. */
async function adminCountIn(tenantUri: string): Promise<number | null> {
  const adminRoleId = process.env.TENANT_ADMIN_ROLE_ID;
  if (!adminRoleId) return null;
  try {
    const res = await daas<{ id?: unknown }[]>(
      `/items/daas_user_roles?filter=${filterOf({ resource_uri: { _eq: tenantUri }, role_id: { _eq: adminRoleId } })}&fields[]=id&limit=2`,
      { tenantUri }
    );
    if (!res.ok || !Array.isArray(res.data)) return null;
    return res.data.length;
  } catch {
    return null;
  }
}

/** Write one role row, returning its id. The scope goes in the header as well as the body, as `createTenant` does. */
async function grant(userId: string, roleId: string, tenantUri: string): Promise<string | null> {
  const res = await daas<{ id?: unknown }>('/items/daas_user_roles', {
    method: 'POST',
    tenantUri,
    body: { user_id: userId, role_id: roleId, resource_uri: tenantUri },
  });
  if (res.ok) return res.data?.id ? String(res.data.id) : null;
  if (!res.text.includes('duplicate')) console.warn(`[OrgOnboard] grant failed (${res.status})`);
  return null;
}

async function changeRole(rowId: string, roleId: string, tenantUri: string): Promise<boolean> {
  const res = await daas(`/items/daas_user_roles/${encodeURIComponent(rowId)}`, { method: 'PATCH', tenantUri, body: { role_id: roleId } });
  if (!res.ok) console.warn(`[OrgOnboard] role change failed (${res.status})`);
  return res.ok;
}

async function removeRole(rowId: string, tenantUri: string): Promise<boolean> {
  const res = await daas(`/items/daas_user_roles/${encodeURIComponent(rowId)}`, { method: 'DELETE', tenantUri });
  if (!res.ok) console.warn(`[OrgOnboard] role removal failed (${res.status})`);
  return res.ok;
}

/**
 * The bookkeeping in `org_role_grants`. A failed write is logged and otherwise ignored:
 * the worst case is a row written but not recorded, which is then treated as a person's
 * placement and left alone, the safe direction.
 */
async function track(method: 'POST' | 'PATCH' | 'DELETE', id: string | null, body?: Partial<TrackedGrant>): Promise<void> {
  try {
    const path = id ? `/items/${ROLE_GRANTS_COLLECTION}/${encodeURIComponent(id)}` : `/items/${ROLE_GRANTS_COLLECTION}`;
    const res = await daas(path, { method, ...(body ? { body } : {}) });
    if (!res.ok) console.warn(`[OrgOnboard] ${ROLE_GRANTS_COLLECTION} ${method} failed (${res.status})`);
  } catch (err) {
    console.warn(`[OrgOnboard] ${ROLE_GRANTS_COLLECTION} ${method} failed:`, err instanceof Error ? err.message : 'unknown error');
  }
}

/** What the person's grants say. Null when unreadable; `provisioned: false` when the collection is not there. */
async function readGrants(userId: string): Promise<{ provisioned: boolean; grants: TrackedGrant[] } | null> {
  try {
    const res = await daas<TrackedGrant[]>(
      `/items/${ROLE_GRANTS_COLLECTION}?filter=${filterOf({ user_id: { _eq: userId } })}&fields[]=id&fields[]=user_id&fields[]=tenant_uri&fields[]=role_id&fields[]=role_row_id&limit=1000`
    );
    if (notProvisioned(res.status)) return { provisioned: false, grants: [] };
    if (!res.ok || !Array.isArray(res.data)) return null;
    return { provisioned: true, grants: res.data };
  } catch {
    return null;
  }
}

/** Bring one tenant's role for this person in line with the decision. Mutates `outcome`. */
async function reconcileTenant(
  tenantUri: string,
  userId: string,
  decision: TenantDecision,
  mayRevokeHere: boolean,
  tracked: TrackedGrant[],
  outcome: ReconcileOutcome
): Promise<void> {
  const rows = await rolesIn(userId, tenantUri);
  if (!rows) {
    outcome.lookupFailed = true;
    outcome.retry = true;
    return;
  }

  // Ours = a row this code wrote and nobody has touched since. A row whose role an admin changed is theirs now;
  // so is any row we never recorded.
  const ours: { row: RoleRow; record: TrackedGrant } | null = (() => {
    for (const row of rows) {
      const record = tracked.find((t) => t.role_row_id === row.id);
      if (record && record.role_id === row.role_id) return { row, record };
    }
    return null;
  })();
  const human = rows.filter((row) => row.id !== ours?.row.id);

  // Records for rows that are gone or were adopted by an admin. Forgetting them is what makes an admin's edit stick.
  for (const record of tracked) {
    if (record.id !== ours?.record.id) await track('DELETE', record.id);
  }

  if (human.length > 0) {
    // Created the tenant, invited, or placed by an admin. Somebody decided where this person belongs; do not add a second opinion.
    if (decision.roleId) outcome.skippedAlreadyPlaced.push(tenantUri);
    return;
  }

  const target = decision.roleId;

  if (target) {
    // The ceiling is checked once more at the moment a role is written.
    if (!isGrantableRole(target)) return;

    if (ours) {
      if (ours.row.role_id === target) return;
      // Never demote a tenant's last Tenant Admin.
      if (isAdminRole(ours.row.role_id) && !isAdminRole(target)) {
        const admins = await adminCountIn(tenantUri);
        if (admins === null || admins <= 1) return;
      }
      if (await changeRole(ours.row.id, target, tenantUri)) {
        outcome.changed += 1;
        await track('PATCH', ours.record.id, { role_id: target });
      } else {
        outcome.retry = true;
      }
      return;
    }

    const rowId = await grant(userId, target, tenantUri);
    if (!rowId) {
      // Most often the person's account row is not there yet at the first page load; the next one tries again.
      outcome.retry = true;
      return;
    }
    outcome.granted += 1;
    await track('POST', null, { user_id: userId, tenant_uri: tenantUri, role_id: target, role_row_id: rowId });
    return;
  }

  // No role earned. Take back only what we wrote, and only on a complete picture.
  if (!ours) return;
  outcome.undecidedTenants.push(tenantUri);
  if (!mayRevokeHere) return;
  if (isAdminRole(ours.row.role_id)) {
    const admins = await adminCountIn(tenantUri);
    if (admins === null || admins <= 1) return;
  }
  if (await removeRole(ours.row.id, tenantUri)) {
    outcome.revoked += 1;
    outcome.undecidedTenants.pop();
    await track('DELETE', ours.record.id);
  } else {
    outcome.retry = true;
  }
}

/**
 * Bring this person's tenant roles in line with their Organisation Platform jobs, for every
 * tenant that has rules. Never throws; a failure is reported in the outcome and changes nothing.
 */
export async function reconcileFromOrgPlatform(input: ReconcileInput): Promise<ReconcileOutcome> {
  const outcome = empty();
  try {
    if (!isPlacementEnabled() || !isPlatformConfigured() || !input.email || !serviceToken()) {
      return { ...outcome, skipped: 'disabled' };
    }

    // The rules of each tenant. Unreadable is not "no rules": it could be a tenant with rules, so nothing is written.
    let states;
    let tenants: Set<string> | null;
    try {
      [states, tenants] = await Promise.all([readAllRuleStates(), existingTenantUris()]);
    } catch (err) {
      console.warn('[OrgOnboard] rule set read failed:', err instanceof Error ? err.message : 'unknown error');
      return { ...outcome, lookupFailed: true, retry: true };
    }
    if (!tenants) return { ...outcome, lookupFailed: true, retry: true };

    // Only tenants that exist and have at least one enabled rule decide anything.
    const deciding = [...states].filter(([uri, state]) => tenants.has(uri) && hasEnabledRules(state.ruleSet));
    if (deciding.length === 0) return { ...outcome, skipped: 'no-rules' };

    const granted = await readGrants(input.userId);
    if (!granted) return { ...outcome, lookupFailed: true, retry: true };
    // The bookkeeping collection is missing: nothing can be recorded, so nothing is written.
    if (!granted.provisioned) return { ...outcome, skipped: 'no-rules' };

    // ONE platform call for the person, whatever the number of tenants.
    let person;
    try {
      person = await fetchPerson(input.email);
    } catch (err) {
      console.warn('[OrgOnboard] people lookup failed:', err instanceof Error ? err.message : 'unknown error');
      return { ...outcome, lookupFailed: true, retry: true };
    }
    const known = isKnownPerson(person);
    const seen = withSystemAttributes(person, input.account);

    await Promise.all(
      deciding.map(async ([tenantUri, state]) => {
        const decision = decideForTenant(state.ruleSet!, seen);
        // Revoke only for a person the platform recognises, with every job decided and placed (D11).
        const mayRevokeHere = known && mayRevoke(decision);
        const tenantTracked = granted.grants.filter((g) => g.tenant_uri === tenantUri);
        await reconcileTenant(tenantUri, input.userId, decision, mayRevokeHere, tenantTracked, outcome);
      })
    );

    for (const [uri, state] of states) {
      if (state.problem) console.warn(`[OrgOnboard] rules for ${uri} were set aside: ${state.problem}`);
    }
    return outcome;
  } catch (err) {
    console.warn('[OrgOnboard] unexpected failure:', err instanceof Error ? err.message : 'unknown error');
    return { ...outcome, lookupFailed: true, retry: true };
  }
}
