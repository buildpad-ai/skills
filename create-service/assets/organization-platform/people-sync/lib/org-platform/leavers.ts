// buildpad-backend-file: supabase
/**
 * Offboarding review: help an administrator notice accounts of people who were on the Organisation Platform and no longer are.
 *
 * The platform has no "this person left" signal, and some current colleagues were never on it (no designation, no
 * profile), so "the platform has no record of X" proves nothing on its own. What does mean something is a person the
 * platform DID list, to an import run, who has since disappeared from it. So this only ever looks at the people recorded
 * by the import (`provenance.ts`), and works in two steps:
 *
 *   1. **Candidates**: recorded people whose account is still active, on the company's own email domain(s), and whom the
 *      platform's designation list no longer covers. Cheap, no per-person calls.
 *   2. **Check**: ask the platform about each candidate, live. Only an answer of "I do not know this person" flags them.
 *      A person the platform still knows (they just lost their designation) is NOT flagged, and a lookup that failed
 *      flags nobody.
 *
 * One false positive remains: the platform may now hold the same person under a different address. A candidate whose name
 * matches a listed person gets a `similar` hint so the administrator can see that before suspending.
 *
 * Suspending is the only action: the account's status becomes `suspended` (reversible from the Users page). Never a
 * delete, so comments, feedback and history stay. The server decides everything: a suspend request is a list of emails,
 * and each one is re-verified live, so a tampered request cannot suspend someone the platform still knows. It never
 * suspends the caller, system or test accounts, someone outside the company domain, or the last real administrator.
 *
 * Everything that touches the network is passed in, so this is testable without one. Server-only by its callers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRoleAssignmentListItem, PersonLookup } from '@xtremax/organisation-platform/contract';
import { normalizeEmail } from '@/lib/admin-users';
import { isExcludedEmail } from '@/lib/mentionable-users';
import { mapWithLimit, readAssignments } from './people-import';

export const LEAVERS_BATCH_SIZE = 10;
const LOOKUP_CONCURRENCY = 3;
const PAGE = 1000;
const MAX_DIRECTORY_ROWS = 20_000;

/** The global Administrator role. Only root-scope rows count: an Administrator role at a tenant confers no admin. */
export const ADMINISTRATOR_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A syntactically valid address that is not a system or test account. */
export const isRealAccountEmail = (email: string | null | undefined): boolean => !!email && EMAIL_PATTERN.test(email.trim()) && !isExcludedEmail(email) && !isReservedDomain(email);

/** Domains reserved for documentation and tests (RFC 2606): never a real person, whatever else the list says. */
function isReservedDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().slice(email.lastIndexOf('@') + 1);
  return ['example.com', 'example.org', 'example.net'].includes(domain) || /\.(test|invalid|localhost|example)$/.test(domain);
}

/**
 * The company's own email domains (lower-case, no @): `ORG_COMPANY_DOMAINS`, comma separated, default `xtremax.com`.
 * Only accounts on these domains can ever be a leaver candidate, so an external submitter or a test account never is.
 */
export function companyDomains(raw: string | undefined = process.env.ORG_COMPANY_DOMAINS): string[] {
  const list = (raw ?? '').split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  return list.length > 0 ? list : ['xtremax.com'];
}

interface DirectoryRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
}

export interface LeaverCandidate {
  email: string;
  name: string;
  holdsAdmin: boolean;
  /** A person the platform lists under another address with the same name: possibly this person, not a leaver. */
  similar: { email: string; name: string } | null;
}

export interface LeaversDeps {
  supabase: SupabaseClient;
  /** Every assignment the platform lists. */
  listAssignments: () => Promise<OrgRoleAssignmentListItem[]>;
  /** The platform's answer for one person. Throws on any failure. */
  lookupPerson: (email: string) => Promise<PersonLookup>;
  /** Whether the answer is about a person the platform knows. */
  isKnownPerson: (person: PersonLookup) => boolean;
  /** The company's own email domains (lower-case, no @). Only these are ever candidates. */
  domains: readonly string[];
  /** Mark an account suspended. */
  suspend: (userId: string) => Promise<boolean>;
  /** The administrator running this. Never a candidate, never suspended. */
  callerId: string;
  /** The people an import run recorded as listed on the platform (see ./provenance). Only these can be candidates. */
  tracked: () => Promise<readonly { user_id: string }[]>;
}

const nameKey = (first: string | null | undefined, last: string | null | undefined) => `${first ?? ''}${last ?? ''}`.toLowerCase().replace(/[^a-z]/g, '');

const displayName = (row: DirectoryRow) => [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;

async function readDirectory(supabase: SupabaseClient): Promise<DirectoryRow[]> {
  const rows: DirectoryRow[] = [];
  for (let from = 0; from < MAX_DIRECTORY_ROWS; from += PAGE) {
    const { data, error } = await supabase.from('daas_users').select('id,email,first_name,last_name,status').order('email', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error('Could not read the user directory.');
    for (const row of (data ?? []) as DirectoryRow[]) if (typeof row.email === 'string') rows.push({ ...row, email: normalizeEmail(row.email) });
    if (!data || data.length < PAGE) return rows;
  }
  throw new Error('The user directory is too large to review.');
}

async function administratorIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('daas_user_roles').select('user_id').eq('role_id', ADMINISTRATOR_ROLE_ID).is('resource_uri', null);
  if (error || !data) throw new Error('Could not read who is an administrator.');
  return new Set(data.map((r) => String((r as { user_id: string }).user_id)));
}

const domainOf = (email: string) => email.slice(email.lastIndexOf('@') + 1);

/**
 * Who is worth asking the platform about. Throws (flags nobody) when the platform listed nobody at all, because an empty
 * list is far more likely to be a platform problem than a company with no staff.
 */
export async function loadCandidates(deps: LeaversDeps, options: { fresh?: boolean } = {}) {
  const assignments = await readAssignments(options.fresh === true, deps.listAssignments);
  const listed = new Set<string>();
  const listedByName = new Map<string, { email: string; name: string }>();
  for (const a of assignments) {
    const assignee = a.assignee as { email?: string | null; firstName?: unknown; lastName?: unknown } | undefined;
    if (!assignee?.email || !assignee.email.trim()) continue;
    const email = normalizeEmail(assignee.email);
    listed.add(email);
    const first = typeof assignee.firstName === 'string' ? assignee.firstName : null;
    const last = typeof assignee.lastName === 'string' ? assignee.lastName : null;
    const key = nameKey(first, last);
    if (key && !listedByName.has(key)) listedByName.set(key, { email, name: [first, last].filter(Boolean).join(' ') });
  }
  if (listed.size === 0) throw new Error('The Organisation Platform listed nobody, so no one can be reviewed.');

  const [directory, admins, tracked] = await Promise.all([readDirectory(deps.supabase), administratorIds(deps.supabase), deps.tracked()]);
  const trackedIds = new Set(tracked.map((t) => String(t.user_id).toLowerCase()));
  const domains = new Set(deps.domains.map((d) => d.toLowerCase()));
  const rows = directory.filter(
    (row) =>
      trackedIds.has(row.id.toLowerCase()) &&
      row.id !== deps.callerId &&
      (row.status ?? 'active') === 'active' &&
      isRealAccountEmail(row.email) &&
      domains.has(domainOf(row.email)) &&
      !listed.has(row.email)
  );
  const similarTo = (row: DirectoryRow) => {
    const match = listedByName.get(nameKey(row.first_name, row.last_name));
    return match && match.email !== row.email ? match : null;
  };
  return {
    listed: listed.size,
    tracked: trackedIds.size,
    candidates: rows.map((row): LeaverCandidate => ({ email: row.email, name: displayName(row), holdsAdmin: admins.has(row.id), similar: nameKey(row.first_name, row.last_name) ? similarTo(row) : null })),
    rows,
    admins,
    directory,
  };
}

export type CheckState = 'left' | 'on-platform' | 'not-a-candidate' | 'error';

export interface CheckOutcome {
  email: string;
  state: CheckState;
  message?: string;
}

/** Ask the platform about each requested candidate. Only "the platform does not know them" is `left`. */
export async function checkLeavers(deps: LeaversDeps, requested: readonly string[]): Promise<CheckOutcome[]> {
  const wanted = [...new Set(requested.map((e) => normalizeEmail(String(e))))].slice(0, LEAVERS_BATCH_SIZE);
  if (wanted.length === 0) return [];
  const { rows } = await loadCandidates(deps);
  const candidates = new Set(rows.map((r) => r.email));

  const out = new Map<string, CheckOutcome>();
  const toAsk = wanted.filter((email) => {
    if (candidates.has(email)) return true;
    out.set(email, { email, state: 'not-a-candidate' });
    return false;
  });
  await mapWithLimit(toAsk, LOOKUP_CONCURRENCY, async (email) => {
    try {
      const person = await deps.lookupPerson(email);
      out.set(email, { email, state: deps.isKnownPerson(person) ? 'on-platform' : 'left' });
    } catch {
      // A failed lookup flags nobody: it could be a busy platform, and the next check retries.
      out.set(email, { email, state: 'error', message: 'The Organisation Platform could not be asked about this person. Check again to retry.' });
    }
  });
  return wanted.map((email) => out.get(email)!);
}

export type SuspendOutcome =
  | { email: string; status: 'suspended' }
  | { email: string; status: 'refused'; reason: string }
  | { email: string; status: 'failed'; message: string };

/**
 * Suspend the requested people, at most `LEAVERS_BATCH_SIZE`. Each is re-verified live first; anyone who is not a
 * candidate, whom the platform still knows, or whose lookup failed is left alone.
 */
export async function suspendLeavers(deps: LeaversDeps, requested: readonly string[]): Promise<SuspendOutcome[]> {
  const wanted = [...new Set(requested.map((e) => normalizeEmail(String(e))))].slice(0, LEAVERS_BATCH_SIZE);
  if (wanted.length === 0) return [];
  const { rows, directory, admins } = await loadCandidates(deps);
  const byEmail = new Map(rows.map((r) => [r.email, r]));

  // Real, active administrators now. A suspend that would leave none is refused, counting those suspended just before it.
  const standingAdmins = new Set(directory.filter((r) => admins.has(r.id) && (r.status ?? 'active') === 'active' && isRealAccountEmail(r.email)).map((r) => r.id));

  const results: SuspendOutcome[] = [];
  for (const email of wanted) {
    const row = byEmail.get(email);
    if (!row) {
      results.push({ email, status: 'refused', reason: 'Not an active account on the company domain, or the platform lists them.' });
      continue;
    }
    let known: boolean;
    try {
      known = deps.isKnownPerson(await deps.lookupPerson(email));
    } catch {
      results.push({ email, status: 'failed', message: 'The Organisation Platform could not be asked, so nothing was changed. Try again.' });
      continue;
    }
    if (known) {
      results.push({ email, status: 'refused', reason: 'The Organisation Platform still knows this person.' });
      continue;
    }
    if (standingAdmins.has(row.id) && standingAdmins.size <= 1) {
      results.push({ email, status: 'refused', reason: 'They are the last administrator. Make someone else an administrator first.' });
      continue;
    }
    if (!(await deps.suspend(row.id))) {
      results.push({ email, status: 'failed', message: 'Could not suspend the account.' });
      continue;
    }
    standingAdmins.delete(row.id);
    results.push({ email, status: 'suspended' });
  }
  return results;
}
