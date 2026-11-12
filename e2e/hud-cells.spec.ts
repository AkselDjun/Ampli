import { expect, test } from '@playwright/test';
import { sample } from '../src/core/templates';
import { newProject } from '../src/core/project';
import { nid } from '../src/core/ids';

const project = () => {
  const s = sample();
  const lines = [];
  for (let i = 0; i < 5; i++) for (const l of s.lines) lines.push({ ...l, id: nid(), apps: l.apps.map(a => ({ ...a, id: nid() })) });
  const p = newProject({ ...s, lines, sample: false, cfg: { ...s.cfg, supply: 3, alloc: 15 } }, 'Коттедж');
  return JSON.stringify({ cur: p.id, list: [p] });
};

for (const width of [360, 390]) {
  test.describe(`header totals on a ${width} px phone`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('shows every totals cell in full on an overloaded project', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone layout');
      await page.addInitScript(data => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('ampli-v1', data);
          sessionStorage.setItem('seeded', '1');
        }
        localStorage.setItem('ampli-onboarding-v1', 'done');
      }, project());
      await page.goto('/');
      await expect(page.locator('.rows .row').first()).toBeVisible();
      const hud = page.locator('button.kpis');
      const box = (await hud.boundingBox())!;
      for (const cell of await hud.locator(':scope > div').all()) {
        const c = (await cell.boundingBox())!;
        expect(c.x + c.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      }
      await expect(hud.locator('.kp-in b')).toHaveClass(/kp-none/);
    });
  });
}
