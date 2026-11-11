import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { EstimateView, approveText } from '../../ui/EstimateView';
import { LIB_KEY } from '../../store/lib';
import { sampleProject } from '../../core/project';
import { TIERS, tierPriceNames } from '../../core/tiers';
import { unpackEstimate } from '../../core/share';
import type { EstimateShare } from '../../core/share';
import { change, click, dlg, wide } from '../ui/util';
import { stored } from '../stored';

vi.mock('../../ui/download', () => ({ download: vi.fn() }));

const nav = () => document.querySelector('nav.tabs') as HTMLElement;
const openEstimate = () => {
  click(nav(), /Отчёт/);
  const d = dlg('Отчёт и спецификация');
  fireEvent.click(within(d).getByRole('tab', { name: 'Смета', hidden: true }));
  return d;
};
const setClip = (impl: () => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(impl) }, configurable: true });
  return (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> }).writeText;
};
const prices = (): Record<string, number> => {
  const out: Record<string, number> = {};
  tierPriceNames(sampleProject()).forEach(n => { out[n] = 10; });
  return out;
};

afterEach(() => {
  window.location.hash = '';
});

describe('Estimate tiers in the report', () => {
  it('is off by default and the client link has no tiers', async () => {
    const write = setClip(() => Promise.resolve());
    wide(false);
    render(<App />);
    const d = openEstimate();
    expect(d.querySelector('.tiers')).toBeNull();
    await act(async () => { click(d, /Ссылка для клиента/); });
    const url = write.mock.calls[0][0] as string;
    expect(unpackEstimate(url.slice(url.indexOf('#e=') + 3))?.tiers).toBeUndefined();
  });

  it('shows three tiers, applies one to the project and puts markups in the link', async () => {
    localStorage.setItem(LIB_KEY, JSON.stringify({ prices: prices() }));
    const write = setClip(() => Promise.resolve());
    render(<App />);
    const d = openEstimate();
    fireEvent.click(within(d).getByLabelText('Показывать варианты в ссылке для клиента'));
    expect(d.querySelectorAll('.tier')).toHaveLength(3);
    change(within(d).getByLabelText('Наценка «Максимум», %') as HTMLInputElement, '30');
    expect(JSON.parse(localStorage.getItem(LIB_KEY) as string).tiers).toEqual({ on: true, markup: [0, 0, 30] });
    await act(async () => { click(d, /Ссылка для клиента/); });
    const url = write.mock.calls[0][0] as string;
    const e = unpackEstimate(url.slice(url.indexOf('#e=') + 3)) as EstimateShare;
    expect(e.tiers).toEqual([0, 0, 30]);
    expect(Object.keys(e.prices).some(n => n.startsWith('УЗИП'))).toBe(true);
    fireEvent.click(within(d.querySelector('.tiers') as HTMLElement).getByLabelText(/Надёжный/));
    click(d, 'Применить «Надёжный» к проекту');
    expect(stored().list[0].cfg).toMatchObject({ vr: 'on', spd: 'on' });
  });
});

describe('Client estimate with tiers', () => {
  const share = (o: Partial<EstimateShare> = {}): EstimateShare => ({
    p: sampleProject(),
    prices: prices(),
    labor: {},
    company: '',
    contacts: '',
    at: 0,
    tiers: [0, 0, 50],
    ...o
  });

  it('starts on the middle tier and switches totals', () => {
    render(<EstimateView data={share()} onClose={() => undefined} />);
    const v = document.querySelector('.est-view') as HTMLElement;
    const radios = within(v.querySelector('.tiers') as HTMLElement).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map(r => r.value)).toEqual(['base', 'safe', 'max']);
    expect(radios[1].checked).toBe(true);
    const total = () => v.querySelector('.tot-all dd')?.textContent;
    const mid = total();
    expect(v.querySelector('.tier.on .tier-sum')?.textContent).toBe(mid);
    fireEvent.click(radios[2]);
    expect(total()).not.toBe(mid);
    expect(v.querySelector('.tier.on .tier-sum')?.textContent).toBe(total());
    expect(v.textContent).toContain('УЗДП');
  });

  it('shows the plain estimate for old links', () => {
    render(<EstimateView data={share({ tiers: undefined })} onClose={() => undefined} />);
    expect(document.querySelector('.tiers')).toBeNull();
  });

  it('names the chosen tier in the approval text', () => {
    expect(approveText(share(), 10, 5, 'u', TIERS[1])).toContain('вариант «Надёжный»');
    expect(approveText(share(), 10, 5, 'u')).not.toContain('вариант');
  });
});
