import { clip, scrub } from './errlog';
import type { ErrEntry, ErrKind } from './errlog';

export interface ProblemEnv {
  app: string;
  norms: string;
  agent: string;
  lang: string;
  screen: string;
  online: boolean;
  lock: boolean;
  storage: string;
}

export const NOTE_MAX = 1000;

const KIND_LABEL: Record<ErrKind, string> = {
  error: 'Ошибка скрипта',
  rejection: 'Ошибка в фоне',
  render: 'Сбой экрана',
  chunk: 'Не загрузилась часть приложения',
};

const utc = (t: number): string => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function problemReport(log: readonly ErrEntry[], env: ProblemEnv, now: number, note: string): string {
  const out = [
    'Ampli ' + env.app + ' · отчёт о проблеме',
    'Создан: ' + utc(now),
    'Нормы: ' + env.norms,
    'Браузер: ' + env.agent,
    'Язык: ' + env.lang,
    'Экран: ' + env.screen,
    'Сеть: ' + (env.online ? 'есть' : 'нет'),
    'Замок на устройстве: ' + (env.lock ? 'включён' : 'выключен'),
    'Хранилище: ' + env.storage,
  ];
  const text = clip(scrub(note.trim()), NOTE_MAX);
  if (text) out.push('', 'Что случилось:', text);
  out.push('');
  if (!log.length) out.push('Ошибок не записано');
  else {
    out.push('Ошибок: ' + log.length);
    [...log].sort((a, b) => b.t - a.t).forEach((e, i) => {
      const head = [utc(e.t), KIND_LABEL[e.kind] + (e.n > 1 ? ' ×' + e.n : '')];
      if (e.where) head.push(e.where);
      if (e.ver) head.push('версия ' + e.ver);
      out.push('', i + 1 + '. ' + head.join(' · '), e.msg);
      if (e.stack) out.push(...e.stack.split('\n').map(s => '   ' + s.trim()));
    });
  }
  out.push('', 'В отчёте нет проектов, адресов, имён и контактов.');
  return out.join('\n');
}
