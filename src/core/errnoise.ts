export function ignoredError(msg: string, source: string): boolean {
  if (/^ResizeObserver loop/.test(msg)) return true;
  if (/^Script error\.?$/.test(msg)) return true;
  return /^(chrome|moz|safari-web)-extension:\/\//.test(source);
}
