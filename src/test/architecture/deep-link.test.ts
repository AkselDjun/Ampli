import { describe, expect, it } from 'vitest';
import { isSheetHash, readSheetHash, sheetHash } from '../../app/deepLink';
import { APP_SHEET } from '../../app/types';

describe('section links', () => {
  it('reads the report, acceptance and shopping sections with an optional tab', () => {
    expect(readSheetHash('#report')).toEqual({ sheet: APP_SHEET.REPORT });
    expect(readSheetHash('#report/estimate')).toEqual({ sheet: APP_SHEET.REPORT, tab: 'estimate' });
    expect(readSheetHash('#work/meas')).toEqual({ sheet: APP_SHEET.WORK, tab: 'meas' });
    expect(readSheetHash('#shop')).toEqual({ sheet: APP_SHEET.SHOP });
  });

  it('drops unknown tabs and ignores project links and other hashes', () => {
    expect(readSheetHash('#report/nope')).toEqual({ sheet: APP_SHEET.REPORT });
    expect(readSheetHash('#shop/buy')).toEqual({ sheet: APP_SHEET.SHOP });
    for (const h of ['', '#', '#p=abc', '#e=abc', '#o=abc', '#net', '#REPORT', '#report/estimate/x']) expect(isSheetHash(h)).toBe(false);
  });

  it('writes a hash only for sections that have a link', () => {
    expect(sheetHash(APP_SHEET.REPORT, 'scheme')).toBe('#report/scheme');
    expect(sheetHash(APP_SHEET.WORK)).toBe('#work');
    expect(sheetHash(APP_SHEET.SHOP, 'lists')).toBe('#shop');
    expect(sheetHash(APP_SHEET.NETWORK)).toBe('');
    expect(sheetHash(null)).toBe('');
  });
});
