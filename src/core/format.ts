export const NB = ' ';

export const pn = (v: unknown, d: number): number => {
  const x = parseFloat(String(v).replace(',', '.'));
  return isFinite(x) ? x : d;
};

const NF = new Map<number, Intl.NumberFormat>();

export const fmt = (n: number, d = 1): string => {
  let f = NF.get(d);
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
    NF.set(d, f);
  }
  return f.format(n);
};

export const fs = (s: number | string): string => String(s).replace('.', ',');

export const round2 = (x: number): number => Math.round(x * 100) / 100;

export const plural = (n: number, f: [string, string, string]): string => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
};

export const ymd = (s: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[3] + '.' + m[2] + '.' + m[1] : s;
};

export const dfmt = (t: number): string => new Date(t).toLocaleDateString('ru-RU');
