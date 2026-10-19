let uid = 1;
export const nid = (): string => 'i' + uid++;
export const pid = (): string => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function keepId(id: unknown): string {
  if (typeof id !== 'string' || !id) return nid();
  const m = /^i(\d+)$/.exec(id);
  if (m && Number(m[1]) >= uid) uid = Number(m[1]) + 1;
  return id;
}
