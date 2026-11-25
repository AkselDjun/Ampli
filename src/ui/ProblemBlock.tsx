import { useEffect, useState } from 'react';
import { NOTE_MAX, problemReport } from '../core/problem';
import type { ProblemEnv } from '../core/problem';
import { dfmt } from '../core/format';
import { clearErrors, readErrors } from '../store/errlog';
import { ArmButton } from './common';
import { download } from './download';
import { SecTitle } from './fields';
import { Button, Field, buttonClass } from './kit';
import { canShareFile, problemEnv, problemFile, shareProblem } from './problem';
import { SUPPORT_URL } from './release';
import { toastBad, toastOk } from './toast';

const countText = (n: number): string => {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return n + ' ошибка';
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return n + ' ошибки';
  return n + ' ошибок';
};

export function ProblemBlock() {
  const [log, setLog] = useState(readErrors);
  const [note, setNote] = useState('');
  const [env, setEnv] = useState<{ at: number; env: ProblemEnv } | null>(null);
  const [share] = useState(() => canShareFile('ampli.txt', 'Ampli'));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void problemEnv().then(e => { if (live) setEnv({ at: Date.now(), env: e }); });
    return () => { live = false; };
  }, []);
  const last = log.length ? log.reduce((a, b) => (b.t > a.t ? b : a)) : null;
  const preview = env ? problemReport(log, env.env, env.at, note) : '';
  const save = async () => {
    setBusy(true);
    try {
      const f = await problemFile(note);
      download(f.name, f.text, 'text/plain;charset=utf-8');
      toastOk('Отчёт скачан. Приложите файл к сообщению разработчику');
    } catch (e) {
      void e;
      toastBad('Не удалось подготовить отчёт. Попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    setBusy(true);
    try {
      const f = await problemFile(note);
      if ((await shareProblem(f.name, f.text)) === 'sent') toastOk('Отчёт отправлен');
    } catch (e) {
      void e;
      toastBad('Не удалось отправить отчёт. Скачайте его и отправьте файлом');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SecTitle tipLabel="Что в отчёте" tip="Версия приложения, браузер, экран и последние ошибки. Проектов, адресов, имён и контактов в отчёте нет.">Сообщить о проблеме</SecTitle>
      <p className="muted" role="status">
        {last ? 'На этом устройстве записано: ' + countText(log.length) + ', последняя ' + dfmt(last.t) + '.' : 'Ошибок на этом устройстве не записано.'}
      </p>
      <div className="meta-grid">
        <Field id="problemNote" label="Что случилось, необязательно" wide hint="Например: после добавления группы не открывается смета">
          <textarea id="problemNote" rows={3} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} />
        </Field>
      </div>
      <details className="problem-d">
        <summary>Что увидит разработчик</summary>
        <pre className="problem-pre" tabIndex={0} aria-label="Текст отчёта">{preview || 'Готовлю отчёт…'}</pre>
      </details>
      <div className="data-row problem-act">
        {share && <Button variant="ghost" disabled={busy} onClick={() => void send()}>Отправить отчёт</Button>}
        <Button variant="ghost" disabled={busy} onClick={() => void save()}>Скачать отчёт</Button>
        <a className={buttonClass('ghost')} href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Написать разработчику</a>
        {log.length > 0 && <ArmButton variant="ghost" label="Очистить журнал" armedLabel="Очистить? Нажмите ещё раз" onRun={() => { clearErrors(); setLog([]); toastOk('Журнал ошибок очищен'); }} />}
      </div>
    </>
  );
}
