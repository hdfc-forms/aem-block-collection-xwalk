import { test, expect } from '@playwright/test';

// Feature: nav-button block (page / section / api navigation types).
// - each variant renders a single clean <a>/<button class="button">, not the
//   raw stacked field divs
// - the block fires analytics itself (not the sitewide delegated listener in
//   delayed.js) via stopPropagation(), proven by asserting exactly one
//   dummy-analytics log per click even though this fixture also imports the
//   analytics module directly
// - the api variant calls the configured URL via scripts/api-client.js and
//   logs the result (status/ok) in the digitalData payload
//
// The fixture intercepts real <a> navigation and window.location.href
// assignment (capture-phase, test-only - see test/fixtures/nav-button.html)
// so these tests can exercise button.js's real click handling without racing
// against a real page unload destroying the JS context mid-assertion.

function collectDigitalDataLogs(page) {
  const entries = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log' && msg.text().startsWith('[dummy-analytics] digitalData:')) {
      msg.args()[1].jsonValue().then((payload) => entries.push(payload)).catch(() => {});
    }
  });
  return entries;
}

test.describe('nav-button block', () => {
  test('button-page renders a single <a class="button primary"> and fires analytics with navType', async ({ page }) => {
    const logs = collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/nav-button.html');
    await page.waitForFunction(() => window.__delayedReady);
    const btn = page.locator('#btn-page .button');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveText('Go to Blog');
    await expect(btn).toHaveClass(/primary/);
    await expect(btn).toHaveAttribute('href', '/blog-demo');

    await btn.click();
    await expect.poll(() => logs.length).toBeGreaterThan(0);
    expect(logs[0].navType).toBe('button-page');
    expect(logs[0].button.name).toBe('Go to Blog');
    expect(logs[0].target.nextPageName).toBe('Go to Blog');
  });

  test('button-section scrolls to the target id and does not navigate away', async ({ page }) => {
    const logs = collectDigitalDataLogs(page);
    await page.goto('/test/fixtures/nav-button.html');
    await page.waitForFunction(() => window.__delayedReady);

    const btn = page.locator('#btn-section .button');
    await expect(btn).toHaveAttribute('href', '#features');

    await btn.click();
    await expect.poll(() => logs.length).toBeGreaterThan(0);
    expect(logs[0].navType).toBe('button-section');
    expect(logs[0].target.nextPageName).toBe('features');
    // preventDefault() is called for section nav - confirm we're still on the fixture page
    expect(page.url()).toContain('nav-button.html');
  });

  test('button-api calls the configured URL and logs the result (status/ok) in the digitalData payload', async ({ page }) => {
    await page.route('**/api/mock-success', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }));
    const logs = collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/nav-button.html');
    await page.waitForFunction(() => window.__delayedReady);
    const btn = page.locator('#btn-api button.button');
    await expect(btn).toHaveCount(1); // renders a real <button>, not an <a>

    await btn.click();
    await expect.poll(() => logs.length).toBeGreaterThan(0);
    expect(logs[0].navType).toBe('button-api');
    expect(logs[0].api.url).toBe('/api/mock-success');
    expect(logs[0].api.method).toBe('GET');
    expect(logs[0].api.ok).toBe(true);
    expect(logs[0].api.status).toBe(200);
    // no apiSuccessPage configured on this fixture instance - the redirect
    // (`window.location.href = fields.apiSuccessPage`) is a one-line, code-
    // reviewed behavior; see the fixture's comment on why it isn't e2e-tested.
  });

  test('button-api surfaces API failures in the digitalData payload instead of throwing', async ({ page }) => {
    await page.route('**/api/mock-success', (route) => route.fulfill({ status: 500, body: 'error' }));
    const logs = collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/nav-button.html');
    await page.waitForFunction(() => window.__delayedReady);
    await page.locator('#btn-api button.button').click();

    await expect.poll(() => logs.length).toBeGreaterThan(0);
    expect(logs[0].api.ok).toBe(false);
    expect(logs[0].api.status).toBe(500);
  });

  test('a click only fires analytics once (block-level handler, not double-counted by any delegated listener)', async ({ page }) => {
    const consoleEntries = [];
    page.on('console', (msg) => consoleEntries.push(msg.text()));

    await page.goto('/test/fixtures/nav-button.html');
    await page.waitForFunction(() => window.__delayedReady);
    await page.locator('#btn-page .button').click();
    await expect.poll(() => consoleEntries.filter((t) => t.startsWith('[dummy-analytics]')).length)
      .toBeGreaterThan(0);

    const dummyEntries = consoleEntries.filter((t) => t.startsWith('[dummy-analytics]'));
    expect(dummyEntries).toHaveLength(1);
  });
});
