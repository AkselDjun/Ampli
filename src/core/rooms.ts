import type { Line, Room, RoomApp } from './types';
import { mkLine } from './templates';
import { nid } from './ids';
import { pn } from './format';

export const LIGHT_CAP_W = 1000;
export const SOCKET_CAP_W = 2500;
export const MERGE_MAX_ROOMS = 3;

export interface RoomPreset {
  key: string;
  title: string;
  kitchen?: boolean;
  apps: [string, number, number, 'l' | 's' | 'p'][];
}

export const ROOM_PRESETS: RoomPreset[] = [
  { key: 'kitchen', title: 'Кухня', kitchen: true, apps: [['Светильники', 90, 1, 'l'], ['Чайник', 2200, 1, 's'], ['Микроволновая печь', 1200, 1, 's'], ['Холодильник', 150, 1, 's'], ['Вытяжка', 200, 1, 's'], ['Варочная панель', 4500, 1, 'p'], ['Духовой шкаф', 2500, 1, 'p']] },
  { key: 'living', title: 'Гостиная', apps: [['Люстра', 180, 1, 'l'], ['Телевизор', 150, 1, 's'], ['Компьютер', 400, 1, 's'], ['Пылесос', 1600, 1, 's']] },
  { key: 'bedroom', title: 'Спальня', apps: [['Светильники', 120, 1, 'l'], ['Телевизор', 150, 1, 's'], ['Зарядки и мелкая техника', 200, 1, 's']] },
  { key: 'child', title: 'Детская', apps: [['Светильники', 120, 1, 'l'], ['Компьютер', 400, 1, 's'], ['Зарядки и мелкая техника', 200, 1, 's']] },
  { key: 'bath', title: 'Ванная', apps: [['Светильники', 60, 1, 'l'], ['Стиральная машина', 2200, 1, 'p'], ['Водонагреватель', 2000, 1, 'p'], ['Фен', 1800, 1, 's']] },
  { key: 'hall', title: 'Коридор', apps: [['Светильники', 100, 1, 'l']] },
  { key: 'custom', title: 'Своя комната', apps: [] }
];

export function makeRoom(preset: RoomPreset): Room {
  return {
    id: nid(),
    name: preset.title,
    kitchen: !!preset.kitchen,
    apps: preset.apps.map(a => ({ id: nid(), name: a[0], w: a[1], n: a[2], tag: a[3] }))
  };
}

const power = (a: RoomApp): number => Math.max(0, pn(a.w, 0)) * Math.max(0, pn(a.n, 0));

interface Bucket {
  rooms: string[];
  apps: RoomApp[];
  w: number;
}

function merge(items: { room: Room; apps: RoomApp[] }[], cap: number): Bucket[] {
  const groups: { room: Room; apps: RoomApp[]; w: number }[][] = [];
  let cur: { room: Room; apps: RoomApp[]; w: number }[] = [];
  let curW = 0;
  items.forEach(it => {
    const w = it.apps.reduce((s, x) => s + power(x), 0);
    if (cur.length && (curW + w > cap || cur.length >= MERGE_MAX_ROOMS)) {
      groups.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push({ ...it, w });
    curW += w;
  });
  if (cur.length) groups.push(cur);
  return groups.map(g => ({
    rooms: g.map(x => x.room.name || 'Комната'),
    w: g.reduce((s, x) => s + x.w, 0),
    apps: g.flatMap(x => x.apps.map(ap => ({ ...ap, name: g.length > 1 ? (x.room.name || 'Комната') + ': ' + ap.name : ap.name })))
  }));
}

const title = (base: string, rooms: string[]): string => {
  const t = base + ': ' + rooms.join(', ');
  return t.length > 48 ? t.slice(0, 47) + '…' : t;
};

export function assemble(rooms: Room[]): Line[] {
  const lines: Line[] = [];
  const pick = (r: Room, tag: string): RoomApp[] => r.apps.filter(a => a.tag === tag && power(a) > 0);
  const lights = rooms.map(r => ({ room: r, apps: pick(r, 'l') })).filter(x => x.apps.length);
  merge(lights, LIGHT_CAP_W).forEach(b => {
    lines.push(mkLine(title('Освещение', b.rooms), 'light', 15, null, null, b.apps.map(a => [a.name, pn(a.w, 0), pn(a.n, 1)])));
  });
  const sockets = rooms.map(r => ({ room: r, apps: pick(r, 's') })).filter(x => x.apps.length);
  sockets.filter(x => x.room.kitchen).forEach(x => {
    lines.push(mkLine(title('Розетки', [x.room.name || 'Кухня']), 'socket', 15, null, null, x.apps.map(a => [a.name, pn(a.w, 0), pn(a.n, 1)])));
  });
  merge(sockets.filter(x => !x.room.kitchen), SOCKET_CAP_W).forEach(b => {
    lines.push(mkLine(title('Розетки', b.rooms), 'socket', 15, null, null, b.apps.map(a => [a.name, pn(a.w, 0), pn(a.n, 1)])));
  });
  rooms.forEach(r => {
    pick(r, 'p').forEach(a => {
      const n = Math.max(1, Math.round(pn(a.n, 1)));
      for (let i = 0; i < n; i++) {
        lines.push(mkLine(n > 1 ? a.name + ' ' + (i + 1) : a.name, 'power', 10, null, null, [[a.name, pn(a.w, 0), 1]]));
      }
    });
  });
  return lines;
}
