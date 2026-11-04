// buildpad-backend-file: supabase
/**
 * Organisation Platform: the one door.
 *
 * getFeedback is used only by Xtremax people and every tenant is Xtremax's own, so a
 * single Xtremax root organisation covers the whole deployment. The connection is a
 * deployment setting, not a per-tenant link:
 *
 *   ORG_PLATFORM_URL                 the platform's address
 *   ORG_PLATFORM_API_KEY             the Xtremax root key (server-only, never in a browser or a log)
 *   ORG_ROLE_ASSIGNMENT_ENABLED      "true" lets sign-in place people by rules. Off by default.
 *
 * Nothing else in the app calls the platform. The key is read from the environment on
 * every request, so rotating it needs no restart of this module. Server-only: the
 * package's `/client` entry has no browser build.
 */

import { createClient, type OrgPlatformClient } from '@xtremax/organisation-platform/client';
import type { PersonLookup } from '@xtremax/organisation-platform/contract';

/** Upper bound on the single people lookup made when placing someone. Never retried. */
export const PLACEMENT_TIMEOUT_MS = 10_000;

/** Whether sign-in may place people by rules. Authoring rules does not depend on this. */
export const isPlacementEnabled = (): boolean => process.env.ORG_ROLE_ASSIGNMENT_ENABLED === 'true';

/** Whether the deployment has both the platform address and the key. */
export const isPlatformConfigured = (): boolean => !!process.env.ORG_PLATFORM_URL?.trim() && !!process.env.ORG_PLATFORM_API_KEY?.trim();

/** Lower-cased and trimmed, so one person is one person however the address was typed. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

let cached: { url: string; client: OrgPlatformClient } | null = null;

/** The platform client. Throws when the deployment is not configured. */
export function platformClient(): OrgPlatformClient {
  const url = process.env.ORG_PLATFORM_URL?.trim().replace(/\/$/, '');
  if (!url || !process.env.ORG_PLATFORM_API_KEY?.trim()) throw new Error('The Organisation Platform connection is not configured');
  if (!cached || cached.url !== url) {
    cached = {
      url,
      // Read on every request: rotation is an env change.
      client: createClient({
        baseUrl: url,
        apiKey: () => process.env.ORG_PLATFORM_API_KEY!.trim(),
        // Resolved per request, so the client never holds on to a stale `fetch`.
        fetch: (...args) => globalThis.fetch(...args),
      }),
    };
  }
  return cached.client;
}

/**
 * Who this person is and what they hold, live. One call, no retry: a slow platform must
 * never hold anything up. Throws on timeout or any error, and the caller changes nothing.
 */
export async function fetchPerson(email: string, timeoutMs: number = PLACEMENT_TIMEOUT_MS): Promise<PersonLookup> {
  return platformClient().people(normaliseEmail(email), { timeoutMs, retry: false });
}

/**
 * The same lookup for the people import, which is an admin screen and not a sign-in, so it may wait.
 * It retries the answers the platform itself marks as worth repeating (busy: 429, or its backend
 * unreachable: 502), honouring `Retry-After`, and allows a slower reply. The sign-in lookup above
 * must stay single-shot.
 */
export async function fetchPersonForImport(email: string): Promise<PersonLookup> {
  return platformClient().people(normaliseEmail(email), {
    timeoutMs: 20_000,
    retry: { attempts: 4, baseDelayMs: 500, maxDelayMs: 4_000 },
  });
}

/**
 * Whether the platform answer is about a person it knows. `roles: []` means both "no
 * designations left" and "unknown person", and the platform only returns names and
 * attributes for someone it knows, so their absence must block any revocation.
 */
export const isKnownPerson = (person: PersonLookup): boolean =>
  !!(person.firstName?.trim() || person.lastName?.trim() || Object.keys(person.attributes ?? {}).length > 0 || person.roles.length > 0);
