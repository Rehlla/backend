/**
 * Single source of truth for the platform's public contact number.
 *
 * P1-11: the footer previously rendered the literal "+20 100 123 4567" (a
 * placeholder) on most pages while "/" showed a different number, so visitors
 * saw two different phone numbers for one business. Everything now reads this
 * module. When the number is unset the caller should hide the row rather than
 * print a placeholder.
 */
export const CONTACT_PHONE_E164 = '+201002328005';

export const CONTACT_PHONE_DISPLAY = '+20 100 232 8005';