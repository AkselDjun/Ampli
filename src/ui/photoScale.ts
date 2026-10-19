export const PHOTO_MAX_SIDE = 1280;
export const PHOTO_QUALITY = 0.75;

export function fitSide(w: number, h: number, max = PHOTO_MAX_SIDE): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export function scalePhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('decode failed'));
    };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const s = fitSide(img.naturalWidth, img.naturalHeight);
      const cv = document.createElement('canvas');
      cv.width = s.w;
      cv.height = s.h;
      const ctx = cv.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, s.w, s.h);
      cv.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', PHOTO_QUALITY);
    };
    img.src = src;
  });
}
