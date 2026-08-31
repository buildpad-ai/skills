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
  // The control inside the frame whose use drives an allowlisted query parameter,
  // written as a full selector. Open the framed page and read what is REALLY there.
  //
  // Search boxes shipped by the CLI modules, verified in the installed source:
  //   Files          data-testid="files-search"             (files-toolbar.tsx)
  //   Users          data-testid="users-manager-search"     (users-manager.tsx)
  //   Roles          data-testid="roles-manager-search"
  //   Policies       data-testid="policies-manager-search"
  //   CollectionList data-testid="collection-list-search"
  // No CLI module ships data-testid="microapp-search". That id exists only on a
  // hand-written placeholder page.
  //
  // A search box is usually NOT the control to use here. Every CLI module holds
  // search, page, sort, and view in private useState, exposes no controlled prop and
  // no change callback for them, and Rule 9 forbids editing module source — so those
  // parameters cannot be synced at all. What a module does expose is a selection
  // callback (UsersManager.onUserClick, FileManager.onFileClick), so the wrapper
  // syncs a record id and the control is a row. See SKILL Step 4.
  // Verified to exist. NOT users-manager-table: users-manager.tsx passes that
  // testid to <VTable>, which never spreads it, so it matches nothing (and
  // TypeScript will not catch it — hyphenated JSX attrs skip excess-property checks).
  SYNC_CONTROL: '[data-testid="users-manager"] tbody tr',
  // 'click' for a row or a link. 'fill' for a text input.
  SYNC_ACTION: 'click' as 'click' | 'fill',
  // Text to type when SYNC_ACTION is 'fill'. Ignored for 'click'.
  SYNC_FILL_VALUE: '',
  // The allowlisted parameter that control drives. It MUST appear in the host page's
  // allowedParams AND in the micro-app's useQueryParamSync call: pickParams() drops
  // everything else in both directions, so a one-sided name is discarded in silence
  // and still looks correct inside the frame.
  // The sync test drives whichever micro-app actually wires the sync — which may
  // NOT be the one in HOST_ROUTE/FRAME_TITLE above.
  SYNC_HOST_ROUTE: '/users',
  SYNC_FRAME_TITLE: 'Users Management',
  SYNC_PARAM: 'user',
  // Set false when the installed module exposes no controllable state at all. The
  // URL round-trip test then skips instead of failing on an impossible assertion.
  URL_SYNC_IS_WIRED: true,
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

  test('in-frame state reaches the host URL without reloading the frame', async ({ page }) => {
    test.skip(
      !AGENT.URL_SYNC_IS_WIRED,
      'The installed module exposes no controllable state through public props, and Rule 9 forbids editing module source (SKILL Step 4).',
    );
    test.setTimeout(150_000);
    await page.goto(AGENT.HOST_ROUTE);
    const iframe = page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(iframe).toHaveCSS('display', 'block', { timeout: 30_000 });
    const frame = page.frameLocator(`iframe[title="${AGENT.FRAME_TITLE}"]`);

    const srcBefore = await iframe.getAttribute('src');
    // 90 s: this DaaS answers a list endpoint in about 13 s, and the module renders
    // its rows only after that. A short wait reads as a broken bridge.
    const control = frame.locator(AGENT.SYNC_CONTROL).first();
    await expect(control).toBeVisible({ timeout: 90_000 });

    if (AGENT.SYNC_ACTION === 'fill') {
      await control.fill(AGENT.SYNC_FILL_VALUE);
    } else {
      await control.click();
    }

    // Poll — a fixed timeout races the 300 ms debounce and flakes.
    await expect.poll(() => page.url(), { timeout: 15_000 }).toContain(`${AGENT.SYNC_PARAM}=`);
    // The frame kept its state because `src` never changed.
    expect(await iframe.getAttribute('src')).toBe(srcBefore);
    if (AGENT.SYNC_ACTION === 'fill') {
      await expect(control).toHaveValue(AGENT.SYNC_FILL_VALUE);
    }
  });

  test('the framed module loads real data — no 401 or 403 from DaaS', async ({ page }) => {
    test.setTimeout(150_000);
    const denied: string[] = [];
    page.on('response', (response) => {
      if ([401, 403].includes(response.status()) && response.url().includes('/api/')) {
        // /api/auth/token 401s once by design on a cold frame: the micro-app posts
        // MICROAPP_NEEDS_AUTH in answer to it. Every other 401 is a real failure.
        if (!response.url().includes('/api/auth/token')) denied.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto(AGENT.HOST_ROUTE);
    await expect(page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`)).toHaveCSS('display', 'block', { timeout: 30_000 });
    // Long enough for the module's own list calls to answer. Rendered text is not
    // evidence: the Files module swallows a 401 and renders its empty state.
    await page.waitForTimeout(90_000);
    expect(denied, 'W1b readiness gate missing? The module mounted before the bridge token arrived.').toEqual([]);
  });

  test('the framed micro-app renders no second app shell', async ({ page }) => {
    // Load the section FRESH. E1 self-corrects on a later client-side host
    // navigation, so a warm check cannot see the failure.
    await page.goto(AGENT.HOST_ROUTE);
    const frame = page.frameLocator(`iframe[title="${AGENT.FRAME_TITLE}"]`);
    await expect(page.locator(`iframe[title="${AGENT.FRAME_TITLE}"]`)).toHaveCSS('display', 'block', { timeout: 30_000 });
    // Assert AFTER the refresh window, not before it. applyAuth ends in
    // router.refresh(), which is what re-mounts the shell under a header-only E1;
    // asserting on first paint is a guaranteed false green on the exact regression
    // this test exists to catch.
    await page.waitForTimeout(15_000);
    await expect(frame.locator('.mantine-AppShell-navbar')).toHaveCount(0);
    await expect(frame.getByText(/main menu/i)).toHaveCount(0);
    await expect(frame.getByText(/sign ?out|log ?out/i)).toHaveCount(0);
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
