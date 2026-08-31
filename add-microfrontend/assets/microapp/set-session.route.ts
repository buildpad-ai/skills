// set-session/route.ts — accept an access token from the host and store it locally.
//
// Copy to: app/api/auth/set-session/route.ts
// This route must be in PUBLIC_ROUTES in lib/supabase/middleware.ts.
//
// The host owns refresh. This route never receives, stores, or returns a refresh
// token. See references/auth-bridge.md.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const MFE_TOKEN_COOKIE = 'mfe_access_token';
export const MFE_EXPIRES_COOKIE = 'mfe_expires_at';

export async function POST(request: NextRequest) {
  let body: { access_token?: string; expires_at?: number; resource_uri?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { access_token, expires_at, resource_uri } = body;
  if (!access_token || typeof expires_at !== 'number') {
    return NextResponse.json({ error: 'Missing access_token or expires_at' }, { status: 400 });
  }

  // Validate the token against the Auth server before trusting it. Anything can
  // post to this route; only a token the Auth server accepts may set a cookie.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
  const { data, error } = await supabase.auth.getUser(access_token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const maxAge = Math.max(Math.floor(expires_at - Date.now() / 1000), 0);

  // SameSite=None is required: this cookie is set and read inside a cross-site frame.
  cookieStore.set(MFE_TOKEN_COOKIE, access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge,
  });
  cookieStore.set(MFE_EXPIRES_COOKIE, String(expires_at), {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge,
  });
  if (resource_uri) {
    cookieStore.set('daas_resource_uri', resource_uri, {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge,
    });
  }

  return NextResponse.json({ success: true });
}
