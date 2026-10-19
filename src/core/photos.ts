import type { Line, Photo, PhotoTag } from './types';

export const PHOTO_TAGS: [PhotoTag, string][] = [
  ['before', 'До'],
  ['after', 'После'],
  ['plate', 'Шильдик'],
  ['meas', 'Замер']
];

export const PHOTO_TAG_LABEL: Record<PhotoTag, string> = {
  before: 'До',
  after: 'После',
  plate: 'Шильдик',
  meas: 'Замер'
};

export const PHOTO_LIMIT = 40;

export function normPhotos(x: unknown): Photo[] {
  if (!Array.isArray(x)) return [];
  const out: Photo[] = [];
  for (const o of x as Partial<Photo>[]) {
    if (!o || typeof o.id !== 'string' || !o.id || !(o.tag && o.tag in PHOTO_TAG_LABEL)) continue;
    out.push({ id: o.id, tag: o.tag, line: typeof o.line === 'string' ? o.line : null, note: String(o.note ?? '').slice(0, 120), at: Number(o.at) || 0 });
    if (out.length >= PHOTO_LIMIT) break;
  }
  return out;
}

export function photoCaption(ph: Photo, lines: Line[]): string {
  const i = ph.line ? lines.findIndex(l => l.id === ph.line) : -1;
  const where = ph.line === null ? 'Щиток' : (i >= 0 ? 'Г' + (i + 1) + ' ' + lines[i].name : 'Группа удалена');
  return where + ' · ' + PHOTO_TAG_LABEL[ph.tag] + (ph.note ? ' · ' + ph.note : '');
}

export function referencedPhotoIds(list: { photos?: Photo[] }[]): Set<string> {
  const s = new Set<string>();
  list.forEach(p => (p.photos ?? []).forEach(ph => s.add(ph.id)));
  return s;
}
