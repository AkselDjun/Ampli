import { PRESETS } from './norms';
import { pn } from './format';

export interface ParsedApp {
  name: string;
  w: number;
  n: number;
  tag: string;
}

export interface ParseResult {
  apps: ParsedApp[];
  skipped: string[];
}

const COUNT_RE = /(?:^|\s)(?:[x×*]\s*(\d{1,2})|(\d{1,2})\s*(?:шт\.?|штук[и]?))(?=\s|$)/i;
const POWER_RE = /(\d+(?:[.,]\d+)?)\s*(квт|kw|вт|w)?(?![\p{L}\d])/iu;

export function parseApps(text: string): ParseResult {
  const apps: ParsedApp[] = [];
  const skipped: string[] = [];
  text.split(/[\n;]+|,(?!\d)/).forEach(raw => {
    let part = raw.trim();
    if (!part) return;
    let n = 1;
    const cm = part.match(COUNT_RE);
    if (cm) {
      n = Math.max(1, Math.min(99, Number(cm[1] || cm[2])));
      part = (part.slice(0, cm.index) + ' ' + part.slice((cm.index ?? 0) + cm[0].length)).trim();
    }
    const pm = part.match(POWER_RE);
    let w = 0;
    let name = part;
    if (pm) {
      const v = pn(pm[1], 0);
      const u = (pm[2] || '').toLowerCase();
      w = u === 'квт' || u === 'kw' ? v * 1000 : v;
      name = (part.slice(0, pm.index) + ' ' + part.slice((pm.index ?? 0) + pm[0].length)).replace(/[—–-]\s*$/, '').replace(/^\s*[—–-]/, '').replace(/\s+/g, ' ').trim();
    }
    let tag = 's';
    if (!(w > 0)) {
      const key = part.toLowerCase().replace(/\s+/g, ' ').trim();
      const pr = PRESETS.find(p => p[0].toLowerCase() === key);
      if (pr) {
        w = pr[1];
        name = pr[0];
        tag = pr[2];
      }
    }
    if (!name || !(w > 0)) {
      skipped.push(raw.trim());
      return;
    }
    const known = PRESETS.find(p => p[0].toLowerCase() === name.toLowerCase());
    if (known) tag = known[2];
    apps.push({ name: name.charAt(0).toUpperCase() + name.slice(1), w: Math.round(w), n, tag });
  });
  return { apps, skipped };
}
