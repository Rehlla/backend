import { db } from '../db/database';
import { updateAccommodation } from './accommodationService';
import {
  initScrapeGraph,
  scrapeHotelPrice,
  getScrapeGraphStatus,
  type ScrapedHotelPrice,
} from './scrapeGraphService';
import { log } from './structuredLogger';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let timer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastRunResult: string | null;
}

const lastRun: { at: string | null; result: string | null } = { at: null, result: null };

/**
 * Starts the ScrapeGraph periodic fetch scheduler.
 *
 * Reads SCRAPEGRAPH_API_KEY and SCRAPEGRAPH_SCHEDULER_INTERVAL_MS from env.
 * When the key is absent the scheduler is a no-op (disabled by default).
 * When SCRAPEGRAPH_SCHEDULER_ENABLED is not 'true', the scheduler does not
 * start automatically (opt-in for production safety).
 */
export function startScrapeGraphScheduler(): void {
  if (!process.env.SCRAPEGRAPH_API_KEY) {
    log.info('scrapeGraphScheduler', 'disabled (no API key)');
    return;
  }

  if (process.env.SCRAPEGRAPH_SCHEDULER_ENABLED !== 'true') {
    log.info('scrapeGraphScheduler', 'disabled (set SCRAPEGRAPH_SCHEDULER_ENABLED=true to enable)');
    return;
  }

  initScrapeGraph(process.env.SCRAPEGRAPH_API_KEY);

  const intervalMs = parseInt(process.env.SCRAPEGRAPH_SCHEDULER_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;

  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    runScheduledFetch().catch((err) => {
      log.error('scrapeGraphScheduler', 'unexpected error', { error: String(err) });
    });
  }, intervalMs);

  log.info('scrapeGraphScheduler', `started (interval ${intervalMs / 1000 / 60} min)`);
}

/**
 * Stops the scheduler interval.
 */
export function stopScrapeGraphScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isRunning = false;
}

/**
 * Returns the current scheduler status for /api/health.
 */
export function getScrapeGraphSchedulerStatus(): SchedulerStatus {
  return {
    enabled: !!process.env.SCRAPEGRAPH_API_KEY && process.env.SCRAPEGRAPH_SCHEDULER_ENABLED === 'true',
    running: timer !== null,
    intervalMs: parseInt(process.env.SCRAPEGRAPH_SCHEDULER_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS,
    lastRunAt: lastRun.at,
    lastRunResult: lastRun.result,
  };
}

/**
 * One scheduled run: fetches prices for all active accommodations from the
 * configured source URL and updates perNightEGP in the database.
 */
async function runScheduledFetch(): Promise<void> {
  if (isRunning) {
    log.warn('scrapeGraphScheduler', 'previous run still in progress, skipping');
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const status = getScrapeGraphStatus();
    if (!status.healthy) {
      lastRun.at = startedAt;
      lastRun.result = 'Skipped: ScrapeGraph not healthy';
      return;
    }

    const accommodations = db.accommodations.filter((a) => a.active && a.perNightEGP > 0);
    let updated = 0;
    let failed = 0;

    for (const acc of accommodations) {
      try {
        // Prefer the property's own external listing URL; fall back to a
        // Booking.com search when none is configured.
        const sourceUrl = acc.sourceUrl
          ?? `https://www.booking.com/searchresults.en.html?ss=${encodeURIComponent(acc.name + ' Dahab')}`;
        const price: ScrapedHotelPrice = await scrapeHotelPrice(
          acc.name,
          sourceUrl,
          '2026-11-01',
          '2026-11-06',
          2,
        );

        if (price.pricePerNight > 0 && price.pricePerNight !== acc.perNightEGP) {
          updateAccommodation(acc.id, { perNightEGP: price.pricePerNight });
          updated += 1;
        }
      } catch (err) {
        failed += 1;
        log.warn('scrapeGraphScheduler', 'fetch failed for accommodation', {
          id: acc.id,
          name: acc.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Rate limit: 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    db.saveToDisk();

    lastRun.at = startedAt;
    lastRun.result = `Updated ${updated} prices, ${failed} failures out of ${accommodations.length} accommodations`;
    log.info('scrapeGraphScheduler', lastRun.result ?? 'completed');
  } catch (err) {
    lastRun.at = startedAt;
    lastRun.result = `Error: ${err instanceof Error ? err.message : String(err)}`;
    log.error('scrapeGraphScheduler', 'run failed', { error: lastRun.result });
  } finally {
    isRunning = false;
  }
}

/**
 * Triggers a single fetch run immediately (for testing or manual refresh).
 */
export async function runScrapeGraphOnce(): Promise<{ success: boolean; message: string }> {
  try {
    await runScheduledFetch();
    return { success: true, message: lastRun.result ?? 'Completed' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}
