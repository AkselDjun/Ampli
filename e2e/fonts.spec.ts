import { expect, test } from '@playwright/test';

const SAMPLE = 'Розетки ў і Ё ВВГнг(А)-LS 3×2,5 мм² ΔU 0,9 % cos φ 0,95 Zs ≤ 1,44 Ω ≥ ρ √3 Σ № ← → «» — – … · −';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ampli-onboarding-v1', 'done'));
});

test('renders interface text and electrical symbols with the app font only', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'platform fonts are read through the Chromium protocol');
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.evaluate(async sample => {
    const p = document.createElement('p');
    p.id = 'font-probe';
    p.textContent = sample;
    document.body.append(p);
    await document.fonts.ready;
  }, SAMPLE);
  expect(await page.evaluate(() => document.fonts.check("15px 'Ampli Sans'", 'ΔU φ'))).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#font-probe' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  expect(fonts.map(f => f.familyName)).toEqual(['Ampli Sans']);
});

test('ships one preloaded self-hosted font file', async ({ page }) => {
  const fontUrls: string[] = [];
  page.on('request', r => {
    if (r.resourceType() === 'font') fontUrls.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('.rows .row').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const preload = await page.locator('link[rel="preload"][as="font"]').getAttribute('href');
  expect(preload).toMatch(/ampli-sans-wght-[^/]+\.woff2$/);
  expect(fontUrls.length).toBeGreaterThan(0);
  for (const u of fontUrls) expect(new URL(u).origin).toBe(new URL(page.url()).origin);
  expect(new Set(fontUrls).size).toBe(1);
});
