// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
/**
 * Import Xtremax people from the Organisation Platform — POST /api/admin/users/import
 *
 * Global Administrators only. One-time (and safe to repeat) import so people can be
 * @mentioned before they have ever signed in. See lib/org-platform/people-import.ts.
 *
 *   { mode: 'preview' }                  read-only: who would be created, who exists, who is skipped
 *   { mode: 'run', emails: string[] }    create up to IMPORT_BATCH_SIZE of them, and say what happened to each
 *   { mode: 'record-existing' }          remember listed people who already had an account (see lib/org-platform/provenance.ts)
 *
 * A run is checked against the platform's current list and the directory again, so the
 * emails in the body are a request, never an instruction: nobody the platform does not list
 * is created, and nobody is created twice. The browser calls `run` in batches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireGlobalAdmin } from '@/lib/api/admin-guard';
import { isPlatformConfigured } from '@/lib/org-platform/client';
import { IMPORT_BATCH_SIZE, importPeople, loadImportPlan, recordExistingListed, type ImportHooks } from '@/lib/org-platform/people-import';
import { recordSeen, serviceCall } from '@/lib/org-platform/provenance';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const guard = await requireGlobalAdmin();
  if (guard.error) return guard.error;

  let body: { mode?: unknown; emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (body.mode !== 'preview' && body.mode !== 'run' && body.mode !== 'record-existing') {
    return NextResponse.json({ error: "mode must be 'preview', 'run' or 'record-existing'" }, { status: 400 });
  }
  if (!isPlatformConfigured()) {
    return NextResponse.json({ error: 'The Xtremax connection is not configured on this deployment.' }, { status: 409 });
  }

  const supabase = createSupabaseAdmin();
  // Who the platform listed is remembered, so the Offboarding review can later tell who has since disappeared from it.
  const hooks: ImportHooks = { recordSeen: (people) => recordSeen(serviceCall, people) };

  try {
    if (body.mode === 'preview') {
      // A preview reads the platform fresh; the batches that follow reuse that read.
      const plan = await loadImportPlan(supabase, { fresh: true });
      // `existingEmails` and `names` stay on the server.
      const { existingEmails: _existingEmails, names: _names, ...data } = plan;
      void _existingEmails;
      void _names;
      return NextResponse.json({ data: { ...data, batchSize: IMPORT_BATCH_SIZE } });
    }

    if (body.mode === 'record-existing') {
      return NextResponse.json({ data: { recorded: await recordExistingListed(supabase, hooks) } });
    }

    if (!Array.isArray(body.emails) || body.emails.length === 0 || body.emails.length > IMPORT_BATCH_SIZE || body.emails.some((e) => typeof e !== 'string')) {
      return NextResponse.json({ error: `emails must be 1 to ${IMPORT_BATCH_SIZE} addresses` }, { status: 400 });
    }
    const results = await importPeople(supabase, body.emails as string[], hooks);
    return NextResponse.json({ data: { results } });
  } catch (err) {
    console.warn('[admin/users/import] failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Could not reach the Organisation Platform or the user directory. Try again: people who were already created are skipped.' }, { status: 502 });
  }
}
