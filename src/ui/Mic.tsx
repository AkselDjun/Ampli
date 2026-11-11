import { useEffect, useRef, useState } from 'react';
import { listen, speechSupported, VOICE_NOTE_KEY } from './voice';
import { spokenToText } from '../core/spoken';
import { toast, toastBad } from './toast';

export function Mic({ onText, rooms = false, label }: { onText: (t: string) => void; rooms?: boolean; label: string }) {
  const [on, setOn] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  if (!speechSupported()) return null;
  const toggle = () => {
    if (on) {
      stop.current?.();
      return;
    }
    try {
      if (!localStorage.getItem(VOICE_NOTE_KEY)) {
        localStorage.setItem(VOICE_NOTE_KEY, '1');
        toast('Речь распознаёт браузер. В Chrome звук для этого отправляется на серверы Google.');
      }
    } catch (e) {
      void e;
    }
    setOn(true);
    stop.current = listen(t => onText(spokenToText(t, rooms)), err => {
      stop.current = null;
      setOn(false);
      if (err) toastBad(err);
    });
  };
  return (
    <button type="button" className={'mic' + (on ? ' on' : '')} aria-pressed={on} aria-label={on ? 'Остановить диктовку' : label} data-tip={on ? 'Остановить диктовку' : label} onClick={toggle}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
      <span>{on ? 'Слушаю…' : 'Диктовать'}</span>
    </button>
  );
}
