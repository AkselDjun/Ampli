import type { Appliance, Cfg, Line, Meas, Photo, Project, Room, RoomApp } from '../../core/types';
import type { FloorRoom } from '../../core/floor';
import type { WeakPt } from '../../core/weak';
import { normProject, sampleProject } from '../../core/project';
import { mkLine } from '../../core/templates';

export const PROJECT_KEYS = {
  id: 1, name: 1, address: 1, client: 1, author: 1, created: 1, updated: 1, sample: 1, cfg: 1, lines: 1,
  checks: 1, proto: 1, rooms: 1, photos: 1, work: 1, acts: 1, old: 1, weak: 1, floor: 1
} satisfies Record<keyof Project, 1>;

export const CFG_KEYS = {
  supply: 1, method: 1, drop: 1, ko: 1, k: 1, alloc: 1, minS: 1, zs: 1, feeder: 1, prot: 1, box: 1, inCable: 1,
  spd: 1, vr: 1, afdd: 1, margin: 1, grpCable: 1, obj: 1, sip: 1, rz: 1
} satisfies Record<keyof Cfg, 1>;

export const LINE_KEYS = {
  id: 1, name: 1, type: 1, phase: 1, wet: 1, out: 1, meas: 1, zone: 1, sockets: 1, perSocket: 1, len: 1, apps: 1, prio: 1
} satisfies Record<keyof Line, 1>;

export const APP_KEYS = { id: 1, name: 1, w: 1, n: 1, br: 1, m: 1, cos: 1, alt: 1 } satisfies Record<keyof Appliance, 1>;
export const MEAS_KEYS = { zs: 1, ins: 1, leak: 1, rcd: 1 } satisfies Record<keyof Meas, 1>;
export const PHOTO_KEYS = { id: 1, tag: 1, line: 1, note: 1, at: 1, traces: 1 } satisfies Record<keyof Photo, 1>;
export const ROOM_KEYS = { id: 1, name: 1, kitchen: 1, apps: 1 } satisfies Record<keyof Room, 1>;
export const ROOM_APP_KEYS = { id: 1, name: 1, w: 1, n: 1, tag: 1 } satisfies Record<keyof RoomApp, 1>;
export const FLOOR_KEYS = { id: 1, name: 1, use: 1, sys: 1, area: 1, wpm: 1 } satisfies Record<keyof FloorRoom, 1>;
export const WEAK_PT_KEYS = { id: 1, room: 1, kind: 1, n: 1, len: 1 } satisfies Record<keyof WeakPt, 1>;

export const PHOTO_BYTES: Record<string, string> = { 'ph-wall': 'wall photo bytes', 'ph-plate': 'plate photo bytes' };

const T = Date.UTC(2026, 10, 10, 9, 0, 0);

function raw(): Project {
  const base = sampleProject();
  const stove = mkLine('Плита трёхфазная', 'power', 11, [['Электроплита', 9000, 1]]);
  const lines: Line[] = [
    ...base.lines,
    { ...stove, phase: '3', zone: 'Кухня', prio: 'p' },
    { ...mkLine('Котёл', 'power', 8, [['Электрокотёл', 6000, 1]]), phase: 'L2', zone: 'Котельная', prio: 's' },
    { ...mkLine('Уличные розетки', 'socket', 25, [['Газонокосилка', 1400, 1]]), phase: 'L3', zone: 'Двор', out: true, sockets: 2, perSocket: 1000 }
  ];
  const i = lines.findIndex(l => l.type === 'socket');
  lines[i] = {
    ...lines[i],
    meas: { zs: 0.62, ins: 25, leak: 2.1, rcd: 22 },
    apps: [
      ...lines[i].apps,
      { id: 'x', name: 'Компрессор', w: 900, n: 1, cos: 0.8, alt: true },
      { id: 'y', name: 'LED-лента', w: 9.6, n: 1, br: 2, m: 4 }
    ]
  };
  const ids = lines.map((_, k) => 'i' + (900 + k));
  return {
    ...base,
    id: 'p-full',
    name: 'Дом в Колодищах',
    address: 'Минский р-н, д. Колодищи, ул. Лесная, 7',
    client: 'Петров П. П.',
    author: 'ИП Сидоров',
    created: T,
    updated: T + 3600_000,
    sample: false,
    cfg: {
      ...base.cfg,
      supply: 3, method: 'wall', drop: 0, ko: 0.6, k: 0.9, alloc: 25, minS: 'safe', zs: 0.4, feeder: 0.5,
      prot: 'rcd', box: 'gkl', inCable: 'frls', spd: 'on', vr: 'on', afdd: 'sock', margin: 1.1, grpCable: 'nym',
      obj: 'house', sip: 35, rz: 8
    },
    lines: lines.map((l, k) => ({ ...l, id: ids[k], apps: l.apps.map((a, j) => ({ ...a, id: ids[k] + '-' + j })) })),
    checks: { 'Затяжка клемм': true, 'Маркировка групп': false },
    proto: { date: '2026-11-10', device: 'MPI-540, зав. № 123', by: 'Сидоров С. С.' },
    rooms: [
      { id: 'r1', name: 'Кухня', kitchen: true, apps: [{ id: 'r1-1', name: 'Чайник', w: 2200, n: 1, tag: 's' }, { id: 'r1-2', name: 'Светильник', w: 36, n: 2, tag: 'l' }] },
      { id: 'r2', name: 'Котельная', apps: [{ id: 'r2-1', name: 'Котёл', w: 6000, n: 1, tag: 'p' }] }
    ],
    photos: [
      { id: 'ph-wall', tag: 'wall', line: ids[0], note: 'Стена в гостиной', at: T, traces: [{ pts: [0, 0, 500, 0, 500, 800], note: 'от коробки вниз' }] },
      { id: 'ph-plate', tag: 'plate', line: ids[2], note: '', at: T + 60_000 }
    ],
    work: { switch: 12, socket: 30 },
    acts: { start: '2026-11-01', end: '2026-11-09', warranty: 24 },
    old: { metal: 'al', sec: 2.5, pe: 'no', net: 'tnc', panel: 'fuse', ins: '0.4', age: '45', signs: ['heat', 'twist'] },
    floor: [
      { id: 'f1', name: 'Санузел', use: 'bath', sys: 'mat', area: 3.5, wpm: 150 },
      { id: 'f2', name: 'Лоджия', use: 'loggia', sys: 'cable', area: 4, wpm: 180 }
    ],
    weak: {
      ont: true,
      pts: [
        { id: 'w1', room: 'Гостиная', kind: 'lan', n: 2, len: 18 },
        { id: 'w2', room: 'Спальня', kind: 'tv', n: 1, len: 14 },
        { id: 'w3', room: 'Двор', kind: 'cam', n: 2, len: 30 },
        { id: 'w4', room: 'Калитка', kind: 'door', n: 1, len: 25 }
      ]
    }
  };
}

export function fullProject(): Project {
  return normProject(JSON.parse(JSON.stringify(raw())), true) as Project;
}

export function withoutIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutIds);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (k !== 'id' && k !== 'lid' && x !== undefined) out[k] = withoutIds(x);
    return out;
  }
  return v;
}
