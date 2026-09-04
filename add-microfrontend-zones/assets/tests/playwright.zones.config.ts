// Copy to: playwright.zones.config.ts (Main App root). Prerequisites: pnpm add -D @playwright/test && pnpm exec playwright install chromium
// Multi-Zones acceptance suite (add-microfrontend-zones Step 9).
// ZONES_BASE = the public origin under test (default: local Main App dev server).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/microfrontend',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.ZONES_BASE || 'http://localhost:3000',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: 'playwright/.auth/zones-user.json' },
      dependencies: ['setup'],
    },
  ],
});
