import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 820, height: 1180 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '2');
  });
});

test('shows the group list and the group card side by side on a tablet in portrait', async ({ page }) => {
  await page.goto('/');
  await page.locator('.rows .row').nth(2).click();
  const list = await page.locator('.col-list').boundingBox();
  const card = await page.locator('.col-edit').boundingBox();
  expect(list && card).toBeTruthy();
  expect((card?.x ?? 0)).toBeGreaterThan((list?.x ?? 0) + (list?.width ?? 0) - 1);
  await expect(page.locator('.col-list')).toBeVisible();
  await expect(page.locator('.col-edit')).toBeVisible();
  await expect(page.locator('.tabs')).toBeVisible();
  await page.locator('.tabs button').nth(1).click();
  await expect(page.locator('.col-res')).toBeVisible();
  await expect(page.locator('.col-list')).toBeHidden();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});
