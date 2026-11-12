import { expect, test } from '@playwright/test';
import { sample } from '../src/core/templates';
import { newProject } from '../src/core/project';
import { nid } from '../src/core/ids';

const project = () => {
  const s = sample();
  const lines = [];
  for (let i = 0; i < 4; i++) for (const l of s.lines) lines.push({ ...l, id: nid(), name: 'Электроподогревполотенцесушителя' + l.name, apps: l.apps.map(a => ({ ...a, id: nid() })) });
  const p = newProject({ ...s, lines, sample: false, cfg: { ...s.cfg, supply: 3, alloc: 15 } }, 'Коттедж');
  return JSON.stringify({ cur: p.id, list: [p] });
};

test('keeps the power advisor inside the network sheet with long group names', async ({ page }) => {
  await page.addInitScript(data => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('ampli-v1', data);
      sessionStorage.setItem('seeded', '1');
    }
    localStorage.setItem('ampli-onboarding-v1', 'done');
  }, project());
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Параметры сети');
  await page.keyboard.press('Enter');
  const fit = page.locator('.pfit');
  await expect(fit).toBeVisible();
  await fit.getByRole('button', { name: 'Применить' }).first().click();
  await expect(fit.locator('.pfit-now')).toBeVisible();
  const box = (await fit.boundingBox())!;
  const widest = await fit.evaluate(el => Math.max(...[...el.querySelectorAll('*')].map(n => n.getBoundingClientRect().right)));
  expect(widest).toBeLessThanOrEqual(box.x + box.width + 1);
});
