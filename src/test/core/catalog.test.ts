import { describe, expect, it } from 'vitest';
import { USAGE_LIMIT, byUsage, catalog, normName, searchCatalog, topUsed } from '../../core/catalog';
import type { CatItem } from '../../core/catalog';
import { PRESETS } from '../../core/norms';
import { PHOTO_LIMIT, PHOTO_TAG_LABEL, PHOTO_TAGS, normPhotos, photoCaption, referencedPhotoIds } from '../../core/photos';
import { normProject, newProject, sampleProject } from '../../core/project';
import { blank, defaultCfg } from '../../core/templates';
import type { Line, Photo } from '../../core/types';

const item = (name: string, w: number, tags: string): CatItem => ({ key: name + w, name, w, tags, mine: null });

describe('catalog', () => {
  it('normalizes names with yo and whitespace', () => {
    expect(normName('  ЁЛКА Тёплый ')).toBe('елка теплый');
  });
  it('builds base and own items', () => {
    const c = catalog([{ id: 'm1', name: 'Мой Ёж', w: 77, tag: 's' }]);
    expect(c).toHaveLength(PRESETS.length + 1);
    expect(c[0]).toEqual({ key: 'чайник|2200', name: 'Чайник', w: 2200, tags: 's', mine: null });
    expect(c[c.length - 1]).toEqual({ key: 'мой еж|77', name: 'Мой Ёж', w: 77, tags: 's', mine: 'm1' });
  });
  it('sorts by usage count, then recency, then original order', () => {
    const items = [item('A', 1, 's'), item('B', 1, 's'), item('C', 1, 's'), item('D', 1, 's')];
    const out = byUsage(items, { c: { n: 3, at: 1 }, b: { n: 1, at: 99 }, d: { n: 1, at: 50 } });
    expect(out.map(x => x.name)).toEqual(['C', 'B', 'D', 'A']);
    expect(byUsage(items, {}).map(x => x.name)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('topUsed filters by tag and usage, dedups names and limits', () => {
    const items = [item('A', 1, 's'), item('A', 2, 's'), item('B', 1, 'p'), item('C', 1, 's'), item('E', 1, 's'), item('F', 1, 'sp')];
    const usage = { a: { n: 5, at: 1 }, b: { n: 9, at: 1 }, c: { n: 2, at: 1 }, f: { n: 1, at: 1 } };
    expect(topUsed(items, usage, 's').map(x => x.name + x.w)).toEqual(['A1', 'C1', 'F1']);
    expect(topUsed(items, usage, 's', 2).map(x => x.name)).toEqual(['A', 'C']);
    expect(topUsed(items, {}, 's')).toEqual([]);
  });
  it('search returns nothing for blank queries', () => {
    expect(searchCatalog(catalog([]), '   ', {}, 's')).toEqual([]);
  });
  it('search ranks starts-with, then current tag, then usage, and limits', () => {
    const items = [
      item('Малый чайник', 1, 'l'),
      item('Чайник электрический', 2, 'l'),
      item('Чайник', 3, 's'),
      item('Ёлочный чайник', 4, 's'),
      item('Лампа', 5, 's')
    ];
    const out = searchCatalog(items, 'ЧАЙ', {}, 's');
    expect(out.map(x => x.name)).toEqual(['Чайник', 'Чайник электрический', 'Ёлочный чайник', 'Малый чайник']);
    const used = searchCatalog(items, 'чай', { 'малый чайник': { n: 4, at: 1 }, 'чайник электрический': { n: 1, at: 1 } }, 'p');
    expect(used.map(x => x.name)).toEqual(['Чайник электрический', 'Чайник', 'Малый чайник', 'Ёлочный чайник']);
    expect(searchCatalog(items, 'чай', {}, 's', 2)).toHaveLength(2);
    expect(searchCatalog(items, 'елоч', {}, 's').map(x => x.name)).toEqual(['Ёлочный чайник']);
    expect(searchCatalog(items, 'zzz', {}, 's')).toEqual([]);
    expect(USAGE_LIMIT).toBe(200);
  });
});

describe('photos', () => {
  const ph = (o: Partial<Photo>): Photo => ({ id: 'a', tag: 'before', line: 'l1', note: '', at: 1, ...o });
  const lines = [{ id: 'l1', name: 'Кухня' }, { id: 'l2', name: 'Спальня' }] as Line[];

  it('exposes tags and labels', () => {
    expect(PHOTO_TAGS.map(t => t[0])).toEqual(['before', 'after', 'plate', 'meas']);
    expect(PHOTO_TAG_LABEL.meas).toBe('Замер');
  });
  it('normPhotos rejects non arrays and invalid entries', () => {
    expect(normPhotos(undefined)).toEqual([]);
    expect(normPhotos('x')).toEqual([]);
    const out = normPhotos([
      null,
      { id: 5, tag: 'before' },
      { id: '', tag: 'before' },
      { id: 'a' },
      { id: 'b', tag: 'nope' },
      { id: 'c', tag: 'after', line: 'l1', note: 'x'.repeat(200), at: '7' },
      { id: 'd', tag: 'plate', line: 5, at: 'bad' },
      { id: 'e', tag: 'meas', note: null },
      { id: 'f', tag: 'meas', line: null },
      { id: 'g', tag: 'meas', line: '' },
      { id: 'h', tag: 'meas', line: 'l2', note: null, at: 'bad' }
    ]);
    expect(out).toEqual([
      { id: 'c', tag: 'after', line: 'l1', note: 'x'.repeat(120), at: 7 },
      { id: 'h', tag: 'meas', line: 'l2', note: '', at: 0 }
    ]);
  });
  it('normPhotos caps the list', () => {
    const many = Array.from({ length: PHOTO_LIMIT + 10 }, (_, i) => ({ id: 'p' + i, tag: 'before', line: 'l1' }));
    expect(normPhotos(many)).toHaveLength(PHOTO_LIMIT);
  });
  it('captions group, deleted group and notes', () => {
    expect(photoCaption(ph({}), lines)).toBe('Г1 Кухня · До');
    expect(photoCaption(ph({ line: 'l2', tag: 'after', note: 'ok' }), lines)).toBe('Г2 Спальня · После · ok');
    expect(photoCaption(ph({ line: 'gone', tag: 'meas' }), lines)).toBe('Группа удалена · Замер');
  });
  it('collects referenced ids', () => {
    const s = referencedPhotoIds([{ photos: [ph({ id: 'x' }), ph({ id: 'y' })] }, {}, { photos: [ph({ id: 'x' })] }]);
    expect([...s].sort()).toEqual(['x', 'y']);
  });
  it('project keeps photos only with keep=true', () => {
    const src = { ...newProject(blank(), 'n'), photos: [ph({ id: 'k' })] };
    expect(normProject(src, true)?.photos).toEqual([ph({ id: 'k' })]);
    expect(normProject(src)?.photos).toEqual([]);
  });
  it('keeps line ids with keep=true and regenerates them otherwise', () => {
    const src = newProject({ sample: true, cfg: defaultCfg(), lines: sampleProject().lines }, 'n');
    const ids = src.lines.map(l => l.id);
    expect(normProject(src, true)?.lines.map(l => l.id)).toEqual(ids);
    const fresh = normProject(src)?.lines.map(l => l.id) ?? [];
    expect(fresh).toHaveLength(ids.length);
    fresh.forEach(id => expect(ids).not.toContain(id));
  });
  it('photos keep pointing at their group after a keep=true round trip', () => {
    const base = sampleProject();
    const src = { ...base, photos: [ph({ id: 'k', line: base.lines[1].id })] };
    const out = normProject(JSON.parse(JSON.stringify(src)), true);
    expect(out?.photos?.[0].line).toBe(out?.lines[1].id);
    expect(normProject(JSON.parse(JSON.stringify(src)))?.photos).toEqual([]);
    expect(normProject({ ...src, photos: undefined }, true)?.photos).toEqual([]);
  });
});
