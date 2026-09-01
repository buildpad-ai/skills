// middleware.ts — root of the micro-app. Copy to: middleware.ts
//
// The matcher excludes static assets only. It must NOT try to exclude auth routes by
// prefix: /api/auth/set-session starts with "api", not "auth", so a prefix rule lets
// the middleware run on the bridge call itself and redirect it.
// Public routes are decided in one place, by PUBLIC_ROUTES in lib/supabase/middleware.

import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
