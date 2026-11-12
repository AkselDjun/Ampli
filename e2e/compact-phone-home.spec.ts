import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 667 } });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout only');
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '2');
  });
});

test('fits at least three groups above the tab bar on a 375 × 667 phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await expect(page.locator('.nf-pair')).toBeHidden();
  await expect(page.locator('.sample')).toBeHidden();
  const seen = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Разделы"]');
    const edge = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    return Array.from(document.querySelectorAll('.rows .row')).filter(r => r.getBoundingClientRect().bottom <= edge).length;
  });
  expect(seen).toBeGreaterThanOrEqual(3);
});

test('tells about the sample once and keeps floor heating one tap away', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.toast', { hasText: 'пример двухкомнатной квартиры' })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить группу' }).click();
  await page.getByRole('menuitem', { name: 'Тёплый пол' }).click();
  await expect(page.getByRole('dialog', { name: /Тёплый пол/ })).toBeVisible();
  await page.reload();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.waitForTimeout(1600);
  await expect(page.locator('.toast', { hasText: 'пример двухкомнатной квартиры' })).toHaveCount(0);
});
