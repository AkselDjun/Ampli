import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.setConfig({ testTimeout: 60000 });

afterEach(() => {
  window.location.hash = '';
});

const fresh = async () => {
  vi.resetModules();
  const codec = await import('../../ui/linkCodec');
  const { App } = await import('../../ui/App');
  const util = await import('../ui/util');
  return { codec, App, util };
};

describe('links open before the compression code is loaded', () => {
  it('opens a shared project once the codec arrives', async () => {
    const { packProject, SHARE_PREFIX } = await import('../../core/share');
    const { newProject } = await import('../../core/project');
    const { defaultCfg, mkLine } = await import('../../core/templates');
    const p = newProject({ sample: false, cfg: defaultCfg(), lines: [mkLine('Кухня', 'socket', 10, [['Чайник', 2200, 1]])] }, 'Объект по ссылке');
    window.location.hash = SHARE_PREFIX + packProject(p);
    const { codec, App, util } = await fresh();
    expect(codec.getCodec()).toBeNull();
    render(<App />);
    expect(document.querySelector('.tour')).toBeNull();
    await waitFor(() => expect(util.isOpen('Присланный проект')).toBe(true));
    expect(util.dlg('Присланный проект').textContent).toContain('Объект по ссылке');
    expect(codec.getCodec()).not.toBeNull();
  });

  it('reports a broken link after loading the codec', async () => {
    window.location.hash = '#e=v1.garbage';
    const { codec, App, util } = await fresh();
    expect(codec.getCodec()).toBeNull();
    render(<App />);
    await waitFor(() => expect(util.toastText()).toContain('Ссылка повреждена'));
    expect(window.location.hash).toBe('');
  });

  it('clears an estimate view when the hash leaves without loading the codec', async () => {
    const { codec, App } = await fresh();
    render(<App />);
    window.location.hash = '#other';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(codec.getCodec()).toBeNull();
    expect(document.querySelector('.est-view')).toBeNull();
  });
});
