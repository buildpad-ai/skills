// logout/route.ts — clear this micro-app's own cookies.
//
// Copy to: app/api/auth/logout/route.ts
// This route must be in PUBLIC_ROUTES in lib/supabase/middleware.ts: the caller has
// just lost its session and must still be able to reach it.
//
// The host cannot delete these cookies. They live on the micro-app origin, so the
// micro-app must clear them itself when the host broadcasts LOGOUT.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MFE_EXPIRES_COOKIE, MFE_TOKEN_COOKIE } from '../set-session/route';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(MFE_TOKEN_COOKIE);
  cookieStore.delete(MFE_EXPIRES_COOKIE);
  // Bug 20: a stale scope cookie is forwarded as X-Resource-Uri for the next user
  // and causes an immediate 403 FORBIDDEN_SCOPE.
  cookieStore.delete('daas_resource_uri');
  return NextResponse.json({ success: true });
}
