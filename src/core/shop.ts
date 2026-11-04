import type { SpecItem } from './types';

export type Kind = 'breaker' | 'rcbo' | 'rcd' | 'spd' | 'relay' | 'box' | 'cable' | 'board' | 'bus' | 'other';

export interface Attrs {
  kind: Kind;
  poles: string;
  curve: string;
  amp: number;
  ma: number;
  cores: number;
  sect: number;
  modules: number;
  bus: string;
  typeA?: boolean;
  arc?: boolean;
}

export interface Offer {
  name: string;
  price: number;
  src: string;
}

export interface Shop {
  id: string;
  name: string;
  site: string;
}

export const SHOPS: Shop[] = [
  { id: 'onliner', name: 'Onliner', site: 'catalog.onliner.by' },
  { id: '21vek', name: '21vek', site: '21vek.by' },
  { id: 'shopby', name: 'shop.by', site: 'shop.by' }
];

const LOOK: Record<string, string> = { 'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x' };

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[×✕]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

const fold = (s: string): string => s.replace(/[авсекмнортх]/g, ch => LOOK[ch] ?? ch);

const num = (s: string): number => Number(s.replace(',', '.'));

export function parseAttrs(raw: string): Attrs {
  const s = norm(raw);
  const a: Attrs = { kind: 'other', poles: '', curve: '', amp: 0, ma: 0, cores: 0, sect: 0, modules: 0, bus: '' };
  if (/щит|бокс|корпус/.test(s) && /модул/.test(s)) {
    a.kind = 'board';
    const m = s.match(/(\d{1,3})\s*(?:-?\s*)?модул/);
    if (m) a.modules = Number(m[1]);
    return a;
  }
  if (/шин/.test(s) && /(нулев|заземл|\bn\b|\bpe\b)/.test(s)) {
    a.kind = 'bus';
    a.bus = /заземл|\bpe\b/.test(s) ? 'pe' : 'n';
    return a;
  }
  if (/(ввг|nym|кабел)/.test(s)) {
    const m = s.match(/(\d)\s*[xх]\s*(\d{1,2}(?:[.,]\d)?)/);
    if (m) {
      a.kind = 'cable';
      a.cores = Number(m[1]);
      a.sect = num(m[2]);
      return a;
    }
  }
  if (/(\bузо\b|^узо|выключател[ья] дифференциальн|\bвд\s?1|\bвдт\b|\brccb\b)/.test(s) && !/(дифавтомат|авдт|rcbo)/.test(s)) {
    a.kind = 'rcd';
    const am = s.match(/(\d{2,3})\s?а(?![а-я])/) ?? fold(s).match(/(\d{2,3})\s?a(?![a-z])/);
    if (am) a.amp = Number(am[1]);
    const pm = fold(s).match(/(?:^|[^a-z0-9])([24])\s?p(?![a-z])/);
    if (pm) a.poles = pm[1];
    const mm = s.match(/(\d{1,3})\s?(?:ма|ma)(?![а-яa-z])/);
    if (mm) a.ma = Number(mm[1]);
    if (/типа?\s+[aа](?![cсa-zа-я0-9])/.test(s)) a.typeA = true;
    return a;
  }
  if (/коробк[аи] (распред|распаеч|ответвит)|распаечн/.test(s)) {
    a.kind = 'box';
    return a;
  }
  if (/узип|ограничител[ья] перенапряж|\bspd\b/.test(s)) {
    a.kind = 'spd';
    return a;
  }
  if (/реле.*напряжен|\bрн-?\d|\bузм\b/.test(s)) {
    a.kind = 'relay';
    const am = s.match(/(\d{2,3})\s?а(?![а-я])/) ?? fold(s).match(/(\d{2,3})\s?a(?![a-z])/);
    if (am) a.amp = Number(am[1]);
    return a;
  }
  const isRcbo = /(дифавтомат|дифференциальн.*автомат|авдт|rcbo)/.test(s);
  const isBreaker = /автомат/.test(s) || /\bmcb\b/.test(s) || /\bва\b/.test(s);
  if (isRcbo || isBreaker) {
    a.kind = isRcbo ? 'rcbo' : 'breaker';
    const f = fold(s);
    const cm = f.match(/(?:^|[^a-z0-9])([abcd])\s?(\d{1,3})(?!\d)/);
    if (cm) {
      a.curve = cm[1].toUpperCase();
      a.amp = Number(cm[2]);
    }
    const pm = f.match(/(?:^|[^a-z0-9])([1-4])\s?p(?![a-z])/);
    if (pm) a.poles = pm[1];
    const mm = s.match(/(\d{1,3})\s?(?:ма|ma)(?![а-яa-z])/);
    if (mm) a.ma = Number(mm[1]);
    if (/типа?\s+[aа](?![cсa-zа-я0-9])/.test(s)) a.typeA = true;
    if (/уздп|дугов|\bafdd\b/.test(s)) a.arc = true;
    return a;
  }
  return a;
}

export function matches(want: Attrs, got: Attrs): boolean {
  if (want.kind === 'other' || want.kind !== got.kind) return false;
  if (want.kind === 'cable') return want.cores === got.cores && want.sect === got.sect;
  if (want.kind === 'board') return got.modules >= want.modules && got.modules > 0;
  if (want.kind === 'bus') return want.bus === got.bus;
  if (want.kind === 'spd' || want.kind === 'box') return true;
  if (want.kind === 'relay') return !want.amp || got.amp >= want.amp;
  if (want.kind === 'rcd') return got.amp === want.amp && (!want.poles || !got.poles || want.poles === got.poles) && (!want.ma || !got.ma || want.ma === got.ma) && (!want.typeA || !!got.typeA);
  if (!got.amp || want.amp !== got.amp) return false;
  if (!!want.arc !== !!got.arc) return false;
  if (want.curve && got.curve && want.curve !== got.curve) return false;
  if (want.poles && got.poles && want.poles !== got.poles) return false;
  if (want.kind === 'rcbo' && want.ma && got.ma && want.ma !== got.ma) return false;
  if (want.kind === 'rcbo' && want.typeA && !got.typeA) return false;
  return true;
}

export function bestOffers(item: SpecItem, offers: Offer[]): Offer[] {
  const want = parseAttrs(item.name);
  const out = offers.filter(o => o.price > 0 && matches(want, parseAttrs(o.name)));
  return out.sort((a, b) => a.price - b.price);
}

export function shopQuery(item: SpecItem): string {
  const w = parseAttrs(item.name);
  const name = item.name;
  if (w.kind === 'cable') return 'ВВГнг-LS ' + w.cores + 'х' + String(w.sect).replace('.', ',');
  if (w.kind === 'board') return 'Щиток встраиваемый ' + w.modules + ' модулей';
  if (w.kind === 'bus') return w.bus === 'pe' ? 'Шина PE заземления на DIN-рейку' : 'Шина N нулевая на DIN-рейку';
  if (w.arc) return (w.kind === 'rcbo' ? 'УЗДП с дифавтоматом ' : 'УЗДП с автоматом ') + w.curve + w.amp + (w.ma ? ' ' + w.ma + ' мА' : '');
  if (w.kind === 'breaker') return 'Автоматический выключатель ' + w.poles + 'P ' + w.curve + w.amp;
  if (w.kind === 'rcbo') return 'Дифавтомат ' + w.poles + 'P ' + w.curve + w.amp + (w.ma ? ' ' + w.ma + ' мА' : '') + (w.typeA ? ' тип A' : '');
  if (w.kind === 'rcd') return 'УЗО ' + (w.poles ? w.poles + 'P ' : '') + w.amp + 'А ' + w.ma + ' мА' + (w.typeA ? ' тип A' : '');
  if (w.kind === 'spd') return 'УЗИП тип 2';
  if (w.kind === 'relay') return 'Реле контроля напряжения' + (w.amp ? ' ' + w.amp + 'А' : '');
  return name;
}

export function searchUrl(q: string, shop?: Shop): string {
  const text = shop ? q + ' site:' + shop.site : q + ' купить Беларусь';
  return 'https://www.google.com/search?q=' + encodeURIComponent(text);
}
