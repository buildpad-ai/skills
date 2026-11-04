// buildpad-backend-file: supabase
/**
 * Place the signed-in person — POST /api/org-platform/sync
 *
 * Runs on the person's first page load after sign-in (the sign-in paths only leave a hint
 * cookie): asks the Organisation Platform once who they are, runs every tenant's rules, and
 * grants, changes or revokes their role in each. See lib/org-platform/onboard.ts.
 *
 * Takes no input and always acts for the session's user. The hint cookie is only a nudge to
 * call this; nothing in the request decides who is placed or where. Best-effort: a slow or
 * failing platform changes nothing and the next page load tries again, up to a small cap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileFromOrgPlatform } from '@/lib/org-platform/onboard';
import { MAX_SYNC_ATTEMPTS, SYNC_HINT_COOKIE, attemptsOf, clearSyncHint, setSyncHint } from '@/lib/org-platform/sync-hint';
import { signInMethodOf } from '@/lib/org-rules/system-attributes';

/** One placement per person at a time: two tabs opening together share one answer instead of racing each other. */
const inFlight = new Map<string, ReturnType<typeof reconcileFromOrgPlatform>>();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let run = inFlight.get(user.id);
  if (!run) {
    run = reconcileFromOrgPlatform({
      userId: user.id,
      email: user.email ?? '',
      account: { signInMethod: signInMethodOf(user.app_metadata) },
    }).finally(() => inFlight.delete(user.id));
    inFlight.set(user.id, run);
  }
  const outcome = await run;

  const changed = outcome.granted + outcome.changed + outcome.revoked > 0;
  const attempts = attemptsOf(request.cookies.get(SYNC_HINT_COOKIE)?.value) + 1;
  const retrying = outcome.retry && attempts < MAX_SYNC_ATTEMPTS;

  const response = NextResponse.json({ data: { changed, pending: retrying } });
  // Keep the hint only while a retry is worth making; otherwise the next sign-in sets it again.
  return retrying ? setSyncHint(response, attempts) : clearSyncHint(response);
}
