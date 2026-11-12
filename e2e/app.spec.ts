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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { printed: number };
    w.printed = 0;
    localStorage.setItem('ampli-onboarding-v1', 'done');
    window.print = () => {
      w.printed += 1;
    };
  });
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
  for (const t of ['Группы', 'Схема', 'Смета', 'Основания']) {
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

test('enters a measurement on the panel inside the acceptance sheet', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Замеры на щитке');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Монтаж и приёмка' });
  await expect(sheet).toBeVisible();
  await sheet.locator('.pmb-dev.k-mcb, .pmb-dev.k-rcd').first().click();
  const card = sheet.locator('section.pm');
  await expect(card).toBeVisible();
  const field = card.locator('input[inputmode="decimal"]').first();
  await field.fill('0,4');
  await expect(field).toHaveValue('0,4');
  await noSideScroll(page);
});

test.describe('toast with an action on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });

  test('keeps the message wide and puts the action under it', async ({ page }) => {
    await page.goto('/');
    await expect(rows(page).first()).toBeVisible();
    await page.locator('nav.tabs').getByRole('button', { name: 'Отчёт' }).click();
    const toastCard = page.locator('.toast').filter({ has: page.locator('.toast-a') });
    await expect(toastCard).toBeVisible();
    const text = await toastCard.locator('.toast-t').boundingBox();
    const action = await toastCard.locator('.toast-a').boundingBox();
    expect(text?.width ?? 0).toBeGreaterThanOrEqual(200);
    expect(action?.y ?? 0).toBeGreaterThan((text?.y ?? 0) + (text?.height ?? 0) - 4);
    await noSideScroll(page);
  });
});
