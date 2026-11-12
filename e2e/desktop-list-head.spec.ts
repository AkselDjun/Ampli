import { expect, test } from '@playwright/test';

test('keeps the list view buttons on one line in the desktop list column', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  const buttons = page.locator('.list-head .lv-t');
  await expect(buttons).toHaveCount(2);
  for (const b of await buttons.all()) {
    const ratio = await b.evaluate(el => {
      const s = el.querySelector('span:last-child') as HTMLElement;
      return s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).fontSize);
    });
    expect(ratio).toBeLessThan(1.8);
  }
});
