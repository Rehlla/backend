import { useEffect, useRef } from 'react';

/**
 * The silent half of the command-center alerts. A muted laptop, a quiet
 * phone, or a desk with the volume down still has to notice a new order, so
 * while anything is ringing:
 *   - the tab title flashes, which reads from another tab or a taskbar;
 *   - one system notification per arrival when the page is in the background
 *     (permission is asked on the operator's first interaction, never on load);
 *   - the device vibrates where it can (phones).
 * The edge glow and banner live in the shell; this hook owns the side effects.
 */
export function requestAlertNotificationPermission(): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  } catch {
    // Unsupported or blocked: the in-page signals still work.
  }
}

export function useAlertAttention(messages: string[]): void {
  const baseTitle = useRef<string | null>(null);
  const notified = useRef<Set<string>>(new Set());
  const key = messages.join('|');

  // Flashing title.
  useEffect(() => {
    if (messages.length === 0) return;
    if (baseTitle.current === null) baseTitle.current = document.title;
    const base = baseTitle.current;
    const flash = `(${messages.length}) ● ${messages[0]}`;
    let on = true;
    document.title = flash;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? flash : base;
    }, 1000);
    return () => {
      window.clearInterval(id);
      document.title = base;
      baseTitle.current = null;
    };
    // `key` carries the message list; the array itself is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // One system notification per newly ringing message, background only.
  useEffect(() => {
    const fresh = messages.filter(m => !notified.current.has(m));
    notified.current = new Set(messages);
    if (fresh.length === 0) return;
    try {
      navigator.vibrate?.([220, 120, 220]);
    } catch {
      // No vibration on this device.
    }
    try {
      if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const body of fresh) {
          const n = new Notification('REHLA Ops', { body, tag: `ops-alert-${body}`, requireInteraction: true });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      }
    } catch {
      // Notifications unavailable; the title and glow still fire.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
