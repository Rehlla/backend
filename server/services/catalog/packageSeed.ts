import { db } from '../../db/database';
import type { TripPackageEntity } from '../../db/schema';
import { READY_TRIP_PROGRAMMES } from '../../db/seeds/editorialContent';

/**
 * Seeds db.tripPackages from the editorial READY_TRIP_PROGRAMMES.
 *
 * Idempotent by `seedId`: a programme that already has a row is never
 * touched again, so editor changes survive every boot. Seeded rows start
 * published (they are live on the site today). A published package cannot be
 * hard-deleted through the catalogue (only drafts can), so a seeded row is
 * never silently re-created after an editor removed it; it is archived.
 */
export function seedTripPackages(now = new Date().toISOString()): { created: number } {
  const seeded = new Set(db.tripPackages.map(p => p.seedId).filter(Boolean));
  let created = 0;
  for (const programme of READY_TRIP_PROGRAMMES) {
    if (seeded.has(programme.id)) continue;
    const row: TripPackageEntity = {
      id: `PKG-${programme.id}`,
      status: 'published',
      titleEn: programme.title,
      titleAr: programme.titleAr,
      summaryEn: programme.tagline,
      summaryAr: programme.taglineAr,
      coverImage: programme.heroImage,
      images: programme.heroImage ? [programme.heroImage] : [],
      durationDays: programme.durationDays,
      startingPriceEGP: programme.startingPriceEGP,
      priceIsEstimate: programme.priceIsEstimate === true,
      days: programme.dayByDay.map(d => ({
        day: d.day,
        titleEn: d.title,
        titleAr: d.titleAr ?? '',
        bodyEn: d.subtitle,
        bodyAr: d.subtitleAr ?? '',
        activitySkuIds: [],
      })),
      includedEn: [...programme.includedItems],
      includedAr: [...programme.includedItemsAr],
      seedId: programme.id,
      createdAt: now,
      updatedAt: now,
    };
    // An id collision means someone created PKG-<seed> by hand: keep theirs.
    if (db.tripPackages.some(p => p.id === row.id)) continue;
    db.tripPackages.push(row);
    created++;
  }
  return { created };
}
