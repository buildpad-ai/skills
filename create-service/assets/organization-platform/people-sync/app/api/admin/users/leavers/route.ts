// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Offboarding review — POST /api/admin/users/leavers
 *
 * Global Administrators only. Finds people the Organisation Platform listed to an import run (see
 * lib/org-platform/provenance.ts) who it no longer lists or knows, and lets an administrator suspend them. Colleagues
 * who were never recorded can never appear, because the platform having no record of them proves nothing
 * (see lib/org-platform/leavers.ts).
 *
 *   { mode: 'candidates' }                 people an import recorded as on the platform, still active here, no longer listed (no per-person calls)
 *   { mode: 'check',   emails: string[] }  ask the platform about up to LEAVERS_BATCH_SIZE of them: left / on-platform / error
 *   { mode: 'suspend', emails: string[] }  re-verify each live, then suspend (never the caller, never the last administrator)
 *
 * The emails in a body are a request, never an instruction: the server re-derives the candidates and re-asks the
 * platform every time. Nothing is ever deleted, and a suspended account is brought back from the Users page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireGlobalAdmin } from '@/lib/api/admin-guard';
import { setUserStatus } from '@/lib/admin-user-status';
import { fetchPersonForImport, isKnownPerson, isPlatformConfigured, platformClient } from '@/lib/org-platform/client';
import { LEAVERS_BATCH_SIZE, checkLeavers, companyDomains, loadCandidates, suspendLeavers, type LeaversDeps } from '@/lib/org-platform/leavers';
import { listTracked, serviceCall } from '@/lib/org-platform/provenance';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const LIST_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  const guard = await requireGlobalAdmin();
  if (guard.error) return guard.error;

  let body: { mode?: unknown; emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (body.mode !== 'candidates' && body.mode !== 'check' && body.mode !== 'suspend') {
    return NextResponse.json({ error: "mode must be 'candidates', 'check' or 'suspend'" }, { status: 400 });
  }
  if (!isPlatformConfigured()) {
    return NextResponse.json({ error: 'The Xtremax connection is not configured on this deployment.' }, { status: 409 });
  }

  const supabase = createSupabaseAdmin();
  const deps: LeaversDeps = {
    supabase,
    listAssignments: () => platformClient().orgRoleAssignments({ timeoutMs: LIST_TIMEOUT_MS }),
    lookupPerson: fetchPersonForImport,
    isKnownPerson,
    domains: companyDomains(),
    suspend: (userId) => setUserStatus(supabase, userId, 'suspended'),
    callerId: guard.session.user.id,
    tracked: () => listTracked(serviceCall),
  };

  try {
    if (body.mode === 'candidates') {
      // The first read of a review is fresh; the checks that follow reuse it.
      const { candidates, listed, tracked } = await loadCandidates(deps, { fresh: true });
      return NextResponse.json({ data: { candidates, listed, tracked, batchSize: LEAVERS_BATCH_SIZE } });
    }

    if (!Array.isArray(body.emails) || body.emails.length === 0 || body.emails.length > LEAVERS_BATCH_SIZE || body.emails.some((e) => typeof e !== 'string')) {
      return NextResponse.json({ error: `emails must be 1 to ${LEAVERS_BATCH_SIZE} addresses` }, { status: 400 });
    }
    const emails = body.emails as string[];
    const results = body.mode === 'check' ? await checkLeavers(deps, emails) : await suspendLeavers(deps, emails);
    return NextResponse.json({ data: { results } });
  } catch (err) {
    console.warn('[admin/users/leavers] failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Could not reach the Organisation Platform or the user directory. Nothing was changed. Try again.' }, { status: 502 });
  }
}
