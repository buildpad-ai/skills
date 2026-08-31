// iframe-composition.spec.ts — Copy to: tests/iframe-composition.spec.ts (host app).
//
// Runs authenticated via auth.setup.ts (storageState). Requires all three dev
// servers — playwright.config.ts starts them.
//
// AGENT CONTRACT — every value below is a DEFAULT THAT WILL BE WRONG for some
// projects. Verify each one against the wired apps before the first run; do not
// assume a default is filled just because it looks plausible. Leave the tests alone.
const AGENT = {
  // A host route that renders a MicroappIframe.
  HOST_ROUTE: '/files',
  // The `title` prop of that MicroappIframe.
  FRAME_TITLE: 'Files Management',
  // A fragment of that micro-app's origin (from MICROAPP_URLS / its dev port).
  MICROAPP_ORIGIN_FRAGMENT: 'localhost:3001',
  // A second host route pointing at a DIFFERENT micro-app, and a path fragment
  // its frame src must contain. Delete the navigation test if there is only one.
  SECOND_HOST_ROUTE: '/users',
  SECOND_SRC_FRAGMENT: '/users',
  // The search input inside the frame. Step 4 mandates
  // data-testid="microapp-search" on a hand-written page; a Buildpad
  // CollectionList toolbar ships data-testid="collection-list-search" instead.
  // Open the micro-app's default-route page and use what is actually there.
  SEARCH_TESTID: 'microapp-search',
  // A query parameter in the page's allowedParams that the search box drives.
  SEARCH_PARAM: 'search',
  // True only when this project uses manage-scope / add-multitenancy (Rule 11).
  PROJECT_USES_SCOPES: false,
};

import { expect, test } from '@playwright/test';

test.describe('Micro-frontend composition', () => {
  test('the host renders the frame and the micro-app reports that it loaded', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(iframe).toBeAttached();
    await expect(iframe).toHaveAttribute('src', new RegExp(AGENT.MICROAPP_ORIGIN_FRAGMENT));
    // The frame is displayed only after MICROAPP_LOADED arrives. A frame that
    // stays hidden means the bridge never completed.
    await expect(iframe).toHaveCSS('display', 'block', { timeout: 30_000 });
  });

  test('the auth bridge signs the frame in without a login form', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    const frame = page.frameLocator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`)).toHaveCSS('display', 'block', { timeout: 30_000 });
    // The micro-app must never show its own login form inside the host.
    await expect(frame.locator('input[type="password"]')).toHaveCount(0);
  });

  test('a search in the micro-app reaches the host URL without reloading the frame', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(iframe).toHaveCSS('display', 'block', { timeout: 30_000 });
    const frame = page.frameLocator(`iframe[title="${AGENT.FRAME_TITLE}"]`);

    const srcBefore = await iframe.getAttribute('src');
    const input = frame.locator(`[data-testid="${AGENT.SEARCH_TESTID}"]`);
    await input.fill('john');

    // Poll — a fixed timeout races the 300 ms debounce and flakes.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain(`${AGENT.SEARCH_PARAM}=john`);
    // The frame kept focus and value because `src` never changed.
    expect(await iframe.getAttribute('src')).toBe(srcBefore);
    await expect(input).toHaveValue('john');
  });

  test('token renewal completes a second bridge round trip', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    await expect(page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`)).toHaveCSS('display', 'block', { timeout: 30_000 });

    // Force the renewal path instead of waiting out the JWT lifetime: rewrite the
    // (non-httpOnly) expiry cookie on the micro-app origin to "almost expired".
    // The provider reads it on the next load and must ask the host for a new token.
    const frameOrigin = new URL(
      (await page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`).getAttribute('src'))!,
    ).origin;
    await page.context().addCookies([{
      name: 'mfe_expires_at',
      value: String(Math.floor(Date.now() / 1000) + 70),
      url: frameOrigin,
      sameSite: 'None',
      secure: true,
    }]);

    const renewed = page.waitForRequest(
      (req) => req.url().startsWith(frameOrigin) && req.url().includes('/api/auth/set-session'),
      { timeout: 30_000 },
    );
    await page.reload();
    await renewed; // a second SET_AUTH → set-session round trip happened
  });

  test('micro-app requests carry the scope header', async ({ page }) => {
    test.skip(!AGENT.PROJECT_USES_SCOPES, 'Rule 11: only projects using manage-scope/add-multitenancy send X-Resource-Uri');
    const scoped: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/items/')) {
        scoped.push(request.headers()['x-resource-uri'] ?? '');
      }
    });
    await page.goto(AGENT.HOST_ROUTE);
    await expect.poll(() => scoped.length, { timeout: 30_000 }).toBeGreaterThan(0);
    expect(scoped.every((value) => value.length > 0)).toBe(true);
  });

  test('host navigation swaps the frame for the next section', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    await page.goto(AGENT.SECOND_HOST_ROUTE);
    await expect(page.locator('iframe')).toHaveAttribute('src', new RegExp(AGENT.SECOND_SRC_FRAGMENT));
  });

  test('logout clears the micro-app cookie, not just the host session', async ({ page }) => {
    await page.goto(AGENT.HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(iframe).toHaveCSS('display', 'block', { timeout: 30_000 });
    const frameOrigin = new URL((await iframe.getAttribute('src'))!).origin;

    // Present BEFORE — an absence-only assertion also passes when the handshake
    // never ran, which proves nothing.
    const before = await page.context().cookies(frameOrigin);
    expect(before.find((c) => c.name === 'mfe_access_token')).toBeTruthy();

    // Drive the shell's sign-out control (it must await logoutAllMicroapps()
    // before navigating — Step 3). AGENT: adjust to the real shell control.
    await page.getByTestId('profile-menu').or(page.locator('[aria-label*="profile" i]')).first().click();
    await page.getByText(/log ?out|sign ?out/i).first().click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    const after = await page.context().cookies(frameOrigin);
    expect(after.find((c) => c.name === 'mfe_access_token')).toBeUndefined();
  });
});
