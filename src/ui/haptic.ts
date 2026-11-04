export function haptic(ms = 12): void {
  try {
    if (typeof navigator.vibrate === 'function' && window.matchMedia('(pointer:coarse)').matches) navigator.vibrate(ms);
  } catch (e) {
    void e;
  }
}
