import { strFromU8, unzipSync } from 'fflate';
import type { Offer } from './shop';

export const MAX_ROWS = 5000;
export const MAX_FILE = 5_000_000;

export type Grid = string[][];

export interface ParsedList {
  offers: Offer[];
  skipped: number;
  headerFound: boolean;
}

export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch (e) {
    void e;
    return new TextDecoder('windows-1251').decode(buf);
  }
}

export function parseCsv(text: string): Grid {
  const head = text.split(/\r?\n/).slice(0, 5).join('\n');
  const count = (ch: string) => head.split(ch).length - 1;
  const delim = count(';') >= count('\t') && count(';') >= count(',') ? ';' : (count('\t') >= count(',') ? '\t' : ',');
  const rows: Grid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const colIndex = (ref: string): number => {
  const m = ref.match(/^[A-Z]+/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const textOf = (el: Element): string => Array.from(el.getElementsByTagName('t')).map(t => t.textContent ?? '').join('');

export function parseXlsx(buf: ArrayBuffer): Grid | null {
  try {
    const files = unzipSync(new Uint8Array(buf), { filter: f => /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name) && f.originalSize < 40_000_000 });
    const sheetName = Object.keys(files).filter(n => n.startsWith('xl/worksheets/')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0];
    if (!sheetName) return null;
    const dom = (u8: Uint8Array) => new DOMParser().parseFromString(strFromU8(u8), 'application/xml');
    const shared: string[] = files['xl/sharedStrings.xml']
      ? Array.from(dom(files['xl/sharedStrings.xml']).getElementsByTagName('si')).map(textOf)
      : [];
    const grid: Grid = [];
    Array.from(dom(files[sheetName]).getElementsByTagName('row')).forEach(r => {
      const row: string[] = [];
      Array.from(r.getElementsByTagName('c')).forEach((c, i) => {
        const at = c.getAttribute('r');
        const col = at ? colIndex(at) : i;
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        let val = v;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(c);
        row[col] = val;
      });
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      if (row.some(x => x.trim() !== '')) grid.push(row);
    });
    return grid;
  } catch (e) {
    void e;
    return null;
  }
}

export function parsePrice(raw: string): number | null {
  const s = String(raw).replace(/\s| /g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  let t = s;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

const NAME_HEAD = /(наименован|название|товар|номенклатур|позици|name|описание)/i;
const PRICE_HEAD = /(цена|стоимост|price|руб|byn)/i;

export function gridToOffers(grid: Grid, src: string): ParsedList {
  let nameCol = -1;
  let priceCol = -1;
  let start = 0;
  let headerFound = false;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const n = grid[i].findIndex(c => NAME_HEAD.test(c));
    const p = grid[i].findIndex(c => PRICE_HEAD.test(c));
    if (n >= 0 && p >= 0 && n !== p) {
      nameCol = n;
      priceCol = p;
      start = i + 1;
      headerFound = true;
      break;
    }
  }
  if (!headerFound) {
    const sample = grid.slice(0, 30);
    const width = Math.max(0, ...sample.map(r => r.length));
    let bestP = -1;
    let bestN = -1;
    let bestScore = 0;
    for (let c = 0; c < width; c++) {
      const hits = sample.filter(r => parsePrice(r[c] ?? '') !== null && /^[\d\s.,]+$/.test((r[c] ?? '').trim())).length;
      if (hits > bestScore) {
        bestScore = hits;
        bestP = c;
      }
    }
    let bestLen = 0;
    for (let c = 0; c < width; c++) {
      if (c === bestP) continue;
      const len = sample.reduce((s, r) => s + (/[A-Za-zА-Яа-я]/.test(r[c] ?? '') ? (r[c] ?? '').length : 0), 0);
      if (len > bestLen) {
        bestLen = len;
        bestN = c;
      }
    }
    nameCol = bestN;
    priceCol = bestP;
  }
  const offers: Offer[] = [];
  let skipped = 0;
  if (nameCol < 0 || priceCol < 0) return { offers, skipped: grid.length, headerFound };
  for (let i = start; i < grid.length && offers.length < MAX_ROWS; i++) {
    const name = (grid[i][nameCol] ?? '').trim();
    const price = parsePrice(grid[i][priceCol] ?? '');
    if (!name || price === null) {
      skipped++;
      continue;
    }
    offers.push({ name: name.slice(0, 200), price, src });
  }
  return { offers, skipped, headerFound };
}

export function parsePriceFile(name: string, buf: ArrayBuffer): ParsedList | null {
  if (buf.byteLength > MAX_FILE) return null;
  const lower = name.toLowerCase();
  const grid = lower.endsWith('.xlsx') ? parseXlsx(buf) : (lower.endsWith('.xls') ? null : parseCsv(decodeText(buf)));
  if (!grid) return null;
  const out = gridToOffers(grid, name.replace(/\.[^.]+$/, '').slice(0, 60));
  return out.offers.length ? out : null;
}
