import type { Project } from '../core/types';
import { backupArchive, markBackup } from '../store/backup';

export function download(name: string, data: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBackup(list: Project[], now = Date.now()): Promise<boolean> {
  try {
    const f = await backupArchive(list, now);
    download(f.name, f.text, 'application/json');
    markBackup(now);
    return true;
  } catch (e) {
    void e;
    return false;
  }
}
