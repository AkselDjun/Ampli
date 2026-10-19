export const TEMP_FACTOR_65: [number, number][] = [
  [25, 1],
  [30, 0.94],
  [35, 0.87],
  [40, 0.79],
  [45, 0.71],
  [50, 0.61]
];

export const TEMP_MAX = 50;

export function tempFactor(t: number): number {
  if (!Number.isFinite(t) || t <= 25) return 1;
  const row = TEMP_FACTOR_65.find(([x]) => x >= t);
  return row ? row[1] : TEMP_FACTOR_65[TEMP_FACTOR_65.length - 1][1];
}
