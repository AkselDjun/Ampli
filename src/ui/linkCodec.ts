type Codec = typeof import('../core/share');

let codec: Codec | null = null;

export const getCodec = (): Codec | null => codec;

export async function loadCodec(): Promise<Codec> {
  if (!codec) codec = await import('../core/share');
  return codec;
}
