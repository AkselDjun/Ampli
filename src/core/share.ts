import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { Project } from './types';
import { normWork } from './labor';
import { normProject } from './project';
import { ESTIMATE_PREFIX, OWNER_PREFIX, SHARE_PREFIX, normMarkup } from './links';
import type { EstimateShare } from './links';

export * from './links';

export const SHARE_VERSION = 'v1.';

const INFLATE_LIMIT = 2_000_000;
export const LINK_LIMIT = 1_000_000;

const b64 = (u: Uint8Array): string => {
  let s = '';
  u.forEach(c => { s += String.fromCharCode(c); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const unb64 = (t: string): Uint8Array => {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
};

const slimProject = (p: Project) => ({
  name: p.name,
  updated: p.updated,
  address: p.address,
  client: p.client,
  author: p.author,
  cfg: p.cfg,
  lines: p.lines.map(l => ({ ...l, id: undefined, apps: l.apps.map(a => ({ ...a, id: undefined })) })),
  rooms: p.rooms,
  checks: p.checks,
  proto: p.proto,
  work: p.work,
  acts: p.acts,
  old: p.old,
  floor: p.floor?.map(r => ({ ...r, id: undefined })),
  weak: p.weak ? { ...p.weak, pts: p.weak.pts.map(q => ({ ...q, id: undefined })) } : undefined
});

const packJson = (o: unknown): string => SHARE_VERSION + b64(deflateSync(strToU8(JSON.stringify(o)), { level: 9 }));

const unpackJson = (text: string): unknown => {
  const t = text.trim();
  if (!t.startsWith(SHARE_VERSION) || t.length > LINK_LIMIT) return null;
  const raw = inflateSync(unb64(t.slice(SHARE_VERSION.length)), { out: new Uint8Array(INFLATE_LIMIT) });
  const end = raw.indexOf(0);
  return JSON.parse(strFromU8(end < 0 ? raw : raw.subarray(0, end)));
};

export function packProject(p: Project): string {
  return packJson(slimProject(p));
}

export function unpackProject(text: string): Project | null {
  try {
    return normProject(unpackJson(text));
  } catch (e) {
    void e;
    return null;
  }
}

export function shareUrl(p: Project, base: string): string {
  return base.split('#')[0] + SHARE_PREFIX + packProject(p);
}

export function ownerUrl(p: Project, base: string): string {
  return base.split('#')[0] + OWNER_PREFIX + packProject(p);
}

const priceMap = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'number' && isFinite(v) && v >= 0) out[k.slice(0, 120)] = v;
  }
  return out;
};

export function packEstimate(e: EstimateShare): string {
  return packJson({ p: slimProject(e.p), prices: e.prices, labor: e.labor, company: e.company, contacts: e.contacts, at: e.at, ...(e.tiers ? { tiers: e.tiers } : {}) });
}

export function unpackEstimate(text: string): EstimateShare | null {
  try {
    const o = unpackJson(text) as Partial<Record<keyof EstimateShare, unknown>> | null;
    const p = o ? normProject(o.p) : null;
    if (!o || !p) return null;
    const tiers = normMarkup(o.tiers);
    return {
      p,
      prices: priceMap(o.prices),
      labor: normWork(o.labor),
      company: String(o.company ?? '').slice(0, 80),
      contacts: String(o.contacts ?? '').slice(0, 160),
      at: Number(o.at) || 0,
      ...(tiers ? { tiers } : {})
    };
  } catch (e) {
    void e;
    return null;
  }
}

export function estimateUrl(e: EstimateShare, base: string): string {
  return base.split('#')[0] + ESTIMATE_PREFIX + packEstimate(e);
}
