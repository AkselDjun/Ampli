import { describe, expect, it } from 'vitest';
import { newProject } from '../../core/project';
import { blank } from '../../core/templates';
import { MAX_PHOTO_BYTES, backupArchive, validateBackup } from '../../store/backup';
import { putPhoto } from '../../store/photos';
import { MAX_PROJECTS } from '../../core/limits';

const withPhoto = async () => {
  const p = { ...newProject(blank(), 'Объект'), photos: [{ id: 'ph', line: 'x', note: '', tag: 'before' as const, at: 1 }] };
  await putPhoto('ph', new Blob(['jpeg bytes'], { type: 'image/jpeg' }));
  return JSON.parse((await backupArchive([p])).text);
};

describe('hostile backups', () => {
  it.each(['image/svg+xml', 'image/gif', 'text/html', 'image/jpeg; charset=x'])('refuses a photo of type %s', async type => {
    const archive = await withPhoto();
    archive.photos.ph.type = type;
    expect(() => validateBackup(archive)).toThrow('invalid photo');
  });

  it('refuses a photo bigger than the limit before decoding it', async () => {
    const archive = await withPhoto();
    archive.photos.ph.data = 'A'.repeat(Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 4);
    expect(() => validateBackup(archive)).toThrow('invalid photo');
  });

  it('accepts png and webp photos', async () => {
    for (const type of ['image/png', 'image/webp']) {
      const archive = await withPhoto();
      archive.photos.ph.type = type;
      expect(validateBackup(archive).get('ph')?.type).toBe(type);
    }
  });

  it('refuses a backup with more projects than the limit', async () => {
    const p = newProject(blank(), 'Объект');
    const list = Array.from({ length: MAX_PROJECTS + 1 }, (_, i) => ({ ...p, id: 'p' + i }));
    expect(() => validateBackup({ app: 'ampli', kind: 'backup', version: 1, list })).toThrow('invalid projects');
  });
});
