const DAY = 86400000;

const start = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const two = (n: number): string => String(n).padStart(2, '0');

export const whenLabel = (t: number, now: number): string => {
  const today = start(now);
  if (t >= today) return 'сегодня';
  if (t >= today - DAY) return 'вчера';
  const d = new Date(t);
  const dm = two(d.getDate()) + '.' + two(d.getMonth() + 1);
  return d.getFullYear() === new Date(now).getFullYear() ? dm : dm + '.' + d.getFullYear();
};

export const recentProjects = <T extends { id: string; updated: number }>(list: readonly T[], cur: string, n: number): T[] => {
  const head = list.filter(x => x.id === cur);
  const rest = list.filter(x => x.id !== cur).sort((a, b) => b.updated - a.updated);
  return [...head, ...rest].slice(0, n);
};

export const initials = (name: string): string => {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1);
  if (!words.length) return 'П';
  const s = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return s.toUpperCase();
};
