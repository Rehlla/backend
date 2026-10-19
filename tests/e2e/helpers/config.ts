/**
 * Shared constants for the E2E suite. Must stay in sync with playwright.config.ts.
 *
 * 127.0.0.1, not localhost: on Windows dev boxes the hosts file often resolves
 * localhost to ::1 only while the isolated web server binds IPv4 — every API
 * request then dies with ECONNREFUSED ::1. IPv4-explicit works everywhere.
 */
export const BASE_URL = 'http://127.0.0.1:3100';
export const SEED_USER_PASSWORD = 'PlaywrightQA2026!Secure';
export const HOME_URL = BASE_URL;

export const SEED_EMAILS = {
  traveler: 'ahmed.traveler@example.com',
  supplier: 'captain.mahmoud@sinai-shuttle.com',
  ops: 'ops.director@dahab.travel',
  admin: 'admin@dahab.travel',
} as const;