import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Отчёт и спецификация' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '9');
    for (const c of ['calc', 'build', 'docs']) localStorage.setItem('ampli-chapter-hint-' + c, '1');
    const w = window as unknown as { printed: number };
    w.printed = 0;
    window.print = () => { w.printed += 1; };
  });
});

test('лист сборки показывает ряды, гребёнки, шины и подключение групп примера', async ({ page }) => {
  await page.goto('/#report/assembly');
  const panel = sheet(page).getByRole('tabpanel', { name: 'Сборка' });
  await expect(panel.getByRole('list', { name: 'Аппараты ряда 1' })).toBeVisible();
  await expect(panel.getByText(/Гребёнка 1P на \d+ аппарат/).first()).toBeVisible();
  const buses = panel.getByRole('region', { name: 'Шины N и PE' });
  await expect(buses).toContainText('Шина N ввода');
  await expect(buses).toContainText('Шина PE');
  await expect(panel.getByRole('region', { name: 'Подключение кабелей групп' })).toContainText('L коричневый, N синий, PE жёлто-зелёный');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});

test('лист сборки печатается из подвала окна', async ({ page }) => {
  await page.goto('/#report/assembly');
  await sheet(page).getByRole('button', { name: 'Печать листа сборки' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.printdoc h1')).toHaveText('Сборка щитка');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`вкладка «Сборка» доступна, тема ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/#report/assembly');
    await expect(sheet(page).getByRole('region', { name: 'Шины N и PE' })).toBeVisible();
    const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(res.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))).toEqual([]);
  });
}
