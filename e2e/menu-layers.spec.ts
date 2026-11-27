import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const MENUS: [RegExp, RegExp][] = [
  [/^Проект: .*Сменить проект$/, /^Проект: /],
  [/^Настройки и обучение$/, /^Настройки и обучение$/],
  [/^Инструменты$/, /^Инструменты$/],
  [/^Порядок групп/, /^Порядок групп/],
  [/^Добавить группу$/, /^Добавить в проект$/]
];

const start = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '9');
  });
  await page.goto('/');
  await expect(page.getByRole('toolbar', { name: 'Отбор и порядок групп' }).first()).toBeVisible();
};

const hidden = (menu: Locator) => menu.evaluate(el => {
  const r = el.getBoundingClientRect();
  const miss: string[] = [];
  for (let fx = 0.1; fx < 1; fx += 0.2) {
    for (let fy = 0.1; fy < 1; fy += 0.2) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) miss.push('outside the screen');
      else {
        const top = document.elementFromPoint(x, y);
        if (!top || !el.contains(top)) miss.push('under ' + (top?.closest('[class]')?.className || top?.tagName || 'nothing'));
      }
    }
  }
  return miss;
});

const checkAll = async (page: Page) => {
  let opened = 0;
  for (const [button, menu] of MENUS) {
    await page.mouse.wheel(0, -5000);
    const trigger = page.getByRole('button', { name: button }).filter({ visible: true }).first();
    if (!(await trigger.count())) continue;
    await trigger.click();
    const list = page.getByRole('menu', { name: menu });
    await expect(list).toBeVisible();
    await expect(list.getByRole('menuitem').first()).toBeFocused();
    await expect.poll(() => hidden(list), { message: String(button) }).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    opened++;
  }
  expect(opened).toBeGreaterThanOrEqual(2);
};

test('меню открываются поверх шапки, вкладок и кнопки «+» и не выходят за экран', async ({ page }) => {
  await start(page);
  await checkAll(page);
});

test('в тёмной теме меню тоже лежат поверх всего экрана', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page);
  await checkAll(page);
});

for (const [name, width, height] of [['телефоне 320 × 640', 320, 640], ['телефоне в ландшафте 740 × 360', 740, 360], ['телефоне в ландшафте 844 × 390', 844, 390], ['планшете 820 × 1180', 820, 1180]] as const) {
  test.describe(name, () => {
    test.use({ viewport: { width, height } });

    test(`меню видны целиком на ${name}`, async ({ page }) => {
      await start(page);
      await checkAll(page);
    });
  });
}

test('меню «Ещё действия» в карточке группы не обрезается колонкой', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page);
  await page.getByRole('button', { name: /Розетки: спальня/ }).filter({ visible: true }).first().click();
  const more = page.getByRole('button', { name: 'Ещё действия' }).filter({ visible: true }).first();
  await more.scrollIntoViewIfNeeded();
  await more.click();
  const list = page.getByRole('menu', { name: 'Действия с группой' });
  await expect(list).toBeVisible();
  await expect.poll(() => hidden(list)).toEqual([]);
});
