export type DahabAreaId =
  | 'lighthouse'
  | 'mashraba'
  | 'assalah'
  | 'laguna'
  | 'eel_garden'
  | 'blue_hole'
  | 'canyon'
  | 'three_pools'
  | 'ras_abu_galum'
  | 'blue_lagoon'
  | 'gabr_el_bint'
  | 'st_catherine'
  | 'wadi_gnai';

export type SourceProvenanceStatus =
  | 'Verified'
  | 'Source-backed'
  | 'Operationally confirmed'
  | 'Seeded'
  | 'Adapter'
  | 'Inferred'
  | 'Unknown'
  | 'Stale';

export type SourceClassificationType =
  | 'Authoritative'
  | 'Verified Local'
  | 'Market Intelligence'
  | 'Derived'
  | 'AI-Inferred';

export type AccessMethodType =
  | 'walking'
  | 'shore_entry'
  | 'boat'
  | 'vehicle_taxi'
  | 'jeep_4x4'
  | 'camel'
  | 'hiking'
  | 'mixed';

export type ShoreEntryType =
  | 'sandy_gradual'
  | 'rocky_booties_required'
  | 'reef_table_entry'
  | 'deep_wall_step_in'
  | 'boat_only'
  | 'not_applicable';

export type SkillLevelType =
  | 'first_timer'
  | 'beginner'
  | 'intermediate'
  | 'advanced_certified'
  | 'technical_only'
  | 'freediving_all'
  | 'snorkeling_only';

export type ConnectivityTierType =
  | 'full_4g'
  | 'spotty_3g'
  | 'remote_limited'
  | 'zero_signal_offline';

export type SunsetModeType =
  | 'social_sunset'
  | 'quiet_sunset'
  | 'sea_sunset'
  | 'desert_sunset';

export type ArrivalFrictionScoreType = 'easy' | 'moderate' | 'needs_attention';

export interface EnvironmentalDependency {
  windMinKnots?: number;
  windMaxKnots?: number;
  optimalWindDirection?: string;
  tideSensitive: boolean;
  seaStateTolerance: 'calm_only' | 'moderate_swell_ok' | 'rough_tolerant';
  daylightCrucial: boolean;
  heatSensitivity: 'low' | 'moderate' | 'high_afternoon_exposure';
}

export interface DahabPlaceContext {
  id: string;
  canonicalName: string;
  nameAr: string;
  aliases: string[];
  areaId: DahabAreaId;
  areaName: string;
  areaNameAr: string;
  destinationType: 'Reef' | 'Beach & Lagoon' | 'Desert Valley' | 'Mountain' | 'Village Hub' | 'Protected Sanctuary';
  relationToCenter: string; // e.g. "Center / 0 min", "12 km North / 25 min 4x4"
  travelTimeMinutesFromCenter: number;
  walkabilityFromPromenade: boolean;
  transferRequirement: 'none_walkable' | 'short_taxi' | 'jeep_4x4_required' | 'boat_or_camel';
  accessMethod: AccessMethodType;
  accessMethodLabel: string;
  accessMethodLabelAr: string;
  accessDifficulty: 'Easy' | 'Moderate' | 'Demanding' | 'Expedition';
  shoreEntryType: ShoreEntryType;
  shoreEntryLabel: string;
  shoreEntryLabelAr: string;
  associatedActivities: string[];
  skillSuitability: SkillLevelType[];
  skillSuitabilityLabel: string;
  skillSuitabilityLabelAr: string;
  safetyVerificationStatus: SourceProvenanceStatus;
  safetyNotes?: string;
  safetyNotesAr?: string;
  remotenessTier: 'central' | 'suburban' | 'remote_outpost' | 'deep_wilderness';
  isExpeditionModeTrigger: boolean;
  connectivity: ConnectivityTierType;
  connectivityLabel: string;
  connectivityLabelAr: string;
  powerExpectation: '24/7 Grid Power' | 'Solar / Generator Timed' | 'No Electricity';
  bestSunsetType?: SunsetModeType;
  practicalChecklist: {
    item: string;
    itemAr: string;
    isMandatory: boolean;
    reason: string;
  }[];
  cashAdvice: 'cash_essential' | 'card_accepted_cash_backup' | 'cards_common';
  cashAdviceReason: string;
  cashAdviceReasonAr: string;
  environmentalDependencies: EnvironmentalDependency;
  nearbyFoodIds: string[];
  provenance: {
    status: SourceProvenanceStatus;
    classification: SourceClassificationType;
    sourceName: string;
    verifiedBySinaiOps: boolean;
    lastAudited: string;
    confidence: number;
  };
}

export interface DahabRestaurantContext {
  id: string;
  name: string;
  nameAr: string;
  areaId: DahabAreaId;
  areaName?: string;
  areaLabel: string;
  areaLabelAr: string;
  locationDescription: string;
  locationDescriptionAr: string;
  cuisine: string;
  cuisineAr: string;
  priceLevel: '$' | '$$' | '$$$';
  averageMealEGP: number;
  openHoursFormatted: string;
  bestFor: string;
  bestForAr: string;
  atmosphere: string;
  walkingMinutesFromReefs: { [reefPlaceId: string]: number };
  verifiedStatus: SourceProvenanceStatus;
  cashOnly: boolean;
}

export interface LiveDahabConditions {
  observedAt: string;
  freshness: 'Fresh (<30m)' | 'Aging (1-3h)' | 'Stale (>4h)' | 'Unknown / Fallback';
  provenance: SourceProvenanceStatus;
  windSpeedKnots: number;
  windDirection: 'N' | 'NNE' | 'NE' | 'ENE' | 'E' | 'ESE' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'NNW';
  seaState: 'Glassy Calm' | 'Gentle Riffle' | 'Moderate Chop' | 'Rough Swell';
  waterVisibilityMeters: number;
  waterTempC: number;
  airTempC: number;
  uvIndex: number;
  sunsetTimeStr: string; // e.g. "06:18 PM"
  kitesurfSuitability: 'Optimal' | 'Acceptable' | 'Marginal' | 'Too Weak' | 'Gale Warning';
  deepDiveSuitability: 'Pristine' | 'Good' | 'Current Caution' | 'High Swell Delay';
  rasAbuGalumBoatStatus: 'Operating Smoothly' | 'Subject to Afternoon Chop' | 'Caution' | 'Suspended';
}

export interface EmergencyResourceItem {
  id: string;
  name: string;
  nameAr: string;
  category: 'hyperbaric' | 'ambulance' | 'police' | 'clinic' | 'ground_ops';
  phone: string;
  location: string;
  locationAr: string;
  source: string;
  verifiedAt: string; // e.g. "2026-08-25T12:00:00+02:00"
  owner: string;
  revalidationIntervalDays: number;
  notes: string;
  notesAr: string;
  status: SourceProvenanceStatus;
}

export interface OfflineTripPackPayload {
  tripId: string;
  packageVersion: string;
  generatedAtTimestamp: string;
  dynamicDataDisclaimer: string;
  dynamicConditionsSnapshot?: {
    observedAt: string;
    freshness: string;
    windSpeedKnots: number;
    windDirection: string;
    seaState: string;
    waterVisibilityMeters: number;
    waterTempC: number;
    sunsetTimeStr: string;
    disclaimer: string;
  };
  traveler: {
    name: string;
    phone: string;
    travelersCount: number;
    dates: string;
  };
  accommodation: {
    hotelName: string;
    area: string;
    address: string;
    receptionPhone: string;
    checkInTime: string;
    checkOutTime: string;
    confirmationCode: string;
  };
  itinerarySummary: {
    dayNumber: number;
    date: string;
    theme: string;
    intensity: string;
    anchor: string;
    accessMethod: string;
    keyLandmarks: string[];
    prepNotes: string[];
    connectivity: string;
    emergencyPoint: string;
  }[];
  confirmedBookings: {
    code: string;
    type: string;
    title: string;
    provider: string;
    phone: string;
    meetingPoint: string;
    departureTime: string;
    included: string[];
  }[];
  emergencyProtocol: {
    hyperbaricChamberDahab: string;
    sinaiAmbulance: string;
    policeTouristOffice: string;
    dahabClinicCenter: string;
    localSinaiDeskEscort: string;
  };
  emergencyResources: EmergencyResourceItem[];
  practicalChecklist: {
    category: string;
    items: string[];
  }[];
}
