/**
 * Light physical feedback on meaningful moments (a tab, a confirmed booking,
 * a hold about to expire). The Vibration API exists on Android browsers;
 * elsewhere this is a silent no-op, and it never fires under reduced motion.
 * The Flutter app will map the same three kinds onto native haptics.
 */
export type HapticKind = 'tap' | 'success' | 'warning';

export function haptic(kind: HapticKind = 'tap'): void {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const pattern = kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [30, 50, 30] : 8;
    navigator.vibrate?.(pattern);
  } catch {
    // Feedback is a nicety; never let it break the action it decorates.
  }
}

/** Native share sheet where the browser has one; false lets the caller copy instead. */
export async function shareContent(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(data);
      return true;
    }
  } catch {
    // dismissed or refused
  }
  return false;
}
