// token/route.ts — hand the current access token to this micro-app's own browser code.
//
// Copy to: app/api/auth/token/route.ts
// Do NOT add it to PUBLIC_ROUTES. The middleware must validate the cookie first.
//
// The micro-app has no Supabase session of its own, so DaaSProviderWrapper cannot
// call supabase.auth.getSession(). It reads the token from here instead.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('mfe_access_token')?.value;
  const expiresAt = Number(cookieStore.get('mfe_expires_at')?.value ?? 0);

  if (!accessToken) {
    return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
  }

  return NextResponse.json(
    { access_token: accessToken, expires_at: expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
