import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Box = { where: string; kind: string; h: number; pl: number; bw: number; r: number; fs: number };

const measure = async (page: Page, where: string): Promise<Box[]> =>
  page.evaluate(w => {
    const skip = '.seg input, .step input, .search input, .pal-in input, .pm-in input, input.ed-name';
    const top = document.querySelector('[role="dialog"]:not([hidden] *)') ?? document;
    return [...top.querySelectorAll<HTMLElement>('input, select, textarea')]
      .filter(e => !['checkbox', 'radio', 'hidden', 'file', 'range', 'color'].includes((e as HTMLInputElement).type) && !e.matches(skip) && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0)
      .map(e => {
        const s = getComputedStyle(e);
        const kind = e.matches('.tcalc input, .photo-list input, input.price-in') ? 'compact' : e.tagName === 'TEXTAREA' ? 'area' : 'field';
        return { where: w + ' ' + (e.getAttribute('aria-label') ?? e.className ?? e.tagName), kind, h: Math.round(e.getBoundingClientRect().height), pl: parseFloat(s.paddingLeft), bw: parseFloat(s.borderTopWidth), r: parseFloat(s.borderTopLeftRadius), fs: parseFloat(s.fontSize) };
      });
  }, where);

const palette = async (page: Page, text: string) => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill(text);
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="dialog"]:visible').last()).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
});

test('gives every text field and select one size on every screen', async ({ page, isMobile }) => {
  const all: Box[] = [];
  await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
  const ed = page.locator('#editor');
  for (const t of ['Дополнительно', 'Замеры и фото']) await ed.locator('.fold-in > .why-t', { hasText: t }).click();
  await ed.getByRole('button', { name: /Ещё действия/ }).click();
  await page.getByRole('menuitem', { name: 'Вставить список текстом' }).click();
  all.push(...(await measure(page, 'editor')));
  if (isMobile) await page.getByRole('button', { name: 'Готово' }).click();

  await palette(page, 'Параметры сети');
  all.push(...(await measure(page, 'net')));

  await palette(page, 'Собрать группы из комнат');
  await page.locator('[role="dialog"]:visible .chip').first().click();
  all.push(...(await measure(page, 'rooms')));

  await palette(page, 'Смета: работы и материалы');
  all.push(...(await measure(page, 'estimate')));

  await palette(page, 'Приёмка');
  const work = page.locator('[role="dialog"]:visible').last();
  await work.getByRole('tab', { name: 'Замеры' }).click();
  await work.locator('summary', { hasText: 'Данные протокола' }).click();
  all.push(...(await measure(page, 'work')));

  await palette(page, 'Мои данные');
  all.push(...(await measure(page, 'my')));

  const h = isMobile ? 48 : 44;
  const hs = isMobile ? 44 : 36;
  expect(all.length).toBeGreaterThan(20);
  const off = all.filter(b => b.bw !== 1 || b.r !== 12 || b.pl !== 12 || (b.kind === 'field' && b.h !== h) || (b.kind === 'compact' && b.h !== hs) || (b.kind === 'area' && b.h < h * 2) || b.fs !== (isMobile ? 16 : 15));
  expect(off).toEqual([]);
});

test('keeps the search box and steppers at field height', async ({ page, isMobile }) => {
  await page.locator('.rows .row').filter({ hasText: 'Варочная' }).first().click();
  const ed = page.locator('#editor');
  const h = isMobile ? 48 : 44;
  for (const sel of ['.search', '.len-f .step', '.a-n .step']) {
    const box = await ed.locator(sel).first().boundingBox();
    expect(Math.round(box?.height ?? 0), sel).toBe(h);
  }
  const name = await ed.locator('.a-name').first().boundingBox();
  const step = await ed.locator('.a-n .step').first().boundingBox();
  expect(Math.round(step?.height ?? 0)).toBe(Math.round(name?.height ?? 0));
});

test('draws every checkbox at one size', async ({ page }) => {
  await palette(page, 'Сравнить варианты');
  const sizes = await page.locator('[role="dialog"]:visible input[type=checkbox]').evaluateAll(list => [...new Set(list.map(e => Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)))]);
  expect(sizes).toEqual(['20x20']);
});
