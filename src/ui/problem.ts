import { problemReport } from '../core/problem';
import type { ProblemEnv } from '../core/problem';
import { APP_VERSION, NORMS_EDITION } from '../core/version';
import { readErrors } from '../store/errlog';
import { lockEnabled } from '../store/vault';

const mb = (bytes: number): string => (bytes / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' МБ';

async function storageInfo(): Promise<string> {
  try {
    const s = navigator.storage;
    if (!s) return 'нет данных';
    const kept = typeof s.persisted === 'function' ? await s.persisted() : false;
    const est = typeof s.estimate === 'function' ? await s.estimate() : null;
    const used = est && typeof est.usage === 'number' ? ', занято ' + mb(est.usage) : '';
    return (kept ? 'сохраняется постоянно' : 'браузер может очистить') + used;
  } catch (e) {
    void e;
    return 'нет данных';
  }
}

export async function problemEnv(): Promise<ProblemEnv> {
  return {
    app: APP_VERSION,
    norms: NORMS_EDITION,
    agent: navigator.userAgent,
    lang: navigator.language,
    screen: window.innerWidth + '×' + window.innerHeight + ', ×' + Math.round(window.devicePixelRatio * 100) / 100,
    online: navigator.onLine,
    lock: lockEnabled(),
    storage: await storageInfo(),
  };
}

export const problemName = (now: number): string => 'ampli-problem-' + new Date(now).toISOString().slice(0, 10) + '.txt';

export async function problemFile(note: string, now = Date.now()): Promise<{ name: string; text: string }> {
  return { name: problemName(now), text: problemReport(readErrors(), await problemEnv(), now, note) };
}

export function canShareFile(name: string, text: string): boolean {
  try {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
    return navigator.canShare({ files: [new File([text], name, { type: 'text/plain' })] });
  } catch (e) {
    void e;
    return false;
  }
}

export async function shareProblem(name: string, text: string): Promise<'sent' | 'cancel'> {
  try {
    await navigator.share({ title: 'Отчёт о проблеме Ampli', files: [new File([text], name, { type: 'text/plain' })] });
    return 'sent';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancel';
    throw e;
  }
}
