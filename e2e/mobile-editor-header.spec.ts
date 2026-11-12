import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390]) {
  test.describe(`editor header at ${width} px`, () => {
    test.use({ viewport: { width, height: 700 } });

    test('keeps the title and the short result clear of the done button', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
      await page.goto('/');
      await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
      await expect(page.locator('#editor')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 900));
      const mini = page.locator('.ed-mini');
      await expect(mini).toBeVisible();
      const done = await page.locator('.ab-edit > .btn').boundingBox();
      const title = await page.locator('.ab-title').boundingBox();
      const sub = await mini.boundingBox();
      expect(title!.x + title!.width).toBeLessThanOrEqual(done!.x);
      expect(sub!.x + sub!.width).toBeLessThanOrEqual(done!.x);
      expect(await mini.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
      expect(Math.round(done!.height)).toBeGreaterThanOrEqual(44);
      for (const b of await page.locator('.appbar button:visible:not(.ed-mini)').all()) {
        const r = await b.boundingBox();
        expect(Math.round(Math.min(r!.width, r!.height)), await b.innerText()).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

test.describe('header buttons on the group list', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('are large enough to tap', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
    await page.goto('/');
    await expect(page.locator('.rows .row').first()).toBeVisible();
    for (const b of await page.locator('.appbar .ab-btn:visible').all()) {
      const r = await b.boundingBox();
      expect(Math.round(Math.min(r!.width, r!.height))).toBeGreaterThanOrEqual(44);
    }
  });
});
