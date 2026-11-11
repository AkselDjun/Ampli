import type { Appliance, Cfg, Content, Line, LineType, Meas, Phase, Project, Proto, Room, RoomApp } from './types';
import { normActs } from './acts';
import { normOld, oldStarted } from './oldwire';
import { CLIMITS, TYPES } from './norms';
import { pn } from './format';
import { APP_MAX, LINE_MAX, MAX_APPS, MAX_CHECKS, MAX_LINES, MAX_ROOMS, MEAS_MAX, numField } from './limits';
import { defaultCfg, sample } from './templates';
import { keepId, nid, pid } from './ids';
import { normPhotos } from './photos';
import { normWork } from './labor';
import { normWeak, weakStarted } from './weak';
import { normFloor } from './floor';

const str = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : typeof v === 'number' ? String(v) : '');
const PHASES: readonly string[] = ['L1', 'L2', 'L3', '3'];
const MEAS_KEYS = ['zs', 'ins', 'leak', 'rcd'] as const;
const CFG_TEXT = ['method', 'minS', 'prot', 'box', 'inCable', 'spd', 'vr', 'afdd', 'grpCable', 'obj'] as const;
const CFG_NUM = ['ko', 'k', 'alloc', 'zs', 'feeder', 'margin', 'sip', 'rz'] as const;
const ROOM_TAGS: readonly string[] = ['l', 's', 'p'];

type Loose = Record<string, unknown>;

const obj = (v: unknown): Loose | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : null);
const when = (v: unknown, max: number) => (typeof v === 'number' || typeof v === 'string' ? numField(v, max) : undefined);

function normCfg(o: Loose): Cfg {
  const out: Loose = { ...defaultCfg(), ...('prot' in o ? {} : { prot: 'rcbo' }) };
  if ('supply' in o) out.supply = Number(o.supply) === 3 ? 3 : 1;
  for (const k of CFG_TEXT) if (typeof o[k] === 'string') out[k] = (o[k] as string).slice(0, 16);
  for (const k of CFG_NUM) {
    const v = o[k];
    if (v === '' && (k === 'rz' || k === 'sip')) out[k] = '';
    else {
      const x = pn(v, NaN);
      if ((typeof v === 'number' || typeof v === 'string') && Number.isFinite(x)) out[k] = Math.min(CLIMITS[k][1], Math.max(CLIMITS[k][0], x));
    }
  }
  return out as unknown as Cfg;
}

function normMeas(v: unknown): Meas | undefined {
  const m = obj(v);
  if (!m) return undefined;
  const out: Meas = {};
  for (const k of MEAS_KEYS) {
    const x = when(m[k], MEAS_MAX);
    if (x !== undefined) out[k] = x;
  }
  return out;
}

function normApp(a: Loose): Appliance {
  const m = when(a.m, APP_MAX.m);
  const br = when(a.br, APP_MAX.br);
  const cos = a.cos === '' ? undefined : when(a.cos, APP_MAX.cos);
  return {
    id: nid(),
    name: str(a.name, 80),
    w: numField(a.w, APP_MAX.w),
    n: numField(a.n, APP_MAX.n, 1),
    ...(m !== undefined ? { m } : {}),
    ...(br !== undefined ? { br } : {}),
    cos,
    alt: a.alt === true ? true : undefined
  };
}

function normLine(l: Loose, id: string, z: string | undefined): Line {
  const meas = normMeas(l.meas);
  const sockets = when(l.sockets, LINE_MAX.sockets);
  const perSocket = when(l.perSocket, LINE_MAX.perSocket);
  return {
    id,
    name: str(l.name, 80),
    type: l.type as LineType,
    phase: (PHASES.includes(l.phase as string) ? l.phase : 'L1') as Phase,
    ...(l.wet === true ? { wet: true } : {}),
    ...(l.out === true ? { out: true } : {}),
    ...(l.prio === 'p' || l.prio === 's' ? { prio: l.prio } : {}),
    ...(meas ? { meas } : {}),
    zone: z,
    ...(sockets !== undefined ? { sockets } : {}),
    ...(perSocket !== undefined ? { perSocket } : {}),
    len: numField(l.len, LINE_MAX.len),
    apps: (l.apps as unknown[]).slice(0, MAX_APPS).map(obj).filter((a): a is Loose => !!a).map(normApp)
  };
}

function normRooms(v: unknown): Room[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_ROOMS).map(obj).filter((r): r is Loose => !!r && Array.isArray(r.apps)).map(r => ({
    id: nid(),
    name: str(r.name, 60),
    ...(r.kitchen === true ? { kitchen: true } : {}),
    apps: (r.apps as unknown[]).slice(0, MAX_APPS).map(obj).filter((a): a is Loose => !!a && ROOM_TAGS.includes(a.tag as string)).map(a => ({
      id: nid(),
      name: str(a.name, 80),
      w: numField(a.w, APP_MAX.w),
      n: numField(a.n, APP_MAX.n, 1),
      tag: a.tag as RoomApp['tag']
    }))
  }));
}

function normChecks(v: unknown): Record<string, boolean> {
  const o = obj(v);
  const out: Record<string, boolean> = {};
  if (!o) return out;
  for (const [k, x] of Object.entries(o).slice(0, MAX_CHECKS)) if (typeof x === 'boolean') out[k.slice(0, 80)] = x;
  return out;
}

function normProto(v: unknown): Proto {
  const o = obj(v) ?? {};
  return { date: str(o.date, 40), device: str(o.device, 80), by: str(o.by, 80) };
}

const stamp = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 8.64e15 ? n : Date.now();
};

export function normProject(o: unknown, keep = false): Project | null {
  const x = obj(o);
  const cfg = x ? obj(x.cfg) : null;
  if (!x || !cfg || !Array.isArray(x.lines)) return null;
  const src = (x.lines as unknown[]).slice(0, MAX_LINES);
  const rcd = cfg.prot === 'rcd';
  const seen = new Map<string, string>();
  for (const v of src) {
    const l = obj(v);
    if (!l || typeof l.type !== 'string' || !Object.prototype.hasOwnProperty.call(TYPES, l.type) || !Array.isArray(l.apps)) return null;
    const z = typeof l.zone === 'string' ? l.zone.trim() : '';
    if (z && !seen.has(z.toLowerCase())) seen.set(z.toLowerCase(), z);
  }
  const ids = new Set<string>();
  const lines: Line[] = (src as Loose[]).map(l => {
    let id = keep ? keepId(typeof l.id === 'string' ? l.id.slice(0, 64) : undefined) : nid();
    if (ids.has(id)) id = nid();
    ids.add(id);
    const own = typeof l.zone === 'string' && l.zone.trim() ? l.zone : '';
    const where = typeof l.where === 'string' ? l.where.trim() : '';
    const raw = own || (!rcd && where ? where.slice(0, 60) : '');
    const z = raw.trim();
    const zone = z ? (seen.get(z.toLowerCase()) === undefined || seen.get(z.toLowerCase()) === z ? raw : (seen.get(z.toLowerCase()) as string)).slice(0, 60) : undefined;
    return normLine(l, id, zone);
  });
  return {
    id: keep && (typeof x.id === 'string' || typeof x.id === 'number') && String(x.id) ? String(x.id).slice(0, 64) : pid(),
    name: str(x.name, 80) || 'Без названия',
    address: str(x.address, 120),
    client: str(x.client, 80),
    author: str(x.author, 80),
    created: stamp(x.created),
    updated: stamp(x.updated),
    sample: !!x.sample,
    cfg: normCfg(cfg),
    lines,
    rooms: normRooms(x.rooms),
    checks: normChecks(x.checks),
    proto: normProto(x.proto),
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
