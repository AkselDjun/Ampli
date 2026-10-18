import type { Content, Line, Project } from './types';
import { TYPES } from './norms';
import { defaultCfg, sample } from './templates';
import { nid, pid } from './ids';

type Loose = Partial<Project> & { cfg?: unknown; lines?: unknown };

export function normProject(o: unknown, keep = false): Project | null {
  const x = o as Loose | null;
  if (!x || typeof x !== 'object' || !x.cfg || !Array.isArray(x.lines)) return null;
  const src = x.lines as Line[];
  for (const l of src) {
    if (!l || !(l.type in TYPES) || !Array.isArray(l.apps)) return null;
  }
  const lines: Line[] = src.map(l => ({ ...l, id: nid(), apps: l.apps.map(a => ({ ...a, id: nid() })) }));
  return {
    id: keep && x.id ? String(x.id) : pid(),
    name: String(x.name || 'Без названия').slice(0, 80),
    address: String(x.address || '').slice(0, 120),
    client: String(x.client || '').slice(0, 80),
    author: String(x.author || '').slice(0, 80),
    created: Number(x.created) || Date.now(),
    updated: Number(x.updated) || Date.now(),
    sample: !!x.sample,
    cfg: { ...defaultCfg(), ...(x.cfg as object) },
    lines,
    checks: x.checks && typeof x.checks === 'object' ? { ...x.checks } : {},
    proto: { date: '', device: '', by: '', ...(x.proto ?? {}) }
  };
}

export function newProject(src: Content | Project, name: string): Project {
  const now = Date.now();
  return normProject({ ...src, id: undefined, name, created: now, updated: now }) as Project;
}

export function sampleProject(): Project {
  return newProject(sample(), 'Пример: двухкомнатная квартира');
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
