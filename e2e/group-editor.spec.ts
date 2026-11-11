import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const openGroup = async (page: Page, name: string): Promise<Locator> => {
  await page.locator('.rows .row').filter({ hasText: name }).first().click();
  const ed = page.locator('[aria-label="Редактор группы"]');
  await expect(ed).toBeVisible();
  return ed;
};

const top = async (l: Locator): Promise<number> => (await l.boundingBox())?.y ?? Number.NaN;

const fold = (ed: Locator, name: string): Locator => ed.locator('.fold-in > .why-t').filter({ has: ed.page().locator('span', { hasText: name }) });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
});

test('orders the group card by how often each part is used', async ({ page }) => {
  const ed = await openGroup(page, 'Варочная');
  const ys = [
    await top(ed.locator('.ed-res')),
    await top(ed.getByText('Тип группы', { exact: true })),
    await top(ed.getByText('Длина до распредкоробки, м', { exact: true })),
    await top(ed.locator('.apps')),
    await top(fold(ed, 'Дополнительно')),
    await top(fold(ed, 'Замеры и фото')),
    await top(fold(ed, 'Как посчитано')),
    await top(ed.locator('.ed-end'))
  ];
  expect(ys.every(Number.isFinite)).toBe(true);
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});

test('keeps the calculation details in one folded row', async ({ page }) => {
  const ed = await openGroup(page, 'Варочная');
  const why = fold(ed, 'Как посчитано');
  await expect(why).toHaveAttribute('aria-expanded', 'false');
  await expect(ed.locator('.why-b')).toBeHidden();
  const box = await why.boundingBox();
  expect(box?.height ?? 0).toBeLessThanOrEqual(64);
  await why.click();
  await expect(ed.locator('.why-b')).toBeVisible();
  await expect(ed.locator('.why-b dt').first()).toBeVisible();
  await why.click();
  await expect(ed.locator('.why-b')).toBeHidden();
});

for (const width of [320, 375, 430]) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`phone ${width} px, ${scheme} theme`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: scheme, reducedMotion: 'reduce' });

      test('fits the screen and shows the line length early', async ({ page }) => {
        const ed = await openGroup(page, 'Варочная');
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBeLessThanOrEqual(1);
        const len = ed.getByRole('textbox', { name: 'Длина линии, м' });
        const edTop = await top(ed);
        expect((await top(len)) - edTop).toBeLessThan(700);
        for (const name of ['Дополнительно', 'Замеры и фото', 'Как посчитано']) {
          const b = await fold(ed, name).boundingBox();
          expect(b?.height ?? 0, name).toBeLessThanOrEqual(64);
        }
        const res = await new AxeBuilder({ page }).include('#editor').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map(v => v.id)).toEqual([]);
      });
    });
  }
}
