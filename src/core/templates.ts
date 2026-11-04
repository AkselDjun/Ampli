import type { Cfg, Content, Line, LineType, Phase } from './types';
import { TYPES } from './norms';
import { nid } from './ids';

export function defaultCfg(): Cfg {
  return { supply: 1, method: 'wall', drop: 0, ko: 0.75, k: 0.9, alloc: 15, minS: 'safe', zs: 0.3, feeder: 0, prot: 'rcd' };
}

type AppDef = [string, number, number];

export function mkLine(
  name: string,
  type: LineType,
  len: number,
  kc: number | null,
  cos: number | null,
  apps: AppDef[],
  phase?: Phase
): Line {
  const t = TYPES[type];
  return {
    id: nid(),
    name,
    type,
    phase: phase || 'L1',
    len,
    kc: kc == null ? t.kc : kc,
    cos: cos == null ? t.cos : cos,
    apps: apps.map(a => ({ id: nid(), name: a[0], w: a[1], n: a[2] }))
  };
}

type Pt = [string, number, number, number?, number?];

const withPts = (l: Line, pts: Pt[]): Line => ({
  ...l,
  apps: l.apps.map((a, i) => ({ ...a, ...(pts[i][3] ? { br: pts[i][3] } : {}), ...(pts[i][4] ? { m: pts[i][4] } : {}) }))
});

const ln = (name: string, type: LineType, len: number, pts: Pt[], extra: Partial<Line>): Line =>
  ({ ...withPts(mkLine(name, type, len, null, null, pts.map(p => [p[0], p[1], p[2]] as AppDef)), pts), ...extra });

export function sample(): Content {
  return {
    sample: true,
    cfg: { ...defaultCfg(), ko: 0.35, alloc: 12 },
    lines: [
      ln('Свет: комнаты', 'light', 9, [['Люстра в гостиной', 60, 1, 4], ['Точечные светильники в прихожей', 7, 6, 3], ['Люстра в спальне', 45, 1, 6], ['Бра у кровати', 10, 2, 7], ['Светильник на лоджии', 15, 1, 8], ['Светильники в санузле', 7, 3, 4]], { zone: 'Комнаты', where: 'Гостиная, спальня, прихожая, лоджия, санузел' }),
      ln('Свет: кухня', 'light', 7, [['Светильник на кухне', 36, 1, 3], ['LED-лента над столешницей', 9.6, 1, 2, 3]], { zone: 'Кухня', where: 'Кухня' }),
      ln('Розетки: гостиная', 'socket', 14, [['Телевизор', 120, 1], ['Саундбар', 60, 1], ['Роутер', 15, 1], ['Ноутбук', 90, 1], ['Пылесос', 1600, 1]], { zone: 'Комнаты', where: 'Гостиная', sockets: 8 }),
      ln('Розетки: спальня', 'socket', 18, [['Компьютер', 450, 1], ['Монитор', 35, 1], ['Утюг', 2200, 1], ['Зарядки телефонов', 20, 2]], { zone: 'Комнаты', where: 'Спальня', sockets: 6 }),
      ln('Розетки: кухня', 'socket', 8, [['Чайник', 2200, 1], ['Кофемашина', 1450, 1]], { zone: 'Кухня', where: 'Кухня, над столешницей', sockets: 4 }),
      ln('Холодильник и СВЧ', 'socket', 7, [['Микроволновая печь', 1250, 1], ['Холодильник', 150, 1], ['Вытяжка', 120, 1]], { zone: 'Кухня', where: 'Кухня', sockets: 3 }),
      ln('Варочная панель', 'power', 7, [['Индукционная варочная панель', 7200, 1]], { zone: 'Кухня', where: 'Кухня' }),
      ln('Духовой шкаф', 'power', 7, [['Духовой шкаф', 3500, 1]], { zone: 'Кухня', where: 'Кухня' }),
      ln('Посудомойка', 'power', 8, [['Посудомоечная машина', 1900, 1]], { zone: 'Кухня', where: 'Кухня' }),
      ln('Стиральная машина', 'power', 6, [['Стиральная машина', 2200, 1]], { zone: 'Ванная', where: 'Санузел', wet: true }),
      ln('Розетка в санузле', 'socket', 6, [['Фен', 1800, 1], ['Электробритва', 15, 1]], { zone: 'Ванная', where: 'Санузел, у зеркала', wet: true, sockets: 1 }),
      ln('Водонагреватель', 'power', 6, [['Водонагреватель 80 л', 1500, 1]], { zone: 'Ванная', where: 'Санузел', wet: true }),
      ln('Тёплый пол', 'power', 6, [['Тёплый пол в санузле', 450, 1]], { zone: 'Ванная', where: 'Санузел', wet: true }),
      ln('Кондиционер', 'power', 16, [['Кондиционер в спальне', 850, 1]], { zone: 'Комнаты', where: 'Спальня' })
    ]
  };
}

export type TplKey = 'studio' | 'k1' | 'k2' | 'k3' | 'blank';

export const TPL_NAME: Record<Exclude<TplKey, 'blank'>, string> = {
  studio: 'Студия',
  k1: '1-комнатная квартира',
  k2: '2-комнатная квартира',
  k3: '3-комнатная квартира'
};

export const TPL_LIST: { key: TplKey; title: string; sub: string }[] = [
  { key: 'studio', title: 'Студия', sub: 'до 35 м²' },
  { key: 'k1', title: '1-комнатная', sub: '35–50 м²' },
  { key: 'k2', title: '2-комнатная', sub: '50–70 м²' },
  { key: 'k3', title: '3-комнатная', sub: 'от 70 м²' },
  { key: 'blank', title: 'Пустой проект', sub: 'без групп' }
];

const kitchen = (len: number): Line =>
  mkLine('Розетки: кухня', 'socket', len, 0.7, 0.95, [['Чайник', 2200, 1], ['Микроволновая печь', 1200, 1], ['Холодильник', 150, 1], ['Вытяжка', 200, 1]]);

const plate = (len: number): Line =>
  mkLine('Плита и духовка', 'power', len, 0.8, 1, [['Варочная панель', 4500, 1], ['Духовой шкаф', 2500, 1]]);

export function tplLines(k: TplKey, elec: boolean): Line[] {
  const L: Line[] = [];
  if (k === 'studio') {
    L.push(mkLine('Освещение', 'light', 15, 1, 0.95, [['Основной свет', 150, 1], ['Кухня и санузел', 100, 1]]));
    L.push(mkLine('Розетки: комната', 'socket', 14, 0.7, 0.95, [['Телевизор', 150, 1], ['Компьютер', 400, 1], ['Зарядки и мелкая техника', 200, 1]]));
    L.push(kitchen(10));
    if (elec) L.push(plate(8));
    L.push(mkLine('Стиральная машина', 'power', 6, 1, 0.95, [['Стиральная машина', 2200, 1]]));
    L.push(mkLine('Бойлер', 'power', 5, 1, 1, [['Водонагреватель', 2000, 1]]));
  } else if (k === 'k1') {
    L.push(mkLine('Освещение', 'light', 18, 1, 0.95, [['Комната', 180, 1], ['Кухня', 90, 1], ['Коридор и санузел', 100, 1]]));
    L.push(mkLine('Розетки: комната', 'socket', 16, 0.7, 0.95, [['Телевизор', 150, 1], ['Компьютер', 400, 1], ['Пылесос', 1600, 1], ['Зарядки и мелкая техника', 200, 1]]));
    L.push(kitchen(12));
    if (elec) L.push(plate(10));
    L.push(mkLine('Стиральная машина', 'power', 9, 1, 0.95, [['Стиральная машина', 2200, 1]]));
    L.push(mkLine('Бойлер', 'power', 7, 1, 1, [['Водонагреватель', 2000, 1]]));
  } else if (k === 'k2') {
    return sample().lines.filter(l => elec || l.name !== 'Плита и духовка');
  } else if (k === 'k3') {
    L.push(mkLine('Освещение: комнаты', 'light', 30, 1, 0.95, [['Гостиная', 180, 1], ['Спальня', 120, 1], ['Детская', 120, 1]]));
    L.push(mkLine('Освещение: кухня и коридор', 'light', 20, 1, 0.95, [['Кухня', 90, 1], ['Коридор и санузел', 100, 1]]));
    L.push(mkLine('Розетки: гостиная', 'socket', 22, 0.7, 0.95, [['Телевизор', 150, 1], ['Компьютер', 400, 1], ['Пылесос', 1600, 1]]));
    L.push(mkLine('Розетки: спальни', 'socket', 28, 0.7, 0.95, [['Телевизор', 150, 2], ['Компьютер', 400, 1], ['Зарядки и мелкая техника', 200, 1]]));
    L.push(kitchen(16));
    if (elec) L.push(plate(14));
    L.push(mkLine('Посудомоечная машина', 'power', 10, 1, 0.95, [['Посудомоечная машина', 2000, 1]]));
    L.push(mkLine('Стиральная машина', 'power', 12, 1, 0.95, [['Стиральная машина', 2200, 1]]));
    L.push(mkLine('Бойлер', 'power', 11, 1, 1, [['Водонагреватель', 2000, 1]]));
    L.push(mkLine('Кондиционер', 'power', 18, 1, 0.85, [['Кондиционер', 1200, 1]]));
  }
  return L;
}

export function blank(): Content {
  return { sample: false, cfg: defaultCfg(), lines: [] };
}

export function contentFor(k: TplKey, elec: boolean): Content {
  if (k === 'blank') return blank();
  return { sample: false, cfg: defaultCfg(), lines: tplLines(k, elec) };
}
