import { test, expect } from '@playwright/test';

// Feature 2 (BA acceptance criteria, 01-ba-requirements.md section 3):
// - article/blog page-type metadata -> page-type-{value} class + badge with right text
// - no/unrecognized metadata -> neither class nor badge (fallback doesn't half-apply)
// - header still renders its normal nav content in all three cases

test.describe('Feature 2: adaptive header by page-type', () => {
  test('article page-type gets page-type-article class and "Article" badge', async ({ page }) => {
    await page.goto('/test/fixtures/header-adaptive.html?page-type=article');
    await page.waitForSelector('body[data-decorated="true"]');

    const header = page.locator('header.block');
    await expect(header).toHaveClass(/page-type-article/);

    const badge = header.locator('.page-type-badge');
    await expect(badge).toHaveText('Article');
  });

  test('blog page-type gets page-type-blog class and "Blog" badge', async ({ page }) => {
    await page.goto('/test/fixtures/header-adaptive.html?page-type=blog');
    await page.waitForSelector('body[data-decorated="true"]');

    const header = page.locator('header.block');
    await expect(header).toHaveClass(/page-type-blog/);

    const badge = header.locator('.page-type-badge');
    await expect(badge).toHaveText('Blog');
  });

  test('no page-type metadata falls back to generic: no class, no badge, nav still renders', async ({ page }) => {
    await page.goto('/test/fixtures/header-adaptive.html?page-type=none');
    await page.waitForSelector('body[data-decorated="true"]');

    const header = page.locator('header.block');
    await expect(header).not.toHaveClass(/page-type-article/);
    await expect(header).not.toHaveClass(/page-type-blog/);
    await expect(header.locator('.page-type-badge')).toHaveCount(0);

    // fallback isn't blank - normal nav content still renders
    await expect(header.locator('.nav-brand a')).toHaveText('WKND Cloud');
    await expect(header.locator('.nav-sections a')).toHaveCount(2);
  });

  test('unrecognized page-type value also falls back to generic (not just literal absence)', async ({ page }) => {
    await page.goto('/test/fixtures/header-adaptive.html?page-type=landing-page');
    await page.waitForSelector('body[data-decorated="true"]');

    const header = page.locator('header.block');
    await expect(header.locator('.page-type-badge')).toHaveCount(0);
    const classAttr = await header.getAttribute('class');
    expect(classAttr).not.toMatch(/page-type-/);
  });

  test('article and blog scenarios also render normal nav content (fallback path is not the only one that renders nav)', async ({ page }) => {
    await page.goto('/test/fixtures/header-adaptive.html?page-type=article');
    await page.waitForSelector('body[data-decorated="true"]');

    const header = page.locator('header.block');
    await expect(header.locator('.nav-brand a')).toHaveText('WKND Cloud');
    await expect(header.locator('.nav-sections a')).toHaveCount(2);
  });
});
