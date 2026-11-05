import type { Num, SpecItem } from './types';
import { nid } from './ids';
import { fmt, plural, pn } from './format';

export type WeakKind = 'lan' | 'tv' | 'cam' | 'door';

export interface WeakPt {
  id: string;
  room: string;
  kind: WeakKind;
  n: Num;
  len: Num;
}

export interface Weak {
  pts: WeakPt[];
  ont: boolean;
}

export interface WeakKindDef {
  label: string;
  short: string;
  cable: string;
  outlet: string;
}

export const WEAK_KINDS: Record<WeakKind, WeakKindDef> = {
  lan: { label: 'Интернет (RJ45)', short: 'Интернет', cable: 'Кабель UTP cat.5e 4×2×0,52', outlet: 'Розетка компьютерная RJ45 cat.5e' },
  tv: { label: 'Телевидение', short: 'ТВ', cable: 'Кабель коаксиальный RG-6, 75 Ом', outlet: 'Розетка TV оконечная' },
  cam: { label: 'Камера (PoE)', short: 'Камера', cable: 'Кабель UTP cat.5e 4×2×0,52', outlet: '' },
  door: { label: 'Домофон', short: 'Домофон', cable: 'Кабель КСПВ 4×0,5', outlet: '' }
};

export const WEAK_KEYS = Object.keys(WEAK_KINDS) as WeakKind[];
export const UTP_MAX = 90;
export const WEAK_EMPTY: Weak = { pts: [], ont: true };

const isKind = (k: unknown): k is WeakKind => typeof k === 'string' && k in WEAK_KINDS;

export const newWeakPt = (kind: WeakKind = 'lan', room = ''): WeakPt => ({ id: nid(), room, kind, n: 1, len: '' });

export function normWeak(o: unknown): Weak | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const x = o as Record<string, unknown>;
  const num = (v: unknown, d: Num): Num => (typeof v === 'number' || typeof v === 'string' ? String(v).slice(0, 8) : d);
  const pts = Array.isArray(x.pts)
    ? x.pts
        .filter(p => p && typeof p === 'object' && isKind((p as WeakPt).kind))
        .slice(0, 60)
        .map(p => {
          const q = p as WeakPt;
          return { id: nid(), room: String(q.room ?? '').slice(0, 40), kind: q.kind, n: num(q.n, 1), len: num(q.len, '') };
        })
    : [];
  return { pts, ont: x.ont !== false };
}

export const weakStarted = (w: Weak | undefined): w is Weak => !!w && w.pts.length > 0;

export interface WeakNote {
  k: 'bad' | 'warn' | 'tip';
  text: string;
  ref: string;
}

export interface WeakCalc {
  count: Record<WeakKind, number>;
  points: number;
  lines: number;
  cables: { name: string; m: number; kinds: WeakKind[] }[];
  meters: number;
  ports: number;
  sw: number;
  poe: boolean;
  split: number;
  ont: boolean;
  notes: WeakNote[];
  long: string[];
}

const SW = [5, 8, 16, 24, 48];
const SPLIT = [2, 3, 4, 6, 8];
const r10 = (m: number): number => Math.ceil(m * 1.1);

export function weakCalc(w: Weak): WeakCalc {
  const count: Record<WeakKind, number> = { lan: 0, tv: 0, cam: 0, door: 0 };
  const cab = new Map<string, { name: string; m: number; kinds: WeakKind[] }>();
  const long: string[] = [];
  let unknownLen = 0;
  w.pts.forEach(p => {
    const n = Math.max(0, Math.round(pn(p.n, 0)));
    if (!n) return;
    const len = Math.max(0, pn(p.len, 0));
    count[p.kind] += n;
    const def = WEAK_KINDS[p.kind];
    if (!cab.has(def.cable)) cab.set(def.cable, { name: def.cable, m: 0, kinds: [] });
    const c = cab.get(def.cable)!;
    c.m += n * len;
    if (!c.kinds.includes(p.kind)) c.kinds.push(p.kind);
    if (!len) unknownLen++;
    if ((p.kind === 'lan' || p.kind === 'cam') && len > UTP_MAX) long.push(p.room || WEAK_KINDS[p.kind].short);
  });
  const cables = Array.from(cab.values());
  const meters = cables.reduce((s, c) => s + r10(c.m), 0);
  const ports = count.lan + count.cam;
  const poe = count.cam > 0;
  const sw = ports > 4 || poe ? SW.find(s => s >= ports + 1) ?? SW[SW.length - 1] : 0;
  const split = count.tv >= 2 ? SPLIT.find(s => s >= count.tv) ?? SPLIT[SPLIT.length - 1] : 0;
  const points = count.lan + count.tv + count.cam + count.door;
  const notes: WeakNote[] = [];
  if (long.length) notes.push({ k: 'bad', text: 'Линия UTP длиннее ' + UTP_MAX + ' м: ' + long.join(', ') + '. Поставьте коммутатор ближе или разбейте линию.', ref: 'ISO/IEC 11801, постоянная линия до 90 м' });
  if (unknownLen) notes.push({ k: 'warn', text: 'Не задана длина у ' + unknownLen + ' ' + plural(unknownLen, ['строки', 'строк', 'строк']) + ', кабель для них не посчитан.', ref: '' });
  if (ports + 1 > SW[SW.length - 1]) notes.push({ k: 'warn', text: 'Линий ' + ports + ': одного коммутатора на ' + SW[SW.length - 1] + ' портов не хватит, нужны два.', ref: 'практика' });
  if (count.tv > SPLIT[SPLIT.length - 1]) notes.push({ k: 'warn', text: 'TV-розеток ' + count.tv + ': делителя на ' + SPLIT[SPLIT.length - 1] + ' выходов не хватит, нужен усилитель и два делителя.', ref: 'практика' });
  if (ports > 0 && !sw) notes.push({ k: 'tip', text: 'Хватит портов LAN роутера, коммутатор не нужен.', ref: 'практика' });
  if (sw) notes.push({ k: 'tip', text: 'Коммутатор на ' + sw + ' портов' + (poe ? ' с PoE для камер' : '') + ': ' + ports + ' ' + plural(ports, ['линия', 'линии', 'линий']) + ' и один порт на роутер.', ref: 'практика' });
  notes.push({ k: 'tip', text: 'Слаботочные кабели ведите отдельно от силовых, не ближе 5 см при параллельной прокладке, пересечения под прямым углом. Каждую точку отдельной линией от щитка, без разветвлений.', ref: 'практика' });
  notes.push({ k: 'tip', text: 'В слаботочный щиток заведите розетку 230 В для роутера' + (w.ont ? ' и оптического терминала' : '') + '.', ref: 'практика' });
  return { count, points, lines: points, cables, meters, ports, sw, poe, split, ont: w.ont, notes, long };
}

export function weakSpec(c: WeakCalc): SpecItem[] {
  const items: SpecItem[] = [];
  if (!c.points) return items;
  items.push({ name: 'Щиток слаботочный встраиваемый', qty: '1 шт', note: c.lines + ' ' + plural(c.lines, ['линия', 'линии', 'линий']) + (c.ont ? ', оптический терминал' : '') + ', роутер' + (c.sw ? ', коммутатор' : ''), n: 1, unit: 'шт' });
  items.push({ name: 'Розетка 230 В двойная в слаботочный щиток', qty: '1 шт', note: 'питание роутера' + (c.ont ? ' и терминала' : ''), n: 1, unit: 'шт' });
  if (c.sw) items.push({ name: 'Коммутатор ' + c.sw + ' портов' + (c.poe ? ' PoE' : ''), qty: '1 шт', note: c.ports + ' ' + plural(c.ports, ['линия', 'линии', 'линий']) + ' + роутер', n: 1, unit: 'шт' });
  if (c.split) items.push({ name: 'Делитель TV на ' + c.split + ' ' + plural(c.split, ['выход', 'выхода', 'выходов']), qty: '1 шт', note: c.count.tv + ' TV ' + plural(c.count.tv, ['розетка', 'розетки', 'розеток']), n: 1, unit: 'шт' });
  WEAK_KEYS.forEach(k => {
    const o = WEAK_KINDS[k].outlet;
    if (o && c.count[k]) items.push({ name: o, qty: c.count[k] + ' шт', note: 'слаботочные точки', n: c.count[k], unit: 'шт' });
  });
  if (c.count.lan + c.count.cam) items.push({ name: 'Коннектор RJ45 cat.5e', qty: (c.count.lan + c.count.cam) * 2 + ' шт', note: 'по два на линию, с запасом на щиток', n: (c.count.lan + c.count.cam) * 2, unit: 'шт' });
  c.cables.forEach(x => {
    const m = r10(x.m);
    items.push({ name: x.name, qty: m > 0 ? m + ' м' : 'длина не задана', note: x.kinds.map(k => WEAK_KINDS[k].short).join(', ') + (m > 0 ? '; запас 10 %' : ''), n: m > 0 ? m : null, unit: 'м' });
  });
  return items;
}

export const weakSummary = (w: Weak | undefined): string => {
  if (!weakStarted(w)) return '';
  const c = weakCalc(w);
  const parts = WEAK_KEYS.filter(k => c.count[k]).map(k => WEAK_KINDS[k].short + ' ' + c.count[k]);
  return parts.length ? parts.join(', ') + (c.meters ? ', ' + fmt(c.meters, 0) + ' м кабеля' : '') : 'точки не заданы';
};
