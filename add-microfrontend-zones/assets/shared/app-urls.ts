// Copy to: config/app-urls.ts (every app, unchanged).
// config/app-urls.ts — committed to git. Values come from config/zones.json.
// Local development override: NEXT_PUBLIC_HOST_ORIGIN=http://localhost:3000
//
// NEXT_PUBLIC_HOST_ORIGIN is also the name the CLI's lib/origin.ts reads as
// "this app's own public origin". Under Multi-Zones the two meanings coincide:
// every zone is served from the Main App origin, so the CLI's own redirect
// helpers (login bounce, logout, OAuth) point at the public origin too.
import zones from './zones.json';

/** The public origin. Every absolute URL in the project starts with it. */
export const MAIN_APP_URL = process.env.NEXT_PUBLIC_HOST_ORIGIN || zones.mainAppUrl;

/** The path prefix of this app. Empty string in the Main App. */
export const OWN_PREFIX: string = zones.ownPrefix;

/** All zones, for the shell nav and ZoneLink. */
export const ZONES = zones.zones as ReadonlyArray<{
  name: string;
  label: string;
  prefix: string;
  url: string;
}>;

export const LOGIN_PATH = '/login';

/** Find the zone that owns a public path. Undefined means that the Main App owns it. */
export function zoneFor(publicPath: string) {
  return ZONES.find(
    (zone) => publicPath === zone.prefix || publicPath.startsWith(`${zone.prefix}/`),
  );
}
