/**
 * Input sanitization & security helpers for Dahab OS
 * Protects against XSS, HTML injection, and malicious characters in user inputs.
 */

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/[<>]/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '') // Strip inline scripts
    .replace(/on\w+=/gi, '') // Strip event handlers like onclick=
    .trim()
    .slice(0, 1000); // Safe length cap
}

export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 256);
}

export function sanitizeAmount(amount: unknown): number {
  const parsed = Number(amount);
  if (isNaN(parsed) || parsed < 0 || !isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}

export function sanitizeId(id: unknown): string {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
}
