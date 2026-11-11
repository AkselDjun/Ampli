import type { Room, RoomApp } from './types';
import { parseApps } from './quick';
import { nid } from './ids';

export const ROOM_TEXT_MAX = 12;
const HEAVY_W = 3000;
const LIGHT_RX = /свет|ламп|люстр|бра\b|led|лент|прожектор/i;
const HEAD_RX = /^\s*([^:\d]{2,40}?)\s*:\s*(.*)$/;

export interface RoomsText {
  rooms: Room[];
  skipped: string[];
}

const tagOf = (name: string, w: number, tag: string): RoomApp['tag'] => {
  if (tag.includes('l') || LIGHT_RX.test(name)) return 'l';
  if (tag.includes('p') && !tag.includes('s')) return 'p';
  if (tag === 's' && w >= HEAVY_W) return 'p';
  return 's';
};

export function parseRooms(text: string, fallback = 'Комната'): RoomsText {
  const rooms: Room[] = [];
  const skipped: string[] = [];
  let cur: Room | null = null;
  const room = (name: string): Room => {
    const n = name.trim().replace(/^[-–—•*\s]+/, '');
    const r: Room = { id: nid(), name: (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 60), apps: [], ...(/кухн/i.test(n) ? { kitchen: true } : {}) };
    rooms.push(r);
    return r;
  };
  for (const raw of text.split(/[\n;]+/)) {
    if (!raw.trim()) continue;
    const head = raw.match(HEAD_RX);
    let body = raw;
    if (head) {
      if (rooms.length >= ROOM_TEXT_MAX) {
        skipped.push(raw.trim());
        cur = null;
        continue;
      }
      cur = room(head[1]);
      body = head[2];
    }
    if (!body.trim()) continue;
    const r = parseApps(body);
    skipped.push(...r.skipped);
    if (!r.apps.length) continue;
    const target = cur ?? (cur = room(fallback));
    r.apps.forEach(a => {
      const w = a.m !== undefined ? Math.round(a.w * a.m) : a.w;
      target.apps.push({ id: nid(), name: a.name, w, n: a.n, tag: tagOf(a.name, w, a.tag) });
    });
  }
  rooms.filter(r => !r.apps.length).forEach(r => skipped.push(r.name));
  return { rooms: rooms.filter(r => r.apps.length > 0), skipped };
}
