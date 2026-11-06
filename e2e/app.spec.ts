import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const errors = (page: Page): string[] => {
  const list: string[] = [];
  page.on('pageerror', e => list.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') list.push(m.text());
  });
  return list;
};

const noSideScroll = async (page: Page) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
};

const rows = (page: Page) => page.locator('.rows .row');

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript((showTour: boolean) => {
    const w = window as unknown as { printed: number };
    w.printed = 0;
    if (!showTour) localStorage.setItem('ampli-onboarding-v1', 'done');
    window.print = () => {
      w.printed += 1;
    };
  }, testInfo.title.includes('first-run tour'));
});

test('first-run tour explains the workflow and can be reopened', async ({ page }) => {
  await page.goto('/');
  const tour = page.locator('.tour-card');
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('шаг 1 из 6');
  for (let i = 0; i < 5; i += 1) await tour.getByRole('button', { name: 'Далее' }).click();
  await expect(tour).toContainText('Щиток, приёмка и отчёт');
  await tour.getByRole('button', { name: 'Все возможности' }).click();
  await expect(tour).toContainText('шаг 1 из 7');
  for (let i = 0; i < 6; i += 1) await tour.getByRole('button', { name: 'Далее' }).click();
  await expect(tour).toContainText('Проекты и обмен данными');
  await tour.getByRole('button', { name: 'Готово' }).click();
  await expect(tour).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ampli-onboarding-v1'))).toBe('done');
  await page.getByRole('button', { name: 'Открыть обучение' }).click();
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('Обучение Ampli');
  await tour.getByRole('button', { name: /Быстрый старт/ }).click();
  await tour.getByRole('button', { name: 'Пропустить' }).click();
});

test('opens the sample apartment with groups and totals', async ({ page }) => {
  const errs = errors(page);
  await page.goto('/');
  await expect(rows(page).first()).toBeVisible();
  expect(await rows(page).count()).toBeGreaterThan(5);
  await expect(page.locator('.hud')).toContainText('кВт');
  await noSideScroll(page);
  expect(errs).toEqual([]);
});

test('adds a socket group and keeps it after reload', async ({ page, isMobile }) => {
  await page.goto('/');
  const n0 = await rows(page).count();
  await page.getByRole('button', { name: isMobile ? 'Добавить группу' : '+ Добавить группу' }).click();
  await page.getByRole('menuitem', { name: 'Розетки' }).click();
  await expect(rows(page)).toHaveCount(n0 + 1);
  await page.reload();
  await expect(rows(page)).toHaveCount(n0 + 1);
});

test('edits a group and recalculates the breaker', async ({ page }) => {
  await page.goto('/');
  await rows(page).first().click();
  const ed = page.locator('[aria-label="Редактор группы"]');
  await expect(ed).toBeVisible();
  await ed.getByRole('textbox', { name: 'Название группы' }).fill('Проверка');
  const res = ed.locator('.ed-res');
  const before = await res.textContent();
  await ed.getByRole('textbox', { name: 'Мощность, Вт' }).first().fill('3500');
  await expect(res).not.toHaveText(before ?? '');
  await expect(res).toContainText('Автомат');
  await noSideScroll(page);
});

test('opens the report with every tab and prints it', async ({ page }) => {
  const errs = errors(page);
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Отчёт и спецификация');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Отчёт и спецификация' });
  await expect(sheet).toBeVisible();
  for (const t of ['Группы', 'Схема', 'Смета', 'Допущения']) {
    await sheet.getByRole('tab', { name: t }).click();
    await expect(sheet.getByRole('tab', { name: t })).toHaveAttribute('aria-selected', 'true');
    await noSideScroll(page);
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Печать отчёта');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  expect(errs).toEqual([]);
});

test('prepares a Viber and Telegram message for the client estimate link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Проекты');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Проекты' });
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  await sheet.getByRole('button', { name: 'Отправить в Viber или Telegram' }).click();
  await expect(sheet.getByLabel('Текст сообщения')).toHaveValue(/#p=v1\./);
  await expect(sheet.locator('a.send-viber')).toHaveAttribute('href', /^viber:\/\/forward\?text=/);
  await expect(sheet.locator('a.send-tg')).toHaveAttribute('href', /^https:\/\/t\.me\/share\/url\?url=/);
  await noSideScroll(page);
});

test('enters a measurement in panel mode', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('На щитке');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'На щитке' });
  await expect(sheet).toBeVisible();
  await sheet.locator('.pmb-dev.k-mcb, .pmb-dev.k-rcd').first().click();
  const card = sheet.locator('section.pm');
  await expect(card).toBeVisible();
  const field = card.locator('input[inputmode="decimal"]').first();
  await field.fill('0,4');
  await expect(field).toHaveValue('0,4');
  await noSideScroll(page);
});
