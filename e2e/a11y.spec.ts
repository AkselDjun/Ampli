import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const scan = async (page: Page) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map(v => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`);
};

const palette = async (page: Page, text: string) => {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill(text);
  await page.keyboard.press('Enter');
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility in ${scheme} theme`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
      await page.goto('/');
      await expect(page.locator('.rows .row').first()).toBeVisible();
    });

    test('main screen', async ({ page }) => {
      expect(await scan(page)).toEqual([]);
    });

    test('group editor', async ({ page }) => {
      await page.locator('.rows .row').first().click();
      await expect(page.locator('[aria-label="Редактор группы"]')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('report tabs', async ({ page }) => {
      await palette(page, 'Отчёт и спецификация');
      const sheet = page.getByRole('dialog', { name: 'Отчёт и спецификация' });
      for (const t of ['Группы', 'Схема', 'Смета']) {
        await sheet.getByRole('tab', { name: t }).click();
        expect(await scan(page), t).toEqual([]);
      }
    });

    test('panel mode', async ({ page }) => {
      await palette(page, 'Режим «На щитке»');
      await expect(page.getByRole('dialog', { name: 'На щитке' })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('network settings and my data', async ({ page }) => {
      await palette(page, 'Параметры сети');
      await expect(page.getByRole('dialog', { name: 'Параметры сети' })).toBeVisible();
      expect(await scan(page), 'net').toEqual([]);
      await page.keyboard.press('Escape');
      await palette(page, 'Мои данные');
      const d = page.getByRole('dialog', { name: 'Мои данные' });
      for (const t of ['Реквизиты', 'Шаблоны и цены', 'Оформление']) {
        await d.getByRole('tab', { name: t }).click();
        expect(await scan(page), t).toEqual([]);
      }
    });
  });
}
