import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, THEME_LABEL, THEME_ORDER, applyTheme, loadTheme, nextTheme, saveTheme } from '../../ui/theme';
import { PHOTO_MAX_SIDE, fitSide, scalePhoto } from '../../ui/photoScale';
import { download } from '../../ui/download';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('loads, saves and cycles', () => {
    expect(loadTheme()).toBe('auto');
    saveTheme('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(loadTheme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'light');
    expect(loadTheme()).toBe('light');
    localStorage.setItem(THEME_KEY, 'weird');
    expect(loadTheme()).toBe('auto');
    expect(THEME_ORDER.map(nextTheme)).toEqual(['light', 'dark', 'auto']);
    expect(THEME_LABEL.auto).toContain('системе');
  });
  it('applies theme to the root', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
  it('survives storage failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadTheme()).toBe('auto');
    expect(() => saveTheme('dark')).not.toThrow();
  });
});

describe('fitSide', () => {
  it('handles degenerate, small and large sizes', () => {
    expect(fitSide(0, 5)).toEqual({ w: 0, h: 0 });
    expect(fitSide(5, 0)).toEqual({ w: 0, h: 0 });
    expect(fitSide(100, 50)).toEqual({ w: 100, h: 50 });
    expect(fitSide(2560, 1280)).toEqual({ w: PHOTO_MAX_SIDE, h: 640 });
    expect(fitSide(1000, 5000)).toEqual({ w: 256, h: PHOTO_MAX_SIDE });
    expect(fitSide(100000, 1)).toEqual({ w: PHOTO_MAX_SIDE, h: 1 });
    expect(fitSide(400, 400, 100)).toEqual({ w: 100, h: 100 });
  });
});

describe('scalePhoto', () => {
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
  const stub = (err: boolean) => {
    class Img {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 2560;
      naturalHeight = 1280;
      set src(_v: string) { setTimeout(() => (err ? this.onerror?.() : this.onload?.()), 0); }
    }
    vi.stubGlobal('Image', Img);
  };
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non images without decoding', async () => {
    await expect(scalePhoto(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('not an image');
    expect(URL.createObjectURL).toBeDefined();
  });
  it('rejects on decode error', async () => {
    stub(true);
    await expect(scalePhoto(file)).rejects.toThrow('decode failed');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it('rejects without a canvas context', async () => {
    stub(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(scalePhoto(file)).rejects.toThrow('no canvas');
  });
  it('rejects when encoding yields null', async () => {
    stub(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => cb(null));
    await expect(scalePhoto(file)).rejects.toThrow('encode failed');
  });
  it('resolves with the encoded blob at the scaled size', async () => {
    stub(false);
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    const out = new Blob(['j'], { type: 'image/jpeg' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type, q) => {
      expect(type).toBe('image/jpeg');
      expect(q).toBe(0.75);
      cb(out);
    });
    await expect(scalePhoto(file)).resolves.toBe(out);
    expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 1280, 640]);
  });
});

describe('download', () => {
  it('clicks a temporary link and revokes the url later', () => {
    vi.useFakeTimers();
    let seen: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      seen = this;
    });
    download('f.csv', 'a,b', 'text/csv');
    expect(seen).not.toBeNull();
    expect((seen as unknown as HTMLAnchorElement).download).toBe('f.csv');
    expect((seen as unknown as HTMLAnchorElement).href).toContain('blob:test/');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    download('b.bin', new Uint8Array([1]), 'application/octet-stream');
  });
});
