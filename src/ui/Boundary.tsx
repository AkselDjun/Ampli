import { Component } from 'react';
import type { ReactNode } from 'react';
import { BOOT_KEY, KEY, clearProjects, readProjects } from '../store/storage';
import { backupArchive } from '../store/backup';
import { LIB_KEY } from '../store/lib';
import { download } from './download';
import { Button } from './kit';

const backup = async (): Promise<{ name: string; text: string }> => {
  const out: Record<string, unknown> = {};
  [KEY, BOOT_KEY, LIB_KEY].forEach(k => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = JSON.parse(v);
    } catch (e) {
      void e;
    }
  });
  out.projects = await readProjects();
  const archive = await backupArchive(out.projects as Awaited<ReturnType<typeof readProjects>>);
  const result = { name: archive.name, text: JSON.stringify({ ...out, ...JSON.parse(archive.text) }) };
  return result;
};

export class Boundary extends Component<{ children: ReactNode }, { err: boolean; message: string }> {
  state = { err: false, message: '' };

  static getDerivedStateFromError(): { err: boolean; message: string } {
    return { err: true, message: '' };
  }

  save = async (): Promise<void> => {
    try {
      const file = await backup();
      download(file.name, file.text, 'application/json');
      this.setState({ message: 'Копия подготовлена. Проверьте папку загрузок.' });
    } catch (e) {
      void e;
      this.setState({ message: 'Не удалось подготовить полную копию. Данные не удалены.' });
    }
  };

  reset = async (): Promise<void> => {
    try {
      const file = await backup();
      const picker = (window as Window & { showSaveFilePicker?: (options: object) => Promise<{ createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
      if (!picker) throw new Error('save picker unavailable');
      const handle = await picker({ suggestedName: file.name });
      const stream = await handle.createWritable();
      await stream.write(file.text);
      await stream.close();
    } catch (e) {
      void e;
      this.setState({ message: 'Не удалось подтвердить сохранение копии. Данные не удалены. Скачайте копию отдельно и проверьте файл.' });
      return;
    }
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(BOOT_KEY);
    } catch (e) {
      void e;
    }
    await clearProjects().catch(() => undefined);
    window.location.hash = '';
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.err) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>Что-то пошло не так</h1>
        <p>Приложение не смогло показать проект. Скорее всего, данные проекта повреждены. Скачайте резервную копию, чтобы ничего не потерять, и перезагрузите страницу.</p>
        <div className="crash-act">
          <Button onClick={() => void this.save()}>Скачать резервную копию</Button>
          <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
          <Button variant="danger" onClick={() => void this.reset()}>Скачать копию и начать заново</Button>
        </div>
        {this.state.message && <p role="status">{this.state.message}</p>}
      </main>
    );
  }
}
