import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const teaserJsonPath = path.resolve(__dirname, '../../blocks/teaser/_teaser.json');

// Feature 3 (BA acceptance criteria, 01-ba-requirements.md section 4):
// - _teaser.json defines a teaser-compact variant reusing the teaser model
// - teaser.js needs no variant branching: default and .compact produce the
//   same DOM structure, CSS alone differentiates them
// - default (no variant) still renders a sane, non-blank structure

test.describe('Feature 3: teaser compact variant', () => {
  test('_teaser.json declares a teaser-compact definition reusing the teaser model', () => {
    const json = JSON.parse(readFileSync(teaserJsonPath, 'utf-8'));

    const compactDef = json.definitions.find((d) => d.id === 'teaser-compact');
    expect(compactDef, 'expected a definition with id "teaser-compact"').toBeTruthy();
    expect(compactDef.plugins.xwalk.page.template.model).toBe('teaser');
    expect(compactDef.plugins.xwalk.page.template.classes).toBe('compact');

    // default and hero variants must still be present (compact is additive, not a replacement)
    expect(json.definitions.find((d) => d.id === 'teaser')).toBeTruthy();
    expect(json.definitions.find((d) => d.id === 'teaser-hero')).toBeTruthy();

    // reuses the same single "teaser" model - no new/duplicated field schema for compact
    expect(json.models).toHaveLength(1);
    expect(json.models[0].id).toBe('teaser');
  });

  test('default .teaser and .teaser.compact produce identical DOM structure (no JS variant branching)', async ({ page }) => {
    await page.goto('/test/fixtures/teaser-compact.html');
    await page.waitForSelector('body[data-decorated="true"]');

    const defaultStructure = await page.locator('#teaser-default').evaluate((el) => (
      [...el.querySelectorAll('*')].map((n) => n.className.replace('compact', '').trim()).join('|')
    ));
    const compactStructure = await page.locator('#teaser-compact').evaluate((el) => (
      [...el.querySelectorAll('*')].map((n) => n.className.replace('compact', '').trim()).join('|')
    ));

    expect(compactStructure).toBe(defaultStructure);

    // both should have the same generic teaser-inner/teaser-image/teaser-content shape
    for (const block of ['#teaser-default', '#teaser-compact']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(page.locator(block).locator('.teaser-inner')).toHaveCount(1);
      // eslint-disable-next-line no-await-in-loop
      await expect(page.locator(block).locator('.teaser-image')).toHaveCount(1);
      // eslint-disable-next-line no-await-in-loop
      await expect(page.locator(block).locator('.teaser-content')).toHaveCount(1);
    }
  });

  test('teaser.css .teaser.compact rules produce a visibly different layout than default teaser', async ({ page }) => {
    // teaser.css has an existing global rule - @media (width >= 900px) { .teaser-inner
    // { flex-direction: row } } - that applies to EVERY teaser, compact or not, at
    // desktop width. So at the default Desktop Chrome viewport both are 'row' and
    // that alone proves nothing. The compact variant's actual purpose (per
    // 02-architect-design.md) is to stay a horizontal card even at narrow/sidebar
    // widths where the default teaser stacks to a column - so the meaningful
    // comparison is below the 900px breakpoint.
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/test/fixtures/teaser-compact.html');
    await page.waitForSelector('body[data-decorated="true"]');

    const defaultFlexDirection = await page.locator('#teaser-default')
      .locator('.teaser-inner')
      .evaluate((el) => getComputedStyle(el).flexDirection);

    const compactFlexDirection = await page.locator('#teaser-compact')
      .locator('.teaser-inner')
      .evaluate((el) => getComputedStyle(el).flexDirection);

    expect(defaultFlexDirection).toBe('column');
    expect(compactFlexDirection).toBe('row');
    expect(compactFlexDirection).not.toBe(defaultFlexDirection);

    // max-width is compact's own unconditional rule (not viewport-gated), so it's
    // a reliable differentiator at any viewport, including the default desktop one.
    const compactMaxWidth = await page.locator('#teaser-compact')
      .locator('.teaser-inner')
      .evaluate((el) => getComputedStyle(el).maxWidth);
    expect(compactMaxWidth).toBe('320px');
  });

  test('default teaser (no variant class) still renders a non-blank, structured block', async ({ page }) => {
    await page.goto('/test/fixtures/teaser-compact.html');
    await page.waitForSelector('body[data-decorated="true"]');

    const defaultBlock = page.locator('#teaser-default');
    await expect(defaultBlock.locator('.teaser-inner')).toHaveCount(1);
    await expect(defaultBlock.locator('h2')).toHaveText('Default Teaser');
    await expect(defaultBlock.locator('img')).toHaveCount(1);
  });
});
