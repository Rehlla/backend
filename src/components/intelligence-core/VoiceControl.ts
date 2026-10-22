/**
 * VoiceControl — Web Speech abstraction for the Intelligence Core.
 * Text is always the primary channel; voice is a progressive enhancement
 * with graceful fallback when unsupported/denied/unavailable.
 */
export interface VoiceSupport {
  stt: boolean;
  tts: boolean;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export function voiceSupport(): VoiceSupport {
  if (typeof window === 'undefined') return { stt: false, tts: false };
  const stt = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const tts = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  return { stt, tts };
}

export function listenOnce(language: string, onText: (text: string) => void, onError: (code: string) => void): () => void {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    onError('unsupported');
    return () => undefined;
  }
  let rec: SpeechRecognitionLike;
  try {
    rec = new Ctor();
  } catch {
    onError('unavailable');
    return () => undefined;
  }
  let done = false;
  rec.lang = language === 'ar' ? 'ar-EG' : 'en-US';
  rec.interimResults = false;
  rec.onresult = e => {
    try {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript && !done) {
        done = true;
        onText(transcript);
      }
    } catch {
      onError('parse');
    }
  };
  rec.onerror = e => {
    if (!done) {
      done = true;
      onError(e?.error || 'recognition');
    }
  };
  rec.onend = () => {
    if (!done) {
      done = true;
      onError('no-speech');
    }
  };
  try {
    rec.start();
  } catch {
    onError('denied');
    return () => undefined;
  }
  return () => {
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    }
  };
}

export function speak(text: string, language: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.slice(0, 400));
    utter.lang = language === 'ar' ? 'ar-EG' : 'en-US';
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    /* TTS is decorative — never throw. */
  }
}

export function stopSpeaking(): void {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    /* noop */
  }
}
