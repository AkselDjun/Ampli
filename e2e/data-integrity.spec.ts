import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const palette = async (page: Page, text: string) => {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill(text);
  await page.keyboard.press('Enter');
};

const openProjects = async (page: Page) => {
  await palette(page, 'Проекты');
  const sheet = page.getByRole('dialog', { name: 'Проекты' });
  await expect(sheet).toBeVisible();
  return sheet;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
});

test('exports a project, imports it as an independent copy and keeps both after reload', async ({ page }) => {
  await page.goto('/');
  let sheet = await openProjects(page);
  await sheet.getByRole('textbox', { name: 'Название' }).fill('Проект для переноса');
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();

  const downloadPromise = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Сохранить в файл' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ampli-проект-для-переноса.json');
  const path = await download.path();
  expect(path).not.toBeNull();

  await sheet.locator('input[type="file"]').setInputFiles(path as string);
  await expect(page.getByText('Добавлено проектов: 1')).toBeVisible();
  await sheet.getByRole('tab', { name: 'Проекты' }).click();
  await expect(sheet.locator('.pj')).toHaveCount(2);
  await expect(sheet.locator('.pj-name')).toHaveText(['Проект для переноса', 'Проект для переноса 2']);

  await page.reload();
  sheet = await openProjects(page);
  await expect(sheet.locator('.pj')).toHaveCount(2);
  await expect(sheet.locator('.pj-name')).toHaveText(['Проект для переноса', 'Проект для переноса 2']);
});

test('accepts a shared project without replacing local data and persists it', async ({ page }) => {
  await page.goto('/');
  let sheet = await openProjects(page);
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  await sheet.getByRole('button', { name: 'Отправить в Viber или Telegram' }).click();
  const message = await sheet.getByLabel('Текст сообщения').inputValue();
  const link = (message.match(/https?:\/\/\S+#p=v1\.\S+/) ?? [''])[0];
  expect(link).not.toBe('');

  await page.goto(link);
  const incoming = page.getByRole('dialog', { name: 'Присланный проект' });
  await expect(incoming).toContainText('существующие не изменятся');
  await incoming.getByRole('button', { name: 'Добавить проект' }).click();
  await expect(incoming).toBeHidden();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');

  sheet = await openProjects(page);
  await expect(sheet.locator('.pj')).toHaveCount(2);
  await expect(sheet.locator('.pj-name')).toHaveText(['Пример: двухкомнатная квартира', 'Пример: двухкомнатная квартира 2']);
  await page.reload();
  sheet = await openProjects(page);
  await expect(sheet.locator('.pj')).toHaveCount(2);
});

test('rejects malformed files and broken links without changing projects', async ({ page }) => {
  await page.goto('/');
  let sheet = await openProjects(page);
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"ampli", broken')
  });
  await expect(page.getByText('Файл не похож на проект Ampli')).toBeVisible();
  await sheet.getByRole('tab', { name: 'Проекты' }).click();
  await expect(sheet.locator('.pj')).toHaveCount(1);

  await page.goto('/#p=v1.garbage');
  await expect(page.getByText(/Ссылка повреждена или обрезана/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  sheet = await openProjects(page);
  await expect(sheet.locator('.pj')).toHaveCount(1);
});

test('requires confirmation before deleting and always leaves a valid project', async ({ page }) => {
  await page.goto('/');
  let sheet = await openProjects(page);
  const remove = sheet.locator('.pj').getByRole('button', { name: 'Удалить' });
  await remove.click();
  await expect(sheet.locator('.pj')).toHaveCount(1);
  await expect(sheet.locator('.pj').getByRole('button', { name: 'Точно удалить?' })).toBeVisible();
  await sheet.locator('.pj').getByRole('button', { name: 'Точно удалить?' }).click();
  await expect(sheet.locator('.pj')).toHaveCount(1);
  await expect(sheet.locator('.pj-name')).toHaveText('Новый проект');

  await page.reload();
  sheet = await openProjects(page);
  await expect(sheet.locator('.pj')).toHaveCount(1);
  await expect(sheet.locator('.pj-name')).toHaveText('Новый проект');
});

test('persists edited calculation data and measurements after reload', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('ampli-project-revision'));
  await page.locator('.rows .row').first().click();
  await page.getByRole('textbox', { name: 'Название группы' }).fill('Проверка сохранения');
  await page.getByRole('textbox', { name: 'Мощность, Вт' }).first().fill('3500');
  await palette(page, 'Замеры на щитке');
  const panel = page.getByRole('dialog', { name: 'Монтаж и приёмка' });
  await panel.locator('.pmb-dev.k-mcb, .pmb-dev.k-rcd').first().click();
  await panel.locator('section.pm input[inputmode="decimal"]').first().fill('0,4');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ampli-project-revision'))).not.toBe(before);

  await page.reload();
  await expect(page.locator('.rows .row').first()).toContainText('Проверка сохранения');
  await palette(page, 'Замеры на щитке');
  const restored = page.getByRole('dialog', { name: 'Монтаж и приёмка' });
  await restored.locator('.pmb-dev.k-mcb, .pmb-dev.k-rcd').first().click();
  await expect(restored.locator('section.pm input[inputmode="decimal"]').first()).toHaveValue('0,4');
});

test('restores a downloaded backup in a clean browser context', async ({ page, browser, isMobile }) => {
  test.skip(isMobile, 'The backup payload is device-independent; desktop covers the browser API once.');
  await page.goto('/');
  let sheet = await openProjects(page);
  await sheet.getByRole('button', { name: '+ Новый проект' }).click();
  await sheet.getByRole('button', { name: /Пустой проект/ }).click();
  await sheet.getByRole('textbox', { name: 'Название' }).fill('Проект из резервной копии');
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  const downloadPromise = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Сохранить резервную копию' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ampli-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  const cleanContext = await browser.newContext();
  await cleanContext.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  const clean = await cleanContext.newPage();
  await clean.goto(new URL('/', page.url()).href);
  sheet = await openProjects(clean);
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  await sheet.locator('input[type="file"]').setInputFiles(path as string);
  await expect(clean.getByText('Восстановлено проектов: 1')).toBeVisible();
  await sheet.getByRole('tab', { name: 'Проекты' }).click();
  await expect(sheet.locator('.pj-name')).toContainText(['Пример: двухкомнатная квартира', 'Проект из резервной копии']);
  await clean.reload();
  sheet = await openProjects(clean);
  await expect(sheet.locator('.pj-name')).toContainText(['Пример: двухкомнатная квартира', 'Проект из резервной копии']);
  await cleanContext.close();
});

test('blocks a stale tab from overwriting a newer project revision', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'The storage race is browser-wide; desktop covers it once.');
  await page.goto('/');
  await expect(page.locator('.save-indicator')).toContainText('сохранено');
  const stale = await context.newPage();
  await stale.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await stale.goto('/');
  await expect(stale.locator('.save-indicator')).toContainText('сохранено');

  const before = await page.evaluate(() => localStorage.getItem('ampli-project-revision'));
  await page.locator('.rows .row').first().click();
  await page.getByRole('textbox', { name: 'Название группы' }).fill('Изменение из первой вкладки');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ampli-project-revision'))).not.toBe(before);

  await stale.locator('.rows .row').first().click();
  await stale.getByRole('textbox', { name: 'Название группы' }).fill('Устаревшее изменение');
  await expect(stale.locator('.save-indicator')).toContainText('Конфликт вкладок');
  await expect(stale.getByText(/Проект изменён в другой вкладке/)).toBeVisible();

  await stale.reload();
  await expect(stale.locator('.rows .row').first()).toContainText('Изменение из первой вкладки');
  await stale.close();
});

test('restores group photos and wiring traces from a backup in a clean browser context', async ({ page, browser, isMobile }) => {
  test.skip(isMobile, 'The backup payload is device-independent; desktop covers the browser API once.');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
  const openPhotos = async (p: Page) => {
    await p.locator('.rows .row').first().click();
    const fold = p.getByRole('button', { name: /Замеры и фото/ });
    if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
  };

  await page.goto('/');
  await page.locator('.rows .row').first().click();
  await page.getByRole('textbox', { name: 'Название группы' }).fill('Свет со скрытой проводкой');
  await openPhotos(page);
  await page.getByRole('radio', { name: 'Стена' }).check();
  await page.getByTestId('photo-input-line').setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: 'Стена' })).toBeVisible();
  await page.getByRole('button', { name: 'Разметить трассы' }).click();
  const marking = page.getByRole('dialog', { name: 'Разметка трасс' });
  const wall = marking.getByRole('img', { name: /Фото стены/ });
  const box = await wall.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.2);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.7);
  }
  await marking.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: 'Трассы: 1' })).toBeVisible();

  const sheet = await openProjects(page);
  await sheet.getByRole('textbox', { name: 'Название' }).fill('Проект с фото стены');
  await sheet.getByRole('tab', { name: 'Обмен и данные' }).click();
  const downloadPromise = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Сохранить резервную копию' }).click();
  const path = await (await downloadPromise).path();
  expect(path).not.toBeNull();

  const cleanContext = await browser.newContext();
  await cleanContext.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  const clean = await cleanContext.newPage();
  await clean.goto(new URL('/', page.url()).href);
  let restored = await openProjects(clean);
  await restored.getByRole('tab', { name: 'Обмен и данные' }).click();
  await restored.locator('input[type="file"]').setInputFiles(path as string);
  await expect(clean.getByText('Восстановлено проектов: 1')).toBeVisible();
  await restored.getByRole('tab', { name: 'Проекты' }).click();
  await restored.locator('.pj-open', { hasText: 'Проект с фото стены' }).click();

  const check = async () => {
    await openPhotos(clean);
    const img = clean.getByRole('img', { name: 'Стена' });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(clean.getByRole('button', { name: 'Трассы: 1' })).toBeVisible();
  };
  await check();
  await clean.reload();
  restored = await openProjects(clean);
  await restored.locator('.pj-open', { hasText: 'Проект с фото стены' }).click();
  await check();
  await cleanContext.close();
});
