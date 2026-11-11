import type { Content, Line, Project, Room } from './types';
import { normActs } from './acts';
import { normOld, oldStarted } from './oldwire';
import { TYPES } from './norms';
import { defaultCfg, sample } from './templates';
import { keepId, nid, pid } from './ids';
import { normPhotos } from './photos';
import { normWork } from './labor';
import { normWeak, weakStarted } from './weak';
import { normFloor } from './floor';

const str = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : typeof v === 'number' ? String(v) : '');
const numv = (v: unknown, d: number | string = ''): number | string => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v.slice(0, 12) : d);

type Loose = Partial<Project> & { cfg?: unknown; lines?: unknown };

const legacy = (l: Line): Line => {
  const o = { ...l } as Line & { kc?: unknown; cos?: unknown };
  delete o.kc;
  delete o.cos;
  return o;
};

export function normProject(o: unknown, keep = false): Project | null {
  const x = o as Loose | null;
  if (!x || typeof x !== 'object' || !x.cfg || typeof x.cfg !== 'object' || Array.isArray(x.cfg) || !Array.isArray(x.lines)) return null;
  const src = x.lines as Line[];
  const seen = new Map<string, string>();
  for (const l of src) {
    if (l && typeof l.zone === 'string' && l.zone.trim() && !seen.has(l.zone.trim().toLowerCase())) seen.set(l.zone.trim().toLowerCase(), l.zone.trim());
    if (!l || typeof l !== 'object' || typeof l.type !== 'string' || !(l.type in TYPES) || !Array.isArray(l.apps)) return null;
  }
  const lines: Line[] = src.map(l => legacy(l)).map(l => ({ ...l, ...(typeof l.where === 'string' && l.where.trim() ? { where: l.where.slice(0, 80) } : { where: undefined }), ...(typeof l.zone === 'string' && l.zone.trim() ? { zone: (seen.get(l.zone.trim().toLowerCase()) === l.zone.trim() ? l.zone : seen.get(l.zone.trim().toLowerCase()) as string).slice(0, 60) } : { zone: undefined }), name: str(l.name, 80), id: keep ? keepId(l.id) : nid(), apps: l.apps.filter(a => a && typeof a === 'object').map(a => ({ ...a, name: str(a.name, 80), w: numv(a.w), n: numv(a.n, 1), ...(a.m !== undefined ? { m: numv(a.m) } : {}), ...(a.br !== undefined ? { br: numv(a.br) } : {}), ...(a.cos !== undefined && a.cos !== '' ? { cos: numv(a.cos) } : { cos: undefined }), ...(a.alt === true ? { alt: true } : { alt: undefined }), id: nid() })) }));
  return {
    id: keep && x.id ? String(x.id) : pid(),
    name: String(x.name || 'Без названия').slice(0, 80),
    address: String(x.address || '').slice(0, 120),
    client: String(x.client || '').slice(0, 80),
    author: String(x.author || '').slice(0, 80),
    created: Number(x.created) || Date.now(),
    updated: Number(x.updated) || Date.now(),
    sample: !!x.sample,
    cfg: { ...defaultCfg(), ...('prot' in (x.cfg as object) ? {} : { prot: 'rcbo' }), ...(x.cfg as object) },
    lines,
    rooms: Array.isArray(x.rooms)
      ? (x.rooms as Room[]).filter(r => r && Array.isArray(r.apps)).map(r => ({ ...r, id: nid(), apps: r.apps.map(a => ({ ...a, id: nid() })) }))
      : [],
    checks: x.checks && typeof x.checks === 'object' ? { ...x.checks } : {},
    proto: { date: '', device: '', by: '', ...(x.proto ?? {}) },
    photos: keep ? normPhotos(x.photos) : [],
    ...(x.work && Object.keys(normWork(x.work)).length ? { work: normWork(x.work) } : {}),
    ...(x.acts ? { acts: normActs(x.acts) } : {}),
    ...(x.old && oldStarted(normOld(x.old)) ? { old: normOld(x.old) } : {}),
    ...(normFloor(x.floor).length ? { floor: normFloor(x.floor) } : {}),
    ...(weakStarted(normWeak(x.weak)) ? { weak: normWeak(x.weak) } : {})
  };
}

export const SAMPLE_NAME = 'Пример: двухкомнатная квартира';

export function newProject(src: Content | Project, name: string): Project {
  const now = Date.now();
  return normProject({ ...src, id: undefined, name, created: now, updated: now }) as Project;
}

export function sampleProject(): Project {
  return newProject(sample(), SAMPLE_NAME);
}

export function uniqName(names: string[], n: string): string {
  if (!names.includes(n)) return n;
  let i = 2;
  while (names.includes(n + ' ' + i)) i++;
  return n + ' ' + i;
}

export function slug(t: string): string {
  return (String(t).toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project').slice(0, 40);
}
