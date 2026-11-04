import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/types';
import { estimateUrl, ownerUrl, shareUrl } from '../core/share';
import { buildSpec } from '../core/spec';
import { calcAll } from '../core/calc';
import { useLib } from '../store/LibContext';
import { IconShare } from './Icons';
import { Tip } from './common';
import { toast, toastOk } from './toast';

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
    const names = new Set(buildSpec(calcAll(p.lines, p.cfg, p.weak)).map(i => i.name));
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
  return (
    <div className="share">
      <div className="data-row">
        <button className="btn ghost" type="button" onClick={copy}><IconShare /> {t.btn}</button>
        <Tip>{t.tip}</Tip>
      </div>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label={t.btn} />}
    </div>
  );
}
