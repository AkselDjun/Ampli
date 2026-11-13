import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const done = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '9');
    for (const c of ['calc', 'build', 'docs']) localStorage.setItem('ampli-chapter-hint-' + c, '1');
  });
};
const hash = (page: Page) => page.evaluate(() => window.location.hash);
const title = (page: Page) => page.locator('.sheet:not([hidden]) h2');

test('opens a section from its link, follows its tabs and closes with the back button', async ({ page }) => {
  await done(page);
  await page.goto('/#report/estimate');
  await expect(title(page)).toHaveText('Отчёт и спецификация');
  await expect(page.getByRole('tab', { name: 'Смета' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Схема' }).click();
  await expect.poll(() => hash(page)).toBe('#report/scheme');
  await page.goBack();
  await expect(title(page)).toHaveCount(0);
  await expect.poll(() => hash(page)).toBe('');
  await expect(page.locator('.rows .row').first()).toBeVisible();
});

test('shows the open section in the address and clears it on close', async ({ page }) => {
  await done(page);
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.getByRole('button', { name: /Приёмка/ }).first().click();
  await expect(title(page)).toHaveText('Приёмка');
  await expect.poll(() => hash(page)).toBe('#work/check');
  await page.reload();
  await expect(title(page)).toHaveText('Приёмка');
  await page.locator('.sheet:not([hidden])').getByRole('button', { name: 'Закрыть' }).click();
  await expect(title(page)).toHaveCount(0);
  await expect.poll(() => hash(page)).toBe('');
});

test.describe('landscape phone 740 × 360', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  test('shows a group under a one-line project card and hides the tabs while scrolling down', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await done(page);
    await page.goto('/');
    const row = page.locator('.rows .row').first();
    await expect(row).toBeVisible();
    const tabs = page.locator('nav.tabs');
    const top = (await tabs.boundingBox())!.y;
    expect((await row.boundingBox())!.y).toBeLessThan(top);
    const fab = (await page.locator('.fab-b').boundingBox())!;
    const link = (await page.locator('.lv-link').boundingBox())!;
    expect(fab.y > link.y + link.height || fab.x > link.x + link.width).toBe(true);
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 400);
    await expect(tabs).toHaveClass(/hide/);
    await page.mouse.wheel(0, -200);
    await expect(tabs).not.toHaveClass(/hide/);
  });
});
