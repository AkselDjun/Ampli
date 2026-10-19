import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { qrSvg, shareUrl } from '../core/share';
import { IconShare } from './Icons';
import { Tip } from './common';

export function ShareBlock({ p }: { p: Project }) {
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [qr, setQr] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const note = (t: string, bad = false) => {
    setMsg({ t, bad });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 4000);
  };
  const url = () => shareUrl(p, window.location.href);
  const copy = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      setFallback(null);
      note('Ссылка скопирована');
    } catch (e) {
      void e;
      setFallback(u);
      note('Ссылка выделена, скопируйте её вручную', true);
    }
  };
  const svg = qr ? qrSvg(url()) : null;
  return (
    <div className="share">
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={copy}><IconShare /> Ссылка на проект</button>
        <button className="btn ghost" type="button" aria-pressed={qr} onClick={() => setQr(v => !v)}>QR-код</button>
        <Tip>Проект целиком записывается в ссылку, сервер не нужен. Получатель откроет её в браузере и сможет добавить копию проекта к себе. Фото в ссылку не входят.</Tip>
      </div>
      {msg && <span className="muted" role="status" style={{ color: msg.bad ? 'var(--bad)' : 'var(--ok)' }}>{msg.t}</span>}
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label="Ссылка на проект" />}
      {qr && svg && <div className="qr" role="img" aria-label="QR-код проекта" dangerouslySetInnerHTML={{ __html: svg }} />}
      {qr && !svg && <p className="muted">Проект слишком большой для QR-кода. Используйте ссылку.</p>}
    </div>
  );
}
