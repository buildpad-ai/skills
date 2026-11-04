// buildpad-backend-file: supabase
/**
 * Removing what role assignment keeps for a tenant, when the tenant is deleted.
 *
 * `org_rule_sets` and `org_role_grants` are not scope-registered, so deleting a tenant does
 * not cascade to them. Best-effort and never throws: a row left behind is harmless, because
 * placement only acts on tenants that still exist, and a deployment where the collections
 * are not created yet simply has nothing to clear.
 */

import { getDaasUrl } from '@/lib/api/auth-headers';
import { ROLE_GRANTS_COLLECTION, RULE_SETS_COLLECTION } from './constants';
import { notProvisioned, serviceToken } from './store';

async function clearCollection(collection: string, tenantUri: string): Promise<void> {
  const headers = { Authorization: `Bearer ${serviceToken()}` };
  const filter = encodeURIComponent(JSON.stringify({ tenant_uri: { _eq: tenantUri } }));
  const list = await fetch(`${getDaasUrl()}/items/${collection}?filter=${filter}&fields[]=id&limit=1000`, { headers, cache: 'no-store' });
  if (notProvisioned(list.status)) return;
  if (!list.ok) throw new Error(`list ${collection} -> ${list.status}`);
  const ids: string[] = (((await list.json().catch(() => null)) as { data?: { id: string }[] } | null)?.data ?? []).map((r) => r.id);
  for (const id of ids) {
    const del = await fetch(`${getDaasUrl()}/items/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    if (!del.ok) throw new Error(`delete ${collection}/${id} -> ${del.status}`);
  }
}

export async function clearTenantOrgRules(tenantUri: string): Promise<void> {
  for (const collection of [ROLE_GRANTS_COLLECTION, RULE_SETS_COLLECTION]) {
    try {
      await clearCollection(collection, tenantUri);
    } catch (err) {
      console.warn(`[tenant delete] could not clear ${collection}:`, err instanceof Error ? err.message : 'unknown error');
    }
  }
}
