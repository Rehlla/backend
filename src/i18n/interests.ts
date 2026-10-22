import { INTERESTS_DATA, type InterestId } from '../components/planner/StepInterests';
import type { Language } from './resolve';

/**
 * Interest taxonomy localizer.
 *
 * Interests arrive as free English strings from several vocabularies — the
 * planner taxonomy ids, the AI plan-intent phrases ("Diving & Red Sea reefs"),
 * the trip defaults ("Lagoon Chill") — but they render in Arabic UI as-is,
 * so "Diving / Adventure / Food" sat untranslated in the dossier. This maps
 * every known phrasing onto the planner taxonomy (the one surface that is
 * already bilingual) and reads the Arabic name from there. Unknown strings
 * pass through untouched: inventing a translation is worse than English.
 */
const ALIAS_TO_ID: Record<string, InterestId> = {
  diving: 'diving',
  'diving & marine': 'diving',
  'diving & red sea reefs': 'diving',
  adventure: 'adventure',
  'desert & canyons': 'adventure',
  relax: 'relax',
  'beach & relax': 'relax',
  'lagoon chill': 'relax',
  'beach & wellness': 'relax',
  wellness: 'relax',
  food: 'food',
  'local food & cafés': 'food',
  'local food & cafes': 'food',
  'seafood & local food': 'food',
  desert: 'desert',
  'desert & safari': 'desert',
  'desert stargazing': 'desert',
  'local life': 'local-life',
  'bedouin culture & heritage': 'local-life',
  water: 'water',
  'water activities': 'water',
  nightlife: 'nightlife',
};

export function localizeInterest(value: string, language: Language): string {
  const norm = value.trim().toLowerCase();
  const direct = INTERESTS_DATA.find((i) => i.id === norm || i.name.toLowerCase() === norm);
  const id = direct?.id ?? ALIAS_TO_ID[norm];
  const item = direct ?? INTERESTS_DATA.find((i) => i.id === id);
  if (!item) return value;
  return language === 'ar' ? item.nameAr || item.name : item.name;
}
