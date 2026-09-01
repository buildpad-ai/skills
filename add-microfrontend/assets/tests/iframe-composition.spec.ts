// iframe-composition.spec.ts — Copy to: tests/microfrontend/iframe-composition.spec.ts
//
// AGENT: replace the route names, frame titles, and testids marked below with the
// real ones for this project. Change nothing else.

import { expect, test } from '@playwright/test';

// AGENT: replace these three values.
const HOST_ROUTE = '/admin/users';
const FRAME_TITLE = 'Users Management';
const MICROAPP_ORIGIN_FRAGMENT = 'amplifyapp.com';

test.describe('Micro-frontend composition', () => {
  test('the host renders the frame and the micro-app reports that it loaded', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${FRAME_TITLE}"]`);
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', new RegExp(MICROAPP_ORIGIN_FRAGMENT));

    // The frame is only displayed after MICROAPP_LOADED arrives. A frame that stays
    // hidden means the bridge never completed.
    await expect(iframe).toHaveCSS('display', 'block', { timeout: 20_000 });
  });

  test('the auth bridge signs the frame in without a login form', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    const frame = page.frameLocator(`iframe[title="${FRAME_TITLE}"]`);

    // The micro-app must never show its own login form inside the host.
    await expect(frame.locator('input[type="password"]')).toHaveCount(0);
    await expect(frame.locator('body')).toBeVisible();
  });

  test('a search in the micro-app reaches the host URL', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    const frame = page.frameLocator(`iframe[title="${FRAME_TITLE}"]`);
    await frame.locator('[data-testid="search-input"]').fill('john');

    // Poll. A fixed waitForTimeout races the 300 ms debounce and makes this flaky.
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('search=john');
  });

  test('a synced parameter change does not reload the frame', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${FRAME_TITLE}"]`);
    const frame = page.frameLocator(`iframe[title="${FRAME_TITLE}"]`);

    const srcBefore = await iframe.getAttribute('src');
    const input = frame.locator('[data-testid="search-input"]');
    await input.fill('john');
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('search=john');

    // The frame keeps its focus and its value because `src` never changed.
    expect(await iframe.getAttribute('src')).toBe(srcBefore);
    await expect(input).toHaveValue('john');
  });

  test('micro-app requests carry the scope header', async ({ page }) => {
    const scoped: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/items/')) {
        scoped.push(request.headers()['x-resource-uri'] ?? '');
      }
    });

    await page.goto(HOST_ROUTE);
    await expect
      .poll(() => scoped.length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    // Every scoped call must carry the header, or DaaS answers 403 at root scope.
    expect(scoped.every((value) => value.length > 0)).toBe(true);
  });

  test('host navigation swaps the frame for the next section', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    // AGENT: point this at a second micro-app route, not at a Main App page.
    await page.click('a[href="/admin/billing"]');
    await page.waitForURL('/admin/billing');
    await expect(page.locator('iframe')).toHaveAttribute('src', /\/invoices/);
  });

  test('logout clears the micro-app session as well as the host session', async ({ page }) => {
    await page.goto(HOST_ROUTE);
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('/login');

    // The micro-app must not still render authenticated content on a direct visit.
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === 'mfe_access_token')).toBeUndefined();
  });
});
