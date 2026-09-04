// Copy to: tests/microfrontend/auth.setup.ts (Main App). Reads TEST_EMAIL / TEST_PASSWORD from the environment.
import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/zones-user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) throw new Error('Set TEST_EMAIL and TEST_PASSWORD.');

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
  await expect(page.locator('body')).toBeVisible();
  await page.context().storageState({ path: authFile });
});
