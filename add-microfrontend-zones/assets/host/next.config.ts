// Copy to: next.config.ts (Main App). Replaces any iframe-skill next.config.ts.
// next.config.ts — Main App / default zone (add-microfrontend-zones Step 3)
import type { NextConfig } from 'next';
import zones from './config/zones.json';

const publicHost = new URL(process.env.NEXT_PUBLIC_HOST_ORIGIN || zones.mainAppUrl).host;

/** Deployed zone URL, with a local dev override such as NEXT_PUBLIC_USERS_MANAGEMENT_URL. */
function zoneUrl(zone: { name: string; url: string }) {
  const key = `NEXT_PUBLIC_${zone.name.toUpperCase().replace(/-/g, '_')}_URL`;
  return process.env[key] || zone.url;
}

const nextConfig: NextConfig = {
  async rewrites() {
    return zones.zones.flatMap((zone) => {
      const origin = zoneUrl(zone);
      return [
        { source: zone.prefix, destination: `${origin}${zone.prefix}` },
        { source: `${zone.prefix}/:path+`, destination: `${origin}${zone.prefix}/:path+` },
      ];
    });
  },
  experimental: {
    serverActions: {
      allowedOrigins: [publicHost],
    },
  },
};

export default nextConfig;
