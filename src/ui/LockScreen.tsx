import { useState } from 'react';
import type { FieldErr } from '../core/limits';
import { Err, errAttrs } from './common';
import { Button, Field } from './kit';
import { WrongPassword, checkPassword, recoverVault, unlockVault } from '../store/vault';

const bad = (msg: string): FieldErr => ({ msg, hard: true });

export function LockScreen({ onOpen, keepKey = false }: { onOpen: () => void | Promise<void>; keepKey?: boolean }) {
  const [mode, setMode] = useState<'pass' | 'code'>('pass');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<{ field: string; e: FieldErr } | null>(null);
  const [busy, setBusy] = useState(false);
  const errOf = (field: string) => (err?.field === field ? err.e : null);
  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };
  const open = () => run(async () => {
    if (!pass) return;
    try {
      if (keepKey) {
        if (!(await checkPassword(pass))) throw new WrongPassword();
      } else await unlockVault(pass);
    } catch (e) {
      if (e instanceof WrongPassword) {
        setErr({ field: 'lockPass', e: bad('Пароль не подходит. Проверьте раскладку и регистр') });
        return;
      }
      setErr({ field: 'lockPass', e: bad('Не удалось открыть данные на этом устройстве') });
      return;
    }
    await onOpen();
  });
  const recover = () => run(async () => {
    if (!next) {
      setErr({ field: 'lockNew', e: bad('Придумайте новый пароль') });
      return;
    }
    if (next !== again) {
      setErr({ field: 'lockAgain', e: bad('Пароли не совпадают') });
      return;
    }
    try {
      await recoverVault(code, next);
    } catch (e) {
      void e;
      setErr({ field: 'lockCode', e: bad('Код не подходит. Проверьте буквы и цифры') });
      return;
    }
    await onOpen();
  });
  return (
    <main className="lock" aria-labelledby="lock-t">
      {mode === 'pass' ? (
        <form className="lock-card" onSubmit={e => { e.preventDefault(); void open(); }}>
          <h1 id="lock-t">Ampli заблокирован</h1>
          <p>Проекты, замеры и фото на этом устройстве зашифрованы. Введите пароль, чтобы продолжить.</p>
          <Field id="lockPass" label="Пароль">
            <input id="lockPass" type="password" autoComplete="current-password" autoFocus maxLength={128} value={pass} onChange={e => { setPass(e.target.value); setErr(null); }} {...errAttrs(errOf('lockPass'), 'lockPassErr')} />
            <Err e={errOf('lockPass')} id="lockPassErr" />
          </Field>
          <div className="lock-act">
            <Button variant="primary" type="submit" disabled={!pass || busy}>{busy ? 'Открываю…' : 'Открыть'}</Button>
            <Button variant="ghost" onClick={() => { setMode('code'); setErr(null); }}>Забыли пароль?</Button>
          </div>
        </form>
      ) : (
        <form className="lock-card" onSubmit={e => { e.preventDefault(); void recover(); }}>
          <h1 id="lock-t">Новый пароль по коду</h1>
          <p>Введите код восстановления, который вы сохранили при включении замка, и задайте новый пароль.</p>
          <Field id="lockCode" label="Код восстановления">
            <input id="lockCode" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} value={code} onChange={e => { setCode(e.target.value); setErr(null); }} {...errAttrs(errOf('lockCode'), 'lockCodeErr')} />
            <Err e={errOf('lockCode')} id="lockCodeErr" />
          </Field>
          <Field id="lockNew" label="Новый пароль">
            <input id="lockNew" type="password" autoComplete="new-password" maxLength={128} value={next} onChange={e => { setNext(e.target.value); setErr(null); }} {...errAttrs(errOf('lockNew'), 'lockNewErr')} />
            <Err e={errOf('lockNew')} id="lockNewErr" />
          </Field>
          <Field id="lockAgain" label="Новый пароль ещё раз">
            <input id="lockAgain" type="password" autoComplete="new-password" maxLength={128} value={again} onChange={e => { setAgain(e.target.value); setErr(null); }} {...errAttrs(errOf('lockAgain'), 'lockAgainErr')} />
            <Err e={errOf('lockAgain')} id="lockAgainErr" />
          </Field>
          <div className="lock-act">
            <Button variant="primary" type="submit" disabled={!code || busy}>{busy ? 'Проверяю…' : 'Сменить пароль и открыть'}</Button>
            <Button variant="ghost" onClick={() => { setMode('pass'); setErr(null); }}>Назад</Button>
          </div>
        </form>
      )}
    </main>
  );
}
