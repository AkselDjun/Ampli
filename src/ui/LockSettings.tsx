import { useState } from 'react';
import type { Project } from '../core/types';
import type { FieldErr } from '../core/limits';
import { Err, errAttrs } from './common';
import { Button, Field } from './kit';
import { toast, toastBad, toastOk } from './toast';
import { WrongPassword, lockEnabled, newRecoveryCode } from '../store/vault';
import { lockNow } from './LockGate';

type Mode = 'idle' | 'setup' | 'off';

const bad = (msg: string): FieldErr => ({ msg, hard: true });

export function LockSettings({ list, cur }: { list: Project[]; cur: string }) {
  const [on, setOn] = useState(lockEnabled);
  const [mode, setMode] = useState<Mode>('idle');
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<{ field: string; e: FieldErr } | null>(null);
  const [busy, setBusy] = useState(false);
  const errOf = (field: string) => (err?.field === field ? err.e : null);
  const reset = (m: Mode) => {
    setMode(m);
    setPass('');
    setAgain('');
    setSaved(false);
    setErr(null);
    setCode(m === 'setup' ? newRecoveryCode() : '');
  };
  const order = list.map(p => p.id);
  const enable = async () => {
    if (!pass) return setErr({ field: 'lkPass', e: bad('Придумайте пароль') });
    if (pass !== again) return setErr({ field: 'lkAgain', e: bad('Пароли не совпадают') });
    setBusy(true);
    try {
      const { enableLock } = await import('../store/lock');
      await enableLock(pass, code, list, cur, order);
      setOn(true);
      reset('idle');
      toastOk('Замок включён. Данные на устройстве зашифрованы');
    } catch (e) {
      void e;
      toastBad('Не удалось включить замок. Данные остались как были');
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    if (!pass) return;
    setBusy(true);
    try {
      const { disableLock } = await import('../store/lock');
      await disableLock(pass, list, cur, order);
      setOn(false);
      reset('idle');
      toastOk('Замок выключен. Данные на устройстве больше не шифруются');
    } catch (e) {
      if (e instanceof WrongPassword) setErr({ field: 'lkOff', e: bad('Пароль не подходит. Проверьте раскладку и регистр') });
      else toastBad('Не удалось выключить замок. Попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toastOk('Код скопирован');
    } catch (e) {
      void e;
      toast('Выделите код и скопируйте его вручную');
    }
  };
  if (on) {
    return (
      <div className="lock-set">
        <p className="muted">Замок включён. Проекты, замеры и фото на этом устройстве зашифрованы. Пароль спрашивается при запуске и после 5 минут в фоне.</p>
        {mode === 'off' ? (
          <form className="lock-set" onSubmit={e => { e.preventDefault(); void disable(); }}>
            <Field id="lkOff" label="Пароль замка" wide>
              <input id="lkOff" type="password" autoComplete="current-password" maxLength={128} value={pass} onChange={e => { setPass(e.target.value); setErr(null); }} {...errAttrs(errOf('lkOff'), 'lkOffErr')} />
              <Err e={errOf('lkOff')} id="lkOffErr" />
            </Field>
            <div className="data-row">
              <Button variant="danger" type="submit" disabled={!pass || busy}>{busy ? 'Расшифровываю…' : 'Выключить замок'}</Button>
              <Button variant="ghost" onClick={() => reset('idle')}>Отмена</Button>
            </div>
          </form>
        ) : (
          <div className="data-row">
            <Button variant="ghost" onClick={lockNow}>Заблокировать сейчас</Button>
            <Button variant="ghost" onClick={() => reset('off')}>Выключить замок</Button>
          </div>
        )}
      </div>
    );
  }
  if (mode !== 'setup') {
    return (
      <div className="lock-set">
        <p className="muted">Замок шифрует проекты, замеры и фото на этом устройстве. Приложение будет спрашивать пароль при запуске и после 5 минут в фоне.</p>
        <div className="data-row">
          <Button variant="ghost" onClick={() => reset('setup')}>Включить замок</Button>
        </div>
      </div>
    );
  }
  return (
    <form className="lock-set" aria-label="Включение замка" onSubmit={e => { e.preventDefault(); void enable(); }}>
      <div className="meta-grid">
        <Field id="lkPass" label="Пароль">
          <input id="lkPass" type="password" autoComplete="new-password" maxLength={128} value={pass} onChange={e => { setPass(e.target.value); setErr(null); }} {...errAttrs(errOf('lkPass'), 'lkPassErr')} />
          <Err e={errOf('lkPass')} id="lkPassErr" />
        </Field>
        <Field id="lkAgain" label="Пароль ещё раз">
          <input id="lkAgain" type="password" autoComplete="new-password" maxLength={128} value={again} onChange={e => { setAgain(e.target.value); setErr(null); }} {...errAttrs(errOf('lkAgain'), 'lkAgainErr')} />
          <Err e={errOf('lkAgain')} id="lkAgainErr" />
        </Field>
      </div>
      <p className="muted">Код восстановления нужен, если вы забудете пароль. Без пароля и без кода данные не вернуть. Запишите код на бумаге или сохраните в менеджере паролей.</p>
      <output className="lock-code" aria-label="Код восстановления">{code}</output>
      <div className="data-row">
        <Button variant="ghost" onClick={() => { void copyCode(); }}>Скопировать код</Button>
      </div>
      <label className="lock-ok">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
        <span>Код восстановления записан или сохранён</span>
      </label>
      <div className="data-row">
        <Button variant="primary" type="submit" disabled={!saved || busy}>{busy ? 'Шифрую…' : 'Включить замок'}</Button>
        <Button variant="ghost" onClick={() => reset('idle')}>Отмена</Button>
      </div>
    </form>
  );
}
