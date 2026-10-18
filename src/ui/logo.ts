export const LOGO_MAX_W = 240;
export const LOGO_MAX_H = 120;

export function fitSize(w: number, h: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const k = Math.min(1, LOGO_MAX_W / w, LOGO_MAX_H / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export function scaleLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('read failed'));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const s = fitSize(img.naturalWidth, img.naturalHeight);
        const cv = document.createElement('canvas');
        cv.width = s.w;
        cv.height = s.h;
        const ctx = cv.getContext('2d');
        if (!ctx) {
          reject(new Error('no canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, s.w, s.h);
        resolve(cv.toDataURL('image/png'));
      };
      img.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  });
}
