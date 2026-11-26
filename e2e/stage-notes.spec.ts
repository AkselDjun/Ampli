import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const scan = async (page: Page) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map(v => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`);
};

const ownProject = async (page: Page) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await page.locator('.rows .row').nth(1).click();
  const len = page.locator('#editor input[inputmode="decimal"]').first();
  await len.fill('30');
  await len.press('Tab');
  const back = page.locator('.ab-back');
  if (await back.isVisible()) await back.click();
  await expect(page.getByRole('group', { name: 'Этап проекта' })).toBeVisible();
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`тема ${scheme}`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' });
    test('stage bar, notes and shortcuts pass axe', async ({ page, isMobile }) => {
      await ownProject(page);
      await page.getByRole('button', { name: 'Этап: Расчёт. Сменить этап' }).click();
      await page.getByRole('menuitem', { name: /^Смета отправлена/ }).click();
      await page.locator('.rows .row').nth(2).click();
      await page.getByRole('button', { name: /^Заметки/ }).click();
      await page.getByRole('textbox', { name: 'Новая заметка' }).fill('Проверить коробку');
      await page.getByRole('textbox', { name: 'Новая заметка' }).press('Enter');
      await expect(page.getByRole('checkbox', { name: 'Проверить коробку' })).toBeVisible();
      expect(await scan(page)).toEqual([]);
      if (isMobile) await page.locator('.ab-back').click();
      await expect(page.getByRole('toolbar', { name: 'Отбор и порядок групп' }).getByRole('button', { name: /^Заметки/ })).toBeVisible();
      expect(await scan(page)).toEqual([]);
      if (!isMobile) {
        await page.locator('.col-list h2').click();
        await page.keyboard.press('Shift+Slash');
        await expect(page.getByRole('dialog', { name: 'Горячие клавиши' })).toBeVisible();
        expect(await scan(page)).toEqual([]);
      }
    });
  });
}

test('keeps the stage bar inside a 320 px phone with finger-size buttons', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.setViewportSize({ width: 320, height: 640 });
  await ownProject(page);
  for (const b of await page.locator('.stg button').all()) {
    const box = await b.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
