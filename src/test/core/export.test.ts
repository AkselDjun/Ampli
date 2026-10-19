import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildXlsx, colName, estimateTable, exportName, exportTables, groupsTable, sheetXml, toCsv } from '../../core/export';
import { calcAll } from '../../core/calc';
import { sampleProject } from '../../core/project';
import { buildSpec } from '../../core/spec';

const a = calcAll(sampleProject().lines, sampleProject().cfg);

describe('estimate table', () => {
  it('has one row per spec item with numeric quantities and units', () => {
    const t = estimateTable(a, {});
    expect(t.rows.length).toBe(buildSpec(a).length);
    expect(t.rows[0][1]).toMatch(/Щиток/);
    expect(t.rows[0][2]).toBe(1);
    expect(t.rows[0][3]).toBe('шт');
    expect(t.total?.value).toBe(0);
  });
  it('keeps text quantity when the amount is unknown', () => {
    const t = estimateTable(a, {});
    const cable = t.rows.find(r => String(r[1]).startsWith('ВВГнг(А)-LS') && r[2] === 'по месту');
    expect(cable).toBeTruthy();
    expect(cable![3]).toBe('');
  });
  it('computes prices and total', () => {
    const spec = buildSpec(a);
    const prices: Record<string, number> = {};
    spec.forEach(s => { prices[s.name] = 10; });
    const t = estimateTable(a, prices);
    const expected = spec.filter(s => s.n !== null).reduce((x, s) => x + 10 * (s.n as number), 0);
    expect(t.total?.value).toBeCloseTo(expected, 2);
    expect(t.rows[0][5]).toBe(10);
    expect(t.rows[0][6]).toBe(10);
  });
});

describe('groups table', () => {
  it('lists every group with status', () => {
    const t = groupsTable(a);
    expect(t.rows.length).toBe(a.rows.length);
    expect(t.rows[0][1]).toBe(sampleProject().lines[0].name);
    expect(typeof t.rows[0][3]).toBe('number');
  });
  it('leaves protection empty for groups without a fit', () => {
    const t = groupsTable({ ...a, rows: [{ ...a.rows[0], r: { ...a.rows[0].r, In: null } }] });
    expect(t.rows[0][4]).toBe('');
    expect(t.rows[0][6]).toBeNull();
  });
  it('exportTables returns both', () => {
    expect(exportTables(a, {}).map(t => t.name)).toEqual(['Смета', 'Группы']);
  });
});

describe('csv', () => {
  it('starts with BOM, uses semicolons and decimal commas', () => {
    const csv = toCsv({ name: 'x', head: ['a', 'b'], rows: [['x;y', 1.5], ['q"r', null]], widths: [1, 1] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('a;b\r\n');
    expect(csv).toContain('"x;y";1,5');
    expect(csv).toContain('"q""r";');
  });
  it('appends the total row', () => {
    const csv = toCsv(estimateTable(a, {}));
    const last = csv.trimEnd().split('\r\n').pop() as string;
    expect(last.startsWith(';;;;;Итого;')).toBe(true);
  });
  it('quotes line breaks', () => {
    expect(toCsv({ name: 'x', head: ['a'], rows: [['1\n2']], widths: [1] })).toContain('"1\n2"');
  });
});

describe('xlsx', () => {
  it('names columns', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colName(27)).toBe('AB');
  });
  it('builds a valid zip with both sheets and a SUM formula', () => {
    const z = unzipSync(buildXlsx(exportTables(a, {})));
    expect(Object.keys(z).sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'
    ]);
    const s1 = strFromU8(z['xl/worksheets/sheet1.xml']);
    expect(s1).toMatch(/<f>SUM\(G2:G\d+\)<\/f>/);
    expect(strFromU8(z['xl/workbook.xml'])).toContain('name="Смета"');
    expect(strFromU8(z['xl/workbook.xml'])).toContain('name="Группы"');
    expect(strFromU8(z['xl/worksheets/sheet2.xml'])).not.toContain('<f>');
  });
  it('escapes markup and strips control characters', () => {
    const x = sheetXml({ name: 'x', head: ['<h>'], rows: [['a&b "q" \u0001']], widths: [5] });
    expect(x).toContain('&lt;h&gt;');
    expect(x).toContain('a&amp;b &quot;q&quot; ');
    expect(x).not.toContain('\u0001');
  });
  it('writes numbers as values and null as empty cells', () => {
    const x = sheetXml({ name: 'x', head: ['a', 'b'], rows: [[3, null]], widths: [5, 5] });
    expect(x).toContain('<c r="A2" s="0"><v>3</v></c>');
    expect(x).toContain('<c r="B2" s="0"/>');
  });
});

describe('file names', () => {
  it('slugifies', () => {
    expect(exportName('Квартира №5, ул. Мира', 'csv')).toBe('квартира-5-ул-мира-smeta.csv');
    expect(exportName('', 'xlsx')).toBe('ampli-smeta.xlsx');
    expect(exportName('x'.repeat(100), 'csv').length).toBe(40 + '-smeta.csv'.length);
  });
});
