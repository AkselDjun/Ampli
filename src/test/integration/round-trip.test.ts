import { describe, expect, it } from 'vitest';
import type { Project } from '../../core/types';
import { normProject } from '../../core/project';
import { packEstimate, packProject, unpackEstimate, unpackProject } from '../../core/share';
import { APP_VERSION, NORMS_EDITION } from '../../core/version';
import { backupArchive, restorePhotos, validateBackup } from '../../store/backup';
import { delPhoto, getPhoto, putPhoto } from '../../store/photos';
import { loadBoot, readProjects, saveBoot, writeProjects } from '../../store/storage';
import { PHOTO_BYTES, fullProject, withoutIds } from './full';
import { LABOR, MARKUP, PRICES, documents } from './docs';

const fileText = (p: Project): string => JSON.stringify({ app: 'ampli', version: 1, appVersion: APP_VERSION, norms: NORMS_EDITION, ...p }, null, 2);
const shared = (p: Project) => withoutIds({ ...p, photos: [] });
const kept = (p: Project) => ({ id: p.id, lines: p.lines.map(l => l.id), photos: p.photos, content: withoutIds(p) });

describe('a project with every feature keeps its calculation and documents', () => {
  const p = fullProject();
  const docs = documents(p);

  it('through a project file', () => {
    const q = normProject(JSON.parse(fileText(p))) as Project;
    expect(q.id).not.toBe(p.id);
    expect(q.photos).toEqual([]);
    expect(shared(q)).toEqual(shared(p));
    expect(documents(q)).toEqual(docs);
  });

  it('through a project link', () => {
    const q = unpackProject(packProject(p)) as Project;
    expect(q.photos).toEqual([]);
    expect(shared({ ...q, created: p.created })).toEqual(shared(p));
    expect(documents(q)).toEqual(docs);
  });

  it('through a client estimate link with tiers, prices and work rates', () => {
    const e = unpackEstimate(packEstimate({ p, prices: PRICES, labor: LABOR, company: 'ИП Сидоров', contacts: '+375 29 000-00-00', at: p.updated, tiers: MARKUP }));
    expect(e).not.toBeNull();
    expect(e?.prices).toEqual(PRICES);
    expect(e?.labor).toEqual(LABOR);
    expect(e?.tiers).toEqual(MARKUP);
    expect(e && shared({ ...e.p, created: p.created })).toEqual(shared(p));
    expect(e && documents(e.p)).toEqual(docs);
  });

  it('through the browser storage', async () => {
    await writeProjects([p], []);
    expect((await readProjects()).map(kept)).toEqual([kept(p)]);
    expect(saveBoot(p, [p.id])).toBe(true);
    expect(loadBoot().list.map(kept)).toEqual([kept(p)]);
  });

  it('through a backup archive together with photos and wiring traces', async () => {
    for (const [id, text] of Object.entries(PHOTO_BYTES)) await putPhoto(id, new Blob([text], { type: 'image/jpeg' }));
    const data = JSON.parse((await backupArchive([p])).text);
    for (const id of Object.keys(PHOTO_BYTES)) await delPhoto(id);
    expect(() => validateBackup(data)).not.toThrow();
    const list = (data.list as unknown[]).map(x => normProject(x, true) as Project);
    expect(list.map(kept)).toEqual([kept(p)]);
    await restorePhotos(data);
    for (const [id, text] of Object.entries(PHOTO_BYTES)) expect(await (await getPhoto(id))?.text()).toBe(text);
    const q = list[0];
    expect(q.photos?.map(ph => q.lines.findIndex(l => l.id === ph.line))).toEqual([0, 2]);
    expect(documents(q)).toEqual(docs);
  });
});
