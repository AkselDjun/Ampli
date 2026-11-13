import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const start = async (page: Page) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
};

for (const width of [320, 375]) {
  test.describe(`phone ${width} px`, () => {
    test.use({ viewport: { width, height: 700 } });

    test('lines up the list view buttons under the heading', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await start(page);
      const head = (await page.locator('.list-head h2').boundingBox())!;
      const hist = (await page.locator('.list-head .hist').boundingBox())!;
      const btns = await page.locator('.list-head .lv-keep, .list-head .lv-link').all();
      expect(btns.length).toBe(2);
      const boxes = await Promise.all(btns.map(async b => (await b.boundingBox())!));
      expect(Math.round(boxes[0].x)).toBe(Math.round(head.x));
      for (const b of boxes) {
        expect(b.y).toBeGreaterThan(head.y + head.height - 1);
        expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
      }
      const right = Math.max(...boxes.map(b => b.x + b.width));
      expect(Math.abs(right - (hist.x + hist.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[1].y + boxes[1].height / 2 - (boxes[0].y + boxes[0].height / 2))).toBeLessThanOrEqual(1);
    });

    test('shows the project name up to the edge of its line', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await start(page);
      const name = page.locator('.pb-name');
      const m = await name.evaluate(e => ({ shown: e.clientWidth, full: e.scrollWidth, slack: (e.parentElement as HTMLElement).clientWidth - e.clientWidth, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) }));
      expect(m.lines).toBe(1);
      expect(m.full).toBeGreaterThan(m.shown);
      expect(m.slack).toBeLessThanOrEqual(1);
    });

    test('puts measurement fields of one row on one line and fits the photo tags', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await start(page);
      await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
      const ed = page.locator('#editor');
      await ed.locator('.fold-in > .why-t', { hasText: 'Замеры и фото' }).click();
      const inputs = await ed.locator('.meas .grid3 input').all();
      expect(inputs.length).toBe(4);
      const ys = await Promise.all(inputs.map(async i => Math.round((await i.boundingBox())!.y)));
      expect(ys[0]).toBe(ys[1]);
      expect(ys[2]).toBe(ys[3]);
      const seg = ed.locator('.photos .seg').first();
      const fit = await seg.evaluate(s => {
        const box = s.getBoundingClientRect();
        const parent = (s.closest('.blk') as HTMLElement).getBoundingClientRect();
        const spans = [...s.querySelectorAll('span')];
        return {
          inside: box.right <= parent.right + 1 && box.left >= parent.left - 1,
          cut: spans.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent),
          hidden: spans.filter(x => { const r = x.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; }).map(x => x.textContent)
        };
      });
      expect(fit.inside).toBe(true);
      expect(fit.cut).toEqual([]);
      expect(fit.hidden).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}
