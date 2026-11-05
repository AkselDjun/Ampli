import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { estimateUrl, ownerUrl, shareUrl } from '../core/share';
import { buildSpec } from '../core/spec';
import { calcAll } from '../core/calc';
import { useLib } from '../store/LibContext';
import { IconShare } from './Icons';
import { Tip } from './common';
import { toast, toastOk } from './toast';
import { shareText, telegramUrl, viberUrl } from '../core/message';
import { Button } from './kit';

type Kind = 'project' | 'owner' | 'estimate';

const TEXT: Record<Kind, { btn: string; tip: string }> = {
  project: { btn: 'Ссылка на проект', tip: 'Проект хранится в самой ссылке, без сервера. Получатель добавит себе копию. Фото не передаются.' },
  owner: { btn: 'Ссылка для владельца', tip: 'Паспорт щитка только для просмотра. Данные хранятся в самой ссылке, без сервера. Фото не передаются.' },
  estimate: { btn: 'Ссылка для клиента', tip: 'Клиент увидит смету и итог «работы + материалы» с текущими ценами, без редактора. Кнопкой «Согласовать» он отправит вам подтверждение.' }
};

export function ShareBlock({ p, owner = false, kind }: { p: Project; owner?: boolean; kind?: Kind }) {
  const k: Kind = kind ?? (owner ? 'owner' : 'project');
  const { lib } = useLib();
  const [fallback, setFallback] = useState<string | null>(null);
  const [send, setSend] = useState<{ url: string; text: string } | null>(null);
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
    const names = new Set(buildSpec(calcAll(p.lines, p.cfg, p)).map(i => i.name));
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
  const toggle = () => {
    if (send) {
      setSend(null);
      return;
    }
    const u = url();
    setSend({ url: u, text: shareText(k, p, u) });
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
        <Button variant="ghost" onClick={copy}><IconShare /> {t.btn}</Button>
        <Button variant="ghost" aria-expanded={send !== null} onClick={toggle}>Отправить в Viber или Telegram</Button>
        <Tip>{t.tip}</Tip>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label={t.btn} />}
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
