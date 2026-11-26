import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
});

test('shows a group card on hover next to the row and hides it when the pointer leaves', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.goto('/');
  const row = page.locator('.rows .row').nth(3);
  await row.hover();
  const card = page.locator('.peek');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Защита');
  await expect(card).toContainText(await row.locator('.row-name').innerText());
  const [r, c] = await Promise.all([row.boundingBox(), card.boundingBox()]);
  expect(c && r && c.x).toBeGreaterThanOrEqual((r?.x ?? 0) + (r?.width ?? 0));
  expect((c?.y ?? 0) + (c?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  await page.locator('.list-head').hover();
  await expect(card).toHaveCount(0);
});

test('moves between groups with J and K and opens the shortcut list with ?', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard on a computer');
  await page.goto('/');
  await page.locator('.col-list .list-h').focus();
  const first = await page.locator('.rows .row.sel .row-name').innerText();
  await page.keyboard.press('j');
  await expect(page.locator('.rows .row.sel .row-name')).not.toHaveText(first);
  await expect(page.locator('.rows .row.sel')).toBeFocused();
  await page.keyboard.press('k');
  await expect(page.locator('.rows .row.sel .row-name')).toHaveText(first);
  await page.keyboard.press('Shift+Slash');
  await expect(page.getByRole('dialog', { name: 'Горячие клавиши' })).toBeVisible();
});
