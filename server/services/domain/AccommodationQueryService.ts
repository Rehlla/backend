import { db } from '../../db/database';
import type { AccommodationSearchFilters } from '../../db/schema';
import {
  PROPERTY_TYPES,
  ACCOMMODATION_CATEGORIES,
  ACCOMMODATION_PRICE_BANDS,
  searchAccommodations,
  toAccommodationView,
  getAreaGuide,
  getAccommodationCatalogueMeta
} from '../accommodationService';
import { applyAccommodationViewOverlays } from '../catalogContentService';
import { assertCheckInNotPast, quoteStay } from '../hotelPricingService';
import {
  requiredString,
  requiredCount,
  requiredCalendarDate,
  optionalCount
} from '../../middleware/bodyParams';

/**
 * Transport-agnostic catalogue queries — slice 2 of the polyglot surface.
 *
 * Serves the SAME card projection the REST route answers under
 * ?view=card (GET /api/accommodations): the listing grid and the map need the
 * compact shape, and the gallery / Tripadvisor provenance / bookable flag /
 * note / bestFor stay on the detail page. Filter validation lives HERE — not
 * in the transports — so an invalid enum member is rejected with a 400 on
 * GraphQL and gRPC exactly like REST's enumListParam.
 */
export class AccommodationQueryService {
  /**
   * Card search with the same response envelope as GET /api/accommodations
   * (?view=card): cards + areas + stats + disclaimer. `raw` is the caller's
   * filter object, validated here.
   */
  static cardSearch(raw: unknown) {
    const filters = parseCardFilters(raw);
    const results = searchAccommodations(filters);
    const meta = getAccommodationCatalogueMeta();

    const stats = {
      total: results.length,
      averageRating: results.length
        ? Math.round((results.reduce((sum, a) => sum + a.rating, 0) / results.length) * 10) / 10
        : 0,
      totalReviews: results.reduce((sum, a) => sum + a.reviewCount, 0),
      updatedLabel: meta.updatedLabel
    };

    const views = applyAccommodationViewOverlays(results.map(toAccommodationView));
    // The exact field set the REST card view drops — kept in one place so the
    // projection cannot fork between transports.
    const cards = views.map((view) => {
      const {
        galleryImageUrls: _gallery,
        tripadvisor: _tripadvisor,
        bookable: _bookable,
        note: _note,
        noteAr: _noteAr,
        bestFor: _bestFor,
        bestForAr: _bestForAr,
        ...card
      } = view as typeof view & Record<string, unknown>;
      return card;
    });

    return {
      cards,
      areas: AccommodationQueryService.areas(),
      stats,
      disclaimer: meta.disclaimer
    };
  }

  /** Neighborhood guide over areas that actually have an active property. */
  static areas() {
    return getAreaGuide(db.accommodations.filter((a) => a.active));
  }

  /**
   * The room types a property sells, cheapest-order, sellable only — the
   * public REST payload verbatim (GET /:slug/room-types). Null for an
   * unknown slug: the flat-404 semantics, so the caller learns nothing about
   * properties it cannot see.
   */
  static roomTypes(slug: string) {
    const accommodation = stayBySlug(slug);
    if (!accommodation) return null;
    const roomTypes = db.roomTypes
      .filter((rt) => rt.accommodationId === accommodation.id && rt.active && rt.totalUnits > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.baseNightlyEGP - b.baseNightlyEGP);
    return {
      accommodationId: accommodation.id,
      roomTypes,
      /** A stay with no room count is held back, not guessed — say why it is absent. */
      heldBack: db.roomTypes.some((rt) => rt.accommodationId === accommodation.id && !rt.active)
    };
  }

  /**
   * What a stay costs. The same validation ladder as
   * POST /api/accommodations/:slug/quote; stateless — the reservation
   * re-prices under a lock, so this figure is never a promise. Null for an
   * unknown slug; validation problems throw the same errors REST answers
   * with (carry .status like bodyParams/StayQuoteError do).
   */
  static stayQuote(slug: string, body: unknown) {
    const accommodation = stayBySlug(slug);
    if (!accommodation) return null;
    const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    const checkIn = requiredCalendarDate(raw.checkIn, 'checkIn');
    assertCheckInNotPast(checkIn);
    return quoteStay({
      accommodationId: accommodation.id,
      roomTypeId: requiredString(raw.roomTypeId, 'roomTypeId', 128),
      checkIn,
      checkOut: requiredCalendarDate(raw.checkOut, 'checkOut'),
      rooms: requiredCount(raw.rooms, 'rooms', 1, 20),
      adults: requiredCount(raw.adults, 'adults', 1, 30),
      children: optionalCount(raw.children, 'children', 0, 20) ?? 0
    });
  }
}

function stayBySlug(slug: string | undefined) {
  const normalized = slug?.toLowerCase().trim();
  return normalized ? db.accommodations.find((a) => a.slug === normalized && a.active) : undefined;
}

const SORT_MODES = ['relevance', 'rating', 'price_asc', 'price_desc'] as const;

function badRequest(message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = 400;
  return err;
}

/**
 * Validates a raw filter object into AccommodationSearchFilters. Mirrors the
 * REST query parser's contract: types are checked, unknown enum members are
 * a 400 naming what is allowed, absent fields mean "no filter".
 *
 * Two transport realities are honoured here:
 *  - proto3 zero-values mean "unset" (the gRPC contract documented in
 *    dahab.proto, and what proto-loader delivers for absent scalars) — so
 *    minRating/maxPerNightEGP/guests of 0 apply no filter, exactly like the
 *    REST parser treats an absent ?minRating.
 *  - empty lists mean "no filter" (proto-loader sends [] for absent repeated
 *    fields); a NON-empty list with unknown members is still a 400.
 *
 * The max-price key is accepted in both the REST/GraphQL casing
 * (maxPerNightEGP) and the proto-loader casing (maxPerNightEgp, from the
 * snake_case max_per_night_egp field).
 */
function parseCardFilters(raw: unknown): AccommodationSearchFilters {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const str = (value: unknown, field: string): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw badRequest(`"${field}" must be a string.`);
    return value;
  };
  const stringList = (value: unknown, field: string): string[] | undefined => {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || !value.every((e) => typeof e === 'string')) {
      throw badRequest(`"${field}" must be a list of strings.`);
    }
    // An explicit empty list is "no filter" on every transport (proto3's
    // default for repeated fields); the service's .length checks agree.
    const list = value as string[];
    return list.length ? list : undefined;
  };
  const enumList = <T extends string>(value: unknown, allowed: readonly T[], field: string): T[] | undefined => {
    const list = stringList(value, field);
    if (!list) return undefined;
    if (list.some((e) => !(allowed as readonly string[]).includes(e))) {
      throw badRequest(`"${field}" accepts: ${allowed.join(', ')}.`);
    }
    return list as T[];
  };
  const num = (value: unknown, field: string): number | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw badRequest(`"${field}" must be a number.`);
    }
    return value;
  };
  // proto3 zero = unset, matching the documented gRPC contract and the REST
  // parser's absent-parameter behaviour.
  const positiveNum = (value: unknown, field: string): number | undefined => {
    const n = num(value, field);
    return n !== undefined && n > 0 ? n : undefined;
  };

  const sort = str(f.sort, 'sort');
  if (sort && !(SORT_MODES as readonly string[]).includes(sort)) {
    throw badRequest(`"sort" accepts: ${SORT_MODES.join(', ')}.`);
  }

  return {
    q: str(f.q, 'q'),
    propertyTypes: enumList(f.propertyTypes, PROPERTY_TYPES, 'propertyTypes'),
    categories: enumList(f.categories, ACCOMMODATION_CATEGORIES, 'categories'),
    priceBands: enumList(f.priceBands, ACCOMMODATION_PRICE_BANDS, 'priceBands'),
    areaIds: stringList(f.areaIds, 'areaIds'),
    minRating: positiveNum(f.minRating, 'minRating'),
    maxPerNightEGP: positiveNum(f.maxPerNightEGP ?? f.maxPerNightEgp, 'maxPerNightEGP'),
    guests: positiveNum(f.guests, 'guests'),
    mustHaveAmenities: stringList(f.mustHaveAmenities, 'mustHaveAmenities'),
    sort: sort as AccommodationSearchFilters['sort']
  };
}
