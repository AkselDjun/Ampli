import { Component } from 'react';
import type { ReactNode } from 'react';
import { BOOT_KEY, KEY, clearProjects, readProjects } from '../store/storage';
import { LIB_KEY } from '../store/lib';
import { download } from './download';
import { Button } from './kit';

const backup = async (): Promise<void> => {
  const out: Record<string, unknown> = {};
  [KEY, BOOT_KEY, LIB_KEY].forEach(k => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = JSON.parse(v);
    } catch (e) {
      void e;
    }
  });
  try {
    out.projects = await readProjects();
  } catch (e) {
    void e;
  }
  download('ampli-backup.json', JSON.stringify(out, null, 1), 'application/json');
};

export class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };

  static getDerivedStateFromError(): { err: boolean } {
    return { err: true };
  }

  reset = async (): Promise<void> => {
    await backup();
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
          <Button onClick={() => void backup()}>Скачать резервную копию</Button>
          <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
          <Button variant="danger" onClick={() => void this.reset()}>Скачать копию и начать заново</Button>
        </div>
      </main>
    );
  }
}
