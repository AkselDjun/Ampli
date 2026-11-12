import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const brokenWords = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const span of document.querySelectorAll<HTMLElement>('.seg span')) {
      if (!span.getClientRects().length) continue;
      const text = span.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) continue;
      const s = text.textContent ?? '';
      let i = 0;
      for (const w of s.split(/(\s+)/)) {
        if (w.trim()) {
          const r = document.createRange();
          r.setStart(text, i);
          r.setEnd(text, i + w.length);
          const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top)));
          if (lines.size > 1) out.push(w);
        }
        i += w.length;
      }
    }
    return out;
  });

test.use({ viewport: { width: 320, height: 640 } });

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
});

test('never splits a word inside a segmented option on a 320 px phone', async ({ page }) => {
  await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
  await page.locator('#editor .fold-in > .why-t', { hasText: 'Дополнительно' }).click();
  const relay = page.getByRole('radiogroup').filter({ hasText: 'Приоритетная' });
  await expect(relay).toHaveAttribute('data-stack', '');
  const opts = relay.locator('label');
  const a = await opts.nth(0).boundingBox();
  const b = await opts.nth(1).boundingBox();
  expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height - 1);
  expect(Math.round(a!.height)).toBeGreaterThanOrEqual(44);
  expect(await brokenWords(page)).toEqual([]);

  await page.getByRole('button', { name: 'Готово' }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Параметры сети');
  await page.keyboard.press('Enter');
  const net = page.locator('[role="dialog"]:visible').last();
  await net.getByText('Для точного расчёта').click();
  await expect(net.getByRole('radiogroup').filter({ hasText: 'FRLS' }).first()).toBeVisible();
  expect(await brokenWords(page)).toEqual([]);
});

test.describe('with wider glyphs', () => {
  test.use({ bypassCSP: true });
  test('keeps the group type words whole on a 320 px phone', async ({ page }) => {
    await page.addStyleTag({ content: '*{letter-spacing:.6px !important}' });
    await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
    await expect(page.getByRole('radiogroup').filter({ hasText: 'Мощный' }).first()).toBeVisible();
    expect(await brokenWords(page)).toEqual([]);
  });
});
