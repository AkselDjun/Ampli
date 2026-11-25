import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Проекты' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
});

const openShare = async (page: Page) => {
  await page.getByRole('button', { name: 'Проекты' }).first().click();
  await sheet(page).getByRole('tab', { name: 'Обмен и данные' }).click();
  await expect(sheet(page).getByRole('heading', { name: 'Сообщить о проблеме' })).toBeVisible();
};

test('записывает сбой в журнал и отдаёт отчёт без данных заказчика', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.evaluate(() => {
    window.setTimeout(() => { throw new Error('e2e сбой расчёта'); });
    void Promise.reject(new TypeError('e2e отказ для ivan@mail.by'));
  });
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('ampli-errors') ?? '[]') as unknown[]).length)).toBe(2);
  await openShare(page);
  await expect(sheet(page).getByText('На этом устройстве записано: 2 ошибки')).toBeVisible();
  await sheet(page).getByLabel('Что случилось, необязательно').fill('После добавления группы пропала смета');
  await sheet(page).getByText('Что увидит разработчик').click();
  await expect(sheet(page).getByLabel('Текст отчёта')).toContainText('После добавления группы пропала смета');
  const [file] = await Promise.all([page.waitForEvent('download'), sheet(page).getByRole('button', { name: 'Скачать отчёт' }).click()]);
  expect(file.suggestedFilename()).toMatch(/^ampli-problem-\d{4}-\d{2}-\d{2}\.txt$/);
  const text = await readFile((await file.path())!, 'utf8');
  expect(text).toContain('e2e сбой расчёта');
  expect(text).toContain('TypeError: e2e отказ для …');
  expect(text).not.toContain('ivan@mail.by');
  expect(text).not.toContain('Квартира');
  expect(text).toContain('После добавления группы пропала смета');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`блок «Сообщить о проблеме» доступен, тема ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('.rows .row').first()).toBeVisible();
    await openShare(page);
    await sheet(page).getByText('Что увидит разработчик').click();
    await expect(sheet(page).getByLabel('Текст отчёта')).toContainText('Ошибок не записано');
    const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(res.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
}
