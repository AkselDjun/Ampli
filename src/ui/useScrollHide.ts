import { useEffect, useState } from 'react';

export function useScrollHide(on: boolean, from = 80): boolean {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    if (!on) return;
    let last = window.scrollY;
    const run = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHide(y > last && y > from);
      last = y;
    };
    window.addEventListener('scroll', run, { passive: true });
    return () => window.removeEventListener('scroll', run);
  }, [on, from]);
  return on && hide;
}
