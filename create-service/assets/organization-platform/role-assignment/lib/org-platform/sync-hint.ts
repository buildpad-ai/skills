// buildpad-backend-file: supabase
/**
 * The hint that someone should be placed on their next page load.
 *
 * Placement asks the Organisation Platform a question that can take up to
 * `PLACEMENT_TIMEOUT_MS`, so it never runs inside a sign-in. The sign-in paths only leave
 * this short-lived cookie; the dashboard shell sees it, calls POST /api/org-platform/sync and
 * shows a brief "Setting up your workspaces" state.
 *
 * The cookie is only ever a hint to make that call. The endpoint takes no input and acts
 * for the session's user, so a tampered cookie changes nothing. Its value counts the
 * attempts so far, which caps how often a platform that stays down is asked.
 *
 * Nothing is set at all unless placement is on and the platform is configured, so with
 * the feature off the whole path is inert.
 */

import type { NextResponse } from 'next/server';
import { isPlacementEnabled, isPlatformConfigured } from './client';

export const SYNC_HINT_COOKIE = 'org_sync_pending';

/** Page loads that retry a failed placement before giving up until the next sign-in. */
export const MAX_SYNC_ATTEMPTS = 3;

const TEN_MINUTES = 10 * 60;

/** Whether a sign-in should leave the hint at all. */
export const shouldHintSync = (): boolean => isPlacementEnabled() && isPlatformConfigured();

/** The attempts a cookie value records; anything that is not a small whole number counts as none. */
export function attemptsOf(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SYNC_ATTEMPTS ? n : 0;
}

export function setSyncHint(response: NextResponse, attempts = 0): NextResponse {
  if (!shouldHintSync()) return response;
  response.cookies.set(SYNC_HINT_COOKIE, String(attempts), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TEN_MINUTES,
  });
  return response;
}

export function clearSyncHint(response: NextResponse): NextResponse {
  response.cookies.set(SYNC_HINT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
