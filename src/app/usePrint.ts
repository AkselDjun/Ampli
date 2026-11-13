import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Project } from '../core/types';
import type { PrintMode } from '../ui/WorkSheet';
import { useStable } from '../ui/hold';

const waitPhotos = async (n: number): Promise<void> => {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.pd-photo img'));
    if (imgs.length >= n && imgs.every(i => i.complete)) return;
    await new Promise<void>(r => window.setTimeout(r, 100));
  }
};

export interface PrintApi {
  printing: boolean;
  printModes: PrintMode[];
  doPrint: (mode?: PrintMode | PrintMode[]) => void;
}

export function usePrint(p: Project): PrintApi {
  const [printModes, setPrintModes] = useState<PrintMode[]>(['report']);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const doPrint = useStable((mode: PrintMode | PrintMode[] = 'report') => {
    const modes = Array.isArray(mode) ? mode : [mode];
    setPrintModes(modes);
    setPrinting(true);
    const prev = document.title;
    document.title = 'Ampli — ' + (p.name || 'расчёт');
    const printNow = () => {
      try {
        window.print();
      } catch (e) {
        void e;
      }
      document.title = prev;
    };
    window.setTimeout(() => {
      const n = (p.photos ?? []).length;
      if (modes.includes('proto') && n > 0) waitPhotos(n).then(printNow);
      else printNow();
    }, 50);
  });

  return { printing, printModes, doPrint };
}
