import { useEffect, useRef, useState } from 'react';
import type { Photo, PhotoTag } from '../core/types';
import { PHOTO_LIMIT, PHOTO_TAGS, PHOTO_TAG_LABEL } from '../core/photos';
import { nid } from '../core/ids';
import { delPhoto, forgetPhotoUrl, photoUrl, putPhoto } from '../store/photos';
import { scalePhoto } from './photoScale';
import { IconCamera, IconTrash } from './Icons';
import { Seg } from './common';

export function usePhotoUrls(ids: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    let live = true;
    ids.forEach(id => {
      photoUrl(id).then(u => {
        if (live && u) setMap(m => (m[id] === u ? m : { ...m, [id]: u }));
      }, () => undefined);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return map;
}

export function PhotoStrip({
  photos, line, tags, total, onAdd, onDel, onNote, name
}: {
  photos: Photo[];
  line: string;
  tags: PhotoTag[];
  total: number;
  onAdd: (p: Photo) => void;
  onDel: (id: string) => void;
  onNote: (id: string, v: string) => void;
  name: string;
}) {
  const [tag, setTag] = useState<PhotoTag>(tags[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = usePhotoUrls(photos.map(p => p.id));
  const full = total >= PHOTO_LIMIT;
  const add = async (f: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await scalePhoto(f);
      const id = nid();
      await putPhoto(id, blob);
      onAdd({ id, tag, line, note: '', at: Date.now() });
    } catch (e) {
      void e;
      setMsg('Не удалось сохранить фото на этом устройстве');
    }
    setBusy(false);
  };
  const del = (id: string) => {
    onDel(id);
    forgetPhotoUrl(id);
    delPhoto(id).catch(() => undefined);
  };
  return (
    <div className="photos">
      <div className="photo-add">
        <Seg name={'ptag-' + name} value={tag} items={PHOTO_TAGS.filter(t => tags.includes(t[0]))} onChange={setTag} />
        <button className="btn ghost" type="button" disabled={busy || full} onClick={() => input.current?.click()} title={full ? 'Достигнут предел фото в проекте' : 'Сделать или выбрать фото'}>
          <IconCamera /> Фото
        </button>
        <input
          ref={input}
          className="pj-file"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          data-testid={'photo-input-' + name}
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            const el = e.target;
            if (f) add(f).then(() => { el.value = ''; });
          }}
        />
      </div>
      {msg && <span className="muted" role="status" style={{ color: 'var(--bad)' }}>{msg}</span>}
      {photos.length > 0 && (
        <ul className="photo-list">
          {photos.map(ph => (
            <li key={ph.id}>
              <div className="ph-img">
                {urls[ph.id] ? <img src={urls[ph.id]} alt={PHOTO_TAG_LABEL[ph.tag]} /> : <span className="muted">…</span>}
                <span className="ph-tag">{PHOTO_TAG_LABEL[ph.tag]}</span>
                <button className="icon-btn ph-del" type="button" aria-label="Удалить фото" title="Удалить фото" onClick={() => del(ph.id)}><IconTrash /></button>
              </div>
              <input type="text" maxLength={120} aria-label="Подпись к фото" placeholder="Подпись" value={ph.note} onChange={e => onNote(ph.id, e.target.value)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
