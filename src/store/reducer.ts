import type { Appliance, Cfg, Content, Line, LineType, Phase, Photo, Project, Room, RoomApp } from '../core/types';
import { PHOTO_LIMIT } from '../core/photos';
import { splitApps } from '../core/fixes';
import { assemble } from '../core/rooms';
import { TYPES, CLIMITS } from '../core/norms';
import { balanceLines, zoneOf } from '../core/calc';
import { blank, mkLine } from '../core/templates';
import { nid } from '../core/ids';
import { SAMPLE_NAME, newProject, normProject, uniqName } from '../core/project';
import type { WorkKey } from '../core/labor';
import { pn, round2 } from '../core/format';
import { normActs } from '../core/acts';
import { normOld } from '../core/oldwire';
import type { OldKey } from '../core/oldwire';
import type { OldSign } from '../core/types';
import type { Store } from './storage';
import { mergeLists } from './storage';
import { WEAK_EMPTY, newWeakPt } from '../core/weak';
import { MAT_WPM, defaultWpm, floorAppName, floorCalc, newFloorRoom } from '../core/floor';
import type { FloorRoom, FloorUse } from '../core/floor';
import type { WeakKind, WeakPt } from '../core/weak';

export interface State extends Store {
  sel: string | null;
}

export type MeasField = 'zs' | 'ins' | 'leak' | 'rcd';

export type Action =
  | { t: 'select'; id: string }
  | { t: 'addLine'; type: LineType }
  | { t: 'delLine' }
  | { t: 'moveLine'; id: string; to: string }
  | { t: 'dupLine' }
  | { t: 'splitLine'; mode: 'largest' | 'half' }
  | { t: 'roomAdd'; room: Room }
  | { t: 'roomDel'; id: string }
  | { t: 'roomName'; id: string; value: string }
  | { t: 'roomAppAdd'; rid: string; app: RoomApp }
  | { t: 'roomAppField'; rid: string; aid: string; field: 'name' | 'w' | 'n' | 'tag'; value: string }
  | { t: 'roomAppDel'; rid: string; aid: string }
  | { t: 'assemble' }
  | { t: 'photoAdd'; photo: Photo }
  | { t: 'photoDel'; id: string }
  | { t: 'photoNote'; id: string; value: string }
  | { t: 'addApps'; apps: { name: string; w: number; n: number; m?: number }[] }
  | { t: 'lineField'; field: 'name' | 'where' | 'zone' | 'len' | 'kc' | 'cos' | 'sockets' | 'perSocket'; value: string | number }
  | { t: 'lineType'; type: LineType }
  | { t: 'linePhase'; phase: Phase }
  | { t: 'lineWet'; wet: boolean }
  | { t: 'lineMeas'; field: MeasField; value: string }
  | { t: 'lineMeasAt'; id: string; field: MeasField; value: string }
  | { t: 'check'; id: string; on: boolean }
  | { t: 'workQty'; key: WorkKey; value: string }
  | { t: 'proto'; field: 'date' | 'device' | 'by'; value: string }
  | { t: 'acts'; field: 'start' | 'end' | 'warranty'; value: string }
  | { t: 'old'; field: OldKey; value: string }
  | { t: 'oldSign'; id: OldSign; on: boolean }
  | { t: 'oldReset' }
  | { t: 'floorAdd'; use: FloorUse }
  | { t: 'floorSet'; id: string; field: Exclude<keyof FloorRoom, 'id'>; value: string }
  | { t: 'floorDel'; id: string }
  | { t: 'floorApply'; id: string; line: string }
  | { t: 'weakAdd'; kind: WeakKind; room?: string }
  | { t: 'weakSet'; id: string; field: Exclude<keyof WeakPt, 'id'>; value: string }
  | { t: 'weakDel'; id: string }
  | { t: 'weakOnt'; on: boolean }
  | { t: 'appField'; id: string; field: 'name' | 'w' | 'n' | 'br' | 'm'; value: string | number }
  | { t: 'addApp'; name?: string; w?: number; m?: number }
  | { t: 'delApp'; id: string }
  | { t: 'cfg'; field: keyof Cfg; value: string | number }
  | { t: 'cfgStep'; field: 'alloc' | 'ko' | 'k' | 'zs' | 'feeder'; d: number }
  | { t: 'balance' }
  | { t: 'meta'; field: 'name' | 'address' | 'client' | 'author'; value: string }
  | { t: 'replace'; content: Content }
  | { t: 'openProject'; id: string }
  | { t: 'addProject'; content: Content; name: string }
  | { t: 'dupProject'; id: string }
  | { t: 'delProject'; id: string }
  | { t: 'importProjects'; projects: Project[] }
  | { t: 'hydrate'; projects: Project[]; order: string[]; replace: boolean };

export const cur = (s: State): Project => s.list.find(x => x.id === s.cur) as Project;

const patch = (s: State, fn: (p: Project) => Project): State => ({
  ...s,
  list: s.list.map(p => (p.id === s.cur ? { ...fn(p), sample: false, updated: Date.now() } : p))
});

const patchLine = (s: State, fn: (l: Line) => Line): State =>
  patch(s, p => ({ ...p, lines: p.lines.map(l => (l.id === s.sel ? fn(l) : l)) }));

const firstId = (p: Project): string | null => (p.lines.length ? p.lines[0].id : null);

export function init(store: Store): State {
  const p = store.list.find(x => x.id === store.cur) as Project;
  return { ...store, sel: firstId(p) };
}

const LINE_MAX: Record<string, number> = { len: 500, sockets: 99, perSocket: 10000 };
const APP_MAX: Record<string, number> = { w: 100000, n: 999, m: 100, br: 200 };

export function numIn<T>(v: T, max: number): T | string | number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
  if (typeof v !== 'string') return v;
  const t = v.replace(/[^\d.,]/g, '').replace(/^([^.,]*[.,][^.,]*)[.,].*$/, '$1');
  const x = pn(t, NaN);
  return Number.isFinite(x) && x > max ? String(max) : t;
}

export function reducer(s: State, a: Action): State {
  const p = cur(s);
  switch (a.t) {
    case 'select':
      return { ...s, sel: a.id };
    case 'addLine': {
      const nl = mkLine(TYPES[a.type].label, a.type, 15, null, null, []);
      let next = patch(s, q => ({ ...q, lines: [...q.lines, nl] }));
      next = { ...next, sel: nl.id };
      if (pn(p.cfg.supply, 1) === 3) next = patch(next, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) }));
      return next;
    }
    case 'delLine': {
      const i = p.lines.findIndex(l => l.id === s.sel);
      if (i < 0) return s;
      const lines = p.lines.filter(l => l.id !== s.sel);
      const next = patch(s, q => ({ ...q, lines, photos: (q.photos ?? []).filter(ph => ph.line !== s.sel) }));
      return { ...next, sel: lines.length ? lines[Math.min(i, lines.length - 1)].id : null };
    }
    case 'photoAdd':
      if ((p.photos ?? []).length >= PHOTO_LIMIT) return s;
      return patch(s, q => ({ ...q, photos: [...(q.photos ?? []), a.photo] }));
    case 'photoDel':
      return patch(s, q => ({ ...q, photos: (q.photos ?? []).filter(ph => ph.id !== a.id) }));
    case 'photoNote':
      return patch(s, q => ({ ...q, photos: (q.photos ?? []).map(ph => (ph.id === a.id ? { ...ph, note: a.value.slice(0, 120) } : ph)) }));
    case 'roomAdd':
      return patch(s, q => ({ ...q, rooms: [...(q.rooms ?? []), { ...a.room, name: uniqName((q.rooms ?? []).map(r => r.name), a.room.name) }] }));
    case 'roomDel':
      return patch(s, q => ({ ...q, rooms: (q.rooms ?? []).filter(r => r.id !== a.id) }));
    case 'roomName':
      return patch(s, q => ({ ...q, rooms: (q.rooms ?? []).map(r => (r.id === a.id ? { ...r, name: a.value } : r)) }));
    case 'roomAppAdd':
      return patch(s, q => ({ ...q, rooms: (q.rooms ?? []).map(r => (r.id === a.rid ? { ...r, apps: [...r.apps, a.app] } : r)) }));
    case 'roomAppField':
      return patch(s, q => ({
        ...q,
        rooms: (q.rooms ?? []).map(r => (r.id === a.rid ? { ...r, apps: r.apps.map(x => (x.id === a.aid ? { ...x, [a.field]: a.value } : x)) } : r))
      }));
    case 'roomAppDel':
      return patch(s, q => ({ ...q, rooms: (q.rooms ?? []).map(r => (r.id === a.rid ? { ...r, apps: r.apps.filter(x => x.id !== a.aid) } : r)) }));
    case 'assemble': {
      const lines = assemble(p.rooms ?? []);
      if (!lines.length) return s;
      const next = patch(s, q => ({ ...q, lines }));
      return { ...next, sel: lines[0].id };
    }
    case 'splitLine': {
      const i = p.lines.findIndex(l => l.id === s.sel);
      if (i < 0) return s;
      const src = p.lines[i];
      const parts = splitApps(src, a.mode);
      if (!parts || !parts.move.length) return s;
      const moved: Line = {
        ...mkLine(a.mode === 'largest' ? (parts.move[0].name || 'Мощный прибор') : (src.name || 'Без названия') + ' (2)', a.mode === 'largest' ? 'power' : src.type, pn(src.len, 15), null, null, [], src.phase),
        wet: src.wet,
        apps: parts.move.map(x => ({ ...x, id: nid() }))
      };
      const lines = [...p.lines];
      lines[i] = { ...src, apps: parts.keep };
      lines.splice(i + 1, 0, moved);
      let next = patch(s, q => ({ ...q, lines }));
      next = { ...next, sel: src.id };
      if (pn(p.cfg.supply, 1) === 3) next = patch(next, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) }));
      return next;
    }
    case 'moveLine': {
      const from = p.lines.findIndex(l => l.id === a.id);
      const to = p.lines.findIndex(l => l.id === a.to);
      if (from < 0 || to < 0 || from === to) return s;
      const zk = (l: Line): string => zoneOf(l).toLowerCase();
      if (zk(p.lines[from]) === zk(p.lines[to])) {
        const slots = p.lines.map((l, i) => (zk(l) === zk(p.lines[from]) ? i : -1)).filter(i => i >= 0);
        const peers = slots.map(i => p.lines[i]);
        const f = slots.indexOf(from);
        const t2 = slots.indexOf(to);
        const [m] = peers.splice(f, 1);
        peers.splice(t2, 0, m);
        const lines = [...p.lines];
        slots.forEach((i, k) => { lines[i] = peers[k]; });
        return patch(s, q => ({ ...q, lines }));
      }
      const lines = [...p.lines];
      const [m] = lines.splice(from, 1);
      lines.splice(to, 0, m);
      return patch(s, q => ({ ...q, lines }));
    }
    case 'dupLine': {
      const i = p.lines.findIndex(l => l.id === s.sel);
      if (i < 0) return s;
      const src = p.lines[i];
      const cp: Line = { ...src, id: nid(), name: (src.name || 'Без названия') + ' (копия)', apps: src.apps.map(x => ({ ...x, id: nid() })), meas: undefined };
      const lines = [...p.lines];
      lines.splice(i + 1, 0, cp);
      let next = patch(s, q => ({ ...q, lines }));
      next = { ...next, sel: cp.id };
      if (pn(p.cfg.supply, 1) === 3) next = patch(next, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) }));
      return next;
    }
    case 'addApps':
      return patchLine(s, l => ({ ...l, apps: [...l.apps, ...a.apps.map(x => ({ id: nid(), name: x.name, w: x.w, n: x.n, ...(x.m !== undefined ? { m: x.m } : {}) }))] }));
    case 'lineField': {
      let v = a.field in LINE_MAX ? numIn(a.value, LINE_MAX[a.field]) : a.value;
      if (a.field === 'zone' && typeof v === 'string') {
        const key = String(v).trim().toLowerCase();
        const twin = key ? p.lines.find(l => l.id !== s.sel && (l.zone ?? '').trim().toLowerCase() === key && (l.zone ?? '').trim() !== String(v).trim()) : undefined;
        if (twin) v = (twin.zone ?? '').trim();
      }
      return patchLine(s, l => ({ ...l, [a.field]: v }));
    }
    case 'lineType':
      return patchLine(s, l => {
        const prev = TYPES[l.type];
        const d = TYPES[a.type];
        return {
          ...l,
          type: a.type,
          name: l.name === prev.label ? d.label : l.name,
          kc: d.kc,
          cos: d.cos,
          phase: a.type !== 'power' && l.phase === '3' ? 'L1' : l.phase
        };
      });
    case 'linePhase':
      return patchLine(s, l => ({ ...l, phase: a.phase }));
    case 'lineMeas':
      return patchLine(s, l => ({ ...l, meas: { ...(l.meas ?? {}), [a.field]: numIn(a.value, 100000) } }));
    case 'lineMeasAt':
      return patch(s, q => ({ ...q, lines: q.lines.map(l => (l.id === a.id ? { ...l, meas: { ...(l.meas ?? {}), [a.field]: numIn(a.value, 100000) } } : l)) }));
    case 'workQty': {
      const v = a.value.trim();
      const n = Number(v.replace(',', '.'));
      return patch(s, q => {
        const work = { ...(q.work ?? {}) };
        if (v === '' || !isFinite(n) || n < 0) delete work[a.key];
        else work[a.key] = Math.min(100000, Math.round(n * 100) / 100);
        return { ...q, work };
      });
    }
    case 'check':
      return patch(s, q => ({ ...q, checks: { ...(q.checks ?? {}), [a.id]: a.on } }));
    case 'proto':
      return patch(s, q => ({ ...q, proto: { date: '', device: '', by: '', ...(q.proto ?? {}), [a.field]: a.value } }));
    case 'acts':
      return patch(s, q => ({ ...q, acts: normActs({ ...(q.acts ?? {}), [a.field]: a.value }) }));
    case 'old':
      return patch(s, q => ({ ...q, old: normOld({ ...(q.old ?? {}), [a.field]: a.value }) }));
    case 'oldSign':
      return patch(s, q => {
        const cur = q.old?.signs ?? [];
        return { ...q, old: normOld({ ...(q.old ?? {}), signs: a.on ? [...cur, a.id] : cur.filter(x => x !== a.id) }) };
      });
    case 'oldReset':
      return patch(s, q => {
        const { old, ...rest } = q;
        void old;
        return rest;
      });
    case 'floorAdd':
      return patch(s, q => ({ ...q, floor: [...(q.floor ?? []), newFloorRoom(a.use)] }));
    case 'floorSet':
      return patch(s, q => ({
        ...q,
        floor: (q.floor ?? []).map(r => {
          if (r.id !== a.id) return r;
          if (a.field === 'use' || a.field === 'sys') {
            const n = { ...r, [a.field]: a.value } as FloorRoom;
            return { ...n, wpm: defaultWpm(n.use, n.sys) };
          }
          if (a.field === 'wpm') return r.sys === 'mat' ? { ...r, wpm: MAT_WPM } : { ...r, wpm: numIn(a.value.slice(0, 6), 400) };
          return { ...r, [a.field]: a.field === 'name' ? a.value.slice(0, 40) : numIn(a.value.slice(0, 8), 200) };
        })
      }));
    case 'floorDel':
      return patch(s, q => {
        const floor = (q.floor ?? []).filter(r => r.id !== a.id);
        const { floor: _f, ...rest } = q;
        void _f;
        return floor.length ? { ...q, floor } : rest;
      });
    case 'floorApply': {
      const room = (p.floor ?? []).find(r => r.id === a.id);
      if (!room) return s;
      const res = floorCalc(room);
      if (!res.ok) return s;
      const name = floorAppName(room);
      const where = room.name.trim();
      if (a.line === 'new') {
        const nl = { ...mkLine('Тёплый пол: ' + (where || 'помещение'), 'power', 10, null, null, [[name, res.watts, 1]]), zone: where || undefined, ...(room.use === 'bath' ? { wet: true } : {}) };
        const next = patch(s, q => ({ ...q, lines: [...q.lines, nl] }));
        return pn(p.cfg.supply, 1) === 3 ? patch(next, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) })) : next;
      }
      return patch(s, q => ({
        ...q,
        lines: q.lines.map(l => {
          if (l.id !== a.line) return l;
          const ex = l.apps.find(x => x.name === name);
          const apps = ex ? l.apps.map(x => (x === ex ? { ...x, w: res.watts, n: 1 } : x)) : [...l.apps.filter(x => x.name.trim() || pn(x.w, 0) > 0), { id: nid(), name, w: res.watts, n: 1 }];
          return { ...l, apps };
        })
      }));
    }
    case 'weakAdd':
      return patch(s, q => {
        const w = q.weak ?? WEAK_EMPTY;
        return { ...q, weak: { ...w, pts: [...w.pts, newWeakPt(a.kind, a.room ?? '')] } };
      });
    case 'weakSet':
      return patch(s, q => (q.weak ? { ...q, weak: { ...q.weak, pts: q.weak.pts.map(x => (x.id === a.id ? { ...x, [a.field]: a.field === 'room' ? a.value.slice(0, 40) : a.field === 'kind' ? a.value : numIn(a.value.slice(0, 8), a.field === 'n' ? 99 : 500) } : x)) } } : q));
    case 'weakDel':
      return patch(s, q => {
        if (!q.weak) return q;
        const pts = q.weak.pts.filter(x => x.id !== a.id);
        const { weak: _w, ...rest } = q;
        void _w;
        return pts.length ? { ...q, weak: { ...q.weak, pts } } : rest;
      });
    case 'weakOnt':
      return patch(s, q => ({ ...q, weak: { ...(q.weak ?? WEAK_EMPTY), ont: a.on } }));
    case 'lineWet':
      return patchLine(s, l => ({ ...l, wet: a.wet }));
    case 'appField':
      return patchLine(s, l => ({ ...l, apps: l.apps.map(x => (x.id === a.id ? { ...x, [a.field]: a.field in APP_MAX ? numIn(a.value, APP_MAX[a.field]) : a.value } : x)) }));
    case 'addApp':
      return patchLine(s, l => {
        if (a.name === undefined) return { ...l, apps: [...l.apps, { id: nid(), name: '', w: '', n: 1 }] };
        const ex = a.m === undefined ? l.apps.find(x => x.name === a.name && pn(x.w, 0) === a.w && x.m === undefined) : undefined;
        if (ex) return { ...l, apps: l.apps.map(x => (x === ex ? { ...x, n: pn(x.n, 0) + 1 } : x)) };
        const app: Appliance = { id: nid(), name: a.name, w: a.w ?? '', n: 1, ...(a.m !== undefined ? { m: a.m } : {}) };
        return { ...l, apps: [...l.apps, app] };
      });
    case 'delApp':
      return patchLine(s, l => ({ ...l, apps: l.apps.filter(x => x.id !== a.id) }));
    case 'cfg': {
      let next = patch(s, q => ({ ...q, cfg: { ...q.cfg, [a.field]: a.field === 'supply' || a.field === 'drop' ? Number(a.value) : a.value } }));
      if (a.field === 'supply' && Number(a.value) === 3) next = patch(next, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) }));
      return next;
    }
    case 'cfgStep': {
      const lim = CLIMITS[a.field];
      const v = Math.max(lim[0], Math.min(lim[1], round2(pn(p.cfg[a.field], lim[0]) + a.d)));
      return patch(s, q => ({ ...q, cfg: { ...q.cfg, [a.field]: v } }));
    }
    case 'balance':
      return patch(s, q => ({ ...q, lines: balanceLines(q.lines, q.cfg) }));
    case 'meta':
      return patch(s, q => ({ ...q, [a.field]: a.value }));
    case 'replace': {
      const next = patch(s, q => ({ ...q, cfg: a.content.cfg, lines: a.content.lines, ...(!a.content.sample && q.name === SAMPLE_NAME ? { name: 'Новый проект' } : {}) }));
      const np = cur(next);
      return { ...next, list: next.list.map(x => (x.id === np.id ? { ...x, sample: a.content.sample } : x)), sel: firstId(np) };
    }
    case 'openProject': {
      const t = s.list.find(x => x.id === a.id);
      return t ? { ...s, cur: t.id, sel: firstId(t) } : s;
    }
    case 'addProject': {
      const pr = newProject(a.content, uniqName(s.list.map(x => x.name), a.name));
      return { ...s, list: [...s.list, pr], cur: pr.id, sel: firstId(pr) };
    }
    case 'dupProject': {
      const src = s.list.find(x => x.id === a.id);
      if (!src) return s;
      const cp = newProject({ ...src, sample: false }, uniqName(s.list.map(x => x.name), (src.name || 'Без названия') + ' (копия)'));
      const list = [...s.list];
      list.splice(list.indexOf(src) + 1, 0, cp);
      return { ...s, list, cur: cp.id, sel: firstId(cp) };
    }
    case 'delProject': {
      const at = s.list.findIndex(x => x.id === a.id);
      let list = s.list.filter(x => x.id !== a.id);
      if (!list.length) list = [newProject(blank(), 'Новый проект')];
      const keep = list.some(x => x.id === s.cur);
      const target = keep ? (list.find(x => x.id === s.cur) as Project) : list[Math.min(Math.max(0, at), list.length - 1)];
      return { ...s, list, cur: target.id, sel: keep ? s.sel : firstId(target) };
    }
    case 'importProjects': {
      if (!a.projects.length) return s;
      const names = s.list.map(x => x.name);
      const add = a.projects.map(x => {
        const name = uniqName(names, x.name);
        names.push(name);
        return { ...x, name };
      });
      const last = add[add.length - 1];
      return { ...s, list: [...s.list, ...add], cur: last.id, sel: firstId(last) };
    }
    case 'hydrate': {
      if (!a.projects.length) return s;
      const swap = a.replace && s.list.length === 1 && s.list[0].sample;
      const stored = new Map(a.projects.map(x => [x.id, x]));
      const mem = swap ? [] : s.list.map(x => {
        const d = stored.get(x.id);
        return d && d.updated > x.updated ? d : x;
      });
      const list = mergeLists(mem, a.projects, a.order);
      const at = list.find(x => x.id === s.cur) ?? list.find(x => x.id === a.order[0]) ?? list[0];
      return { ...s, list, cur: at.id, sel: at.id === s.cur ? s.sel : firstId(at) };
    }
    default:
      return s;
  }
}

export { normProject };
