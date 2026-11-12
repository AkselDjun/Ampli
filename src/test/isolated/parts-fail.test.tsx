import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

vi.setConfig({ testTimeout: 60000 });

afterEach(() => {
  window.location.hash = '';
  vi.doUnmock('../../core/share');
});

describe('a part of the app that fails to load', () => {
  it('tells the user, renders nothing and loads again on the next open', async () => {
    vi.resetModules();
    const { part, PART_FAIL_TEXT } = await import('../../ui/parts');
    const { currentToast } = await import('../../ui/toast');
    let tries = 0;
    const Sheet = part(async () => {
      tries += 1;
      if (tries === 1) throw new TypeError('Failed to fetch dynamically imported module');
      return () => <p>Отчёт открыт</p>;
    });
    const view = () => (
      <Suspense fallback={<p>Загрузка</p>}>
        <Sheet />
      </Suspense>
    );
    const first = render(view());
    await waitFor(() => expect(currentToast()?.text).toBe(PART_FAIL_TEXT));
    expect(currentToast()?.tone).toBe('bad');
    expect(currentToast()?.label).toBe('Перезагрузить');
    expect(screen.queryByText('Загрузка')).toBeNull();
    expect(tries).toBe(1);
    first.unmount();
    render(view());
    await screen.findByText('Отчёт открыт');
    expect(tries).toBe(2);
  });

  it('does not complain when only the background preload fails', async () => {
    vi.resetModules();
    const { part } = await import('../../ui/parts');
    const { currentToast } = await import('../../ui/toast');
    let tries = 0;
    const Sheet = part(async () => {
      tries += 1;
      if (tries === 1) throw new TypeError('offline');
      return () => <p>Щиток открыт</p>;
    });
    await act(async () => { await Sheet.preload().catch(() => undefined); });
    expect(currentToast()).toBeNull();
    render(<Suspense fallback={null}><Sheet /></Suspense>);
    await screen.findByText('Щиток открыт');
  });
});

describe('a shared link when the link code fails to load', () => {
  it('says the link could not be opened', async () => {
    window.location.hash = '#p=v1.abc';
    vi.resetModules();
    vi.doMock('../../core/share', () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    const { App } = await import('../../ui/App');
    const { LINK_FAIL_TEXT } = await import('../../ui/linkCodec');
    const { currentToast } = await import('../../ui/toast');
    render(<App />);
    await waitFor(() => expect(currentToast()?.text).toBe(LINK_FAIL_TEXT));
  });
});
