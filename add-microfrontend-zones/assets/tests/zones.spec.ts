/**
 * Multi-Zones composition — acceptance (add-microfrontend-zones Step 9).
 *
 * Copy to: tests/microfrontend/zones.spec.ts (Main App), next to auth.setup.ts,
 * with playwright.zones.config.ts at the project root.
 *
 * AGENT: fill the block below from the project. Two zones are exercised: ZONE_A
 * must own at least two pages (so in-zone soft navigation can be checked) and a
 * list with a search box; ZONE_B is any other zone. NAV is the exact list of
 * sidebar labels in navigation.ts (identical in every app). The selectors are
 * the Buildpad modules' real test ids — check them in the installed components.
 * The values below are the 2026-09-04 field trial (users-management at /iam,
 * files-management at /storage).
 */
import { test, expect } from '@playwright/test';

// ---- AGENT: project-specific values ---------------------------------------
const ZONE_A = {
  prefix: '/iam',
  list: '/iam/users',                     // a list page with a search box
  listShell: '[data-testid="users-manager"]',
  search: '[data-testid="users-manager-search"]',
  row: '[data-testid="users-manager"] [data-testid="user-avatar"]', // a rendered data row
  second: '/iam/roles',                   // another page in the SAME zone
  secondShell: '[data-testid="roles-manager"]',
  navLabel: 'Users',
  secondNavLabel: 'Roles',
};
const ZONE_B = {
  prefix: '/storage',
  page: '/storage/files',
  shell: '[data-testid="files-toolbar"]',
  navLabel: 'Files',
};
const NAV = ['Home', 'Files', 'Users', 'Roles', 'Policies', 'Module Access Keys'];
// ----------------------------------------------------------------------------

const HAS_CREDS = Boolean(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
const enc = (p: string) => encodeURIComponent(p);

test.describe('Micro-Frontend Multi-Zones Composition', () => {
  test('zone route renders on the public origin without an iframe', async ({ page }) => {
    await page.goto(ZONE_A.list);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(ZONE_A.list);
  });

  test('zone assets are served under the zone prefix, none from the Main App bundle', async ({ page }) => {
    await page.goto(ZONE_A.list);
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
    expect(await page.locator(`script[src*="${ZONE_A.prefix}/_next/"]`).count()).toBeGreaterThan(0);
    expect(await page.locator('script[src^="/_next/"]').count()).toBe(0);
  });

  test('zone chunks are cacheable through the Main App (middleware matcher, pinned edit Z-M2)', async ({ page, request }) => {
    await page.goto(ZONE_A.list);
    const src = await page.locator(`script[src*="${ZONE_A.prefix}/_next/static/"]`).first().getAttribute('src');
    expect(src).toBeTruthy();
    const res = await request.get(src!, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control'] ?? '').toContain('immutable');
  });

  test('every zone renders the same shell; cross-zone nav is a full load, in-zone nav is soft', async ({ page }) => {
    await page.goto(ZONE_A.list);
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
    expect(await page.locator('.bp-nav-link span').allTextContents()).toEqual(NAV);

    // Cross-zone: a plain <a>; the document is replaced (the marker is gone).
    await page.evaluate(() => { (window as unknown as { __zoneMarker?: number }).__zoneMarker = 1; });
    await page.locator('.bp-nav-link', { hasText: ZONE_B.navLabel }).click();
    await page.waitForURL(`**${ZONE_B.page}`);
    await expect(page.locator(ZONE_B.shell)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => (window as unknown as { __zoneMarker?: number }).__zoneMarker)).toBeUndefined();
    expect(await page.locator(`script[src*="${ZONE_B.prefix}/_next/"]`).count()).toBeGreaterThan(0);
    expect(await page.locator('.bp-nav-link span').allTextContents()).toEqual(NAV);
    await expect(page.locator('.bp-nav-link-active span')).toHaveText(ZONE_B.navLabel);

    // In-zone: two pages of ZONE_A keep the document (soft navigation).
    await page.locator('.bp-nav-link', { hasText: ZONE_A.navLabel }).click();
    await page.waitForURL(`**${ZONE_A.list}`);
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => { (window as unknown as { __zoneMarker?: number }).__zoneMarker = 2; });
    await page.locator('.bp-nav-link', { hasText: ZONE_A.secondNavLabel }).click();
    await page.waitForURL(`**${ZONE_A.second}`);
    await expect(page.locator(ZONE_A.secondShell)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => (window as unknown as { __zoneMarker?: number }).__zoneMarker)).toBe(2);
    await expect(page.locator('.bp-nav-link-active span')).toHaveText(ZONE_A.secondNavLabel);
  });

  test('session is shared: no second login in any zone', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto(ZONE_A.list);
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto(ZONE_B.page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator(ZONE_B.shell)).toBeVisible({ timeout: 30_000 });
  });

  test('query params stay in the real URL and a reload restores them (pinned edit Z-W1)', async ({ page }) => {
    await page.goto(ZONE_A.list);
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
    await page.locator(ZONE_A.search).fill('john');
    // Exactly once-prefixed: a doubled basePath (/iam/iam/users) fails this.
    await expect(page).toHaveURL(new RegExp(`${ZONE_A.list}\\?search=john$`), { timeout: 10_000 });
    await page.reload();
    await expect(page.locator(ZONE_A.search)).toHaveValue('john', { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`${ZONE_A.list}\\?search=john$`));
  });

  test('detail views are real routes with real history', async ({ page }) => {
    await page.goto(ZONE_A.list);
    const row = page.locator(ZONE_A.row).first();
    // Generous: the first hit of a list query may be slow on a cold backend.
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.click();
    await expect(page).toHaveURL(new RegExp(`${ZONE_A.list}/[^/?]+$`), { timeout: 15_000 });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${ZONE_A.list}$`));
    await expect(page.locator(ZONE_A.listShell)).toBeVisible({ timeout: 30_000 });
  });

  test('unauthenticated zone request redirects to the Main App login with next=', async ({ browser, baseURL }) => {
    // Explicitly empty: in @playwright/test, browser.newContext() inherits the
    // project's `use` options, including the authenticated storageState.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(`${ZONE_A.list}/123`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${enc(`${ZONE_A.list}/123`)}$`));
    expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
    await context.close();
  });

  test('login honors next= into another zone (pinned edits Z-M1h, Z-P1)', async ({ browser }) => {
    test.skip(!HAS_CREDS, 'TEST_EMAIL / TEST_PASSWORD not set');
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(ZONE_A.second);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${enc(ZONE_A.second)}$`));
    await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(`**${ZONE_A.second}`, { timeout: 60_000 });
    await expect(page.locator(ZONE_A.secondShell)).toBeVisible({ timeout: 30_000 });
    await context.close();
  });

  test('logout from a zone ends the session everywhere', async ({ browser }) => {
    // Own context: signing out must not invalidate the shared storageState.
    const context = await browser.newContext({ storageState: 'playwright/.auth/zones-user.json' });
    const page = await context.newPage();
    await page.goto(ZONE_B.page);
    await expect(page.locator(ZONE_B.shell)).toBeVisible({ timeout: 30_000 });
    await page.locator('.bp-user-profile-button').click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.goto(ZONE_A.list);
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
