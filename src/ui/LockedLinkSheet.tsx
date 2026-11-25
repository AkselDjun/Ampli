import { useState } from 'react';
import type { LockedLink, UnlockResult } from '../app/useAppLocation';
import { Err, Sheet, errAttrs } from './common';
import { Button, Field } from './kit';

const WRONG = { msg: 'Пароль не подходит. Проверьте раскладку и регистр', hard: true };

export function LockedLinkSheet({ link, onUnlock, onCancel }: { link: LockedLink | null; onUnlock: (password: string) => Promise<UnlockResult>; onCancel: () => void }) {
  const [pass, setPass] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState(link?.data);
  if (shownFor !== link?.data) {
    setShownFor(link?.data);
    setPass('');
    setWrong(false);
  }
  const what = link?.kind === 'owner' ? 'Паспорт щитка' : 'Проект';
  const submit = async () => {
    if (!pass || busy) return;
    setBusy(true);
    const r = await onUnlock(pass);
    setBusy(false);
    if (r === 'wrong') setWrong(true);
  };
  return (
    <Sheet
      open={link !== null}
      onClose={onCancel}
      title="Ссылка защищена паролем"
      kind="dialog"
      historyLayer={false}
      footer={link && (
        <>
          <span className="foot-st" />
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button variant="primary" disabled={!pass || busy} onClick={() => { void submit(); }}>{busy ? 'Открываю…' : 'Открыть'}</Button>
        </>
      )}
    >
      {link && (
        <form id="unlock-link" onSubmit={e => { e.preventDefault(); void submit(); }}>
          <p>{what} в этой ссылке зашифрован. Введите пароль, который вам прислали отдельно.</p>
          <Field id="linkPass" label="Пароль" wide>
            <input id="linkPass" type="password" autoComplete="off" autoFocus maxLength={128} value={pass} onChange={e => { setPass(e.target.value); setWrong(false); }} {...errAttrs(wrong ? WRONG : null, 'linkPassErr')} />
            <Err e={wrong ? WRONG : null} id="linkPassErr" />
          </Field>
        </form>
      )}
    </Sheet>
  );
}
