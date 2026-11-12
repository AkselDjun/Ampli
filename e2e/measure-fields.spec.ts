import { expect, test } from '@playwright/test';

test('shows the norm once in an empty measurement field and keeps the field looking editable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Найти действие или группу' }).fill('Замеры на щитке');
  await page.keyboard.press('Enter');
  const form = page.locator('[role="dialog"]:visible .pm').last();
  await expect(form).toBeVisible();
  const input = form.locator('.pm-in input').first();
  await expect(input).toHaveAttribute('placeholder', /^норма (до|от) /);
  const norm = form.locator('.pm-norm').first();
  await expect(norm).toBeHidden();
  const look = await input.evaluate(el => {
    const field = getComputedStyle(document.documentElement).getPropertyValue('--field').trim();
    const probe = document.createElement('div');
    probe.style.background = field;
    document.body.append(probe);
    const want = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { bg: getComputedStyle(el).backgroundColor, want, opacity: getComputedStyle(el, '::placeholder').opacity };
  });
  expect(look.bg).toBe(look.want);
  expect(look.opacity).toBe('1');
  await input.fill('0,5');
  await expect(norm).toBeVisible();
});
