// mfe-cookies.ts — the single definition of every cookie the bridge touches.
//
// Copy to BOTH sides: lib/bridge/mfe-cookies.ts
// Import from here everywhere. Never write these names as string literals.

export const MFE_TOKEN_COOKIE = 'mfe_access_token';
export const MFE_EXPIRES_COOKIE = 'mfe_expires_at';
export const SCOPE_COOKIE = 'daas_resource_uri';

/**
 * Options for a cookie that must survive inside a cross-site iframe.
 *
 * - SameSite=None; Secure — required, or the browser never sends it in the frame.
 * - Partitioned (CHIPS)  — required, or Safari (default), Chrome/Edge Incognito,
 *   Brave, and any block-third-party-cookies profile silently DROP the write.
 *   localhost hides this failure: two localhost ports are the same *site*, so
 *   every local test passes and only the deployed cross-site build breaks.
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
