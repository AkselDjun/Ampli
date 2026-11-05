import { Component } from 'react';
import type { ReactNode } from 'react';
import { KEY } from '../store/storage';
import { LIB_KEY } from '../store/lib';
import { download } from './download';

const backup = (): void => {
  const out: Record<string, unknown> = {};
  [KEY, LIB_KEY].forEach(k => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = JSON.parse(v);
    } catch (e) {
      void e;
    }
  });
  download('ampli-backup.json', JSON.stringify(out, null, 1), 'application/json');
};

export class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };

  static getDerivedStateFromError(): { err: boolean } {
    return { err: true };
  }

  reset = (): void => {
    backup();
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      void e;
    }
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
          <button className="btn" type="button" onClick={backup}>Скачать резервную копию</button>
          <button className="btn" type="button" onClick={() => window.location.reload()}>Перезагрузить</button>
          <button className="btn danger" type="button" onClick={this.reset}>Скачать копию и начать заново</button>
        </div>
      </main>
    );
  }
}
