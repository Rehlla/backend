/**
 * Auth error humanization, separated from the Firebase SDK bundle.
 *
 * The previous home of this function (src/lib/firebase.ts) lived inside the
 * 736KB vendor-firebase chunk. Any component that statically imported it —
 * most importantly AuthView.tsx — pulled the entire Firebase SDK into the
 * auth route chunk on first paint, even on a deployment where Firebase Admin
 * has no credentials and federated sign-in returns 503.
 *
 * This module has zero Firebase dependencies. It is a pure function over the
 * error shape Firebase (and our own email/password paths) produce, so it can
 * be imported anywhere without dragging the SDK along.
 */

import type { Language } from '../i18n/resolve';
import { resolveString } from '../i18n/resolve';
import { getInstalledView, FALLBACK_LANGUAGE } from '../i18n/translator';

export type AuthLang = Language;

/**
 * Resolves through the client registry (same data source as every other
 * client surface): the active language's installed view with the EN view as
 * the cross-language fallback. Tests install views via tests/i18nSeed.ts
 * (setDictionary) — no separate seed hook is needed here.
 */
function t(key: string, lang: AuthLang, fallback?: string): string {
  const view = getInstalledView(lang);
  const enView = getInstalledView(FALLBACK_LANGUAGE);
  return resolveString(view, enView, key, lang, undefined, fallback, {
    dev: import.meta.env?.DEV === true,
  });
}

export function humanizeAuthError(
  error: unknown,
  lang: AuthLang = 'en'
): string {
  const code =
    typeof error === 'object' && error != null
      ? (String((error as { code?: unknown }).code ?? (error as { message?: unknown }).message ?? ''))
      : '';

  if (
    code.includes('user-not-found') ||
    code.includes('wrong-password') ||
    code.includes('invalid-credential')
  ) {
    return t('auth.invalidCredentials', lang);
  }

  if (code.includes('email-already-in-use')) {
    return t('auth.emailInUse', lang);
  }

  if (code.includes('weak-password')) {
    return t('auth.weakPassword', lang);
  }

  if (
    code.includes('popup-closed-by-user') ||
    code.includes('cancelled-popup-request')
  ) {
    return t('auth.popupClosed', lang);
  }

  if (code.includes('network-request-failed')) {
    return t('auth.networkIssue', lang);
  }

  if (code.includes('too-many-requests')) {
    return t('auth.tooManyAttempts', lang);
  }

  /* Server-side errors (non-Firebase): the plain Error message comes through
     as a human-readable string via error.message. Check common phrases. */
  const lower = code.toLowerCase();
  if (lower.includes('incorrect') || lower.includes('invalid') || lower.includes('wrong')) {
    return t('auth.invalidCredentials', lang);
  }
  if (lower.includes('not found') || lower.includes('does not exist')) {
    return t('auth.invalidCredentials', lang);
  }

  return t('auth.temporarilyUnavailable', lang);
}
