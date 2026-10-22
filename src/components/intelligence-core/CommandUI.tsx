import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send, Volume2, VolumeX } from 'lucide-react';
import { listenOnce, speak, stopSpeaking, voiceSupport } from './VoiceControl';

interface Props {
  busy: boolean;
  onAsk: (text: string) => void;
  t: (key: string, fallback?: string) => string;
  language: string;
  compact?: boolean;
  /** Latest Core reply — enables the read-aloud (TTS) button. */
  speakText?: string;
  /** Unique input id (the section and floating instances coexist in the DOM). */
  inputId?: string;
  /** Forwarded to the text input (dialog focus management). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Command input: text first, voice as progressive enhancement.
 * Mic denial/unsupported → inline notice, text keeps working.
 * The speaker button reads the latest Core reply aloud (Web Speech TTS);
 * speech always stops when a new query is sent or the input unmounts.
 */
export const CommandUI: React.FC<Props> = ({ busy, onAsk, t, language, compact = false, speakText, inputId = 'intel-command', inputRef }) => {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const support = voiceSupport();

  useEffect(() => {
    // A new reply arriving while TTS plays the old one would overlap speech.
    setSpeaking(false);
    return () => stopSpeaking();
  }, [speakText]);
  useEffect(() => () => stopSpeaking(), []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    stopSpeaking();
    setSpeaking(false);
    setValue('');
    onAsk(text);
  };

  const toggleListen = () => {
    if (listening) {
      stopRef.current?.();
      stopRef.current = null;
      setListening(false);
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    setVoiceNote(null);
    setListening(true);
    stopRef.current = listenOnce(
      language,
      text => {
        setListening(false);
        stopRef.current = null;
        setValue(text);
        onAsk(text);
      },
      code => {
        setListening(false);
        stopRef.current = null;
        setVoiceNote(
          code === 'unsupported'
            ? t('intel.voiceUnsupported', 'Voice input is not supported in this browser — type instead.')
            : code === 'denied' || code === 'not-allowed'
              ? t('intel.voiceDenied', 'Microphone unavailable — type instead.')
              : t('intel.voiceFailed', 'Did not catch that — type instead.'),
        );
      },
    );
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = (speakText || value).trim();
    if (!text) return;
    setSpeaking(true);
    speak(text, language);
    // SpeechSynthesis has no reliable onend across browsers when voices are
    // missing; reset the toggle so it never sticks in the "on" position.
    window.setTimeout(() => setSpeaking(false), Math.min(30_000, 3000 + text.length * 90));
  };

  const suggestions = compact
    ? []
    : [
      t('intel.sug1', 'What needs my attention?'),
      t('intel.sug2', 'Show pending supplier bookings'),
      t('intel.sug3', "Show today's revenue"),
    ];

  return (
    <div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('intel.inputLabel', 'Ask the Intelligence Core')}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          data-testid={inputId}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={t('intel.placeholder', 'Ask about bookings, suppliers, revenue…')}
          disabled={busy}
          maxLength={2000}
          autoComplete="off"
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        {support.stt && (
          <button
            type="button"
            onClick={toggleListen}
            aria-pressed={listening}
            aria-label={t('intel.voice', 'Voice input')}
            title={t('intel.voice', 'Voice input')}
            className={`p-2.5 rounded-xl border cursor-pointer ${
              listening
                ? 'border-teal-400/50 text-teal-300 animate-pulse'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
        {support.tts && (
          <button
            type="button"
            onClick={toggleSpeak}
            disabled={!(speakText || value).trim()}
            aria-pressed={speaking}
            aria-label={speaking
              ? t('intel.stopSpeech', 'Stop reading aloud')
              : t('intel.speakReply', 'Read the latest reply aloud')}
            title={speaking
              ? t('intel.stopSpeech', 'Stop reading aloud')
              : t('intel.speakReply', 'Read the latest reply aloud')}
            className={`p-2.5 rounded-xl border cursor-pointer disabled:opacity-40 ${
              speaking
                ? 'border-teal-400/50 text-teal-300'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label={t('intel.send', 'Send')}
          className="p-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--btn-book-ink,var(--accent-primary-ink))] disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      {voiceNote && (
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5" role="status">
          {voiceNote}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onAsk(s)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
