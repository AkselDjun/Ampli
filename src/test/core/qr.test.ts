import { describe, expect, it } from 'vitest';
import { QR_MARGIN, QR_MAX_BYTES, qrFits, qrShape, qrText } from '../../core/qr';
import { estimateUrl, ownerUrl, shareUrl } from '../../core/share';
import { sampleProject } from '../../core/project';
import { normWork } from '../../core/labor';

const BASE = 'https://akseldjun.github.io/Ampli/';

describe('qr', () => {
  it('draws a square with quiet zone for a short link', () => {
    const s = qrShape(BASE + '#p=abc');
    expect(s).not.toBeNull();
    expect(s!.size).toBe(21 + 4 * 2 + QR_MARGIN * 2);
    expect(s!.path).toMatch(/^M2 2h7v1h-7z/);
    const cells = Array.from(s!.path.matchAll(/M(\d+) (\d+)h(\d+)/g));
    expect(cells.every(([, x, y, w]) => +x >= QR_MARGIN && +y >= QR_MARGIN && +x + +w <= s!.size - QR_MARGIN)).toBe(true);
  });
  it('returns null for empty or too long text', () => {
    expect(qrShape('')).toBeNull();
    expect(qrShape('a'.repeat(QR_MAX_BYTES + 1))).toBeNull();
    expect(qrFits('a'.repeat(QR_MAX_BYTES))).toBe(true);
  });
  it('counts encoded bytes, not characters', () => {
    expect(qrText('a я b')).toBe('a %D1%8F b');
    expect(qrFits('я'.repeat(400))).toBe(false);
    expect(qrShape('я'.repeat(400))).toBeNull();
  });
  it('fits the links of a sample project', () => {
    const p = sampleProject();
    expect(qrShape(shareUrl(p, BASE))).not.toBeNull();
    expect(qrShape(ownerUrl(p, BASE))).not.toBeNull();
    expect(qrFits(estimateUrl({ p, prices: {}, labor: normWork(undefined), company: '', contacts: '', at: 0 }, BASE))).toBe(true);
  });
});
