import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { sample } from '../src/core/templates';
import { newProject } from '../src/core/project';
import { nid } from '../src/core/ids';
import type { Project } from '../src/core/types';

const CPU_SLOWDOWN = 4;

const BUDGET = {
  loadDom: 8700,
  loadLongestTask: 2000,
  loadBlocking: 2500,
  typingEvent: 250,
  reportClick: 1200,
  reportDom: 20000,
  saveMs: 60
};

type Probe = { long: number[]; events: [string, number][]; saves: number[] };

const bigProject = (copies: number, name: string): Project => {
  const s = sample();
  const lines = [];
  for (let i = 0; i < copies; i++) for (const l of s.lines) lines.push({ ...l, id: nid(), apps: l.apps.map(a => ({ ...a, id: nid() })) });
  return newProject({ ...s, lines, sample: false }, name);
};

const big = bigProject(10, 'Коттедж');
const oneBig = JSON.stringify({ cur: big.id, list: [big] });
const manyProjects = JSON.stringify({ cur: big.id, list: [big, ...Array.from({ length: 29 }, (_, i) => bigProject(4, 'Объект ' + (i + 1)))] });

const open = async (page: Page, store: string) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.addInitScript(data => {
    if (!sessionStorage.getItem('perf-seeded')) {
      localStorage.setItem('ampli-v1', data);
      sessionStorage.setItem('perf-seeded', '1');
    }
    const probe: Probe = { long: [], events: [], saves: [] };
    (window as unknown as { probe: Probe }).probe = probe;
    new PerformanceObserver(l => l.getEntries().forEach(e => probe.long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => probe.events.push([e.name, e.duration]))).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      const t = performance.now();
      set.call(this, k, v);
      if (k === 'ampli-v1') probe.saves.push(performance.now() - t);
    };
  }, store);
  await page.goto('/');
  await expect(page.locator('.rows .row')).toHaveCount(big.lines.length);
};

const probe = (page: Page) => page.evaluate(() => (window as unknown as { probe: Probe }).probe);
const reset = (page: Page) => page.evaluate(() => {
  const p = (window as unknown as { probe: Probe }).probe;
  p.long.length = 0;
  p.events.length = 0;
  p.saves.length = 0;
});
const domSize = (page: Page) => page.evaluate(() => document.getElementsByTagName('*').length);
const note = (info: TestInfo, values: Record<string, number>) =>
  info.annotations.push({ type: 'perf', description: Object.entries(values).map(([k, v]) => `${k}=${Math.round(v)}`).join(' ') });

test('loads a 140-group project within the main thread budget', async ({ page }, info) => {
  await open(page, oneBig);
  await page.waitForTimeout(2000);
  const p = await probe(page);
  const dom = await domSize(page);
  const longest = Math.max(0, ...p.long);
  const blocking = p.long.reduce((s, d) => s + Math.max(0, d - 50), 0);
  note(info, { dom, longest, blocking });
  expect(dom, 'DOM elements after load').toBeLessThanOrEqual(BUDGET.loadDom);
  expect(longest, 'longest task during load, ms').toBeLessThanOrEqual(BUDGET.loadLongestTask);
  expect(blocking, 'total blocking time during load, ms').toBeLessThanOrEqual(BUDGET.loadBlocking);
});

test('keeps typing responsive in a 140-group project', async ({ page }, info) => {
  await open(page, oneBig);
  await page.locator('.rows .row').first().click();
  const field = page.locator('[aria-label="Редактор группы"]').getByRole('textbox', { name: 'Мощность, Вт' }).first();
  await field.click();
  await field.press('End');
  await reset(page);
  await field.pressSequentially('1234567890', { delay: 80 });
  await page.waitForTimeout(500);
  const p = await probe(page);
  const worst = Math.max(0, ...p.events.filter(([n]) => /key|input/.test(n)).map(([, d]) => d));
  note(info, { worstKeystroke: worst });
  expect(worst, 'slowest keystroke, ms').toBeLessThanOrEqual(BUDGET.typingEvent);
});

test('opens the report of a 140-group project within budget', async ({ page }, info) => {
  await open(page, oneBig);
  await page.waitForTimeout(2500);
  await reset(page);
  await page.locator('nav.tabs').getByRole('button', { name: 'Отчёт' }).click();
  await expect(page.getByRole('dialog', { name: 'Отчёт и спецификация' })).toBeVisible();
  await page.waitForTimeout(500);
  const p = await probe(page);
  const click = Math.max(0, ...p.events.filter(([n]) => /click|pointer/.test(n)).map(([, d]) => d));
  const dom = await domSize(page);
  note(info, { click, dom });
  expect(click, 'report open response, ms').toBeLessThanOrEqual(BUDGET.reportClick);
  expect(dom, 'DOM elements with the report open').toBeLessThanOrEqual(BUDGET.reportDom);
});

test('saves a keystroke with 30 stored projects within budget', async ({ page }, info) => {
  await open(page, manyProjects);
  await page.locator('.rows .row').first().click();
  const field = page.locator('[aria-label="Редактор группы"]').getByRole('textbox', { name: 'Название группы' });
  await field.click();
  await field.press('End');
  await reset(page);
  await field.pressSequentially('абвгд', { delay: 80 });
  await page.waitForTimeout(500);
  const p = await probe(page);
  expect(p.saves.length, 'saves recorded').toBeGreaterThan(0);
  const avg = p.saves.reduce((s, d) => s + d, 0) / p.saves.length;
  note(info, { saves: p.saves.length, avgSave: avg });
  expect(avg, 'average save, ms').toBeLessThanOrEqual(BUDGET.saveMs);
});
