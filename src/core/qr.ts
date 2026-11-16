import qrcode from 'qrcode-generator';

export const QR_MAX_BYTES = 2300;
export const QR_MARGIN = 2;

export interface QrShape {
  size: number;
  path: string;
}

export const qrText = (text: string): string => text.replace(/[^\x20-\x7e]+/g, c => encodeURIComponent(c));

export const qrFits = (text: string): boolean => qrText(text).length <= QR_MAX_BYTES;

export function qrShape(text: string): QrShape | null {
  const data = qrText(text);
  if (!data || data.length > QR_MAX_BYTES) return null;
  const q = qrcode(0, 'L');
  q.addData(data, 'Byte');
  q.make();
  const n = q.getModuleCount();
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!q.isDark(y, x)) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < n && q.isDark(y, x + w)) w++;
      parts.push('M' + (x + QR_MARGIN) + ' ' + (y + QR_MARGIN) + 'h' + w + 'v1h-' + w + 'z');
      x += w;
    }
  }
  return { size: n + QR_MARGIN * 2, path: parts.join('') };
}
