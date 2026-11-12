import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Win = { cspHits: string[]; printed: number };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Win;
    localStorage.setItem('ampli-onboarding-v1', 'done');
    w.cspHits = [];
    w.printed = 0;
    document.addEventListener('securitypolicyviolation', e => w.cspHits.push(e.violatedDirective + ' ' + e.blockedURI));
    window.print = () => {
      w.printed += 1;
    };
  });
});

const hits = (page: Page) => page.evaluate(() => (window as unknown as Win).cspHits);

const palette = async (page: Page, text: string) => {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill(text);
  await page.keyboard.press('Enter');
};

test('ships a content security policy without inline code or eval', async ({ page }) => {
  await page.goto('/');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toContain('unsafe-eval');
});

test('runs the main flows without policy violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.locator('.rows .row').first().click();
  await page.keyboard.press('Escape');
  for (const s of ['Отчёт и спецификация', 'Замеры на щитке', 'Мои данные', 'Параметры сети', 'Тёплый пол', 'Слаботочка: интернет, ТВ, камеры']) {
    await palette(page, s);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
  }
  await palette(page, 'Тёмная тема');
  await palette(page, 'Печать отчёта в PDF');
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).printed)).toBe(1);
  expect(await hits(page)).toEqual([]);
});

test('opens a shared project link without policy violations and keeps the forced theme', async ({ page }) => {
  await page.goto('/');
  await palette(page, 'Проекты');
  const sheet = page.getByRole('dialog', { name: 'Проекты' });
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  await sheet.getByRole('button', { name: 'Отправить в Viber или Telegram' }).click();
  const text = await sheet.getByLabel('Текст сообщения').inputValue();
  const link = (text.match(/https?:\/\/\S+#p=v1\.\S+/) ?? [''])[0];
  expect(link).not.toBe('');
  await page.evaluate(() => localStorage.setItem('ampli-theme', 'dark'));
  await page.goto(link);
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await hits(page)).toEqual([]);
});
