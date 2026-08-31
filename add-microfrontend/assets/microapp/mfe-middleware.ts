// mfe-middleware.ts — the micro-app's bridge additions to the CLI auth middleware.
//
// Copy to: lib/bridge/mfe-middleware.ts
//
// ⚠️ Do NOT copy anything over lib/supabase/middleware.ts or middleware.ts.
// Both are CLI-owned files (they carry an `@buildpad-origin` header) and contain
// behaviour the bridge must not lose: the publicOrigin() redirect (correct behind
// Amplify/CloudFront), the Supabase cookie-session refresh, the env guard, and the
// `Cache-Control: private, no-store` header on every response.
//
// Instead, this module is IMPORTED by the CLI middleware via three pinned edits —
// see references/auth-bridge.instructions.md, "Merging into the CLI middleware".

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { FRAMED_COOKIE, MFE_TOKEN_COOKIE } from './mfe-cookies';

/**
 * API routes that must NOT ride the CLI middleware's blanket `/api` pass.
 * /api/auth/token hands out the bridge access token, so it must require one.
 */
export const PROTECTED_API_ROUTES = ['/api/auth/token'];

export function isProtectedApiRoute(pathname: string) {
  return PROTECTED_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Validate the bridge access token, if any.
 *
 * getUser(token), never a local decode: getUser asks the Auth server on every
 * request, so a sign-out that happened in the Main App is observed here.
 * Returns the user, or null when there is no valid bridge token — the caller
 * then falls through to the CLI's own redirect logic.
 */
export async function getMfeUser(request: NextRequest) {
  const token = request.cookies.get(MFE_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

/**
 * E1b — record framed-ness on the document load, where Sec-Fetch-Dest is
 * trustworthy, so RSC requests (router.refresh(), client navigation) can read it.
 *
 * Wrap EVERY response the CLI middleware returns with this. Without it the layout
 * flips back to the full app shell mid-session and stays there.
 */
export function markFramed(request: NextRequest, response: NextResponse) {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest === 'iframe') {
    response.cookies.set(FRAMED_COOKIE, '1', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    });
  } else if (dest === 'document') {
    // A direct visit clears the marker, so a stale one never strips the shell.
    response.cookies.delete(FRAMED_COOKIE);
  }
  return response;
}
