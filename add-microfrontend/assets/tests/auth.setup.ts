// auth.setup.ts — Copy to: tests/auth.setup.ts (host app).
//
// Signs in once through the real login form and saves the browser state, so every
// test starts authenticated. Never add a host route to publicRoutes to make a
// test pass — this file is the correct fix for "every test lands on /login".
//
// Credentials come from the environment, not from this file:
//   TEST_EMAIL=you@example.com TEST_PASSWORD=... pnpm exec playwright test

import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD to run the suite.');
  }

  await page.goto('/login');
  // The CLI login form labels its fields Email / Password.
  // AGENT: verify against app/login/page.tsx if the form was customized.
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();

  // Signed in when the app shell renders (any authenticated route).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  await expect(page.locator('body')).toBeVisible();

  await page.context().storageState({ path: authFile });
});
