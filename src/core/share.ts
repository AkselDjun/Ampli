import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import qrcode from 'qrcode-generator';
import type { Project } from './types';
import { normWork } from './labor';
import type { WorkPrices } from './labor';
import { normProject } from './project';

export const SHARE_PREFIX = '#p=';
export const OWNER_PREFIX = '#o=';
export const ESTIMATE_PREFIX = '#e=';
export const SHARE_VERSION = 'v1.';
export const QR_MAX_BYTES = 2300;
const INFLATE_LIMIT = 2_000_000;

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
  address: p.address,
  client: p.client,
  author: p.author,
  cfg: p.cfg,
  lines: p.lines.map(l => ({ ...l, id: undefined, apps: l.apps.map(a => ({ ...a, id: undefined })) })),
  rooms: p.rooms,
  checks: p.checks,
  proto: p.proto,
  work: p.work
});

const packJson = (o: unknown): string => SHARE_VERSION + b64(deflateSync(strToU8(JSON.stringify(o)), { level: 9 }));

const unpackJson = (text: string): unknown => {
  const t = text.trim();
  if (!t.startsWith(SHARE_VERSION)) return null;
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

export function readOwnerHash(hash: string): string | null {
  if (!hash.startsWith(OWNER_PREFIX)) return null;
  const v = hash.slice(OWNER_PREFIX.length);
  return v.length > 0 ? v : null;
}

export function readShareHash(hash: string): string | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  const v = hash.slice(SHARE_PREFIX.length);
  return v.length > 0 ? v : null;
}

export function qrSvg(text: string): string | null {
  if (strToU8(text).length > QR_MAX_BYTES) return null;
  const q = qrcode(0, 'L');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

export interface EstimateShare {
  p: Project;
  prices: Record<string, number>;
  labor: WorkPrices;
  company: string;
  contacts: string;
  at: number;
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
  return packJson({ p: slimProject(e.p), prices: e.prices, labor: e.labor, company: e.company, contacts: e.contacts, at: e.at });
}

export function unpackEstimate(text: string): EstimateShare | null {
  try {
    const o = unpackJson(text) as Partial<Record<keyof EstimateShare, unknown>> | null;
    const p = o ? normProject(o.p) : null;
    if (!o || !p) return null;
    return {
      p,
      prices: priceMap(o.prices),
      labor: normWork(o.labor),
      company: String(o.company ?? '').slice(0, 80),
      contacts: String(o.contacts ?? '').slice(0, 160),
      at: Number(o.at) || 0
    };
  } catch (e) {
    void e;
    return null;
  }
}

export function estimateUrl(e: EstimateShare, base: string): string {
  return base.split('#')[0] + ESTIMATE_PREFIX + packEstimate(e);
}

export function readEstimateHash(hash: string): string | null {
  if (!hash.startsWith(ESTIMATE_PREFIX)) return null;
  const v = hash.slice(ESTIMATE_PREFIX.length);
  return v.length > 0 ? v : null;
}
