// buildpad-backend-file: supabase
/**
 * Where a tenant's rule set is kept: one row of `org_rule_sets` per tenant.
 *
 *  - Not scope-partitioned, and read and written with the service key after the
 *    caller has been authorised. The tenant is always the one the caller's session
 *    names, never one a request body claims.
 *  - No generic write path. The save route rebuilds the payload itself and never
 *    forwards a request body, so a client cannot set `tenant_uri`, `version` or
 *    `updated_by`.
 *  - Optimistic concurrency: a save names the `version` it was based on and is refused
 *    if someone saved since, rather than overwriting their work.
 *
 * A deployment where the collection does not exist yet answers 403 or 404. That is
 * "not provisioned": no tenant has rules, so none decides anything.
 */

import type { RuleSet } from '@xtremax/organisation-platform/engine';
import { getDaasUrl } from '@/lib/api/auth-headers';
import { RULE_SETS_COLLECTION, RULE_SET_SCHEMA_VERSION } from './constants';
import { parseStoredRuleSet } from './parse';

/** One tenant's stored state, already parsed. Never throws on bad content. */
export interface TenantRuleState {
  /** Null when there is none, or when what is stored cannot be trusted (see `problem`). */
  ruleSet: RuleSet | null;
  /** Why the stored rules were set aside, for admins to see. Null when all is well. */
  problem: string | null;
  /** 0 until the first save. A save must quote the version it was based on. */
  version: number;
  /** The row, or null when nothing has been saved. */
  rowId: string | null;
}

export const defaultState = (): TenantRuleState => ({ ruleSet: null, problem: null, version: 0, rowId: null });

interface Row {
  id?: unknown;
  tenant_uri?: unknown;
  schema_version?: unknown;
  rules?: unknown;
  version?: unknown;
}

/** Turn a stored row into a state. Anything unreadable is "no rules", never a guess. */
export function stateFromRow(row: Row | undefined | null): TenantRuleState {
  if (!row) return defaultState();
  const version = typeof row.version === 'number' && Number.isInteger(row.version) ? row.version : 0;
  const rowId = row.id === undefined || row.id === null ? null : String(row.id);

  const parsed = parseStoredRuleSet(row.rules, row.schema_version ?? RULE_SET_SCHEMA_VERSION);
  if (!parsed.ok) return { ruleSet: null, problem: parsed.problem, version, rowId };
  return { ruleSet: parsed.ruleSet, problem: null, version, rowId };
}

/** The service key every read and write here carries. */
export const serviceToken = (): string | undefined => process.env.SERVICE_ACCOUNT_KEY;

async function daas(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${getDaasUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${serviceToken()}`, ...(init.body !== undefined && { 'Content-Type': 'application/json' }) },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return { ok: res.ok, status: res.status, data: body?.data };
}

/** The collection is not there (or not readable): nothing has been provisioned, so there are no rules. */
export const notProvisioned = (status: number) => status === 403 || status === 404;

const FIELDS = 'id,tenant_uri,schema_version,rules,version';

/**
 * The state of every tenant that has a row. A tenant with no row has no rules.
 *
 * @throws when the collection should be readable but is not (a 5xx, a network error),
 *   so the caller can refuse to act on a half-known picture instead of guessing.
 */
export async function readAllRuleStates(): Promise<Map<string, TenantRuleState>> {
  const out = new Map<string, TenantRuleState>();
  const res = await daas(`/items/${RULE_SETS_COLLECTION}?fields=${FIELDS}&limit=1000`);
  if (notProvisioned(res.status)) return out;
  if (!res.ok) throw new Error(`${RULE_SETS_COLLECTION} read failed: HTTP ${res.status}`);

  for (const row of (Array.isArray(res.data) ? res.data : []) as Row[]) {
    if (typeof row.tenant_uri === 'string') out.set(row.tenant_uri, stateFromRow(row));
  }
  return out;
}

export type ReadOneResult = { ok: true; state: TenantRuleState; provisioned: boolean } | { ok: false };

/** One tenant's state, for the admin screens. */
export async function readRuleState(tenantUri: string): Promise<ReadOneResult> {
  try {
    const filter = encodeURIComponent(JSON.stringify({ tenant_uri: { _eq: tenantUri } }));
    const res = await daas(`/items/${RULE_SETS_COLLECTION}?filter=${filter}&fields=${FIELDS}&limit=1`);
    if (notProvisioned(res.status)) return { ok: true, state: defaultState(), provisioned: false };
    if (!res.ok) return { ok: false };
    return { ok: true, state: stateFromRow((Array.isArray(res.data) ? res.data[0] : undefined) as Row | undefined), provisioned: true };
  } catch {
    return { ok: false };
  }
}

export interface SaveInput {
  ruleSet: RuleSet;
  /** The version this edit started from; 0 for the first save. */
  baseVersion: number;
  userId: string;
}

export type SaveResult =
  | { ok: true; state: TenantRuleState }
  /** Someone saved since `baseVersion`. Nothing was written. */
  | { ok: false; reason: 'conflict'; current: TenantRuleState }
  | { ok: false; reason: 'not_provisioned' }
  | { ok: false; reason: 'unavailable' };

/**
 * Save a tenant's rules. The payload is built here from validated
 * values, never forwarded from a request.
 */
export async function saveRuleState(tenantUri: string, input: SaveInput): Promise<SaveResult> {
  const current = await readRuleState(tenantUri);
  if (!current.ok) return { ok: false, reason: 'unavailable' };
  if (!current.provisioned) return { ok: false, reason: 'not_provisioned' };
  if (current.state.version !== input.baseVersion) return { ok: false, reason: 'conflict', current: current.state };

  const version = current.state.version + 1;
  const columns = {
    schema_version: RULE_SET_SCHEMA_VERSION,
    rules: input.ruleSet,
    version,
    updated_by: input.userId,
  };

  try {
    const res = current.state.rowId
      ? await daas(`/items/${RULE_SETS_COLLECTION}/${encodeURIComponent(current.state.rowId)}`, { method: 'PATCH', body: columns })
      : await daas(`/items/${RULE_SETS_COLLECTION}`, { method: 'POST', body: { tenant_uri: tenantUri, ...columns } });

    if (!res.ok) {
      // The unique `tenant_uri` refusing a second first-save is a lost race, not an outage.
      const raced = !current.state.rowId && (res.status === 400 || res.status === 409);
      if (raced) {
        const again = await readRuleState(tenantUri);
        if (again.ok) return { ok: false, reason: 'conflict', current: again.state };
      }
      return { ok: false, reason: 'unavailable' };
    }

    // Read back: two saves that both passed the check above cannot both be version N+1.
    const after = await readRuleState(tenantUri);
    if (!after.ok) return { ok: false, reason: 'unavailable' };
    if (after.state.version !== version) return { ok: false, reason: 'conflict', current: after.state };
    return { ok: true, state: after.state };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
