import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Language } from '../i18n/resolve';

export interface Bilingual {
  en: string;
  ar: string;
}

export interface SeasonRow {
  month: number;
  airC: Bilingual;
  seaC: Bilingual;
  wind: Bilingual;
  description: Bilingual;
  recommended: Bilingual[];
  urgency?: Bilingual;
}

export interface Experience {
  id: string;
  /** The catalogue activity the card opens; absent for walk-in outings with no page of their own. */
  activityId?: string;
  /** What checkout charges per person, when the outing can be booked. */
  fromPriceEGP?: number | null;
  name: Bilingual;
  duration: Bilingual;
  priceEgp: string;
  skill: Bilingual;
  modality: Bilingual;
  walk?: Bilingual;
}

export interface Landmark {
  id: string;
  name: Bilingual;
  fact: Bilingual;
  access: Bilingual;
  connectivity: Bilingual;
  tier: Bilingual;
}

export interface SafetyContact {
  label: Bilingual;
  number: string;
}

export interface SafetyRule {
  en: string;
  ar: string;
}

export interface ResearchOverview {
  seasonal: SeasonRow[];
  experiences: Experience[];
  landmarks: Landmark[];
  safety: {
    contacts: SafetyContact[];
    note: Bilingual;
    rules: SafetyRule[];
  };
  provenance: string;
}

/** Format a native date month (1-12) for the current-year season row. */
export function currentMonthNumber(now: Date = new Date()): number {
  return now.getUTCMonth() + 1;
}

export function useResearchOverview(): ResearchOverview | null {
  const [overview, setOverview] = useState<ResearchOverview | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getResearchOverview().then((data) => {
      if (isMounted && data) setOverview(data as ResearchOverview);
    }).catch(() => {
      // Research-backed sections are additive; absence is an honest off state.
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return overview;
}

/** Pick the right locale string from a bilingual pair. */
export function pick(b: Bilingual | undefined, language: Language): string {
  if (!b) return '';
  return b[language] ?? b.en;
}
