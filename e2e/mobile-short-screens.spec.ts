import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const start = async (page: Page) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
};

const panelMode = async (page: Page) => {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Замеры на щитке');
  await page.keyboard.press('Enter');
  const sheet = page.locator('[role="dialog"]:visible').last();
  await expect(sheet.locator('.pm')).toBeVisible();
  return sheet;
};

test.describe('panel mode on a 320 × 640 phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('leaves room to see the panel above the measurement form', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await start(page);
    const sheet = await panelMode(page);
    const box = (await sheet.locator('.pmb-box').boundingBox())!;
    const form = (await sheet.locator('.pm').boundingBox())!;
    expect(form.y - box.y).toBeGreaterThanOrEqual(150);
    await expect(sheet.locator('.pm-kb')).toBeHidden();
    const norm = sheet.locator('.pm-norm').first();
    await expect(norm).toBeHidden();
    await sheet.locator('.pm-in input').first().fill('0,5');
    await expect(norm).toBeVisible();
  });
});

test.describe('landscape phone 740 × 360', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  test('keeps the bottom tabs low and shows the panel in panel mode', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await start(page);
    const tabs = (await page.locator('.tabs').boundingBox())!;
    expect(tabs.height).toBeLessThanOrEqual(50);
    for (const b of await page.locator('.tabs button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const sheet = await panelMode(page);
    const box = (await sheet.locator('.pmb-box').boundingBox())!;
    expect(box.y + 120).toBeLessThanOrEqual(360);
    const covering = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pm'), [box.x + 40, box.y + 60]);
    expect(covering).toBe(false);
  });
});
