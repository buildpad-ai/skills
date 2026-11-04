// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * One-time import of Xtremax people from the Organisation Platform, so they can be
 * @mentioned before they have ever signed in.
 *
 * Pulls every person who holds a designation (the platform lists role assignments, each
 * carrying the holder's email) and creates a directory account for each one that does not
 * have one yet, exactly as the Administrator "Add user" form does (`createDirectoryUser`).
 * Their first MyApps sign-in later attaches to that same account.
 *
 *  - **Preview first.** `loadImportPlan` changes nothing and says who would be created, who
 *    already exists and who is skipped.
 *  - **The server is the authority.** A run is given emails to create, but each one is
 *    checked against the platform's current list and the directory again, so a request can
 *    never create someone the platform does not list, or create anyone twice.
 *  - **Batched and idempotent.** A run handles a handful of people per call (so it fits in
 *    one request) and can be repeated: people who exist are reported as existing.
 *  - **Only what mentioning needs.** Email and name. Nothing else the platform knows about a
 *    person (mobile, date of birth, attributes) is read or stored. No tenant role is granted.
 *
 * Server-only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRoleAssignmentListItem } from '@xtremax/organisation-platform/contract';
import { createDirectoryUser } from '@/lib/admin-user-create';
import { checkNewUser, normalizeEmail } from '@/lib/admin-users';
import { isExcludedEmail } from '@/lib/mentionable-users';
import { isOrgPlatformError } from '@xtremax/organisation-platform/client';
import { fetchPersonForImport, platformClient } from './client';

/** Name lookups in flight at once. The platform rate-limits, and ten at a time was enough to trip it. */
const NAME_LOOKUP_CONCURRENCY = 3;

/** Why a name could not be read, in words an administrator can act on. */
export function nameLookupFailure(error: unknown): string {
  const code = isOrgPlatformError(error) ? error.code : undefined;
  switch (code) {
    case 'RATE_LIMITED':
      return 'The Organisation Platform was busy (too many requests). Run the import again to retry.';
    case 'TIMEOUT':
    case 'NETWORK':
    case 'UPSTREAM_ERROR':
      return 'The Organisation Platform did not answer in time. Run the import again to retry.';
    case 'NOT_FOUND':
      return 'The Organisation Platform has no profile for this email address.';
    default:
      return 'Could not read their name from the Organisation Platform.';
  }
}

/** Run `task` over `items` with at most `limit` in flight; never rejects (each task reports its own result). */
export async function mapWithLimit<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]!);
  });
  await Promise.all(workers);
}

/** People created per run request. Small enough to finish well inside one request. */
export const IMPORT_BATCH_SIZE = 10;

const LIST_TIMEOUT_MS = 30_000;
const PAGE = 1000;
const MAX_DIRECTORY_ROWS = 20_000;

export interface SkippedPerson {
  email: string;
  reason: 'invalid' | 'system-or-test';
}

export interface ImportPlan {
  /** Distinct people the platform lists. */
  total: number;
  /** Listed, valid and not in the directory yet: what a run would create. */
  toCreate: string[];
  /** Listed and already in the directory (count). */
  existing: number;
  /** The same people, by email. For server-side checks; not sent to the browser. */
  existingEmails: string[];
  skipped: SkippedPerson[];
  /** Assignments that carry no email, so cannot be turned into an account. */
  withoutEmail: number;
  /**
   * The names the platform's list already carried, by email, for the people to create. Present only when the
   * platform sends names in its list (a person it does not know a name for is `null`/`null`). Absent on an older
   * platform, in which case names are looked up one by one. Server-side only; not sent to the browser.
   */
  names: Record<string, { firstName: string | null; lastName: string | null }>;
}

/** What a list item may carry beyond the published contract: the holder's names (newer platform versions). */
type ListedAssignee = { email?: string | null; firstName?: unknown; lastName?: unknown };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure: what to do, given the platform's assignments and the emails already in the directory (lower-cased). */
export function planImport(assignments: readonly Pick<OrgRoleAssignmentListItem, 'assignee'>[], directoryEmails: ReadonlySet<string>): ImportPlan {
  const seen = new Set<string>();
  const toCreate: string[] = [];
  const skipped: SkippedPerson[] = [];
  const existingEmails: string[] = [];
  const listedNames = new Map<string, { firstName: string | null; lastName: string | null }>();
  let withoutEmail = 0;

  for (const a of assignments) {
    const assignee = a.assignee as ListedAssignee | undefined;
    const raw = assignee?.email;
    if (!raw || !raw.trim()) {
      withoutEmail += 1;
      continue;
    }
    const email = normalizeEmail(raw);

    // A person appears once per designation; take the names from whichever of their rows carries them.
    if (assignee && ('firstName' in assignee || 'lastName' in assignee)) {
      const first = typeof assignee.firstName === 'string' && assignee.firstName.trim() ? assignee.firstName.trim() : null;
      const last = typeof assignee.lastName === 'string' && assignee.lastName.trim() ? assignee.lastName.trim() : null;
      const known = listedNames.get(email);
      if (!known || (!known.firstName && !known.lastName)) listedNames.set(email, { firstName: first, lastName: last });
    }

    if (seen.has(email)) continue;
    seen.add(email);

    if (!EMAIL_PATTERN.test(email)) skipped.push({ email, reason: 'invalid' });
    else if (isExcludedEmail(email)) skipped.push({ email, reason: 'system-or-test' });
    else if (directoryEmails.has(email)) existingEmails.push(email);
    else toCreate.push(email);
  }

  toCreate.sort();
  const names: ImportPlan['names'] = {};
  for (const email of toCreate) {
    const listed = listedNames.get(email);
    if (listed) names[email] = listed;
  }
  return { total: seen.size, toCreate, existing: existingEmails.length, existingEmails, skipped, withoutEmail, names };
}

/** Every email in the directory, lower-cased. Paged, because the data API caps one response. */
export async function listDirectoryEmails(supabase: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let from = 0; from < MAX_DIRECTORY_ROWS; from += PAGE) {
    const { data, error } = await supabase.from('daas_users').select('email').order('email', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error('Could not read the user directory.');
    for (const row of data ?? []) if (typeof row.email === 'string') emails.add(normalizeEmail(row.email));
    if (!data || data.length < PAGE) return emails;
  }
  throw new Error('The user directory is too large to compare.');
}

/**
 * The platform's list is the same for every batch of one import, and reading it is the heaviest call the
 * platform serves, so a run's batches share one read for a couple of minutes instead of repeating it ~20 times.
 * Only the platform's list is kept: the directory is read every time, because it changes as people are created.
 * A preview always reads fresh. Another server instance simply misses the cache and reads for itself.
 */
const LIST_CACHE_MS = 2 * 60_000;
let listCache: { at: number; assignments: Awaited<ReturnType<ReturnType<typeof platformClient>['orgRoleAssignments']>> } | null = null;

/** Forget the cached platform list. Tests, and anything that needs the platform's answer from now. */
export function resetImportCache(): void {
  listCache = null;
}

type Assignments = Awaited<ReturnType<ReturnType<typeof platformClient>['orgRoleAssignments']>>;

/** The platform's list, from the short cache unless `fresh`. The offboarding review shares this read. */
export async function readAssignments(fresh: boolean, list: () => Promise<Assignments> = () => platformClient().orgRoleAssignments({ timeoutMs: LIST_TIMEOUT_MS })): Promise<Assignments> {
  if (!fresh && listCache && Date.now() - listCache.at < LIST_CACHE_MS) return listCache.assignments;
  const assignments = await list();
  listCache = { at: Date.now(), assignments };
  return assignments;
}

/** Read-only: ask the platform who is listed, compare with the directory. Changes nothing. */
export async function loadImportPlan(supabase: SupabaseClient, options: { fresh?: boolean } = {}): Promise<ImportPlan> {
  const [assignments, directory] = await Promise.all([readAssignments(options.fresh === true), listDirectoryEmails(supabase)]);
  return planImport(assignments, directory);
}

/** Email (lower-case) to account id, for the whole directory. Paged like `listDirectoryEmails`. */
export async function listDirectoryIds(supabase: SupabaseClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (let from = 0; from < MAX_DIRECTORY_ROWS; from += PAGE) {
    const { data, error } = await supabase.from('daas_users').select('id,email').order('email', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error('Could not read the user directory.');
    for (const row of data ?? []) if (typeof row.email === 'string') ids.set(normalizeEmail(row.email), String(row.id));
    if (!data || data.length < PAGE) return ids;
  }
  throw new Error('The user directory is too large to compare.');
}

/** Hooks an import run may be given. Optional, so the import works (and is testable) without them. */
export interface ImportHooks {
  /** Remember people the platform listed (see ./provenance). A failure here is never the import's failure. */
  recordSeen?: (people: { userId: string; email: string }[]) => Promise<unknown>;
}

/**
 * Record, as "seen on the platform", the people who are listed AND already had an account before this import (the ones
 * a run does not create). Together with the people a run creates, this is who the "Offboarding review" can ever look at.
 * Idempotent. Returns how many were handed to the recorder.
 */
export async function recordExistingListed(supabase: SupabaseClient, hooks: ImportHooks): Promise<number> {
  if (!hooks.recordSeen) return 0;
  const assignments = await readAssignments(false);
  const [directory, ids] = await Promise.all([listDirectoryEmails(supabase), listDirectoryIds(supabase)]);
  const plan = planImport(assignments, directory);
  const people = plan.existingEmails.map((email) => ({ userId: ids.get(email), email })).filter((p): p is { userId: string; email: string } => !!p.userId);
  await hooks.recordSeen(people);
  return people.length;
}

export type ImportOutcome =
  | { email: string; status: 'created'; name: string }
  | { email: string; status: 'existing' }
  | { email: string; status: 'not-listed' }
  | { email: string; status: 'failed'; message: string };

/**
 * Create the requested people, at most `IMPORT_BATCH_SIZE`. Anything not in the platform's
 * current list is refused ('not-listed'); anyone already in the directory is 'existing'.
 * A person whose name cannot be read is 'failed' and not created, so a repeat run picks them up.
 */
export async function importPeople(supabase: SupabaseClient, requested: readonly string[], hooks: ImportHooks = {}): Promise<ImportOutcome[]> {
  const wanted = [...new Set(requested.map((e) => normalizeEmail(String(e))))].slice(0, IMPORT_BATCH_SIZE);
  if (wanted.length === 0) return [];

  const plan = await loadImportPlan(supabase);
  const creatable = new Set(plan.toCreate);
  const present = new Set(plan.existingEmails);

  // Names: the platform's list already carries them (one call for everyone). Only when it does not (an older
  // platform) are they looked up one by one, a few at a time because it rate-limits and with the platform's own
  // retry rules. A failure keeps its reason so the administrator can act on it.
  const names = new Map<string, { firstName: string; lastName: string } | { error: string }>();
  const needLookup: string[] = [];
  for (const email of wanted.filter((e) => creatable.has(e))) {
    const listed = plan.names[email];
    if (listed) names.set(email, { firstName: listed.firstName ?? '', lastName: listed.lastName ?? '' });
    else needLookup.push(email);
  }
  await mapWithLimit(needLookup, NAME_LOOKUP_CONCURRENCY, async (email) => {
    try {
      const person = await fetchPersonForImport(email);
      names.set(email, { firstName: person.firstName?.trim() ?? '', lastName: person.lastName?.trim() ?? '' });
    } catch (err) {
      names.set(email, { error: nameLookupFailure(err) });
    }
  });

  const outcomes: ImportOutcome[] = [];
  const createdPeople: { userId: string; email: string }[] = [];
  for (const email of wanted) {
    if (!creatable.has(email)) {
      // Not something to create: either they exist already, or the platform does not list them (or they are skipped).
      outcomes.push(present.has(email) ? { email, status: 'existing' } : { email, status: 'not-listed' });
      continue;
    }
    const name = names.get(email);
    if (!name || 'error' in name) {
      outcomes.push({ email, status: 'failed', message: name && 'error' in name ? name.error : nameLookupFailure(undefined) });
      continue;
    }
    const check = checkNewUser({ email, firstName: name.firstName, lastName: name.lastName });
    if (!check.ok) {
      outcomes.push({ email, status: 'failed', message: check.error });
      continue;
    }
    const result = await createDirectoryUser(supabase, check.value);
    if (result.status === 'created') {
      createdPeople.push({ userId: result.id, email });
      outcomes.push({ email, status: 'created', name: result.name });
    }
    else if (result.status === 'duplicate') outcomes.push({ email, status: 'existing' });
    else outcomes.push({ email, status: 'failed', message: result.message });
  }

  // Remember the people this run created: they were listed on the platform just now. A failure here is not the import's.
  if (hooks.recordSeen && createdPeople.length > 0) {
    await hooks.recordSeen(createdPeople).catch((err) => console.warn('[import] could not record people seen on the platform:', err instanceof Error ? err.message : err));
  }

  return outcomes;
}
