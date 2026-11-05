import { useEffect, useState } from 'react';

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const f = () => setNow(Date.now());
    window.addEventListener('beforeprint', f);
    return () => window.removeEventListener('beforeprint', f);
  }, []);
  return now;
}
