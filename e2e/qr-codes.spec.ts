import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const done = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('ampli-onboarding-v1', 'done');
    localStorage.setItem('ampli-onboarding-fresh', '9');
    for (const c of ['calc', 'build', 'docs']) localStorage.setItem('ampli-chapter-hint-' + c, '1');
  });
};
const sheet = (page: Page) => page.locator('.sheet:not([hidden])');

for (const scheme of ['light', 'dark'] as const) {
  test(`показывает QR-код ссылки на проект на белом фоне, тема ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await done(page);
    await page.goto('/');
    await expect(page.locator('.rows .row').first()).toBeVisible();
    await page.getByRole('button', { name: 'Проекты' }).first().click();
    await sheet(page).getByRole('tab', { name: 'Обмен и данные' }).click();
    const btn = sheet(page).getByRole('button', { name: 'QR-код' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    const qr = sheet(page).getByRole('img', { name: 'QR-код проекта' });
    await expect(qr).toBeVisible();
    expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(160);
    const colors = await qr.evaluate(el => [getComputedStyle(el.querySelector('rect')!).fill, getComputedStyle(el.querySelector('path')!).fill]);
    expect(colors[0]).toBe('rgb(255, 255, 255)');
    expect(colors[1]).not.toBe(colors[0]);
    const res = await new AxeBuilder({ page }).include('.sheet:not([hidden])').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map(v => v.id)).toEqual([]);
    await btn.click();
    await expect(qr).toHaveCount(0);
  });
}

test('печатает паспорт владельца с QR-кодом для дверцы щитка', async ({ page }) => {
  await done(page);
  await page.goto('/#work/docs');
  await expect(sheet(page).getByRole('heading', { name: 'Паспорт для владельца' })).toBeVisible();
  await page.evaluate(() => { window.print = () => undefined; });
  await sheet(page).getByRole('button', { name: 'Печать паспорта' }).click();
  await page.emulateMedia({ media: 'print' });
  const doc = page.locator('.printdoc');
  await expect(doc.getByText('Паспорт электрощита', { exact: true })).toBeVisible();
  await expect(doc.getByText('Наведите камеру телефона, чтобы открыть этот паспорт на экране.')).toBeVisible();
  await expect(doc.locator('svg[aria-label="QR-код паспорта"] path')).toHaveCount(1);
});

test('в окне «Комнаты» нет кнопки диктовки', async ({ page, isMobile }) => {
  await done(page);
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.getByRole('button', { name: isMobile ? 'Добавить группу' : '+ Добавить группу' }).click();
  await page.getByRole('menuitem', { name: 'Из комнат' }).click();
  const rooms = page.getByRole('dialog', { name: 'Комнаты' });
  await rooms.getByRole('button', { name: 'Из сообщения клиента' }).click();
  await expect(rooms.getByLabel('Комнаты и приборы текстом')).toBeVisible();
  await expect(page.getByRole('button', { name: /Диктовать/ })).toHaveCount(0);
});
