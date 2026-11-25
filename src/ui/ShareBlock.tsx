import { Suspense, useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { estimateUrl, lockedUrl, ownerUrl, shareUrl } from '../core/share';
import { buildSpec } from '../core/spec';
import { calcAll } from '../core/calc';
import { tierPriceNames } from '../core/tiers';
import { useLib } from '../store/LibContext';
import { IconShare } from './Icons';
import { Tip } from './common';
import { toast, toastOk } from './toast';
import { shareText, telegramUrl, viberUrl } from '../core/message';
import { Button } from './kit';
import { Qr } from './parts';

type Kind = 'project' | 'owner' | 'estimate';

const TEXT: Record<Kind, { btn: string; qr: string; big: string; tip: string }> = {
  project: { btn: 'Ссылка на проект', qr: 'QR-код проекта', big: 'Проект слишком большой для QR-кода. Отправьте ссылку.', tip: 'Проект хранится в самой ссылке, без сервера. Получатель добавит себе копию. Фото не передаются.' },
  owner: { btn: 'Ссылка для владельца', qr: 'QR-код паспорта', big: 'Паспорт слишком большой для QR-кода. Отправьте ссылку.', tip: 'Паспорт щитка только для просмотра. Данные хранятся в самой ссылке, без сервера. Фото не передаются.' },
  estimate: { btn: 'Ссылка для клиента', qr: 'QR-код сметы', big: 'Смета слишком большая для QR-кода. Отправьте ссылку.', tip: 'Клиент увидит смету и итог «работы + материалы» с текущими ценами, без редактора. Кнопкой «Согласовать» он отправит вам подтверждение.' }
};

export function ShareBlock({ p, owner = false, kind, password = '' }: { p: Project; owner?: boolean; kind?: Kind; password?: string }) {
  const k: Kind = kind ?? (owner ? 'owner' : 'project');
  const { lib } = useLib();
  const [fallback, setFallback] = useState<string | null>(null);
  const [send, setSend] = useState<{ url: string; text: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const locked = k !== 'estimate' && password !== '';
  const withUrl = (run: (u: string) => void | Promise<void>): void | Promise<void> => {
    if (!locked) return run(url());
    setBusy(true);
    return lockedUrl(p, window.location.href, password, k === 'owner').then(run).finally(() => setBusy(false));
  };
  const url = (at: number = Date.now()): string => {
    const base = window.location.href;
    if (k === 'owner') return ownerUrl(p, base);
    if (k === 'project') return shareUrl(p, base);
    const names = lib.tiers.on ? tierPriceNames(p) : new Set(buildSpec(calcAll(p.lines, p.cfg, p)).map(i => i.name));
    const prices: Record<string, number> = {};
    Object.entries(lib.prices).forEach(([n, v]) => {
      if (names.has(n)) prices[n] = v;
    });
    return estimateUrl({ p, prices, labor: lib.labor, company: lib.brand.company, contacts: lib.brand.contacts, at, ...(lib.tiers.on ? { tiers: lib.tiers.markup } : {}) }, base);
  };
  const t = TEXT[k];
  const copyUrl = async (u: string) => {
    try {
      await navigator.clipboard.writeText(u);
      setFallback(null);
      toastOk(locked ? 'Ссылка с паролем скопирована. Пароль отправьте отдельно' : 'Ссылка скопирована');
    } catch (e) {
      void e;
      setFallback(u);
      toast('Ссылка выделена, скопируйте её вручную');
    }
  };
  const copy = () => withUrl(copyUrl);
  const toggle = () => {
    if (send) {
      setSend(null);
      return;
    }
    return withUrl(u => setSend({ url: u, text: shareText(k, p, u, locked) }));
  };
  const toggleQr = () => {
    if (qr !== null) {
      setQr(null);
      return;
    }
    return withUrl(setQr);
  };
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastOk('Текст скопирован');
    } catch (e) {
      void e;
      toast('Выделите текст и скопируйте его вручную');
    }
  };
  const other = async (text: string) => {
    try {
      await navigator.share({ text });
    } catch (e) {
      void e;
    }
  };
  const canShare = typeof navigator.share === 'function';
  return (
    <div className="share">
      <div className="data-row">
        <Button variant="ghost" disabled={busy} onClick={() => { void copy(); }}><IconShare /> {locked ? t.btn + ' с паролем' : t.btn}</Button>
        <Button variant="ghost" disabled={busy} aria-expanded={send !== null} onClick={() => { void toggle(); }}>Отправить в Viber или Telegram</Button>
        <Button variant="ghost" disabled={busy} aria-pressed={qr !== null} onClick={() => { void toggleQr(); }}>QR-код</Button>
        <Tip>{t.tip}</Tip>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label={t.btn} />}
      {qr !== null && <Suspense fallback={null}><Qr text={qr} label={t.qr} tooBig={t.big} /></Suspense>}
      {send && (
        <div className="send">
          <label className="lbl" htmlFor={'msg-' + k}>Текст сообщения</label>
          <textarea id={'msg-' + k} className="send-text" value={send.text} onChange={e => setSend({ ...send, text: e.target.value })} />
          <div className="data-row">
            <a className="btn ghost send-viber" href={viberUrl(send.text)}>Viber</a>
            <a className="btn ghost send-tg" href={telegramUrl(send.text, send.url)} target="_blank" rel="noopener noreferrer">Telegram</a>
            {canShare && <Button variant="ghost" onClick={() => void other(send.text)}>Другое приложение</Button>}
            <Button variant="ghost" onClick={() => void copyText(send.text)}>Копировать текст</Button>
          </div>
        </div>
      )}
    </div>
  );
}
