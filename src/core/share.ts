import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import qrcode from 'qrcode-generator';
import type { Project } from './types';
import { normProject } from './project';

export const SHARE_PREFIX = '#p=';
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

export function packProject(p: Project): string {
  const slim = {
    name: p.name,
    address: p.address,
    client: p.client,
    author: p.author,
    cfg: p.cfg,
    lines: p.lines.map(l => ({ ...l, id: undefined, apps: l.apps.map(a => ({ ...a, id: undefined })) })),
    rooms: p.rooms,
    checks: p.checks,
    proto: p.proto
  };
  const json = JSON.stringify(slim);
  return SHARE_VERSION + b64(deflateSync(strToU8(json), { level: 9 }));
}

export function unpackProject(text: string): Project | null {
  try {
    const t = text.trim();
    if (!t.startsWith(SHARE_VERSION)) return null;
    const raw = inflateSync(unb64(t.slice(SHARE_VERSION.length)), { out: new Uint8Array(INFLATE_LIMIT) });
    const end = raw.indexOf(0);
    const json = strFromU8(end < 0 ? raw : raw.subarray(0, end));
    return normProject(JSON.parse(json));
  } catch (e) {
    void e;
    return null;
  }
}

export function shareUrl(p: Project, base: string): string {
  return base.split('#')[0] + SHARE_PREFIX + packProject(p);
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
