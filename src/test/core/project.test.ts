import { describe, expect, it } from 'vitest';
import { newProject, normProject, sampleProject, slug, uniqName } from '../../core/project';
import { assemble, LIGHT_CAP_W, makeRoom, MERGE_MAX_ROOMS, ROOM_PRESETS, SOCKET_CAP_W } from '../../core/rooms';
import { buildSpec, estimate } from '../../core/spec';
import { blank, contentFor, defaultCfg, mkLine, sample, TPL_LIST, TPL_NAME, tplLines } from '../../core/templates';
import type { TplKey } from '../../core/templates';
import { whyRows } from '../../core/why';
import { dropText, reportText } from '../../core/report';
import { calcAll, calcLine, cfgN } from '../../core/calc';
import type { Cfg, Line, Project, Room } from '../../core/types';

const cfg = (o: Partial<Cfg> = {}): Cfg => ({ ...defaultCfg(), ...o });

describe('normProject', () => {
  it('rejects invalid shapes', () => {
    expect(normProject(null)).toBeNull();
    expect(normProject(undefined)).toBeNull();
    expect(normProject('x')).toBeNull();
    expect(normProject({})).toBeNull();
    expect(normProject({ cfg: {}, lines: 'x' })).toBeNull();
    expect(normProject({ cfg: null, lines: [] })).toBeNull();
    expect(normProject({ cfg: {}, lines: [null] })).toBeNull();
    expect(normProject({ cfg: {}, lines: [{ type: 'zzz', apps: [] }] })).toBeNull();
    expect(normProject({ cfg: {}, lines: [{ type: 'light', apps: 'x' }] })).toBeNull();
  });
  it('fills defaults for legacy data', () => {
    const p = normProject({ cfg: { supply: 3 }, lines: [] }) as Project;
    expect(p.name).toBe('Без названия');
    expect(p.cfg).toEqual({ ...defaultCfg(), supply: 3 });
    expect(p.rooms).toEqual([]);
    expect(p.checks).toEqual({});
    expect(p.proto).toEqual({ date: '', device: '', by: '' });
    expect(p.sample).toBe(false);
    expect(p.id).toMatch(/^p/);
    expect(p.created).toBeGreaterThan(0);
  });
  it('keeps id only when asked, clips strings and regenerates inner ids', () => {
    const raw = {
      id: 'abc',
      name: 'n'.repeat(200),
      address: 'a'.repeat(200),
      client: 'c'.repeat(200),
      author: 'u'.repeat(200),
      created: 5,
      updated: 6,
      sample: 1,
      cfg: defaultCfg(),
      lines: [{ id: 'L', name: 'x', type: 'socket', phase: 'L1', len: 1, kc: 1, cos: 1, apps: [{ id: 'A', name: 'a', w: 1, n: 1 }] }],
      rooms: [null, { id: 'r', name: 'R', apps: 'x' }, { id: 'r2', name: 'R2', apps: [{ id: 'q', name: 'q', w: 1, n: 1, tag: 's' }] }],
      checks: { marks: true },
      proto: { date: 'd' }
    };
    const k = normProject(raw, true) as Project;
    expect(k.id).toBe('abc');
    expect(k.name).toHaveLength(80);
    expect(k.address).toHaveLength(120);
    expect(k.client).toHaveLength(80);
    expect(k.author).toHaveLength(80);
    expect([k.created, k.updated, k.sample]).toEqual([5, 6, true]);
    expect(k.lines[0].id).toBe('L');
    expect(k.lines[0].apps[0].id).not.toBe('A');
    expect(k.rooms).toHaveLength(1);
    expect(k.rooms![0].id).not.toBe('r2');
    expect(k.rooms![0].apps[0].id).not.toBe('q');
    expect(k.checks).toEqual({ marks: true });
    expect(k.proto).toEqual({ date: 'd', device: '', by: '' });
    expect(normProject(raw)!.id).not.toBe('abc');
    expect(normProject({ ...raw, id: '' }, true)!.id).not.toBe('');
    expect(normProject({ ...raw, checks: 5, created: 'x', updated: 0 })!.checks).toEqual({});
  });
});

describe('project helpers', () => {
  it('creates projects', () => {
    const p = newProject(sample(), 'Тест');
    expect(p.name).toBe('Тест');
    expect(p.sample).toBe(true);
    expect(p.lines.length).toBe(7);
    expect(newProject({ ...p }, 'copy').id).not.toBe(p.id);
    expect(sampleProject().name).toContain('Пример');
  });
  it('makes unique names', () => {
    expect(uniqName(['a'], 'b')).toBe('b');
    expect(uniqName(['a'], 'a')).toBe('a 2');
    expect(uniqName(['a', 'a 2', 'a 3'], 'a')).toBe('a 4');
  });
  it('makes slugs', () => {
    expect(slug('Моя Квартира №5!')).toBe('моя-квартира-5');
    expect(slug('!!!')).toBe('project');
    expect(slug('')).toBe('project');
    expect(slug('a'.repeat(100))).toHaveLength(40);
    expect(slug(undefined as unknown as string)).toBe('undefined');
  });
});

describe('templates', () => {
  it('builds every template with and without electric stove', () => {
    (['studio', 'k1', 'k2', 'k3'] as TplKey[]).forEach(k => {
      const e = tplLines(k, true);
      const g = tplLines(k, false);
      expect(e.length).toBe(g.length + 1);
      expect(e.some(l => l.name === 'Плита и духовка')).toBe(true);
      expect(g.some(l => l.name === 'Плита и духовка')).toBe(false);
      expect(contentFor(k, true).sample).toBe(false);
      expect(TPL_NAME[k as 'studio']).toBeTruthy();
    });
    expect(tplLines('blank', true)).toEqual([]);
    expect(TPL_LIST.length).toBe(5);
  });
  it('builds blank content', () => {
    const b = contentFor('blank', true);
    expect(b.lines).toHaveLength(1);
    expect(b.lines[0].apps).toEqual([]);
    expect(blank().sample).toBe(false);
  });
  it('mkLine uses type defaults, explicit values and phase', () => {
    const a = mkLine('a', 'socket', 5, null, null, []);
    expect([a.kc, a.cos, a.phase]).toEqual([0.7, 0.95, 'L1']);
    const b = mkLine('b', 'power', 5, 0.5, 0.8, [['x', 1, 2]], '3');
    expect([b.kc, b.cos, b.phase, b.apps[0].n]).toEqual([0.5, 0.8, '3', 2]);
  });
  it('all templates calculate without unfit lines', () => {
    (['studio', 'k1', 'k2', 'k3'] as TplKey[]).forEach(k => {
      const a = calcAll(tplLines(k, true), defaultCfg());
      expect(a.rows.every(x => x.r.In !== null)).toBe(true);
    });
  });
});

describe('rooms', () => {
  const room = (name: string, apps: Room['apps'], kitchen = false): Room => ({ id: name, name, kitchen, apps });
  const ap = (name: string, w: number | string, n: number | string, tag: 'l' | 's' | 'p') => ({ id: name, name, w, n, tag });
  it('makes rooms from presets', () => {
    const k = makeRoom(ROOM_PRESETS[0]);
    expect(k.kitchen).toBe(true);
    expect(k.apps.length).toBe(7);
    const c = makeRoom(ROOM_PRESETS[ROOM_PRESETS.length - 1]);
    expect(c.kitchen).toBe(false);
    expect(c.apps).toEqual([]);
    expect(LIGHT_CAP_W).toBe(1000);
    expect(SOCKET_CAP_W).toBe(2500);
    expect(MERGE_MAX_ROOMS).toBe(3);
  });
  it('returns nothing for no rooms or no usable apps', () => {
    expect(assemble([])).toEqual([]);
    expect(assemble([room('a', [ap('x', 0, 1, 's'), ap('y', 'abc', 1, 'l')])])).toEqual([]);
  });
  it('merges light rooms by capacity and room count', () => {
    const rs = [
      room('A', [ap('l', 400, 1, 'l')]),
      room('B', [ap('l', 400, 1, 'l')]),
      room('C', [ap('l', 400, 1, 'l')]),
      room('D', [ap('l', 100, 1, 'l')]),
      room('E', [ap('l', 100, 1, 'l')]),
      room('F', [ap('l', 100, 1, 'l')]),
      room('G', [ap('l', 100, 1, 'l')])
    ];
    const lines = assemble(rs).filter(l => l.type === 'light');
    expect(lines.length).toBe(3);
    expect(lines[0].name).toBe('Освещение: A, B');
    expect(lines[0].apps.map(a => a.name)).toEqual(['A: l', 'B: l']);
    expect(lines[1].name).toBe('Освещение: C, D, E');
    expect(lines[2].name).toBe('Освещение: F, G');
  });
  it('keeps single light room names plain and falls back to Комната', () => {
    const lines = assemble([room('', [ap('l', 100, 1, 'l')])]);
    expect(lines[0].apps[0].name).toBe('l');
    const two = assemble([room('', [ap('l', 100, 1, 'l')]), room('B', [ap('l', 100, 1, 'l')])]);
    expect(two[0].apps.map(a => a.name)).toEqual(['Комната: l', 'B: l']);
    expect(two[0].name).toBe('Освещение: Комната, B');
  });
  it('truncates long titles', () => {
    const name = 'я'.repeat(60);
    const l = assemble([room(name, [ap('l', 100, 1, 'l')])])[0];
    expect(l.name).toHaveLength(48);
    expect(l.name.endsWith('…')).toBe(true);
  });
  it('gives kitchen its own socket line and merges others', () => {
    const rs = [
      room('Кухня', [ap('Чайник', 2200, 1, 's')], true),
      room('', [ap('tv', 150, 1, 's')], true),
      room('Зал', [ap('tv', 1500, 1, 's')]),
      room('Спальня', [ap('tv', 1500, 1, 's')]),
      room('Детская', [ap('tv', 100, '2', 's')])
    ];
    const lines = assemble(rs).filter(l => l.type === 'socket');
    expect(lines.map(l => l.name)).toEqual(['Розетки: Кухня', 'Розетки: Кухня', 'Розетки: Зал', 'Розетки: Спальня, Детская']);
    expect(lines[0].apps[0].w).toBe(2200);
  });
  it('splits power appliances per unit', () => {
    const lines = assemble([room('Ванная', [ap('Бойлер', 2000, 1, 'p'), ap('Плита', 3000, 2, 'p'), ap('Х', 100, 0.2, 'p'), ap('Skip', 0, 1, 'p')])]);
    expect(lines.map(l => l.name)).toEqual(['Бойлер', 'Плита 1', 'Плита 2', 'Х']);
    expect(lines.every(l => l.type === 'power' && l.apps.length === 1)).toBe(true);
    expect(lines[0].len).toBe(10);
  });
  it('treats string power and quantity', () => {
    const l = assemble([room('A', [ap('x', '100,5', '2', 'l')])])[0];
    expect(l.apps[0]).toMatchObject({ w: 100.5, n: 2 });
  });
});

describe('spec and estimate', () => {
  const lines: Line[] = [
    mkLine('a', 'socket', 10, null, null, [['x', 1000, 1]]),
    mkLine('b', 'socket', 5, null, null, [['x', 1000, 1]]),
    mkLine('c', 'socket', 0, null, null, [['x', 1000, 1]]),
    mkLine('d', 'socket', 0, null, null, [['x', 1000, 1]]),
    mkLine('e', 'light', 7, null, null, [['x', 100, 1]]),
    mkLine('empty', 'light', 7, null, null, [])
  ];
  const a = calcAll(lines, defaultCfg());
  const spec = buildSpec(a);
  it('builds spec items', () => {
    expect(spec[0]).toMatchObject({ name: 'Щиток на ' + a.size + ' модулей', n: 1 });
    expect(spec[1].name).toMatch(/^Вводной автомат 2P C\d+$/);
    const c16 = spec.find(s => s.name === 'Дифавтомат 1P+N C16 30 мА')!;
    expect(c16.qty).toBe('4 шт');
    expect(c16.note).toBe('Г1, Г2, Г3, Г4');
    const cab = spec.find(s => s.name === 'ВВГнг(А)-LS 3×2,5')!;
    expect(cab.qty).toBe('17 м');
    expect(cab.n).toBe(17);
    expect(cab.note).toContain('запас 10 %');
    expect(spec.find(s => s.name === 'ВВГнг(А)-LS 3×' + (a.inS === 10 ? '10' : String(a.inS)))).toBeTruthy();
    expect(spec[spec.length - 1].name).toBe('Шина PE (заземления)');
  });
  it('skips lines without breaker and has no input breaker on overload', () => {
    const o = buildSpec(calcAll([mkLine('big', 'power', 7, null, null, [['x', 30000, 1]])], defaultCfg()));
    expect(o.map(s => s.name)).toEqual(['Щиток на 12 модулей', 'Вводной автомат 2P C100', 'ВВГнг(А)-LS 3×25', 'Шина N (нулевая)', 'Шина PE (заземления)']);
  });
  it('handles zero length cable and no input', () => {
    const z = buildSpec(calcAll([lines[2]], defaultCfg()));
    const cab = z.find(s => s.name.startsWith('ВВГнг') && s.unit === 'м' && s.n === null && s.qty === 'длина не задана');
    expect(cab).toBeTruthy();
    expect(cab!.note).toBe('Г1');
    const none = buildSpec(calcAll([], defaultCfg()));
    expect(none.map(s => s.name)).toEqual(['Щиток на 12 модулей', 'Шина N (нулевая)', 'Шина PE (заземления)']);
  });
  it('uses 4P and 5 core in three phase', () => {
    const s3 = buildSpec(calcAll([mkLine('p', 'power', 10, null, null, [['x', 9000, 1]], '3')], cfg({ supply: 3 })));
    expect(s3.some(s => s.name.startsWith('Вводной автомат 4P'))).toBe(true);
    expect(s3.some(s => s.name.includes('5×'))).toBe(true);
  });
  it('estimates with prices', () => {
    const e0 = estimate(spec, {});
    expect(e0.total).toBe(0);
    expect(e0.missing).toBe(spec.length);
    const e = estimate(spec, { 'Шина N (нулевая)': 10.555, 'ВВГнг(А)-LS 3×2,5': 1.5, [spec[0].name]: 0 });
    const bus = e.rows.find(r => r.item.name === 'Шина N (нулевая)')!;
    expect(bus.sum).toBe(10.56);
    expect(bus.price).toBe(10.555);
    const cab = e.rows.find(r => r.item.name === 'ВВГнг(А)-LS 3×2,5')!;
    expect(cab.sum).toBe(25.5);
    expect(e.total).toBe(36.06);
    expect(e.missing).toBe(spec.length - 3);
    const ni = estimate([{ name: 'k', qty: 'по месту', note: '', n: null, unit: 'м' }], { k: 5 });
    expect(ni.rows[0].sum).toBeNull();
    expect(ni.missing).toBe(1);
  });
});

describe('why', () => {
  const c = (o: Partial<Cfg> = {}) => cfgN(cfg(o));
  const w = (l: Line, o: Partial<Cfg> = {}) => {
    const cn = c(o);
    return whyRows(l, calcLine(l, cn), cn);
  };
  it('has load, current, breaker, cable, drop and KZ rows', () => {
    const rows = w(mkLine('a', 'socket', 10, null, null, [['x', 2000, 1]]));
    expect(rows.map(r => r.title)).toEqual(['Нагрузка', 'Ток', 'Автомат', 'Кабель', 'Потеря напряжения', 'Короткое замыкание']);
    expect(rows[0].formula).toContain('× Кс 0,7');
    expect(rows[2].note).toContain('не меньше 16');
    expect(rows[2].note).toContain('Кривая C');
    expect(rows[2].note.endsWith('.')).toBe(true);
    expect(rows[3].note).toContain('скрытая прокладка');
    expect(rows[5].note).toContain('10 × C16');
  });
  it('omits Кс for kc 1, KZ for zero length and explains B curve', () => {
    const rows = w(mkLine('a', 'light', 0, 1, null, [['x', 2000, 1]]));
    expect(rows[0].formula).not.toContain('Кс');
    expect(rows.find(r => r.title === 'Короткое замыкание')).toBeUndefined();
    expect(rows[2].note).toContain('Кривая B');
    expect(rows[2].note).toContain('берём номинал не меньше 10');
    const near = w(mkLine('a', 'light', 5, 1, null, [['x', 3000, 1]]));
    expect(near[2].note).toContain('Ближайший номинал');
  });
  it('explains 10 and 100 mA', () => {
    const wet = w({ ...mkLine('a', 'socket', 5, null, null, [['x', 2000, 1]]), wet: true });
    expect(wet[2].note).toContain('до 10 мА');
    const big = w(mkLine('a', 'power', 5, null, null, [['x', 8000, 1]]));
    expect(big[2].note).toContain('до 100 мА');
  });
  it('explains cable notes for three phase and open method', () => {
    const rows = w(mkLine('a', 'power', 10, null, null, [['x', 9000, 1]], '3'), { supply: 3, method: 'open', feeder: 1 });
    expect(rows[1].formula).toContain('√3 · 400');
    expect(rows[3].note).toContain('открытая прокладка');
    expect(rows[4].formula).toContain('√3');
    expect(rows[4].note).toContain('на стояк');
  });
  it('explains minimum section and drop upsizing', () => {
    const norm = w(mkLine('a', 'socket', 5, null, null, [['x', 2000, 1]]), { minS: 'norm' });
    expect(norm[3].note).toContain('Наименьшее сечение');
    const minS = w(mkLine('a', 'socket', 5, null, null, [['x', 500, 1]]));
    expect(minS[3].note).toContain('выбран минимум 2,5');
    const drop = w(mkLine('a', 'light', 80, 1, 1, [['x', 3000, 1]]));
    expect(drop[3].note).toContain('Увеличено');
  });
  it('handles lines without breaker or cable fit', () => {
    const none = w(mkLine('a', 'power', 5, null, null, [['x', 30000, 1]]));
    expect(none.map(r => r.title)).toEqual(['Нагрузка', 'Ток']);
    const l = mkLine('a', 'power', 5, null, null, [['x', 35000, 1]], '3');
    const cn = c({ supply: 3, k: 0.5 });
    const r = calcLine(l, cn);
    expect(whyRows(l, { ...r, In: 63, S: 35 }, cn).length).toBe(6);
    expect(whyRows(l, { ...r, In: 63, S: 35 }, cn)[3].note).toContain('Допустимый ток');
  });
});

describe('report', () => {
  const lines: Line[] = [
    mkLine('Свет', 'light', 10, null, null, [['x', 100, 1]]),
    mkLine('Пусто', 'socket', 10, null, null, []),
    mkLine('Огромная', 'power', 10, null, null, [['x', 30000, 1]]),
    mkLine('Без длины', 'socket', 0, null, null, [['x', 500, 1]])
  ];
  const p = (o: Partial<Project> = {}): Project => ({
    id: 'p', name: 'Квартира', address: 'Минск', client: 'Иванов', author: 'Петров', created: 1, updated: 1, sample: false, cfg: defaultCfg(), lines, ...o
  });
  it('builds drop text', () => {
    expect(dropText(0)).toContain('3 % освещение');
    expect(dropText(4)).toBe('не более 4 %');
  });
  it('builds a full report', () => {
    const a = calcAll(lines, defaultCfg());
    const t = reportText(p(), a);
    expect(t).toContain('Расчёт электрощита: Квартира');
    expect(t).toContain('Объект: Минск');
    expect(t).toContain('Заказчик: Иванов');
    expect(t).toContain('Исполнитель: Петров');
    expect(t).toContain('1 фаза, 230 В');
    expect(t).toContain('скрытая');
    expect(t).toContain('Г2 Пусто: нет приборов');
    expect(t).toContain('Г3 Огромная: 30');
    expect(t).toContain('Ток линии больше 63 А');
    expect(t).toContain('Г1 Свет: 100 Вт');
    expect(t).toContain(', Iк ');
    expect(t).toContain('Спецификация:');
    expect(t).not.toContain('Итого по смете');
    expect(t).not.toContain('Фазы:');
    expect(t).toContain('Вводной автомат: 2P C');
    expect(t).toContain(', кабель ');
  });
  it('omits optional header lines and shows price total', () => {
    const a = calcAll(lines, defaultCfg());
    const t = reportText(p({ name: '', address: '', client: '', author: '' }), a, { 'Шина N (нулевая)': 5 });
    expect(t).toContain('Без названия');
    expect(t).not.toContain('Объект:');
    expect(t).not.toContain('Заказчик:');
    expect(t).not.toContain('Исполнитель:');
    expect(t).toContain('Итого по смете: 5,00 BYN (цена не задана для');
  });
  it('shows phases, open method and full pricing', () => {
    const l3 = [mkLine('P', 'power', 0, null, null, [['x', 9000, 1]], '3'), mkLine('S', 'socket', 10, null, null, [['x', 500, 1]], 'L2')];
    const a = calcAll(l3, cfg({ supply: 3, method: 'open', drop: 4 }));
    const spec = buildSpec(a);
    const prices: Record<string, number> = {};
    spec.forEach(s => (prices[s.name] = 1));
    const t = reportText(p({ lines: l3, cfg: cfg({ supply: 3, method: 'open', drop: 4 }) }), a, prices);
    expect(t).toContain('3 фазы, 400 В');
    expect(t).toContain('открытая');
    expect(t).toContain('не более 4 %');
    expect(t).toContain('[3Ф]');
    expect(t).toContain('[L2]');
    expect(t).toContain('Фазы: L1');
    expect(t).toContain('Вводной автомат: 4P');
    expect(t).toMatch(/Итого по смете: [\d,\s]+ BYN \(цена не задана для 2 поз\.\)$/);
  });
  it('shows dash when there is no input breaker', () => {
    const a = calcAll([], defaultCfg());
    const t = reportText(p({ lines: [] }), a);
    expect(t).toContain('Вводной автомат: —');
    expect(t).not.toContain(', кабель');
  });
});
