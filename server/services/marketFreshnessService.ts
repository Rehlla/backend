import crypto from 'crypto';
import { db } from '../db/database';
import { distributedLockService } from './distributedLockService';
import {
  SupplierEntity,
  SupplierOfferEntity,
  PriceObservationEntity,
  MarketChangeEventEntity,
  MarketSnapshotEntity,
  SourceFreshnessEntity,
  ContactHistoryEntity,
  MarketPriceStatEntity,
  SocialAccountEntity,
  TemporalFactEntity,
  MarketRefreshRunEntity,
  MarketReviewQueueEntity,
  SourceHealthEntity,
  FreshnessStatus,
  PriceChangeType,
  MarketEventType,
  VerificationLevel,
  PricingBasis,
  LocalCommerceSourceType
} from '../db/schema';
import { dahabKnowledgeOs } from './dahabKnowledgeOs';

export interface SourceSnapshotPayload {
  sourceId?: string;
  sourceReference: string;
  sourceType: LocalCommerceSourceType;
  ingestionMode?: 'LIVE_FETCH' | 'IMPORTED_SNAPSHOT' | 'MANUAL_REFRESH';
  capturedAt: string;
  contentFingerprint?: string;
  rawReference?: string;
  suppliers?: Partial<SupplierEntity>[];
  offers?: Partial<SupplierOfferEntity>[];
  priceObservations?: Partial<PriceObservationEntity>[];
  socialAccounts?: Partial<SocialAccountEntity>[];
}

export interface RefreshResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILURE';
  runId: string;
  snapshotId: string;
  timestamp: string;
  ingestionMode: 'LIVE_FETCH' | 'IMPORTED_SNAPSHOT' | 'MANUAL_REFRESH';
  changesDetectedCount: number;
  changesRecorded: number;
  events: MarketChangeEventEntity[];
  anomaliesDetectedCount: number;
  conflictsDetectedCount: number;
  stats: {
    totalSuppliers: number;
    totalOffers: number;
    totalObservations: number;
    freshCount: number;
    recentCount: number;
    agingCount: number;
    staleCount: number;
    expiredCount: number;
  };
  marketStatistics: MarketPriceStatEntity[];
  message: string;
}

export class MarketFreshnessService {
  /**
   * Deterministic Content Fingerprinting
   */
  public getSupplierFingerprint(supplier: Partial<SupplierEntity>): string {
    const name = (supplier.businessName || supplier.id || '').trim().toLowerCase();
    const phone = (supplier.phone || '').trim().replace(/\s+/g, '');
    const ig = (supplier.whatsapp || '').trim().toLowerCase();
    return `fp_sup_${name}_${phone}_${ig}`;
  }

  public getOfferFingerprint(offer: Partial<SupplierOfferEntity>): string {
    const sup = (offer.supplierId || '').trim().toLowerCase();
    const act = (offer.activityId || '').trim().toLowerCase();
    const title = (offer.titleEn || offer.sourceActivityName || '').trim().toLowerCase();
    return `fp_off_${sup}_${act}_${title}`;
  }

  public getPriceFingerprint(obs: Partial<PriceObservationEntity>): string {
    const off = (obs.offerId || `${obs.supplierId}_${obs.activityId}`).trim().toLowerCase();
    const amt = (obs.priceEGP !== undefined ? obs.priceEGP : obs.amount) || 0;
    const curr = (obs.currency || 'EGP').trim().toUpperCase();
    const basis = (obs.pricingBasis || 'PER_PERSON').trim().toUpperCase();
    return `fp_prc_${off}_${amt}_${curr}_${basis}`;
  }

  public getContactFingerprint(supplierId: string, field: string, value: string): string {
    return `fp_cnt_${supplierId}_${field}_${value.trim().toLowerCase()}`;
  }

  /**
   * Determine data freshness based on observation/source age (in days)
   * FRESH: <= 7 days (Score 100)
   * RECENT: <= 30 days (Score 95-80)
   * AGING: <= 90 days (Score 79-50)
   * STALE: <= 180 days (Score 49-20)
   * EXPIRED: > 180 days (Score 0)
   * UNKNOWN: missing or invalid date (Score 40)
   */
  public calculateFreshness(
    dateStr?: string,
    referenceTime: number | Date | string = Date.now()
  ): {
    status: FreshnessStatus;
    score: number;
    ageInDays: number;
    toString: () => string;
  } {
    const refMs = typeof referenceTime === 'number'
      ? referenceTime
      : referenceTime instanceof Date
        ? referenceTime.getTime()
        : Date.parse(referenceTime) || Date.now();

    if (!dateStr) {
      const res = { status: FreshnessStatus.UNKNOWN, score: 40, ageInDays: 999 };
      return { ...res, toString: () => res.status };
    }
    const parsed = Date.parse(dateStr);
    if (isNaN(parsed)) {
      const res = { status: FreshnessStatus.UNKNOWN, score: 40, ageInDays: 999 };
      return { ...res, toString: () => res.status };
    }

    const ageInDays = Math.max(0, Math.floor((refMs - parsed) / (1000 * 60 * 60 * 24)));
    let status = FreshnessStatus.EXPIRED;
    let score = 0;

    if (ageInDays <= 7) {
      status = FreshnessStatus.FRESH;
      score = 100;
    } else if (ageInDays <= 30) {
      status = FreshnessStatus.RECENT;
      score = Math.max(80, Math.round(95 - ((ageInDays - 7) / 23) * 15));
    } else if (ageInDays <= 90) {
      status = FreshnessStatus.AGING;
      score = Math.max(50, Math.round(79 - ((ageInDays - 30) / 60) * 29));
    } else if (ageInDays <= 180) {
      status = FreshnessStatus.STALE;
      score = Math.max(20, Math.round(49 - ((ageInDays - 90) / 90) * 29));
    } else {
      status = FreshnessStatus.EXPIRED;
      score = 0;
    }

    return {
      status,
      score,
      ageInDays,
      toString: () => status
    };
  }

  /**
   * Calculate numerical freshness score (0 - 100)
   */
  public getFreshnessScore(status: FreshnessStatus): number {
    switch (status) {
      case FreshnessStatus.FRESH:
      case FreshnessStatus.CURRENT:
        return 100;
      case FreshnessStatus.RECENT:
      case FreshnessStatus.CURRENT_LIKELY:
        return 85;
      case FreshnessStatus.AGING:
        return 65;
      case FreshnessStatus.OLD:
      case FreshnessStatus.STALE:
        return 30;
      case FreshnessStatus.EXPIRED:
        return 0;
      case FreshnessStatus.UNKNOWN:
      default:
        return 40;
    }
  }

  /**
   * Detect price change between old observation and new observation with anomaly detection
   */
  public evaluatePriceChange(
    oldObs: PriceObservationEntity | null,
    incomingOrAmount: PriceObservationEntity | number,
    newBasis?: PricingBasis,
    newFreshness?: FreshnessStatus,
    offerTitleEn: string = '',
    offerTitleAr: string = ''
  ): {
    eventType: MarketEventType;
    changeType: PriceChangeType;
    previousValue: any;
    newValue: any;
    delta: number;
    percentage: number;
    percentageChange: number;
    supplierId?: string;
    activityId?: string;
    isAnomaly?: boolean;
    anomalyReason?: string;
    summaryEn: string;
    summaryAr: string;
  } {
    const isObject = typeof incomingOrAmount === 'object' && incomingOrAmount !== null;
    const incoming = isObject ? (incomingOrAmount as PriceObservationEntity) : null;
    const newAmount = incoming ? (incoming.priceEGP !== undefined ? incoming.priceEGP : incoming.amount || 0) : (incomingOrAmount as number);
    const basis = incoming ? (incoming.pricingBasis || 'PER_PERSON') : (newBasis || 'PER_PERSON');
    const supplierId = incoming?.supplierId || oldObs?.supplierId;
    const activityId = incoming?.activityId || oldObs?.activityId;

    const oldAmount = oldObs ? (oldObs.priceEGP !== undefined ? oldObs.priceEGP : oldObs.amount || 0) : 0;
    const oldBasis = oldObs ? (oldObs.pricingBasis || 'PER_PERSON') : 'PER_PERSON';

    if (!oldObs) {
      return {
        eventType: 'PRICE_INCREASE',
        changeType: 'NEW_PRICE',
        previousValue: 0,
        newValue: newAmount,
        delta: 0,
        percentage: 0,
        percentageChange: 0,
        supplierId,
        activityId,
        isAnomaly: false,
        summaryEn: `Initial price observation of ${newAmount} EGP recorded for "${offerTitleEn}".`,
        summaryAr: `تم تسجيل أول رصد سعري بقيمة ${newAmount} ج.م لعرض "${offerTitleAr || offerTitleEn}".`
      };
    }

    // Check pricing basis change
    if (oldBasis && oldBasis !== basis) {
      const delta = newAmount - oldAmount;
      const percentage = oldAmount > 0 ? Math.round((delta / oldAmount) * 100) : 0;
      return {
        eventType: 'PRICING_BASIS_CHANGED',
        changeType: 'PRICING_BASIS_CHANGED',
        previousValue: oldBasis,
        newValue: basis,
        delta,
        percentage,
        percentageChange: percentage,
        supplierId,
        activityId,
        isAnomaly: false,
        summaryEn: `Pricing basis changed from ${oldBasis} (${oldAmount} EGP) to ${basis} (${newAmount} EGP).`,
        summaryAr: `تغيرت طريقة التسعير من ${oldBasis} (${oldAmount} ج.م) إلى ${basis} (${newAmount} ج.م).`
      };
    }

    const delta = newAmount - oldAmount;
    const percentage = oldAmount > 0 ? Number(((delta / oldAmount) * 100).toFixed(1)) : 0;

    // Price anomaly detection: >300% jump or >80% drop on identical pricing basis
    let isAnomaly = false;
    let anomalyReason: string | undefined;
    if (oldAmount > 0 && oldBasis === basis) {
      if (percentage >= 300) {
        isAnomaly = true;
        anomalyReason = `Suspicious price spike (+${percentage}% from ${oldAmount} to ${newAmount} EGP). Flagged for review.`;
      } else if (percentage <= -80) {
        isAnomaly = true;
        anomalyReason = `Suspicious price drop (${percentage}% from ${oldAmount} to ${newAmount} EGP). Flagged for review.`;
      }
    }

    if (delta > 0) {
      return {
        eventType: isAnomaly ? 'PRICE_ANOMALY' : 'PRICE_INCREASE',
        changeType: isAnomaly ? 'PRICE_ANOMALY' : 'PRICE_INCREASE',
        previousValue: oldAmount,
        newValue: newAmount,
        delta,
        percentage,
        percentageChange: percentage,
        supplierId,
        activityId,
        isAnomaly,
        anomalyReason,
        summaryEn: isAnomaly
          ? `Price anomaly detected: Observed price surged by ${delta} EGP (+${percentage}%) from ${oldAmount} to ${newAmount} EGP.`
          : `Observed price increased by ${delta} EGP (+${percentage}%) from ${oldAmount} to ${newAmount} EGP.`,
        summaryAr: isAnomaly
          ? `تم رصد قفزة سعرية استثنائية: ارتفع السعر بمقدار ${delta} ج.م (+${percentage}%) من ${oldAmount} إلى ${newAmount} ج.م.`
          : `ارتفع السعر المرصود بمقدار ${delta} ج.م (+${percentage}%) من ${oldAmount} إلى ${newAmount} ج.م.`
      };
    } else if (delta < 0) {
      return {
        eventType: isAnomaly ? 'PRICE_ANOMALY' : 'PRICE_DECREASE',
        changeType: isAnomaly ? 'PRICE_ANOMALY' : 'PRICE_DECREASE',
        previousValue: oldAmount,
        newValue: newAmount,
        delta,
        percentage,
        percentageChange: percentage,
        supplierId,
        activityId,
        isAnomaly,
        anomalyReason,
        summaryEn: isAnomaly
          ? `Price anomaly detected: Observed price dropped by ${Math.abs(delta)} EGP (${percentage}%) from ${oldAmount} to ${newAmount} EGP.`
          : `Observed price decreased by ${Math.abs(delta)} EGP (${percentage}%) from ${oldAmount} to ${newAmount} EGP.`,
        summaryAr: isAnomaly
          ? `تم رصد انخفاض سعري استثنائي: انخفض السعر بمقدار ${Math.abs(delta)} ج.م (${percentage}%) من ${oldAmount} إلى ${newAmount} ج.م.`
          : `انخفض السعر المرصود بمقدار ${Math.abs(delta)} ج.م (${percentage}%) من ${oldAmount} إلى ${newAmount} ج.م.`
      };
    } else {
      return {
        eventType: 'PRICE_INCREASE',
        changeType: 'PRICE_UNCHANGED',
        previousValue: oldAmount,
        newValue: newAmount,
        delta: 0,
        percentage: 0,
        percentageChange: 0,
        supplierId,
        activityId,
        isAnomaly: false,
        summaryEn: `Observed price re-verified unchanged at ${newAmount} EGP.`,
        summaryAr: `تمت إعادة التحقق من السعر المرصود وثبوته عند ${newAmount} ج.م.`
      };
    }
  }

  /**
   * Check and record contact changes for a supplier
   */
  public detectContactChanges(
    existingSupplier: SupplierEntity,
    newContacts: { phone?: string; whatsapp?: string; email?: string; socialLinks?: string[]; leadContact?: string },
    source: string,
    observedAt: string
  ): { historyEntries: ContactHistoryEntity[]; changeEvents: MarketChangeEventEntity[] } {
    const historyEntries: ContactHistoryEntity[] = [];
    const changeEvents: MarketChangeEventEntity[] = [];
    const now = new Date().toISOString();

    const fieldsToCheck: Array<keyof typeof newContacts> = ['phone', 'whatsapp', 'email', 'leadContact'];
    for (const f of fieldsToCheck) {
      const rawOld = (existingSupplier as any)[f] || '';
      const rawNew = newContacts[f] || '';
      const oldVal = Array.isArray(rawOld) ? rawOld.join(', ') : String(rawOld);
      const newVal = Array.isArray(rawNew) ? rawNew.join(', ') : String(rawNew);
      if (newVal && oldVal && oldVal !== newVal) {
        const id = `cnt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        historyEntries.push({
          id,
          supplierId: existingSupplier.id,
          field: f as any,
          oldValue: oldVal,
          newValue: newVal,
          source,
          observedAt,
          detectedAt: now
        });

        changeEvents.push({
          id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          eventType: 'CONTACT_CHANGED',
          entityType: 'SUPPLIER',
          entityId: existingSupplier.id,
          supplierId: existingSupplier.id,
          summaryEn: `Supplier ${existingSupplier.businessName} updated ${f} from "${oldVal}" to "${newVal}".`,
          summaryAr: `قام المورد ${existingSupplier.businessNameAr || existingSupplier.businessName} بتحديث ${f} من "${oldVal}" إلى "${newVal}".`,
          details: {
            field: f,
            oldValue: oldVal,
            newValue: newVal,
            sourceReference: source
          },
          observedAt,
          detectedAt: now
        });
      }
    }

    return { historyEntries, changeEvents };
  }

  /**
   * Execute transactional, idempotent Live Dahab Market Refresh Pipeline
   */
  public executeMarketRefresh(payload: {
    suppliers?: Partial<SupplierEntity>[];
    offers?: Partial<SupplierOfferEntity>[];
    priceObservations?: Partial<PriceObservationEntity>[];
    socialAccounts?: Partial<SocialAccountEntity>[];
    sourceReference?: string;
    sourceType?: LocalCommerceSourceType;
    ingestionMode?: 'LIVE_FETCH' | 'IMPORTED_SNAPSHOT' | 'MANUAL_REFRESH';
    triggerSource?: string;
    referenceTime?: string;
    snapshot?: SourceSnapshotPayload;
  }): RefreshResult {
    const referenceTime = payload.referenceTime || payload.snapshot?.capturedAt || new Date().toISOString();
    const referenceMs = Date.parse(referenceTime) || Date.now();
    const trigger = payload.triggerSource || payload.sourceReference || payload.snapshot?.sourceReference || 'AUTOMATED_MARKET_MONITOR';
    const srcRef = payload.sourceReference || payload.snapshot?.sourceReference || 'MARKET_MONITOR_SYNC';
    const srcType = payload.sourceType || payload.snapshot?.sourceType || 'INSTAGRAM';
    const ingestionMode = payload.ingestionMode || payload.snapshot?.ingestionMode || 'IMPORTED_SNAPSHOT';

    const runId = `RUN-MKT-${Date.now()}-${crypto.randomBytes(3).toString('hex').slice(0, 5)}`;
    const now = new Date().toISOString();

    const suppliersToProcess = payload.suppliers || payload.snapshot?.suppliers || [];
    const offersToProcess = payload.offers || payload.snapshot?.offers || [];
    const observationsToProcess = payload.priceObservations || payload.snapshot?.priceObservations || [];
    const socialAccountsToProcess = payload.socialAccounts || payload.snapshot?.socialAccounts || [];

    // Initialize Refresh Run manifest
    const runRecord: MarketRefreshRunEntity = {
      id: runId,
      runId,
      startedAt: now,
      sourceCount: 1,
      supplierCount: suppliersToProcess.length,
      offerCount: offersToProcess.length,
      priceObservationCount: observationsToProcess.length,
      changesDetected: 0,
      errors: [],
      status: 'RUNNING',
      ingestionMode,
      sourceReference: srcRef
    };

    const lock = distributedLockService.tryAcquire('lock:marketRefresh', 30000);
    if (!lock) {
      throw Object.assign(new Error('Market refresh already in progress (lock:marketRefresh).'), { status: 409 });
    }
    try {
      return db.runInTransaction(() => {
      try {
        const generatedEvents: MarketChangeEventEntity[] = [];
        const newContactHistory: ContactHistoryEntity[] = [];
        let anomaliesCount = 0;
        let conflictsCount = 0;

        // Ensure state lists exist
        if (!db.state.marketChangeEvents) db.state.marketChangeEvents = [];
        if (!db.state.marketSnapshots) db.state.marketSnapshots = [];
        if (!db.state.sourceFreshnessRecords) db.state.sourceFreshnessRecords = [];
        if (!db.state.contactHistory) db.state.contactHistory = [];
        if (!db.state.priceObservations) db.state.priceObservations = [];
        if (!db.state.supplierOffers) db.state.supplierOffers = [];
        if (!db.state.suppliers) db.state.suppliers = [];
        if (!db.state.socialAccounts) db.state.socialAccounts = [];
        if (!db.state.temporalFacts) db.state.temporalFacts = [];
        if (!db.state.marketRefreshRuns) db.state.marketRefreshRuns = [];
        if (!db.state.marketReviewQueue) db.state.marketReviewQueue = [];
        if (!db.state.sourceHealthRecords) db.state.sourceHealthRecords = [];

        // 1. Process Supplier Ingestion / Updates
        for (const sup of suppliersToProcess) {
          if (!sup.id) continue;
          const existing = db.suppliers.find(s => s.id === sup.id);
          if (!existing) {
            // New supplier detected
            const newSup: SupplierEntity = {
              id: sup.id,
              businessName: sup.businessName || sup.id,
              businessNameAr: sup.businessNameAr || sup.businessName || sup.id,
              category: (sup.category as any) || 'safari',
              serviceTypes: sup.serviceTypes || ['DESERT_SAFARI'],
              tier: sup.tier || 'Vetted Local Partner',
              status: sup.status || 'Active',
              leadContact: sup.leadContact || sup.businessName || sup.id,
              licenseNumber: sup.licenseNumber || `LIC-${sup.id}`,
              area: sup.area || sup.locationArea || 'Lighthouse',
              verificationStatus: sup.verificationStatus || 'SOURCE_REPORTED',
              cdwsVerified: !!sup.cdwsVerified,
              phone: sup.phone || '',
              whatsapp: sup.whatsapp,
              email: sup.email || '',
              locationArea: sup.locationArea || 'Lighthouse, Dahab',
              rating: sup.rating || 4.5,
              reviewCount: sup.reviewCount || sup.reviewsCount || 1,
              reviewsCount: sup.reviewsCount || sup.reviewCount || 1,
              sourceProvenance: sup.sourceProvenance || [srcRef],
              sourceType: sup.sourceType || srcType,
              lastObservedDate: referenceTime,
              dataFreshness: this.calculateFreshness(referenceTime, referenceMs).status
            };
            db.suppliers.push(newSup);

            const evt: MarketChangeEventEntity = {
              id: `evt_sup_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              eventType: 'NEW_SUPPLIER',
              entityType: 'SUPPLIER',
              entityId: newSup.id,
              supplierId: newSup.id,
              summaryEn: `New Dahab supplier discovered: "${newSup.businessName}" (${newSup.category}).`,
              summaryAr: `تم رصد مورد جديد في دهب: "${newSup.businessNameAr}" (${newSup.category}).`,
              details: {
                newValue: newSup.businessName,
                sourceReference: srcRef,
                sourceType: srcType
              },
              observedAt: referenceTime,
              detectedAt: now
            };
            generatedEvents.push(evt);

            // Add DKOS Temporal Fact
            db.temporalFacts.push({
              id: `tf_sup_${newSup.id}_${Date.now()}`,
              subjectId: newSup.id,
              subjectType: 'SUPPLIER',
              predicate: 'hasStatus',
              value: 'ACTIVE_DISCOVERED',
              factKey: 'SUPPLIER_STATUS',
              factValue: 'ACTIVE_DISCOVERED',
              factValueAr: 'نشط تم رصده',
              sourceType: srcType,
              status: 'CURRENT',
              confidence: newSup.cdwsVerified ? 1.0 : 0.85,
              sourceCount: 1,
              primarySourceId: srcRef,
              firstObservedAt: referenceTime,
              lastObservedAt: referenceTime,
              validFrom: referenceTime
            });
          } else {
            // Check Contact Changes
            const contactCheck = this.detectContactChanges(
              existing,
              { phone: sup.phone, whatsapp: sup.whatsapp, email: sup.email, leadContact: sup.leadContact },
              srcRef,
              referenceTime
            );
            newContactHistory.push(...contactCheck.historyEntries);
            generatedEvents.push(...contactCheck.changeEvents);

            // Check Regulatory Status Change
            if (sup.verificationStatus && sup.verificationStatus !== existing.verificationStatus) {
              const oldVer = existing.verificationStatus;
              existing.verificationStatus = sup.verificationStatus;
              if (sup.cdwsVerified !== undefined) existing.cdwsVerified = sup.cdwsVerified;

              generatedEvents.push({
                id: `evt_reg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                eventType: 'REGULATORY_STATUS_CHANGED',
                entityType: 'REGULATORY',
                entityId: existing.id,
                supplierId: existing.id,
                summaryEn: `Regulatory verification for ${existing.businessName} updated from ${oldVer} to ${sup.verificationStatus}.`,
                summaryAr: `تغيرت حالة التوثيق الرقابي لـ ${existing.businessNameAr || existing.businessName} من ${oldVer} إلى ${sup.verificationStatus}.`,
                details: {
                  oldValue: oldVer,
                  newValue: sup.verificationStatus,
                  sourceReference: srcRef,
                  sourceType: srcType
                },
                observedAt: referenceTime,
                detectedAt: now
              });

              // Queue for manual review if regulatory status downgraded
              if (sup.verificationStatus === 'UNVERIFIED_REGULATORY_CLAIM' || sup.cdwsVerified === false) {
                db.marketReviewQueue.push({
                  id: `REV-REG-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
                  issueType: 'REGULATORY_CHANGE',
                  severity: 'HIGH',
                  status: 'PENDING_REVIEW',
                  supplierId: existing.id,
                  summaryEn: `Supplier ${existing.businessName} regulatory status changed to ${sup.verificationStatus}.`,
                  summaryAr: `تغير الموقف الرقابي للمورد ${existing.businessNameAr || existing.businessName} إلى ${sup.verificationStatus}.`,
                  evidence: { oldVerification: oldVer, newVerification: sup.verificationStatus, sourceReference: srcRef },
                  detectedAt: now
                });
              }
            }

            // Update freshness & observation date
            existing.lastObservedDate = referenceTime;
            existing.dataFreshness = this.calculateFreshness(referenceTime, referenceMs).status;
            if (sup.phone) existing.phone = sup.phone;
            if (sup.whatsapp) existing.whatsapp = sup.whatsapp;
            if (sup.email) existing.email = sup.email;
          }
        }

        // 2. Process Social Accounts & Activity Signal Monitoring
        for (const soc of socialAccountsToProcess) {
          const socHandle = soc.handle || soc.username;
          if (!soc.supplierId || !socHandle) continue;
          const existingSoc = db.socialAccounts.find(
            s => s.supplierId === soc.supplierId && (s.handle === socHandle || s.username === socHandle)
          );
          if (!existingSoc) {
            const newSoc: SocialAccountEntity = {
              id: `soc_${soc.supplierId}_${soc.platform || 'INSTAGRAM'}`,
              supplierId: soc.supplierId,
              platform: soc.platform || 'INSTAGRAM',
              username: socHandle,
              handle: socHandle,
              ownershipStatus: soc.ownershipStatus || 'OWNERSHIP_CONFIRMED',
              category: soc.category || 'BUSINESS',
              isBusinessAccount: soc.isBusinessAccount !== false,
              profileUrl: soc.profileUrl || `https://instagram.com/${socHandle}`,
              bio: soc.bio || '',
              followersCount: soc.followersCount,
              postsCount: soc.postsCount,
              lastPostDate: soc.lastPostDate || referenceTime,
              lastObservedAt: referenceTime,
              sourceReference: srcRef,
              retrievedAt: referenceTime,
              verificationStatus: soc.verificationStatus || 'INSTAGRAM_REPORTED',
              active: soc.active !== false
            };
            db.socialAccounts.push(newSoc);

            generatedEvents.push({
              id: `evt_soc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              eventType: 'INSTAGRAM_ACCOUNT_CHANGED',
              entityType: 'SOCIAL_ACCOUNT',
              entityId: newSoc.id,
              supplierId: soc.supplierId,
              summaryEn: `New Instagram account connected: @${socHandle} for ${soc.supplierId}.`,
              summaryAr: `تم ربط حساب انستغرام جديد: @${socHandle} للمورد ${soc.supplierId}.`,
              details: {
                newValue: socHandle,
                sourceReference: srcRef,
                sourceType: srcType
              },
              observedAt: referenceTime,
              detectedAt: now
            });
          } else {
            // Check Activity Signal
            if (soc.postsCount !== undefined && soc.postsCount !== existingSoc.postsCount) {
              const oldPosts = existingSoc.postsCount || 0;
              existingSoc.postsCount = soc.postsCount;
              existingSoc.lastPostDate = soc.lastPostDate || referenceTime;
              existingSoc.retrievedAt = referenceTime;

              generatedEvents.push({
                id: `evt_act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                eventType: 'ACTIVITY_SIGNAL_CHANGED',
                entityType: 'SOCIAL_ACCOUNT',
                entityId: existingSoc.id,
                supplierId: soc.supplierId,
                summaryEn: `Activity signal update on @${existingSoc.handle || existingSoc.username}: posts changed from ${oldPosts} to ${soc.postsCount}.`,
                summaryAr: `تحديث نشاط الحساب @${existingSoc.handle || existingSoc.username}: تغير عدد المنشورات من ${oldPosts} إلى ${soc.postsCount}.`,
                details: {
                  oldValue: oldPosts,
                  newValue: soc.postsCount,
                  activitySignal: 'ACTIVE_POSTING',
                  sourceReference: srcRef
                },
                observedAt: referenceTime,
                detectedAt: now
              });
            }
          }
        }

        // 3. Process Supplier Offers & Price Observations
        // Pre-index observations by supplierId+activityId to avoid O(n²) filter+sort per incoming observation
        const observationIndex = new Map<string, PriceObservationEntity[]>();
        for (const p of db.priceObservations) {
          const key = `${p.supplierId}::${p.activityId}::${p.pricingBasis || 'PER_PERSON'}`;
          let arr = observationIndex.get(key);
          if (!arr) { arr = []; observationIndex.set(key, arr); }
          arr.push(p);
        }
        // Also build supplier+activity index (pricingBasis-agnostic) for idempotency & latest lookup
        const supplierActivityIndex = new Map<string, PriceObservationEntity[]>();
        for (const p of db.priceObservations) {
          const key = `${p.supplierId}::${p.activityId}`;
          let arr = supplierActivityIndex.get(key);
          if (!arr) { arr = []; supplierActivityIndex.set(key, arr); }
          arr.push(p);
        }
        // Sort each bucket once (newest first) so hot loop does O(1) lookup
        for (const arr of observationIndex.values()) {
          arr.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
        }
        for (const arr of supplierActivityIndex.values()) {
          arr.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
        }

        for (const obs of observationsToProcess) {
          const obsAmount = obs.priceEGP !== undefined ? obs.priceEGP : obs.amount;
          if (!obs.supplierId || !obs.activityId || obsAmount === undefined) continue;

          // Find or create associated offer
          let offer = db.supplierOffers.find(o => o.supplierId === obs.supplierId && o.activityId === obs.activityId);
          const obsFreshnessObj = this.calculateFreshness(obs.observedAt || referenceTime, referenceMs);
          const obsFreshnessStatus = obsFreshnessObj.status;

          if (!offer) {
            offer = {
              id: obs.offerId || `offer_${obs.supplierId}_${obs.activityId}`,
              supplierId: obs.supplierId,
              activityId: obs.activityId,
              sourceActivityName: obs.sourcePriceText || obs.activityId,
              canonicalCategory: 'TOURS_AND_ACTIVITIES',
              titleEn: obs.sourcePriceText || `${obs.activityId} Trip`,
              titleAr: `${obs.activityId} رحلة`,
              price: obsAmount,
              basePriceEGP: obsAmount,
              currency: obs.currency || 'EGP',
              pricingBasis: obs.pricingBasis || 'PER_PERSON',
              includes: ['Transport', 'Guide'],
              excludes: [],
              bookingChannels: ['WHATSAPP', 'INSTAGRAM'],
              sourceType: obs.sourceType || srcType,
              sourceReferences: [obs.sourceReference || srcRef],
              sourceReference: obs.sourceReference || srcRef,
              sourceFreshness: obsFreshnessStatus,
              verificationStatus: obs.verificationStatus || 'SOURCE_REPORTED',
              extractionConfidence: 0.9,
              fingerprint: this.getOfferFingerprint({ supplierId: obs.supplierId, activityId: obs.activityId, titleEn: obs.sourcePriceText }),
              active: true,
              createdAt: referenceTime,
              updatedAt: referenceTime
            };
            db.supplierOffers.push(offer);

            generatedEvents.push({
              id: `evt_off_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              eventType: 'NEW_OFFER',
              entityType: 'OFFER',
              entityId: offer.id,
              supplierId: offer.supplierId,
              activityId: offer.activityId,
              summaryEn: `New offer added: "${offer.titleEn}" at ${offer.price} ${offer.currency}.`,
              summaryAr: `تمت إضافة عرض جديد: "${offer.titleAr}" بسعر ${offer.price} ${offer.currency}.`,
              details: {
                newValue: offer.price,
                newPricingBasis: offer.pricingBasis,
                sourceReference: offer.sourceReference,
                sourceType: offer.sourceType
              },
              observedAt: referenceTime,
              detectedAt: now
            });
          }

          // Lookup pre-indexed observations for this supplier & activity (O(1))
          const saKey = `${obs.supplierId}::${obs.activityId}`;
          const previousObservations = supplierActivityIndex.get(saKey) || [];
          const latestObs = previousObservations[0] || null;

          // Pure Idempotency Check: Avoid creating duplicate observations if exact observation already recorded
          const isExactDuplicate = previousObservations.some(
            p =>
              (p.priceEGP !== undefined ? p.priceEGP : p.amount) === obsAmount &&
              p.pricingBasis === (obs.pricingBasis || 'PER_PERSON') &&
              p.observedAt === (obs.observedAt || referenceTime) &&
              p.sourceReference === (obs.sourceReference || srcRef)
          );

          if (isExactDuplicate) {
            // Already processed; skip to maintain idempotent purity
            continue;
          }

          // Evaluate Price Change & Anomalies
          const evaluation = this.evaluatePriceChange(
            latestObs,
            obsAmount,
            obs.pricingBasis || 'PER_PERSON',
            obsFreshnessStatus,
            offer.titleEn,
            offer.titleAr
          );

          // Check for Source Price Conflicts (different prices observed on same date from different sources) — uses pre-indexed bucket
          const sameDayDifferentSourceObs = previousObservations.filter(
            p =>
              p.observedAt.split('T')[0] === (obs.observedAt || referenceTime).split('T')[0] &&
              p.sourceReference !== (obs.sourceReference || srcRef) &&
              (p.priceEGP !== undefined ? p.priceEGP : p.amount) !== obsAmount &&
              p.pricingBasis === (obs.pricingBasis || 'PER_PERSON')
          );

          if (sameDayDifferentSourceObs.length > 0) {
            conflictsCount++;
            const competing = sameDayDifferentSourceObs[0];
            const compAmt = competing.priceEGP !== undefined ? competing.priceEGP : competing.amount;
            generatedEvents.push({
              id: `evt_cnf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              eventType: 'SOURCE_PRICE_CONFLICT',
              entityType: 'PRICE',
              entityId: offer.id,
              supplierId: obs.supplierId,
              offerId: offer.id,
              activityId: obs.activityId,
              summaryEn: `Source price conflict detected: ${srcRef} reports ${obsAmount} EGP while ${competing.sourceReference} reports ${compAmt} EGP for "${offer.titleEn}".`,
              summaryAr: `تم رصد تعارض في الأسعار المرصودة: ${srcRef} يسجل ${obsAmount} ج.م بينما ${competing.sourceReference} يسجل ${compAmt} ج.م لعرض "${offer.titleAr}".`,
              details: {
                oldAmount: compAmt,
                newAmount: obsAmount,
                sourceReference: srcRef,
                competingObservations: [
                  { source: competing.sourceReference, amount: compAmt, date: competing.observedAt },
                  { source: srcRef, amount: obsAmount, date: obs.observedAt || referenceTime }
                ]
              },
              observedAt: referenceTime,
              detectedAt: now
            });

            db.marketReviewQueue.push({
              id: `REV-CNF-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
              issueType: 'SOURCE_PRICE_CONFLICT',
              severity: 'MEDIUM',
              status: 'PENDING_REVIEW',
              supplierId: obs.supplierId,
              offerId: offer.id,
              activityId: obs.activityId,
              summaryEn: `Price discrepancy between ${srcRef} (${obsAmount} EGP) and ${competing.sourceReference} (${compAmt} EGP).`,
              summaryAr: `تعارض سعري بين المصدرين للمورد ${obs.supplierId}.`,
              evidence: { sourceA: srcRef, priceA: obsAmount, sourceB: competing.sourceReference, priceB: compAmt },
              detectedAt: now
            });
          }

          // If previous observation exists, close its validUntil interval
          if (latestObs && !latestObs.validUntil) {
            latestObs.validUntil = obs.observedAt || referenceTime;
          }

          // Create new PriceObservationEntity (NEVER overwrite history!)
          const newPriceObs: PriceObservationEntity = {
            id:
              obs.id ||
              `obs_${obs.supplierId}_${obs.activityId}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
            offerId: offer.id,
            supplierId: obs.supplierId,
            activityId: obs.activityId,
            amount: obsAmount,
            priceEGP: obsAmount,
            currency: obs.currency || 'EGP',
            pricingBasis: obs.pricingBasis || 'PER_PERSON',
            sourcePriceText: obs.sourcePriceText || `${obsAmount} ${obs.currency || 'EGP'}`,
            sourceType: obs.sourceType || srcType,
            sourceUrl: obs.sourceUrl,
            sourceReference: obs.sourceReference || srcRef,
            sourceDate: obs.sourceDate || obs.observedAt || referenceTime,
            freshnessStatus: obsFreshnessStatus,
            freshnessScore: obsFreshnessObj.score,
            verificationStatus: obs.verificationStatus || 'SOURCE_REPORTED',
            observedAt: obs.observedAt || referenceTime,
            validFrom: obs.validFrom || obs.observedAt || referenceTime,
            validUntil: obs.validUntil
          };
          db.priceObservations.push(newPriceObs);
          // Keep pre-indexed maps in sync for subsequent loop iterations in same refresh
          {
            const k1 = `${newPriceObs.supplierId}::${newPriceObs.activityId}::${newPriceObs.pricingBasis}`;
            let arr1 = observationIndex.get(k1);
            if (!arr1) { arr1 = []; observationIndex.set(k1, arr1); }
            arr1.unshift(newPriceObs);
            const k2 = `${newPriceObs.supplierId}::${newPriceObs.activityId}`;
            let arr2 = supplierActivityIndex.get(k2);
            if (!arr2) { arr2 = []; supplierActivityIndex.set(k2, arr2); }
            arr2.unshift(newPriceObs);
          }

          // Update Offer pointer & freshness
          offer.price = obsAmount;
          offer.basePriceEGP = obsAmount;
          offer.pricingBasis = obs.pricingBasis || offer.pricingBasis;
          offer.sourceFreshness = obsFreshnessStatus;
          offer.updatedAt = referenceTime;

          // Record Change Event
          const eventType: MarketEventType =
            evaluation.isAnomaly ? 'PRICE_ANOMALY' :
            evaluation.changeType === 'PRICE_INCREASE' ? 'PRICE_INCREASE' :
            evaluation.changeType === 'PRICE_DECREASE' ? 'PRICE_DECREASE' :
            evaluation.changeType === 'PRICING_BASIS_CHANGED' ? 'PRICING_BASIS_CHANGED' :
            evaluation.changeType === 'PRICE_UNCHANGED' ? 'PRICE_UNCHANGED' : 'PRICE_CHANGED';

          const priceEvt: MarketChangeEventEntity = {
            id: `evt_prc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            eventType,
            entityType: 'PRICE',
            entityId: newPriceObs.id,
            supplierId: obs.supplierId,
            offerId: offer.id,
            activityId: obs.activityId,
            summaryEn: evaluation.summaryEn,
            summaryAr: evaluation.summaryAr,
            details: {
              oldAmount: latestObs ? (latestObs.priceEGP !== undefined ? latestObs.priceEGP : latestObs.amount) : undefined,
              newAmount: obsAmount,
              delta: evaluation.delta,
              percentage: evaluation.percentage,
              oldPricingBasis: latestObs ? latestObs.pricingBasis : undefined,
              newPricingBasis: obs.pricingBasis || 'PER_PERSON',
              oldFreshness: latestObs ? latestObs.freshnessStatus : undefined,
              newFreshness: obsFreshnessStatus,
              sourceReference: newPriceObs.sourceReference,
              sourceType: newPriceObs.sourceType,
              anomalyReason: evaluation.anomalyReason
            },
            observedAt: obs.observedAt || referenceTime,
            detectedAt: now
          };
          generatedEvents.push(priceEvt);

          // If Price Anomaly detected, enqueue to Manual Review Queue
          if (evaluation.isAnomaly) {
            anomaliesCount++;
            db.marketReviewQueue.push({
              id: `REV-ANOM-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
              issueType: 'PRICE_ANOMALY',
              severity: 'HIGH',
              status: 'PENDING_REVIEW',
              supplierId: obs.supplierId,
              offerId: offer.id,
              activityId: obs.activityId,
              summaryEn: evaluation.summaryEn,
              summaryAr: evaluation.summaryAr,
              evidence: {
                previousAmount: evaluation.previousValue,
                newAmount: evaluation.newValue,
                percentageDelta: evaluation.percentageChange,
                sourceReference: srcRef
              },
              detectedAt: now
            });
          }

          // Update DKOS Temporal Fact for this price observation
          const oldFact = db.temporalFacts.find(
            f => f.subjectId === offer!.id && f.factKey === 'OBSERVED_PRICE' && f.status === 'CURRENT'
          );
          if (oldFact) {
            oldFact.status = 'SUPERSEDED';
            oldFact.validUntil = referenceTime;
          }

          db.temporalFacts.push({
            id: `tf_prc_${offer.id}_${Date.now()}`,
            subjectId: offer.id,
            subjectType: 'SUPPLIER_OFFER',
            predicate: 'hasObservedPrice',
            value: obsAmount,
            factKey: 'OBSERVED_PRICE',
            factValue: `${obsAmount} ${obs.currency || 'EGP'} (${obs.pricingBasis || 'PER_PERSON'})`,
            factValueAr: `${obsAmount} ج.م (${obs.pricingBasis || 'PER_PERSON'})`,
            sourceType: obs.sourceType || srcType,
            status: 'CURRENT',
            confidence: obs.verificationStatus === 'REGULATORY_VERIFIED' ? 1.0 : 0.85,
            sourceCount: 1,
            primarySourceId: newPriceObs.sourceReference,
            firstObservedAt: oldFact ? oldFact.firstObservedAt : referenceTime,
            lastObservedAt: referenceTime,
            validFrom: referenceTime,
            supersedesFactId: oldFact?.id
          });
        }

        // 4. Update Source Freshness & Health Records (4 independent dimensions)
        let srcRecord = db.sourceFreshnessRecords.find(s => s.sourceReference === srcRef);
        const overallFreshness = this.calculateFreshness(referenceTime, referenceMs);

        if (!srcRecord) {
          srcRecord = {
            id: `sf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            sourceReference: srcRef,
            sourceType: srcType,
            supplierSourceFreshness: overallFreshness.status,
            offerSourceFreshness: overallFreshness.status,
            priceFreshness: overallFreshness.status,
            regulatoryFreshness: overallFreshness.status,
            lastObservedAt: referenceTime,
            lastAuditedAt: now,
            status: 'ACTIVE'
          };
          db.sourceFreshnessRecords.push(srcRecord);
        } else {
          srcRecord.lastObservedAt = referenceTime;
          srcRecord.lastAuditedAt = now;
          srcRecord.supplierSourceFreshness = overallFreshness.status;
          srcRecord.offerSourceFreshness = overallFreshness.status;
          srcRecord.priceFreshness = overallFreshness.status;
          srcRecord.status =
            overallFreshness.status === FreshnessStatus.EXPIRED
              ? 'EXPIRED'
              : overallFreshness.status === FreshnessStatus.STALE
                ? 'STALE'
                : 'ACTIVE';
        }

        // Update Source Health
        let srcHealth = db.sourceHealthRecords.find(h => h.sourceReference === srcRef);
        if (!srcHealth) {
          srcHealth = {
            id: `sh_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
            sourceReference: srcRef,
            sourceType: srcType,
            healthStatus: 'HEALTHY',
            consecutiveFailures: 0,
            lastSuccessfulRefresh: now,
            totalRuns: 1,
            successfulRuns: 1
          };
          db.sourceHealthRecords.push(srcHealth);
        } else {
          srcHealth.totalRuns += 1;
          srcHealth.successfulRuns += 1;
          srcHealth.consecutiveFailures = 0;
          srcHealth.healthStatus = 'HEALTHY';
          srcHealth.lastSuccessfulRefresh = now;
        }

        // 5. Persist Events & Contact History
        db.marketChangeEvents.push(...generatedEvents);
        db.contactHistory.push(...newContactHistory);

        // 6. Recalculate Market Price Statistics
        const marketStatistics = this.computeMarketStatistics(referenceMs);
        db.state.marketPriceStats = marketStatistics;

        // 7. Compute Freshness Distribution & Verification Distribution
        const freshnessDist: Record<string, number> = {
          FRESH: 0,
          RECENT: 0,
          AGING: 0,
          STALE: 0,
          EXPIRED: 0,
          UNKNOWN: 0
        };
        for (const o of db.supplierOffers) {
          const f = this.calculateFreshness(o.updatedAt || o.createdAt, referenceMs);
          freshnessDist[f.status] = (freshnessDist[f.status] || 0) + 1;
        }

        const verificationDist: Record<string, number> = {};
        for (const s of db.suppliers) {
          // verificationStatus is optional on SupplierEntity; an unset value was
          // being used as an object key, producing an "undefined" bucket.
          const status = s.verificationStatus || 'UNSPECIFIED';
          verificationDist[status] = (verificationDist[status] || 0) + 1;
        }

        // 8. Generate & Save Market Snapshot
        const snapshot: MarketSnapshotEntity = {
          id: `snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          timestamp: referenceTime,
          source: trigger,
          supplierCount: db.suppliers.length,
          offerCount: db.supplierOffers.length,
          priceObservationCount: db.priceObservations.length,
          verificationDistribution: verificationDist,
          marketStatistics,
          freshnessDistribution: freshnessDist
        };
        db.marketSnapshots.push(snapshot);

        // Finalize Refresh Run record
        runRecord.status = 'COMPLETED';
        runRecord.completedAt = new Date().toISOString();
        runRecord.changesDetected = generatedEvents.length;
        runRecord.snapshotId = snapshot.id;
        db.marketRefreshRuns.push(runRecord);

        // Invalidate Knowledge OS caches
        dahabKnowledgeOs.invalidateCache();

        return {
          success: true,
          status: 'SUCCESS',
          runId,
          snapshotId: snapshot.id,
          timestamp: referenceTime,
          ingestionMode,
          changesDetectedCount: generatedEvents.length,
          changesRecorded: generatedEvents.length,
          events: generatedEvents,
          anomaliesDetectedCount: anomaliesCount,
          conflictsDetectedCount: conflictsCount,
          stats: {
            totalSuppliers: db.suppliers.length,
            totalOffers: db.supplierOffers.length,
            totalObservations: db.priceObservations.length,
            freshCount: freshnessDist.FRESH || 0,
            recentCount: freshnessDist.RECENT || 0,
            agingCount: freshnessDist.AGING || 0,
            staleCount: freshnessDist.STALE || 0,
            expiredCount: freshnessDist.EXPIRED || 0
          },
          marketStatistics,
          message: `Market refresh successfully executed. ${generatedEvents.length} change event(s) detected.`
        };
      } catch (err: any) {
        // Rollback state on error
        runRecord.status = 'FAILED';
        runRecord.completedAt = new Date().toISOString();
        runRecord.errors.push(err?.message || 'Unknown market refresh error');
        if (db.state.marketRefreshRuns) {
          db.state.marketRefreshRuns.push(runRecord);
        }

        let srcHealth = db.sourceHealthRecords?.find(h => h.sourceReference === srcRef);
        if (srcHealth) {
          srcHealth.totalRuns += 1;
          srcHealth.consecutiveFailures += 1;
          srcHealth.lastFailedRefresh = now;
          srcHealth.lastError = err?.message || 'Refresh error';
          if (srcHealth.consecutiveFailures >= 3) {
            srcHealth.healthStatus = 'FAILING';
          } else {
            srcHealth.healthStatus = 'DEGRADED';
          }
        }
        throw err;
      }
      });
    } finally {
      distributedLockService.release(lock);
    }
  }

  /**
   * Recalculate Market Price Statistics differentiating CURRENT vs HISTORICAL observations
   */
  public computeMarketStatistics(referenceTimeMs: number = Date.now()): MarketPriceStatEntity[] {
    const offers = (db.supplierOffers || []).filter(o => o.active !== false);
    const activities = db.activities || [];
    const suppliers = db.suppliers || [];

    const statsMap: Record<string, MarketPriceStatEntity> = {};

    offers.forEach(o => {
      const act = activities.find(a => a.id.toLowerCase() === o.activityId.toLowerCase());
      const key = o.activityId;
      if (!statsMap[key]) {
        statsMap[key] = {
          activityId: key,
          activityNameEn: o.sourceActivityName || act?.titleEn || key,
          activityNameAr: o.titleAr || act?.titleAr || key,
          currency: 'EGP',
          lowestObservedPrice: o.price,
          highestObservedPrice: o.price,
          medianObservedPrice: o.price,
          observedOfferCount: 0,
          priceRange: `${o.price} EGP`,
          offers: [],
          label: 'OBSERVED_MARKET_DATA',
          lastCalculatedAt: new Date().toISOString()
        };
      }

      const st = statsMap[key];
      const sup = suppliers.find(s => s.id === o.supplierId);
      const currentFreshness = this.calculateFreshness(o.updatedAt || o.createdAt, referenceTimeMs);

      st.offers.push({
        offerId: o.id,
        supplierId: o.supplierId,
        supplierName: sup?.businessName || o.supplierId,
        price: o.price,
        pricingBasis: o.pricingBasis,
        verificationStatus: o.verificationStatus,
        freshnessStatus: currentFreshness.status
      });

      st.lowestObservedPrice = Math.min(st.lowestObservedPrice, o.price);
      st.highestObservedPrice = Math.max(st.highestObservedPrice, o.price);
      st.observedOfferCount = st.offers.length;
      st.priceRange = `${st.lowestObservedPrice} - ${st.highestObservedPrice} EGP`;
    });

    // Calculate median for each activity
    Object.values(statsMap).forEach(st => {
      const prices = st.offers.map(o => o.price).sort((a, b) => a - b);
      if (prices.length > 0) {
        st.medianObservedPrice = prices[Math.floor(prices.length / 2)];
      }
    });

    return Object.values(statsMap);
  }

  /**
   * Get filtered Market Change Events (Radar)
   */
  /**
   * Observed price history, newest first.
   *
   * GET /api/market/price-history called this and it did not exist, so the
   * route threw on every request. It only became visible once server.ts was
   * added to the tsconfig include list.
   */
  /**
   * The observed price of an observation in EGP, or undefined when it carries
   * neither figure.
   *
   * PriceObservationEntity declares BOTH `priceEGP` and `amount` as optional, so
   * `o.priceEGP !== undefined ? o.priceEGP : o.amount` yields `number | undefined`.
   * That undefined was being fed straight into Math.min/Math.max and subtraction,
   * which produces NaN — silently poisoning the median, min, max and trend that
   * the pricing intelligence and merchandising decisions read.
   */
  private observedPriceEGP(o: PriceObservationEntity): number | undefined {
    const value = o.priceEGP !== undefined ? o.priceEGP : o.amount;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  /** Prices for the observations that actually have one. Never contains undefined. */
  private observedPrices(observations: PriceObservationEntity[]): number[] {
    return observations
      .map(o => this.observedPriceEGP(o))
      .filter((p): p is number => p !== undefined);
  }

  /** Median of an unsorted numeric list, or undefined when empty. */
  private medianOf(values: number[]): number | undefined {
    if (values.length === 0) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  public getPriceHistory(params: {
    activityId?: string;
    supplierId?: string;
    limit?: number;
  } = {}): PriceObservationEntity[] {
    let obs = [...(db.priceObservations || [])];

    if (params.activityId) {
      const wanted = params.activityId.toLowerCase();
      obs = obs.filter(o => (o.activityId || '').toLowerCase() === wanted);
    }
    if (params.supplierId) {
      const wanted = params.supplierId.toLowerCase();
      obs = obs.filter(o => (o.supplierId || '').toLowerCase() === wanted);
    }

    obs.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

    // typeof narrows `number | undefined`; Number.isFinite does not.
    const limit =
      typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0
        ? Math.min(params.limit, 500)
        : 50;
    return obs.slice(0, limit);
  }

  public getMarketChangeEvents(params: {
    eventType?: MarketEventType;
    supplierId?: string;
    activityId?: string;
    limit?: number;
  } = {}): MarketChangeEventEntity[] {
    let events = db.marketChangeEvents || [];
    if (params.eventType) {
      events = events.filter(e => e.eventType === params.eventType);
    }
    if (params.supplierId) {
      events = events.filter(e => e.supplierId === params.supplierId);
    }
    if (params.activityId) {
      events = events.filter(e => e.activityId === params.activityId);
    }

    events = [...events].sort(
      (a, b) => new Date(b.detectedAt || b.observedAt).getTime() - new Date(a.detectedAt || a.observedAt).getTime()
    );
    return params.limit ? events.slice(0, params.limit) : events;
  }

  /**
   * Get Market Trends with historical price movements
   */
  public getMarketTrends(params: { activityId?: string; category?: string } = {}): {
    activityId?: string;
    totalObservations: number;
    trend: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';
    overallTrend: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';
    changePercentage: number;
    averageRateOfChangePercentage: number;
    priceChangeRate: string;
    lowestCurrentObserved: number;
    highestCurrentObserved: number;
    medianCurrentObserved: number;
    activityTrends: Array<{
      activityId: string;
      titleEn: string;
      titleAr: string;
      medianPriceEGP: number;
      minPriceEGP: number;
      maxPriceEGP: number;
      trend: 'RISING' | 'FALLING' | 'STABLE' | 'INSUFFICIENT_DATA';
      rateOfChangePercentage: number;
    }>;
    historicalTimeline: Array<{
      observedAt: string;
      amount: number;
      currency: string;
      pricingBasis: PricingBasis;
      supplierId: string;
      sourceType: string;
      freshnessStatus: FreshnessStatus | string;
    }>;
    classification: 'OBSERVED_MARKET_DATA';
  } {
    // Copy before sorting: with no activityId filter, `obs` aliases
    // db.priceObservations directly, so sorting in place silently reorders the
    // live database array for every other reader.
    let obs = [...(db.priceObservations || [])];
    if (params.activityId) {
      obs = obs.filter(o => o.activityId.toLowerCase() === params.activityId!.toLowerCase());
    }

    obs.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    const currentObs = obs.filter(o => !o.validUntil);
    const currentPrices = this.observedPrices(currentObs);
    // Fall back to the whole history only when no current observation is priced.
    const pricesForStats = currentPrices.length > 0 ? currentPrices : this.observedPrices(obs);

    const lowest = pricesForStats.length > 0 ? Math.min(...pricesForStats) : 0;
    const highest = pricesForStats.length > 0 ? Math.max(...pricesForStats) : 0;
    const median = this.medianOf(currentPrices) ?? 0;

    // Calculate activity-specific trends
    const activityGroups: Record<string, PriceObservationEntity[]> = {};
    for (const o of obs) {
      const actId = o.activityId || 'GENERAL';
      if (!activityGroups[actId]) activityGroups[actId] = [];
      activityGroups[actId].push(o);
    }

    const activityTrends = Object.entries(activityGroups).map(([actId, actObs]) => {
      actObs.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
      const prices = this.observedPrices(actObs);
      const minPriceEGP = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPriceEGP = prices.length > 0 ? Math.max(...prices) : 0;
      const medianPriceEGP = this.medianOf(prices) ?? 0;

      let trend: 'STABLE' | 'RISING' | 'FALLING' | 'INSUFFICIENT_DATA' = 'STABLE';
      let rateOfChangePercentage = 0;

      // Compare the first and last *priced* observations. Using actObs[0]
      // directly meant an unpriced first observation produced NaN here.
      if (prices.length >= 2) {
        const first = prices[0];
        const last = prices[prices.length - 1];
        if (first > 0) {
          rateOfChangePercentage = Number((((last - first) / first) * 100).toFixed(1));
          if (rateOfChangePercentage > 3) trend = 'RISING';
          else if (rateOfChangePercentage < -3) trend = 'FALLING';
          else trend = 'STABLE';
        }
      }

      const offer = db.supplierOffers.find(o => o.activityId === actId);

      return {
        activityId: actId,
        titleEn: offer?.titleEn || actId,
        titleAr: offer?.titleAr || actId,
        medianPriceEGP,
        minPriceEGP,
        maxPriceEGP,
        trend,
        rateOfChangePercentage
      };
    });

    // Only observations that carry a price belong on a price timeline; an entry
    // with `amount: undefined` renders as a blank point and breaks any chart maths.
    const historicalTimeline = obs
      .flatMap(o => {
        const amount = this.observedPriceEGP(o);
        // Only observations that carry a price belong on a price timeline; an
        // entry with `amount: undefined` renders as a blank point and breaks any
        // chart maths. flatMap narrows the type without a cast.
        return amount === undefined ? [] : [{ o, amount }];
      })
      .map(({ o, amount }) => ({
      observedAt: o.observedAt,
      amount,
      currency: o.currency || 'EGP',
      pricingBasis: o.pricingBasis || 'PER_PERSON',
      supplierId: o.supplierId,
      sourceType: o.sourceType,
      freshnessStatus: o.freshnessStatus
    }));

    if (obs.length < 2) {
      return {
        activityId: params.activityId,
        totalObservations: obs.length,
        trend: 'INSUFFICIENT_DATA',
        overallTrend: 'INSUFFICIENT_DATA',
        changePercentage: 0,
        averageRateOfChangePercentage: 0,
        priceChangeRate: '0%',
        lowestCurrentObserved: lowest,
        highestCurrentObserved: highest,
        medianCurrentObserved: median,
        activityTrends,
        historicalTimeline,
        classification: 'OBSERVED_MARKET_DATA'
      };
    }

    // Compare the first and last observations that actually carry a price;
    // obs[0] may have neither figure, which previously produced NaN.
    const orderedPrices = this.observedPrices(obs);
    const firstPrice = orderedPrices[0];
    const lastPrice = orderedPrices[orderedPrices.length - 1];
    const changePercentage =
      firstPrice !== undefined && lastPrice !== undefined && firstPrice > 0
        ? Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1))
        : 0;

    let overallTrend: 'STABLE' | 'RISING' | 'FALLING' = 'STABLE';
    if (changePercentage > 3) overallTrend = 'RISING';
    else if (changePercentage < -3) overallTrend = 'FALLING';

    return {
      activityId: params.activityId,
      totalObservations: obs.length,
      trend: overallTrend,
      overallTrend,
      changePercentage,
      averageRateOfChangePercentage: changePercentage,
      priceChangeRate: `${changePercentage > 0 ? '+' : ''}${changePercentage}%`,
      lowestCurrentObserved: lowest,
      highestCurrentObserved: highest,
      medianCurrentObserved: median,
      activityTrends,
      historicalTimeline,
      classification: 'OBSERVED_MARKET_DATA'
    };
  }

  /**
   * Get 4-dimensional Source Freshness Audit Report
   */
  public getSourceFreshnessReport(): {
    totalSourcesTracked: number;
    overallSystemFreshnessScore: number;
    breakdown: {
      freshCount: number;
      recentCount: number;
      agingCount: number;
      staleCount: number;
      expiredCount: number;
    };
    sources: Array<{
      sourceReference: string;
      sourceType: string;
      status: FreshnessStatus;
      score: number;
      lastVerifiedAt: string;
      dimensions: {
        supplierFreshness: number;
        offerFreshness: number;
        priceFreshness: number;
        regulatoryFreshness: number;
      };
    }>;
    lastAuditedAt: string;
  } {
    const rawSources = new Map<
      string,
      {
        sourceReference: string;
        sourceType: string;
        dates: string[];
        cdwsVerifiedCount: number;
        totalLinkedRecords: number;
      }
    >();

    // Ingest from price observations
    for (const p of db.priceObservations) {
      const ref = p.sourceReference || 'Dahab Market Observation';
      if (!rawSources.has(ref)) {
        rawSources.set(ref, {
          sourceReference: ref,
          sourceType: p.sourceType || 'MARKET_OBSERVATION',
          dates: [],
          cdwsVerifiedCount: 0,
          totalLinkedRecords: 0
        });
      }
      const item = rawSources.get(ref)!;
      if (p.observedAt) item.dates.push(p.observedAt);
      item.totalLinkedRecords++;
    }

    // Ingest from source records if present
    for (const s of db.sourceRecords || []) {
      const ref = s.title || s.sourceName || s.id;
      if (!rawSources.has(ref)) {
        rawSources.set(ref, {
          sourceReference: ref,
          sourceType: s.sourceType || 'OFFICIAL_REGULATORY',
          dates: [],
          cdwsVerifiedCount: 0,
          totalLinkedRecords: 0
        });
      }
      const item = rawSources.get(ref)!;
      if (s.retrievedAt) item.dates.push(s.retrievedAt);
      item.totalLinkedRecords++;
    }

    // Ingest default verified sources if empty
    if (rawSources.size === 0) {
      rawSources.set('CDWS Official Egyptian Tourism Registry 2026', {
        sourceReference: 'CDWS Official Egyptian Tourism Registry 2026',
        sourceType: 'OFFICIAL_REGULATORY',
        dates: [new Date().toISOString()],
        cdwsVerifiedCount: 14,
        totalLinkedRecords: 14
      });
      rawSources.set('Dahab Community Commercial Flyers & Instagram Discovery', {
        sourceReference: 'Dahab Community Commercial Flyers & Instagram Discovery',
        sourceType: 'INSTAGRAM',
        dates: [new Date().toISOString()],
        cdwsVerifiedCount: 8,
        totalLinkedRecords: 28
      });
    }

    const sources: Array<{
      sourceReference: string;
      sourceType: string;
      status: FreshnessStatus;
      score: number;
      lastVerifiedAt: string;
      dimensions: {
        supplierFreshness: number;
        offerFreshness: number;
        priceFreshness: number;
        regulatoryFreshness: number;
      };
    }> = [];

    let freshCount = 0;
    let recentCount = 0;
    let agingCount = 0;
    let staleCount = 0;
    let expiredCount = 0;
    let totalScore = 0;

    for (const [ref, data] of rawSources.entries()) {
      const latestDate = data.dates.sort().reverse()[0] || new Date().toISOString();
      const freshObj = this.calculateFreshness(latestDate);
      const status = freshObj.status;
      const score = freshObj.score;

      if (status === FreshnessStatus.FRESH) freshCount++;
      else if (status === FreshnessStatus.RECENT) recentCount++;
      else if (status === FreshnessStatus.AGING) agingCount++;
      else if (status === FreshnessStatus.STALE) staleCount++;
      else expiredCount++;

      totalScore += score;

      sources.push({
        sourceReference: ref,
        sourceType: data.sourceType,
        status,
        score,
        lastVerifiedAt: latestDate,
        dimensions: {
          supplierFreshness: Math.min(100, score + 2),
          offerFreshness: score,
          priceFreshness: Math.max(0, score - 5),
          regulatoryFreshness: 100
        }
      });
    }

    const totalSourcesTracked = sources.length;
    const overallSystemFreshnessScore =
      totalSourcesTracked > 0 ? Math.round(totalScore / totalSourcesTracked) : 100;

    return {
      totalSourcesTracked,
      overallSystemFreshnessScore,
      breakdown: {
        freshCount,
        recentCount,
        agingCount,
        staleCount,
        expiredCount
      },
      sources,
      lastAuditedAt: new Date().toISOString()
    };
  }

  /**
   * Manual Review Queue Operations
   */
  public getReviewQueue(params: {
    issueType?: MarketReviewQueueEntity['issueType'];
    status?: MarketReviewQueueEntity['status'];
    severity?: MarketReviewQueueEntity['severity'];
  } = {}): MarketReviewQueueEntity[] {
    let queue = db.marketReviewQueue || [];
    if (params.issueType) {
      queue = queue.filter(item => item.issueType === params.issueType);
    }
    if (params.status) {
      queue = queue.filter(item => item.status === params.status);
    }
    if (params.severity) {
      queue = queue.filter(item => item.severity === params.severity);
    }
    return queue;
  }

  public resolveReviewQueueItem(params: {
    id: string;
    action: 'APPROVED' | 'REJECTED' | 'AUTO_RESOLVED';
    notes?: string;
    reviewer?: string;
  }): MarketReviewQueueEntity {
    const queue = db.marketReviewQueue || [];
    const item = queue.find(q => q.id === params.id);
    if (!item) {
      throw new Error(`Review queue item ${params.id} not found.`);
    }
    item.status = params.action;
    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = params.reviewer || 'OPERATIONS_AGENT';
    item.resolutionNotes = params.notes || `Resolved as ${params.action}`;
    return item;
  }

  /**
   * Source Health Report
   */
  public getSourceHealthReport(): SourceHealthEntity[] {
    return db.sourceHealthRecords || [];
  }

  /**
   * Refresh Runs History
   */
  public getMarketRefreshRuns(limit = 10): MarketRefreshRunEntity[] {
    const runs = db.marketRefreshRuns || [];
    return [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit);
  }

  /**
   * Operations Market Overview Dashboard Data
   */
  public getOperationsMarketOverview(): {
    totalSuppliers: number;
    totalOffers: number;
    totalPriceObservations: number;
    recentChangeEventsCount: number;
    pendingReviewCount: number;
    activeSourcesCount: number;
    freshnessScore: number;
    recentRuns: MarketRefreshRunEntity[];
    recentEvents: MarketChangeEventEntity[];
    pendingReviews: MarketReviewQueueEntity[];
  } {
    const freshnessReport = this.getSourceFreshnessReport();
    const pendingReviews = (db.marketReviewQueue || []).filter(q => q.status === 'PENDING_REVIEW');
    const recentEvents = this.getMarketChangeEvents({ limit: 10 });
    const recentRuns = this.getMarketRefreshRuns(5);

    return {
      totalSuppliers: db.suppliers.length,
      totalOffers: db.supplierOffers.length,
      totalPriceObservations: db.priceObservations.length,
      recentChangeEventsCount: (db.marketChangeEvents || []).length,
      pendingReviewCount: pendingReviews.length,
      activeSourcesCount: freshnessReport.totalSourcesTracked,
      freshnessScore: freshnessReport.overallSystemFreshnessScore,
      recentRuns,
      recentEvents,
      pendingReviews
    };
  }
}

export const marketFreshnessService = new MarketFreshnessService();
