import type { App, Cfg, Content, Line, LineType, Phase, Project } from '../core/types';
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

export type Action =
  | { t: 'select'; id: string }
  | { t: 'addLine'; type: LineType }
  | { t: 'delLine' }
  | { t: 'lineField'; field: 'name' | 'len' | 'kc' | 'cos'; value: string | number }
  | { t: 'lineType'; type: LineType }
  | { t: 'linePhase'; phase: Phase }
  | { t: 'lineWet'; wet: boolean }
  | { t: 'appField'; id: string; field: 'name' | 'w' | 'n'; value: string | number }
  | { t: 'addApp'; name?: string; w?: number }
  | { t: 'delApp'; id: string }
  | { t: 'cfg'; field: keyof Cfg; value: string | number }
  | { t: 'cfgStep'; field: 'alloc' | 'ko' | 'k' | 'zs'; d: number }
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
      const next = patch(s, q => ({ ...q, lines }));
      return { ...next, sel: lines.length ? lines[Math.min(i, lines.length - 1)].id : null };
    }
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
