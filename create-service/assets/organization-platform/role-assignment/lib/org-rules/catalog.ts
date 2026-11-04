// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * The lists the rule editor offers (designations, units, custom attributes), read
 * live from the Organisation Platform's single Xtremax root.
 *
 * Nothing here is stored: names are renameable upstream, so only ids are kept in
 * rules and every screen reads the names fresh. If any live read fails the whole
 * catalog is reported as unavailable, and the editor goes read-only, rather than
 * offering a partial list that could make a rule look like it names something it
 * does not.
 *
 * Every Tenant Admin reads the same lists, so they are cached briefly in memory
 * instead of each editor open hitting the platform.
 */

import { toCatalogs, type BuilderCatalogs } from '@xtremax/organisation-platform/adapter';
import type { OrgRole as ContractOrgRole } from '@xtremax/organisation-platform/contract';
import { platformClient } from '@/lib/org-platform/client';

export type CatalogResult = { ok: true; catalogs: BuilderCatalogs } | { ok: false };

const CACHE_MS = 60_000;
let cache: { at: number; catalogs: BuilderCatalogs } | null = null;

/** Drop the cache. Tests, and anything that needs the platform's answer from now. */
export const clearCatalogCache = () => {
  cache = null;
};

export async function loadCatalogs(): Promise<CatalogResult> {
  if (cache && Date.now() - cache.at < CACHE_MS) return { ok: true, catalogs: cache.catalogs };
  try {
    const { units, roles, personAttributes } = await platformClient().snapshot();
    const catalogs = toCatalogs({
      units,
      roles: roles.map((role): ContractOrgRole => ({ ...role, status: role.status === 'inactive' ? 'inactive' : 'active' })),
      personAttributes,
    });
    cache = { at: Date.now(), catalogs };
    return { ok: true, catalogs };
  } catch (err) {
    console.error('[org-rules] catalog read failed:', err instanceof Error ? err.message : 'unknown error');
    return { ok: false };
  }
}
