import { useEffect, useState } from 'react';

export const LISTBY_KEY = 'ampli-listby';

const read = (): boolean => {
  try {
    return localStorage.getItem(LISTBY_KEY) !== 'no';
  } catch (e) {
    void e;
    return true;
  }
};

const subs = new Set<(v: boolean) => void>();

export function useByRoom(): [boolean, (v: boolean) => void] {
  const [on, set] = useState(read);
  useEffect(() => {
    subs.add(set);
    return () => {
      subs.delete(set);
    };
  }, []);
  const save = (v: boolean) => {
    subs.forEach(f => f(v));
    set(v);
    try {
      localStorage.setItem(LISTBY_KEY, v ? 'room' : 'no');
    } catch (e) {
      void e;
    }
  };
  return [on, save];
}
