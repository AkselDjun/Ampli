import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { ONBOARDING_STEPS } from '../src/features/onboarding/steps';

const TOTAL = ONBOARDING_STEPS.length;
const FRESH = ONBOARDING_STEPS.filter(s => s.fresh);
const VIEW: Record<string, string> = { estimate: 'report', panel: 'work' };
const card = (page: Page) => page.locator('.tour [role="dialog"]');
const heading = (page: Page) => card(page).locator('h2');

const errors = (page: Page): string[] => {
  const list: string[] = [];
  page.on('pageerror', e => list.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') list.push(m.text());
  });
  return list;
};

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
};

const settled = async (l: Locator) => {
  let prev = '';
  await expect.poll(async () => {
    const b = await l.boundingBox();
    const now = JSON.stringify(b);
    const same = now === prev;
    prev = now;
    return same && !!b;
  }, { intervals: [120, 120, 120, 200, 300] }).toBe(true);
  return box(l);
};

const start = async (page: Page) => {
  await page.goto('/');
  await expect(card(page)).toHaveAccessibleName('Добро пожаловать в Ampli');
  await card(page).getByRole('button', { name: /^Начать ·/ }).click();
  await expect(heading(page)).toHaveText(ONBOARDING_STEPS[0].title);
};

test('greets a first-time visitor without slowing the first screen', async ({ page }) => {
  const errs = errors(page);
  const html = await (await page.request.get('/')).text();
  expect(html).not.toMatch(/Onboarding/);
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  const hello = card(page);
  await expect(hello).toHaveAccessibleName('Добро пожаловать в Ampli');
  await expect(hello.getByRole('button', { name: /^Начать ·/ })).toBeFocused();
  await expect(hello.getByRole('listitem')).toHaveCount(3);
  const b = await settled(hello);
  const vp = page.viewportSize();
  if (!vp) throw new Error('no viewport');
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('highlights every step and never covers the highlighted element', async ({ page }) => {
  const errs = errors(page);
  await start(page);
  const vp = page.viewportSize();
  if (!vp) throw new Error('no viewport');
  for (let i = 0; i < TOTAL; i++) {
    const s = ONBOARDING_STEPS[i];
    await expect(heading(page)).toHaveText(s.title);
    await expect(card(page)).toContainText((i + 1) + ' из ' + TOTAL);
    if (!['home', 'editor', 'wiring'].includes(s.scene)) await expect(page.locator(`[data-tour-view="${VIEW[s.scene] ?? s.scene}"]`)).toBeVisible();
    if (s.fresh) await expect.poll(() => page.evaluate(sel => sel.some(x => [...document.querySelectorAll(x)].some(el => el.getBoundingClientRect().height > 0)), s.targets.slice(0, -1)), s.id).toBe(true);
    const spot = page.locator('.tour-spot');
    await expect(spot, s.id).toBeVisible();
    const sb = await settled(spot);
    const cb = await settled(card(page));
    expect(cb.x, s.id).toBeGreaterThanOrEqual(0);
    expect(cb.y, s.id).toBeGreaterThanOrEqual(0);
    expect(cb.x + cb.width, s.id).toBeLessThanOrEqual(vp.width + 1);
    expect(cb.y + cb.height, s.id).toBeLessThanOrEqual(vp.height + 1);
    expect(sb.width, s.id).toBeGreaterThan(20);
    expect(sb.height, s.id).toBeGreaterThan(20);
    const apart = cb.x >= sb.x + sb.width - 1 || sb.x >= cb.x + cb.width - 1 || cb.y >= sb.y + sb.height - 1 || sb.y >= cb.y + cb.height - 1;
    expect(apart, `${s.id}: card ${JSON.stringify(cb)} covers spot ${JSON.stringify(sb)}`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await card(page).getByRole('button', { name: i === TOTAL - 1 ? 'Завершить' : 'Далее' }).click();
  }
  await expect(card(page)).toHaveAccessibleName('Готово, основное вы знаете');
  await expect(page.locator('.tour-spot')).toHaveCount(0);
  await card(page).getByRole('button', { name: 'Остаться в примере' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  await expect(page.locator('.sheet:not([hidden])')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ampli-onboarding-v1'))).toBe('done');
  expect(errs).toEqual([]);
});

test('turns the finish into the first own project', async ({ page }) => {
  await start(page);
  for (let i = 0; i < TOTAL; i++) await page.keyboard.press('ArrowRight');
  await expect(card(page)).toHaveAccessibleName('Готово, основное вы знаете');
  await card(page).getByRole('button', { name: 'Создать свой проект' }).click();
  await expect(page.getByRole('dialog', { name: 'Комнаты' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Создан проект: Мой объект');
  await page.getByRole('dialog', { name: 'Комнаты' }).getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.locator('.pb-name')).toHaveText('Мой объект');
  await expect(page.locator('.sheet:not([hidden])')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state as { ampliLayer?: boolean } | null)?.ampliLayer);
  await page.reload();
  await expect(page.locator('.pb-name')).toHaveText('Мой объект');
  await expect(page.locator('.tour')).toHaveCount(0);
});

test('works from the keyboard and resumes where the user stopped', async ({ page }) => {
  await page.goto('/');
  await expect(card(page)).toHaveAccessibleName('Добро пожаловать в Ampli');
  await page.keyboard.press('ArrowRight');
  await expect(heading(page)).toHaveText(ONBOARDING_STEPS[0].title);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(heading(page)).toHaveText(ONBOARDING_STEPS[2].title);
  await page.keyboard.press('ArrowLeft');
  await expect(heading(page)).toHaveText(ONBOARDING_STEPS[1].title);
  await expect(card(page).getByRole('button', { name: 'Далее' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card(page).getByRole('button', { name: 'Закрыть обучение' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(card(page).getByRole('button', { name: 'Далее' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.getByRole('button', { name: 'Открыть обучение' }).click();
  await expect(card(page)).toHaveAccessibleName('С возвращением в обучение');
  await expect(card(page).getByRole('button', { name: 'Продолжить с шага 2' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(heading(page)).toHaveText(ONBOARDING_STEPS[1].title);
});

test('shows returning users only what is new', async ({ page }) => {
  const errs = errors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ampli-onboarding-v1', 'done');
  });
  await page.goto('/');
  const toast = page.locator('.toast');
  await expect(toast).toContainText('В Ampli новое');
  await toast.getByRole('button', { name: 'Показать' }).click();
  const vp = page.viewportSize();
  if (!vp) throw new Error('no viewport');
  for (let i = 0; i < FRESH.length; i++) {
    await expect(heading(page)).toHaveText(FRESH[i].title);
    await expect(card(page)).toContainText((i + 1) + ' из ' + FRESH.length);
    await expect(card(page).locator('.tour-chap')).toContainText('Новое');
    const spot = page.locator('.tour-spot');
    await expect(spot, FRESH[i].id).toBeVisible();
    const cb = await settled(card(page));
    expect(cb.y + cb.height, FRESH[i].id).toBeLessThanOrEqual(vp.height + 1);
    await card(page).getByRole('button', { name: i === FRESH.length - 1 ? 'Завершить' : 'Далее' }).click();
  }
  await expect(card(page)).toHaveAccessibleName('Теперь вы знаете всё новое');
  await card(page).getByRole('button', { name: 'Понятно' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByText('В Ampli новое')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the tour without animation', async ({ page }) => {
    await start(page);
    const names = await page.evaluate(() => ['.tour-card', '.tour-body', '.tour-spot'].map(s => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).animationName : 'none';
    }));
    expect(names).toEqual(['none', 'none', 'none']);
  });
});
