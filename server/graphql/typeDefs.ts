/**
 * GraphQL gateway — slice 1 (support thread, DayGI concierge, platform health).
 *
 * The SDL deliberately mirrors the REST projections the SPA already consumes.
 * Identity never appears in the schema: every field resolves through the
 * domain services (SupportService, DayGiDomainService) with the actor handed
 * in by the transport — the session on REST, the metadata on a future gRPC
 * surface, the context object here.
 */

export const typeDefs = /* GraphQL */ `
  type Query {
    "The caller's own support thread. Operations and Admin see the full queue."
    support: SupportThread!

    "The caller's DayGI concierge state. Identity comes from the session."
    daygi: DayGi!

    "Platform health — the no-PII subset of GET /api/health."
    platform: Platform!

    "Public pre-signup browsing — the same card projection as GET /api/accommodations?view=card."
    accommodationCards(filters: AccommodationCardFilters): AccommodationCardsResult!

    "Neighborhood guide over areas that have an active property."
    areas: [AreaGuideEntry!]!

    "A property's sellable room types. Null for an unknown slug."
    roomTypes(slug: String!): RoomTypesResult

    "What a stay costs — never a promise (re-priced on reserve). Null for an unknown slug."
    stayQuote(slug: String!, input: StayQuoteInput!): StayQuote
  }

  type Mutation {
    "File a support message. Same validation, audit and staff-event path as POST /api/support/messages."
    supportCreateMessage(input: SupportMessageInput!): SupportMessage!
  }

  input SupportMessageInput {
    "Max 2000 characters, enforced by SupportService."
    message: String!
    travelerName: String
    travelerPhone: String
    travelerEmail: String
    tripId: String
    category: String
    bookingRef: String
    urgent: Boolean
  }

  type SupportThread {
    messages: [SupportMessage!]!
    openCount: Int!
  }

  type SupportMessage {
    id: ID!
    userId: String!
    travelerName: String!
    travelerPhone: String
    travelerEmail: String
    tripId: String
    category: String
    bookingRef: String
    message: String!
    urgent: Boolean!
    status: String!
    createdAt: String!
    updatedAt: String!
    reply: String
    repliedBy: String
    repliedAt: String
  }

  type DayGi {
    "The caller's structured memory (auto-created on first read)."
    memory: DayGiMemory!

    "Tasks for one trip. tripId is required, matching GET /api/daygi/tasks."
    tasks(tripId: String!): [DayGiTask!]!

    "Null for BOTH a missing task and somebody else's task — the REST route's flat-404 semantics expressed as nullability."
    task(taskId: String!): DayGiTask
  }

  type DayGiMemory {
    userId: String!
    preferences: DayGiPreferences!
    learnedInsights: [String!]!
    learnedInsightsAr: [String!]!
    recentIntents: [String!]!
    updatedAt: String!
  }

  type DayGiPreferences {
    pace: String
    morningPreference: String
    divingLevel: String
    dietaryPreferences: [String!]!
    budgetBand: String
    transferPreference: String
    seafoodPreference: Boolean
    avoidsLongTransfers: Boolean
  }

  type DayGiTask {
    taskId: ID!
    userId: String!
    tripId: String!
    intent: String
    titleEn: String
    titleAr: String
    currentStepNumber: Int
    totalSteps: Int
    riskLevel: String
    state: String
    steps: [DayGiTaskStep!]!
  }

  type DayGiTaskStep {
    stepId: ID!
    stepNumber: Int
    name: String
    nameAr: String
    state: String
    riskLevel: String
    error: String
  }

  type Platform {
    status: String!
    service: String!
    adapter: String!
    ledgerBalanced: Boolean!
    ledgerChainIntact: Boolean!
    timestamp: String!
  }

  # -------------------------------------------------------------------------
  # Public catalogue (slice 2) — mirrors GET /api/accommodations?view=card.
  # Nullable fields are exactly the ones a CMS overlay may blank; the rest are
  # required by AccommodationEntity and enforced by the seed importers.
  # -------------------------------------------------------------------------

  input AccommodationCardFilters {
    q: String
    propertyTypes: [String!]
    categories: [String!]
    priceBands: [String!]
    areaIds: [String!]
    minRating: Float
    maxPerNightEGP: Int
    guests: Int
    mustHaveAmenities: [String!]
    sort: String
  }

  type AccommodationCard {
    id: ID!
    slug: String!
    name: String!
    nameAr: String!
    propertyType: String!
    category: String!
    priceBand: String!
    areaId: String!
    area: String!
    areaName: String!
    areaNameAr: String!
    rating: Float!
    reviewCount: Int!
    ratingSource: String
    typeChips: [String!]!
    typeChipsAr: [String!]!
    tagline: String
    taglineAr: String
    description: String
    descriptionAr: String
    amenities: [String!]!
    amenitiesAr: [String!]!
    perNightEGP: Int!
    weeklyRateEGP: Int
    monthlyRateEGP: Int
    packageNights: Int!
    rooms: Int!
    maxGuests: Int!
    latitude: Float
    longitude: Float
    skuId: String!
    active: Boolean!
    featured: Boolean!
    coverImageUrl: String
    sourceUrl: String
    createdAt: String!
    updatedAt: String!
    packageTotalEGP: Int!
  }

  type CatalogueStats {
    total: Int!
    averageRating: Float!
    totalReviews: Int!
    updatedLabel: String
  }

  type AreaGuideEntry {
    id: ID!
    name: String!
    nameAr: String!
    description: String
    descriptionAr: String
  }

  type AccommodationCardsResult {
    cards: [AccommodationCard!]!
    areas: [AreaGuideEntry!]!
    stats: CatalogueStats!
    disclaimer: String
  }

  # -------------------------------------------------------------------------
  # Stays (slice 3) — mirrors GET /:slug/room-types and POST /:slug/quote.
  # -------------------------------------------------------------------------

  type RoomType {
    id: ID!
    accommodationId: String!
    skuId: String!
    supplierId: String!
    code: String!
    name: String!
    nameAr: String!
    description: String
    descriptionAr: String
    maxGuestsPerUnit: Int!
    bedType: String
    bedCount: Int
    sizeSqm: Float
    view: String
    baseNightlyEGP: Int!
    weeklyRateEGP: Int
    monthlyRateEGP: Int
    minNights: Int!
    maxNights: Int!
    cancellationPolicyHours: Int!
    totalUnits: Int!
    inventorySource: String!
    amenities: [String!]!
    images: [String!]!
    active: Boolean!
    displayOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type RoomTypesResult {
    accommodationId: String!
    roomTypes: [RoomType!]!
    heldBack: Boolean!
  }

  type NightCharge {
    date: String!
    nightlyEGP: Int!
    rooms: Int!
    totalEGP: Int!
  }

  type StayQuote {
    accommodationId: String!
    roomTypeId: String!
    rooms: Int!
    adults: Int!
    children: Int!
    minNights: Int!
    freeCancellationUntil: String!
    expiresAt: String!
    inventorySource: String!
    nights: Int!
    nightsDetail: [NightCharge!]!
    baseEGP: Int!
    longStayDiscountEGP: Int!
    serviceFeeEGP: Int!
    taxEGP: Int!
    totalEGP: Int!
    currency: String!
    depositEGP: Int!
    balanceDueEGP: Int!
  }

  input StayQuoteInput {
    roomTypeId: String!
    "YYYY-MM-DD, the first slept night."
    checkIn: String!
    "YYYY-MM-DD, the morning of departure (exclusive)."
    checkOut: String!
    rooms: Int!
    adults: Int!
    children: Int
  }
`;
