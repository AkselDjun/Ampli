import type { App, Cfg, Content, Line, LineType, Phase, Photo, Project, Room, RoomApp } from '../core/types';
import { PHOTO_LIMIT } from '../core/photos';
import { splitApps } from '../core/fixes';
import { assemble } from '../core/rooms';
import { TYPES, CLIMITS } from '../core/norms';
import { balanceLines } from '../core/calc';
import { blank, mkLine } from '../core/templates';
import { nid } from '../core/ids';
import { newProject, normProject, uniqName } from '../core/project';
import { pn, round2 } from '../core/format';
import type { Store } from './storage';

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
  | { t: 'addApps'; apps: { name: string; w: number; n: number }[] }
  | { t: 'lineField'; field: 'name' | 'where' | 'len' | 'kc' | 'cos'; value: string | number }
  | { t: 'lineType'; type: LineType }
  | { t: 'linePhase'; phase: Phase }
  | { t: 'lineWet'; wet: boolean }
  | { t: 'lineMeas'; field: MeasField; value: string }
  | { t: 'lineMeasAt'; id: string; field: MeasField; value: string }
  | { t: 'check'; id: string; on: boolean }
  | { t: 'proto'; field: 'date' | 'device' | 'by'; value: string }
  | { t: 'appField'; id: string; field: 'name' | 'w' | 'n'; value: string | number }
  | { t: 'addApp'; name?: string; w?: number }
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
  | { t: 'importProjects'; projects: Project[] };

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
      return patch(s, q => ({ ...q, rooms: [...(q.rooms ?? []), a.room] }));
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
      return patchLine(s, l => ({ ...l, apps: [...l.apps, ...a.apps.map(x => ({ id: nid(), name: x.name, w: x.w, n: x.n }))] }));
    case 'lineField':
      return patchLine(s, l => ({ ...l, [a.field]: a.value }));
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
      return patchLine(s, l => ({ ...l, meas: { ...(l.meas ?? {}), [a.field]: a.value } }));
    case 'lineMeasAt':
      return patch(s, q => ({ ...q, lines: q.lines.map(l => (l.id === a.id ? { ...l, meas: { ...(l.meas ?? {}), [a.field]: a.value } } : l)) }));
    case 'check':
      return patch(s, q => ({ ...q, checks: { ...(q.checks ?? {}), [a.id]: a.on } }));
    case 'proto':
      return patch(s, q => ({ ...q, proto: { date: '', device: '', by: '', ...(q.proto ?? {}), [a.field]: a.value } }));
    case 'lineWet':
      return patchLine(s, l => ({ ...l, wet: a.wet }));
    case 'appField':
      return patchLine(s, l => ({ ...l, apps: l.apps.map(x => (x.id === a.id ? { ...x, [a.field]: a.value } : x)) }));
    case 'addApp':
      return patchLine(s, l => {
        if (a.name === undefined) return { ...l, apps: [...l.apps, { id: nid(), name: '', w: '', n: 1 }] };
        const ex = l.apps.find(x => x.name === a.name && pn(x.w, 0) === a.w);
        if (ex) return { ...l, apps: l.apps.map(x => (x === ex ? { ...x, n: pn(x.n, 0) + 1 } : x)) };
        const app: App = { id: nid(), name: a.name, w: a.w ?? '', n: 1 };
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
      const next = patch(s, q => ({ ...q, cfg: a.content.cfg, lines: a.content.lines }));
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
      const cp = newProject({ ...src, sample: false }, (src.name || 'Без названия') + ' (копия)');
      const list = [...s.list];
      list.splice(list.indexOf(src) + 1, 0, cp);
      return { ...s, list, cur: cp.id, sel: firstId(cp) };
    }
    case 'delProject': {
      let list = s.list.filter(x => x.id !== a.id);
      if (!list.length) list = [newProject(blank(), 'Новый проект')];
      const keep = list.some(x => x.id === s.cur);
      const target = keep ? (list.find(x => x.id === s.cur) as Project) : list[0];
      return { ...s, list, cur: target.id, sel: keep ? s.sel : firstId(target) };
    }
    case 'importProjects': {
      if (!a.projects.length) return s;
      const last = a.projects[a.projects.length - 1];
      return { ...s, list: [...s.list, ...a.projects], cur: last.id, sel: firstId(last) };
    }
    default:
      return s;
  }
}

export { normProject };
