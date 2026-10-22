import React, { useEffect, useState } from 'react';

/**
 * Streamed-reply reveal: the newest assistant answer is paced out over
 * roughly a second and a half, with the freshly-revealed tail highlighted —
 * the reading rhythm of a streamed assistant without holding the answer
 * hostage (the full text is already on the page for screen readers and
 * appears in full the moment the reveal finishes, or instantly when the user
 * prefers reduced motion).
 */

const TICK_MS = 50;
const TOTAL_TICKS = 30;
const TAIL_CHARS = 60;

export function DayGiStreamedText({ text, streaming }: { text: string; streaming: boolean }) {
  const [visibleChars, setVisibleChars] = useState(streaming ? 0 : text.length);

  useEffect(() => {
    if (!streaming) {
      setVisibleChars(text.length);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisibleChars(text.length);
      return;
    }

    setVisibleChars(0);
    let cancelled = false;
    const step = Math.max(1, Math.ceil(text.length / TOTAL_TICKS));
    const timer = window.setInterval(() => {
      if (cancelled) return;
      setVisibleChars(prev => {
        const next = prev + step;
        if (next >= text.length) {
          window.clearInterval(timer);
          return text.length;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [text, streaming]);

  if (!streaming || visibleChars >= text.length) {
    return <>{text}</>;
  }

  const revealed = text.slice(0, visibleChars);
  const tailStart = Math.max(0, visibleChars - TAIL_CHARS);
  const head = revealed.slice(0, tailStart);
  const tail = revealed.slice(tailStart);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {head}
        <mark className="bg-[var(--dg-tint)] text-[var(--dg-text)] rounded px-0.5">{tail}</mark>
      </span>
    </>
  );
}
