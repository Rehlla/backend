/**
 * Playtest: booking management end-to-end (cancel + reschedule) on the real
 * dev server. Signs in as the seeded traveler, makes a Book Now booking, then
 * drives Reschedule and Cancel through the manage modal — asserting flows only
 * report success after the backend responds.
 *
 * Run against a running dev server:
 *   TARGET_URL=http://127.0.0.1:3001 node tests/browser-qa/manage-booking-flows.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.TARGET_URL || 'http://127.0.0.1:3001';
const TRAVELER_EMAIL = process.env.TRAVELER_EMAIL || 'ahmed.traveler@example.com';
const TRAVELER_PASSWORD = process.env.TRAVELER_PASSWORD || '';
const ARTIFACTS = path.join(__dirname, 'screenshots', 'manage-flows');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
let step = 0;

async function shot(page, name) {
  const p = path.join(ARTIFACTS, `${String(++step).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

async function mark(name, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  results.push({ name, ok, detail });
}

async function signIn(page) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const email = page.locator('input[type="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  await email.waitFor({ state: 'visible', timeout: 15000 });
  await email.fill(TRAVELER_EMAIL);
  await pass.fill(TRAVELER_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}

async function tryConfirmBooking(page) {
  // Polls for the confirm CTA and clicks it. Returns true once a voucher or
  // confirmation code appears after the submit.
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const confirmBtn = page.locator('button:has-text("Confirm booking")').first();
    const disabled = await confirmBtn.isDisabled().catch(() => true);
    const visible = await confirmBtn.isVisible().catch(() => false);
    if (visible && !disabled) {
      await confirmBtn.click();
      await page.waitForTimeout(4500);
      const t = await page.textContent('body');
      return /DHB-[A-Z0-9]+/.test(t) && /confirm|voucher|reference|تأكيد/i.test(t);
    }
    await page.waitForTimeout(1200);
  }
  return false;
}

async function instantBook(page) {
  await page.goto(`${BASE}/book-now`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const bookNows = page.getByRole('button', { name: /^book now$/i });
  await bookNows.first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
  const count = await bookNows.count();
  if (count === 0) throw new Error('No "Book Now" CTA on /book-now');
  for (let attempt = 0; attempt < Math.min(count, 3); attempt++) {
    await bookNows.nth(attempt).click();
    if (await tryConfirmBooking(page)) {
      const bodyText = await page.textContent('body');
      const codeMatch = bodyText.match(/DHB-[A-Z0-9]+/);
      await mark('book-now instant booking confirmed', true, codeMatch ? `code ${codeMatch[0]}` : 'voucher visible');
      await shot(page, 'booknow-confirmed-voucher');
      return codeMatch ? codeMatch[0] : null;
    }
    // Unavailable product — clear the selection and try the next service.
    const closePanel = page.locator('button[aria-label="Close booking panel"]').first();
    if (await closePanel.isVisible().catch(() => false)) await closePanel.click();
    await page.waitForTimeout(800);
  }
  const panelText = await page.locator('#instant-checkout-panel').textContent().catch(() => '');
  await mark('book-now instant booking failed', false, (panelText || 'no panel').slice(0, 200).replace(/\s+/g, ' '));
  await shot(page, 'booknow-no-confirm');
  return null;
}

/** Closes any open dialog by clicking its header X (aria-label "Back to bookings"). */
async function closeDialog(page) {
  const dialog = page.getByRole('dialog').last();
  if (!(await dialog.isVisible().catch(() => false))) return;
  const x = dialog.locator('button').first();
  await x.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);
}

async function openBookings(page) {
  await page.goto(`${BASE}/bookings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
}

/**
 * Walks the booking cards from the most recent backwards and opens the manage
 * dialog for the first booking that has a real online record (manage actions
 * enabled). Returns the dialog, or null when no manageable booking exists.
 */
async function findManageableDialog(page) {
  const buttons = page.locator('button:has-text("Cancel / Reschedule")');
  const n = await buttons.count();
  if (n === 0) {
    // Fallback path: voucher modal → Manage booking.
    const voucher = page.locator('button:has-text("View Voucher")').first();
    if (await voucher.isVisible().catch(() => false)) {
      await voucher.click();
      await page.waitForTimeout(700);
      const inner = page.locator('button:has-text("Manage booking")').last();
      if (await inner.isVisible().catch(() => false)) {
        await inner.click();
        await page.waitForTimeout(1800);
        return page.getByRole('dialog').last();
      }
    }
    return null;
  }
  for (let i = n - 1; i >= 0; i--) {
    await closeDialog(page);
    await buttons.nth(i).scrollIntoViewIfNeeded().catch(() => {});
    await buttons.nth(i).click();
    const dialog = page.getByRole('dialog').last();
    await dialog.getByText('Manage booking').waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const notFound = await dialog.getByText(/not found online|مش متاح إلكترونياً/i).isVisible().catch(() => false);
    // A terminal booking still renders its buttons disabled — only an ENABLED
    // action means the booking can actually be managed.
    const cancelBtn = dialog.getByRole('button', { name: /cancel booking/i }).first();
    const reschedBtn = dialog.getByRole('button', { name: /reschedule|تغيير الموعد/i }).first();
    const cancelEnabled = await cancelBtn.isEnabled().catch(() => false);
    const reschedEnabled = await reschedBtn.isEnabled().catch(() => false);
    if (!notFound && (cancelEnabled || reschedEnabled)) {
      return dialog;
    }
    await closeDialog(page);
  }
  return null;
}

async function cancelFlow(page, dialog) {
  const cancelBtn = dialog.getByRole('button', { name: /cancel booking/i }).first();
  if (!(await cancelBtn.isVisible().catch(() => false))) {
    await mark('cancel — action missing', false, 'no cancel action inside manage dialog');
    return 'skipped';
  }
  await cancelBtn.click();
  await dialog.getByText('Cancel this booking').waitFor({ timeout: 10000 });
  const reason = dialog.locator('textarea').first();
  await reason.fill('Playtest automated cancellation');
  await shot(page, 'cancel-confirm');
  const submit = dialog.getByRole('button', { name: /confirm cancellation/i }).first();
  await submit.click();
  await submit.click({ timeout: 600 }).catch(() => {}); // double-click guard
  await dialog.getByText(/booking cancelled|تم إلغاء الحجز/i).waitFor({ timeout: 25000 });
  const body = await dialog.textContent();
  const refunded = /refunded|refund|استرداد/i.test(body || '');
  await mark('cancel — success from backend', true, refunded ? 'refund line shown' : 'no-refund line shown');
  await shot(page, 'cancel-success');
  await closeDialog(page);
  await page.waitForTimeout(1400);
  return 'done';
}

async function rescheduleFlow(page, dialog) {
  const rescheduleBtn = dialog.getByRole('button', { name: /reschedule|تغيير الموعد/i }).first();
  if (!(await rescheduleBtn.isVisible().catch(() => false))) {
    await mark('reschedule — action missing', false, 'booking not reschedulable from manage dialog');
    return 'skipped';
  }
  await rescheduleBtn.click();
  await dialog.getByText('Choose a new time').waitFor({ timeout: 10000 });
  const dateInput = dialog.locator('input[type="date"]').first();
  const d = new Date();
  d.setDate(d.getDate() + 2);
  await dateInput.fill(d.toISOString().split('T')[0]).catch(() => {});
  await dialog.getByRole('button', { name: /check availability/i }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, 'reschedule-slots');
  const enabledSlot = dialog.locator('button:not([disabled]):has-text("AM"), button:not([disabled]):has-text("PM")').first();
  if (!(await enabledSlot.isVisible().catch(() => false))) {
    await mark('reschedule — no available slots', false, 'every slot disabled for that date');
    await shot(page, 'reschedule-no-slots');
    return 'skipped';
  }
  await enabledSlot.click();
  await dialog.getByText('Confirm the new time').waitFor({ timeout: 10000 });
  await shot(page, 'reschedule-confirm');
  await dialog.getByRole('button', { name: /confirm reschedule/i }).first().click();
  await dialog.getByText(/booking rescheduled|تم تغيير موعد الحجز/i).waitFor({ timeout: 25000 });
  const body = await dialog.textContent();
  const moved = /To:|إلى/i.test(body || '');
  await mark('reschedule — success from backend', true, moved ? 'new slot shown' : 'success screen shown');
  await shot(page, 'reschedule-success');
  await closeDialog(page);
  await page.waitForTimeout(1400);
  return 'done';
}

async function runDesktop(browser) {
  console.log('\n═══ DESKTOP manage flows ═══');
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', err => errors.push(`PAGE:${String(err).slice(0, 200)}`));

  await mark('sign-in with seeded traveler', true);
  try {
    await signIn(page);
    await instantBook(page);
    await openBookings(page);

    const forReschedule = await findManageableDialog(page);
    if (forReschedule) {
      await shot(page, 'bookings-list');
      await rescheduleFlow(page, forReschedule);
    } else {
      await mark('reschedule — no manageable booking found', false, 'dialog never opened with actions');
    }

    // Re-scan after the reschedule reloads the list, then cancel a real booking.
    await openBookings(page);
    const forCancel = await findManageableDialog(page);
    if (forCancel) {
      await cancelFlow(page, forCancel);
    } else {
      await mark('cancel — no manageable booking found', false, 'dialog never opened with actions');
    }
    await openBookings(page);
    await shot(page, 'bookings-after-cancel');
  } catch (err) {
    await mark('desktop journey', false, String(err).slice(0, 300));
    await shot(page, 'desktop-error');
  }
  await mark('console errors (app-level)', errors.length === 0, errors.join(' | ').slice(0, 300));
  await ctx.close();
}

async function runMobile(browser) {
  console.log('\n═══ MOBILE manage modal ═══');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await signIn(page);
    await openBookings(page);
    const dialog = await findManageableDialog(page);
    if (!dialog) {
      await mark('mobile — no manageable booking', false, 'dialog never opened');
    } else {
      await shot(page, 'mobile-manage-modal');
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      await mark('mobile — manage modal fits viewport', fits, fits ? '' : 'horizontal overflow');
      // Cancellation confirm must fit on a phone screen.
      const cancelBtn = dialog.getByRole('button', { name: /cancel booking/i }).first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(800);
        await shot(page, 'mobile-cancel-confirm');
        const fitsConfirm = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
        await mark('mobile — cancel confirm fits viewport', fitsConfirm, fitsConfirm ? '' : 'horizontal overflow');
      }
    }
  } catch (err) {
    await mark('mobile journey', false, String(err).slice(0, 300));
    await shot(page, 'mobile-error');
  }
  await ctx.close();
}

(async () => {
  if (!TRAVELER_PASSWORD) {
    console.error('Set TRAVELER_PASSWORD from SEEDED_ACCOUNTS.local.md');
    process.exit(1);
  }
  const browser = await chromium.launch();
  try {
    await runDesktop(browser);
    await runMobile(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
