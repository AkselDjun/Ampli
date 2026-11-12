type Codec = typeof import('../core/share');

let codec: Codec | null = null;

export const LINK_FAIL_TEXT = 'Не удалось открыть ссылку: часть приложения не загрузилась. Проверьте интернет и откройте ссылку ещё раз.';

export const getCodec = (): Codec | null => codec;

export async function loadCodec(): Promise<Codec> {
  if (!codec) codec = await import('../core/share');
  return codec;
}
