// set-session/route.ts — accept an access token from the host and store it locally.
//
// Copy to: app/api/auth/set-session/route.ts  (a NEW file — no CLI collision).
// It is already public under the CLI middleware: the path starts with /api/auth.
//
// The host owns refresh. This route never receives, stores, or returns a refresh
// token. See references/auth-bridge.instructions.md.
//
// Requires lib/origin.ts — the CLI ships it in every bootstrap.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/origin';
import {
  framedCookieOptions,
  MFE_EXPIRES_COOKIE,
  MFE_TOKEN_COOKIE,
  SCOPE_COOKIE,
} from '@/lib/bridge/mfe-cookies';

export async function POST(request: NextRequest) {
  // A valid token is NOT authorization to write a cookie. Without these checks an
  // attacker page can POST its OWN valid token as a CORS-simple request (no
  // preflight) and log the victim's frame into the attacker's account.
  // The legitimate caller is MicroappBridgeProvider on this app's own page —
  // always same-origin.
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== publicOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  // Requiring JSON forces any cross-origin attempt into a CORS preflight.
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

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

  // Validate the token against the Auth server before trusting it.
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

  cookieStore.set(MFE_TOKEN_COOKIE, access_token, framedCookieOptions(maxAge, true));
  cookieStore.set(MFE_EXPIRES_COOKIE, String(expires_at), framedCookieOptions(maxAge, false));
  if (resource_uri) {
    cookieStore.set(SCOPE_COOKIE, resource_uri, framedCookieOptions(maxAge, false));
  }

  return NextResponse.json({ success: true });
}
