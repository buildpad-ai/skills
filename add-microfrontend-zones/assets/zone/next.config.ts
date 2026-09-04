// Copy to: next.config.ts (every zone). Replaces any iframe-skill next.config.ts.
// next.config.ts — zone (add-microfrontend-zones Step 2)
import type { NextConfig } from 'next';
import zones from './config/zones.json';

const publicHost = new URL(process.env.NEXT_PUBLIC_HOST_ORIGIN || zones.mainAppUrl).host;

const nextConfig: NextConfig = {
  // The zone owns this prefix. Pages, /_next assets, and public files are served under it.
  basePath: zones.ownPrefix,
  experimental: {
    serverActions: {
      // Behind the rewrite, the Host header is the zone domain. Allow the public host.
      allowedOrigins: [publicHost],
    },
  },
};

export default nextConfig;
