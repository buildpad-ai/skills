// bridge-protocol.ts — the single contract between the Main App (host) and every micro-app.
//
// Copy this file to BOTH sides, unchanged:
//   Main App:  lib/bridge/bridge-protocol.ts
//   Micro-app: lib/bridge/bridge-protocol.ts
//
// Do not edit it per project. If you add a message type, add it here first and
// copy the file to every app again.

export const BRIDGE_SOURCE = 'buildpad-mfe';
export const BRIDGE_VERSION = 1;

type Envelope<T extends string, P = Record<never, never>> = {
  source: typeof BRIDGE_SOURCE;
  v: typeof BRIDGE_VERSION;
  type: T;
} & P;

/* ---------------------------------- micro-app → host ---------------------------------- */

/** The micro-app has mounted and is rendering. The host hides its skeleton on this message. */
export type MicroappLoaded = Envelope<'MICROAPP_LOADED'>;

/** The micro-app has no valid access token, or its token is about to expire. */
export type MicroappNeedsAuth = Envelope<'MICROAPP_NEEDS_AUTH'>;

/** An allowlisted query parameter changed inside the micro-app. */
export type QueryParamsChange = Envelope<'QUERY_PARAMS_CHANGE', { params: Record<string, string> }>;

/** The micro-app asks the host to navigate the whole page to a host route. */
export type Navigate = Envelope<'NAVIGATE', { path: string }>;

/** The micro-app reports its content height. Only used by height-following embeds. */
export type Resize = Envelope<'RESIZE', { height: number }>;

export type MicroappMessage =
  | MicroappLoaded
  | MicroappNeedsAuth
  | QueryParamsChange
  | Navigate
  | Resize;

/* ---------------------------------- host → micro-app ---------------------------------- */

/**
 * The host answers MICROAPP_NEEDS_AUTH with a short-lived access token.
 * The host owns refresh. This message never carries a refresh token.
 */
export type SetAuth = Envelope<
  'SET_AUTH',
  { access_token: string; expires_at: number; resource_uri?: string }
>;

/** The active tenant/scope changed in the host. */
export type SetScope = Envelope<'SET_SCOPE', { resource_uri: string }>;

/** The host URL changed from outside the micro-app (back/forward, host filter). */
export type SetQueryParams = Envelope<'SET_QUERY_PARAMS', { params: Record<string, string> }>;

/** The host color scheme changed. */
export type SetTheme = Envelope<'SET_THEME', { colorScheme: 'light' | 'dark' }>;

/** The host locale changed. */
export type SetLocale = Envelope<'SET_LOCALE', { locale: string }>;

/** The user signed out in the host. The micro-app must clear its own cookies now. */
export type Logout = Envelope<'LOGOUT'>;

export type HostMessage = SetAuth | SetScope | SetQueryParams | SetTheme | SetLocale | Logout;

/* -------------------------------------- helpers --------------------------------------- */

/** Build a message envelope. Always use this instead of an object literal. */
export function bridgeMessage<T extends string, P extends object>(
  type: T,
  payload?: P,
): Envelope<T, P> {
  return { source: BRIDGE_SOURCE, v: BRIDGE_VERSION, type, ...(payload ?? ({} as P)) };
}

/** Narrow an untrusted `event.data` to a bridge envelope. Call this before reading any field. */
export function isBridgeMessage(
  data: unknown,
): data is { source: typeof BRIDGE_SOURCE; v: number; type: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === BRIDGE_SOURCE &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}

/** True when `data` is a bridge message of exactly `type` and a version this app understands. */
export function isBridgeType<T extends string>(
  data: unknown,
  type: T,
): data is { source: typeof BRIDGE_SOURCE; v: number; type: T } & Record<string, unknown> {
  return isBridgeMessage(data) && data.type === type && data.v === BRIDGE_VERSION;
}

/** Keep only the allowlisted keys, and drop empty values. */
export function pickParams(
  params: Record<string, string> | URLSearchParams,
  allowed: readonly string[],
): Record<string, string> {
  const source =
    params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = source[key];
    if (value) out[key] = value;
  }
  return out;
}

/** A stable string for a parameter set. Use it to compare two sets for equality. */
export function serializeParams(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) search.set(key, params[key]);
  return search.toString();
}
