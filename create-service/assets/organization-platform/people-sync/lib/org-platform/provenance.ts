// buildpad-backend-file: supabase
/**
 * Who the Organisation Platform has listed to this app: the people an administrator's "Import from Organisation Platform"
 * run saw on the platform, whether the run created their account or they already had one. This is the ONLY set the
 * "Offboarding review" looks at, because only these people are known to have been on the platform with a designation.
 *
 * Colleagues who were never on the platform (so never recorded here) can never be flagged for offboarding: the platform
 * having no record of them proves nothing.
 *
 * Kept in `org_platform_people` (unique `user_id`, `email`, `first_seen_at`), read and written with the service key.
 * Users have no DaaS permission on the collection. Where it does not exist yet (403/404) nobody has been recorded, so
 * nobody can be reviewed.
 */

import { getDaasUrl } from '@/lib/api/auth-headers';
import { serviceToken } from '@/lib/org-rules/store';

export const PEOPLE_COLLECTION = 'org_platform_people';

export interface DaasReply<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

/** One DaaS call, with whatever token the caller holds. Injected so this module is testable without a network. */
export type DaasCall = <T = unknown>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => Promise<DaasReply<T>>;

/** The service-key call every real caller passes in. */
export const serviceCall: DaasCall = async <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<DaasReply<T>> => {
  const res = await fetch(`${getDaasUrl()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${serviceToken()}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { data?: T } | null;
  return { ok: res.ok, status: res.status, data: (json?.data ?? null) as T | null };
};

export interface TrackedPerson {
  user_id: string;
  email: string;
}

const CHUNK = 50;
const PAGE = 1000;
const MAX_ROWS = 20_000;

const chunks = <T>(items: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** Remember these people as seen on the platform. Idempotent: someone already recorded is left as is. Returns how many were new. */
export async function recordSeen(call: DaasCall, people: readonly { userId: string; email: string }[], now: () => Date = () => new Date()): Promise<number> {
  const unique = [...new Map(people.map((p) => [p.userId, p])).values()];
  let added = 0;
  for (const group of chunks(unique, CHUNK)) {
    const filter = encodeURIComponent(JSON.stringify({ user_id: { _in: group.map((p) => p.userId) } }));
    const existing = await call<{ user_id: string }[]>('GET', `/items/${PEOPLE_COLLECTION}?filter=${filter}&fields=user_id&limit=${CHUNK}`);
    if (!existing.ok) throw new Error('Could not read the people recorded from the Organisation Platform.');
    const have = new Set((existing.data ?? []).map((r) => String(r.user_id).toLowerCase()));
    for (const person of group.filter((p) => !have.has(p.userId.toLowerCase()))) {
      const created = await call('POST', `/items/${PEOPLE_COLLECTION}`, { user_id: person.userId, email: person.email.trim().toLowerCase(), first_seen_at: now().toISOString() });
      // The unique `user_id` refusing a duplicate means a parallel run got there first: fine.
      if (created.ok) added += 1;
      else if (created.status !== 400 && created.status !== 409) throw new Error('Could not record a person from the Organisation Platform.');
    }
  }
  return added;
}

/** Everyone recorded. Throws when it cannot be read: the caller then reviews nobody rather than guessing. */
export async function listTracked(call: DaasCall): Promise<TrackedPerson[]> {
  const out: TrackedPerson[] = [];
  const seen = new Set<string>();
  for (let page = 1; out.length < MAX_ROWS; page += 1) {
    const res = await call<TrackedPerson[]>('GET', `/items/${PEOPLE_COLLECTION}?fields=user_id,email&sort=user_id&limit=${PAGE}&page=${page}`);
    // Not provisioned on this deployment: nobody has been recorded, so nobody can be reviewed.
    if (res.status === 403 || res.status === 404) return [];
    if (!res.ok) throw new Error('Could not read the people recorded from the Organisation Platform.');
    const rows = Array.isArray(res.data) ? res.data : [];
    const fresh = rows.filter((r) => !seen.has(String(r.user_id)));
    for (const r of fresh) {
      seen.add(String(r.user_id));
      out.push({ user_id: String(r.user_id), email: String(r.email).trim().toLowerCase() });
    }
    // A short page is the end. A page with nothing new means the server ignored `page`: stop rather than loop.
    if (rows.length < PAGE || fresh.length === 0) return out;
  }
  return out;
}
