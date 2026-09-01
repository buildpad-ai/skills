// middleware.ts — the ONE route table for the micro-app.
//
// Copy to: lib/supabase/middleware.ts (and call it from middleware.ts at the root).
//
// Every route name in the micro-app comes from PUBLIC_ROUTES and LOGIN_ROUTE below.
// Do not write a route name anywhere else: a redirect target that does not match the
// file structure is the classic cause of a redirect loop inside the frame.
//
// AGENT: copy this file unchanged.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const LOGIN_ROUTE = '/login';

export const PUBLIC_ROUTES = [
  LOGIN_ROUTE,
  '/api/auth/set-session',
  '/api/auth/logout',
];

const MFE_TOKEN_COOKIE = 'mfe_access_token';

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next({ request });

  const token = request.cookies.get(MFE_TOKEN_COOKIE)?.value;
  if (token) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    // getUser, never getSession. getUser validates the token against the Auth
    // server on every request, so a token revoked in the host stops working here.
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return NextResponse.next({ request });
  }

  const loginUrl = new URL(LOGIN_ROUTE, request.url);
  loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}
