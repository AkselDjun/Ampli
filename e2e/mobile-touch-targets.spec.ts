import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const open = async (page: Page, action: string) => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill(action);
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="dialog"]:visible').last()).toBeVisible();
};

const buttons = (page: Page) =>
  page.evaluate(() => {
    const top = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(d => d.getBoundingClientRect().height > 0).pop() ?? document.body;
    return [...top.querySelectorAll<HTMLElement>('.btn, .bd-help summary, .chk-b')]
      .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
      .map(b => {
        const r = b.getBoundingClientRect();
        return { name: (b.textContent ?? '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), out: r.left < -1 || r.right > innerWidth + 1, cut: b.matches('.btn') && b.scrollWidth > b.clientWidth + 1 };
      });
  });

test.use({ viewport: { width: 320, height: 640 } });

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
});

test('keeps every button inside the screen and at least 44 px high on a 320 px phone', async ({ page }) => {
  const all = [...(await buttons(page))];
  for (const a of ['Собрать группы из комнат', 'Однолинейная схема', 'Проекты', 'Монтаж и приёмка']) {
    await open(page, a);
    all.push(...(await buttons(page)));
  }
  expect(all.length).toBeGreaterThan(8);
  expect(all.filter(b => b.out || b.cut)).toEqual([]);
  expect(all.filter(b => b.h < 44 || b.w < 44)).toEqual([]);
});

test('lets a finger hit the small hint button next to a label', async ({ page }) => {
  await open(page, 'Параметры сети');
  const tip = page.locator('[role="dialog"]:visible .tip-b').first();
  const r = (await tip.boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.tip-b') !== null, [r.x + r.width + 8, r.y - 8]);
  expect(hit).toBe(true);
});
