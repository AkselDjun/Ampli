import { Suspense, useEffect, useRef, useState } from 'react';
import type { Photo, PhotoTag, Trace } from '../core/types';
import { TraceSheet } from './parts';
import { toastBad } from './toast';
import { PHOTO_LIMIT, PHOTO_TAGS, PHOTO_TAG_LABEL } from '../core/photos';
import { nid } from '../core/ids';
import { photoUrl, putPhoto } from '../store/photos';
import { scalePhoto } from './photoScale';
import { IconCamera, IconTrash } from './Icons';
import { Seg } from './common';
import { Button, IconButton } from './kit';

export function usePhotoUrls(ids: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    let live = true;
    (key ? key.split(',') : []).forEach(id => {
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
  photos, line, tags, total, onAdd, onDel, onNote, onTraces, name
}: {
  photos: Photo[];
  line: string;
  tags: PhotoTag[];
  total: number;
  onAdd: (p: Photo) => void;
  onDel: (id: string) => void;
  onNote: (id: string, v: string) => void;
  onTraces?: (id: string, traces: Trace[]) => void;
  name: string;
}) {
  const [mark, setMark] = useState<string | null>(null);
  const marking = mark ? photos.find(ph => ph.id === mark) : undefined;
  const [tag, setTag] = useState<PhotoTag>(tags[0]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = usePhotoUrls(photos.map(p => p.id));
  const full = total >= PHOTO_LIMIT;
  const add = async (f: File) => {
    setBusy(true);
    try {
      const blob = await scalePhoto(f);
      const id = nid();
      await putPhoto(id, blob);
      onAdd({ id, tag, line, note: '', at: Date.now() });
    } catch (e) {
      void e;
      toastBad('Не удалось сохранить фото: в браузере не хватает места');
    }
    setBusy(false);
  };
  const del = (id: string) => onDel(id);
  return (
    <div className="photos">
      <div className="photo-add">
        <Seg name={'ptag-' + name} value={tag} items={PHOTO_TAGS.filter(t => tags.includes(t[0]))} onChange={setTag} />
        <Button variant="ghost" disabled={busy || full} onClick={() => input.current?.click()}>
          <IconCamera /> Фото
        </Button>
        {full && <span className="muted">В проекте уже {PHOTO_LIMIT} фото, это предел. Удалите лишние, чтобы добавить новые.</span>}
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
      {photos.length > 0 && (
        <ul className="photo-list">
          {photos.map(ph => (
            <li key={ph.id}>
              <div className="ph-img">
                {urls[ph.id] ? <img src={urls[ph.id]} alt={PHOTO_TAG_LABEL[ph.tag]} /> : <span className="muted">…</span>}
                <span className="ph-tag">{PHOTO_TAG_LABEL[ph.tag]}</span>
                <IconButton className="ph-del" label="Удалить фото" tip="Удалить фото" onClick={() => del(ph.id)}><IconTrash /></IconButton>
              </div>
              <input type="text" maxLength={120} aria-label="Подпись к фото" placeholder="Подпись" value={ph.note} onChange={e => onNote(ph.id, e.target.value)} />
              {ph.tag === 'wall' && onTraces && (
                <Button size="sm" variant="ghost" className="ph-tr" disabled={!urls[ph.id]} onClick={() => setMark(ph.id)}>
                  {ph.traces?.length ? 'Трассы: ' + ph.traces.length : 'Разметить трассы'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {marking && onTraces && urls[marking.id] && (
        <Suspense fallback={null}>
          <TraceSheet photo={marking} url={urls[marking.id]} onSave={tr => onTraces(marking.id, tr)} onClose={() => setMark(null)} />
        </Suspense>
      )}
    </div>
  );
}
