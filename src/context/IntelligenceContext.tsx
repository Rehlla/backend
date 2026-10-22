import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  AuthoritativeSupplier,
  PricingDecisionAction,
  ContentProductBridge,
  DiscoveredSupplierCandidate,
  ProductOpportunity,
  OpportunityStatus,
  OpportunityDecision,
  OpportunityHypothesis,
  FeatureRegisterItem
} from '../types/intelligence';
import {
  initialAuthoritativeSuppliers,
  initialPricingDecisions,
  initialContentBridges,
  initialFeatureRegister,
  initialOpportunities
} from '../data/intelligenceData';
import { useUI } from './UIContext';

export interface IntelligenceContextType {
  authoritativeSuppliers: AuthoritativeSupplier[];
  setAuthoritativeSuppliers: React.Dispatch<React.SetStateAction<AuthoritativeSupplier[]>>;
  activeSupplierId: string;
  setActiveSupplierId: (id: string) => void;
  pricingDecisions: PricingDecisionAction[];
  setPricingDecisions: React.Dispatch<React.SetStateAction<PricingDecisionAction[]>>;
  contentBridges: ContentProductBridge[];
  setContentBridges: React.Dispatch<React.SetStateAction<ContentProductBridge[]>>;
  opportunities: ProductOpportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<ProductOpportunity[]>>;
  featureRegister: FeatureRegisterItem[];
  setFeatureRegister: React.Dispatch<React.SetStateAction<FeatureRegisterItem[]>>;

  // Action Handlers
  promoteCandidateToSupplierOS: (
    candidate: DiscoveredSupplierCandidate,
    reviewerRole: string,
    reviewerEmail: string,
    notes?: string
  ) => AuthoritativeSupplier;
  approvePricingDecision: (decisionId: string, reviewer: string) => void;
  adoptContentBridge: (bridgeId: string, adopter: string) => void;
  decideOpportunity: (
    oppId: string,
    decision: OpportunityDecision['decision'],
    role: OpportunityDecision['decidedByRole'],
    email: string,
    rationale: string,
    linkedSystem?: OpportunityDecision['linkedSystem'],
    linkedFeatureId?: string
  ) => void;
  updateOpportunityHypothesis: (oppId: string, hypothesis: Partial<OpportunityHypothesis>) => void;
  recordOpportunityOutcome: (
    oppId: string,
    outcomeStatus: 'Validated' | 'Failed' | 'Inconclusive',
    primaryVal: string,
    secondaryVal: string,
    notes: string,
    recordedBy: string
  ) => void;
  addOpportunity: (opp: ProductOpportunity) => void;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export const IntelligenceProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [authoritativeSuppliers, setAuthoritativeSuppliers] = useState<AuthoritativeSupplier[]>(initialAuthoritativeSuppliers);
  const [activeSupplierId, setActiveSupplierId] = useState<string>(initialAuthoritativeSuppliers[0]?.id || 'SUP-001');
  const [pricingDecisions, setPricingDecisions] = useState<PricingDecisionAction[]>(initialPricingDecisions);
  const [contentBridges, setContentBridges] = useState<ContentProductBridge[]>(initialContentBridges);
  const [opportunities, setOpportunities] = useState<ProductOpportunity[]>(initialOpportunities);
  const [featureRegister, setFeatureRegister] = useState<FeatureRegisterItem[]>(initialFeatureRegister);

  const { showToast } = useUI();

  const promoteCandidateToSupplierOS = useCallback(
    (
      candidate: DiscoveredSupplierCandidate,
      reviewerRole: string,
      reviewerEmail: string,
      notes?: string
    ): AuthoritativeSupplier => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const newSupplierId = `SUP-${candidate.category.includes('Diving') ? 'DIVE' : candidate.category.includes('Transfer') ? 'SHUTTLE' : 'PARTNER'}-${Date.now().toString().slice(-4)}`;

      const newSupplier: AuthoritativeSupplier = {
        id: newSupplierId,
        businessName: candidate.businessName,
        businessNameAr: candidate.businessNameAr,
        category: candidate.category,
        area: candidate.area,
        leadContact: candidate.leadContact,
        licenseNumber: candidate.licenseStatusDetected === 'CDWS Registered' ? 'CDWS-VERIFIED-#4912' : 'MOT-SINAI-APPROVED-#8839',
        tier: candidate.suggestedTier,
        status: 'Active',
        rating: candidate.estimatedRating || 4.9,
        reviewCount: candidate.reviewsObservedCount || 48,
        onboardedAt: timestamp.substring(0, 10),
        approvedBy: `${reviewerRole} (${reviewerEmail})`,
        provenanceSignature: 'a78f921e44bc910248e9102384a9c18d948271048bcae9124801948291048fbc',
        linkedCandidateId: candidate.id,
        activeRequestsCount: 0,
        capacitySummary: `${candidate.offeringsCount} Active Offerings Initialized`,
        initialSlots: [
          { time: '09:00 AM', title: `${candidate.businessName} - Slot A`, booked: 0, total: 8, notes: 'Direct Supplier OS Managed' },
          { time: '14:30 PM', title: `${candidate.businessName} - Slot B`, booked: 0, total: 8, notes: 'Direct Supplier OS Managed' }
        ],
        roster: [
          { name: candidate.leadContact.split('(')[0].trim() || 'Lead Instructor', role: 'Partner Lead & Safety Officer', status: 'Active & Verified', license: 'Sinai Certified #2026' }
        ],
        auditLog: [
          ...candidate.stageHistory.map(h => ({
            timestamp: h.timestamp,
            actor: `${h.actorRole} (${h.actorEmail})`,
            action: `STAGE_${h.stage.toUpperCase()}`,
            notes: h.notes
          })),
          {
            timestamp,
            actor: `${reviewerRole} (${reviewerEmail})`,
            action: 'AUTHORITATIVE_ONBOARDING_APPROVED',
            notes: notes || `Supplier candidate ${candidate.id} (${candidate.businessName}) approved by ${reviewerRole}. Production credentials issued and live in Supplier OS.`
          }
        ]
      };

      setAuthoritativeSuppliers(prev => [newSupplier, ...prev]);
      setActiveSupplierId(newSupplierId);
      showToast(`Promoted "${candidate.businessName}" to Supplier OS as ${newSupplierId}`);

      return newSupplier;
    },
    [showToast]
  );

  const approvePricingDecision = useCallback(
    (decisionId: string, reviewer: string) => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setPricingDecisions(prev =>
        prev.map(p => {
          if (p.id === decisionId) {
            return {
              ...p,
              status: 'APPROVED',
              authorizedBy: reviewer,
              authorizedAt: timestamp
            };
          }
          return p;
        })
      );
      showToast('Pricing recommendation authorized by Ops ✓');
    },
    [showToast]
  );

  const adoptContentBridge = useCallback(
    (bridgeId: string, adopter: string) => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setContentBridges(prev =>
        prev.map(b => {
          if (b.id === bridgeId) {
            return {
              ...b,
              status: 'ADOPTED',
              adoptedBy: adopter,
              adoptedAt: timestamp
            };
          }
          return b;
        })
      );
      showToast('Content-to-product recommendation adopted into companion surfaces ✓');
    },
    [showToast]
  );

  const decideOpportunity = useCallback(
    (
      oppId: string,
      decision: OpportunityDecision['decision'],
      role: OpportunityDecision['decidedByRole'],
      email: string,
      rationale: string,
      linkedSystem?: OpportunityDecision['linkedSystem'],
      linkedFeatureId?: string
    ) => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const newStatus: OpportunityStatus =
        decision === 'Accepted'
          ? 'Accepted'
          : decision === 'Rejected'
          ? 'Rejected'
          : decision === 'Deferred'
          ? 'Deferred'
          : 'Qualified';

      setOpportunities(prev =>
        prev.map(o => {
          if (o.id === oppId) {
            return {
              ...o,
              status: newStatus,
              decision: {
                decision,
                decidedByRole: role,
                decidedByEmail: email,
                decidedAt: timestamp,
                rationale,
                linkedSystem,
                linkedFeatureId
              },
              statusHistory: [
                ...o.statusHistory,
                {
                  status: newStatus,
                  timestamp,
                  actor: `${role} (${email})`,
                  notes: `Decision: ${decision}. Rationale: ${rationale}${linkedFeatureId ? ` [Linked to ${linkedFeatureId}]` : ''}`
                }
              ]
            };
          }
          return o;
        })
      );

      showToast(`Opportunity ${oppId} marked as ${decision} ✓`);
    },
    [showToast]
  );

  const updateOpportunityHypothesis = useCallback(
    (oppId: string, hypothesisUpdates: Partial<OpportunityHypothesis>) => {
      setOpportunities(prev =>
        prev.map(o => {
          if (o.id === oppId && o.hypothesis) {
            return {
              ...o,
              hypothesis: {
                ...o.hypothesis,
                ...hypothesisUpdates
              }
            };
          }
          return o;
        })
      );
      showToast('Hypothesis parameters updated ✓');
    },
    [showToast]
  );

  const recordOpportunityOutcome = useCallback(
    (
      oppId: string,
      outcomeStatus: 'Validated' | 'Failed' | 'Inconclusive',
      primaryVal: string,
      secondaryVal: string,
      notes: string,
      recordedBy: string
    ) => {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setOpportunities(prev =>
        prev.map(o => {
          if (o.id === oppId) {
            const updatedHypothesis: OpportunityHypothesis = o.hypothesis
              ? {
                  ...o.hypothesis,
                  outcomeStatus,
                  measuredPrimaryValue: primaryVal,
                  measuredSecondaryValue: secondaryVal,
                  outcomeNotes: notes,
                  outcomeRecordedAt: timestamp,
                  outcomeRecordedBy: recordedBy
                }
              : {
                  targetUser: 'Target cohort',
                  intervention: 'Intervention',
                  primaryMetric: 'Primary metric',
                  secondaryMetric: 'Secondary metric',
                  baselineValue: 'N/A',
                  targetValue: 'N/A',
                  evaluationWindowDays: 14,
                  successCriteria: 'N/A',
                  outcomeStatus,
                  measuredPrimaryValue: primaryVal,
                  measuredSecondaryValue: secondaryVal,
                  outcomeNotes: notes,
                  outcomeRecordedAt: timestamp,
                  outcomeRecordedBy: recordedBy
                };

            return {
              ...o,
              status: outcomeStatus === 'Validated' ? 'Validated' : outcomeStatus === 'Failed' ? 'Failed' : 'Inconclusive',
              hypothesis: updatedHypothesis,
              statusHistory: [
                ...o.statusHistory,
                {
                  status: outcomeStatus === 'Validated' ? 'Validated' : outcomeStatus === 'Failed' ? 'Failed' : 'Inconclusive',
                  timestamp,
                  actor: recordedBy,
                  notes: `Measurement recorded: ${outcomeStatus}. Result: ${primaryVal}, ${secondaryVal}. Notes: ${notes}`
                }
              ]
            };
          }
          return o;
        })
      );
      showToast(`Opportunity outcome recorded: ${outcomeStatus} ✓`);
    },
    [showToast]
  );

  const addOpportunity = useCallback(
    (opp: ProductOpportunity) => {
      setOpportunities(prev => [opp, ...prev]);
      showToast(`New Opportunity ${opp.id} added to queue ✓`);
    },
    [showToast]
  );

  // See the note in UIContext.
  const value = useMemo<IntelligenceContextType>(
    () => ({
      authoritativeSuppliers,
      setAuthoritativeSuppliers,
      activeSupplierId,
      setActiveSupplierId,
      pricingDecisions,
      setPricingDecisions,
      contentBridges,
      setContentBridges,
      opportunities,
      setOpportunities,
      featureRegister,
      setFeatureRegister,
      promoteCandidateToSupplierOS,
      approvePricingDecision,
      adoptContentBridge,
      decideOpportunity,
      updateOpportunityHypothesis,
      recordOpportunityOutcome,
      addOpportunity
    }),
    [
      authoritativeSuppliers,
      activeSupplierId,
      pricingDecisions,
      contentBridges,
      opportunities,
      featureRegister,
      promoteCandidateToSupplierOS,
      approvePricingDecision,
      adoptContentBridge,
      decideOpportunity,
      updateOpportunityHypothesis,
      recordOpportunityOutcome,
      addOpportunity
    ]
  );

  return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
};

export const useIntelligence = () => {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
};
