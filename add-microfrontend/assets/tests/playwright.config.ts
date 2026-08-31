// playwright.config.ts — Copy to the HOST app's repo root.
//
// Prerequisites (Step 7 runs these):
//   pnpm add -D @playwright/test
//   pnpm exec playwright install chromium
//
// AGENT: fill the three PORT/DIR values below from the real workspace layout.

import { defineConfig } from '@playwright/test';

// AGENT: the host's local dev origin.
const HOST_DEV_ORIGIN = 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: HOST_DEV_ORIGIN,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  // This composition needs THREE servers: the host and every micro-app, each on
  // the port its config/app-urls.ts local override names. webServer accepts an
  // array. `reuseExistingServer` lets you keep dev servers running between runs.
  webServer: [
    {
      command: 'pnpm dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    // AGENT: one entry per micro-app — set cwd to its directory and port to its
    // dev port, e.g.:
    // { command: 'pnpm dev -p 3001', cwd: '../files-management-starter', port: 3001, reuseExistingServer: true, timeout: 120_000 },
  ],
});
