// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * The System attributes for the editor, filled with what the platform's people look like.
 * Server-only.
 *
 * Email domains are suggested from the people who hold a job in the organisation. That is the whole
 * deployment's population by design (the app is internal to one organisation), so
 * it is all of them. They are shortcuts, not a list to choose from: if the people cannot be
 * read the editor simply has none to offer and carries on.
 */

import { platformClient } from '@/lib/org-platform/client';
import { emailDomainOf, systemAttributeDefs, type SystemAttributeDef } from './system-attributes';

const MAX_SUGGESTIONS = 20;
const CACHE_MS = 5 * 60_000;
let cache: { at: number; domains: string[] } | null = null;

export async function loadSystemAttributeDefs(): Promise<SystemAttributeDef[]> {
  if (!cache || Date.now() - cache.at >= CACHE_MS) {
    try {
      const assignments = await platformClient().orgRoleAssignments();
      const counts = new Map<string, number>();
      for (const a of assignments) {
        const domain = emailDomainOf(a.assignee?.email);
        if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
      }
      // The domains most of the people use first.
      const domains = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_SUGGESTIONS).map(([domain]) => domain);
      cache = { at: Date.now(), domains };
    } catch (err) {
      console.warn('[org-rules] could not read people for suggestions:', err instanceof Error ? err.message : 'unknown error');
      return systemAttributeDefs({ emailDomains: [] });
    }
  }
  return systemAttributeDefs({ emailDomains: cache.domains });
}
