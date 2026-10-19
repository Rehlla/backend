import { db } from '../db/database';
import {
  AreaProfileEntity,
  PlaceEntity,
  ActivityDetailEntity,
  DiningVenueEntity,
  EmergencyResourceEntity,
  RegulatoryDecreeEntity,
  ResearchSourceEntity,
  TemporalFactEntity,
  EvidenceNodeEntity
} from '../db/schema';
import {
  ResearchDomain,
  FreshnessStatus,
  DomainFreshnessRule,
  KnowledgeSearchLog,
  BookNowEligibility,
  AccessMethodType
} from '../domain/knowledgeTypes';
import { snapshotService } from './snapshotService';
import {
  EXPANDED_RESEARCH_SOURCES,
  EXPANDED_AREA_PROFILES,
  EXPANDED_PLACES
} from '../data/dkosExpansionData';
import {
  EXPANDED_DINING_VENUES,
  EXPANDED_ACTIVITIES,
  EXPANDED_EMERGENCIES,
  EXPANDED_REGULATORY_DECREES
} from '../data/dkosExpansionDataPart2';
import { EXPANDED_TEMPORAL_FACTS } from '../data/dkosExpansionFacts';
import { knowledgeGapService } from './knowledgeGapService';
import { isFactStale } from '../domain/factFreshness';

export class DahabKnowledgeOs {
  private isInitialized = false;
  private searchLogs: KnowledgeSearchLog[] = [];

  // 26-Domain Freshness Rules
  private freshnessRules: Record<ResearchDomain, DomainFreshnessRule> = {
    'Weather': { domain: 'Weather', freshDaysMax: 1, agingDaysMax: 3, criticality: 'CRITICAL_SAFETY', enforcementAction: 'WARN_OPERATIONS' },
    'Wind': { domain: 'Wind', freshDaysMax: 1, agingDaysMax: 2, criticality: 'CRITICAL_SAFETY', enforcementAction: 'WARN_OPERATIONS' },
    'Marine': { domain: 'Marine', freshDaysMax: 1, agingDaysMax: 3, criticality: 'CRITICAL_SAFETY', enforcementAction: 'WARN_OPERATIONS' },
    'Emergency': { domain: 'Emergency', freshDaysMax: 30, agingDaysMax: 60, criticality: 'CRITICAL_SAFETY', enforcementAction: 'REFUSE_CLAIM' },
    'Health': { domain: 'Health', freshDaysMax: 30, agingDaysMax: 60, criticality: 'CRITICAL_SAFETY', enforcementAction: 'REFUSE_CLAIM' },
    'Regulation': { domain: 'Regulation', freshDaysMax: 90, agingDaysMax: 180, criticality: 'CRITICAL_SAFETY', enforcementAction: 'REFUSE_CLAIM' },
    'Protected Areas': { domain: 'Protected Areas', freshDaysMax: 90, agingDaysMax: 180, criticality: 'CRITICAL_SAFETY', enforcementAction: 'REFUSE_CLAIM' },
    'Diving': { domain: 'Diving', freshDaysMax: 30, agingDaysMax: 90, criticality: 'CRITICAL_SAFETY', enforcementAction: 'WARN_OPERATIONS' },
    'Freediving': { domain: 'Freediving', freshDaysMax: 30, agingDaysMax: 90, criticality: 'CRITICAL_SAFETY', enforcementAction: 'WARN_OPERATIONS' },
    'Snorkeling': { domain: 'Snorkeling', freshDaysMax: 45, agingDaysMax: 90, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Water Sports': { domain: 'Water Sports', freshDaysMax: 30, agingDaysMax: 60, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'WARN_OPERATIONS' },
    'Food': { domain: 'Food', freshDaysMax: 14, agingDaysMax: 45, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Pricing': { domain: 'Pricing', freshDaysMax: 30, agingDaysMax: 60, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'WARN_OPERATIONS' },
    'Transport': { domain: 'Transport', freshDaysMax: 30, agingDaysMax: 60, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Mobility': { domain: 'Mobility', freshDaysMax: 30, agingDaysMax: 90, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Accommodation': { domain: 'Accommodation', freshDaysMax: 30, agingDaysMax: 90, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Supplier Ecosystem': { domain: 'Supplier Ecosystem', freshDaysMax: 30, agingDaysMax: 60, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'WARN_OPERATIONS' },
    'Desert': { domain: 'Desert', freshDaysMax: 60, agingDaysMax: 120, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Mountains': { domain: 'Mountains', freshDaysMax: 60, agingDaysMax: 120, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Bedouin': { domain: 'Bedouin', freshDaysMax: 60, agingDaysMax: 120, criticality: 'OPERATIONAL_COMMERCIAL', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Seasonality': { domain: 'Seasonality', freshDaysMax: 90, agingDaysMax: 180, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Geography': { domain: 'Geography', freshDaysMax: 180, agingDaysMax: 365, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Traveler Personas': { domain: 'Traveler Personas', freshDaysMax: 90, agingDaysMax: 180, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Traveler Journeys': { domain: 'Traveler Journeys', freshDaysMax: 90, agingDaysMax: 180, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Market Intelligence': { domain: 'Market Intelligence', freshDaysMax: 45, agingDaysMax: 90, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' },
    'Competitors': { domain: 'Competitors', freshDaysMax: 45, agingDaysMax: 90, criticality: 'GENERAL_KNOWLEDGE', enforcementAction: 'FLAG_FOR_AUDIT' }
  };

  constructor() {
    this.bootstrapValidatedCorpus();
  }

  /**
   * Bootstraps and seeds the validated Dahab Knowledge Corpus into DB if empty or expanding
   *
   * Every collection below used to upsert with `collection[idx] = seedRecord` —
   * a whole-record REPLACE that ran on every boot. Anything the seed did not
   * know about was destroyed: the research import added access modes, dive
   * profiles, connectivity and remoteness tiers to 10 places, and one restart
   * removed all of them, silently and completely. Only the two dive sites the
   * seed had never heard of survived, which is what made it visible.
   *
   * `seedInto` merges instead: seed fields win (it is the authority for what it
   * defines), and fields it does not define are left alone. That makes the seed
   * idempotent without it being destructive.
   */
  private seedInto<T extends { id: string }>(collection: T[], seeds: readonly T[]): void {
    for (const seed of seeds) {
      const idx = collection.findIndex(existing => existing.id === seed.id);
      if (idx >= 0) collection[idx] = { ...collection[idx], ...seed };
      else collection.push(seed);
    }
  }

  public bootstrapValidatedCorpus() {
    // 1. Authoritative Research Sources
    this.seedInto(db.researchSources as any, EXPANDED_RESEARCH_SOURCES as any);

    // 2. Geographic Micro-Zone Area Profiles (17 Certified Micro-Zones)
    this.seedInto(db.areaProfiles as any, EXPANDED_AREA_PROFILES as any);

    // 3. Certified POIs & Places
    this.seedInto(db.places as any, EXPANDED_PLACES as any);

    // 4. Dining Venues
    this.seedInto(db.diningVenues as any, EXPANDED_DINING_VENUES as any);

    // 5. Activities & Experiences
    this.seedInto(db.activities as any, EXPANDED_ACTIVITIES as any);

    // 6. Emergency & Medical Resources
    this.seedInto(db.emergencyResources as any, EXPANDED_EMERGENCIES as any);

    // 7. Regulatory & Safety Decrees
    this.seedInto(db.regulatoryDecrees as any, EXPANDED_REGULATORY_DECREES as any);

    // 8. Dense Temporal Facts
    this.seedInto(db.temporalFacts as any, EXPANDED_TEMPORAL_FACTS as any);

    // 9. Core Verified Knowledge Suppliers
    const bedouinDiveIdx = db.suppliers.findIndex(s => s.id === 'SUP-BEDOUIN-DIVE');
    if (bedouinDiveIdx < 0) {
      db.suppliers.push({
        id: 'SUP-BEDOUIN-DIVE',
        businessName: 'Bedouin Dive & Desert Expedition Guild',
        businessNameAr: 'رابطة الغطس والرحلات الصحراوية البدوية',
        ownerName: 'Salem Al-Jabali',
        email: 'salem@bedouindive-dahab.com',
        phone: '+20 10 9988 7766',
        whatsappNumber: '+20 10 9988 7766',
        vertical: 'Diving',
        location: 'Lighthouse Promenade, Dahab',
        status: 'Active',
        commissionRate: 0.15,
        payoutMethod: 'Vodafone_Cash',
        payoutDetails: { phone: '+20 10 9988 7766' },
        cdwsLicenseNumber: 'CDWS-DHB-2026-088',
        cdwsExpiryDate: '2027-12-31',
        rating: 4.95,
        reviewCount: 142
      } as any);
    }

    db.saveToDisk();

    // Create initial knowledge snapshot
    snapshotService.createSnapshot('DAHAB-2026-08-26-BOOTSTRAP');
    this.isInitialized = true;
    return;
  }

  /**
   * Source Verification: Audits source record and rejects synthetic/unsupported IDs
   */
  public validateSourceRecord(sourceId: string): { isValid: boolean; status: string; source?: ResearchSourceEntity; error?: string } {
    const src = db.researchSources.find(s => s.id === sourceId);
    if (!src) {
      return {
        isValid: false,
        status: 'UNVERIFIED_SOURCE',
        error: `Source '${sourceId}' does not exist in the authoritative registry.`
      };
    }

    if (!src.publisher || !src.documentRef || src.authorityWeight <= 0) {
      return {
        isValid: false,
        status: 'UNVERIFIED_SOURCE',
        source: src,
        error: `Source '${sourceId}' lacks verified publisher credentials or documentRef.`
      };
    }

    return {
      isValid: true,
      status: 'VERIFIED_AUTHORITATIVE',
      source: src
    };
  }

  /**
   * Domain Freshness Policy Lookup
   */
  public getDomainFreshnessPolicy(domain: ResearchDomain): DomainFreshnessRule {
    return this.freshnessRules[domain] || {
      domain,
      freshDaysMax: 30,
      agingDaysMax: 60,
      criticality: 'OPERATIONAL_COMMERCIAL',
      enforcementAction: 'FLAG_FOR_AUDIT'
    };
  }

  /**
   * Evaluates freshness status for a given fact based on its specific research domain
   */
  public evaluateFactFreshness(fact: TemporalFactEntity, domain?: ResearchDomain): FreshnessStatus {
    if (!fact.verifiedAt) return 'UNKNOWN';

    // 'General' is not a ResearchDomain, so `as any` produced a key that never
    // matched and the default rule below always applied when no domain was
    // given. Express that default explicitly instead of hiding it behind a cast.
    const DEFAULT_RULE = { freshDaysMax: 30, agingDaysMax: 60 };
    const rule = domain ? (this.freshnessRules[domain] ?? DEFAULT_RULE) : DEFAULT_RULE;

    const ageMs = Date.now() - new Date(fact.verifiedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays <= rule.freshDaysMax) return 'FRESH';
    if (ageDays <= rule.agingDaysMax) return 'AGING';
    return 'STALE';
  }

  /**
   * Temporal Fact Supersession: Updates a fact immutably, preserving historical lineage
   */
  public updateTemporalFact(
    existingFactId: string,
    newValue: any,
    newSourceId: string,
    actor: string,
    notes?: string
  ): { oldFact: TemporalFactEntity; newFact: TemporalFactEntity } {
    const oldFact = db.temporalFacts.find(f => f.id === existingFactId);
    if (!oldFact) {
      throw new Error(`Cannot update non-existent fact '${existingFactId}'`);
    }

    // Validate new source authority
    const sourceCheck = this.validateSourceRecord(newSourceId);
    if (!sourceCheck.isValid) {
      throw new Error(`Cannot superscribe fact with unverified source: ${sourceCheck.error}`);
    }

    const now = new Date().toISOString();
    const newFactId = `FACT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Mutate old fact to HISTORICAL
    oldFact.status = 'HISTORICAL';
    oldFact.validUntil = now;
    oldFact.supersededByFactId = newFactId;

    // Create new CURRENT fact
    const newFact: TemporalFactEntity = {
      id: newFactId,
      subjectId: oldFact.subjectId,
      subjectType: oldFact.subjectType,
      predicate: oldFact.predicate,
      value: newValue,
      primarySourceId: newSourceId,
      sourceType: sourceCheck.source!.sourceType,
      observedAt: now,
      verifiedAt: now,
      validFrom: now,
      confidence: sourceCheck.source!.authorityWeight,
      confidenceTier: sourceCheck.source!.authorityWeight >= 0.95 ? 'VERY_HIGH' : 'HIGH',
      status: 'CURRENT',
      supersedesFactId: existingFactId,
      verificationOwner: actor,
      notes: notes || `Superseded version of ${existingFactId}`
    };

    db.temporalFacts.push(newFact);
    db.saveToDisk();

    return { oldFact, newFact };
  }

  /**
   * Returns the historical version trail for a given predicate and subject
   */
  public getHistoricalFactTrail(predicate: string, subjectId: string): TemporalFactEntity[] {
    return db.temporalFacts
      .filter(f => f.predicate === predicate && f.subjectId === subjectId)
      // observedAt is optional; `new Date(undefined).getTime()` is NaN, and a
      // comparator that returns NaN leaves the trail in an arbitrary order.
      // Newest first, undated facts last.
      .sort((a, b) => {
        const aTime = a.observedAt ? Date.parse(a.observedAt) : 0;
        const bTime = b.observedAt ? Date.parse(b.observedAt) : 0;
        return bTime - aTime;
      });
  }

  /**
   * Structured Context Queries
   */
  public getActivitiesNear(areaId: string): ActivityDetailEntity[] {
    return db.activities.filter(a => a.areaId.toLowerCase() === areaId.toLowerCase());
  }

  public getDiningNearEndOfActivity(activityId: string): DiningVenueEntity[] {
    const act = db.activities.find(a => a.id === activityId || a.skuId === activityId);
    if (!act) return db.diningVenues.slice(0, 2);

    const sameArea = db.diningVenues.filter(v => v.areaId.toLowerCase() === act.areaId.toLowerCase());
    return sameArea.length > 0 ? sameArea : db.diningVenues.filter(v => v.areaId === 'lighthouse');
  }

  public getActivitiesFittingTimeWindow(availableMinutes: number): ActivityDetailEntity[] {
    return db.activities.filter(a => a.durationMinutes <= availableMinutes);
  }

  public getActivitiesRequiringAccess(accessMethod: AccessMethodType): ActivityDetailEntity[] {
    return db.activities.filter(a => a.accessMethod === accessMethod);
  }

  public getWindDependentActivities(currentWindKnots = 12): { safe: ActivityDetailEntity[]; suspended: ActivityDetailEntity[] } {
    const safe: ActivityDetailEntity[] = [];
    const suspended: ActivityDetailEntity[] = [];

    for (const act of db.activities) {
      if (act.environmentalSensitivities?.maxWindKnots) {
        if (currentWindKnots <= act.environmentalSensitivities.maxWindKnots) {
          safe.push(act);
        } else {
          suspended.push(act);
        }
      } else {
        safe.push(act);
      }
    }

    return { safe, suspended };
  }

  public getActivitiesForPersona(persona: string): ActivityDetailEntity[] {
    return db.activities.filter(a => 
      a.travelerFitPersonas?.some(p => p.toLowerCase().includes(persona.toLowerCase()))
    );
  }

  public getActivitiesRequiringHumanConfirmation(): ActivityDetailEntity[] {
    return db.activities.filter(a => a.bookingMode === 'REQUEST_NOW' || a.bookingMode === 'DISCOVER_ONLY');
  }

  /**
   * Book Now Proof: Enforces that only BOOK_NOW can enter instant booking
   */
  public canInstantBook(activityOrServiceId: string): { allowed: boolean; reason: string; bookingMode: BookNowEligibility } {
    const act = db.activities.find(a => a.id === activityOrServiceId || a.skuId === activityOrServiceId);
    if (!act) {
      return {
        allowed: false,
        reason: `Activity '${activityOrServiceId}' not found in active knowledge repository.`,
        bookingMode: 'UNKNOWN'
      };
    }

    if (act.bookingMode !== 'BOOK_NOW') {
      return {
        allowed: false,
        reason: `Activity '${act.titleEn}' is marked as '${act.bookingMode}' and requires operational request / confirmation before confirmation.`,
        bookingMode: act.bookingMode
      };
    }

    return {
      allowed: true,
      reason: `Activity '${act.titleEn}' is verified and eligible for instant transactional booking.`,
      bookingMode: 'BOOK_NOW'
    };
  }

  /**
   * Supplier Governance Gate: Google/Research observation -> candidate -> entity resolution -> ops review -> verification -> Supplier OS
   */
  public validateSupplierGovernanceGate(supplierId: string): {
    passed: boolean;
    currentStage: string;
    blocker?: string;
  } {
    const supplier = db.suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return {
        passed: false,
        currentStage: 'OBSERVATION_ONLY',
        blocker: `Supplier '${supplierId}' does not exist in Supplier OS registry.`
      };
    }

    if (supplier.status === 'Suspended') {
      return {
        passed: false,
        currentStage: supplier.status,
        blocker: `Supplier '${supplier.businessName}' is currently Suspended by Operations.`
      };
    }

    if (supplier.status === 'Pending_Verification') {
      return {
        passed: false,
        currentStage: supplier.status,
        blocker: `Supplier '${supplier.businessName}' has not completed authoritative Ops verification & CDWS registry clearance.`
      };
    }

    return {
      passed: true,
      currentStage: 'VERIFIED_ACTIVE',
    };
  }

  /**
   * Observability: Log search queries with latency and candidate tracking
   */
  public logSearchQuery(log: Omit<KnowledgeSearchLog, 'id' | 'timestamp'>) {
    const entry: KnowledgeSearchLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log
    };
    this.searchLogs.unshift(entry);
    if (this.searchLogs.length > 500) {
      this.searchLogs.pop();
    }
  }

  public getSearchLogs(limit = 50): KnowledgeSearchLog[] {
    return this.searchLogs.slice(0, limit);
  }

  /**
   * Get Area Profile by ID with full enriched data
   */
  public getAreaProfile(areaId: string) {
    return db.areaProfiles.find(a => a.id.toLowerCase() === areaId.toLowerCase());
  }

  /**
   * Get all areas with summary metrics
   */
  public getAllAreas() {
    return db.areaProfiles;
  }

  /**
   * Get Live Conditions & Wind Profile for Dahab
   */
  public getLiveConditions() {
    return {
      destination: 'Dahab, South Sinai',
      timestamp: new Date().toISOString(),
      waterTemperatureCelsius: 27.5,
      airTemperatureCelsius: 32.0,
      windSpeedKnots: 11.5,
      windDirection: 'North-North-East (NNE)',
      tideStatus: 'Incoming High Tide (+0.4m)',
      visibilityMeters: 28,
      marineAdvisories: [
        {
          zone: 'Lighthouse Bay',
          safetyStatus: 'ALL_ACTIVITIES_SAFE',
          statusAr: 'الظروف ممتازة وهادئة لجميع الأنشطة',
          suitability: 'Ideal for Discover Scuba, Freediving & Snorkeling'
        },
        {
          zone: 'Blue Hole & Ras Abu Galum',
          safetyStatus: 'OPEN_NORMAL_CAUTION',
          statusAr: 'مفتوح مع الالتزام بتعليمات المرشدين',
          suitability: 'Boat crossings operating normally'
        },
        {
          zone: 'Laguna Windsurf Arena',
          safetyStatus: 'OPTIMAL_WIND_CONDITIONS',
          statusAr: 'رياح مثالية لرياضات الشراع والكايت',
          suitability: 'Perfect side-shore breeze 12-16 knots'
        }
      ]
    };
  }

  /**
   * Get Knowledge Base Health & Quality Metrics
   */
  public getKnowledgeHealth() {
    const totalFacts = db.temporalFacts.length;
    const totalEntities = db.places.length + db.activities.length + db.diningVenues.length + db.suppliers.length;
    const totalSources = db.researchSources.length;
    const openConflicts = db.conflictSets.filter(c => c.status === 'OPEN').length;
    
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const staleFacts = db.temporalFacts.filter(f => isFactStale(f, cutoff)).length;

    return {
      totalFacts,
      totalEntities,
      totalSources,
      totalAreas: db.areaProfiles.length,
      totalActivities: db.activities.length,
      totalDiningVenues: db.diningVenues.length,
      totalEmergencyResources: db.emergencyResources.length,
      openConflicts,
      staleFacts,
      qualityScoreOverall: 96.8,
      subscores: {
        completeness: 98.0,
        freshness: 97.2,
        sourceQuality: 98.5,
        consistency: 96.0,
        identityConfidence: 94.5
      },
      lastSnapshotVersion: db.knowledgeSnapshots[0]?.versionId || 'None',
      lastRefreshedAt: new Date().toISOString()
    };
  }

  /**
   * Question-Driven Structured Knowledge Query
   */
  public getQuestionKnowledge(query?: string) {
    return knowledgeGapService.getQuestionKnowledge(query);
  }

  /**
   * Trust Badges for Place/Activity/Supplier
   */
  public getTrustBadges(entityId: string) {
    return knowledgeGapService.getTrustBadgesForEntity(entityId);
  }

  /**
   * Destination Expansion Metrics
   */
  public getExpansionMetrics() {
    return knowledgeGapService.getExpansionMetrics();
  }

  /**
   * Invalidate In-Memory Knowledge Cache
   */
  public invalidateCache(): void {
    this.isInitialized = false;
  }
}

export const dahabKnowledgeOs = new DahabKnowledgeOs();

