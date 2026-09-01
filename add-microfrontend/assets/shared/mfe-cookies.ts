// mfe-cookies.ts — the single definition of every cookie the bridge touches.
//
// Copy to BOTH sides: lib/bridge/mfe-cookies.ts
// Import from here everywhere. Never write these names as string literals.

export const MFE_TOKEN_COOKIE = 'mfe_access_token';
export const MFE_EXPIRES_COOKIE = 'mfe_expires_at';
export const SCOPE_COOKIE = 'daas_resource_uri';

/**
 * Marks that THIS browsing context is inside the host frame.
 *
 * Written by the middleware on a document load, because only the document load
 * carries a trustworthy Sec-Fetch-Dest. RSC requests (router.refresh(), client
 * navigation) arrive with dest "empty", which matches neither "iframe" nor
 * "document" — without this marker the layout would flip back to the full shell
 * mid-session and stay there. A direct document visit CLEARS it, so a stale
 * marker cannot strip the shell from a standalone visit.
 */
export const FRAMED_COOKIE = 'mfe_framed';

/**
 * Options for a cookie that must survive inside a cross-site iframe.
 *
 * - SameSite=None; Secure — required, or the browser never sends it in the frame.
 * - Partitioned (CHIPS)  — required, or Safari (default), Chrome/Edge Incognito,
 *   Brave, and any block-third-party-cookies profile silently DROP the write.
 *   localhost hides this failure: two localhost ports are the same *site*, so
 *   every local test passes and only the deployed cross-site build breaks.
 *
 * localhost also erases origin isolation. Cookies ignore the port, so :3000 and
 * :3002 share ONE cookie jar: the host page can read this frame's mfe_expires_at,
 * and the micro-app origin can read and delete the host's Supabase session cookie.
 * A local pass proves nothing about session isolation between the two apps —
 * re-verify cookie scoping and isolation on the deployed cross-site origins.
 */
export function framedCookieOptions(maxAge: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: true, // browsers exempt http://localhost from the Secure requirement
    sameSite: 'none' as const,
    partitioned: true,
    path: '/',
    maxAge,
  };
}
