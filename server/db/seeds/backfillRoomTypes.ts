import { db } from '../database';
import type {
  AccommodationEntity,
  InventorySource,
  ProductSkuEntity,
  RoomTypeEntity,
} from '../schema';

/**
 * Gives every catalogued property exactly one sellable room type.
 *
 * Booking a hotel needs something to book. The catalogue had none: a property
 * carried a `skuId` pointing at a package SKU priced at
 * `perNightEGP x packageNights`, which is a five-night package price, not a
 * nightly rate. "Book this stay" therefore charged five nights for any number
 * of nights. Room types are what make a stay quotable, so this backfill exists
 * to make the catalogue bookable on the day it lands rather than after someone
 * types 1,219 rows into an admin form.
 *
 * ---------------------------------------------------------------------------
 * The capacity rule, and why half the catalogue is deliberately left unsellable
 * ---------------------------------------------------------------------------
 * `accommodation.rooms` is 0 on 636 of the 1217 active properties — including
 * 228 of the 413 hotels. Zero there means "the importer never learned a
 * number", not "the property has no rooms", and it is indistinguishable from a
 * genuinely empty property if we just copy it.
 *
 * So zero is copied as zero, and a zero-unit room type is created **inactive**.
 * It appears in the admin backfill queue and nowhere else. Guessing a capacity
 * would invent a scarcity claim — the exact thing `totalUnits` exists to make
 * ("only 3 rooms left", "no eleventh booking on a five-room villa"), and a
 * wrong one is worse than none. The 581 properties with a real figure are
 * sellable immediately.
 *
 * ---------------------------------------------------------------------------
 * Why each room type gets its own SKU
 * ---------------------------------------------------------------------------
 * The legacy package SKU is priced per stay and reused by /book-now. Re-basing
 * it to `per_night` would silently change what an existing booking charges, so
 * the backfill creates `SKU-RT-<accommodationId>` alongside it and leaves the
 * old row untouched. That doubles the hotel SKU count until an admin retires
 * the legacy ones; it does not change a single live price. Two price regimes
 * coexist deliberately, and the retirement is a separate, reversible step.
 */

export interface BackfillRoomTypesResult {
  total: number;
  created: number;
  updated: number;
  /** Room types left inactive because no capacity is known. */
  unsellable: number;
  /** Of the sellable ones, how many carry a Tripadvisor placeholder capacity. */
  estimatedCapacity: number;
  summary: string;
}

/** Stable across re-imports, so an upsert lands on the same row. */
const roomTypeIdFor = (accommodationId: string) => `RT-${accommodationId}`;
/** A separate SKU namespace from the legacy `SKU-<id>` / `SKU-ACCTA-<id>`. */
const skuIdFor = (accommodationId: string) => `SKU-RT-${accommodationId}`;

const DEFAULT_MIN_NIGHTS = 1;
const DEFAULT_MAX_NIGHTS = 30;
const DEFAULT_CANCELLATION_HOURS = 48;

/**
 * Whether the Tripadvisor importer owns this row or contributed to it.
 *
 * That importer hardcodes `rooms: 10` on every row it creates — a placeholder,
 * not a count (server/db/seeds/importDahabTripadvisorStays.ts). A capacity that
 * came from there is recorded as an estimate so the UI can say so, rather than
 * presenting ten fictional rooms as fact.
 *
 * Both markers are checked because they disagree in the field: the rating source
 * is overwritten when an importer enriches a curated row, while the `ACCTA-`
 * id prefix survives regardless.
 */
function isTripadvisorSourced(a: AccommodationEntity): boolean {
  return (
    a.ratingSource === 'Tripadvisor' ||
    a.id.startsWith('ACCTA-') ||
    a.tripadvisor !== undefined
  );
}

export function backfillRoomTypes(): BackfillRoomTypesResult {
  let created = 0;
  let updated = 0;
  let unsellable = 0;
  let estimatedCapacity = 0;

  const properties = db.accommodations.filter(a => a.active);

  for (const a of properties) {
    const roomTypeId = roomTypeIdFor(a.id);
    const skuId = skuIdFor(a.id);

    // A capacity is only a capacity if it is a positive number. Anything else —
    // absent, zero, negative, NaN — means "unknown", and is carried through as
    // zero rather than coerced into something sellable.
    const knownRooms = Number(a.rooms);
    const totalUnits = Number.isFinite(knownRooms) && knownRooms > 0 ? Math.floor(knownRooms) : 0;

    const inventorySource: InventorySource = isTripadvisorSourced(a)
      ? 'TRIPADVISOR_ESTIMATE'
      : 'SEED_PUBLISHED';

    if (totalUnits === 0) unsellable += 1;
    else if (inventorySource === 'TRIPADVISOR_ESTIMATE') estimatedCapacity += 1;

    // The supplier is whatever already fulfils this property, so a stay settles
    // against the same payee the package SKU did.
    const supplierId =
      db.productSkus.find(s => s.id === a.skuId)?.supplierId ?? `SUP-${a.id}`;

    const existing = db.roomTypes.findIndex(r => r.id === roomTypeId);

    if (existing >= 0) {
      // Admin-owned rows are left alone. Once someone in the admin has confirmed
      // a capacity, re-running the seed must not stamp the placeholder back
      // over it — that is the difference between an idempotent seed and one
      // that silently reverts real edits on the next deploy.
      if (db.roomTypes[existing].inventorySource === 'ADMIN_VERIFIED') continue;

      db.roomTypes[existing] = {
        ...db.roomTypes[existing],
        baseNightlyEGP: a.perNightEGP,
        totalUnits,
        inventorySource,
        active: totalUnits > 0,
        updatedAt: new Date().toISOString(),
      };
      // The room type moved (a capacity was corrected, a rate changed), so its
      // nightly SKU has to move with it — otherwise the kernel keeps selling an
      // inactive or wrongly-priced SKU behind an active room type. Admin-verified
      // rows skip both for the same reason: the seed must not overwrite either.
      ensureNightlySku(db.roomTypes[existing], db.productSkus);
      updated += 1;
      continue;
    }

    const roomType: RoomTypeEntity = {
      id: roomTypeId,
      accommodationId: a.id,
      skuId,
      supplierId,
      code: 'STD',
      name: a.name,
      nameAr: a.nameAr,
      description: a.description,
      descriptionAr: a.descriptionAr,
      maxGuestsPerUnit: a.maxGuests > 0 ? a.maxGuests : 2,
      baseNightlyEGP: a.perNightEGP,
      minNights: DEFAULT_MIN_NIGHTS,
      maxNights: DEFAULT_MAX_NIGHTS,
      cancellationPolicyHours: DEFAULT_CANCELLATION_HOURS,
      totalUnits,
      inventorySource,
      amenities: [],
      images: a.coverImageUrl ? [a.coverImageUrl] : [],
      // Inactive until the capacity is known. This is the only thing standing
      // between "we did not know how many rooms it has" and selling a guest a
      // room that does not exist.
      active: totalUnits > 0,
      displayOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.roomTypes.push(roomType);
    ensureNightlySku(roomType, db.productSkus);
    created += 1;
  }

  return {
    total: properties.length,
    created,
    updated,
    unsellable,
    estimatedCapacity,
    summary:
      `Room types backfilled: ${properties.length} properties (${created} created, ` +
      `${updated} updated). ${properties.length - unsellable} sellable; ` +
      `${unsellable} held back for want of a room count ` +
      `(${estimatedCapacity} of the sellable ones carry an estimated capacity).`,
  };
}

/**
 * The per-night SKU a room type sells through.
 *
 * `per_night` with `basePriceEGP` as one night's rate is what lets the stay
 * engine price a duration; `maxCapacityPerSlot` mirrors the room type's units so
 * the inventory the commerce kernel already has lines up with what can actually
 * be sold. Upserted, never rebuilt — a row with a live stay on it keeps its
 * identity and its createdAt.
 *
 * Exported because the admin room-type endpoints must keep this SKU in step
 * when an editor changes a rate or a capacity — the same rule the backfill
 * applies, from the same single place.
 */
export function ensureNightlySku(roomType: RoomTypeEntity, skus: ProductSkuEntity[]): void {
  const at = skus.findIndex(s => s.id === roomType.skuId);
  // No createdAt/updatedAt: ProductSkuEntity carries none. Its identity is the
  // id, and the room type row is what stamps when this was derived.
  const sku: ProductSkuEntity = {
    id: roomType.skuId,
    supplierId: roomType.supplierId,
    serviceType: 'hotel',
    title: `${roomType.name} — Standard`,
    titleAr: `${roomType.nameAr} — عادي`,
    description: 'Standard room, priced per night.',
    descriptionAr: 'غرفة عادية، سعرها بالليلة.',
    durationMinutes: 1440,
    basePriceEGP: roomType.baseNightlyEGP,
    currency: 'EGP',
    maxCapacityPerSlot: roomType.totalUnits,
    active: roomType.active,
    cancellationPolicyHours: roomType.cancellationPolicyHours,
    pricingBasis: 'per_night',
  };

  if (at >= 0) skus[at] = { ...skus[at], ...sku };
  else skus.push(sku);
}