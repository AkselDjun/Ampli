import { strToU8, zipSync } from 'fflate';
import type { Calc } from './types';
import { STATUS } from './norms';
import { buildSpec, estimate } from './spec';
import { cableName, protName } from './protection';

export type Cell = string | number | null;

export interface Table {
  name: string;
  head: string[];
  rows: Cell[][];
  total?: { label: string; col: number; value: number };
  widths: number[];
}

export function estimateTable(a: Calc, prices: Record<string, number>): Table {
  const est = estimate(buildSpec(a), prices);
  return {
    name: 'Смета',
    head: ['№', 'Позиция', 'Количество', 'Ед.', 'Примечание', 'Цена, BYN', 'Сумма, BYN'],
    rows: est.rows.map(({ item, price, sum }, i) => [
      i + 1,
      item.name,
      item.n !== null ? item.n : item.qty,
      item.n !== null ? item.unit : '',
      item.note,
      price,
      sum
    ]),
    total: { label: 'Итого', col: 6, value: est.total },
    widths: [5, 44, 14, 6, 34, 12, 12]
  };
}

export function groupsTable(a: Calc): Table {
  return {
    name: 'Группы',
    head: ['№', 'Название', 'Установлено, Вт', 'Ток, А', 'Защита', 'Кабель', 'ΔU, %', 'Статус'],
    rows: a.rows.map((x, i) => {
      const r = x.r;
      return [
        i + 1,
        x.l.name,
        Math.round(r.pInst),
        Math.round(r.I * 10) / 10,
        r.In ? protName(r) : '',
        r.In ? cableName(r) : '',
        r.In ? Math.round(r.drop * 10) / 10 : null,
        STATUS[r.status]
      ];
    }),
    widths: [5, 34, 16, 9, 18, 22, 8, 14]
  };
}

export function exportTables(a: Calc, prices: Record<string, number>): Table[] {
  return [estimateTable(a, prices), groupsTable(a)];
}

const csvCell = (v: Cell): string => {
  if (v === null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(t: Table): string {
  const lines = [t.head.map(csvCell).join(';')];
  t.rows.forEach(r => lines.push(r.map(csvCell).join(';')));
  if (t.total) {
    const row: Cell[] = t.head.map(() => null);
    row[t.total.col - 1] = t.total.label;
    row[t.total.col] = t.total.value;
    lines.push(row.map(csvCell).join(';'));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export function colName(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const cellXml = (v: Cell, ref: string, style: number): string => {
  if (v === null) return '<c r="' + ref + '" s="' + style + '"/>';
  if (typeof v === 'number') return '<c r="' + ref + '" s="' + style + '"><v>' + v + '</v></c>';
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
};

export function sheetXml(t: Table): string {
  const rows: string[] = [];
  rows.push('<row r="1">' + t.head.map((h, c) => cellXml(h, colName(c) + '1', 1)).join('') + '</row>');
  t.rows.forEach((r, i) => {
    const rn = i + 2;
    rows.push('<row r="' + rn + '">' + r.map((v, c) => cellXml(v, colName(c) + rn, typeof v === 'number' && c >= 5 && t.total ? 2 : 0)).join('') + '</row>');
  });
  if (t.total) {
    const rn = t.rows.length + 2;
    const col = colName(t.total.col);
    const cells: string[] = [];
    t.head.forEach((_, c) => {
      const ref = colName(c) + rn;
      if (c === t.total!.col - 1) cells.push(cellXml(t.total!.label, ref, 3));
      else if (c === t.total!.col) cells.push('<c r="' + ref + '" s="4"><f>SUM(' + col + '2:' + col + (rn - 1) + ')</f><v>' + t.total!.value + '</v></c>');
      else cells.push(cellXml(null, ref, 3));
    });
    rows.push('<row r="' + rn + '">' + cells.join('') + '</row>');
  }
  const cols = t.widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + cols + '</cols><sheetData>' + rows.join('') + '</sheetData></worksheet>';
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF3"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

export function buildXlsx(tables: Table[]): Uint8Array {
  const n = tables.length;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + tables.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + tables.map((t, i) => '<sheet name="' + esc(t.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + tables.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8(STYLES)
  };
  tables.forEach((t, i) => {
    files['xl/worksheets/sheet' + (i + 1) + '.xml'] = strToU8(sheetXml(t));
  });
  return zipSync(files, { level: 6 });
}

export function exportName(name: string, ext: string): string {
  const base = (String(name).toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ampli').slice(0, 40);
  return base + '-smeta.' + ext;
}

