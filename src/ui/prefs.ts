import { useState } from 'react';

export const LISTBY_KEY = 'ampli-listby';

const read = (): boolean => {
  try {
    return localStorage.getItem(LISTBY_KEY) === 'room';
  } catch (e) {
    void e;
    return false;
  }
};

export function useByRoom(): [boolean, (v: boolean) => void] {
  const [on, set] = useState(read);
  const save = (v: boolean) => {
    set(v);
    try {
      localStorage.setItem(LISTBY_KEY, v ? 'room' : 'no');
    } catch (e) {
      void e;
    }
  };
  return [on, save];
}
