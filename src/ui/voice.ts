interface RecResult {
  0: { transcript: string };
  isFinal: boolean;
}

interface RecEvent {
  resultIndex: number;
  results: ArrayLike<RecResult>;
}

export interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecCtor = new () => Rec;

const ctor = (): RecCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupported = (): boolean => ctor() !== null;

export const VOICE_NOTE_KEY = 'ampli-voice-note';

export const VOICE_ERR: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
  'service-not-allowed': 'Нет доступа к микрофону. Разрешите его в настройках браузера.',
  network: 'Распознавание речи не работает без интернета. Введите список текстом.',
  'no-speech': 'Речь не услышана. Нажмите на микрофон и говорите ближе к телефону.',
  'audio-capture': 'Микрофон не найден.'
};

export function listen(onText: (t: string) => void, onEnd: (err: string | null) => void): () => void {
  const C = ctor();
  if (!C) {
    onEnd('Браузер не умеет распознавать речь. Введите список текстом.');
    return () => undefined;
  }
  const r = new C();
  r.lang = 'ru-RU';
  r.interimResults = false;
  r.continuous = true;
  let err: string | null = null;
  r.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const x = e.results[i];
      if (x.isFinal && x[0].transcript.trim()) onText(x[0].transcript.trim());
    }
  };
  r.onerror = e => {
    if (e.error !== 'aborted') err = VOICE_ERR[e.error] ?? 'Не удалось распознать речь.';
  };
  r.onend = () => onEnd(err);
  try {
    r.start();
  } catch (e) {
    void e;
    onEnd('Не удалось включить микрофон.');
  }
  return () => r.stop();
}
