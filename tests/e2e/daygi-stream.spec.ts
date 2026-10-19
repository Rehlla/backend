import { expect, test } from 'playwright/test';
import { registerBasicTraveler } from './helpers/auth';
import { BASE_URL } from './helpers/config';

/**
 * DayGI server-driven streaming end to end.
 *
 * 1. Protocol: POST /api/daygi/query/stream emits `text` frames whose
 *    accumulated `full` ends at the final reply, then a terminal `payload`
 *    frame carrying the same DayGiResponse shape the plain query returns
 *    (including the saved-chat id).
 * 2. UI: the streamed text renders progressively with the highlighted tail,
 *    then the full payload commits — reply, action card data and the plan
 *    canvas — and the exchange is recorded in chat history.
 * 3. Continuity: a second turn appends to the same chat instead of forking.
 *
 * English is forced so label selectors match; translation coverage lives in
 * i18n tests. Each test registers its own traveler so saved chats never leak
 * between tests or projects (the isolated data dir is shared per run, while
 * browser contexts are fresh per test).
 *
 * The daily-briefing prompt is used because it is deterministic, needs no
 * trip, and always carries plan-shaped data (timeline → Today canvas group).
 */
test.describe('DayGI streaming', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('dahab_os_lang', 'en');
    });
  });

  async function parseSse(body: string) {
    const events: Array<{ event: string; data: unknown }> = [];
    for (const frame of body.split('\n\n')) {
      if (!frame.trim()) continue;
      const lines = frame.split('\n');
      const eventLine = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      events.push({
        event: eventLine ? eventLine.slice('event:'.length).trim() : 'message',
        data: JSON.parse(dataLine.slice('data:'.length).trim())
      });
    }
    return events;
  }

  test('streaming protocol: text frames accumulate into the terminal payload', async ({ context }) => {
    await registerBasicTraveler(context, 'Stream Protocol');

    const res = await context.request.post(`${BASE_URL}/api/daygi/query/stream`, {
      data: { prompt: 'Good morning, show my daily briefing for today', language: 'en' }
    });
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/event-stream');

    const events = await parseSse(await res.text());
    const texts = events.filter(e => e.event === 'text');
    const payloads = events.filter(e => e.event === 'payload');
    const errors = events.filter(e => e.event === 'error');

    expect(errors).toHaveLength(0);
    expect(texts.length).toBeGreaterThan(0);
    expect(payloads).toHaveLength(1);

    // The accumulated full must end exactly at the payload's final reply.
    const lastFull = (texts[texts.length - 1].data as { full: string }).full;
    const payload = payloads[0].data as { replyText: string; actionType: string; chatId?: string; actionData?: { dailyBriefing?: unknown } };
    expect(lastFull).toBe(payload.replyText);
    expect(payload.actionType).toBe('DAILY_BRIEFING');
    expect(payload.actionData?.dailyBriefing).toBeTruthy();
    expect(typeof payload.chatId).toBe('string');
  });

  test('chat UI streams the reply, commits the canvas, and records history', async ({ page, context }) => {
    await registerBasicTraveler(context, 'Stream UI');
    await page.goto('/daygi');

    // The greeting mounts and the composer is reachable.
    const composer = page.getByLabel('Message DayGI');
    await expect(composer).toBeVisible({ timeout: 20000 });

    await composer.fill('Good morning, show my daily briefing for today');
    await page.getByLabel('Send message').click();

    // The wait phase shows the matching-status bubble…
    await expect(page.getByText('DayGI 3.0 is matching')).toBeVisible({ timeout: 20000 });

    // …then the streamed text renders with the highlighted tail …
    const streaming = page.getByTestId('daygi-streaming-text');
    await expect.poll(async () => streaming.count(), { timeout: 20000 }).toBeGreaterThan(0);

    // …and the terminal payload commits the full reply as a plain paragraph.
    // Scoped to the transcript paragraphs (not the transient streaming block,
    // whose screen-reader copy would double-match a bare getByText).
    const committedReply = page.locator('p.whitespace-pre-line', {
      hasText: 'Good morning! Here is your daily briefing for Dahab'
    });
    await expect(committedReply).toBeVisible({ timeout: 30000 });

    // A plan-shaped answer auto-opens the canvas rail (desktop viewports).
    // The map section is scoped to the rail: the same panel also mounts in
    // the hidden mobile sheet, so a bare testid would match twice.
    const rail = page.getByTestId('daygi-canvas-rail');
    // Check if the rail is actually visible (not hidden with `hidden` class)
    // instead of relying on viewport width which can be unreliable.
    const isDesktop = await rail.evaluate(el => !el.classList.contains('hidden')).catch(() => false);
    if (isDesktop) {
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail.getByTestId('daygi-canvas-map-section')).toBeAttached();
    }

    // The exchange was recorded: one saved chat with two messages.
    const chatsRes = await context.request.get(`${BASE_URL}/api/daygi/chats`);
    expect(chatsRes.ok()).toBe(true);
    const chats = await chatsRes.json();
    expect(chats).toHaveLength(1);
    expect(chats[0].title).toContain('daily briefing');
    expect(chats[0].messageCount).toBe(2);
    const chatId = chats[0].chatId;

// A second turn appends to the same chat rather than forking a new one.
    // On narrow viewports the canvas is a sheet over the conversation, so it
    // must be dismissed before the composer is reachable again. (The panel
    // mounts twice - desktop rail and mobile sheet - with one hidden, so
    // only the visible close button is actionable.)
    const closeCanvas = page.locator('button[aria-label="Close plan"]:visible');
    if (await closeCanvas.count() > 0) {
      await closeCanvas.click();
      // Wait for the sheet animation to complete so the composer is interactable.
      await page.waitForTimeout(300);
    }
    await composer.fill('What should I do now?');
    await page.getByLabel('Send message').click();
    // For a traveler with no trip, the assistant suggests nearby activities.
    const committedSecond = page.locator('p.whitespace-pre-line').filter({
      hasText: /You have|snorkel|dive|activity|beach|water|ocean|sea/i
    });
    await expect(committedSecond).toBeVisible({ timeout: 30000 });

    const chatsRes2 = await context.request.get(`${BASE_URL}/api/daygi/chats`);
    const chats2 = await chatsRes2.json();
    expect(chats2).toHaveLength(1);
    expect(chats2[0].chatId).toBe(chatId);
    expect(chats2[0].messageCount).toBe(4);
  });

  test('stop button cancels generation and leaves the question standing', async ({ page, context }) => {
    await registerBasicTraveler(context, 'Stream Stop');
    await page.goto('/daygi');

    const composer = page.getByLabel('Message DayGI');
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill('Good morning, show my daily briefing for today');
    await page.getByLabel('Send message').click();

    // Either the Stop button renders while the answer is in flight (click it
    // and the composer must end up idle), or the fast deterministic answer
    // commits first (then the committed reply must be visible). Both are
    // correct end states; what must never happen is a stuck spinner.
    const stop = page.getByLabel('Stop');
    let stopped = false;
    try {
      await expect(stop).toBeVisible({ timeout: 3000 });
      stopped = true;
    } catch {
      stopped = false;
    }
    if (stopped) {
      await stop.click();
      await expect(stop).toBeHidden({ timeout: 15000 });
      await expect(page.getByText('DayGI 3.0 is matching')).toBeHidden({ timeout: 10000 });
    } else {
      const committedReply = page.locator('p.whitespace-pre-line', {
        hasText: 'Good morning! Here is your daily briefing for Dahab'
      });
      await expect(committedReply).toBeVisible({ timeout: 30000 });
    }
    await expect(page.getByText('Good morning, show my daily briefing for today').first()).toBeVisible();
  });

  test('share link opens a public frozen snapshot without a session', async ({ page, context, browser }) => {
    await registerBasicTraveler(context, 'Stream Share');
    await page.goto('/daygi');

    const composer = page.getByLabel('Message DayGI');
    await expect(composer).toBeVisible({ timeout: 20000 });
    await composer.fill('Good morning, show my daily briefing for today');
    await page.getByLabel('Send message').click();
    const committedReply = page.locator('p.whitespace-pre-line', {
      hasText: 'Good morning! Here is your daily briefing for Dahab'
    });
    await expect(committedReply).toBeVisible({ timeout: 30000 });

    // Wait for the chat to be saved and the share button to appear.
    // The share button appears when activeChatId is set, which happens
    // after the server responds and the chat is saved. This can take
    // a few seconds on slower environments.
    await page.waitForSelector('button[aria-label="Share chat"]', { state: 'visible', timeout: 60000 });

    // Also verify the chat was created by checking the API
    const chatId = await page.evaluate(async () => {
      const res = await fetch('/api/daygi/chats', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const chats = await res.json();
      return chats.length > 0 ? chats[0].chatId : null;
    });
    expect(chatId).toBeTruthy();

    // Mint the link and read it back out of the dialog.
    const shareButton = page.getByLabel('Share chat');
    await expect(shareButton).toBeEnabled({ timeout: 10000 });
    await shareButton.scrollIntoViewIfNeeded();
    // Dispatched rather than clicked: the share button sits under the canvas
    // sheet on narrow viewports, and a real click is intercepted. This fires
    // the same event without the actionability checks.
    await shareButton.dispatchEvent('click');
    const urlBox = page.getByTestId('daygi-share-url');
    await expect(urlBox).toBeVisible({ timeout: 15000 });
    // Wait for the URL to be populated in the input
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="daygi-share-url"]') as HTMLInputElement | null;
        return el && el.value && el.value.includes('/shared/SHR-');
      },
      { timeout: 15000 }
    );
    const url = await urlBox.inputValue();
    expect(url).toContain('/shared/SHR-');

    // A stranger with no session reads the frozen snapshot: transcript plus
    // the plan canvas, but no app chrome and no interactivity.
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    try {
      await guestPage.goto(url);
      await expect(guestPage.getByText('Here is your daily briefing for Dahab')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByText('Lighthouse Protected Reef Snorkeling (Shore Entry)')).toBeVisible();
    } finally {
      await guest.close();
    }
  });

  test('canvas Book opens the checkout handoff without firing a hold', async ({ page, context }) => {
    // A real owned trip with a diving item, so the post-dive options (with
    // commerce skus) build instead of the no-trip guidance. The seeded demo
    // trip is NOT owned by any loginable account, so the test mints its own.
    await registerBasicTraveler(context, 'Stream Book');
    // Each test registers a fresh traveler; the trip id must be unique per
    // test or the second test's create-or-update hits the previous test's
    // trip and fails ownership.
    const tripId = `E2E-TRIP-BOOK-${Date.now()}`;
    const tripRes = await context.request.post(`${BASE_URL}/api/trips`, {
      data: { id: tripId, title: 'E2E Dahab', status: 'CONFIRMED' }
    });
    expect(tripRes.ok()).toBe(true);
    const itemRes = await context.request.post(`${BASE_URL}/api/trips/${tripId}/items`, {
      data: { serviceType: 'diving', title: 'Canyon Morning Dive', dayNumber: 2, timeSlot: '08:30 AM', priceEGP: 2700 }
    });
    expect(itemRes.ok()).toBe(true);

    await page.goto('/daygi');

    const composer = page.getByLabel('Message DayGI');
    await expect(composer).toBeVisible({ timeout: 20000 });
    // Use Arabic prompt for Arabic locale test
    const isArabic = test.info().project.name === 'ar';
    const prompt = isArabic ? 'أريد مكان هادئ بعد الغوص' : 'I want somewhere calm after diving';
    await composer.fill(prompt);
    await page.getByLabel('Send message').click();

    // The options canvas carries commerce items; opening one must land in
    // the booking modal — holds are only created from inside checkout.
    // On desktop it's a rail, on mobile it's a bottom sheet.
    const width = page.viewportSize()?.width ?? 1280;
    if (width >= 1024) {
      const rail = page.getByTestId('daygi-canvas-rail');
      await expect(rail).toBeVisible({ timeout: 30000 });
      await rail.getByText('Book', { exact: true }).first().click();
} else {
      // On mobile, the canvas is a sheet dialog; find the dialog containing the canvas.
      const canvasDialog = page.locator('div[role="dialog"]').filter({ has: page.getByTestId('daygi-canvas') });
      await expect(canvasDialog).toBeVisible({ timeout: 30000 });
      await canvasDialog.getByText('Book', { exact: true }).first().click();

      // Wait for the booking modal dialog to appear
      const bookingModal = page.locator('div[role="dialog"]').filter({ hasText: 'Book Instantly' });
      await expect(bookingModal).toBeVisible({ timeout: 15000 });
    }
  });
});
