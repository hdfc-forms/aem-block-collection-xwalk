import { test, expect } from '@playwright/test';

// Feature 1 (BA acceptance criteria, 01-ba-requirements.md section 2):
// - click on a .button logs a digitalData-shaped dummy object via console.log
// - button name honors data-analytics-name override, else visible text
// - next-page falls back to the literal "no-target" when there's no usable href
// - the hookup is subscribe/publish (proven here by two independent console
//   entries firing per click from two independently-independently subscribers)
// - clicking never breaks native link behavior (no preventDefault, href intact)

// console.log('[dummy-analytics] digitalData:', obj) arrives as a console
// message with two args; msg.text() stringifies nested objects shallowly
// (e.g. "page: Object"), so to inspect the real digitalData payload we must
// pull the second JSHandle's actual JSON value instead of parsing msg.text().
//
// IMPORTANT: jsonValue() must be resolved EAGERLY, inside the console handler
// itself, not lazily after the test proceeds. These fixture buttons have real
// hrefs and the analytics listener never calls preventDefault() (by design -
// see the "never prevents default navigation" test below), so the browser
// starts navigating immediately after the click. If jsonValue() is called
// after that navigation completes, the JSHandle's execution context has
// already been destroyed and the call throws. Resolving inside the handler
// captures the value before the navigation has a chance to tear it down.
async function collectDigitalDataLogs(page) {
  const entries = [];
  page.on('console', (msg) => {
    if (msg.type() === 'log' && msg.text().startsWith('[dummy-analytics] digitalData:')) {
      msg.args()[1].jsonValue().then((payload) => entries.push(payload)).catch(() => {});
    }
  });
  return entries;
}

test.describe('Feature 1: button analytics pub/sub', () => {
  // The fixture's "Explore Adventures" link points to a real-looking but
  // non-existent path; block the navigation network request so the click's
  // native behavior (browser attempts to navigate) can be observed without
  // the test page actually leaving / erroring on a 404.
  test.beforeEach(async ({ page }) => {
    await page.route('**/en/adventures', (route) => route.fulfill({ status: 200, body: '<html></html>' }));
    await page.route('**/en/sign-up', (route) => route.fulfill({ status: 200, body: '<html></html>' }));
  });

  test('href button logs digitalData with visible text as button name and next page name', async ({ page, context }) => {
    const dummyLogs = await collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/button-analytics.html');
    // "View Details" is target="_blank": clicking opens a new tab rather than
    // navigating this page, so this page's console listener/context never gets
    // torn down while we read the payload back out. Close the resulting popup -
    // its own navigation outcome is irrelevant to this test.
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'View Details' }).click(),
    ]);
    await expect.poll(() => dummyLogs.length).toBeGreaterThan(0);
    await popup.close();

    const payload = dummyLogs[0];
    expect(payload.event).toBe('button_click');
    expect(payload.button.name).toBe('View Details');
    expect(payload.target.nextPageName).toBe('View Details');
  });

  test('href-less (#) button logs "no-target" as the next page', async ({ page }) => {
    const dummyLogs = await collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/button-analytics.html');
    // This trigger has role="button" (no href) - it's a modal trigger, not a
    // navigation link, so it must be queried by its actual accessible role.
    await page.getByRole('button', { name: 'Open Modal' }).click();
    await expect.poll(() => dummyLogs.length).toBeGreaterThan(0);

    const payload = dummyLogs[0];
    expect(payload.target.nextPageName).toBe('no-target');
  });

  test('data-analytics-name override is used instead of the long visible label', async ({ page, context }) => {
    const dummyLogs = await collectDigitalDataLogs(page);

    await page.goto('/test/fixtures/button-analytics.html');
    // Same rationale as the "View Details" test above: target="_blank" keeps this
    // page's context alive across the click so the payload can be read back out.
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Sign up now, it only takes a minute' }).click(),
    ]);
    await expect.poll(() => dummyLogs.length).toBeGreaterThan(0);
    await popup.close();

    const payload = dummyLogs[0];
    expect(payload.button.name).toBe('signup-cta');
    expect(payload.button.name).not.toContain('Sign up now');
  });

  test('a single click fires two independent subscriber log lines (proves pub/sub, not one hardcoded call)', async ({ page }) => {
    const consoleEntries = [];
    page.on('console', (msg) => consoleEntries.push({ type: msg.type(), text: msg.text() }));

    await page.goto('/test/fixtures/button-analytics.html');
    await page.getByRole('link', { name: 'Explore Adventures' }).click();

    await expect.poll(() => consoleEntries.filter((e) => e.text.includes('[analytics] click count:')).length)
      .toBeGreaterThan(0);

    const dummyAnalyticsEntries = consoleEntries.filter((e) => e.text.includes('[dummy-analytics] digitalData:'));
    const clickCountEntries = consoleEntries.filter((e) => e.text.includes('[analytics] click count:'));

    expect(dummyAnalyticsEntries, 'dummy analytics subscriber should have logged').toHaveLength(1);
    expect(clickCountEntries, 'click-count subscriber should have logged independently').toHaveLength(1);
    expect(clickCountEntries[0].text).toContain('click count: 1');
  });

  test('clicking a button never prevents default navigation behavior (href stays intact, no preventDefault)', async ({ page }) => {
    await page.goto('/test/fixtures/button-analytics.html');
    const link = page.getByRole('link', { name: 'Explore Adventures' });

    // href attribute is never mutated by the analytics wiring
    await expect(link).toHaveAttribute('href', '/en/adventures');

    // If event.preventDefault() had been called anywhere in the delegated
    // listener, the browser's native navigation would never fire; asserting
    // an actual navigation occurs after click is the most direct proof that
    // default behavior was never prevented.
    await Promise.all([
      page.waitForNavigation(),
      link.click(),
    ]);
    expect(page.url()).toContain('/en/adventures');
  });
});
