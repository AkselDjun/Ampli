import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { estimateUrl, ownerUrl, qrSvg, shareUrl } from '../core/share';
import { buildSpec } from '../core/spec';
import { calcAll } from '../core/calc';
import { useLib } from '../store/LibContext';
import { IconShare } from './Icons';
import { Tip } from './common';
import { toast, toastOk } from './toast';

type Kind = 'project' | 'owner' | 'estimate';

const TEXT: Record<Kind, { btn: string; qr: string; big: string; tip: string }> = {
  project: { btn: 'Ссылка на проект', qr: 'QR-код проекта', big: 'Проект', tip: 'Проект хранится в самой ссылке, без сервера. Получатель добавит себе копию. Фото не передаются.' },
  owner: { btn: 'Ссылка для владельца', qr: 'QR-код паспорта', big: 'Паспорт', tip: 'Паспорт щитка только для просмотра. Данные хранятся в самой ссылке, без сервера. Фото не передаются.' },
  estimate: { btn: 'Ссылка для клиента', qr: 'QR-код сметы', big: 'Смета', tip: 'Клиент увидит смету и итог «работы + материалы» с текущими ценами, без редактора. Кнопкой «Согласовать» он отправит вам подтверждение.' }
};

export function ShareBlock({ p, owner = false, kind }: { p: Project; owner?: boolean; kind?: Kind }) {
  const k: Kind = kind ?? (owner ? 'owner' : 'project');
  const { lib } = useLib();
  const [qr, setQr] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const url = (): string => {
    const base = window.location.href;
    if (k === 'owner') return ownerUrl(p, base);
    if (k === 'project') return shareUrl(p, base);
    const names = new Set(buildSpec(calcAll(p.lines, p.cfg)).map(i => i.name));
    const prices: Record<string, number> = {};
    Object.entries(lib.prices).forEach(([n, v]) => {
      if (names.has(n)) prices[n] = v;
    });
    return estimateUrl({ p, prices, labor: lib.labor, company: lib.brand.company, contacts: lib.brand.contacts, at: Date.now() }, base);
  };
  const t = TEXT[k];
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
        <button className="btn ghost" type="button" onClick={copy}><IconShare /> {t.btn}</button>
        <button className="btn ghost" type="button" aria-pressed={qr} onClick={() => setQr(v => !v)}>QR-код</button>
        <Tip>{t.tip}</Tip>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label={t.btn} />}
      {qr && svg && <div className="qr" role="img" aria-label={t.qr} dangerouslySetInnerHTML={{ __html: svg }} />}
      {qr && !svg && <p className="muted">{t.big} слишком большой для QR-кода. Используйте ссылку.</p>}
    </div>
  );
}
