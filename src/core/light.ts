import type { Num } from './types';
import { nid } from './ids';
import { pn } from './format';

export type LightKind = 'living' | 'bed' | 'kitchen' | 'kids' | 'study' | 'hall' | 'bath' | 'store';

export interface LightRoom {
  id: string;
  name: string;
  kind: LightKind;
  a: Num;
  b: Num;
  h: Num;
  fx: string;
  w: Num;
  lm: Num;
}

export interface KindDef {
  label: string;
  lux: number;
  practice?: boolean;
}

export const LIGHT_KINDS: Record<LightKind, KindDef> = {
  living: { label: 'Гостиная, жилая комната', lux: 150 },
  bed: { label: 'Спальня', lux: 150 },
  kitchen: { label: 'Кухня, кухня-столовая', lux: 150 },
  kids: { label: 'Детская', lux: 200 },
  study: { label: 'Кабинет', lux: 300, practice: true },
  hall: { label: 'Прихожая, коридор', lux: 50 },
  bath: { label: 'Ванная, санузел', lux: 50 },
  store: { label: 'Кладовая, гардеробная', lux: 50, practice: true }
};

export const KIND_KEYS = Object.keys(LIGHT_KINDS) as LightKind[];

export interface Fixture {
  id: string;
  name: string;
  w: number;
  lm: number;
}

export const FIXTURES: Fixture[] = [
  { id: 'spot7', name: 'Точечный светильник LED 7 Вт', w: 7, lm: 600 },
  { id: 'spot10', name: 'Точечный светильник LED 10 Вт', w: 10, lm: 900 },
  { id: 'lamp10', name: 'Лампа LED 10 Вт', w: 10, lm: 1000 },
  { id: 'panel36', name: 'Светодиодная панель 36 Вт', w: 36, lm: 3600 },
  { id: 'chand', name: 'Люстра LED 60 Вт', w: 60, lm: 5000 }
];

export const OWN_FX = 'own';
export const KZ = 1.25;
export const LUX_REF = 'Гигиенический норматив, утв. постановлением Минздрава РБ от 28.06.2012 № 82';

const ETA: [number, number][] = [
  [0.5, 0.4], [0.6, 0.45], [0.8, 0.52], [1, 0.58], [1.25, 0.63], [1.5, 0.67], [2, 0.72], [2.5, 0.76], [3, 0.78], [4, 0.81], [5, 0.83]
];

export function utilization(i: number): number {
  if (!(i > 0)) return ETA[0][1];
  if (i <= ETA[0][0]) return ETA[0][1];
  const last = ETA[ETA.length - 1];
  if (i >= last[0]) return last[1];
  for (let k = 1; k < ETA.length; k++) {
    const [x1, y1] = ETA[k];
    const [x0, y0] = ETA[k - 1];
    if (i <= x1) return Math.round((y0 + ((y1 - y0) * (i - x0)) / (x1 - x0)) * 1000) / 1000;
  }
  return last[1];
}

const isKind = (k: unknown): k is LightKind => typeof k === 'string' && k in LIGHT_KINDS;
const KIND_NAME: Record<LightKind, string> = { living: 'Гостиная', bed: 'Спальня', kitchen: 'Кухня', kids: 'Детская', study: 'Кабинет', hall: 'Прихожая', bath: 'Ванная', store: 'Кладовая' };

export function newLightRoom(kind: LightKind = 'living', name?: string): LightRoom {
  const fx = kind === 'living' || kind === 'bed' ? FIXTURES[1] : FIXTURES[0];
  return { id: nid(), name: name ?? KIND_NAME[kind], kind, a: '', b: '', h: 2.7, fx: fx.id, w: fx.w, lm: fx.lm };
}

export function normLight(o: unknown): LightRoom[] {
  if (!Array.isArray(o)) return [];
  return o
    .filter(r => r && typeof r === 'object')
    .slice(0, 40)
    .map(r => {
      const x = r as Record<string, unknown>;
      const kind = isKind(x.kind) ? x.kind : 'living';
      const fx = FIXTURES.find(f => f.id === x.fx);
      const num = (v: unknown, d: Num): Num => (typeof v === 'number' || typeof v === 'string' ? String(v).slice(0, 8) : d);
      return {
        id: nid(),
        name: String(x.name ?? KIND_NAME[kind]).slice(0, 40),
        kind,
        a: num(x.a, ''),
        b: num(x.b, ''),
        h: num(x.h, 2.7),
        fx: fx ? fx.id : OWN_FX,
        w: fx ? fx.w : num(x.w, ''),
        lm: fx ? fx.lm : num(x.lm, '')
      };
    });
}

export interface LightResult {
  ok: boolean;
  area: number;
  index: number;
  eta: number;
  need: number;
  n: number;
  lux: number;
  watts: number;
  density: number;
  fxName: string;
  practice: boolean;
}

export function fixtureName(r: LightRoom): string {
  const f = FIXTURES.find(x => x.id === r.fx);
  if (f) return f.name;
  const w = pn(r.w, 0);
  return 'Светильник' + (w > 0 ? ' ' + String(w).replace('.', ',') + ' Вт' : '');
}

export function lightCalc(r: LightRoom): LightResult {
  const a = pn(r.a, 0);
  const b = pn(r.b, 0);
  const h = pn(r.h, 0);
  const w = pn(r.w, 0);
  const lm = pn(r.lm, 0);
  const def = LIGHT_KINDS[r.kind];
  const need = def.lux;
  const area = a > 0 && b > 0 ? a * b : 0;
  const ok = area > 0 && h > 0 && lm > 0;
  const index = ok ? area / (h * (a + b)) : 0;
  const eta = utilization(index);
  const n = ok ? Math.max(1, Math.ceil((need * area * KZ) / (lm * eta) - 1e-9)) : 0;
  const lux = ok ? (n * lm * eta) / (area * KZ) : 0;
  const watts = n * w;
  return { ok, area, index, eta, need, n, lux, watts, density: area > 0 ? watts / area : 0, fxName: fixtureName(r), practice: !!def.practice };
}

export const lightAppName = (r: LightRoom): string => fixtureName(r) + ' (' + (r.name.trim() || KIND_NAME[r.kind]) + ')';
