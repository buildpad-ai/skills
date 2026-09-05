// token/route.ts — hand the current access token to this micro-app's own browser code.
//
// Copy to: app/api/auth/token/route.ts  (a NEW file — no CLI collision).
//
// This route must be in PROTECTED_API_ROUTES (lib/bridge/mfe-middleware.ts) so the
// CLI middleware's blanket /api pass does not leave it open. The middleware answers
// an invalid caller with 401 JSON — never a redirect, because a redirect lands on
// /login, returns 200 text/html, and silently breaks every fetch() caller.
//
// The micro-app has no Supabase session of its own, so DaaSProviderWrapper cannot
// call supabase.auth.getSession(). It reads the token from here via useMfeToken().

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { MFE_EXPIRES_COOKIE, MFE_TOKEN_COOKIE } from '@/lib/bridge/mfe-cookies';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(MFE_TOKEN_COOKIE)?.value;
  const expiresAt = Number(cookieStore.get(MFE_EXPIRES_COOKIE)?.value ?? 0);

  if (!accessToken) {
    return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
  }

  return NextResponse.json(
    { access_token: accessToken, expires_at: expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
