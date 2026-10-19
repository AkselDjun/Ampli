import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { buildXlsx } from '../../core/export';
import { decodeText, gridToOffers, MAX_FILE, parseCsv, parsePrice, parsePriceFile, parseXlsx } from '../../core/pricelist';

const buf = (s: string): ArrayBuffer => strToU8(s).buffer.slice(0) as ArrayBuffer;

describe('parsePrice', () => {
  it('reads common price formats', () => {
    expect(parsePrice('12,50')).toBe(12.5);
    expect(parsePrice('1 250,00 BYN')).toBe(1250);
    expect(parsePrice('1.250,75')).toBe(1250.75);
    expect(parsePrice('1,250.75')).toBe(1250.75);
    expect(parsePrice('12.5')).toBe(12.5);
  });
  it('rejects empty, zero and absurd values', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('нет')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('99999999999')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('detects semicolons, tabs and commas', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quotes, escaped quotes, CRLF and blank lines', () => {
    expect(parseCsv('n;p\r\n"Авто; мат ""X""";5\r\n\r\n')).toEqual([['n', 'p'], ['Авто; мат "X"', '5']]);
  });
  it('keeps the last row without a trailing newline and a lone CR as a break', () => {
    expect(parseCsv('a;b\r1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('decodeText', () => {
  it('reads UTF-8 with a BOM', () => {
    expect(decodeText(buf('﻿Цена'))).toBe('Цена');
  });
  it('falls back to windows-1251', () => {
    const bytes = new Uint8Array([0xd6, 0xe5, 0xed, 0xe0]);
    expect(decodeText(bytes.buffer.slice(0) as ArrayBuffer)).toBe('Цена');
  });
});

describe('gridToOffers', () => {
  it('finds columns by their headers anywhere in the first rows', () => {
    const g = [['Прайс-лист'], ['Артикул', 'Наименование', 'Цена, BYN'], ['1', 'Автомат 1P C16', '6,2'], ['2', 'Пусто', ''], ['3', '', '5']];
    const r = gridToOffers(g, 'А');
    expect(r.headerFound).toBe(true);
    expect(r.offers).toEqual([{ name: 'Автомат 1P C16', price: 6.2, src: 'А' }]);
    expect(r.skipped).toBe(2);
  });
  it('guesses the columns when there is no header', () => {
    const g = [['Автомат 1P C16', '6,2'], ['Автомат 1P C20', '7,1'], ['ВВГнг 3х2,5', '2,1']];
    const r = gridToOffers(g, 'Б');
    expect(r.headerFound).toBe(false);
    expect(r.offers.map(o => o.price)).toEqual([6.2, 7.1, 2.1]);
  });
  it('returns nothing when no price column exists', () => {
    const r = gridToOffers([['просто'], ['текст']], 'В');
    expect(r.offers).toEqual([]);
  });
});

describe('parseXlsx', () => {
  const table = { name: 'Прайс', head: ['Наименование', 'Цена'], rows: [['Автомат 1P C16', 6.2], ['ВВГнг 3×2,5', 2.1]], widths: [30, 10] };
  it('reads inline strings and numbers from a generated workbook', () => {
    const grid = parseXlsx(buildXlsx([table]).buffer.slice(0) as ArrayBuffer);
    expect(grid).toEqual([['Наименование', 'Цена'], ['Автомат 1P C16', '6.2'], ['ВВГнг 3×2,5', '2.1']]);
  });
  it('reads shared strings, rich text and sparse cells', () => {
    const files = {
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Наименование</t></si><si><r><t>Авто</t></r><r><t>мат</t></r></si><si><t>Цена</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>5</v></c></row><row r="3"><c r="A3"/></row></sheetData></worksheet>')
    };
    const grid = parseXlsx(zipSync(files).buffer.slice(0) as ArrayBuffer);
    expect(grid).toEqual([['Наименование', '', 'Цена'], ['Автомат', '', '5']]);
  });
  it('uses the first sheet in numeric order', () => {
    const files = {
      'xl/worksheets/sheet10.xml': strToU8('<worksheet><sheetData><row><c><v>10</v></c></row></sheetData></worksheet>'),
      'xl/worksheets/sheet2.xml': strToU8('<worksheet><sheetData><row><c><v>2</v></c></row></sheetData></worksheet>')
    };
    expect(parseXlsx(zipSync(files).buffer.slice(0) as ArrayBuffer)).toEqual([['2']]);
  });
  it('returns null for broken or empty archives', () => {
    expect(parseXlsx(buf('не zip'))).toBeNull();
    expect(parseXlsx(zipSync({ 'a.txt': strToU8('x') }).buffer.slice(0) as ArrayBuffer)).toBeNull();
  });
});

describe('parsePriceFile', () => {
  it('parses csv and xlsx files and names the source without the extension', () => {
    const r = parsePriceFile('opt.csv', buf('Наименование;Цена\nАвтомат 1P C16;6,2\n'));
    expect(r!.offers[0]).toEqual({ name: 'Автомат 1P C16', price: 6.2, src: 'opt' });
    const x = parsePriceFile('Прайс.XLSX', buildXlsx([{ name: 'Прайс', head: ['Наименование', 'Цена'], rows: [['Шина N', 3]], widths: [20, 8] }]).buffer.slice(0) as ArrayBuffer);
    expect(x!.offers[0].price).toBe(3);
  });
  it('refuses old .xls, huge files and files without prices', () => {
    expect(parsePriceFile('a.xls', buf('x'))).toBeNull();
    expect(parsePriceFile('a.csv', new ArrayBuffer(MAX_FILE + 1))).toBeNull();
    expect(parsePriceFile('a.csv', buf('просто;текст\nещё;строка'))).toBeNull();
    expect(parsePriceFile('a.xlsx', buf('битый'))).toBeNull();
  });
});
