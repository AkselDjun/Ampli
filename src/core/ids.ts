let uid = 1;
export const nid = (): string => 'i' + uid++;
export const pid = (): string => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
