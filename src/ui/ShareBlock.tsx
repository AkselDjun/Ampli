import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { ownerUrl, qrSvg, shareUrl } from '../core/share';
import { IconShare } from './Icons';
import { Tip } from './common';
import { toast, toastOk } from './toast';

export function ShareBlock({ p, owner = false }: { p: Project; owner?: boolean }) {
  const [qr, setQr] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const url = () => (owner ? ownerUrl : shareUrl)(p, window.location.href);
  const copy = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      setFallback(null);
      toastOk('Ссылка скопирована');
    } catch (e) {
      void e;
      setFallback(u);
      toast('Ссылка выделена, скопируйте её вручную');
    }
  };
  const svg = qr ? qrSvg(url()) : null;
  return (
    <div className="share">
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={copy}><IconShare /> {owner ? 'Ссылка для владельца' : 'Ссылка на проект'}</button>
        <button className="btn ghost" type="button" aria-pressed={qr} onClick={() => setQr(v => !v)}>QR-код</button>
        <Tip>{owner ? 'Паспорт щитка только для просмотра. Данные хранятся в самой ссылке, без сервера. Фото не передаются.' : 'Проект хранится в самой ссылке, без сервера. Получатель добавит себе копию. Фото не передаются.'}</Tip>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label={owner ? 'Ссылка для владельца' : 'Ссылка на проект'} />}
      {qr && svg && <div className="qr" role="img" aria-label={owner ? 'QR-код паспорта' : 'QR-код проекта'} dangerouslySetInnerHTML={{ __html: svg }} />}
      {qr && !svg && <p className="muted">{owner ? 'Паспорт' : 'Проект'} слишком большой для QR-кода. Используйте ссылку.</p>}
    </div>
  );
}
